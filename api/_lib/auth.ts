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
 * Allowed `azp` origins (the site a token was issued to) from CLERK_AUTHORIZED_PARTIES (comma-separated).
 * When the variable is not set: on Vercel PRODUCTION the site's own addresses are enforced anyway
 * (PRODUCTION_APP_ORIGINS), so a token issued to some other site that uses the same Clerk instance is not
 * accepted; elsewhere (previews, local development) azp is not enforced (warning logged once). Loopback
 * origins on any port are always allowed for the desktop app's external-browser sign-in.
 */
const LOOPBACK_AZP_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;
let authorizedPartiesCache: Set<string> | null | undefined;
function getAuthorizedParties(): Set<string> | null {
  if (authorizedPartiesCache !== undefined) return authorizedPartiesCache;
  const parties = (process.env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map((p) => normalizeIssuer(p))
    .filter(Boolean);
  if (parties.length > 0) {
    authorizedPartiesCache = new Set(parties);
  } else if (process.env.VERCEL_ENV === 'production') {
    console.warn('[Auth] CLERK_AUTHORIZED_PARTIES is not set: enforcing the production origins only.');
    authorizedPartiesCache = new Set(PRODUCTION_APP_ORIGINS);
  } else {
    console.warn('[Auth] CLERK_AUTHORIZED_PARTIES is not set: token azp is not enforced.');
    authorizedPartiesCache = null;
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

const PRODUCTION_APP_ORIGINS = new Set([
  'https://bedrockxai.com',
  'https://www.bedrockxai.com',
  'https://bedrock-steel.vercel.app',
]);
const PRODUCTION_APP_ORIGIN = 'https://bedrockxai.com';

/**
 * Browser origins allowed to call Bedrock's credentialed endpoints cross-origin: the request's
 * own host (same-origin, including preview deployments), the production site, the
 * CLERK_AUTHORIZED_PARTIES list and the desktop app's loopback server.
 */
export function isAllowedAppOrigin(origin: string, requestHost?: string): boolean {
  const clean = normalizeIssuer(origin);
  if (LOOPBACK_AZP_RE.test(clean) || clean === PRODUCTION_APP_ORIGIN || PRODUCTION_APP_ORIGINS.has(clean)) return true;
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

// A token with a key id Clerk never issued must not make every request download Clerk's key list again:
// ask again at most once a minute after a successful download, and after 10 s when Clerk was unreachable.
const JWKS_MISS_REFETCH_MS = 60 * 1000;
const JWKS_FAIL_RETRY_MS = 10 * 1000;
const jwksLastAttempt = new Map<string, { at: number; ok: boolean }>();
const jwksInFlight = new Map<string, Promise<Map<string, crypto.KeyObject> | null>>();

/** Downloads the key list once, even when many requests ask at the same moment. */
function downloadJwks(cleanIssuer: string): Promise<Map<string, crypto.KeyObject> | null> {
  const running = jwksInFlight.get(cleanIssuer);
  if (running) return running;

  const task = (async () => {
    const jwksUrl = `${cleanIssuer}/.well-known/jwks.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout
    try {
      const res = await fetch(jwksUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        console.warn(`[Auth] JWKS endpoint returned status ${res.status} from ${jwksUrl}`);
        jwksLastAttempt.set(cleanIssuer, { at: Date.now(), ok: false });
        return null;
      }

      const data = (await res.json()) as { keys?: any[] };
      if (!Array.isArray(data?.keys)) {
        jwksLastAttempt.set(cleanIssuer, { at: Date.now(), ok: false });
        return null;
      }

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
      jwksLastAttempt.set(cleanIssuer, { at: Date.now(), ok: true });
      return keyMap;
    } catch (err: any) {
      console.warn(`[Auth] Failed to fetch JWKS from ${cleanIssuer}:`, err?.message || err);
      jwksLastAttempt.set(cleanIssuer, { at: Date.now(), ok: false });
      return null;
    } finally {
      clearTimeout(timeout);
      jwksInFlight.delete(cleanIssuer);
    }
  })();

  jwksInFlight.set(cleanIssuer, task);
  return task;
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

  // 4. Unknown key id: do not ask Clerk again if we asked a moment ago
  const last = jwksLastAttempt.get(cleanIssuer);
  if (last && !jwksInFlight.has(cleanIssuer) && Date.now() - last.at < (last.ok ? JWKS_MISS_REFETCH_MS : JWKS_FAIL_RETRY_MS)) {
    return null;
  }

  // 5. Fetch JWKS from Clerk
  const keys = await downloadJwks(cleanIssuer);
  return keys?.get(kid) || null;
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
 * The name the browser suggests for a brand-new account (x-user-name). It is the user's own name and
 * they can set any name through the profile anyway, so it is kept, but only as short plain text: a
 * repeated header arrives as an array, and control characters do not belong in a name.
 */
function safeDisplayNameHint(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 100);
}

const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', 'tauri.localhost']);

/**
 * The anonymous "local architect" account exists only for development on this computer: the Host header
 * must be exactly a local name, and the code must not be running on Vercel (VERCEL_ENV is "production"
 * or "preview" there; "vercel dev" sets "development"). A header alone never creates this account.
 */
function isLocalDevRequest(req: VercelRequest): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== 'development') return false;
  const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : '';
  const hostname = hostHeader.replace(/:\d+$/, '').toLowerCase();
  return LOCAL_DEV_HOSTNAMES.has(hostname);
}

const COOKIE_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard for the cookie sign-in path. A browser attaches the Clerk "__session" cookie by itself, also to
 * requests another site triggers; a Bearer header it never adds on its own. So for a state-changing request the
 * cookie only counts when the request comes from Bedrock's own pages (Origin, or Referer when Origin is absent).
 */
function cookieSessionAllowed(req: VercelRequest): boolean {
  const method = String(req.method || 'GET').toUpperCase();
  if (COOKIE_SAFE_METHODS.has(method)) return true;
  let origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (!origin && typeof req.headers.referer === 'string') {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {
      origin = '';
    }
  }
  const host = typeof req.headers.host === 'string' ? req.headers.host : undefined;
  if (origin && origin !== 'null' && isAllowedAppOrigin(origin, host)) return true;
  console.warn(`[Auth] Ignored the session cookie on a ${method} request from origin ${origin.slice(0, 120) || '(none)'} (CSRF guard)`);
  return false;
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
    const match = cookieHeader.match(/(?:^|;\s*)__session=([^;]+)/);
    if (match && match[1] && cookieSessionAllowed(req)) {
      token = match[1];
    }
  }

  // 1. If valid token provided, resolve user identity with cryptographic verification
  if (token) {
    const claims = await verifyClerkJwt(token);
    if (claims && claims.sub) {
      const userId = claims.sub;
      const email = claims.email || claims.primary_email || `${userId}@clerk.user`;
      let name = claims.name || claims.first_name || safeDisplayNameHint(req.headers['x-user-name']);
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
        // Check if user exists in Neon DB. Linking to an existing account by email is only allowed
        // when the token says the email is verified (Clerk claim from `{{user.email_verified}}`);
        // otherwise anyone who registers an unverified copy of an address could take over that account.
        const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
        const linkEmail = emailVerified && !email.endsWith('@clerk.user') ? email : null;
        // Exact id match always wins over an email match. Only the columns used below: never password_hash.
        // Email compare ignores case (same rule as the "User_email_lower_key" index, migration 0007).
        const existing = await sql`
          SELECT id, email, name, role, subscription_tier, plan FROM "User"
          WHERE id = ${userId} OR (${linkEmail}::text IS NOT NULL AND lower(email) = lower(${linkEmail}))
          ORDER BY (id = ${userId}) DESC LIMIT 1
        ` as Array<Pick<UserRow, 'id' | 'email' | 'name' | 'role' | 'subscription_tier' | 'plan'>>;

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
        const insertUser = (rowEmail: string, rowEmailVerified: boolean) => sql`
          INSERT INTO "User" (
            id, email, password_hash, name, username, plan, role,
            email_verified, mfa_enabled, subscription_tier, created_at, updated_at
          ) VALUES (
            ${userId}, ${rowEmail}, ${'clerk_oauth_external'}, ${name}, ${null},
            ${'Free Plan'}, ${'Lead Prompt Architect'}, ${rowEmailVerified}, ${false},
            ${'free'}, ${now}, ${now}
          )
          ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
        `;
        try {
          await insertUser(email, emailVerified);
        } catch (insertErr: any) {
          // The email already belongs to another account and was not linked (not verified): keep this
          // account separate under a placeholder address instead of leaving it without a database row.
          if (insertErr?.code !== '23505') throw insertErr;
          await insertUser(`${userId}@clerk.user`, false);
        }

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

  // 2. Local development fallback (never on Vercel's production or preview servers)
  if (isLocalDevRequest(req)) {
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
