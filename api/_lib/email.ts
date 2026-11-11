/**
 * Centralized Transactional & Lifecycle Email Service for Bedrock (bedrockxai.com)
 * Powered by Resend with domain authentication on bedrockxai.com.
 *
 * Sender identities:
 *   team@bedrockxai.com     -> Welcome, onboarding, inactivity reminders, feature updates
 *   billing@bedrockxai.com  -> Official tax invoices, receipts, payment confirmations
 *   security@bedrockxai.com -> Security alerts, new sign-ins
 */

import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';

let resendInstance: Resend | null = null;
let gmailTransporter: Transporter | null = null;

export const DEFAULT_FROM_TEAM = 'Bedrock <team@bedrockxai.com>';
export const DEFAULT_FROM_BILLING = 'Bedrock Invoices <billing@bedrockxai.com>';
export const DEFAULT_FROM_SECURITY = 'Bedrock Security <security@bedrockxai.com>';
export const DEFAULT_REPLY_TO = 'bedrockofficialpage@gmail.com';

export function getResendClient(): Resend | null {
  if (resendInstance) return resendInstance;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendInstance = new Resend(apiKey);
  return resendInstance;
}

function getGmailFallback(): Transporter | null {
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const user = process.env.GMAIL_USER || 'bedrockofficialpage@gmail.com';
  if (!pass) return null;
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return gmailTransporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: 'resend' | 'gmail' | 'none';
  error?: string;
}

/**
 * Dispatches an email via Resend (primary) with Gmail SMTP as fallback.
 */
export async function sendBedrockEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    subject,
    html,
    text,
    from = DEFAULT_FROM_TEAM,
    replyTo = DEFAULT_REPLY_TO,
  } = options;

  const resend = getResendClient();
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        replyTo,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });

      if (!error && data?.id) {
        return { success: true, messageId: data.id, provider: 'resend' };
      }
      if (error) {
        console.warn('[Email] Resend send warning:', error.message || error);
      }
    } catch (err: any) {
      console.error('[Email] Resend exception:', err?.message || err);
    }
  }

  // Fallback to Gmail SMTP if configured
  const gmail = getGmailFallback();
  if (gmail) {
    try {
      const gmailUser = process.env.GMAIL_USER || 'bedrockofficialpage@gmail.com';
      const info = await gmail.sendMail({
        from: `Bedrock <${gmailUser}>`,
        to,
        replyTo,
        subject,
        html,
        text,
      });
      return { success: true, messageId: info.messageId, provider: 'gmail' };
    } catch (err: any) {
      console.error('[Email] Gmail fallback error:', err?.message || err);
    }
  }

  return {
    success: false,
    provider: 'none',
    error: 'No email service available or both Resend and Gmail failed',
  };
}

// ---------------------------------------------------------------------------
// HTML Email Templates (Branded Dark-Mode Design for bedrockxai.com)
// ---------------------------------------------------------------------------

function baseEmailWrapper(content: string, previewText: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bedrock</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #050608; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0; }
    table { border-collapse: collapse; }
    a { color: #2C9A8B; text-decoration: none; }
    .btn:hover { background-color: #238073 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050608; color: #E2E8F0;">
  ${previewText ? `<div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ''}
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #050608; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #0D1016; border: 1px solid #1E2330; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Header Bar with Bedrock Brand -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #181C26; background: linear-gradient(180deg, #121620 0%, #0D1016 100%);">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display: inline-block; vertical-align: middle;">
                      <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF; font-family: 'Space Grotesk', sans-serif;">
                        BEDROCK<span style="color: #2C9A8B;">.</span>
                      </span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #2C9A8B; background: rgba(44, 154, 139, 0.12); padding: 5px 10px; border-radius: 20px; border: 1px solid rgba(44, 154, 139, 0.25); font-weight: 700;">
                      AI Platform
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dynamic Body Content -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 32px 36px; border-top: 1px solid #161A24; background-color: #0A0C10; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                Bedrock &mdash; The Foundation for Frontier AI Prompt Engineering &amp; Workflows.<br>
                Official domain: <a href="https://bedrockxai.com" style="color: #2C9A8B; text-decoration: underline;">bedrockxai.com</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} Bedrock by Atharva Kulkarni. All rights reserved. &bull; 
                <a href="https://bedrockxai.com/privacy" style="color: #64748B; text-decoration: none;">Privacy</a> &bull; 
                <a href="https://bedrockxai.com/terms" style="color: #64748B; text-decoration: none;">Terms</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Welcome & Onboarding Email
 */
export function renderWelcomeEmail(params: { name?: string; email: string }): { subject: string; html: string } {
  const greeting = params.name ? `Welcome to Bedrock, ${params.name}!` : 'Welcome to Bedrock!';
  const subject = 'Welcome to Bedrock — Architect Superior Prompts ⚡';
  const previewText = 'Your account is ready. Discover the fastest way to craft, benchmark, and deploy frontier prompts.';

  const content = `
    <h1 style="margin: 0 0 14px 0; font-size: 24px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px; line-height: 1.3;">
      ${greeting}
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #94A3B8; line-height: 1.6;">
      You now have access to Bedrock&rsquo;s unified workstation designed to turn rough ideas into precise, high-performance prompts and multi-agent workflows.
    </p>

    <!-- Quick Start Steps Card -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #121620; border: 1px solid #1E2330; border-radius: 12px; margin-bottom: 28px; padding: 20px;">
      <tr>
        <td>
          <h2 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #2C9A8B; font-weight: 700;">
            Getting Started in 3 Steps
          </h2>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin-bottom: 4px;">
              1. Run the Prompt Wizard
            </div>
            <div style="font-size: 13px; color: #94A3B8; line-height: 1.4;">
              Type a quick 1-sentence thought, answer 3 clarifying questions, and receive an expertly structured prompt.
            </div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin-bottom: 4px;">
              2. Download the Native Desktop App
            </div>
            <div style="font-size: 13px; color: #94A3B8; line-height: 1.4;">
              Access global keyboard shortcuts (&fnof;1&ndash;&fnof;6), BYOK provider keys stored securely on your machine, and dedicated workstation layouts.
            </div>
          </div>

          <div>
            <div style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin-bottom: 4px;">
              3. Benchmark Across Frontier Models
            </div>
            <div style="font-size: 13px; color: #94A3B8; line-height: 1.4;">
              Test your generated prompts side-by-side on Groq, Gemini, and GPT-OSS models in the live Tester.
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Call to Action Button -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
      <tr>
        <td align="center">
          <a href="https://bedrockxai.com/wizard" class="btn" style="display: inline-block; background-color: #2C9A8B; color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(44, 154, 139, 0.4);">
            Open Bedrock Studio &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 13px; color: #64748B; text-align: center;">
      Need Windows or Mac desktop installers? Visit <a href="https://bedrockxai.com" style="color: #2C9A8B; text-decoration: underline;">bedrockxai.com</a> to download version 1.4.6.
    </p>
  `;

  return { subject, html: baseEmailWrapper(content, previewText) };
}

/**
 * 2. Official Tax Invoice & Payment Receipt Email
 */
export function renderInvoiceEmail(params: {
  name?: string;
  email: string;
  planName: string;
  tier: string;
  amountPaise: number;
  basePaise: number;
  gstPaise: number;
  orderId: string;
  paymentId: string;
  paidAt?: string;
  /** Currency of the amounts above (they are in its smallest unit: paise or cents). Default INR. */
  currency?: 'INR' | 'USD';
  /** ISO date the paid plan stops; omitted or null = no end date shown */
  planExpiresAt?: string | null;
}): { subject: string; html: string } {
  const usd = params.currency === 'USD';
  const symbol = usd ? '$' : '&#8377;';
  const subject = `Your Bedrock ${params.planName} Tax Invoice & Receipt (${params.orderId})`;
  const previewText = `Thank you for upgrading to Bedrock ${params.planName}. Your payment of ${usd ? '$' : '\u20B9'}${(params.amountPaise / 100).toFixed(2)} was successful.`;

  const totalRupees = (params.amountPaise / 100).toFixed(2);
  const baseRupees = (params.basePaise / 100).toFixed(2);
  const gstRupees = (params.gstPaise / 100).toFixed(2);
  const gstLabel = usd ? 'GST:' : 'Applicable GST (18%):';
  const expiry = params.planExpiresAt ? new Date(params.planExpiresAt) : null;
  const activeLine = expiry && !Number.isNaN(expiry.getTime())
    ? `Your plan is active until ${expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}.`
    : 'Your Bedrock account has been upgraded.';
  const dateFormatted = params.paidAt || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background: rgba(34, 197, 94, 0.12); color: #22C55E; border: 1px solid rgba(34, 197, 94, 0.3); padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
        &bull; Payment Verified &amp; Captured
      </div>
      <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
        Payment Receipt &amp; Tax Invoice
      </h1>
      <p style="margin: 0; font-size: 14px; color: #94A3B8;">
        Thank you for your purchase! ${activeLine}
      </p>
    </div>

    <!-- Receipt Details Table -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #121620; border: 1px solid #1E2330; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; color: #94A3B8;">
          Invoice / Order ID:
        </td>
        <td align="right" style="padding: 16px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; font-weight: 600; color: #FFFFFF; font-family: monospace;">
          ${params.orderId}
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; color: #94A3B8;">
          Payment ID:
        </td>
        <td align="right" style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; font-weight: 600; color: #FFFFFF; font-family: monospace;">
          ${params.paymentId}
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; color: #94A3B8;">
          Date:
        </td>
        <td align="right" style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; font-weight: 600; color: #FFFFFF;">
          ${dateFormatted}
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; color: #94A3B8;">
          Item:
        </td>
        <td align="right" style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; font-weight: 700; color: #2C9A8B;">
          ${params.planName}
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; color: #94A3B8;">
          Base Price:
        </td>
        <td align="right" style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; font-weight: 500; color: #CBD5E1;">
          ${symbol}${baseRupees}
        </td>
      </tr>
      <tr>
        <td style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; color: #94A3B8;">
          ${gstLabel}
        </td>
        <td align="right" style="padding: 14px 20px; border-bottom: 1px solid #1E2330; font-size: 13px; font-weight: 500; color: #CBD5E1;">
          ${symbol}${gstRupees}
        </td>
      </tr>
      <tr style="background-color: #161B26;">
        <td style="padding: 16px 20px; font-size: 15px; font-weight: 700; color: #FFFFFF;">
          Total Amount Paid:
        </td>
        <td align="right" style="padding: 16px 20px; font-size: 17px; font-weight: 800; color: #22C55E;">
          ${symbol}${totalRupees}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td align="center">
          <a href="https://bedrockxai.com/billing" class="btn" style="display: inline-block; background-color: #2C9A8B; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
            View Billing &amp; Invoices in Profile &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 12px; color: #64748B; text-align: center; line-height: 1.5;">
      Payments processed securely by Razorpay. For billing questions or support inquiries, simply reply to this email or contact support@bedrockxai.com.
    </p>
  `;

  return { subject, html: baseEmailWrapper(content, previewText) };
}

/**
 * 3. Inactivity Re-engagement Email (2-3 Days Inactive)
 */
export function renderInactivityEmail(params: { name?: string }): { subject: string; html: string } {
  const subject = 'Ready to architect your next prompt on Bedrock? ⚡';
  const previewText = 'Pick up right where you left off. Discover popular engineering templates and multi-agent workflows.';

  const content = `
    <h1 style="margin: 0 0 14px 0; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
      Need inspiration for your next prompt?
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #94A3B8; line-height: 1.6;">
      Whether you&rsquo;re crafting production prompts for Cursor, Windsurf, Claude Code, or autonomous agent loops &mdash; Bedrock gives you structured blueprints that reduce LLM hallucinations by up to 80%.
    </p>

    <!-- Top Blueprints -->
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
      <tr>
        <td style="padding: 14px; background-color: #121620; border: 1px solid #1E2330; border-radius: 8px; margin-bottom: 10px;">
          <div style="font-size: 14px; font-weight: 700; color: #2C9A8B; margin-bottom: 4px;">
            &bull; Full-Stack Architecture Prompt
          </div>
          <div style="font-size: 13px; color: #94A3B8;">
            Generates strict schema definitions, migration protocols, and zero-leak auth invariants.
          </div>
        </td>
      </tr>
      <tr><td style="height: 10px;"></td></tr>
      <tr>
        <td style="padding: 14px; background-color: #121620; border: 1px solid #1E2330; border-radius: 8px;">
          <div style="font-size: 14px; font-weight: 700; color: #2C9A8B; margin-bottom: 4px;">
            &bull; Multi-Model Benchmarking in Tester
          </div>
          <div style="font-size: 13px; color: #94A3B8;">
            Execute your synthesized prompt against Groq, Gemini, and GPT-OSS side-by-side to verify speed and output quality.
          </div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td align="center">
          <a href="https://bedrockxai.com/wizard" class="btn" style="display: inline-block; background-color: #2C9A8B; color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
            Launch Studio &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 11px; color: #64748B; text-align: center;">
      Don&rsquo;t want to receive activity tips? <a href="https://bedrockxai.com/settings" style="color: #64748B; text-decoration: underline;">Update notification preferences in Settings</a>.
    </p>
  `;

  return { subject, html: baseEmailWrapper(content, previewText) };
}

/**
 * 4. Major Product Update & Feature Announcement Email
 */
export function renderAnnouncementEmail(params: {
  title: string;
  badge?: string;
  highlights: string[];
  ctaUrl?: string;
  ctaText?: string;
}): { subject: string; html: string } {
  const subject = `Update: ${params.title} on Bedrock 🚀`;
  const previewText = `Explore what&rsquo;s new in Bedrock: ${params.highlights[0] || params.title}`;

  const bulletsHtml = params.highlights
    .map(h => `<li style="margin-bottom: 8px; font-size: 14px; color: #CBD5E1; line-height: 1.5;">${h}</li>`)
    .join('');

  const content = `
    <div style="margin-bottom: 12px;">
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #2C9A8B; background: rgba(44, 154, 139, 0.15); padding: 4px 10px; border-radius: 12px; font-weight: 700;">
        ${params.badge || 'New Release'}
      </span>
    </div>
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
      ${params.title}
    </h1>

    <div style="background-color: #121620; border: 1px solid #1E2330; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #FFFFFF; font-weight: 600;">
        Highlights in this release:
      </h3>
      <ul style="margin: 0; padding-left: 20px;">
        ${bulletsHtml}
      </ul>
    </div>

    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td align="center">
          <a href="${params.ctaUrl || 'https://bedrockxai.com'}" class="btn" style="display: inline-block; background-color: #2C9A8B; color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
            ${params.ctaText || 'Try It Now on Bedrock &rarr;'}
          </a>
        </td>
      </tr>
    </table>
  `;

  return { subject, html: baseEmailWrapper(content, previewText) };
}

