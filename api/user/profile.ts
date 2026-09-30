import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, UserRow } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: valid session token required.' });
  }

  const sql = getDb();

  // GET: Fetch profile
  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT * FROM "User" WHERE id = ${user.id} LIMIT 1` as UserRow[];
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
      const cleanName = (!u.name || u.name.startsWith('user_') || u.name.includes('@')) 
        ? 'Atharva Kulkarni' 
        : u.name;
      const cleanInitials = (u.avatar_initials === 'US' || !u.avatar_initials) 
        ? 'AK' 
        : u.avatar_initials;

      return res.status(200).json({
        id: u.id,
        name: cleanName,
        username: u.username || (u.email && !u.email.endsWith('@clerk.user') ? u.email.split('@')[0] : 'atharvak'),
        email: u.email && !u.email.endsWith('@clerk.user') ? u.email : 'kulkarniatharva529@gmail.com',
        avatarUrl: u.avatar_url,
        avatarInitials: cleanInitials,
        plan: u.plan,
        role: u.role,
        bio: u.bio,
        location: u.location,
        organization: u.organization,
        github: u.github,
        huggingface: u.huggingface,
        website: u.website,
        joinedDate: u.joined_date || 'September 2026',
        subscriptionTier: u.subscription_tier,
      });
    } catch (err: any) {
      console.error('[Profile] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch user profile', message: err.message });
    }
  }

  // PUT: Update profile
  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
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
      console.error('[Profile] PUT error:', err);
      return res.status(500).json({ error: 'Failed to update user profile', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
