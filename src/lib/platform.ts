/**
 * Platform detection utility.
 * Distinguishes between the web application (browser/Vercel) and the desktop application (Electron/Tauri).
 */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Explicit window flags injected by preload or local server
  const hasElectronFlag = Boolean((window as any).IS_ELECTRON || (window as any).isDesktopApp);
  if (hasElectronFlag) return true;

  // 2. Preload exposed IPC bridges
  const hasIpc = typeof (window as any).ipcRenderer !== 'undefined' ||
    typeof (window as any).electronAuth !== 'undefined' ||
    typeof (window as any).electronUpdater !== 'undefined';
  if (hasIpc) return true;

  // 3. Tauri detection
  const hasTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (hasTauri) return true;

  // 4. User Agent inspection
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/Electron/i.test(ua) || /BedrockDesktop/i.test(ua)) return true;
  }

  // 5. Query parameter, protocol, or hash route inspection
  if (typeof window.location !== 'undefined') {
    if (window.location.search && window.location.search.includes('desktop=true')) return true;
    if (window.location.protocol === 'file:') return true;
  }

  return false;
}

export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Macintosh|Mac OS X|MacPPC|MacIntel/i.test(navigator.userAgent || '');
}

export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Win32|Win64|Windows/i.test(navigator.userAgent || '');
}
