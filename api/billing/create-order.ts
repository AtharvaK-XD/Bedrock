import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, logSecurityEvent } from '../_lib/db.js';

const TIER_PRICES: Record<string, number> = {
  advanced: 39900, // ₹399 in paise
  ultimate: 99900, // ₹999 in paise
  pro: 39900,
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
  const tier = (body.tier || 'advanced').toLowerCase();
  const amount = TIER_PRICES[tier];

  if (!amount) {
    return res.status(400).json({ error: 'Invalid subscription tier' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  let orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // If live Razorpay credentials exist, create order via Razorpay API
  if (keyId && keySecret) {
    try {
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const rzResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt: `rcpt_${user.id.slice(0, 10)}_${Date.now()}`,
          notes: {
            userId: user.id,
            tier,
          },
        }),
      });

      if (rzResponse.ok) {
        const rzOrder = await rzResponse.json();
        orderId = rzOrder.id;
      }
    } catch (rzErr) {
      console.warn('[Billing] Razorpay API call failed, using internal order ID:', rzErr);
    }
  }

  // Record pending payment in Neon DB
  try {
    const sql = getDb();
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await sql`
      INSERT INTO "PaymentRecord" (id, user_id, order_id, amount, currency, status, tier, created_at, updated_at)
      VALUES (${paymentId}, ${user.id}, ${orderId}, ${amount}, ${'INR'}, ${'created'}, ${tier}, NOW(), NOW())
    `;

    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_ORDER_CREATED',
      severity: 'INFO',
      message: `Created order ${orderId} for tier ${tier} (₹${amount / 100})`,
    });

    return res.status(200).json({
      orderId,
      amount,
      currency: 'INR',
      tier,
      keyId: keyId || null,
    });
  } catch (err: any) {
    console.error('[Billing] Create order failed:', err);
    return res.status(500).json({ error: 'Failed to create order', message: err.message });
  }
}
