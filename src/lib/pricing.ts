/**
 * The one place the plan prices are written down (in rupees). Pricing, Billing, Profile, the upgrade window and the
 * Dashboard all read from here, so a price can never differ between screens.
 *
 * The server keeps its own copy (api/billing/create-order.ts, in paise). Keep the two in step: base price × 100 = paise.
 * GST is 18% and is added on top of the base price.
 */

export type PaidPlan = 'pro' | 'ultimate';

const BASE_PRICE_INR: Record<PaidPlan, number> = {
  pro: 1,
  ultimate: 2,
};

const GST_RATE = 0; // Testing mode: ₹1 for Pro, ₹2 for Ultimate

export interface PlanPrice {
  /** Price before GST, whole rupees (e.g. "399") */
  base: string;
  /** GST amount (e.g. "71.82") */
  gst: string;
  /** What the customer pays, with GST (e.g. "470.82") */
  total: string;
  /** Total in paise, the unit the payment gateway uses (e.g. 47082) */
  totalPaise: number;
}

function format(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getPlanPrice(plan: PaidPlan): PlanPrice {
  const base = BASE_PRICE_INR[plan];
  // Work in paise so there is no floating-point drift (399 × 18% = 7182 paise)
  const basePaise = base * 100;
  const gstPaise = Math.round(basePaise * GST_RATE);
  const totalPaise = basePaise + gstPaise;
  return {
    base: String(base),
    gst: format(gstPaise / 100),
    total: format(totalPaise / 100),
    totalPaise,
  };
}

/** "₹399" style label for a plan's base price. */
export function planPriceLabel(plan: PaidPlan): string {
  return `₹${BASE_PRICE_INR[plan]}`;
}
