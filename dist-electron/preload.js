const { contextBridge, webFrame } = require("electron");

try {
  webFrame.setZoomFactor(0.92);
} catch (e) {
  // Ignore zoom factor error
}

// Safely expose immutable desktop identity flags
contextBridge.exposeInMainWorld("isDesktopApp", true);
contextBridge.exposeInMainWorld("IS_ELECTRON", true);

// Expose safe, tamper-proof IPC interface without raw internal reflection
contextBridge.exposeInMainWorld(
  "ipcRenderer",
  Object.freeze({
    isAvailable: true,
    version: "1.0.0",
    on: () => {},
    off: () => {},
    send: () => {},
    invoke: async () => null,
  })
);
