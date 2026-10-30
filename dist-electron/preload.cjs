const { contextBridge, webFrame, ipcRenderer } = require("electron");

try {
  webFrame.setZoomFactor(0.92);
} catch (e) {
  // Ignore zoom factor error
}

// Safely expose immutable desktop identity flags
contextBridge.exposeInMainWorld("isDesktopApp", true);
contextBridge.exposeInMainWorld("IS_ELECTRON", true);

// Page callbacks never receive Electron's IPC event object: its `sender` is the raw
// ipcRenderer, which would let page scripts reach any IPC channel.
function subscribe(channel, callback) {
  if (typeof callback !== "function") return () => {};
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Expose safe, tamper-proof IPC interface for auto-updater
contextBridge.exposeInMainWorld(
  "electronUpdater",
  Object.freeze({
    isAvailable: true,
    checkForUpdates: () => ipcRenderer.invoke("updater:check"),
    installUpdate: () => ipcRenderer.invoke("updater:install"),
    getVersion: () => ipcRenderer.invoke("updater:get-version"),
    onStatusChange: (callback) => subscribe("updater:status", callback),
  })
);

// Legacy IPC shim kept for compatibility (desktop detection and the sign-in fallback).
// Restricted to the sign-in channels; arbitrary channels and send() are not available.
const LEGACY_LISTEN_CHANNELS = new Set(["auth:external-success"]);
const LEGACY_INVOKE_CHANNELS = new Set(["auth:start-external"]);
const legacyListeners = new Map(); // page listener -> { channel, wrapped }

contextBridge.exposeInMainWorld(
  "ipcRenderer",
  Object.freeze({
    isAvailable: true,
    version: "1.2.0",
    on: (channel, listener) => {
      if (!LEGACY_LISTEN_CHANNELS.has(channel) || typeof listener !== "function") return;
      // Keep the (event, payload) call shape the page expects, with an empty event object
      const wrapped = (_event, data) => listener({}, data);
      legacyListeners.set(listener, { channel, wrapped });
      ipcRenderer.on(channel, wrapped);
    },
    off: (channel, listener) => {
      const entry = legacyListeners.get(listener);
      if (!entry || entry.channel !== channel) return;
      ipcRenderer.removeListener(channel, entry.wrapped);
      legacyListeners.delete(listener);
    },
    send: () => {
      throw new Error("ipcRenderer.send is not available");
    },
    invoke: (channel, options) => {
      if (!LEGACY_INVOKE_CHANNELS.has(channel)) {
        return Promise.reject(new Error(`IPC channel not allowed: ${String(channel)}`));
      }
      return ipcRenderer.invoke(channel, isPlainObject(options) ? options : {});
    },
  })
);

// Expose secure external browser authentication interface
contextBridge.exposeInMainWorld(
  "electronAuth",
  Object.freeze({
    isAvailable: true,
    startExternalAuth: (options) => ipcRenderer.invoke("auth:start-external", isPlainObject(options) ? options : {}),
    getLocalPort: () => ipcRenderer.invoke("auth:get-local-port"),
    onAuthSuccess: (callback) => subscribe("auth:external-success", callback),
  })
);

// OS-encrypted storage for the user's own API keys (main process allows only known keys)
contextBridge.exposeInMainWorld(
  "electronSecrets",
  Object.freeze({
    isAvailable: true,
    load: () => ipcRenderer.invoke("secrets:load"),
    save: (key, value) => ipcRenderer.invoke("secrets:save", String(key), typeof value === "string" ? value : null),
  })
);

// Expose safe, direct filesystem operations for 1-click rule file saving
// (all arguments are validated again in the main process)
contextBridge.exposeInMainWorld(
  "electronFile",
  Object.freeze({
    isAvailable: true,
    selectFolder: () => ipcRenderer.invoke("file:select-folder"),
    saveToFolder: (options) => ipcRenderer.invoke("file:save-to-folder", isPlainObject(options) ? options : {}),
    saveWithDialog: (options) => ipcRenderer.invoke("file:save-with-dialog", isPlainObject(options) ? options : {}),
  })
);
