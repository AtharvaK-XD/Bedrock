import { describe, expect, it } from 'vitest';
import {
  renderWelcomeEmail,
  renderInvoiceEmail,
  renderInactivityEmail,
  renderAnnouncementEmail,
} from '../api/_lib/email.js';

describe('api/_lib/email', () => {
  it('renders welcome email with correct brand links and recipient greeting', () => {
    const { subject, html } = renderWelcomeEmail({ name: 'Atharva', email: 'test@example.com' });
    expect(subject).toContain('Welcome to Bedrock');
    expect(html).toContain('Welcome to Bedrock, Atharva!');
    expect(html).toContain('bedrockxai.com');
    expect(html).toContain('Prompt Wizard');
  });

  it('renders tax invoice email with exact rupee amounts and GST calculation', () => {
    const { subject, html } = renderInvoiceEmail({
      name: 'Atharva Kulkarni',
      email: 'test@example.com',
      planName: 'Bedrock Pro',
      tier: 'pro',
      amountPaise: 47082,
      basePaise: 39900,
      gstPaise: 7182,
      orderId: 'order_test_123',
      paymentId: 'pay_test_456',
    });

    expect(subject).toContain('Tax Invoice & Receipt (order_test_123)');
    expect(html).toContain('order_test_123');
    expect(html).toContain('pay_test_456');
    expect(html).toContain('399.00'); // Base price
    expect(html).toContain('71.82');  // 18% GST
    expect(html).toContain('470.82'); // Total amount
    expect(html).toContain('Bedrock Pro');
  });

  it('renders inactivity re-engagement email with tips and unsubscribe link', () => {
    const { subject, html } = renderInactivityEmail({ name: 'Atharva' });
    expect(subject).toContain('Ready to architect your next prompt');
    expect(html).toContain('Full-Stack Architecture Prompt');
    expect(html).toContain('Launch Studio');
    expect(html).toContain('Update notification preferences in Settings');
  });

  it('renders announcement email with release bullets and call to action', () => {
    const { subject, html } = renderAnnouncementEmail({
      title: 'Bedrock 1.5 Released',
      badge: 'v1.5 Update',
      highlights: ['DeepSeek V3 support', '10x faster synthesis wizard'],
      ctaUrl: 'https://bedrockxai.com/wizard',
    });

    expect(subject).toContain('Bedrock 1.5 Released');
    expect(html).toContain('DeepSeek V3 support');
    expect(html).toContain('v1.5 Update');
  });
});
