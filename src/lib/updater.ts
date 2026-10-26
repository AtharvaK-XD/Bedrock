export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error';
  version?: string;
  percent?: number;
  error?: string;
  releaseNotes?: string;
  currentVersion?: string;
  downloadUrl?: string;
}

export const CURRENT_APP_VERSION = '1.3.3';

type UpdateListener = (status: UpdateStatus) => void;
const listeners = new Set<UpdateListener>();
let currentStatus: UpdateStatus = { status: 'idle', currentVersion: CURRENT_APP_VERSION };

export function parseSemver(v?: string): [number, number, number] {
  if (!v) return [0, 0, 0];
  const cleaned = v.trim().replace(/^v/i, '').split('-')[0];
  const parts = cleaned.split('.').map((p) => parseInt(p, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function isVersionNewer(remoteVersion: string, currentVersion: string): boolean {
  const [rMaj, rMin, rPatch] = parseSemver(remoteVersion);
  const [cMaj, cMin, cPatch] = parseSemver(currentVersion);

  if (rMaj > cMaj) return true;
  if (rMaj < cMaj) return false;
  if (rMin > cMin) return true;
  if (rMin < cMin) return false;
  return rPatch > cPatch;
}

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
 * Directly queries the official GitHub releases API to check for newer published releases.
 */
export async function fetchLatestGitHubRelease(): Promise<{
  tagName: string;
  version: string;
  name: string;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  downloadUrl?: string;
} | null> {
  const repos = ['Bedrockxai/Bedrock', 'AtharvaK-XD/Bedrock'];
  for (const repo of repos) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      if (res.ok) {
        const data = await res.json();
        const tagName = data.tag_name || '';
        const version = tagName.replace(/^v/i, '').replace(/-mac$/i, '');

        const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
        let downloadUrl = data.html_url;
        if (Array.isArray(data.assets)) {
          const matched = isMac
            ? data.assets.find((a: any) => a.name?.endsWith('.dmg') || a.name?.endsWith('.zip'))
            : data.assets.find((a: any) => a.name?.endsWith('.exe'));
          if (matched?.browser_download_url) {
            downloadUrl = matched.browser_download_url;
          }
        }

        return {
          tagName,
          version,
          name: data.name || `Bedrock ${tagName}`,
          releaseNotes: data.body || '',
          publishedAt: data.published_at || '',
          htmlUrl: data.html_url,
          downloadUrl,
        };
      }
    } catch (e) {
      console.warn(`[Updater] Error checking release on ${repo}:`, e);
    }
  }
  return null;
}

/**
 * Checks for updates using GitHub Releases API first, with fallback to Electron autoUpdater.
 */
export async function checkForUpdates(): Promise<UpdateStatus> {
  notifyListeners({ status: 'checking', currentVersion: CURRENT_APP_VERSION });

  // 1. Direct GitHub Releases API Check
  try {
    const latestRelease = await fetchLatestGitHubRelease();
    if (latestRelease) {
      const current = CURRENT_APP_VERSION;
      const hasUpdate = isVersionNewer(latestRelease.version, current);

      if (hasUpdate) {
        const status: UpdateStatus = {
          status: 'available',
          version: latestRelease.version,
          releaseNotes: latestRelease.releaseNotes,
          currentVersion: current,
          downloadUrl: latestRelease.downloadUrl,
        };
        notifyListeners(status);

        // Also trigger background auto-download in Electron if supported
        if (typeof window !== 'undefined' && (window as any).electronUpdater?.checkForUpdates) {
          (window as any).electronUpdater.checkForUpdates().catch(() => {});
        }

        return status;
      } else {
        const status: UpdateStatus = {
          status: 'up-to-date',
          currentVersion: current,
          version: latestRelease.version,
        };
        notifyListeners(status);
        return status;
      }
    }
  } catch (err: any) {
    console.warn('[Updater] Direct GitHub release check error:', err);
  }

  // 2. Fallback: Electron auto-updater
  if (typeof window !== 'undefined' && (window as any).electronUpdater) {
    try {
      const res = await (window as any).electronUpdater.checkForUpdates();
      if (res?.error) {
        const cleanErr = sanitizeUpdaterError(res.error);
        notifyListeners({ status: 'error', error: cleanErr, currentVersion: CURRENT_APP_VERSION });
        return { status: 'error', error: cleanErr, currentVersion: CURRENT_APP_VERSION };
      }
      return currentStatus;
    } catch (err: any) {
      const cleanErr = sanitizeUpdaterError(err?.message || 'Check failed');
      notifyListeners({ status: 'error', error: cleanErr, currentVersion: CURRENT_APP_VERSION });
      return { status: 'error', error: cleanErr, currentVersion: CURRENT_APP_VERSION };
    }
  }

  const finalStatus: UpdateStatus = { status: 'up-to-date', currentVersion: CURRENT_APP_VERSION };
  notifyListeners(finalStatus);
  return finalStatus;
}

/**
 * Quits the application and runs the downloaded NSIS installer to apply the update,
 * or opens the installer download URL.
 */
export async function applyUpdate(downloadUrl?: string): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).electronUpdater?.installUpdate) {
    await (window as any).electronUpdater.installUpdate();
    return;
  }
  if (downloadUrl) {
    window.open(downloadUrl, '_blank');
  } else {
    window.open('https://github.com/Bedrockxai/Bedrock/releases/latest', '_blank');
  }
}
