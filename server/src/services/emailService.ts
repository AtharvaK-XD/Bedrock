import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { config } from '../config.js';

let gmailTransporter: Transporter | null = null;
let resendClient: Resend | null = null;

function getGmailTransporter(): Transporter | null {
  const pass = (config.email.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const user = config.email.gmailUser || process.env.GMAIL_USER || 'bedrockofficialpage@gmail.com';

  if (!pass) return null;

  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }
  return gmailTransporter;
}

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = config.email.resendApiKey || process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendClient = new Resend(apiKey);
  return resendClient;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: 'gmail' | 'resend';
  isSandboxLimited?: boolean;
}

/**
 * Universal dispatcher: Sends through official Gmail SMTP (bedrockofficialpage@gmail.com) if App Password is set,
 * or falls back to Resend if Gmail App Password is not yet provided.
 */
async function dispatchEmail(options: {
  to: string;
  subject: string;
  html: string;
  displayName: string;
  type: 'signup' | 'signin';
}): Promise<EmailSendResult> {
  const { to, subject, html, displayName, type } = options;
  const gmail = getGmailTransporter();
  const gmailUser = config.email.gmailUser || process.env.GMAIL_USER || 'bedrockofficialpage@gmail.com';

  // 1. Primary Priority: Official Gmail SMTP
  if (gmail) {
    try {
      const info = await gmail.sendMail({
        from: `Bedrock <${gmailUser}>`,
        to,
        subject,
        html,
      });
      return { success: true, messageId: info.messageId, provider: 'gmail' };
    } catch (err: any) {
      console.error('[EmailService] Gmail SMTP dispatch failed:', err);
    }
  }

  // 2. Secondary Fallback: Resend
  const resend = getResendClient();
  if (resend) {
    const from = config.email.fromEmail || process.env.RESEND_FROM_EMAIL || 'Bedrock <onboarding@resend.dev>';
    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });

      if (error) {
        return handleResendError(error, to, type, displayName);
      }
      return { success: true, messageId: data?.id, provider: 'resend' };
    } catch (err: any) {
      return handleResendError(err, to, type, displayName);
    }
  }

  console.warn('[EmailService] Neither GMAIL_APP_PASSWORD nor RESEND_API_KEY configured.');
  return { success: false, error: 'Email service credentials not configured' };
}

/**
 * Sends a luxury dark-copper themed Welcome email for newly registered accounts
 */
export async function sendWelcomeEmail(to: string, name?: string): Promise<EmailSendResult> {
  const displayName = (name && name.trim()) || to.split('@')[0];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Bedrock</title>
  <style>
    body { margin: 0; padding: 0; background-color: #08090c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #08090c; color: #ededed;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #08090c; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #111318; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);">
          
          <!-- Top Accent Glow Line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #c8a86b 0%, #dfc38a 50%, #9c7b41 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header with Logo and Badge -->
          <tr>
            <td style="padding: 26px 32px 18px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          <img src="https://bedrock-steel.vercel.app/logo-tight.png" width="30" height="30" alt="Bedrock" style="display: block; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);" />
                        </td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1.1;">BEDROCK</div>
                          <div style="font-size: 10px; font-family: monospace; color: #6b7280; letter-spacing: 0.05em; text-transform: uppercase;">WORKSTATION</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 5px 12px; background-color: rgba(200, 168, 107, 0.1); border: 1px solid rgba(200, 168, 107, 0.28); border-radius: 20px; font-family: -apple-system, monospace; font-size: 11px; font-weight: 600; color: #dfc38a; letter-spacing: 0.04em;">
                      ● NEW ARCHITECT
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Separator Line -->
          <tr>
            <td style="height: 1px; background-color: rgba(255, 255, 255, 0.06); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              
              <!-- Sparkles Icon Badge -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="width: 44px; height: 44px; background: rgba(200, 168, 107, 0.12); border: 1px solid rgba(200, 168, 107, 0.28); border-radius: 12px; text-align: center; vertical-align: middle; font-size: 20px;">
                    ✨
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 10px 0; font-size: 23px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; line-height: 1.3;">
                Welcome to Bedrock, ${displayName}
              </h1>
              
              <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #9ca3af;">
                Your account is ready. You now have complete access to autonomous prompt synthesis, interactive split-pane refinement, and multi-model agent routing.
              </p>

              <!-- Features Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #171a22; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">⚡ Intelligent Synthesis</div>
                    <div style="font-size: 12.5px; color: #9ca3af; line-height: 1.5;">Guided multi-turn wizard to construct bulletproof prompt architectures.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">🔄 Split-Pane Refinement</div>
                    <div style="font-size: 12.5px; color: #9ca3af; line-height: 1.5;">Live markdown synchronization paired with conversational steering.</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">🌐 Universal Provider Bridge</div>
                    <div style="font-size: 12.5px; color: #9ca3af; line-height: 1.5;">Zero-latency routing across Gemini, Groq, Claude, and OpenAI models.</div>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="https://bedrock-steel.vercel.app/app" style="display: block; width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(180deg, #dfc38a 0%, #c8a86b 100%); color: #090a0d; font-weight: 600; font-size: 14px; padding: 13px 20px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px rgba(200, 168, 107, 0.25); letter-spacing: 0.01em;">
                      Launch Bedrock Workstation &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; color: #6b7280; font-family: monospace;">
                Account: <span style="color: #9ca3af;">${to}</span>
              </p>

            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="padding: 22px 32px 28px 32px; background-color: #0d0e13; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Bedrock Prompt Engineering Workstation &bull; Welcome Protocol
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #4b5563;">
                Dispatched by <span style="color: #6b7280;">bedrockofficialpage@gmail.com</span> &bull; <a href="https://bedrock-steel.vercel.app" style="color: #9ca3af; text-decoration: underline;">bedrock.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return dispatchEmail({
    to,
    subject: 'Welcome to Bedrock — Architect Superior Prompts ⚡',
    html,
    displayName,
    type: 'signup',
  });
}

/**
 * Sends a security sign-in notification email upon successful authentication
 */
export async function sendSignInAlertEmail(
  to: string,
  name?: string,
  ipAddress?: string
): Promise<EmailSendResult> {
  const displayName = (name && name.trim()) || to.split('@')[0];
  const loginTimestamp = new Date().toUTCString();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Alert: Successful Sign-In to Bedrock</title>
  <style>
    body { margin: 0; padding: 0; background-color: #08090c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #08090c; color: #ededed;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #08090c; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #111318; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);">
          
          <!-- Top Accent Glow Line -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #c8a86b 0%, #dfc38a 50%, #9c7b41 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header with Logo and Status Pill -->
          <tr>
            <td style="padding: 26px 32px 18px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          <img src="https://bedrock-steel.vercel.app/logo-tight.png" width="30" height="30" alt="Bedrock" style="display: block; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);" />
                        </td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 700; color: #ffffff; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1.1;">BEDROCK</div>
                          <div style="font-size: 10px; font-family: monospace; color: #6b7280; letter-spacing: 0.05em; text-transform: uppercase;">WORKSTATION</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 5px 12px; background-color: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 20px; font-family: -apple-system, monospace; font-size: 11px; font-weight: 600; color: #4ade80; letter-spacing: 0.04em;">
                      ● AUTHORIZED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Separator Line -->
          <tr>
            <td style="height: 1px; background-color: rgba(255, 255, 255, 0.06); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              
              <!-- Shield Icon Badge -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="width: 44px; height: 44px; background: rgba(200, 168, 107, 0.12); border: 1px solid rgba(200, 168, 107, 0.28); border-radius: 12px; text-align: center; vertical-align: middle; font-size: 20px;">
                    🛡️
                  </td>
                </tr>
              </table>

              <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; line-height: 1.3;">
                Successful Sign-In Detected
              </h1>
              
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                Hello <strong style="color: #f3f4f6;">${displayName}</strong>, we noticed a successful authentication to your Bedrock session.
              </p>

              <!-- Audit Details Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #171a22; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #6b7280; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em; width: 32%;">
                    Account
                  </td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 13px; color: #f3f4f6; font-weight: 500;">
                    <a href="#" style="color: #f3f4f6 !important; text-decoration: none !important; cursor: default;">${to}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #6b7280; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em;">
                    Timestamp
                  </td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 13px; color: #d1d5db;">
                    ${loginTimestamp}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; font-size: 12px; color: #6b7280; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em;">
                    IP Origin
                  </td>
                  <td style="padding: 14px 18px; font-size: 13px;">
                    <span style="display: inline-block; padding: 2px 8px; background-color: rgba(200, 168, 107, 0.12); border: 1px solid rgba(200, 168, 107, 0.25); border-radius: 5px; font-family: monospace; font-size: 12px; color: #dfc38a;">
                      ${ipAddress || 'Verified Connection'}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="https://bedrock-steel.vercel.app/app" style="display: block; width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(180deg, #dfc38a 0%, #c8a86b 100%); color: #090a0d; font-weight: 600; font-size: 14px; padding: 13px 20px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px rgba(200, 168, 107, 0.25); letter-spacing: 0.01em;">
                      Launch Bedrock Workstation &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice Callout -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 10px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 12.5px; line-height: 1.5; color: #9ca3af;">
                    <strong style="color: #fca5a5;">Didn't recognize this sign-in?</strong> If this wasn't you, someone may have unauthorized access. <a href="https://bedrock-steel.vercel.app/app/settings" style="color: #dfc38a; text-decoration: underline;">Change your password</a> immediately.
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Area -->
          <tr>
            <td style="padding: 22px 32px 28px 32px; background-color: #0d0e13; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Bedrock Prompt Engineering Workstation &bull; Automated Security Protocol
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #4b5563;">
                Dispatched by <span style="color: #6b7280;">bedrockofficialpage@gmail.com</span> &bull; <a href="https://bedrock-steel.vercel.app" style="color: #9ca3af; text-decoration: underline;">bedrock.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return dispatchEmail({
    to,
    subject: 'Security Notification: Successful Sign-In to Bedrock',
    html,
    displayName,
    type: 'signin',
  });
}

/**
 * Gracefully handles Resend free-tier sandbox restrictions
 */
async function handleResendError(
  error: any,
  intendedRecipient: string,
  type: 'signup' | 'signin',
  displayName: string
): Promise<EmailSendResult> {
  const errMsg = error?.message || String(error);
  const isSandboxRestriction = errMsg.includes('testing emails to your own email address') || errMsg.includes('verify a domain');

  if (isSandboxRestriction) {
    console.warn(
      `[EmailService] Resend Sandbox Limitation: Cannot send to external recipient "${intendedRecipient}". ` +
      `Configure GMAIL_APP_PASSWORD in .env to send directly from bedrockofficialpage@gmail.com.`
    );

    return {
      success: false,
      error: errMsg,
      isSandboxLimited: true,
      provider: 'resend',
    };
  }

  console.error('[EmailService] Resend dispatch failed:', errMsg);
  return { success: false, error: errMsg, provider: 'resend' };
}
