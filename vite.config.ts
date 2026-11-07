import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { KNOWN_SERVER_ONLY_VITE_VARS, isSecretLikeViteVar } from './viteEnvGuard.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // The known server-only names, plus ANY VITE_ variable whose name looks like a secret (viteEnvGuard.ts)
  const FORBIDDEN_SECRETS = [
    ...new Set([...KNOWN_SERVER_ONLY_VITE_VARS, ...Object.keys(env).filter(isSecretLikeViteVar)]),
  ];

  // Overrides to force empty string for any forbidden secret in the client bundle
  const defineOverrides: Record<string, string> = {};
  for (const key of FORBIDDEN_SECRETS) {
    defineOverrides[`import.meta.env.${key}`] = JSON.stringify('');
    // Delete from process.env during Vite build execution so it cannot be inlined by envPrefix
    delete process.env[key];
  }

  for (const forbidden of FORBIDDEN_SECRETS) {
    if (env[forbidden] && env[forbidden].trim().length > 0) {
      console.warn(
        `⚠️ [VITE_ LEAK GUARD] Stripped "${forbidden}" from client bundle to prevent public exposure in browser DevTools. (Use "${forbidden.replace('VITE_', '')}" in serverless backend).`
      );
    }
  }

  return {
    base: '/',
    define: defineOverrides,
    plugins: [
      react(),
      {
        name: 'vite-dev-billing-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const urlPath = req.url ? req.url.split('?')[0] : '';
            if (urlPath === '/api/billing/create-order' || urlPath === '/api/create-order') {
              if (req.method === 'POST') {
                let bodyStr = '';
                req.on('data', (chunk) => { bodyStr += chunk; });
                req.on('end', async () => {
                  try {
                    const body = bodyStr ? JSON.parse(bodyStr) : {};
                    const amount = Number(body.amount) || 39900;
                    const keyId = process.env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TxDt5ASdEdwHRM';
                    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'Y8UNcE1AWjLMac4pzwqpEH4u';

                    const Razorpay = (await import('razorpay')).default;
                    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
                    const order = await rzp.orders.create({
                      amount,
                      currency: body.currency || 'INR',
                      receipt: `rcpt_${Date.now()}`,
                      notes: typeof body.notes === 'object' && body.notes !== null ? body.notes : {},
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      order_id: order.id,
                      orderId: order.id,
                      amount: order.amount,
                      currency: order.currency,
                      tier: body.tier || 'pro',
                      keyId,
                    }));
                  } catch (err: any) {
                    const desc = err?.error?.description || err?.message || 'Razorpay order creation failed';
                    res.writeHead(err?.statusCode || 500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: desc }));
                  }
                });
                return;
              }
            }

            if (urlPath === '/api/billing/verify-payment' || urlPath === '/api/verify-payment') {
              if (req.method === 'POST') {
                let bodyStr = '';
                req.on('data', (chunk) => { bodyStr += chunk; });
                req.on('end', async () => {
                  try {
                    const body = bodyStr ? JSON.parse(bodyStr) : {};
                    const orderId = body.razorpay_order_id || body.orderId || body.order_id;
                    const paymentId = body.razorpay_payment_id || body.paymentId || body.payment_id;
                    const signature = body.razorpay_signature || body.signature;
                    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'Y8UNcE1AWjLMac4pzwqpEH4u';

                    const crypto = await import('node:crypto');
                    const text = `${orderId}|${paymentId}`;
                    const expected = crypto.createHmac('sha256', keySecret).update(text).digest('hex');

                    const sigBuf = Buffer.from(signature || '', 'utf8');
                    const expBuf = Buffer.from(expected, 'utf8');
                    const isValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

                    if (!isValid) {
                      res.writeHead(400, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ success: false, error: 'Signature mismatch' }));
                      return;
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                      success: true,
                      plan: body.tier === 'ultimate' ? 'Ultimate Plan' : 'Pro Plan',
                      tier: body.tier || 'pro',
                      order_id: orderId,
                      payment_id: paymentId,
                    }));
                  } catch (err: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message || 'Payment verification failed' }));
                  }
                });
                return;
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        }
      }
    }
  };
})

