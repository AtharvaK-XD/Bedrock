import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';

let gmailTransporter: Transporter | null = null;
let resendInstance: Resend | null = null;

function getGmailTransporter(): Transporter | null {
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const user = process.env.GMAIL_USER || 'bedrockofficialpage@gmail.com';

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

function getResend(): Resend | null {
  if (resendInstance) return resendInstance;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendInstance = new Resend(apiKey);
  return resendInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS support for desktop app & web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, type } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const to = email.toLowerCase().trim();
  const displayName = (name && typeof name === 'string' && name.trim()) || to.split('@')[0];
  const gmail = getGmailTransporter();
  const gmailUser = process.env.GMAIL_USER || 'bedrockofficialpage@gmail.com';

  const isSignup = type === 'signup';
  const subject = isSignup
    ? 'Welcome to Bedrock — Architect Superior Prompts ⚡'
    : 'Security Notification: Successful Sign-In to Bedrock';

  let html = '';
  if (isSignup) {
    html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #050505; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #0c0c0c; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);">
            <div style="background: linear-gradient(180deg, #181512 0%, #0c0c0c 100%); padding: 36px 32px 20px 32px; border-bottom: 1px solid rgba(200, 168, 107, 0.15);">
              <div style="display: inline-block; padding: 4px 10px; background-color: rgba(200, 168, 107, 0.1); border: 1px solid rgba(200, 168, 107, 0.25); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #c8a86b; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">
                PROMPT ENGINEERING STUDIO
              </div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                Welcome to Bedrock, ${displayName}
              </h1>
            </div>
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
              <div style="margin: 32px 0 24px 0;">
                <a href="https://bedrock-steel.vercel.app/app" style="display: inline-block; background-color: #c8a86b; color: #050505; font-size: 14px; font-weight: 600; text-decoration: none; padding: 13px 28px; border-radius: 8px;">
                  Launch Bedrock Studio →
                </a>
              </div>
              <p style="font-size: 13px; color: #71717a; margin-bottom: 0;">
                Account Identifier: <span style="font-family: monospace; color: #a1a1aa;">${to}</span>
              </p>
            </div>
            <div style="padding: 20px 32px; background-color: #070707; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #52525b;">
              Bedrock Architecture Inc. — Sent officially from ${gmailUser}
            </div>
          </div>
        </body>
      </html>
    `;
  } else {
    const loginTimestamp = new Date().toUTCString();
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background-color: #050505; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #0c0c0c; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);">
            <div style="padding: 28px 32px 18px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; padding: 4px 10px; background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #a1a1aa; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 14px;">
                SECURITY AUDIT LOG
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.01em;">
                Successful Sign-In Detected
              </h1>
            </div>
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
                ${ip ? `<div><span style="color: #71717a;">IP Origin:</span> <span style="color: #c8a86b; font-family: monospace;">${ip}</span></div>` : ''}
              </div>
              <p style="font-size: 13px; color: #71717a; margin-bottom: 0;">
                If this was you, no action is required. If you did not authorize this session, please review your credentials or reset your account password.
              </p>
            </div>
            <div style="padding: 18px 32px; background-color: #070707; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #52525b;">
              Bedrock Architecture Security • Automated notification from ${gmailUser}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // 1. Primary: Official Gmail SMTP
  if (gmail) {
    try {
      const info = await gmail.sendMail({
        from: `Bedrock <${gmailUser}>`,
        to,
        subject,
        html,
      });
      return res.status(200).json({ success: true, messageId: info.messageId, provider: 'gmail' });
    } catch (err: any) {
      console.error('[Vercel send-email] Gmail dispatch error:', err);
    }
  }

  // 2. Secondary: Resend fallback
  const resend = getResend();
  if (resend) {
    const from = process.env.RESEND_FROM_EMAIL || 'Bedrock <onboarding@resend.dev>';
    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });
      if (error) {
        return res.status(200).json({ success: false, error: error.message, provider: 'resend' });
      }
      return res.status(200).json({ success: true, messageId: data?.id, provider: 'resend' });
    } catch (err: any) {
      return res.status(200).json({ success: false, error: err.message, provider: 'resend' });
    }
  }

  return res.status(500).json({ error: 'No email provider credentials configured' });
}
