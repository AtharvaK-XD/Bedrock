import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadRazorpayScript,
  createRazorpayOrder,
  verifyRazorpayPayment,
  startRazorpayCheckout,
} from '../razorpay.js';

describe('src/lib/razorpay', () => {
  const originalFetch = globalThis.fetch;
  let scriptsInHead: any[] = [];
  let mockWindow: any = {};
  let mockDocument: any = {};

  beforeEach(() => {
    vi.clearAllMocks();
    scriptsInHead = [];

    mockWindow = {
      Razorpay: undefined,
      Clerk: undefined,
    };

    mockDocument = {
      querySelector: (selector: string) => {
        if (selector.includes('checkout.razorpay.com')) {
          return scriptsInHead.find((s) => s.src.includes('checkout.razorpay.com')) || null;
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes('checkout.razorpay.com')) {
          return scriptsInHead.filter((s) => s.src.includes('checkout.razorpay.com'));
        }
        return [];
      },
      createElement: (tag: string) => {
        const listeners: Record<string, Function[]> = {};
        return {
          tagName: tag.toUpperCase(),
          src: '',
          async: false,
          onload: null as any,
          onerror: null as any,
          addEventListener: (event: string, fn: Function) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(fn);
          },
          removeEventListener: (event: string, fn: Function) => {
            if (listeners[event]) {
              listeners[event] = listeners[event].filter((f) => f !== fn);
            }
          },
          dispatchEvent: function (event: { type: string }) {
            if (event.type === 'load' && this.onload) {
              this.onload();
            }
            if (event.type === 'error' && this.onerror) {
              this.onerror(new Error('script error'));
            }
            if (listeners[event.type]) {
              listeners[event.type].forEach((fn) => fn(event));
            }
            return true;
          },
        };
      },
      head: {
        appendChild: (el: any) => {
          scriptsInHead.push(el);
          return el;
        },
      },
    };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('document', mockDocument);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
  });

  describe('loadRazorpayScript', () => {
    it('resolves immediately if window.Razorpay already exists', async () => {
      mockWindow.Razorpay = vi.fn();
      const loaded = await loadRazorpayScript();
      expect(loaded).toBe(true);
    });

    it('injects script tag and resolves true on load', async () => {
      const promise = loadRazorpayScript();
      const script = scriptsInHead.find((s) => s.src.includes('checkout.razorpay.com'));
      expect(script).toBeDefined();
      expect(script.src).toBe('https://checkout.razorpay.com/v1/checkout.js');

      // Simulate script load
      script.dispatchEvent({ type: 'load' });
      const result = await promise;
      expect(result).toBe(true);
    });

    it('resolves false on script error', async () => {
      const promise = loadRazorpayScript();
      const script = scriptsInHead.find((s) => s.src.includes('checkout.razorpay.com'));
      expect(script).toBeDefined();

      // Simulate script error
      script.dispatchEvent({ type: 'error' });
      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe('createRazorpayOrder', () => {
    it('posts to /api/billing/create-order and returns order response', async () => {
      const mockOrder = {
        order_id: 'order_test_999',
        amount: 39900,
        currency: 'INR',
        tier: 'pro',
      };

      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => mockOrder,
      })) as any;

      const result = await createRazorpayOrder({ amount: 39900, tier: 'pro' });
      expect(result).toEqual(mockOrder);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/billing/create-order',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ amount: 39900, tier: 'pro', currency: 'INR' }),
        })
      );
    });

    it('throws error when server responds with non-ok status', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Amount must be at least 100 paise' }),
      })) as any;

      await expect(createRazorpayOrder({ amount: 50 })).rejects.toThrow(
        'Amount must be at least 100 paise'
      );
    });
  });

  describe('verifyRazorpayPayment', () => {
    it('posts payment details to /api/billing/verify-payment', async () => {
      const mockSuccess = { success: true, plan: 'Pro Plan', tier: 'pro' };

      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => mockSuccess,
      })) as any;

      const result = await verifyRazorpayPayment({
        orderId: 'order_test_123',
        paymentId: 'pay_test_456',
        signature: 'sig_test_789',
        tier: 'pro',
      });

      expect(result).toEqual(mockSuccess);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/billing/verify-payment',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('throws error on verification failure', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid payment signature. Verification failed.' }),
      })) as any;

      await expect(
        verifyRazorpayPayment({
          orderId: 'order_test_123',
          paymentId: 'pay_test_456',
          signature: 'bad_signature',
        })
      ).rejects.toThrow('Invalid payment signature. Verification failed.');
    });
  });

  describe('startRazorpayCheckout', () => {
    it('handles successful payment and verification callback', async () => {
      let instanceOptions: any = null;
      const mockOpen = vi.fn();
      const mockOn = vi.fn();

      const MockRazorpay = vi.fn().mockImplementation(function (options: any) {
        instanceOptions = options;
        return {
          open: mockOpen,
          on: mockOn,
        };
      });
      mockWindow.Razorpay = MockRazorpay;

      const orderData = {
        order_id: 'order_test_555',
        amount: 39900,
        currency: 'INR',
        keyId: 'rzp_test_mockKeyId',
      };

      const verifyData = {
        success: true,
        plan: 'Pro Plan',
        tier: 'pro',
      };

      globalThis.fetch = vi.fn(async (input: any) => {
        const url = String(input);
        if (url.includes('create-order')) {
          return { ok: true, json: async () => orderData } as any;
        }
        if (url.includes('verify-payment')) {
          return { ok: true, json: async () => verifyData } as any;
        }
        return { ok: false, status: 404 } as any;
      }) as any;

      const onSuccess = vi.fn();
      const onError = vi.fn();
      const onDismiss = vi.fn();

      await startRazorpayCheckout({
        tier: 'pro',
        planName: 'Pro Plan',
        amount: 39900,
        userName: 'Atharva Kulkarni',
        userEmail: 'user@example.com',
        onSuccess,
        onError,
        onDismiss,
      });

      expect(MockRazorpay).toHaveBeenCalled();
      expect(mockOpen).toHaveBeenCalled();
      expect(instanceOptions.name).toBe('Bedrock');
      expect(instanceOptions.theme.color).toBe('#2C9A8B');
      expect(instanceOptions.prefill.email).toBe('user@example.com');

      // Simulate payment success handler
      await instanceOptions.handler({
        razorpay_order_id: 'order_test_555',
        razorpay_payment_id: 'pay_test_777',
        razorpay_signature: 'sig_test_valid',
      });

      expect(onSuccess).toHaveBeenCalledWith(verifyData);
      expect(onError).not.toHaveBeenCalled();

      // Simulate ondismiss
      instanceOptions.modal.ondismiss();
      expect(onDismiss).toHaveBeenCalled();
    });

    it('triggers onError callback when payment fails', async () => {
      let failCallback: ((err: any) => void) | null = null;
      const mockOpen = vi.fn();
      const mockOn = vi.fn((event: string, cb: any) => {
        if (event === 'payment.failed') {
          failCallback = cb;
        }
      });

      mockWindow.Razorpay = vi.fn().mockImplementation(function () {
        return {
          open: mockOpen,
          on: mockOn,
        };
      });

      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          order_id: 'order_test_666',
          amount: 39900,
          currency: 'INR',
          keyId: 'rzp_test_mockKeyId',
        }),
      })) as any;

      const onSuccess = vi.fn();
      const onError = vi.fn();

      await startRazorpayCheckout({
        tier: 'pro',
        planName: 'Pro Plan',
        amount: 39900,
        userName: 'Atharva Kulkarni',
        userEmail: 'user@example.com',
        onSuccess,
        onError,
      });

      expect(failCallback).not.toBeNull();
      failCallback!({ error: { description: 'Card expired' } });
      expect(onError).toHaveBeenCalledWith('Card expired');
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
