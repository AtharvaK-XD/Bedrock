import { createRequire } from "node:module";
import { BrowserWindow, app, shell, session, dialog, ipcMain, nativeImage } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

// Ensure Windows taskbar groups windows correctly under Bedrock and displays the branded icon
if (process.platform === "win32") {
	app.setAppUserModelId("com.bedrock.desktop");
}

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

// User agent identifying the Bedrock desktop environment
app.userAgentFallback = process.platform === "darwin"
	? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 BedrockDesktop/1.2.2 Electron/43.3.0"
	: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 BedrockDesktop/1.2.2 Electron/43.3.0";

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

// Register bedrock:// custom protocol for deep-linking
if (process.defaultApp) {
	if (process.argv.length >= 2) {
		app.setAsDefaultProtocolClient("bedrock", process.execPath, [path.resolve(process.argv[1])]);
	}
} else {
	app.setAsDefaultProtocolClient("bedrock");
}

let localServerPort = 0;
const pendingAuthSessions = new Map();

function handleProtocolUrl(rawUrl) {
	if (!rawUrl || typeof rawUrl !== "string") return;
	try {
		if (rawUrl.startsWith("bedrock://")) {
			const parsed = new URL(rawUrl.replace("bedrock://", "http://bedrock/"));
			const dataParam = parsed.searchParams.get("data");
			if (dataParam) {
				const payload = JSON.parse(decodeURIComponent(dataParam));
				if (payload.nonce) {
					pendingAuthSessions.set(payload.nonce, payload);
				}
				if (win && win.webContents) {
					win.webContents.send("auth:external-success", payload);
				}
				if (win) {
					if (win.isMinimized()) win.restore();
					win.show();
					win.setAlwaysOnTop(true);
					win.focus();
					win.setAlwaysOnTop(false);
				}
				if (process.platform === "darwin") {
					app.focus({ steal: true });
					app.dock?.bounce?.("informational");
				}
			}
		}
	} catch (e) {
		console.warn("[Protocol] Error parsing deep link URL:", e);
	}
}

function startLocalServer() {
	return new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			try {
				const parsedUrl = new URL(req.url, "http://127.0.0.1");

				// Handle CORS preflight
				if (req.method === "OPTIONS") {
					res.writeHead(204, {
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
						"Access-Control-Allow-Headers": "Content-Type, Authorization"
					});
					return res.end();
				}

				// Handle Desktop Auth Completion Callback from external browser
				if (req.method === "POST" && parsedUrl.pathname === "/api/desktop-auth-complete") {
					let body = "";
					req.on("data", (chunk) => { body += chunk; });
					req.on("end", () => {
						try {
							const payload = JSON.parse(body);
							if (payload.nonce) {
								pendingAuthSessions.set(payload.nonce, payload);
							}
							if (win && win.webContents) {
								win.webContents.send("auth:external-success", payload);
							}
							if (win) {
								if (win.isMinimized()) win.restore();
								win.show();
								win.setAlwaysOnTop(true);
								win.focus();
								win.setAlwaysOnTop(false);
							}
							if (process.platform === "darwin") {
								app.focus({ steal: true });
								app.dock?.bounce?.("informational");
							}
							res.writeHead(200, {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*"
							});
							res.end(JSON.stringify({ success: true }));
						} catch {
							res.writeHead(400, {
								"Content-Type": "application/json",
								"Access-Control-Allow-Origin": "*"
							});
							res.end(JSON.stringify({ error: "Invalid JSON" }));
						}
					});
					return;
				}

				// Handle Auth Status Polling
				if (req.method === "GET" && parsedUrl.pathname === "/api/desktop-auth-status") {
					const nonce = parsedUrl.searchParams.get("nonce");
					if (nonce && pendingAuthSessions.has(nonce)) {
						const data = pendingAuthSessions.get(nonce);
						pendingAuthSessions.delete(nonce);
						res.writeHead(200, {
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*"
						});
						return res.end(JSON.stringify({ authenticated: true, session: data }));
					}
					res.writeHead(200, {
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*"
					});
					return res.end(JSON.stringify({ authenticated: false }));
				}

				let filePath = path.join(RENDERER_DIST, decodeURIComponent(parsedUrl.pathname));

				if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
					filePath = path.join(filePath, "index.html");
				}

				if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
					filePath = path.join(RENDERER_DIST, "index.html");
				}

				const ext = path.extname(filePath).toLowerCase();
				const contentType = MIME_TYPES[ext] || "application/octet-stream";

				let content = fs.readFileSync(filePath);
				if (ext === ".html" || filePath.endsWith("index.html")) {
					let html = content.toString("utf8");
					html = html.replace("<head>", '<head><script>window.IS_ELECTRON=true;window.isDesktopApp=true;</script>');
					content = Buffer.from(html, "utf8");
				}
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

		server.listen(0, () => {
			localServerPort = server.address().port;
			resolve(`http://127.0.0.1:${localServerPort}`);
		});
		server.on("error", reject);
	});
}

function getAppIcon() {
	const candidates = [
		path.join(process.env.APP_ROOT, "build", "icon.ico"),
		path.join(process.env.APP_ROOT, "src-tauri", "icons", "icon.ico"),
		path.join(__dirname, "..", "src-tauri", "icons", "icon.ico"),
		path.join(process.env.VITE_PUBLIC, "favicon.ico"),
		path.join(process.env.VITE_PUBLIC, "logo.png"),
		path.join(process.env.APP_ROOT, "public", "logo.png"),
		path.join(process.env.APP_ROOT, "public", "favicon.ico")
	];
	for (const candidate of candidates) {
		try {
			if (fs.existsSync(candidate)) {
				const nImg = nativeImage.createFromPath(candidate);
				if (!nImg.isEmpty()) {
					return { path: candidate, native: nImg };
				}
			}
		} catch {}
	}
	return null;
}

var win;

function createWindow() {
	const appIcon = getAppIcon();
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		icon: appIcon ? appIcon.native : undefined,
		webPreferences: {
			preload: fs.existsSync(path.join(__dirname, "preload.cjs"))
				? path.join(__dirname, "preload.cjs")
				: path.join(__dirname, "preload.js"),
			webSecurity: true, // Maximum security: strictly enforce Same-Origin Policy
			contextIsolation: true, // Strict sandbox isolation between preload and page
			nodeIntegration: false, // Prevent page scripts from accessing Node APIs
			allowRunningInsecureContent: false, // Disallow HTTP content over HTTPS
			devTools: true, // Enable DevTools for inspection and debugging
			sandbox: false // Preload requires process context for window flags
		},
		autoHideMenuBar: true
	});

	if (appIcon && appIcon.native) {
		win.setIcon(appIcon.native);
	}

	// Remove default application menu
	win.removeMenu();

	win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
		console.error("[Electron] Failed to load URL:", validatedURL, errorCode, errorDescription);
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

	// Restrict window.open / popups: Always open in external system browser tab
	win.webContents.setWindowOpenHandler(({ url }) => {
		try {
			if (url === "about:blank" || url.startsWith("about:")) {
				return { action: "deny" };
			}
			const parsed = new URL(url);
			// Open external links and OAuth in external system browser
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
		win.webContents.executeJavaScript("window.IS_ELECTRON = true; window.isDesktopApp = true;");
	});

	setupAutoUpdater(win);

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(`${VITE_DEV_SERVER_URL}/?desktop=true#/login`);
	} else {
		startLocalServer().then((url) => {
			win.loadURL(`${url}/?desktop=true#/login`);
		}).catch(() => {
			win.loadFile(path.join(RENDERER_DIST, "index.html"), {
				query: { desktop: "true" },
				hash: "/login"
			});
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

		autoUpdater.on("update-not-available", (_info) => {
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
			const rawMsg = err?.message || String(err || "");
			let friendlyMsg = rawMsg.split("\n")[0];
			if (rawMsg.includes("404") || rawMsg.includes("latest.yml")) {
				friendlyMsg = "No published releases found on GitHub (Bedrockxai/Bedrock). You are running the latest local build.";
			} else if (rawMsg.includes("ERR_INTERNET_DISCONNECTED") || rawMsg.includes("ENOTFOUND")) {
				friendlyMsg = "Network disconnected. Please check your internet connection.";
			} else if (rawMsg.includes("HttpError")) {
				friendlyMsg = "Unable to fetch release details from GitHub. Please try again later.";
			}
			mainWindow?.webContents.send("updater:status", {
				status: "error",
				error: friendlyMsg,
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
			const rawMsg = err?.message || String(err || "");
			let friendlyMsg = rawMsg.split("\n")[0];
			if (rawMsg.includes("404") || rawMsg.includes("latest.yml")) {
				friendlyMsg = "No published releases found on GitHub (Bedrockxai/Bedrock). You are running the latest local build.";
			}
			return { success: false, error: friendlyMsg };
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

// External browser authentication IPC handlers
ipcMain.handle("auth:get-local-port", () => localServerPort);

ipcMain.handle("auth:start-external", async (_event, { strategy, mode, nonce }) => {
	const port = localServerPort;
	const authUrl = `http://127.0.0.1:${port}/#/browser-auth?strategy=${encodeURIComponent(strategy || "oauth_google")}&mode=${encodeURIComponent(mode || "register")}&nonce=${encodeURIComponent(nonce || "")}&port=${port}`;
	shell.openExternal(authUrl);
	return { success: true, url: authUrl };
});

// Enforce single instance lock (prevents duplicate malicious sidecar injection)
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
	app.quit();
} else {
	// Handle protocol URL on macOS
	app.on("open-url", (event, url) => {
		event.preventDefault();
		handleProtocolUrl(url);
	});

	// Handle second-instance deep linking on Windows
	app.on("second-instance", (_event, argv) => {
		if (win) {
			if (win.isMinimized()) win.restore();
			win.show();
			win.setAlwaysOnTop(true);
			win.focus();
			win.setAlwaysOnTop(false);
		}
		if (Array.isArray(argv)) {
			const deepLink = argv.find((arg) => typeof arg === "string" && arg.startsWith("bedrock://"));
			if (deepLink) {
				handleProtocolUrl(deepLink);
			}
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

		// Check for protocol launch URL on Windows initial startup
		if (process.platform === "win32" && Array.isArray(process.argv)) {
			const initialDeepLink = process.argv.find((arg) => typeof arg === "string" && arg.startsWith("bedrock://"));
			if (initialDeepLink) {
				setTimeout(() => handleProtocolUrl(initialDeepLink), 1500);
			}
		}

		createWindow();
	});
}

export { MAIN_DIST, RENDERER_DIST, VITE_DEV_SERVER_URL };
