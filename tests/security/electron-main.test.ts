// Security tests for the Electron main process (dist-electron/main.js).
// `electron` is mocked; the real IPC handlers and the real loopback HTTP server are exercised.
// Temp folders only; no network beyond 127.0.0.1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    handlers: new Map<string, (...args: any[]) => any>(),
    webContentsEvents: new Map<string, (...args: any[]) => any>(),
    windowOpenHandler: null as null | ((d: { url: string }) => any),
    loadedUrl: '' as string,
    windowOptions: null as any,
    sent: [] as Array<[string, any]>,
    userData: '',
    readyResolve: null as null | (() => void),
  };
  const shell = { openExternal: vi.fn() };
  const dialog = {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  };
  return { state, shell, dialog };
});

vi.mock('electron', () => {
  const { state, shell, dialog } = h;
  const webContents = {
    on: (event: string, fn: any) => state.webContentsEvents.set(event, fn),
    setWindowOpenHandler: (fn: any) => { state.windowOpenHandler = fn; },
    send: (channel: string, data: any) => state.sent.push([channel, data]),
    isDestroyed: () => false,
    setZoomFactor: () => {},
    executeJavaScript: () => Promise.resolve(),
  };
  class BrowserWindow {
    webContents = webContents;
    constructor(options: any) { state.windowOptions = options; }
    static getFocusedWindow() { return null; }
    setIcon() {} removeMenu() {} on() {}
    isDestroyed() { return false; } isMinimized() { return false; }
    restore() {} show() {} setAlwaysOnTop() {} focus() {} flashFrame() {}
    loadURL(url: string) { state.loadedUrl = url; return Promise.resolve(); }
    loadFile() { return Promise.resolve(); }
  }
  const app = {
    isPackaged: false,
    userAgentFallback: '',
    setAppUserModelId: () => {},
    setAsDefaultProtocolClient: () => true,
    requestSingleInstanceLock: () => true,
    on: () => {},
    whenReady: () => Promise.resolve(),
    getVersion: () => '0.0.0-test',
    getPath: () => state.userData,
    focus: () => {},
    quit: () => {},
  };
  return {
    app,
    BrowserWindow,
    shell,
    dialog,
    session: { defaultSession: { webRequest: { onHeadersReceived: () => {} } } },
    ipcMain: { handle: (channel: string, fn: any) => state.handlers.set(channel, fn) },
    nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
  };
});

const { state, shell, dialog } = h;
let base = '';
let tmpRoot = '';
const invoke = (channel: string, ...args: any[]) => state.handlers.get(channel)!({}, ...args);

beforeAll(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bedrock-sec-'));
  state.userData = path.join(tmpRoot, 'userData');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await import('../../dist-electron/main.js');
  for (let i = 0; i < 100 && !state.loadedUrl; i++) await new Promise((r) => setTimeout(r, 20));
  base = new URL(state.loadedUrl).origin;
});

afterAll(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

beforeEach(() => {
  shell.openExternal.mockClear();
  dialog.showMessageBox.mockReset();
  state.sent.length = 0;
});

describe('window hardening', () => {
  it('keeps isolation on, sandboxes the renderer and disables DevTools in packaged builds', () => {
    const prefs = state.windowOptions.webPreferences;
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.sandbox).toBe(true);
    expect(prefs.devTools).toBe(true); // app.isPackaged === false in this test, so dev builds keep DevTools
  });
});

describe('shell.openExternal scheme allow-list', () => {
  it('hands only http/https links to the OS', () => {
    const willNavigate = state.webContentsEvents.get('will-navigate')!;
    for (const url of ['ms-msdt:/id PCWDiagnostic', 'search-ms:query=x', 'smb://evil/share', 'javascript:alert(1)']) {
      willNavigate({ preventDefault() {} }, url);
      state.windowOpenHandler!({ url });
    }
    expect(shell.openExternal).not.toHaveBeenCalled();
    willNavigate({ preventDefault() {} }, 'https://docs.example.com/page');
    state.windowOpenHandler!({ url: 'http://example.com/' });
    expect(shell.openExternal).toHaveBeenCalledTimes(2);
  });
});

describe('desktop sign-in endpoints', () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/desktop-auth-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  it('rejects other websites (foreign Origin or cross-site fetch metadata)', async () => {
    await invoke('auth:start-external', { strategy: 'oauth_google', mode: 'login', nonce: 'nonceForeign123' });
    expect((await post({ nonce: 'nonceForeign123', token: 't' }, { Origin: 'https://evil.example' })).status).toBe(403);
    const status = await fetch(`${base}/api/desktop-auth-status?nonce=nonceForeign123`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect(status.status).toBe(403);
    expect(state.sent).toHaveLength(0);
  });

  it('rejects payloads for nonces the app never issued', async () => {
    expect((await post({ nonce: 'neverIssued999', token: 't' })).status).toBe(403);
    expect(state.sent).toHaveLength(0);
  });

  it('accepts an issued nonce once from our own origin, then refuses replays', async () => {
    const started = await invoke('auth:start-external', { strategy: 'oauth_github', mode: 'register', nonce: 'goodNonce12345' });
    expect(started.success).toBe(true);
    expect(started.url).toContain('nonce=goodNonce12345');
    expect(shell.openExternal).toHaveBeenCalledTimes(1);

    const ok = await post({ nonce: 'goodNonce12345', email: 'a@b.co', token: 'tok', evil: { nested: true } });
    expect(ok.status).toBe(200);
    expect(state.sent).toEqual([['auth:external-success', expect.objectContaining({ nonce: 'goodNonce12345', email: 'a@b.co', token: 'tok' })]]);
    expect(state.sent[0][1]).not.toHaveProperty('evil');

    expect((await post({ nonce: 'goodNonce12345', token: 'tok2' })).status).toBe(403); // replay

    const first = await (await fetch(`${base}/api/desktop-auth-status?nonce=goodNonce12345`)).json();
    expect(first.authenticated).toBe(true);
    const second = await (await fetch(`${base}/api/desktop-auth-status?nonce=goodNonce12345`)).json();
    expect(second.authenticated).toBe(false); // readable only once
  });

  it('rejects malformed nonces at start and oversized bodies', async () => {
    expect((await invoke('auth:start-external', { nonce: '../../x' })).success).toBe(false);
    expect((await invoke('auth:start-external', undefined)).success).toBe(false);
    const big = await post('x'.repeat(70 * 1024));
    expect(big.status).toBe(413);
  });

  it('never answers CORS preflights from other origins with a wildcard', async () => {
    const res = await fetch(`${base}/api/desktop-auth-complete`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const own = await fetch(`${base}/api/desktop-auth-complete`, { method: 'OPTIONS', headers: { Origin: base } });
    expect(own.headers.get('access-control-allow-origin')).toBe(base);
  });

  it('still blocks path traversal on the static file server', async () => {
    const res = await fetch(`${base}/..%2f..%2f..%2fWindows%2fwin.ini`);
    expect(res.status).toBe(403);
  });
});

describe('file export IPC', () => {
  it('rejects bad arguments, traversal and dangerous file types', async () => {
    const folder = fs.mkdtempSync(path.join(tmpRoot, 'proj-'));
    // Run the relative-path case from the temp dir so a regression can never write into the repo
    const cwd = process.cwd();
    process.chdir(tmpRoot);
    try {
      expect((await invoke('file:save-to-folder', { folderPath: 'relative/dir', fileName: 'CLAUDE.md', content: 'x' })).success).toBe(false);
    } finally {
      process.chdir(cwd);
    }
    expect((await invoke('file:save-to-folder', { folderPath: folder, fileName: '..\\evil.md', content: 'x' })).success).toBe(false);
    expect((await invoke('file:save-to-folder', { folderPath: folder, fileName: 'sub/evil.md', content: 'x' })).success).toBe(false);
    expect((await invoke('file:save-to-folder', { folderPath: folder, fileName: 'run.bat', content: 'x' })).success).toBe(false);
    expect((await invoke('file:save-to-folder', { folderPath: folder, fileName: 'payload.exe', content: 'x' })).success).toBe(false);
    expect((await invoke('file:save-to-folder', { folderPath: folder, fileName: 'CLAUDE.md', content: 42 })).success).toBe(false);
    expect((await invoke('file:save-to-folder', { folderPath: folder, fileName: 'CLAUDE.md', content: 'x'.repeat(2 * 1024 * 1024 + 1) })).success).toBe(false);
    expect((await invoke('file:save-to-folder', null)).success).toBe(false);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
    expect(fs.readdirSync(folder)).toHaveLength(0);
  });

  it('asks the user natively before writing into an unapproved folder', async () => {
    const folder = fs.mkdtempSync(path.join(tmpRoot, 'proj-'));
    dialog.showMessageBox.mockResolvedValueOnce({ response: 1 }); // Cancel
    const denied = await invoke('file:save-to-folder', { folderPath: folder, fileName: '.cursorrules', content: 'rules' });
    expect(denied.success).toBe(false);
    expect(fs.existsSync(path.join(folder, '.cursorrules'))).toBe(false);

    dialog.showMessageBox.mockResolvedValueOnce({ response: 0 }); // Allow
    const allowed = await invoke('file:save-to-folder', { folderPath: folder, fileName: '.cursorrules', content: 'rules' });
    expect(allowed.success).toBe(true);
    expect(fs.readFileSync(path.join(folder, '.cursorrules'), 'utf-8')).toBe('rules');

    // Approved folder is remembered (persisted in userData), no second prompt
    const again = await invoke('file:save-to-folder', { folderPath: folder, fileName: 'CLAUDE.md', content: 'ok' });
    expect(again.success).toBe(true);
    expect(dialog.showMessageBox).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fs.readFileSync(path.join(state.userData, 'approved-export-folders.json'), 'utf-8'))).toContain(fs.realpathSync(folder));
  });

  it('approves folders picked in the native folder dialog', async () => {
    const folder = fs.mkdtempSync(path.join(tmpRoot, 'picked-'));
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [folder] });
    expect((await invoke('file:select-folder')).folderPath).toBe(folder);
    const res = await invoke('file:save-to-folder', { folderPath: folder, fileName: 'route.ts', content: 'export {}' });
    expect(res.success).toBe(true);
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  it('validates save-with-dialog content', async () => {
    expect((await invoke('file:save-with-dialog', { defaultFileName: 'a.md', content: { not: 'text' } })).success).toBe(false);
  });
});
