import { createRequire } from "node:module";
import { BrowserWindow, app, shell, session, dialog, ipcMain, nativeImage, safeStorage } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";

// Ensure Windows taskbar groups windows correctly under Bedrock and displays the branded icon
if (process.platform === "win32") {
	app.setAppUserModelId("com.bedrock.desktop");
}

process.on("uncaughtException", (err) => {
	console.error("[Electron Main] Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
	console.error("[Electron Main] Unhandled rejection:", reason);
});

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

// Register bedrock:// custom protocol for deep-linking
if (process.defaultApp) {
	if (process.argv.length >= 2) {
		app.setAsDefaultProtocolClient("bedrock", process.execPath, [path.resolve(process.argv[1])]);
	}
} else {
	app.setAsDefaultProtocolClient("bedrock");
}

let localServerPort = 0;
const pendingAuthSessions = new Map(); // nonce -> { payload, expiresAt }

// =================== Security helpers ===================

// Only web links may be handed to the OS; other schemes (file:, ms-msdt:, search-ms:, custom
// protocol handlers) can launch local programs.
const SAFE_EXTERNAL_PROTOCOLS = new Set(["https:", "http:"]);
function openExternalSafe(rawUrl) {
	try {
		const parsed = new URL(rawUrl);
		if (!SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
			console.warn("[Security] Blocked openExternal for scheme:", parsed.protocol);
			return false;
		}
		shell.openExternal(parsed.toString());
		return true;
	} catch {
		return false;
	}
}

// Desktop sign-in nonces: only nonces issued through our own renderer (auth:start-external) are
// accepted by the loopback callback and the bedrock:// deep link. Single use, short-lived.
const AUTH_NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/;
const AUTH_NONCE_TTL_MS = 10 * 60 * 1000;
const MAX_AUTH_BODY_BYTES = 64 * 1024;
const issuedAuthNonces = new Map(); // nonce -> expiresAt

function pruneAuthState() {
	const now = Date.now();
	for (const [nonce, expiresAt] of issuedAuthNonces) {
		if (expiresAt <= now) issuedAuthNonces.delete(nonce);
	}
	for (const [nonce, entry] of pendingAuthSessions) {
		if (entry.expiresAt <= now) pendingAuthSessions.delete(nonce);
	}
}

function registerAuthNonce(nonce) {
	pruneAuthState();
	issuedAuthNonces.set(nonce, Date.now() + AUTH_NONCE_TTL_MS);
}

const AUTH_PAYLOAD_FIELDS = ["email", "name", "avatarUrl", "clerkUserId", "strategy", "token", "plan"];

/** Validates an external sign-in payload and consumes its nonce. Returns a sanitized copy or null. */
function acceptAuthPayload(payload) {
	pruneAuthState();
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
	const nonce = payload.nonce;
	if (typeof nonce !== "string" || !AUTH_NONCE_RE.test(nonce) || !issuedAuthNonces.has(nonce)) return null;
	issuedAuthNonces.delete(nonce);

	const clean = { nonce };
	for (const key of AUTH_PAYLOAD_FIELDS) {
		const value = payload[key];
		if (typeof value === "string" && value.length <= 8192) clean[key] = value;
	}
	if (typeof payload.timestamp === "number") clean.timestamp = payload.timestamp;
	pendingAuthSessions.set(nonce, { payload: clean, expiresAt: Date.now() + AUTH_NONCE_TTL_MS });
	return clean;
}

/** Our own loopback origins (the app window and the external sign-in page both use them). */
function isOwnLoopbackOrigin(origin) {
	return origin === `http://127.0.0.1:${localServerPort}` || origin === `http://localhost:${localServerPort}`;
}

/** Rejects requests that a browser marks as coming from another website. */
function isTrustedLocalRequest(req) {
	const origin = req.headers.origin;
	if (origin !== undefined) return isOwnLoopbackOrigin(origin);
	// No Origin header (e.g. same-origin GET): fall back to the browser's Fetch Metadata
	const fetchSite = req.headers["sec-fetch-site"];
	return fetchSite === undefined || fetchSite === "same-origin" || fetchSite === "none";
}

/** CORS headers only for our own loopback origin (never "*"). */
function loopbackCorsHeaders(req) {
	const origin = req.headers.origin;
	return isOwnLoopbackOrigin(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

// Folders the user approved for 1-click export (via the native folder picker or a native
// confirmation dialog). Persisted in the main process, out of reach of page scripts.
const MAX_EXPORT_CONTENT_CHARS = 2 * 1024 * 1024;
const ALLOWED_EXPORT_NAMES = new Set([".cursorrules", ".windsurfrules"]);
const ALLOWED_EXPORT_EXTENSIONS = new Set([".md", ".txt", ".json", ".ts", ".py", ".sh", ".yaml", ".yml"]);
let approvedFolders = null;

function approvedFoldersFile() {
	return path.join(app.getPath("userData"), "approved-export-folders.json");
}

function loadApprovedFolders() {
	if (approvedFolders) return approvedFolders;
	approvedFolders = new Set();
	try {
		const list = JSON.parse(fs.readFileSync(approvedFoldersFile(), "utf-8"));
		if (Array.isArray(list)) list.filter((p) => typeof p === "string").forEach((p) => approvedFolders.add(p));
	} catch {
		// first run or unreadable file: start empty
	}
	return approvedFolders;
}

function approveFolder(realFolder) {
	const set = loadApprovedFolders();
	set.add(realFolder);
	try {
		fs.mkdirSync(path.dirname(approvedFoldersFile()), { recursive: true });
		fs.writeFileSync(approvedFoldersFile(), JSON.stringify([...set]), "utf-8");
	} catch (err) {
		console.warn("[Security] Could not persist approved export folders:", err?.message);
	}
}

function isAllowedExportFileName(fileName) {
	if (typeof fileName !== "string" || fileName.length === 0 || fileName.length > 255) return false;
	if (fileName !== path.basename(fileName) || /[\\/:*?"<>|\u0000-\u001F]/.test(fileName) || fileName === "." || fileName === "..") return false;
	if (ALLOWED_EXPORT_NAMES.has(fileName)) return true;
	return ALLOWED_EXPORT_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function handleProtocolUrl(rawUrl) {
	if (!rawUrl || typeof rawUrl !== "string" || rawUrl.length > 32768) return;
	try {
		if (rawUrl.startsWith("bedrock://")) {
			const parsed = new URL(rawUrl.replace("bedrock://", "http://bedrock/"));
			const dataParam = parsed.searchParams.get("data");
			if (dataParam) {
				// Any website can open a bedrock:// link: accept only payloads for a nonce we issued
				const payload = acceptAuthPayload(JSON.parse(decodeURIComponent(dataParam)));
				if (!payload) {
					console.warn("[Security] Ignored bedrock:// auth payload with unknown or used nonce");
					return;
				}
				if (win && !win.isDestroyed() && win.webContents) {
					win.webContents.send("auth:external-success", payload);
				}
				if (win && !win.isDestroyed()) {
					if (win.isMinimized()) win.restore();
					win.show();
					win.setAlwaysOnTop(true);
					win.focus();
					win.setAlwaysOnTop(false);
					win.flashFrame(true);
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

				// Handle CORS preflight: only our own loopback origins (never "*")
				if (req.method === "OPTIONS") {
					const cors = loopbackCorsHeaders(req);
					res.writeHead(204, cors["Access-Control-Allow-Origin"]
						? {
							...cors,
							"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
							"Access-Control-Allow-Headers": "Content-Type, Authorization"
						}
						: {});
					return res.end();
				}

				// Handle Desktop Auth Completion Callback from external browser
				if (req.method === "POST" && parsedUrl.pathname === "/api/desktop-auth-complete") {
					if (!isTrustedLocalRequest(req)) {
						res.writeHead(403, { "Content-Type": "application/json" });
						return res.end(JSON.stringify({ error: "Forbidden" }));
					}
					let body = "";
					let tooLarge = false;
					req.on("data", (chunk) => {
						if (tooLarge) return;
						body += chunk;
						if (body.length > MAX_AUTH_BODY_BYTES) {
							tooLarge = true;
							res.writeHead(413, { "Content-Type": "application/json", ...loopbackCorsHeaders(req) });
							res.end(JSON.stringify({ error: "Payload too large" }));
							req.destroy();
						}
					});
					req.on("end", () => {
						if (tooLarge) return;
						try {
							const payload = acceptAuthPayload(JSON.parse(body));
							if (!payload) {
								res.writeHead(403, { "Content-Type": "application/json", ...loopbackCorsHeaders(req) });
								return res.end(JSON.stringify({ error: "Unknown or expired sign-in request" }));
							}
							if (win && !win.isDestroyed() && win.webContents) {
								win.webContents.send("auth:external-success", payload);
							}
							if (win && !win.isDestroyed()) {
								if (win.isMinimized()) win.restore();
								win.show();
								win.setAlwaysOnTop(true);
								win.focus();
								win.setAlwaysOnTop(false);
								win.flashFrame(true);
							}
							if (process.platform === "darwin") {
								app.focus({ steal: true });
								app.dock?.bounce?.("informational");
							}
							res.writeHead(200, {
								"Content-Type": "application/json",
								...loopbackCorsHeaders(req)
							});
							res.end(JSON.stringify({ success: true }));
						} catch {
							res.writeHead(400, {
								"Content-Type": "application/json",
								...loopbackCorsHeaders(req)
							});
							res.end(JSON.stringify({ error: "Invalid JSON" }));
						}
					});
					return;
				}

				// Handle Auth Status Polling (same-origin only; each session can be read once)
				if (req.method === "GET" && parsedUrl.pathname === "/api/desktop-auth-status") {
					if (!isTrustedLocalRequest(req)) {
						res.writeHead(403, { "Content-Type": "application/json" });
						return res.end(JSON.stringify({ error: "Forbidden" }));
					}
					pruneAuthState();
					const nonce = parsedUrl.searchParams.get("nonce");
					if (typeof nonce === "string" && AUTH_NONCE_RE.test(nonce) && pendingAuthSessions.has(nonce)) {
						const entry = pendingAuthSessions.get(nonce);
						pendingAuthSessions.delete(nonce);
						res.writeHead(200, {
							"Content-Type": "application/json",
							...loopbackCorsHeaders(req)
						});
						return res.end(JSON.stringify({ authenticated: true, session: entry.payload }));
					}
					res.writeHead(200, {
						"Content-Type": "application/json",
						...loopbackCorsHeaders(req)
					});
					return res.end(JSON.stringify({ authenticated: false }));
				}

				// Handle Backend API Proxying for Desktop Workstation (Synthesize, RAG Grounding, Telemetry, Profiles)
				if (parsedUrl.pathname.startsWith("/api/")) {
					const backendHost = process.env.BEDROCK_BACKEND_HOST || "bedrock-steel.vercel.app";
					const isHttps = !backendHost.includes("localhost") && !backendHost.includes("127.0.0.1");
					const transport = isHttps ? https : http;
					const port = isHttps ? 443 : (process.env.BEDROCK_BACKEND_PORT ? parseInt(process.env.BEDROCK_BACKEND_PORT, 10) : 3001);

					const cleanHeaders = { ...req.headers };
					delete cleanHeaders.host;
					delete cleanHeaders.connection;

					const proxyReq = transport.request(
						{
							hostname: backendHost,
							port,
							path: parsedUrl.pathname + parsedUrl.search,
							method: req.method,
							headers: {
								...cleanHeaders,
								host: backendHost,
							},
						},
						(proxyRes) => {
							res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
							proxyRes.pipe(res, { end: true });
						}
					);

					proxyReq.on("error", (err) => {
						console.warn("[LocalServer API Proxy] Remote proxy unreachable:", err.message);
						res.writeHead(502, {
							"Content-Type": "application/json",
							...loopbackCorsHeaders(req),
						});
						res.end(JSON.stringify({ error: "Backend proxy unreachable", message: err.message, offline: true }));
					});

					req.pipe(proxyReq, { end: true });
					return;
				}

				// Resolve inside the renderer bundle only: block ../ and encoded traversal (%2e%2e%2f)
				const rendererRoot = path.resolve(RENDERER_DIST);
				let filePath = path.resolve(rendererRoot, "." + path.sep + decodeURIComponent(parsedUrl.pathname));
				if (filePath !== rendererRoot && !filePath.startsWith(rendererRoot + path.sep)) {
					res.writeHead(403, { "Content-Type": "text/plain" });
					return res.end("Forbidden");
				}

				if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
					filePath = path.join(filePath, "index.html");
				}

				if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
					filePath = path.join(RENDERER_DIST, "index.html");
				}

				const ext = path.extname(filePath).toLowerCase();
				const contentType = MIME_TYPES[ext] || "application/octet-stream";

				const content = fs.readFileSync(filePath);
				// No CORS header: the app loads its own files same-origin; other sites must not read them
				res.writeHead(200, {
					"Content-Type": contentType
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
		title: "Bedrock",
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
			devTools: !app.isPackaged, // DevTools only in development builds
			sandbox: true // OS-level renderer sandbox; preload.cjs only uses contextBridge/ipcRenderer/webFrame
		},
		autoHideMenuBar: true
	});

	if (appIcon && appIcon.native) {
		win.setIcon(appIcon.native);
	}

	// Remove default application menu
	win.removeMenu();

	win.on("closed", () => {
		win = null;
	});

	win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
		console.error("[Electron] Failed to load URL:", validatedURL, errorCode, errorDescription);
	});



	// =================== Navigation & Phishing Guard ===================
	// Prevent malicious scripts from navigating the app to arbitrary remote domains
	win.webContents.on("will-navigate", (event, navigationUrl) => {
		try {
			if (navigationUrl.startsWith("bedrock://")) {
				event.preventDefault();
				handleProtocolUrl(navigationUrl);
				return;
			}
			const parsedUrl = new URL(navigationUrl);
			const isAllowedHost =
				parsedUrl.hostname === "localhost" ||
				parsedUrl.hostname === "127.0.0.1" ||
				parsedUrl.protocol === "file:";

			if (!isAllowedHost) {
				event.preventDefault();
				openExternalSafe(navigationUrl);
			}
		} catch {
			event.preventDefault();
		}
	});

	// Restrict window.open / popups: Allow in-app authentication popups safely, open external web links in system browser
	win.webContents.setWindowOpenHandler(({ url }) => {
		try {
			if (url === "about:blank" || url.startsWith("about:")) {
				return {
					action: "allow",
					overrideBrowserWindowOptions: {
						width: 540,
						height: 720,
						autoHideMenuBar: true,
						webPreferences: {
							webSecurity: true,
							devTools: false
						}
					}
				};
			}

			const parsed = new URL(url);
			// Allow Google OAuth, GitHub OAuth, Clerk authentication, and local loopback popups in-app
			if (
				parsed.hostname.includes("clerk") ||
				parsed.hostname.includes("google") ||
				parsed.hostname.includes("github") ||
				parsed.hostname.includes("gstatic") ||
				parsed.hostname === "localhost" ||
				parsed.hostname === "127.0.0.1"
			) {
				return {
					action: "allow",
					overrideBrowserWindowOptions: {
						width: 540,
						height: 720,
						autoHideMenuBar: true,
						webPreferences: {
							webSecurity: true,
							devTools: false
						}
					}
				};
			}

			// Open documentation / external links in external system browser (http/https only)
			openExternalSafe(url);
		} catch {
			// Ignore invalid URLs
		}
		return { action: "deny" };
	});

	win.webContents.on("did-finish-load", () => {
		if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
			win.webContents.setZoomFactor(0.92);
			win.webContents.executeJavaScript("window.IS_ELECTRON = true; window.isDesktopApp = true;").catch(() => {});
		}
	});

	setupAutoUpdater();

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(`${VITE_DEV_SERVER_URL}/?desktop=true#/login`);
	} else {
		startLocalServer().then((url) => {
			if (win && !win.isDestroyed()) {
				win.loadURL(`${url}/?desktop=true#/login`);
			}
		}).catch(() => {
			if (win && !win.isDestroyed()) {
				win.loadFile(path.join(RENDERER_DIST, "index.html"), {
					query: { desktop: "true" },
					hash: "/login"
				});
			}
		});
	}
}

let autoUpdaterInitialized = false;

function sendUpdaterStatus(statusData) {
	if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
		win.webContents.send("updater:status", statusData);
	}
}

function setupAutoUpdater() {
	if (!autoUpdater || autoUpdaterInitialized) return;
	autoUpdaterInitialized = true;

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
			sendUpdaterStatus({ status: "checking" });
		});

		autoUpdater.on("update-available", (info) => {
			console.log(`[AutoUpdater] Update available: v${info.version}`);
			sendUpdaterStatus({
				status: "available",
				version: info.version,
				releaseNotes: info.releaseNotes,
			});
		});

		autoUpdater.on("update-not-available", (_info) => {
			console.log("[AutoUpdater] App is up to date.");
			sendUpdaterStatus({
				status: "up-to-date",
				currentVersion: app.getVersion(),
			});
		});

		autoUpdater.on("download-progress", (progressObj) => {
			sendUpdaterStatus({
				status: "downloading",
				percent: Math.round(progressObj.percent),
				bytesPerSecond: progressObj.bytesPerSecond,
				transferred: progressObj.transferred,
				total: progressObj.total,
			});
		});

		autoUpdater.on("update-downloaded", (info) => {
			console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
			sendUpdaterStatus({
				status: "downloaded",
				version: info.version,
			});

			const dialogParent = (win && !win.isDestroyed()) ? win : undefined;
			dialog.showMessageBox(dialogParent, {
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
			}).catch(() => {});
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
			sendUpdaterStatus({
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

// Native authentication IPC handlers
ipcMain.handle("auth:get-local-port", () => localServerPort);

ipcMain.handle("auth:start-external", async (_event, options) => {
	const { strategy, mode, nonce } = options && typeof options === "object" ? options : {};
	const safeStrategy = typeof strategy === "string" && /^oauth_[a-z0-9_]{1,32}$/.test(strategy) ? strategy : "oauth_google";
	const safeMode = mode === "login" || mode === "register" ? mode : "register";
	if (typeof nonce !== "string" || !AUTH_NONCE_RE.test(nonce)) {
		return { success: false, error: "Invalid sign-in request." };
	}
	// Only this nonce will be accepted back from the browser / bedrock:// deep link
	registerAuthNonce(nonce);

	const port = localServerPort;
	const authUrl = `http://127.0.0.1:${port}/#/browser-auth?strategy=${encodeURIComponent(safeStrategy)}&mode=${encodeURIComponent(safeMode)}&nonce=${encodeURIComponent(nonce)}&port=${port}`;

	// Open the authentication screen directly in the user's system default browser (Chrome, Edge, etc.)
	openExternalSafe(authUrl);
	return { success: true, url: authUrl };
});

// Native filesystem 1-click export IPC handlers
ipcMain.handle("file:select-folder", async () => {
	try {
		const targetWin = (win && !win.isDestroyed()) ? win : (BrowserWindow.getFocusedWindow() || undefined);
		const result = await dialog.showOpenDialog(targetWin, {
			title: "Select Project Root Folder for Bedrock Rules",
			properties: ["openDirectory", "createDirectory"],
			buttonLabel: "Select Folder"
		});
		if (result.canceled || !result.filePaths.length) {
			return { canceled: true };
		}
		// The user picked this folder in a native dialog: approve it for 1-click exports
		approveFolder(fs.realpathSync(result.filePaths[0]));
		return { canceled: false, folderPath: result.filePaths[0] };
	} catch (err) {
		return { canceled: true, error: err?.message || String(err) };
	}
});

ipcMain.handle("file:save-to-folder", async (_event, options) => {
	try {
		const { folderPath, fileName, content } = options && typeof options === "object" ? options : {};
		if (typeof folderPath !== "string" || folderPath.length === 0 || folderPath.length > 1024 || !path.isAbsolute(folderPath)) {
			return { success: false, error: "Invalid destination folder." };
		}
		if (!isAllowedExportFileName(fileName)) {
			return { success: false, error: "This file name or type cannot be saved." };
		}
		if (typeof content !== "string" || content.length > MAX_EXPORT_CONTENT_CHARS) {
			return { success: false, error: "File content is missing or too large." };
		}
		if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
			return { success: false, error: "Destination folder does not exist." };
		}

		// Write only into folders the user approved in a native dialog (page scripts cannot fake this)
		const realFolder = fs.realpathSync(folderPath);
		if (!loadApprovedFolders().has(realFolder)) {
			const targetWin = (win && !win.isDestroyed()) ? win : (BrowserWindow.getFocusedWindow() || undefined);
			const { response } = await dialog.showMessageBox(targetWin, {
				type: "question",
				buttons: ["Allow", "Cancel"],
				defaultId: 1,
				cancelId: 1,
				title: "Allow file export - Bedrock",
				message: "Allow Bedrock to save files in this folder?",
				detail: `${realFolder}\n\nFile: ${fileName}`,
				noLink: true,
			});
			if (response !== 0) {
				return { success: false, canceled: true, error: "Folder access was not allowed." };
			}
			approveFolder(realFolder);
		}

		const fullPath = path.join(realFolder, fileName);
		if (path.dirname(fullPath) !== realFolder) {
			return { success: false, error: "Invalid file name." };
		}
		fs.writeFileSync(fullPath, content, "utf-8");
		return { success: true, filePath: fullPath, fileName };
	} catch (err) {
		return { success: false, error: err?.message || String(err) };
	}
});

ipcMain.handle("file:save-with-dialog", async (_event, options) => {
	try {
		const { defaultFileName, content, title: rawTitle } = options && typeof options === "object" ? options : {};
		if (typeof content !== "string" || content.length > MAX_EXPORT_CONTENT_CHARS) {
			return { success: false, error: "File content is missing or too large." };
		}
		const targetWin = (win && !win.isDestroyed()) ? win : (BrowserWindow.getFocusedWindow() || undefined);
		const safeFileName = typeof defaultFileName === "string" && defaultFileName.length <= 255 && defaultFileName
			? path.basename(defaultFileName)
			: "system-prompt.md";
		const title = typeof rawTitle === "string" ? rawTitle.slice(0, 200) : undefined;
		const ext = path.extname(safeFileName).replace(".", "") || "md";
		const result = await dialog.showSaveDialog(targetWin, {
			title: title || `Save ${safeFileName}`,
			defaultPath: safeFileName,
			filters: [
				{ name: "Rule / Config Files", extensions: [ext, "cursorrules", "md", "windsurfrules", "json", "txt", "ts", "py"] },
				{ name: "All Files", extensions: ["*"] }
			]
		});
		if (result.canceled || !result.filePath) {
			return { canceled: true };
		}
		fs.writeFileSync(result.filePath, content, "utf-8");
		return { success: true, filePath: result.filePath };
	} catch (err) {
		return { success: false, error: err?.message || String(err) };
	}
});

// OS-encrypted storage for the renderer's API keys (Windows DPAPI / macOS Keychain via safeStorage).
// Values are kept encrypted in userData/secure-store.json instead of plain text in localStorage.
const SECURE_STORE_KEYS = new Set(["bedrock_api_keys"]);
const MAX_SECURE_VALUE_CHARS = 64 * 1024;

function secureStoreFile() {
	return path.join(app.getPath("userData"), "secure-store.json");
}

function readSecureStore() {
	try {
		const parsed = JSON.parse(fs.readFileSync(secureStoreFile(), "utf-8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function writeSecureStore(store) {
	const file = secureStoreFile();
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(store), "utf-8");
	fs.renameSync(tmp, file);
}

ipcMain.handle("secrets:load", () => {
	if (!safeStorage.isEncryptionAvailable()) return { available: false, values: {} };
	const store = readSecureStore();
	const values = {};
	for (const key of SECURE_STORE_KEYS) {
		if (typeof store[key] !== "string") continue;
		try {
			values[key] = safeStorage.decryptString(Buffer.from(store[key], "base64"));
		} catch (err) {
			console.warn("[SecureStore] Could not decrypt a stored value:", err?.message || err);
		}
	}
	return { available: true, values };
});

ipcMain.handle("secrets:save", (_event, key, value) => {
	try {
		if (!SECURE_STORE_KEYS.has(key)) return { success: false, error: "Unknown secure key." };
		if (value !== null && (typeof value !== "string" || value.length > MAX_SECURE_VALUE_CHARS)) {
			return { success: false, error: "Value is missing or too large." };
		}
		if (!safeStorage.isEncryptionAvailable()) return { success: false, error: "OS encryption is not available." };
		const store = readSecureStore();
		if (value === null) delete store[key];
		else store[key] = safeStorage.encryptString(value).toString("base64");
		writeSecureStore(store);
		return { success: true };
	} catch (err) {
		return { success: false, error: err?.message || String(err) };
	}
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
		if (win && !win.isDestroyed()) {
			if (win.isMinimized()) win.restore();
			win.show();
			win.setAlwaysOnTop(true);
			win.focus();
			win.setAlwaysOnTop(false);
		} else {
			createWindow();
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
		if (!win || win.isDestroyed()) {
			createWindow();
		}
	});

	app.whenReady().then(() => {
		// Set Content-Security-Policy headers dynamically.
		// 'unsafe-eval' stays until workflow code nodes run in a sandboxed Worker (Frontend REQUEST).
		session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
			callback({
				responseHeaders: {
					...details.responseHeaders,
					"Content-Security-Policy": [
						"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://localhost:* http://127.0.0.1:* https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://accounts.google.com https://*.google.com https://*.googleapis.com https://github.com https://*.github.com https://fonts.googleapis.com https://fonts.gstatic.com https://bedrock-steel.vercel.app; object-src 'none'; base-uri 'self';"
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
