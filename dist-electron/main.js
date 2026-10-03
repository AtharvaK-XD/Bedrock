import { createRequire } from "node:module";
import { BrowserWindow, app, shell, session, dialog, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

const require = createRequire(import.meta.url);
var __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");

let autoUpdater = null;
try {
	const updaterModule = require("electron-updater");
	autoUpdater = updaterModule.autoUpdater;
} catch (e) {
	console.warn("[AutoUpdater] Module load error:", e?.message);
}
var VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
var MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
var RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;

// Use standard Chrome browser user agent so Google and GitHub OAuth never trigger 403 disallowed_useragent
app.userAgentFallback = process.platform === "darwin"
	? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
	: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const MIME_TYPES = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".wasm": "application/wasm"
};

function startLocalServer() {
	return new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			try {
				const parsedUrl = new URL(req.url, "http://127.0.0.1");
				let filePath = path.join(RENDERER_DIST, decodeURIComponent(parsedUrl.pathname));

				if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
					filePath = path.join(filePath, "index.html");
				}

				if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
					filePath = path.join(RENDERER_DIST, "index.html");
				}

				const ext = path.extname(filePath).toLowerCase();
				const contentType = MIME_TYPES[ext] || "application/octet-stream";

				const content = fs.readFileSync(filePath);
				res.writeHead(200, {
					"Content-Type": contentType,
					"Access-Control-Allow-Origin": "*"
				});
				res.end(content);
			} catch {
				res.writeHead(500);
				res.end("Internal Server Error");
			}
		});

		server.listen(0, "127.0.0.1", () => {
			const port = server.address().port;
			resolve(`http://localhost:${port}`);
		});
		server.on("error", reject);
	});
}

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
		icon: fs.existsSync(path.join(process.env.VITE_PUBLIC, "logo.png"))
			? path.join(process.env.VITE_PUBLIC, "logo.png")
			: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
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

	// Restrict window.open / popups: Open verified authentication popups safely, and open external links in system browser
	win.webContents.setWindowOpenHandler(({ url }) => {
		try {
			// Allow blank popup creation for in-flight OAuth redirects
			if (url === "about:blank" || url.startsWith("about:")) {
				return {
					action: "allow",
					overrideBrowserWindowOptions: {
						width: 600,
						height: 750,
						autoHideMenuBar: true,
						webPreferences: {
							webSecurity: true,
							devTools: false
						}
					}
				};
			}

			const parsed = new URL(url);
			// Allow Google OAuth, GitHub OAuth, and Clerk authentication popups
			if (
				parsed.hostname.includes("clerk") ||
				parsed.hostname.includes("accounts.google.com") ||
				parsed.hostname.includes("google.com") ||
				parsed.hostname.includes("github.com") ||
				parsed.hostname === "localhost" ||
				parsed.hostname === "127.0.0.1"
			) {
				return {
					action: "allow",
					overrideBrowserWindowOptions: {
						width: 600,
						height: 750,
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

	setupAutoUpdater(win);

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL);
	} else {
		startLocalServer().then((url) => {
			win.loadURL(url);
		}).catch(() => {
			win.loadFile(path.join(RENDERER_DIST, "index.html"));
		});
	}
}

function setupAutoUpdater(mainWindow) {
	if (!autoUpdater) return;

	try {
		autoUpdater.autoDownload = true;
		autoUpdater.autoInstallOnAppQuit = true;
		autoUpdater.logger = console;

		autoUpdater.setFeedURL({
			provider: "github",
			owner: "Bedrockxai",
			repo: "Bedrock",
			releaseType: "release"
		});

		autoUpdater.on("checking-for-update", () => {
			console.log("[AutoUpdater] Checking for updates...");
			mainWindow?.webContents.send("updater:status", { status: "checking" });
		});

		autoUpdater.on("update-available", (info) => {
			console.log(`[AutoUpdater] Update available: v${info.version}`);
			mainWindow?.webContents.send("updater:status", {
				status: "available",
				version: info.version,
				releaseNotes: info.releaseNotes,
			});
		});

		autoUpdater.on("update-not-available", (info) => {
			console.log("[AutoUpdater] App is up to date.");
			mainWindow?.webContents.send("updater:status", {
				status: "up-to-date",
				currentVersion: app.getVersion(),
			});
		});

		autoUpdater.on("download-progress", (progressObj) => {
			mainWindow?.webContents.send("updater:status", {
				status: "downloading",
				percent: Math.round(progressObj.percent),
				bytesPerSecond: progressObj.bytesPerSecond,
				transferred: progressObj.transferred,
				total: progressObj.total,
			});
		});

		autoUpdater.on("update-downloaded", (info) => {
			console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
			mainWindow?.webContents.send("updater:status", {
				status: "downloaded",
				version: info.version,
			});

			dialog.showMessageBox(mainWindow, {
				type: "info",
				buttons: ["Restart Now", "Later"],
				defaultId: 0,
				cancelId: 1,
				title: "Update Ready - Bedrock",
				message: `Bedrock v${info.version} is available!`,
				detail: "A new version has been downloaded. Restart to apply update now.",
				noLink: true,
			}).then(({ response }) => {
				if (response === 0) {
					autoUpdater.quitAndInstall();
				}
			});
		});

		autoUpdater.on("error", (err) => {
			console.warn("[AutoUpdater] Error during check:", err?.message || err);
			mainWindow?.webContents.send("updater:status", {
				status: "error",
				error: err?.message || "Update check failed",
			});
		});

		// Check automatically 8 seconds after window launch in packaged build
		setTimeout(() => {
			if (app.isPackaged) {
				autoUpdater.checkForUpdates().catch((err) => {
					console.warn("[AutoUpdater] Initial check error:", err?.message);
				});
			}
		}, 8000);
	} catch (err) {
		console.warn("[AutoUpdater] Setup error:", err);
	}
}

// IPC Handlers for manual checks from settings / banner
ipcMain.handle("updater:check", async () => {
	if (autoUpdater && app.isPackaged) {
		try {
			const res = await autoUpdater.checkForUpdates();
			return { success: true, updateInfo: res?.updateInfo };
		} catch (err) {
			return { success: false, error: err.message };
		}
	}
	return {
		success: true,
		status: "dev-mode",
		message: "Auto-updater checks are active in packaged desktop build.",
		currentVersion: app.getVersion(),
	};
});

ipcMain.handle("updater:install", () => {
	if (autoUpdater) {
		autoUpdater.quitAndInstall();
	}
});

ipcMain.handle("updater:get-version", () => {
	return app.getVersion();
});

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
						"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* http://127.0.0.1:* https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://accounts.google.com https://*.google.com https://*.googleapis.com https://github.com https://*.github.com https://fonts.googleapis.com https://fonts.gstatic.com https://bedrock-steel.vercel.app;"
					]
				}
			});
		});

		createWindow();
	});
}

export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
