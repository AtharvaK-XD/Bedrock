export interface AuthNotificationPayload {
  email: string;
  name?: string;
  type: 'signup' | 'signin';
}

/**
 * The email endpoint only serves signed-in users: send the Clerk session token
 * (web) or the token handed over by the desktop sign-in flow.
 */
async function getNotificationHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let token: string | null = null;
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) token = await clerk.session.getToken();
  } catch {
    // ignore
  }
  if (!token) {
    try {
      token = localStorage.getItem('bedrock_token');
    } catch {
      // ignore storage access errors
    }
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
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

  const headers = await getNotificationHeaders();
  if (!headers['Authorization']) return; // not signed in: the server would refuse anyway

  try {
    const res = await fetch(`${origin}/api/auth/send-email`, {
      method: 'POST',
      headers,
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
        headers,
        body: JSON.stringify({ email: cleanEmail, name: name?.trim(), type }),
      }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking: Try fallback to Vercel production endpoint
    try {
      await fetch('https://bedrock-steel.vercel.app/api/auth/send-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: cleanEmail, name: name?.trim(), type }),
      });
    } catch {
      console.warn('[notifyAuthSuccess] Email dispatch failed silently:', err);
    }
  }
}
