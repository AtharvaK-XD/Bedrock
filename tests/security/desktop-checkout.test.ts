// Desktop "Upgrade": checkout is handed to the system browser at https://bedrockxai.com/pricing; the desktop app never
// loads Razorpay's script, never creates an order and never opens payment pages inside the app (src/lib/razorpay.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function stubBrowser(desktop: boolean) {
  const open = vi.fn();
  const createElement = vi.fn(() => ({}));
  const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
  vi.stubGlobal('window', { open, ...(desktop ? { IS_ELECTRON: true } : {}), location: { search: '', protocol: 'https:' } });
  vi.stubGlobal('navigator', { userAgent: desktop ? 'Mozilla/5.0 Electron/43' : 'Mozilla/5.0 Chrome/140' });
  vi.stubGlobal('document', { createElement, querySelector: () => null, head: { appendChild: vi.fn() } });
  vi.stubGlobal('fetch', fetchMock);
  return { open, createElement, fetchMock };
}

const config = (extra: Record<string, unknown> = {}) => ({
  tier: 'pro',
  planName: 'Pro Plan',
  amount: 170000,
  userName: 'A',
  userEmail: 'a@x.test',
  onSuccess: vi.fn(),
  onError: vi.fn(),
  onDismiss: vi.fn(),
  ...extra,
});

describe('desktop upgrade', () => {
  it('opens https://bedrockxai.com/pricing in the system browser and does nothing payment-related in the app', async () => {
    const { open, createElement, fetchMock } = stubBrowser(true);
    const { startRazorpayCheckout, loadRazorpayScript } = await import('../../src/lib/razorpay');
    const onOpenedInBrowser = vi.fn();
    const c = config({ onOpenedInBrowser });
    await startRazorpayCheckout(c as any);
    expect(open).toHaveBeenCalledWith('https://bedrockxai.com/pricing', '_blank', 'noopener,noreferrer');
    expect(onOpenedInBrowser).toHaveBeenCalledWith('https://bedrockxai.com/pricing');
    expect(fetchMock).not.toHaveBeenCalled(); // no order created from the desktop app
    expect(createElement).not.toHaveBeenCalled(); // no Razorpay <script>
    expect(c.onError).not.toHaveBeenCalled();
    expect(await loadRazorpayScript()).toBe(false);
  });

  it('without an onOpenedInBrowser handler the screen is reset through onDismiss', async () => {
    stubBrowser(true);
    const { startRazorpayCheckout } = await import('../../src/lib/razorpay');
    const c = config();
    await startRazorpayCheckout(c as any);
    expect(c.onDismiss).toHaveBeenCalled();
  });

  it('the website still runs checkout itself (loads Razorpay, never redirects)', async () => {
    const { open, createElement } = stubBrowser(false);
    const { startRazorpayCheckout } = await import('../../src/lib/razorpay');
    const p = startRazorpayCheckout(config() as any);
    await Promise.resolve();
    expect(createElement).toHaveBeenCalledWith('script');
    expect(open).not.toHaveBeenCalled();
    void p;
  });
});
