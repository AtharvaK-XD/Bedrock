export interface AuthNotificationPayload {
  email: string;
  name?: string;
  type: 'signup' | 'signin';
}

/**
 * The email endpoint only serves signed-in users: send the Clerk session token
 * (web) or the token handed over by the desktop sign-in flow.
 * Retries briefly if Clerk is still resolving the session token after redirect.
 */
async function getNotificationHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let token: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const clerk = (window as any).Clerk;
      if (clerk?.session) {
        token = await clerk.session.getToken();
        if (token) break;
      }
    } catch {
      // ignore
    }
    if (!token) {
      try {
        token = localStorage.getItem('bedrock_token');
        if (token) break;
      } catch {
        // ignore storage access errors
      }
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Dispatches an asynchronous email notification via Bedrock's Resend service
 * Ensures login alerts are only marked sent after a verified HTTP 200 response.
 */
export async function notifyAuthSuccess(payload: AuthNotificationPayload): Promise<boolean> {
  const { email, name, type } = payload;
  if (!email || !email.includes('@') || email.endsWith('@clerk.user')) {
    return false;
  }

  const cleanEmail = email.toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];
  const sessionKey = `bedrock_email_sent_${cleanEmail}_${today}`;

  // Deduplication check: only skip if already successfully notified in this session
  if (type === 'signin' && typeof window !== 'undefined') {
    try {
      if (sessionStorage.getItem(sessionKey) === 'true') {
        return true; // Already successfully notified today
      }
    } catch {
      // ignore storage access errors
    }
  }

  // Determine API base
  const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
    ? window.location.origin
    : 'https://bedrockxai.com';

  const headers = await getNotificationHeaders();
  if (!headers['Authorization']) {
    console.warn('[notifyAuthSuccess] No active auth token available yet to dispatch email');
    return false;
  }

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

    if (res.ok) {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(sessionKey, 'true');
        } catch {}
      }
      return true;
    }

    const errData = await res.json().catch(() => ({}));
    console.warn(`[notifyAuthSuccess] Email dispatch returned ${res.status}:`, errData);

    if (origin !== 'https://bedrockxai.com') {
      // Fallback to production cloud endpoint for desktop or offline loopback
      const fallbackRes = await fetch('https://bedrockxai.com/api/auth/send-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: cleanEmail, name: name?.trim(), type }),
      }).catch(() => null);

      if (fallbackRes?.ok) {
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(sessionKey, 'true');
          } catch {}
        }
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('[notifyAuthSuccess] Email dispatch network error:', err);
    return false;
  }
}
