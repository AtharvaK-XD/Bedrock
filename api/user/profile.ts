import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, UserRow } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { handleDesktopTicket } from '../_lib/desktopTicket.js';
import { handleDeleteAccount, handleClerkWebhook } from '../_lib/accountDeletion.js';
import {
  DATA_LIMITS,
  PG_UNIQUE_VIOLATION,
  sendDbFailure,
  firstFieldError,
  isUnsafeLink,
  isValidBirthDate,
  hasControlChars,
  isMissingColumnError,
} from '../_lib/dataHttp.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'general');
  if (!allowed) return;

  // Clerk's "user.deleted" webhook: called by Clerk, not by a signed-in user, so it comes before the sign-in
  // check. Its own Svix signature check is the gate. (Routed here to stay inside the 12-function Hobby cap.)
  if (req.query?.action === 'clerk-webhook') {
    return handleClerkWebhook(req, res);
  }

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: valid session token required.' });
  }

  // Desktop sign-in ticket (routed here, not a new file, to stay inside the 12-function Hobby cap)
  if (req.query?.action === 'desktop-ticket') {
    return handleDesktopTicket(req, res, user);
  }

  // "Delete my account": erases the caller's own data, then their sign-in account at Clerk
  if (req.query?.action === 'delete-account') {
    return handleDeleteAccount(req, res, user);
  }

  const sql = getDb();

  // GET: Fetch profile
  if (req.method === 'GET') {
    try {
      // Only the columns this response uses: never read password_hash or billing ids here
      type ProfileRow = Omit<UserRow, 'password_hash' | 'email_verified' | 'mfa_enabled' | 'updated_at'>;
      let rows: ProfileRow[];
      try {
        rows = await sql`
          SELECT id, name, username, email, avatar_url, avatar_initials, plan, role, bio, location,
            organization, github, huggingface, website, joined_date, created_at, subscription_tier,
            birth_date, referral_source
          FROM "User" WHERE id = ${user.id} LIMIT 1
        ` as ProfileRow[];
      } catch (err: unknown) {
        // A deploy can be ahead of the database: migration 0018 (the two onboarding columns) or db/roles.sql not
        // applied yet. Serve the profile without them instead of failing every profile request.
        if (!isMissingColumnError(err)) throw err;
        console.warn('[Profile] onboarding columns not available yet (migration 0018 / db/roles.sql); serving the profile without them');
        rows = await sql`
          SELECT id, name, username, email, avatar_url, avatar_initials, plan, role, bio, location,
            organization, github, huggingface, website, joined_date, created_at, subscription_tier
          FROM "User" WHERE id = ${user.id} LIMIT 1
        ` as ProfileRow[];
      }
      if (rows.length === 0 || !rows[0]) {
        return res.status(200).json({
          name: user.name,
          username: user.email.split('@')[0],
          email: user.email,
          role: user.role,
          plan: user.plan,
          avatarInitials: user.name.slice(0, 2).toUpperCase(),
        });
      }

      const u = rows[0];
      const cleanName = u.name && !u.name.startsWith('user_') && !u.name.includes('@')
        ? u.name
        : user.name;
      const cleanInitials = u.avatar_initials || (cleanName ? cleanName.slice(0, 2).toUpperCase() : 'PA');
      const cleanEmail = u.email && !u.email.endsWith('@clerk.user') ? u.email : user.email;
      const cleanUsername = u.username || (cleanEmail && !cleanEmail.endsWith('@clerk.user') ? cleanEmail.split('@')[0] : 'architect');
      const joinedDate = u.joined_date || (u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently');

      return res.status(200).json({
        id: u.id,
        name: cleanName,
        username: cleanUsername,
        email: cleanEmail,
        avatarUrl: u.avatar_url || '',
        avatarInitials: cleanInitials,
        plan: u.plan || 'Free Plan',
        role: u.role || 'Lead Prompt Architect',
        bio: u.bio || '',
        location: u.location || '',
        organization: u.organization || '',
        github: u.github || '',
        huggingface: u.huggingface || '',
        website: u.website || '',
        birthDate: u.birth_date || '',
        referralSource: u.referral_source || '',
        joinedDate,
        subscriptionTier: u.subscription_tier || 'free',
      });
    } catch (err: any) {
      return sendDbFailure(res, '[Profile] GET error:', 'Failed to fetch user profile', err);
    }
  }

  // PUT: Update profile
  if (req.method === 'PUT') {
    const body = req.body || {};
    const fieldError = firstFieldError([
      [body.name, DATA_LIMITS.profileName, 'name'],
      [body.username, DATA_LIMITS.profileUsername, 'username'],
      [body.bio, DATA_LIMITS.profileBio, 'bio'],
      [body.location, DATA_LIMITS.profileShortText, 'location'],
      [body.organization, DATA_LIMITS.profileShortText, 'organization'],
      [body.github, DATA_LIMITS.profileLink, 'github'],
      [body.huggingface, DATA_LIMITS.profileLink, 'huggingface'],
      [body.website, DATA_LIMITS.profileLink, 'website'],
      [body.birthDate, DATA_LIMITS.profileBirthDate, 'birthDate'],
      [body.referralSource, DATA_LIMITS.profileReferralSource, 'referralSource'],
    ]);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    // Onboarding answers (migration 0018). An answer that is absent is left as it is; '' or null clears it.
    const hasBirthDate = body.birthDate !== undefined;
    const hasReferralSource = body.referralSource !== undefined;
    const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
    const referralSource = typeof body.referralSource === 'string' ? body.referralSource.trim() : '';
    if (birthDate && !isValidBirthDate(birthDate)) {
      return res.status(400).json({ error: 'birthDate must be a real date written YYYY-MM-DD (for example 2000-01-31)' });
    }
    if (hasControlChars(referralSource)) {
      return res.status(400).json({ error: 'referralSource must be plain text' });
    }
    // A request that carries only onboarding answers must not touch the other profile fields (the normal save below
    // writes every field, so a missing one would be cleared).
    const PROFILE_FIELDS = ['name', 'username', 'bio', 'location', 'organization', 'github', 'huggingface', 'website'] as const;
    const onboardingOnly = (hasBirthDate || hasReferralSource) && PROFILE_FIELDS.every((f) => body[f] === undefined);
    for (const field of ['github', 'huggingface', 'website'] as const) {
      if (body[field] && isUnsafeLink(body[field])) {
        return res.status(400).json({ error: `${field} must be a normal web link (http or https)` });
      }
    }

    try {
      if (hasBirthDate || hasReferralSource) {
        // Done first and on its own statement, so a database that is not ready (migration 0018 or db/roles.sql
        // missing) is reported before anything else is changed.
        try {
          await sql`
            UPDATE "User"
            SET
              birth_date = CASE WHEN ${hasBirthDate}::boolean THEN ${birthDate || null}::text ELSE birth_date END,
              referral_source = CASE WHEN ${hasReferralSource}::boolean THEN ${referralSource || null}::text ELSE referral_source END,
              updated_at = NOW()
            WHERE id = ${user.id}
          `;
        } catch (err: unknown) {
          if (!isMissingColumnError(err)) throw err;
          console.error('[Profile] PUT: onboarding columns not available (migration 0018 / db/roles.sql not applied yet)');
          return res.status(503).json({
            error: 'Onboarding answers cannot be saved yet',
            code: 'ONBOARDING_FIELDS_NOT_READY',
            message: 'This part of your profile cannot be saved right now. Please try again later.',
          });
        }
        if (onboardingOnly) {
          return res.status(200).json({ message: 'Profile updated successfully', success: true });
        }
      }

      const name = body.name || user.name;
      const username = body.username || null;
      const bio = body.bio || null;
      const location = body.location || null;
      const organization = body.organization || null;
      const github = body.github || null;
      const huggingface = body.huggingface || null;
      const website = body.website || null;

      await sql`
        UPDATE "User"
        SET 
          name = ${name},
          username = ${username},
          bio = ${bio},
          location = ${location},
          organization = ${organization},
          github = ${github},
          huggingface = ${huggingface},
          website = ${website},
          updated_at = NOW()
        WHERE id = ${user.id}
      `;

      return res.status(200).json({
        message: 'Profile updated successfully',
        success: true,
      });
    } catch (err: any) {
      if (err?.code === PG_UNIQUE_VIOLATION) {
        return res.status(409).json({
          error: 'Profile value already in use',
          code: 'PROFILE_VALUE_TAKEN',
          message: 'That username is already taken. Please choose another one.',
        });
      }
      return sendDbFailure(res, '[Profile] PUT error:', 'Failed to update user profile', err);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
