/**
 * Bedrock's paid plans and the rules both billing routes share (api/billing/create-order.ts, verify-payment.ts).
 *
 * The SERVER decides what a plan costs and which plan a payment buys. The browser only names the plan it wants;
 * an amount or plan sent by the browser is never trusted (before 2026-11-07 both were, so an order for ₹1 could be
 * paid and then "verified" as Ultimate).
 */

export type PaidTier = 'pro' | 'ultimate';

export interface BillingPlan {
  tier: PaidTier;
  planName: string;
  /** Price shown on the pricing page before tax, in rupees */
  basePriceInr: number;
  /** What the customer pays: base price + 18% GST, in paise (the unit Razorpay uses) */
  amountPaise: number;
}

/** Matches src/pages/Pricing.tsx: Pro ₹399 + ₹71.82 GST = ₹470.82; Ultimate ₹999 + ₹179.82 GST = ₹1,178.82. */
export const BILLING_PLANS: Record<PaidTier, BillingPlan> = {
  pro: { tier: 'pro', planName: 'Pro Plan', basePriceInr: 399, amountPaise: 47_082 },
  ultimate: { tier: 'ultimate', planName: 'Ultimate Plan', basePriceInr: 999, amountPaise: 117_882 },
};

export const BILLING_CURRENCY = 'INR';

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

/** Base price and GST contained in a GST-inclusive amount (paise), for receipts. */
export function splitGst(amountPaise: number): { basePaise: number; gstPaise: number } {
  const basePaise = Math.round(amountPaise / 1.18);
  return { basePaise, gstPaise: amountPaise - basePaise };
}

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

export type OrderCompletion =
  /** The order was unpaid and is now paid; accountTier is what the account has now */
  | { kind: 'paid'; orderTier: PaidTier; accountTier: PaidTier; userId: string }
  /** The same payment was already applied to this order (a retry, or the webhook after the browser): nothing changed */
  | { kind: 'already_paid'; orderTier: PaidTier; accountTier: PaidTier; userId: string }
  /** No such order (for this account, when one is named) */
  | { kind: 'not_found' }
  /** The order's stored price does not cover its plan (an under-priced order from before the price fix) */
  | { kind: 'amount_mismatch'; amount: number; currency: string; tier: string }
  /** The order is already paid with a different payment */
  | { kind: 'paid_by_other_payment' };

/**
 * Marks a still-unpaid order as paid and applies the plan stored on it, in ONE statement (both updates happen or
 * neither). Used by verify-payment (the browser, `userId` = the signed-in account) and the webhook (Razorpay,
 * `userId` null: the account comes from the order row). Safe to call again with the same payment.
 * - The plan comes from the order row only; its stored INR amount must cover today's price of that plan.
 * - `paidAmount` (webhook: what Razorpay captured) must cover the stored amount too.
 * - A Pro payment never lowers an Ultimate account (the order is still recorded as paid).
 */
export async function completePaidOrder(
  sql: Sql,
  p: { orderId: string; paymentId: string; signature: string | null; userId: string | null; paidAmount?: number; paidCurrency?: string }
): Promise<OrderCompletion> {
  const paidAmount = typeof p.paidAmount === 'number' && Number.isFinite(p.paidAmount) ? Math.round(p.paidAmount) : null;
  const paidCurrency = p.paidCurrency ?? BILLING_CURRENCY;
  const rows = (await sql`
    WITH paid AS (
      UPDATE "PaymentRecord"
      SET payment_id = ${p.paymentId}, signature = COALESCE(${p.signature}::text, signature), status = 'captured', updated_at = NOW()
      WHERE order_id = ${p.orderId}
        AND (${p.userId}::text IS NULL OR user_id = ${p.userId}::text)
        -- an order whose account was erased (migration 0019 sets user_id to NULL) can never be completed
        AND user_id IS NOT NULL
        AND status = 'created'
        AND currency = ${BILLING_CURRENCY}
        AND ${paidCurrency}::text = ${BILLING_CURRENCY}
        AND (${paidAmount}::int IS NULL OR ${paidAmount}::int >= amount)
        AND amount >= CASE WHEN tier = 'ultimate' THEN ${BILLING_PLANS.ultimate.amountPaise}::int ELSE ${BILLING_PLANS.pro.amountPaise}::int END
      RETURNING user_id, CASE WHEN tier = 'ultimate' THEN 'ultimate' ELSE 'pro' END AS tier
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
    SELECT paid.user_id, paid.tier, (SELECT count(*) FROM upgraded)::int AS upgraded FROM paid
  `) as Array<{ user_id: string; tier: string; upgraded: number }>;

  const done = rows[0];
  if (done) {
    const orderTier = normalizePaidTier(done.tier) ?? 'pro';
    // Not upgraded = the account already had Ultimate and this was a Pro order
    return { kind: 'paid', orderTier, accountTier: Number(done.upgraded) > 0 ? orderTier : 'ultimate', userId: done.user_id };
  }

  // Nothing changed: find out why
  const [order] = (await sql`
    SELECT o.user_id, o.tier, o.status, o.payment_id, o.amount, o.currency, u.subscription_tier
    FROM "PaymentRecord" o LEFT JOIN "User" u ON u.id = o.user_id
    WHERE o.order_id = ${p.orderId} AND (${p.userId}::text IS NULL OR o.user_id = ${p.userId}::text)
    LIMIT 1
  `) as Array<{ user_id: string; tier: string; status: string; payment_id: string | null; amount: number; currency: string; subscription_tier: string | null }>;
  if (!order) return { kind: 'not_found' };
  if (order.status === 'captured' && order.payment_id === p.paymentId) {
    const orderTier = normalizePaidTier(order.tier) ?? 'pro';
    return { kind: 'already_paid', orderTier, accountTier: normalizePaidTier(order.subscription_tier) ?? orderTier, userId: order.user_id };
  }
  if (order.status === 'captured') return { kind: 'paid_by_other_payment' };
  return { kind: 'amount_mismatch', amount: Number(order.amount), currency: order.currency, tier: order.tier };
}
