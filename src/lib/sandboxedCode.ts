/**
 * Runs workflow "code" node scripts inside a hidden <iframe sandbox="allow-scripts">.
 * The frame has an opaque origin, so a script (for example from a shared or restored workflow)
 * cannot read this page, localStorage, cookies, login tokens, API keys or the desktop bridges.
 * Same on the website and the desktop app.
 */

const RUNNER_PATH = '/sandbox/code-runner.html';
const DEFAULT_TIMEOUT_MS = 5000;

type Pending = {
  resolve: (output: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let frame: HTMLIFrameElement | null = null;
let frameReady: Promise<HTMLIFrameElement> | null = null;
const pending = new Map<string, Pending>();
let listening = false;

function onMessage(event: MessageEvent) {
  if (!frame || event.source !== frame.contentWindow) return;
  const msg = event.data;
  if (!msg || msg.type !== 'bedrock-code-result' || typeof msg.id !== 'string') return;
  const job = pending.get(msg.id);
  if (!job) return;
  pending.delete(msg.id);
  clearTimeout(job.timer);
  if (msg.ok) job.resolve(String(msg.output));
  else job.reject(new Error(String(msg.error || 'Execution failed')));
}

function resetFrame() {
  frame?.remove();
  frame = null;
  frameReady = null;
}

function getFrame(): Promise<HTMLIFrameElement> {
  if (frameReady) return frameReady;
  if (!listening) {
    window.addEventListener('message', onMessage);
    listening = true;
  }
  frameReady = new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.setAttribute('sandbox', 'allow-scripts');
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    el.style.display = 'none';
    el.src = new URL(RUNNER_PATH, window.location.origin).toString();
    el.addEventListener('load', () => resolve(el), { once: true });
    el.addEventListener('error', () => {
      resetFrame();
      reject(new Error('Code sandbox failed to load'));
    }, { once: true });
    frame = el;
    document.body.appendChild(el);
  });
  return frameReady;
}

export async function runSandboxedCode(script: string, input: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const el = await getFrame();
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // Drop the frame so a stuck script cannot keep running in the background
      resetFrame();
      reject(new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    // Opaque-origin frame: '*' is the only valid target; only the script and its input are sent
    el.contentWindow?.postMessage({ type: 'bedrock-code-run', id, script, input }, '*');
  });
}
