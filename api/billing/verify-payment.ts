import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, logSecurityEvent } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  const { orderId, paymentId, signature, tier } = body;

  if (!orderId || !paymentId) {
    return res.status(400).json({ error: 'orderId and paymentId are required' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // Cryptographic HMAC SHA256 Signature Verification
  if (keySecret && signature) {
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'PAYMENT_SIGNATURE_MISMATCH',
        severity: 'CRITICAL',
        message: `Fraud warning: Razorpay signature verification failed for order ${orderId}`,
      });
      return res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }
  }

  // Update Payment record & upgrade user's plan in Neon PostgreSQL
  try {
    const sql = getDb();
    const targetTier = (tier || 'advanced').toLowerCase();
    const planName = targetTier === 'ultimate' ? 'Ultimate Plan' : 'Advanced Plan';

    await sql`
      UPDATE "PaymentRecord"
      SET 
        payment_id = ${paymentId},
        signature = ${signature || null},
        status = 'captured',
        updated_at = NOW()
      WHERE order_id = ${orderId} AND user_id = ${user.id}
    `;

    await sql`
      UPDATE "User"
      SET 
        subscription_tier = ${targetTier},
        plan = ${planName},
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    await logSecurityEvent({
      userId: user.id,
      eventType: 'SUBSCRIPTION_UPGRADED',
      severity: 'INFO',
      message: `User ${user.id} successfully upgraded to ${planName} via payment ${paymentId}`,
    });

    return res.status(200).json({
      success: true,
      message: `Subscription successfully upgraded to ${planName}`,
      plan: planName,
      tier: targetTier,
    });
  } catch (err: any) {
    console.error('[Billing] Verify payment error:', err);
    return res.status(500).json({ error: 'Failed to verify payment', message: err.message });
  }
}
