/**
 * Runs workflow "code" node scripts inside a hidden <iframe sandbox="allow-scripts">.
 * The frame has an opaque origin, so a script (for example from a shared or restored workflow)
 * cannot read this page, localStorage, cookies, login tokens, API keys or the desktop bridges.
 * Same on the website and the desktop app.
 *
 * Limits: a run is stopped after 3 seconds (the frame is removed), the input may be at most 200,000 characters and
 * the output is cut at 100,000 characters. Errors say which line of the script failed when the browser tells us.
 */

const RUNNER_PATH = '/sandbox/code-runner.html';

export const SANDBOX_LIMITS = {
  timeoutMs: 3000,
  inputChars: 200_000,
  outputChars: 100_000,
} as const;

const DEFAULT_TIMEOUT_MS = SANDBOX_LIMITS.timeoutMs;
const OUTPUT_CUT_NOTE = '\n[Output cut: it was longer than 100,000 characters]';

type Pending = {
  resolve: (output: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let frame: HTMLIFrameElement | null = null;
let frameReady: Promise<HTMLIFrameElement> | null = null;
let frameLoaded = false;
const pending = new Map<string, Pending>();
let listening = false;

export function timeoutMessage(timeoutMs: number): string {
  const seconds = Math.max(1, Math.round(timeoutMs / 1000));
  return `Your script took longer than ${seconds} ${seconds === 1 ? 'second' : 'seconds'} and was stopped.`;
}

const SANDBOX_NOT_STARTED =
  'The code sandbox did not start. A script that ran too long earlier may still be stopping. Reload the page, then run it again.';

function capOutput(text: string): string {
  return text.length > SANDBOX_LIMITS.outputChars
    ? text.slice(0, SANDBOX_LIMITS.outputChars - OUTPUT_CUT_NOTE.length) + OUTPUT_CUT_NOTE
    : text;
}

/** "boom" + line 3 -> "boom (line 3 of your script)". Without a line number the message is unchanged. */
function errorMessage(msg: { error?: unknown; line?: unknown; errorName?: unknown }): string {
  const base = String(msg.error || 'Execution failed').slice(0, 1000);
  const named = msg.errorName === 'SyntaxError' ? `Syntax error: ${base}` : base;
  const line = typeof msg.line === 'number' && Number.isInteger(msg.line) && msg.line > 0 ? msg.line : null;
  return line ? `${named} (line ${line} of your script)` : named;
}

function onMessage(event: MessageEvent) {
  if (!frame || event.source !== frame.contentWindow) return;
  const msg = event.data;
  if (!msg || msg.type !== 'bedrock-code-result' || typeof msg.id !== 'string') return;
  const job = pending.get(msg.id);
  if (!job) return;
  pending.delete(msg.id);
  clearTimeout(job.timer);
  if (msg.ok) job.resolve(capOutput(String(msg.output)));
  else job.reject(new Error(errorMessage(msg)));
}

/** Removes the frame (ending anything still running in it). Jobs sent to that frame can no longer answer. */
function resetFrame(reason?: string) {
  frame?.remove();
  frame = null;
  frameReady = null;
  frameLoaded = false;
  if (reason) {
    for (const [id, job] of pending) {
      pending.delete(id);
      clearTimeout(job.timer);
      job.reject(new Error(reason));
    }
  }
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
    el.addEventListener('load', () => {
      if (frame === el) frameLoaded = true;
      resolve(el);
    }, { once: true });
    el.addEventListener('error', () => {
      if (frame === el) resetFrame();
      reject(new Error('Code sandbox failed to load'));
    }, { once: true });
    frame = el;
    document.body.appendChild(el);
  });
  return frameReady;
}

/** Size of the input in characters (JSON for non-text input); Infinity when it cannot be measured. */
function inputSize(input: unknown): number {
  if (typeof input === 'string') return input.length;
  if (input === undefined || input === null) return 0;
  try {
    return (JSON.stringify(input) ?? '').length;
  } catch {
    return Infinity;
  }
}

function newJobId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function runSandboxedCode(script: string, input: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  if (inputSize(input) > SANDBOX_LIMITS.inputChars) {
    return Promise.reject(new Error(
      `The input to this script is too long (more than ${SANDBOX_LIMITS.inputChars.toLocaleString('en-US')} characters). Shorten it first.`
    ));
  }
  const id = newJobId();
  return new Promise<string>((resolve, reject) => {
    // The timer also covers starting the frame: a frame that never loads must not leave the run waiting forever
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      const started = frameLoaded;
      // Drop the frame so a stuck script cannot keep running in the background
      resetFrame(started ? 'Stopped because another script took too long. Run it again.' : SANDBOX_NOT_STARTED);
      reject(new Error(started ? timeoutMessage(timeoutMs) : SANDBOX_NOT_STARTED));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });

    getFrame().then(
      (el) => {
        if (!pending.has(id)) return; // already stopped
        try {
          // Opaque-origin frame: '*' is the only valid target; only the script and its input are sent
          el.contentWindow?.postMessage({ type: 'bedrock-code-run', id, script, input }, '*');
        } catch {
          pending.delete(id);
          clearTimeout(timer);
          reject(new Error('This input cannot be passed to a script.'));
        }
      },
      (err: unknown) => {
        if (!pending.has(id)) return;
        pending.delete(id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error('Code sandbox failed to load'));
      }
    );
  });
}
