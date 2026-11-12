import { getCatalogEntry } from './nodeCatalog';

export interface FriendlyError {
  /** Short heading, plain words. */
  title: string;
  /** What happened, one or two sentences. */
  message: string;
  /** What to do about it ("How to fix"). */
  fix: string;
}

const MAX_MESSAGE_CHARS = 220;

/** First line only, with provider JSON blobs and stack noise cut off, so the card stays readable. */
function tidy(raw: string): string {
  const firstLine = raw.split('\n').find((l) => l.trim()) || raw;
  const cleaned = firstLine.replace(/\{[\s\S]*\}$/, '').trim() || firstLine.trim();
  return cleaned.length > MAX_MESSAGE_CHARS ? `${cleaned.slice(0, MAX_MESSAGE_CHARS - 1)}…` : cleaned;
}

/**
 * Turns the raw text a failed node left behind into a message and a "How to fix" line.
 * Only the display changes: nothing here touches how a node runs.
 */
export function explainNodeError(raw: string | undefined, nodeType?: string): FriendlyError {
  const text = (raw || '').trim();
  const lower = text.toLowerCase();
  const generic = getCatalogEntry(nodeType)?.howToFix || 'Check the node settings and run it again.';

  if (!text) {
    return { title: 'This step did not finish', message: 'It stopped without saying why.', fix: generic };
  }

  if (/chose not to allow custom code|not run because/.test(lower)) {
    return {
      title: 'Custom code was not allowed',
      message: 'The script did not run because you chose not to allow custom code.',
      fix: 'Press Run again and choose OK, but only if you wrote this code or trust where the workflow came from.',
    };
  }
  if (/code execution error|is not defined|unexpected token|syntaxerror|referenceerror|typeerror/.test(lower)) {
    return {
      title: 'The script has an error',
      message: tidy(text),
      fix: 'Open the node, read the code, and make sure it ends with `return` and a value. The text you receive is called `input`.',
    };
  }
  if (/api key|api_key|unauthorized|forbidden|invalid key|401|403|permission denied|incorrect api/.test(lower)) {
    return {
      title: 'The AI provider did not accept the key',
      message: tidy(text),
      fix: 'Open Settings, then API keys, and check the key for this model. On the website, sign in again.',
    };
  }
  if (/quota|rate limit|too many requests|429|usage limit|limit reached|limit of/.test(lower)) {
    return {
      title: 'A usage limit was reached',
      message: tidy(text),
      fix: 'Wait a few minutes and run it again, or pick a different model in the node settings.',
    };
  }
  if (/requires an active|upgrade/.test(lower)) {
    return {
      title: 'This model needs a higher plan',
      message: tidy(text),
      fix: 'Pick a free model in the node settings, or upgrade your plan.',
    };
  }
  if (/failed to fetch|network|offline|econn|enotfound|timed? ?out|timeout/.test(lower)) {
    return {
      title: 'Could not reach the service',
      message: tidy(text),
      fix: 'Check your internet connection and try again in a moment.',
    };
  }
  if (/busy|unavailable|503|overloaded/.test(lower)) {
    return {
      title: 'The AI is busy right now',
      message: tidy(text),
      fix: 'Try again in about 15 seconds.',
    };
  }

  return { title: 'This step ran into a problem', message: tidy(text), fix: generic };
}
