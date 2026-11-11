/**
 * Bedrock's paid plans and the rules both billing routes share (api/billing/create-order.ts, verify-payment.ts).
 *
 * The SERVER decides what a plan costs and which plan a payment buys. The browser only names the plan it wants;
 * an amount or plan sent by the browser is never trusted (before 2026-11-07 both were, so an order for ₹1 could be
 * paid and then "verified" as Ultimate).
 */

export type PaidTier = 'pro' | 'ultimate';
export type BillingCurrency = 'USD' | 'INR';

export interface BillingPlan {
  tier: PaidTier;
  planName: string;
  /** Price in USD dollars ($20 / $50) */
  basePriceUsd: number;
  /** Amount in cents for USD payments (2000 / 5000) */
  amountCents: number;
  /** Price shown on the pricing page in rupees (all-inclusive, as src/lib/pricing.ts shows it) */
  basePriceInr: number;
  /** What the customer pays in INR, in paise (the unit Razorpay uses) */
  amountPaise: number;
}

/**
 * Exactly ONE price per plan and currency, the one src/lib/pricing.ts shows: $20 / $50, and ₹1,700 / ₹4,250
 * (CHG-0120). The browser never chooses among several amounts: create-order charges this value and
 * completePaidOrder refuses an order below it, so an order made at an older, lower price can never unlock a plan.
 * Change a price here and in src/lib/pricing.ts together (tests/security/billing-single-price.test.ts checks both).
 */
export const BILLING_PLANS: Record<PaidTier, BillingPlan> = {
  pro: {
    tier: 'pro',
    planName: 'Pro Plan',
    basePriceUsd: 20,
    amountCents: 2000,
    basePriceInr: 1700,
    amountPaise: 170_000,
  },
  ultimate: {
    tier: 'ultimate',
    planName: 'Ultimate Plan',
    basePriceUsd: 50,
    amountCents: 5000,
    basePriceInr: 4250,
    amountPaise: 425_000,
  },
};

/** The one amount (cents for USD, paise for INR) a plan costs in a currency. */
export function planAmount(tier: PaidTier, currency: BillingCurrency): number {
  return currency === 'USD' ? BILLING_PLANS[tier].amountCents : BILLING_PLANS[tier].amountPaise;
}

export const BILLING_CURRENCY = 'INR';
export const SUPPORTED_CURRENCIES: readonly BillingCurrency[] = ['USD', 'INR'];

/** Each payment adds this many days of the paid plan (migration 0020, OPEN-0086). */
export const PLAN_PERIOD_DAYS = 30;

/** A plan end date as an ISO string, or null (no end date / unreadable). */
export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** True when the plan has an end date and it has passed. No end date (NULL) never expires. */
export function isPlanExpired(planExpiresAt: unknown, now: number = Date.now()): boolean {
  const iso = toIsoOrNull(planExpiresAt);
  return iso !== null && new Date(iso).getTime() <= now;
}

/**
 * The plan an account really has today: a paid plan whose end date has passed counts as free. Nothing is written
 * when a plan runs out (no cron job): every place that reads the plan goes through this.
 */
export function effectivePlan(
  storedTier: string | null | undefined,
  storedPlan: string | null | undefined,
  planExpiresAt: unknown,
  now: number = Date.now()
): { subscriptionTier: string; plan: string; planExpiresAt: string | null; planExpired: boolean } {
  const tier = storedTier || 'free';
  const expired = tier !== 'free' && isPlanExpired(planExpiresAt, now);
  return {
    subscriptionTier: expired ? 'free' : tier,
    plan: expired ? 'Free Plan' : storedPlan || 'Free Plan',
    planExpiresAt: toIsoOrNull(planExpiresAt),
    planExpired: expired,
  };
}

/** One structured line per event an operator must look at, easy to search for and to alert on in Vercel > Logs. */
export function billingAlert(event: string, details: Record<string, string | number | boolean | null | undefined>): void {
  // `alert` and `at` last, so a detail can never overwrite them
  console.error(`[BILLING_ALERT] ${JSON.stringify({ ...details, alert: event, at: new Date().toISOString() })}`);
}

/** "pro", "Pro", "advanced" (older name of Pro) -> 'pro'; "ultimate" -> 'ultimate'; anything else -> null. */
export function normalizePaidTier(raw: unknown): PaidTier | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (t === 'pro' || t === 'advanced') return 'pro';
  if (t === 'ultimate') return 'ultimate';
  return null;
}

/**
 * Razorpay TEST mode on the live site would sell every plan for free: test card numbers are public and a test
 * payment carries a valid signature. So on Vercel production a `rzp_test_` key is refused unless the owner turns
 * test payments on explicitly (BILLING_ALLOW_TEST_MODE=true) for a short test run. Live keys are never affected.
 */
export function billingTestModeBlocked(keyId: string | undefined = process.env.RAZORPAY_KEY_ID): boolean {
  return (
    process.env.VERCEL_ENV === 'production' &&
    typeof keyId === 'string' &&
    keyId.trim().startsWith('rzp_test_') &&
    process.env.BILLING_ALLOW_TEST_MODE !== 'true'
  );
}

/** Razorpay's own id formats. Anything else is refused before it reaches Razorpay or the database. */
export const RAZORPAY_ORDER_ID_RE = /^order_[A-Za-z0-9]{6,40}$/;
export const RAZORPAY_PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{6,40}$/;
/** HMAC-SHA256 as lowercase hex */
export const RAZORPAY_SIGNATURE_RE = /^[a-f0-9]{64}$/;

// ---------------------------------------------------------------------------------------------------------------
// Shared by create-order, verify-payment and the Razorpay webhook
// ---------------------------------------------------------------------------------------------------------------

/** Every billing failure has the same shape, so the app can read `code` and show `message`. */
export function billingError(
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  status: number,
  code: string,
  error: string,
  message?: string
) {
  return res.status(status).json({ success: false, error, code, ...(message ? { message } : {}) });
}

/** A call to Razorpay that has not answered within this time is given up (the SDK sets no timeout of its own). */
export const RAZORPAY_TIMEOUT_MS = 10_000;

export class BillingTimeoutError extends Error {
  code = 'BILLING_GATEWAY_TIMEOUT';
}

/** Resolves like `task`, or rejects with BillingTimeoutError after `ms`. */
export function withTimeout<T>(task: Promise<T>, ms = RAZORPAY_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BillingTimeoutError(`Razorpay did not answer within ${ms} ms`)), ms);
  });
  return Promise.race([task, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Base price and GST for a receipt. INR amounts include 18% GST. USD (international) payments carry no Indian GST
 * here: the whole amount is the base price (confirm the export-of-services treatment with the accountant).
 */
export function receiptSplit(amount: number, currency: string): { basePaise: number; gstPaise: number } {
  return currency === 'USD' ? { basePaise: amount, gstPaise: 0 } : splitGst(amount);
}

/** Base price and GST contained in a GST-inclusive amount (paise), for receipts. */
export function splitGst(amountPaise: number): { basePaise: number; gstPaise: number } {
  const basePaise = Math.round(amountPaise / 1.18);
  return { basePaise, gstPaise: amountPaise - basePaise };
}

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

export type OrderCompletion =
  /** The order was unpaid and is now paid; accountTier is what the account has now, planExpiresAt its end date */
  | {
      kind: 'paid';
      orderTier: PaidTier;
      accountTier: PaidTier;
      userId: string;
      planExpiresAt: string | null;
      /** What the order was for, in the currency's smallest unit (paise / cents): for the receipt */
      amount: number;
      currency: BillingCurrency;
    }
  /** The same payment was already applied to this order (a retry, or the webhook after the browser): nothing changed */
  | { kind: 'already_paid'; orderTier: PaidTier; accountTier: PaidTier; userId: string; planExpiresAt: string | null }
  /** No such order (for this account, when one is named) */
  | { kind: 'not_found' }
  /** The order's stored price does not cover its plan (an under-priced order from before the price fix) */
  | { kind: 'amount_mismatch'; amount: number; currency: string; tier: string }
  /** The order is already paid with a different payment */
  | { kind: 'paid_by_other_payment' };

type CompletionInput = {
  orderId: string;
  paymentId: string;
  signature: string | null;
  userId: string | null;
  paidAmount?: number;
  paidCurrency?: string;
};

const isMissingColumn = (err: unknown) => {
  const code = (err as { code?: unknown } | null)?.code;
  return code === '42703' || code === '42501';
};

/**
 * Marks a still-unpaid order as paid and applies the plan stored on it, in ONE statement (both updates happen or
 * neither). Used by verify-payment (the browser, `userId` = the signed-in account) and the webhook (Razorpay,
 * `userId` null: the account comes from the order row). Safe to call again with the same payment.
 * - The plan comes from the order row only; its stored amount must cover today's price of that plan.
 * - `paidAmount` (webhook: what Razorpay captured) must cover the stored amount too.
 * - A Pro payment never lowers an Ultimate account that is still running (the order is still recorded as paid).
 * - Plan end date (migration 0020): PLAN_PERIOD_DAYS added to the LATER of now and the current end date, so paying
 *   early loses nothing. An account that already has this plan with no end date (granted by hand, or paid before
 *   0020) keeps no end date.
 */
export async function completePaidOrder(sql: Sql, p: CompletionInput): Promise<OrderCompletion> {
  try {
    return await completeWithExpiry(sql, p);
  } catch (err) {
    // The code can be deployed before migration 0020 / db/roles.sql: a payment must still be applied (without an
    // end date) rather than fail after the customer was charged. Remove this fallback once 0020 is everywhere.
    if (!isMissingColumn(err)) throw err;
    billingAlert('PLAN_EXPIRY_COLUMN_MISSING', { orderId: p.orderId, action: 'run migration 0020 and db/roles.sql' });
    return completeWithoutExpiry(sql, p);
  }
}

async function completeWithExpiry(sql: Sql, p: CompletionInput): Promise<OrderCompletion> {
  const paidAmount = typeof p.paidAmount === 'number' && Number.isFinite(p.paidAmount) ? Math.round(p.paidAmount) : null;
  const paidCurrency = p.paidCurrency ? p.paidCurrency.toUpperCase().trim() : null;
  const rows = (await sql`
    WITH paid AS (
      UPDATE "PaymentRecord"
      SET payment_id = ${p.paymentId}, signature = COALESCE(${p.signature}::text, signature), status = 'captured', updated_at = NOW()
      WHERE order_id = ${p.orderId}
        AND (${p.userId}::text IS NULL OR user_id = ${p.userId}::text)
        -- an order whose account was erased (migration 0019 sets user_id to NULL) can never be completed
        AND user_id IS NOT NULL
        AND status = 'created'
        AND (${paidAmount}::int IS NULL OR ${paidAmount}::int >= amount)
        AND (
          (currency = 'USD' AND (${paidCurrency}::text IS NULL OR ${paidCurrency}::text = 'USD') AND amount = CASE WHEN tier = 'ultimate' THEN ${BILLING_PLANS.ultimate.amountCents}::int ELSE ${BILLING_PLANS.pro.amountCents}::int END)
          OR
          (currency = ${BILLING_CURRENCY} AND (${paidCurrency}::text IS NULL OR ${paidCurrency}::text = ${BILLING_CURRENCY}) AND amount >= CASE WHEN tier = 'ultimate' THEN ${BILLING_PLANS.ultimate.amountPaise}::int ELSE ${BILLING_PLANS.pro.amountPaise}::int END)
        )
      RETURNING user_id, amount, currency, CASE WHEN tier = 'ultimate' THEN 'ultimate' ELSE 'pro' END AS tier
    ),
    upgraded AS (
      UPDATE "User" AS u
      SET subscription_tier = paid.tier,
          plan = CASE WHEN paid.tier = 'ultimate' THEN 'Ultimate Plan' ELSE 'Pro Plan' END,
          plan_expires_at = CASE
            WHEN u.plan_expires_at IS NULL AND u.subscription_tier = paid.tier THEN NULL
            ELSE GREATEST(COALESCE(u.plan_expires_at, NOW()), NOW()) + make_interval(days => ${PLAN_PERIOD_DAYS}::int)
          END,
          updated_at = NOW()
      FROM paid
      WHERE u.id = paid.user_id
        AND (
          paid.tier = 'ultimate'
          OR COALESCE(u.subscription_tier, 'free') <> 'ultimate'
          -- an Ultimate plan that has run out no longer blocks a Pro purchase
          OR (u.plan_expires_at IS NOT NULL AND u.plan_expires_at <= NOW())
        )
      RETURNING u.id, u.plan_expires_at
    )
    SELECT paid.user_id, paid.tier, paid.amount, paid.currency,
      (SELECT count(*) FROM upgraded)::int AS upgraded,
      COALESCE((SELECT plan_expires_at FROM upgraded LIMIT 1), (SELECT plan_expires_at FROM "User" WHERE id = paid.user_id)) AS plan_expires_at
    FROM paid
  `) as Array<{ user_id: string; tier: string; amount: number; currency: string; upgraded: number; plan_expires_at: unknown }>;

  const done = rows[0];
  if (done) {
    const orderTier = normalizePaidTier(done.tier) ?? 'pro';
    // Not upgraded = the account has a running Ultimate plan and this was a Pro order
    return {
      kind: 'paid',
      orderTier,
      accountTier: Number(done.upgraded) > 0 ? orderTier : 'ultimate',
      userId: done.user_id,
      planExpiresAt: toIsoOrNull(done.plan_expires_at),
      amount: Number(done.amount),
      currency: done.currency === 'USD' ? 'USD' : 'INR',
    };
  }

  // Nothing changed: find out why
  const [order] = (await sql`
    SELECT o.user_id, o.tier, o.status, o.payment_id, o.amount, o.currency, u.subscription_tier, u.plan_expires_at
    FROM "PaymentRecord" o LEFT JOIN "User" u ON u.id = o.user_id
    WHERE o.order_id = ${p.orderId} AND (${p.userId}::text IS NULL OR o.user_id = ${p.userId}::text)
    LIMIT 1
  `) as Array<{ user_id: string; tier: string; status: string; payment_id: string | null; amount: number; currency: string; subscription_tier: string | null; plan_expires_at: unknown }>;
  return explainNoChange(order, p.paymentId);
}

/** The statement used before migration 0020 (no plan end date). Only reached through the fallback above. */
async function completeWithoutExpiry(sql: Sql, p: CompletionInput): Promise<OrderCompletion> {
  const paidAmount = typeof p.paidAmount === 'number' && Number.isFinite(p.paidAmount) ? Math.round(p.paidAmount) : null;
  const paidCurrency = p.paidCurrency ? p.paidCurrency.toUpperCase().trim() : null;
  const rows = (await sql`
    WITH paid AS (
      UPDATE "PaymentRecord"
      SET payment_id = ${p.paymentId}, signature = COALESCE(${p.signature}::text, signature), status = 'captured', updated_at = NOW()
      WHERE order_id = ${p.orderId}
        AND (${p.userId}::text IS NULL OR user_id = ${p.userId}::text)
        AND user_id IS NOT NULL
        AND status = 'created'
        AND (${paidAmount}::int IS NULL OR ${paidAmount}::int >= amount)
        AND (
          (currency = 'USD' AND (${paidCurrency}::text IS NULL OR ${paidCurrency}::text = 'USD') AND amount = CASE WHEN tier = 'ultimate' THEN ${BILLING_PLANS.ultimate.amountCents}::int ELSE ${BILLING_PLANS.pro.amountCents}::int END)
          OR
          (currency = ${BILLING_CURRENCY} AND (${paidCurrency}::text IS NULL OR ${paidCurrency}::text = ${BILLING_CURRENCY}) AND amount >= CASE WHEN tier = 'ultimate' THEN ${BILLING_PLANS.ultimate.amountPaise}::int ELSE ${BILLING_PLANS.pro.amountPaise}::int END)
        )
      RETURNING user_id, amount, currency, CASE WHEN tier = 'ultimate' THEN 'ultimate' ELSE 'pro' END AS tier
    ),
    upgraded AS (
      UPDATE "User" AS u
      SET subscription_tier = paid.tier,
          plan = CASE WHEN paid.tier = 'ultimate' THEN 'Ultimate Plan' ELSE 'Pro Plan' END,
          updated_at = NOW()
      FROM paid
      WHERE u.id = paid.user_id
        AND (paid.tier = 'ultimate' OR COALESCE(u.subscription_tier, 'free') <> 'ultimate')
      RETURNING u.id
    )
    SELECT paid.user_id, paid.tier, paid.amount, paid.currency, (SELECT count(*) FROM upgraded)::int AS upgraded FROM paid
  `) as Array<{ user_id: string; tier: string; amount: number; currency: string; upgraded: number }>;

  const done = rows[0];
  if (done) {
    const orderTier = normalizePaidTier(done.tier) ?? 'pro';
    return {
      kind: 'paid',
      orderTier,
      accountTier: Number(done.upgraded) > 0 ? orderTier : 'ultimate',
      userId: done.user_id,
      planExpiresAt: null,
      amount: Number(done.amount),
      currency: done.currency === 'USD' ? 'USD' : 'INR',
    };
  }
  const [order] = (await sql`
    SELECT o.user_id, o.tier, o.status, o.payment_id, o.amount, o.currency, u.subscription_tier
    FROM "PaymentRecord" o LEFT JOIN "User" u ON u.id = o.user_id
    WHERE o.order_id = ${p.orderId} AND (${p.userId}::text IS NULL OR o.user_id = ${p.userId}::text)
    LIMIT 1
  `) as Array<{ user_id: string; tier: string; status: string; payment_id: string | null; amount: number; currency: string; subscription_tier: string | null }>;
  return explainNoChange(order, p.paymentId);
}

function explainNoChange(
  order: { user_id: string; tier: string; status: string; payment_id: string | null; amount: number; currency: string; subscription_tier: string | null; plan_expires_at?: unknown } | undefined,
  paymentId: string
): OrderCompletion {
  if (!order) return { kind: 'not_found' };
  if (order.status === 'captured' && order.payment_id === paymentId) {
    const orderTier = normalizePaidTier(order.tier) ?? 'pro';
    return {
      kind: 'already_paid',
      orderTier,
      accountTier: normalizePaidTier(order.subscription_tier) ?? orderTier,
      userId: order.user_id,
      planExpiresAt: toIsoOrNull(order.plan_expires_at),
    };
  }
  if (order.status === 'captured') return { kind: 'paid_by_other_payment' };
  return { kind: 'amount_mismatch', amount: Number(order.amount), currency: order.currency, tier: order.tier };
}
