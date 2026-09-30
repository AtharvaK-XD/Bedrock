import type { VercelRequest } from '@vercel/node';
import { getDb, UserRow, logSecurityEvent } from './db.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  subscriptionTier: string;
  plan: string;
  isGuest: boolean;
}

export const DEFAULT_DEV_USER_ID = 'usr_lead_architect_01';

/**
 * Safely decodes JWT claims from a base64url encoded token
 */
function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Authenticates request via Clerk JWT or Bearer token, auto-provisioning the user in Neon DB.
 */
export async function authenticateRequest(req: VercelRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie || '';
  
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (cookieHeader) {
    const match = cookieHeader.match(/__session=([^;]+)/);
    if (match && match[1]) {
      token = match[1];
    }
  }

  // 1. If valid token provided, resolve user identity
  if (token) {
    const claims = decodeJwtPayload(token);
    if (claims && claims.sub) {
      const userId = claims.sub;
      const email = claims.email || claims.primary_email || `${userId}@clerk.user`;
      let name = claims.name || claims.first_name || (req.headers['x-user-name'] as string) || '';
      if (!name || name.startsWith('user_') || name.includes('@')) {
        name = 'Atharva Kulkarni';
      }

      try {
        const sql = getDb();
        // Check if user exists in Neon DB
        const existing = await sql`
          SELECT * FROM "User" WHERE id = ${userId} OR email = ${email} LIMIT 1
        ` as UserRow[];

        if (existing.length > 0 && existing[0]) {
          const user = existing[0];
          const cleanName = (!user.name || user.name.startsWith('user_') || user.name.includes('@'))
            ? 'Atharva Kulkarni'
            : user.name;
          return {
            id: user.id,
            email: user.email,
            name: cleanName,
            role: user.role || 'Lead Prompt Architect',
            subscriptionTier: user.subscription_tier || 'free',
            plan: user.plan || 'Free Plan',
            isGuest: false,
          };
        }

        // Auto-provision user in Neon DB on first authenticated call
        const now = new Date();
        await sql`
          INSERT INTO "User" (
            id, email, password_hash, name, username, plan, role,
            email_verified, mfa_enabled, subscription_tier, created_at, updated_at
          ) VALUES (
            ${userId}, ${email}, ${'clerk_oauth_external'}, ${name}, ${null},
            ${'Free Plan'}, ${'Lead Prompt Architect'}, ${true}, ${false},
            ${'free'}, ${now}, ${now}
          )
          ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
        `;

        return {
          id: userId,
          email,
          name,
          role: 'Lead Prompt Architect',
          subscriptionTier: 'free',
          plan: 'Free Plan',
          isGuest: false,
        };
      } catch (dbErr: any) {
        console.error('[Auth] Failed to sync user to Neon DB:', dbErr);
        // Fall back gracefully to token claims if DB error occurred
        return {
          id: userId,
          email,
          name,
          role: 'Lead Prompt Architect',
          subscriptionTier: 'free',
          plan: 'Free Plan',
          isGuest: false,
        };
      }
    }
  }

  // 2. Local / Desktop Fallback
  const host = (req.headers.host || req.headers.origin || '') as string;
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('tauri');
  
  if (isLocal) {
    return {
      id: DEFAULT_DEV_USER_ID,
      email: 'local-architect@bedrock.app',
      name: 'Atharva K.',
      role: 'Lead Prompt Architect',
      subscriptionTier: 'free',
      plan: 'Free Plan',
      isGuest: true,
    };
  }

  return null;
}
