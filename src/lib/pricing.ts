/**
 * The single source of truth for Bedrock subscription plan pricing across USD and INR.
 *
 * USD Pricing (For International & Global card payments):
 * - Pro: $20 / month (2000 cents in Razorpay)
 * - Ultimate: $50 / month (5000 cents in Razorpay)
 *
 * INR Pricing (For Indian domestic payments: UPI, RuPay, NetBanking):
 * - Pro: ₹399 / month + ₹71.82 GST = ₹470.82 (47,082 paise)
 * - Ultimate: ₹999 / month + ₹179.82 GST = ₹1,178.82 (117,882 paise)
 */

export type PaidPlan = 'pro' | 'ultimate';
export type BillingCurrency = 'USD' | 'INR';

export interface PlanPrice {
  /** Base display price (e.g. "20" or "399") */
  base: string;
  /** Applicable tax / GST amount (e.g. "0.00" or "71.82") */
  gst: string;
  /** What the customer pays (e.g. "20" or "470.82") */
  total: string;
  /** Subunits for gateway processing: cents for USD (2000 / 5000), paise for INR (47082 / 117882) */
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

const INR_PRICES: Record<PaidPlan, { base: number; gst: number; total: number; paise: number }> = {
  pro: { base: 399, gst: 71.82, total: 470.82, paise: 47_082 },
  ultimate: { base: 999, gst: 179.82, total: 1178.82, paise: 117_882 },
};

function formatInr(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    base: String(info.base),
    gst: formatInr(info.gst),
    total: formatInr(info.total),
    totalSubunits: info.paise,
    totalPaise: info.paise,
    currency: 'INR',
    symbol: '₹',
  };
}

/** Formatted price label (e.g. "$20" or "₹399") */
export function planPriceLabel(plan: PaidPlan, currency: BillingCurrency = 'INR'): string {
  if (currency === 'USD') {
    return `$${USD_PRICES[plan].base}`;
  }
  return `₹${INR_PRICES[plan].base}`;
}
