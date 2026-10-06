export interface AuthNotificationPayload {
  email: string;
  name?: string;
  type: 'signup' | 'signin';
}

/**
 * Dispatches an asynchronous email notification via Bedrock's Resend service
 * Ensures login alerts are only sent once per browser session to prevent duplicate emails on refresh.
 */
export async function notifyAuthSuccess(payload: AuthNotificationPayload): Promise<void> {
  const { email, name, type } = payload;
  if (!email || !email.includes('@') || email.endsWith('@clerk.user')) {
    return;
  }

  const cleanEmail = email.toLowerCase().trim();

  // Deduplication check for sign-in alerts within the current session
  if (type === 'signin' && typeof window !== 'undefined') {
    try {
      const today = new Date().toISOString().split('T')[0];
      const sessionKey = `bedrock_email_sent_${cleanEmail}_${today}`;
      if (sessionStorage.getItem(sessionKey)) {
        return; // Already notified in this browser/app session
      }
      sessionStorage.setItem(sessionKey, 'true');
    } catch {
      // ignore storage access errors
    }
  }

  // Determine API base
  const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
    ? window.location.origin
    : 'https://bedrock-steel.vercel.app';

  try {
    const res = await fetch(`${origin}/api/auth/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        name: name?.trim(),
        type,
      }),
    });

    if (!res.ok && origin !== 'https://bedrock-steel.vercel.app') {
      // Fallback to production cloud endpoint for desktop or offline loopback
      await fetch('https://bedrock-steel.vercel.app/api/auth/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: name?.trim(), type }),
      }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking: Try fallback to Vercel production endpoint
    try {
      await fetch('https://bedrock-steel.vercel.app/api/auth/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, name: name?.trim(), type }),
      });
    } catch {
      console.warn('[notifyAuthSuccess] Email dispatch failed silently:', err);
    }
  }
}
