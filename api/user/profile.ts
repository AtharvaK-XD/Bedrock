import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, UserRow } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { DATA_LIMITS, PG_UNIQUE_VIOLATION, sendDbFailure, firstFieldError, isUnsafeLink } from '../_lib/dataHttp.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'general');
  if (!allowed) return;

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: valid session token required.' });
  }

  const sql = getDb();

  // GET: Fetch profile
  if (req.method === 'GET') {
    try {
      // Only the columns this response uses: never read password_hash or billing ids here
      const rows = await sql`
        SELECT id, name, username, email, avatar_url, avatar_initials, plan, role, bio, location,
          organization, github, huggingface, website, joined_date, created_at, subscription_tier
        FROM "User" WHERE id = ${user.id} LIMIT 1
      ` as Array<Omit<UserRow, 'password_hash' | 'email_verified' | 'mfa_enabled' | 'updated_at'>>;
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
    ]);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }
    for (const field of ['github', 'huggingface', 'website'] as const) {
      if (body[field] && isUnsafeLink(body[field])) {
        return res.status(400).json({ error: `${field} must be a normal web link (http or https)` });
      }
    }

    try {
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
