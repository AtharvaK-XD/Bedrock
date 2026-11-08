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

/** Razorpay's own id formats. Anything else is refused before it reaches Razorpay or the database. */
export const RAZORPAY_ORDER_ID_RE = /^order_[A-Za-z0-9]{6,40}$/;
export const RAZORPAY_PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{6,40}$/;
/** HMAC-SHA256 as lowercase hex */
export const RAZORPAY_SIGNATURE_RE = /^[a-f0-9]{64}$/;
