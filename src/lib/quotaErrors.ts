/**
 * Reads the server's "you've used your limit" answers (HTTP 429) and turns them into text that is correct for
 * the user's situation. The server already writes an accurate message for each case (limits are per 5 hours,
 * paid plans have higher limits, not unlimited ones), so the app shows that message instead of its own guess.
 *
 * Codes sent by the backend (api/_lib/security.ts, api/_lib/rateLimiter.ts):
 *   FREE_TIER_QUOTA_EXCEEDED  free account used its prompts for this 5-hour window (upgrade helps)
 *   PLAN_QUOTA_EXCEEDED       paid account reached its plan limit (upgrade does NOT help)
 *   AI_USAGE_LIMIT_EXCEEDED   AI request limit reached
 *   ANONYMOUS_DAILY_LIMIT     not signed in: the shared free allowance is used up
 *   RATE_LIMIT_EXCEEDED       too many requests in a short time
 */

export interface QuotaErrorInfo {
  code: string;
  message: string;
  /** Only offered to free accounts: a paid user at their limit is not asked to upgrade. */
  showUpgrade: boolean;
}

const FALLBACK_MESSAGE = "You've reached your usage limit for now. Limits reset every 5 hours, so please try again in a little while.";

export async function parseQuotaResponse(response: Response): Promise<QuotaErrorInfo> {
  const body = await response.clone().json().catch(() => ({}));
  const code = typeof body?.code === 'string' && body.code ? body.code : 'FREE_TIER_QUOTA_EXCEEDED';
  const message = typeof body?.message === 'string' && body.message.trim() ? body.message.trim() : FALLBACK_MESSAGE;
  return { code, message, showUpgrade: code === 'FREE_TIER_QUOTA_EXCEEDED' };
}

/** Short title for the banner, by code. */
export function quotaTitle(code?: string): string {
  switch (code) {
    case 'PLAN_QUOTA_EXCEEDED':
      return 'Plan limit reached';
    case 'ANONYMOUS_DAILY_LIMIT':
      return 'Sign in to continue';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Slow down a little';
    default:
      return 'Limit reached';
  }
}

/** True for any error the backend raised because of a usage limit. */
export function isQuotaCode(code?: string): boolean {
  return (
    code === 'FREE_TIER_QUOTA_EXCEEDED' ||
    code === 'PLAN_QUOTA_EXCEEDED' ||
    code === 'AI_USAGE_LIMIT_EXCEEDED' ||
    code === 'ANONYMOUS_DAILY_LIMIT' ||
    code === 'RATE_LIMIT_EXCEEDED'
  );
}
