/**
 * Razorpay Standard Web Checkout Integration for Bedrock
 * Official Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 */

export interface RazorpayOrderResponse {
  order_id: string;
  orderId?: string;
  amount: number;
  currency: string;
  tier?: string;
  keyId?: string;
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutConfig {
  tier: string;
  planName: string;
  amount: number; // in paise
  currency?: string;
  userName: string;
  userEmail: string;
  onSuccess: (verifyResult: any) => void;
  onError: (error: string) => void;
  /**
   * The payment WENT THROUGH at Razorpay, but our server could not confirm it (network or server error).
   * Different from onError: the user may have been charged, so the screen must say so and must not invite a second payment.
   */
  onVerificationFailed?: (info: { message: string; paymentId: string }) => void;
  onOpen?: () => void;
  onDismiss?: () => void;
}

/**
 * Dynamically loads the Razorpay checkout.js bundle if not already present on window.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Razorpay] Failed to load https://checkout.razorpay.com/v1/checkout.js');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Creates an order by calling the backend endpoint.
 */
export async function createRazorpayOrder(params: {
  amount?: number;
  tier?: string;
  currency?: string;
  receipt?: string;
}): Promise<RazorpayOrderResponse> {
  let token: string | null = null;
  try {
    token = (await (window as any).Clerk?.session?.getToken?.()) || localStorage.getItem('bedrock_token');
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/billing/create-order', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: params.amount,
      tier: params.tier,
      currency: params.currency || 'INR',
      receipt: params.receipt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    // message is the sentence written for the user; error is a short title
    throw new Error(errorBody.message || errorBody.error || `Failed to create payment order (HTTP ${response.status})`);
  }

  return response.json();
}

/**
 * Verifies payment signature on the backend.
 */
export async function verifyRazorpayPayment(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  tier?: string;
}): Promise<{ success: boolean; message?: string; plan?: string }> {
  let token: string | null = null;
  try {
    token = (await (window as any).Clerk?.session?.getToken?.()) || localStorage.getItem('bedrock_token');
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/billing/verify-payment', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId: params.orderId,
      paymentId: params.paymentId,
      signature: params.signature,
      razorpay_order_id: params.orderId,
      razorpay_payment_id: params.paymentId,
      razorpay_signature: params.signature,
      tier: params.tier,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || 'Payment signature verification failed');
  }

  return response.json();
}

/**
 * Initiates Razorpay Standard Checkout:
 * 1. Ensures checkout.js is loaded
 * 2. Calls backend create-order
 * 3. Opens the Razorpay modal
 * 4. Calls backend verify-payment on successful authorization
 */
export async function startRazorpayCheckout(config: RazorpayCheckoutConfig): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    config.onError('Unable to load Razorpay payment gateway. Please check your connection and try again.');
    return;
  }

  let order: RazorpayOrderResponse;
  try {
    order = await createRazorpayOrder({
      amount: config.amount,
      tier: config.tier,
      currency: config.currency || 'INR',
    });
  } catch (err: any) {
    config.onError(err.message || 'Failed to initialize payment order');
    return;
  }

  const razorpayKey =
    order.keyId ||
    (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined);

  if (!razorpayKey) {
    config.onError('Razorpay Key ID is not configured. Please check your environment variables.');
    return;
  }

  const options = {
    key: razorpayKey,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'Bedrock',
    description: `${config.planName} Subscription`,
    image: '/logo-tight.png',
    order_id: order.order_id || order.orderId,
    prefill: {
      name: config.userName,
      email: config.userEmail,
    },
    theme: {
      color: '#000000', // Pure black theme for Razorpay checkout
      backdrop_color: '#000000',
    },
    // Close the checkout by itself after 15 minutes without a payment (the dismiss callback then runs)
    timeout: 900,
    handler: async function (response: RazorpayPaymentSuccessResponse) {
      try {
        const verifyResult = await verifyRazorpayPayment({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
          tier: config.tier,
        });
        config.onSuccess(verifyResult);
      } catch (verifyErr: any) {
        const message = verifyErr?.message || 'Payment verification failed.';
        if (config.onVerificationFailed) {
          config.onVerificationFailed({ message, paymentId: response.razorpay_payment_id });
        } else {
          config.onError(message);
        }
      }
    },
    modal: {
      backdropclose: false,
      escape: true,
      handleback: true,
      confirm_close: true,
      animation: true,
      ondismiss: function () {
        if (config.onDismiss) {
          config.onDismiss();
        }
      },
    },
  };

  try {
    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', function (failResponse: any) {
      const desc = failResponse?.error?.description || 'Payment was declined or failed. Please try again.';
      config.onError(desc);
    });
    rzp.open();
    if (config.onOpen) {
      config.onOpen();
    }
  } catch (openErr: any) {
    config.onError(openErr.message || 'Failed to open Razorpay payment modal');
  }
}

