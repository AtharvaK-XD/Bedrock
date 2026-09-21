/**
 * Platform detection utility.
 * Distinguishes between the web application (browser/Vercel) and the desktop application (Electron/Tauri).
 */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;

  const hasElectronFlag = Boolean((window as any).IS_ELECTRON || (window as any).isDesktopApp);
  const hasIpcRenderer = typeof (window as any).ipcRenderer !== 'undefined';
  const hasTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  const hasElectronUserAgent = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
  const hasDesktopParam = typeof window.location !== 'undefined' && window.location.search.includes('desktop=true');

  return hasElectronFlag || hasIpcRenderer || hasTauri || hasElectronUserAgent || hasDesktopParam;
}
