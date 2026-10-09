export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error';
  version?: string;
  percent?: number;
  error?: string;
  releaseNotes?: string;
  currentVersion?: string;
}

type UpdateListener = (status: UpdateStatus) => void;
const listeners = new Set<UpdateListener>();
let currentStatus: UpdateStatus = { status: 'idle' };

export function subscribeToUpdates(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(status: UpdateStatus) {
  currentStatus = status;
  listeners.forEach((fn) => fn(status));
}

export function sanitizeUpdaterError(error?: string): string | undefined {
  if (!error) return undefined;
  if (error.includes('404') || error.includes('latest.yml')) {
    return 'No published releases found on GitHub (Bedrockxai/Bedrock). You are currently running the latest local build.';
  }
  if (error.includes('ERR_INTERNET_DISCONNECTED') || error.includes('ENOTFOUND')) {
    return 'Network disconnected. Please check your internet connection.';
  }
  if (error.includes('HttpError:')) {
    return 'Unable to fetch release details from GitHub. Please try again later.';
  }
  return error.split('\n')[0];
}

// Hook into Electron autoUpdater IPC if available
if (typeof window !== 'undefined' && (window as any).electronUpdater?.onStatusChange) {
  (window as any).electronUpdater.onStatusChange((data: any) => {
    if (data?.status === 'error' && data.error) {
      notifyListeners({ ...data, error: sanitizeUpdaterError(data.error) });
    } else {
      notifyListeners(data);
    }
  });
}

/**
 * Checks for updates using Electron's native GitHub release updater,
 * with fallback for Tauri runtime if present.
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  // 1. Electron auto-updater
  if (typeof window !== 'undefined' && (window as any).electronUpdater) {
    try {
      notifyListeners({ status: 'checking' });
      const res = await (window as any).electronUpdater.checkForUpdates();
      if (res?.error) {
        const cleanErr = sanitizeUpdaterError(res.error);
        notifyListeners({ status: 'error', error: cleanErr });
        return { status: 'error', error: cleanErr };
      }
      return currentStatus;
    } catch (err: any) {
      const cleanErr = sanitizeUpdaterError(err?.message || 'Check failed');
      notifyListeners({ status: 'error', error: cleanErr });
      return { status: 'error', error: cleanErr };
    }
  }

  // 2. Tauri updater fallback
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();
      if (update) {
        notifyListeners({ status: 'available', version: update.version });
        await update.downloadAndInstall((event) => {
          if (event.event === 'Finished') {
            notifyListeners({ status: 'downloaded', version: update.version });
          }
        });
        await relaunch();
      } else {
        notifyListeners({ status: 'up-to-date' });
      }
    } catch (err: any) {
      notifyListeners({ status: 'error', error: err?.message });
    }
  }

  return currentStatus;
}

/**
 * Quits the application and runs the downloaded NSIS installer to apply the update.
 */
export async function applyUpdate(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).electronUpdater) {
    await (window as any).electronUpdater.installUpdate();
  }
}
