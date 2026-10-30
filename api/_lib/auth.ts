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

const normalizeIssuer = (iss: string) => iss.trim().replace(/\/+$/, '');

/**
 * Decodes the Clerk Frontend API host from a publishable key
 * (pk_test_/pk_live_ + base64("<frontend-api-host>$")).
 */
function issuerFromPublishableKey(key: string | undefined): string | null {
  const match = (key || '').trim().replace(/^"|"$/g, '').match(/^pk_(?:test|live)_(.+)$/);
  if (!match) return null;
  try {
    const host = Buffer.from(match[1], 'base64').toString('utf8').replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

/**
 * Issuers we accept tokens from. A token's own `iss` claim is never trusted on
 * its own — otherwise anyone could host a JWKS and mint tokens for any user.
 */
let allowedIssuersCache: Set<string> | null = null;
function getAllowedIssuers(): Set<string> {
  if (allowedIssuersCache) return allowedIssuersCache;
  const issuers = new Set<string>();
  for (const iss of (process.env.CLERK_ISSUER || process.env.CLERK_JWT_ISSUER || '').split(',')) {
    if (iss.trim()) issuers.add(normalizeIssuer(iss));
  }
  for (const key of [process.env.CLERK_PUBLISHABLE_KEY, process.env.VITE_CLERK_PUBLISHABLE_KEY]) {
    const iss = issuerFromPublishableKey(key);
    if (iss) issuers.add(normalizeIssuer(iss));
  }
  if (issuers.size === 0) {
    console.error('[Auth] No trusted Clerk issuer configured (set CLERK_ISSUER or VITE_CLERK_PUBLISHABLE_KEY). All tokens will be rejected.');
  }
  allowedIssuersCache = issuers;
  return issuers;
}

/**
 * Allowed `azp` origins from CLERK_AUTHORIZED_PARTIES (comma-separated). When the variable is
 * not set, azp is not enforced (warning logged once). Loopback origins on any port are always
 * allowed for the desktop app's external-browser sign-in.
 */
const LOOPBACK_AZP_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;
let authorizedPartiesCache: Set<string> | null | undefined;
function getAuthorizedParties(): Set<string> | null {
  if (authorizedPartiesCache !== undefined) return authorizedPartiesCache;
  const parties = (process.env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map((p) => normalizeIssuer(p))
    .filter(Boolean);
  if (parties.length === 0) {
    console.warn('[Auth] CLERK_AUTHORIZED_PARTIES is not set: token azp is not enforced.');
    authorizedPartiesCache = null;
  } else {
    authorizedPartiesCache = new Set(parties);
  }
  return authorizedPartiesCache;
}

function isAuthorizedParty(azp: unknown): boolean {
  if (azp === undefined) return true; // tokens without azp are accepted
  if (typeof azp !== 'string') return false;
  const parties = getAuthorizedParties();
  if (!parties) return true;
  const origin = normalizeIssuer(azp);
  return LOOPBACK_AZP_RE.test(origin) || parties.has(origin);
}

const PRODUCTION_APP_ORIGIN = 'https://bedrock-steel.vercel.app';

/**
 * Browser origins allowed to call Bedrock's credentialed endpoints cross-origin: the request's
 * own host (same-origin, including preview deployments), the production site, the
 * CLERK_AUTHORIZED_PARTIES list and the desktop app's loopback server.
 */
export function isAllowedAppOrigin(origin: string, requestHost?: string): boolean {
  const clean = normalizeIssuer(origin);
  if (LOOPBACK_AZP_RE.test(clean) || clean === PRODUCTION_APP_ORIGIN) return true;
  if (getAuthorizedParties()?.has(clean)) return true;
  if (requestHost) {
    try {
      return new URL(clean).host === requestHost.toLowerCase();
    } catch {
      return false;
    }
  }
  return false;
}

let envPemKey: crypto.KeyObject | null | undefined;
function getEnvPublicKey(): crypto.KeyObject | null {
  if (envPemKey !== undefined) return envPemKey;
  envPemKey = null;
  const envPem = process.env.CLERK_JWT_KEY || process.env.CLERK_PEM_PUBLIC_KEY;
  if (envPem) {
    try {
      const formattedPem = envPem.includes('BEGIN PUBLIC KEY')
        ? envPem
        : `-----BEGIN PUBLIC KEY-----\n${envPem}\n-----END PUBLIC KEY-----`;
      envPemKey = crypto.createPublicKey(formattedPem);
    } catch (e) {
      console.warn('[Auth] Error loading CLERK_JWT_KEY from env:', e);
    }
  }
  return envPemKey;
}

/**
 * Fetches JWKS from a trusted Clerk issuer and converts each RSA key to a Node crypto KeyObject
 */
async function getClerkPublicKey(issuer: string, kid: string): Promise<crypto.KeyObject | null> {
  // 1. Direct PEM public key in environment variable (if provided)
  const envKey = getEnvPublicKey();
  if (envKey) return envKey;

  // 2. Only ever fetch keys from an allow-listed issuer
  const cleanIssuer = normalizeIssuer(issuer);
  if (!getAllowedIssuers().has(cleanIssuer)) {
    return null;
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

const SIGNATURE_FAILURE_LOG_WINDOW_MS = 60 * 1000;
let lastSignatureFailureLoggedAt = 0;
let signatureFailuresSuppressed = 0;

function shouldPersistSignatureFailure(now = Date.now()): boolean {
  if (now - lastSignatureFailureLoggedAt >= SIGNATURE_FAILURE_LOG_WINDOW_MS) {
    lastSignatureFailureLoggedAt = now;
    return true;
  }
  signatureFailuresSuppressed += 1;
  return false;
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
    // Expiration is mandatory; 60s clock skew allowance
    if (typeof claims.exp !== 'number' || now > claims.exp + 60) {
      console.warn(`[Auth] Token expired or missing exp (exp: ${claims.exp}, now: ${now})`);
      return null;
    }

    // Not Before check with 60s clock skew allowance
    if (claims.nbf && typeof claims.nbf === 'number' && now < claims.nbf - 60) {
      console.warn(`[Auth] Token not yet active (nbf: ${claims.nbf}, now: ${now})`);
      return null;
    }

    // 3. Issuer must be one of our own Clerk instances
    const issuer = claims.iss;
    if (!issuer || typeof issuer !== 'string') {
      console.warn('[Auth] Token missing issuer (iss) claim');
      return null;
    }
    const allowedIssuers = getAllowedIssuers();
    if (allowedIssuers.size > 0 && !allowedIssuers.has(normalizeIssuer(issuer))) {
      // Log only (no DB write): this runs before rate limiting, so a DB insert here would be a cheap amplification vector
      console.warn(`[Auth] Rejected token from untrusted issuer: ${issuer.slice(0, 200)} (sub: ${String(claims.sub).slice(0, 64)})`);
      return null;
    }

    // 4. Authorized party (azp): the origin the token was issued for
    if (!isAuthorizedParty(claims.azp)) {
      console.warn(`[Auth] Rejected token for unauthorized party: ${String(claims.azp).slice(0, 200)}`);
      return null;
    }

    // 5. Cryptographic Signature Verification
    const publicKey = await getClerkPublicKey(issuer, header.kid);
    if (publicKey) {
      const dataToVerify = Buffer.from(`${parts[0]}.${parts[1]}`);
      const signature = Buffer.from(parts[2], 'base64url');

      const isVerified = crypto.verify('RSA-SHA256', dataToVerify, publicKey, signature);
      if (!isVerified) {
        const subject = String(claims.sub).slice(0, 64);
        console.warn(`[Auth] CRITICAL: Invalid signature for user ${subject}`);
        // This runs before most rate limits: write at most one DB row per window per instance,
        // so a flood of forged tokens cannot be turned into a flood of database inserts.
        if (shouldPersistSignatureFailure()) {
          await logSecurityEvent({
            userId: null,
            eventType: 'AUTH_SIGNATURE_INVALID',
            severity: 'CRITICAL',
            message: `Forged or invalid JWT signature detected for subject ${subject} (${signatureFailuresSuppressed} similar events not stored)`,
          });
          signatureFailuresSuppressed = 0;
        }
        return null;
      }
      return claims;
    }

    // Never accept unverified claims (no dev/offline fallback): fail closed
    console.warn(`[Auth] Unable to verify token signature for key ID ${header.kid}`);
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
        if (email && email.includes('@') && !email.endsWith('@clerk.user')) {
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
        // Exact id match always wins over an email match
        const existing = await sql`
          SELECT * FROM "User" WHERE id = ${userId} OR email = ${email}
          ORDER BY (id = ${userId}) DESC LIMIT 1
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
