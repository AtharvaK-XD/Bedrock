/**
 * The single source of truth for Bedrock subscription plan pricing across USD and INR.
 *
 * USD Pricing (For International & Global card payments):
 * - Pro: $20 / month (2000 cents in Razorpay)
 * - Ultimate: $50 / month (5000 cents in Razorpay)
 *
 * INR Pricing (For Indian domestic payments: UPI, RuPay, NetBanking):
 * - Pro: ₹1,700 / month (170,000 paise in Razorpay) — identical equivalent of $20 USD
 * - Ultimate: ₹4,250 / month (425,000 paise in Razorpay) — identical equivalent of $50 USD
 */

export type PaidPlan = 'pro' | 'ultimate';
export type BillingCurrency = 'USD' | 'INR';

export interface PlanPrice {
  /** Base display price (e.g. "20" or "1,700") */
  base: string;
  /** Applicable tax / GST amount (e.g. "0.00") */
  gst: string;
  /** What the customer pays (e.g. "20" or "1,700") */
  total: string;
  /** Subunits for gateway processing: cents for USD (2000 / 5000), paise for INR (170000 / 425000) */
  totalSubunits: number;
  /** Backward-compatible alias for totalSubunits */
  totalPaise: number;
  /** Currency code */
  currency: BillingCurrency;
  /** Currency symbol ("$" or "₹") */
  symbol: string;
}

const USD_PRICES: Record<PaidPlan, { base: number; cents: number }> = {
  pro: { base: 20, cents: 2000 },
  ultimate: { base: 50, cents: 5000 },
};

const INR_PRICES: Record<PaidPlan, { base: number; paise: number }> = {
  pro: { base: 1700, paise: 170_000 },
  ultimate: { base: 4250, paise: 425_000 },
};

function formatInr(amount: number): string {
  return amount.toLocaleString('en-IN');
}

export function getPlanPrice(plan: PaidPlan, currency: BillingCurrency = 'INR'): PlanPrice {
  if (currency === 'USD') {
    const info = USD_PRICES[plan];
    return {
      base: String(info.base),
      gst: '0.00',
      total: String(info.base),
      totalSubunits: info.cents,
      totalPaise: info.cents,
      currency: 'USD',
      symbol: '$',
    };
  }

  const info = INR_PRICES[plan];
  return {
    base: formatInr(info.base),
    gst: '0.00',
    total: formatInr(info.base),
    totalSubunits: info.paise,
    totalPaise: info.paise,
    currency: 'INR',
    symbol: '₹',
  };
}

/** Formatted price label (e.g. "$20" or "₹1,700") */
export function planPriceLabel(plan: PaidPlan, currency: BillingCurrency = 'INR'): string {
  if (currency === 'USD') {
    return `$${USD_PRICES[plan].base}`;
  }
  return `₹${formatInr(INR_PRICES[plan].base)}`;
}
