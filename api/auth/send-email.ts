import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, isAllowedAppOrigin } from '../_lib/auth.js';
import { logSecurityEvent } from '../_lib/db.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { fetchClerkIdentity, sessionSubject } from '../_lib/clerkUser.js';
import {
  sendBedrockEmail,
  renderWelcomeEmail,
  DEFAULT_FROM_TEAM,
  DEFAULT_FROM_SECURITY,
  DEFAULT_REPLY_TO,
} from '../_lib/email.js';

const EMAIL_RE = /^[^\s@<>"'`,;:\\]+@[^\s@<>"'`,;:\\]+\.[^\s@<>"'`,;:\\]+$/;

/** Escapes untrusted text before it is placed into the email HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS only for Bedrock's own web origins and the desktop app (never a wildcard)
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const originAllowed = !origin || isAllowedAppOrigin(origin, req.headers.host);
  res.setHeader('Vary', 'Origin');
  if (origin && originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(originAllowed ? 204 : 403).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!originAllowed) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // Throttle per sender IP before doing any work
  const clientIp = getClientIp(req);
  if (!(await enforceRateLimit(req, res, 'email', `ip:${clientIp}`))) return;

  // Only a signed-in Bedrock user can trigger their own sign-in / welcome email
  const caller = await authenticateRequest(req);
  if (!caller || caller.isGuest) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  const { email, type } = req.body || {};

  if (type !== 'signup' && type !== 'signin') {
    return res.status(400).json({ error: 'type must be "signup" or "signin"' });
  }

  // The recipient and the name in the email come from Clerk (the verified account), never from the
  // request: a signed-in user could otherwise pick any address and any wording under Bedrock's name.
  const clerkUserId = sessionSubject(req);
  if (!clerkUserId) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  const identity = await fetchClerkIdentity(clerkUserId);
  if (!identity.ok) {
    if ('reason' in identity && identity.reason === 'no_verified_email') {
      return res.status(403).json({ error: 'Your account has no verified email address', code: 'EMAIL_NOT_VERIFIED' });
    }
    // Not configured or Clerk unreachable: send nothing (fail closed)
    return res.status(503).json({ error: 'Email notifications are not available right now', code: 'EMAIL_IDENTITY_UNAVAILABLE' });
  }
  const to = identity.identity.email;
  if (to.length > 254 || !EMAIL_RE.test(to)) {
    return res.status(403).json({ error: 'Your account has no usable email address', code: 'EMAIL_NOT_VERIFIED' });
  }

  // A request that names a different address is refused and logged (a sign of misuse)
  if (typeof email === 'string' && email.trim() && email.toLowerCase().trim() !== to) {
    await logSecurityEvent({
      userId: caller.id,
      eventType: 'EMAIL_RECIPIENT_MISMATCH',
      severity: 'WARN',
      ipAddress: clientIp,
      endpoint: 'auth/send-email',
      message: 'Authenticated caller attempted to send an auth email to a different address',
    });
    return res.status(403).json({ error: 'Notifications can only be sent to your own email address' });
  }

  // Throttle per recipient so the endpoint cannot be used to spam an inbox
  if (!(await enforceRateLimit(req, res, 'emailRecipient', `rcpt:${to}`))) return;

  // The name is Clerk's; it is still escaped before it is placed into the HTML template
  const rawName = identity.identity.name || to.split('@')[0];
  const displayName = escapeHtml(rawName);
  const safeTo = escapeHtml(to);
  const isSignup = type === 'signup';
  let subject = '';
  let html = '';

  if (isSignup) {
    const welcome = renderWelcomeEmail({ name: displayName, email: to });
    subject = welcome.subject;
    html = welcome.html;
  } else {
    subject = 'Security Notification: Successful Sign-In to Bedrock';
    const loginTimestamp = new Date().toUTCString();
    const ip = escapeHtml(clientIp);
    html = `
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
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #111318; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 16px; overflow: hidden; box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);">
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #c8a86b 0%, #dfc38a 50%, #9c7b41 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 26px 32px 18px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align: middle;">
                          <img src="https://bedrockxai.com/logo-tight.png" width="30" height="30" alt="Bedrock" style="display: block; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);" />
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
          <tr>
            <td style="height: 1px; background-color: rgba(255, 255, 255, 0.06); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
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
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #171a22; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px; color: #6b7280; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em; width: 32%;">
                    Account
                  </td>
                  <td style="padding: 14px 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 13px; color: #f3f4f6; font-weight: 500;">
                    <a href="#" style="color: #f3f4f6 !important; text-decoration: none !important; cursor: default;">${safeTo}</a>
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
                      ${ip || 'Verified Connection'}
                    </span>
                  </td>
                </tr>
              </table>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="https://bedrockxai.com/app" style="display: block; width: 100%; box-sizing: border-box; text-align: center; background: linear-gradient(180deg, #dfc38a 0%, #c8a86b 100%); color: #090a0d; font-weight: 600; font-size: 14px; padding: 13px 20px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 14px rgba(200, 168, 107, 0.25); letter-spacing: 0.01em;">
                      Launch Bedrock Workstation &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(239, 68, 68, 0.04); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 10px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 12.5px; line-height: 1.5; color: #9ca3af;">
                    <strong style="color: #fca5a5;">Didn't recognize this sign-in?</strong> If this wasn't you, someone may have unauthorized access. <a href="https://bedrockxai.com/app/settings" style="color: #dfc38a; text-decoration: underline;">Change your password</a> immediately.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 22px 32px 28px 32px; background-color: #0d0e13; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Bedrock Prompt Engineering Workstation &bull; Automated Security Protocol
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #4b5563;">
                Official domain: <a href="https://bedrockxai.com" style="color: #9ca3af; text-decoration: underline;">bedrockxai.com</a>
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
  }

  const result = await sendBedrockEmail({
    to,
    subject,
    html,
    from: isSignup ? DEFAULT_FROM_TEAM : DEFAULT_FROM_SECURITY,
    replyTo: DEFAULT_REPLY_TO,
  });

  if (result.success) {
    return res.status(200).json({ success: true, messageId: result.messageId, provider: result.provider });
  }

  return res.status(500).json({ error: result.error || 'Failed to send email notification' });
}
