import type { VercelRequest } from '@vercel/node';
import crypto from 'node:crypto';
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

// In-memory JWKS cache with 1-hour TTL for high-throughput edge verification
interface CachedJwks {
  keys: Map<string, crypto.KeyObject>;
  expiresAt: number;
}
const jwksCache = new Map<string, CachedJwks>();
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches JWKS from Clerk issuer and converts each RSA key to a Node crypto KeyObject
 */
async function getClerkPublicKey(issuer: string, kid: string): Promise<crypto.KeyObject | null> {
  // 1. Direct PEM public key in environment variable (if provided)
  const envPem = process.env.CLERK_JWT_KEY || process.env.CLERK_PEM_PUBLIC_KEY;
  if (envPem) {
    try {
      const formattedPem = envPem.includes('BEGIN PUBLIC KEY')
        ? envPem
        : `-----BEGIN PUBLIC KEY-----\n${envPem}\n-----END PUBLIC KEY-----`;
      return crypto.createPublicKey(formattedPem);
    } catch (e) {
      console.warn('[Auth] Error loading CLERK_JWT_KEY from env:', e);
    }
  }

  // 2. Normalize issuer URL
  let cleanIssuer = issuer.trim();
  if (cleanIssuer.endsWith('/')) {
    cleanIssuer = cleanIssuer.slice(0, -1);
  }

  // 3. Check in-memory JWKS cache
  const cached = jwksCache.get(cleanIssuer);
  if (cached && Date.now() < cached.expiresAt) {
    const key = cached.keys.get(kid);
    if (key) return key;
  }

  // 4. Fetch JWKS from Clerk
  try {
    const jwksUrl = `${cleanIssuer}/.well-known/jwks.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(jwksUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Auth] JWKS endpoint returned status ${res.status} from ${jwksUrl}`);
      return null;
    }

    const data = (await res.json()) as { keys?: any[] };
    if (!Array.isArray(data?.keys)) return null;

    const keyMap = new Map<string, crypto.KeyObject>();
    for (const jwk of data.keys) {
      if (jwk.kty === 'RSA' && jwk.n && jwk.e && jwk.kid) {
        try {
          const keyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
          keyMap.set(jwk.kid, keyObj);
        } catch (jwkErr) {
          console.warn(`[Auth] Failed to parse JWK ${jwk.kid}:`, jwkErr);
        }
      }
    }

    jwksCache.set(cleanIssuer, {
      keys: keyMap,
      expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
    });

    return keyMap.get(kid) || null;
  } catch (err: any) {
    console.warn(`[Auth] Failed to fetch JWKS from ${cleanIssuer}:`, err?.message || err);
    return null;
  }
}

/**
 * Cryptographically verifies a Clerk RS256 JWT token.
 * Validates token structure, signature, expiration (exp), not-before (nbf), and claims.
 */
async function verifyClerkJwt(token: string): Promise<any | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    // 1. Decode and validate header
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    const header = JSON.parse(headerJson);
    if (header.alg !== 'RS256' || !header.kid) {
      console.warn(`[Auth] Rejected token with unsupported algorithm: ${header.alg}`);
      return null;
    }

    // 2. Decode and validate payload claims
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const claims = JSON.parse(payloadJson);

    if (!claims.sub) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    // Expiration check with 60s clock skew allowance
    if (claims.exp && typeof claims.exp === 'number' && now > claims.exp + 60) {
      console.warn(`[Auth] Token expired (exp: ${claims.exp}, now: ${now})`);
      return null;
    }

    // Not Before check with 60s clock skew allowance
    if (claims.nbf && typeof claims.nbf === 'number' && now < claims.nbf - 60) {
      console.warn(`[Auth] Token not yet active (nbf: ${claims.nbf}, now: ${now})`);
      return null;
    }

    // 3. Cryptographic Signature Verification
    const issuer = claims.iss;
    if (!issuer || typeof issuer !== 'string' || !issuer.startsWith('http')) {
      console.warn('[Auth] Token missing valid issuer (iss) claim');
      return null;
    }

    const publicKey = await getClerkPublicKey(issuer, header.kid);
    if (publicKey) {
      const dataToVerify = Buffer.from(`${parts[0]}.${parts[1]}`);
      const signature = Buffer.from(parts[2], 'base64url');

      const isVerified = crypto.verify('RSA-SHA256', dataToVerify, publicKey, signature);
      if (!isVerified) {
        console.warn(`[Auth] CRITICAL: Invalid signature for user ${claims.sub}`);
        await logSecurityEvent({
          userId: claims.sub,
          eventType: 'AUTH_SIGNATURE_INVALID',
          severity: 'CRITICAL',
          message: `Forged or invalid JWT signature detected for subject ${claims.sub}`,
        });
        return null;
      }
      return claims;
    }

    // 4. Fallback in development/offline testing mode only
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Auth] Non-production environment: JWKS unreachable, falling back to claims.');
      return claims;
    }

    // In production, reject if public key could not be verified
    console.warn(`[Auth] Unable to verify signature in production for key ID ${header.kid}`);
    return null;
  } catch (err: any) {
    console.warn('[Auth] JWT verification exception:', err?.message || err);
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

  // 1. If valid token provided, resolve user identity with cryptographic verification
  if (token) {
    const claims = await verifyClerkJwt(token);
    if (claims && claims.sub) {
      const userId = claims.sub;
      const email = claims.email || claims.primary_email || `${userId}@clerk.user`;
      let name = claims.name || claims.first_name || (req.headers['x-user-name'] as string) || '';
      if (!name || name.startsWith('user_') || name.includes('@')) {
        if (/kulkarni.*atharva|atharva.*kulkarni/i.test(email)) {
          name = 'Atharva Kulkarni';
        } else if (email && email.includes('@') && !email.endsWith('@clerk.user')) {
          const handle = email.split('@')[0];
          const cleanWords = handle.replace(/[0-9._-]+/g, ' ').trim().split(' ').filter(Boolean);
          name = cleanWords.length > 0 
            ? cleanWords.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') 
            : 'Prompt Architect';
        } else {
          name = 'Prompt Architect';
        }
      }

      try {
        const sql = getDb();
        // Check if user exists in Neon DB
        const existing = await sql`
          SELECT * FROM "User" WHERE id = ${userId} OR email = ${email} LIMIT 1
        ` as UserRow[];

        if (existing.length > 0 && existing[0]) {
          const user = existing[0];
          let cleanName = user.name;
          if (!cleanName || cleanName.startsWith('user_') || cleanName.includes('@')) {
            cleanName = name;
          }
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
