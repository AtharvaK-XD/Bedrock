/**
 * Desktop only: keeps the user's API keys in OS-encrypted storage (Electron safeStorage)
 * instead of plain text in localStorage. Existing code keeps calling
 * localStorage.getItem/setItem/removeItem('bedrock_api_keys'); those calls are served from an
 * in-memory copy that is saved encrypted through window.electronSecrets.
 *
 * On the website (or if the OS cannot encrypt) nothing changes.
 */

const SECURE_KEYS = new Set(['bedrock_api_keys']);

interface ElectronSecretsBridge {
  isAvailable?: boolean;
  load: () => Promise<{ available: boolean; values?: Record<string, string> }>;
  save: (key: string, value: string | null) => Promise<{ success: boolean; error?: string }>;
}

let installed = false;

export async function initSecureKeyStore(): Promise<void> {
  if (installed || typeof window === 'undefined') return;
  const bridge = (window as any).electronSecrets as ElectronSecretsBridge | undefined;
  if (!bridge?.isAvailable) return;

  let loaded: Awaited<ReturnType<ElectronSecretsBridge['load']>>;
  try {
    loaded = await bridge.load();
  } catch (err) {
    console.warn('[SecureKeyStore] Encrypted storage unavailable, keeping browser storage:', err);
    return;
  }
  if (!loaded?.available) return;

  const storage = window.localStorage;
  const proto = Storage.prototype;
  const originalGet = proto.getItem;
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  const cache = new Map<string, string>();

  for (const key of SECURE_KEYS) {
    const stored = loaded.values?.[key];
    if (typeof stored === 'string') cache.set(key, stored);
  }

  // Saves are queued so an older write can never land after a newer one
  let queue: Promise<unknown> = Promise.resolve();
  const persist = (key: string, value: string | null) => {
    queue = queue
      .then(() => bridge.save(key, value))
      .then((result) => {
        if (!result?.success) throw new Error(result?.error || 'save failed');
      })
      .catch((err) => {
        // Never lose the user's keys: fall back to browser storage until the next start retries
        console.warn('[SecureKeyStore] Encrypted save failed, keeping a browser copy:', err);
        if (value === null) originalRemove.call(storage, key);
        else originalSet.call(storage, key, value);
      });
    return queue;
  };

  // One-time move of existing plain-text keys into encrypted storage
  for (const key of SECURE_KEYS) {
    const plain = originalGet.call(storage, key);
    if (plain === null) continue;
    cache.set(key, plain);
    try {
      const result = await bridge.save(key, plain);
      if (result?.success) originalRemove.call(storage, key);
    } catch {
      // keep the plain copy; retried on next start
    }
  }

  proto.getItem = function (this: Storage, key: string) {
    if (this === storage && SECURE_KEYS.has(String(key))) return cache.get(String(key)) ?? null;
    return originalGet.call(this, key);
  };
  proto.setItem = function (this: Storage, key: string, value: string) {
    if (this === storage && SECURE_KEYS.has(String(key))) {
      cache.set(String(key), String(value));
      void persist(String(key), String(value));
      return;
    }
    return originalSet.call(this, key, value);
  };
  proto.removeItem = function (this: Storage, key: string) {
    if (this === storage && SECURE_KEYS.has(String(key))) {
      cache.delete(String(key));
      void persist(String(key), null);
      return;
    }
    return originalRemove.call(this, key);
  };

  installed = true;
}
