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
  const orderId = body.razorpay_order_id || body.orderId || body.order_id;
  const paymentId = body.razorpay_payment_id || body.paymentId || body.payment_id;
  const signature = body.razorpay_signature || body.signature;

  // Validation: all three fields are strictly required
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      error: 'Missing required parameters: order_id, payment_id, and signature are required',
    });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error('[Billing] RAZORPAY_KEY_SECRET missing from server environment.');
    return res.status(500).json({ error: 'Payment gateway secret not configured on server' });
  }

  // Cryptographic HMAC SHA256 Signature Verification
  const text = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(text)
    .digest('hex');

  const sigBuffer = Buffer.from(signature, 'utf8');
  const genBuffer = Buffer.from(generatedSignature, 'utf8');
  const isValid = sigBuffer.length === genBuffer.length && crypto.timingSafeEqual(sigBuffer, genBuffer);

  if (!isValid) {
    try {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'PAYMENT_SIGNATURE_MISMATCH',
        severity: 'CRITICAL',
        message: `Fraud warning: Razorpay signature verification failed for order ${orderId}`,
      });
    } catch {}

    return res.status(400).json({
      success: false,
      error: 'Invalid payment signature. Verification failed.',
    });
  }

  // Update Payment record & upgrade user's plan in Neon PostgreSQL
  try {
    const sql = getDb();
    const targetTier = (typeof body.tier === 'string' && body.tier ? body.tier : 'pro').toLowerCase();
    const planName = targetTier === 'ultimate' ? 'Ultimate Plan' : 'Pro Plan';

    await sql`
      UPDATE "PaymentRecord"
      SET 
        payment_id = ${paymentId},
        signature = ${signature},
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
      order_id: orderId,
      payment_id: paymentId,
    });
  } catch (err: any) {
    console.error('[Billing] Verify payment error:', err);
    return res.status(500).json({ error: 'Failed to complete payment verification', message: err.message });
  }
}
