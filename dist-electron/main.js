import { createRequire } from "node:module";
import { BrowserWindow, app, shell, session } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";

createRequire(import.meta.url);
var __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;

// =================== Anti-Hacking & Anti-Debugging Flags ===================
// Strip any command line switches that attackers use to inject debuggers
app.commandLine.removeSwitch("remote-debugging-port");
app.commandLine.removeSwitch("inspect");
app.commandLine.removeSwitch("inspect-brk");
app.commandLine.removeSwitch("enable-logging");

var win;

function createWindow() {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			webSecurity: true, // Maximum security: strictly enforce Same-Origin Policy
			contextIsolation: true, // Strict sandbox isolation between preload and page
			nodeIntegration: false, // Prevent page scripts from accessing Node APIs
			allowRunningInsecureContent: false, // Disallow HTTP content over HTTPS
			devTools: false, // Disable DevTools core in the renderer process
			sandbox: false // Preload requires process context for window flags
		},
		autoHideMenuBar: true
	});

	// Remove default application menu (prevents View -> Toggle Developer Tools)
	win.removeMenu();

	// =================== Block DevTools Keyboard Shortcuts ===================
	win.webContents.on("before-input-event", (event, input) => {
		const key = input.key.toUpperCase();
		const isCtrlOrCmd = input.control || input.meta;

		// Block F12 (Inspect Element / DevTools)
		if (key === "F12") {
			event.preventDefault();
			return;
		}

		// Block Ctrl+Shift+I / Cmd+Option+I (Open DevTools)
		if (isCtrlOrCmd && input.shift && (key === "I" || key === "J" || key === "C")) {
			event.preventDefault();
			return;
		}

		// Block Ctrl+U (View Source)
		if (isCtrlOrCmd && key === "U") {
			event.preventDefault();
			return;
		}
	});

	// =================== Block Right-Click "Inspect Element" ===================
	win.webContents.on("context-menu", (e) => {
		e.preventDefault(); // Disables right-click context menu entirely
	});

	// =================== Navigation & Phishing Guard ===================
	// Prevent malicious scripts from navigating the app to arbitrary remote domains
	win.webContents.on("will-navigate", (event, navigationUrl) => {
		const parsedUrl = new URL(navigationUrl);
		const isAllowedHost =
			parsedUrl.hostname === "localhost" ||
			parsedUrl.hostname === "127.0.0.1" ||
			parsedUrl.protocol === "file:";

		if (!isAllowedHost) {
			event.preventDefault();
			shell.openExternal(navigationUrl);
		}
	});

	// Restrict window.open / popups: Open verified external URLs safely in system browser
	win.webContents.setWindowOpenHandler(({ url }) => {
		try {
			const parsed = new URL(url);
			// Allow Google OAuth / Clerk popup authentication
			if (
				parsed.hostname.includes("clerk") ||
				parsed.hostname.includes("accounts.google.com") ||
				parsed.hostname.includes("google.com")
			) {
				return {
					action: "allow",
					overrideBrowserWindowOptions: {
						autoHideMenuBar: true,
						webPreferences: {
							webSecurity: true,
							devTools: false
						}
					}
				};
			}

			// Open documentation / external links in external system browser
			if (parsed.protocol === "https:" || parsed.protocol === "http:") {
				shell.openExternal(url);
			}
		} catch {
			// Ignore invalid URLs
		}
		return { action: "deny" };
	});

	win.webContents.on("did-finish-load", () => {
		win.webContents.setZoomFactor(0.92);
	});

	// Securely inject desktop identity flags
	win.webContents.executeJavaScript("window.IS_ELECTRON = true; window.isDesktopApp = true;");

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL);
	} else {
		win.loadFile(path.join(RENDERER_DIST, "index.html"));
	}
}

// Enforce single instance lock (prevents duplicate malicious sidecar injection)
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (win) {
			if (win.isMinimized()) win.restore();
			win.focus();
		}
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit();
			win = null;
		}
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});

	app.whenReady().then(() => {
		// Set Content-Security-Policy headers dynamically
		session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
					"Content-Security-Policy": [
						"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* http://127.0.0.1:* https://*.clerk.accounts.dev https://accounts.google.com https://fonts.googleapis.com https://fonts.gstatic.com;"
					]
				}
			});
		});

		createWindow();
	});
}

export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
