import type { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, logSecurityEvent } from '../_lib/db.js';

const TIER_PRICES: Record<string, number> = {
  pro: 39900,      // ₹399 in paise
  advanced: 39900, // ₹399 in paise
  ultimate: 99900, // ₹999 in paise
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  let amount: number | undefined;
  let tier = 'pro';

  if (typeof body.amount === 'number' && !isNaN(body.amount)) {
    amount = Math.round(body.amount);
  } else if (typeof body.amount === 'string' && !isNaN(Number(body.amount))) {
    amount = Math.round(Number(body.amount));
  } else if (body.tier && typeof body.tier === 'string') {
    tier = body.tier.toLowerCase();
    amount = TIER_PRICES[tier];
  } else {
    // Default tier
    amount = TIER_PRICES.pro;
  }

  // Minimum order amount validation (must be at least 100 paise / ₹1)
  if (!amount || typeof amount !== 'number' || isNaN(amount) || amount < 100) {
    return res.status(400).json({ error: 'Amount must be at least 100 paise' });
  }

  const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : 'INR';
  const receipt = typeof body.receipt === 'string' && body.receipt.trim().length > 0
    ? body.receipt.trim().slice(0, 40)
    : `rcpt_${(user.id || 'usr').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Date.now()}`;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error('[Billing] Razorpay credentials missing from server environment.');
    return res.status(500).json({ error: 'Razorpay payment gateway not configured on server' });
  }

  let orderId: string;
  try {
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const rzOrder = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        userId: user.id,
        tier,
        ...(typeof body.notes === 'object' && body.notes !== null ? body.notes : {}),
      },
    });

    orderId = rzOrder.id;
  } catch (rzErr: any) {
    console.error('[Billing] Razorpay API order creation failed:', rzErr);
    return res.status(500).json({
      error: 'Failed to create Razorpay order',
      message: rzErr?.message || rzErr?.description || 'Razorpay order creation failed',
    });
  }

  // Record pending payment in Neon DB
  try {
    const sql = getDb();
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await sql`
      INSERT INTO "PaymentRecord" (id, user_id, order_id, amount, currency, status, tier, created_at, updated_at)
      VALUES (${paymentId}, ${user.id}, ${orderId}, ${amount}, ${currency}, ${'created'}, ${tier}, NOW(), NOW())
    `;

    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_ORDER_CREATED',
      severity: 'INFO',
      message: `Created order ${orderId} for tier ${tier} (₹${amount / 100})`,
    });
  } catch (dbErr: any) {
    console.warn('[Billing] Non-fatal DB logging failure for order creation:', dbErr?.message || dbErr);
  }

  return res.status(200).json({
    order_id: orderId,
    orderId,
    amount,
    currency,
    receipt,
    tier,
    keyId,
  });
}
