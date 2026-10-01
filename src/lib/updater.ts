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

// Hook into Electron autoUpdater IPC if available
if (typeof window !== 'undefined' && (window as any).electronUpdater?.onStatusChange) {
  (window as any).electronUpdater.onStatusChange((data: any) => {
    notifyListeners(data);
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
        notifyListeners({ status: 'error', error: res.error });
        return { status: 'error', error: res.error };
      }
      return currentStatus;
    } catch (err: any) {
      notifyListeners({ status: 'error', error: err?.message || 'Check failed' });
      return { status: 'error', error: err?.message };
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
