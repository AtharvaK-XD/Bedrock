const { contextBridge, webFrame, ipcRenderer } = require("electron");

try {
  webFrame.setZoomFactor(0.92);
} catch (e) {
  // Ignore zoom factor error
}

// Safely expose immutable desktop identity flags
contextBridge.exposeInMainWorld("isDesktopApp", true);
contextBridge.exposeInMainWorld("IS_ELECTRON", true);

// Expose safe, tamper-proof IPC interface for auto-updater
contextBridge.exposeInMainWorld(
  "electronUpdater",
  Object.freeze({
    isAvailable: true,
    checkForUpdates: () => ipcRenderer.invoke("updater:check"),
    installUpdate: () => ipcRenderer.invoke("updater:install"),
    getVersion: () => ipcRenderer.invoke("updater:get-version"),
    onStatusChange: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("updater:status", listener);
      return () => ipcRenderer.removeListener("updater:status", listener);
    },
  })
);

// Expose secure IPC interface
contextBridge.exposeInMainWorld(
  "ipcRenderer",
  Object.freeze({
    isAvailable: true,
    version: "1.2.0",
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    off: (channel, listener) => ipcRenderer.removeListener(channel, listener),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  })
);

// Expose secure external browser authentication interface
contextBridge.exposeInMainWorld(
  "electronAuth",
  Object.freeze({
    isAvailable: true,
    startExternalAuth: (options) => ipcRenderer.invoke("auth:start-external", options),
    getLocalPort: () => ipcRenderer.invoke("auth:get-local-port"),
    onAuthSuccess: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on("auth:external-success", listener);
      return () => ipcRenderer.removeListener("auth:external-success", listener);
    },
  })
);

