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
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Bedrock</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #050505; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #0c0c0c; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(180deg, #181512 0%, #0c0c0c 100%); padding: 36px 32px 20px 32px; border-bottom: 1px solid rgba(200, 168, 107, 0.15);">
            <div style="display: inline-block; padding: 4px 10px; background-color: rgba(200, 168, 107, 0.1); border: 1px solid rgba(200, 168, 107, 0.25); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #c8a86b; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">
              PROMPT ENGINEERING STUDIO
            </div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
              Welcome to Bedrock, ${displayName}
            </h1>
          </div>

          <!-- Body Content -->
          <div style="padding: 32px; font-size: 15px; line-height: 1.65; color: #a1a1aa;">
            <p style="margin-top: 0; color: #d4d4d8;">
              Your account has been successfully initialized. You now have full access to Bedrock's next-generation workspace for synthesis, iterative prompt refinement, and multi-model agent execution.
            </p>

            <div style="margin: 28px 0; padding: 20px; background-color: #121214; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px;">
              <div style="font-size: 13px; font-weight: 600; color: #c8a86b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">
                ⚡ Core Capabilities Unlocked:
              </div>
              <ul style="margin: 0; padding-left: 20px; color: #a1a1aa; font-size: 14px;">
                <li style="margin-bottom: 6px;"><strong style="color: #ffffff;">Intelligent Synthesis:</strong> Multi-turn guided wizard for precision prompts.</li>
                <li style="margin-bottom: 6px;"><strong style="color: #ffffff;">Split-Pane Refinement:</strong> Instant markdown updates alongside conversational steering.</li>
                <li style="margin-bottom: 6px;"><strong style="color: #ffffff;">Universal Provider Bridge:</strong> Zero-latency proxy across frontier AI models.</li>
              </ul>
            </div>

            <div style="margin: 32px 0 24px 0; text-align: left;">
              <a href="https://bedrock-steel.vercel.app/app" style="display: inline-block; background-color: #c8a86b; color: #050505; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(200, 168, 107, 0.3);">
                Launch Bedrock Studio →
              </a>
            </div>

            <p style="font-size: 13px; color: #71717a; margin-bottom: 0;">
              Account Identifier: <span style="font-family: monospace; color: #a1a1aa;">${to}</span>
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 32px; background-color: #070707; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #52525b; line-height: 1.5;">
            Bedrock Architecture Inc. — Sent officially from bedrockofficialpage@gmail.com
          </div>
        </div>
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
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bedrock Sign-in Notification</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #050505; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #0c0c0c; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);">
          
          <!-- Header Banner -->
          <div style="padding: 28px 32px 18px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="display: inline-block; padding: 4px 10px; background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #a1a1aa; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px;">
              SECURITY AUDIT LOG
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.01em;">
              Successful Sign-In Detected
            </h1>
          </div>

          <!-- Body Content -->
          <div style="padding: 28px 32px; font-size: 14.5px; line-height: 1.6; color: #a1a1aa;">
            <p style="margin-top: 0; color: #d4d4d8;">
              Hello <strong>${displayName}</strong>, we noticed a successful authentication to your Bedrock session.
            </p>

            <div style="margin: 22px 0; padding: 18px; background-color: #121214; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; font-size: 13.5px;">
              <div style="margin-bottom: 8px;">
                <span style="color: #71717a;">Account:</span> <span style="color: #ffffff; font-family: monospace;">${to}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <span style="color: #71717a;">Timestamp:</span> <span style="color: #ffffff;">${loginTimestamp}</span>
              </div>
              ${ipAddress ? `<div><span style="color: #71717a;">IP Origin:</span> <span style="color: #c8a86b; font-family: monospace;">${ipAddress}</span></div>` : ''}
            </div>

            <p style="font-size: 13px; color: #71717a; margin-bottom: 0;">
              If this was you, no action is required. If you did not authorize this session, please review your credentials or reset your account password.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 18px 32px; background-color: #070707; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #52525b;">
            Bedrock Architecture Security • Automated notification from bedrockofficialpage@gmail.com
          </div>
        </div>
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
