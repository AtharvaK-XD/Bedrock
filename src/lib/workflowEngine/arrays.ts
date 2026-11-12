import type { ArrayOp } from './types';
import { getPath, parseJsonSafe, stringifyValue } from './jsonPath';

const BULLET = /^\s*(?:[-*•▪◦]|\d{1,3}[.)])\s+/;

/**
 * Turns an input into a list:
 * - a JSON array is used as is;
 * - a JSON object with exactly one list inside (e.g. {"items": [...]}) uses that list;
 * - anything else is split into lines; blank lines are dropped and list markers ("- ", "* ", "1. ") removed.
 * Returns null when the input is a JSON object or value that is not a list.
 */
export function toList(input: string): unknown[] | null {
  const parsed = parseJsonSafe(input);
  if (parsed.ok) {
    const v = parsed.value;
    if (Array.isArray(v)) return v;
    if (v !== null && typeof v === 'object') {
      const lists = Object.values(v as Record<string, unknown>).filter(Array.isArray);
      return lists.length === 1 ? (lists[0] as unknown[]) : null;
    }
    if (typeof v === 'string') return splitLines(v);
  }
  return splitLines(input);
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(BULLET, '').trim())
    .filter(Boolean);
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Filter rule text, kept simple for people:
 *   "> 10", ">= 10", "< 5", "<= 5", "= 3", "!= 3"  compare numbers
 *   "!word"                                         items that do NOT contain "word"
 *   "word"                                          items that contain "word" (any case)
 *   "" (empty)                                      drop empty items
 */
export function filterMatches(item: unknown, rule: string): boolean {
  const r = rule.trim();
  const text = stringifyValue(item);
  if (!r) return text.trim() !== '';
  const cmp = r.match(/^(>=|<=|!=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (cmp) {
    const n = asNumber(item);
    if (n === null) return false;
    const target = Number(cmp[2]);
    switch (cmp[1]) {
      case '>': return n > target;
      case '>=': return n >= target;
      case '<': return n < target;
      case '<=': return n <= target;
      case '=': return n === target;
      default: return n !== target;
    }
  }
  if (r.startsWith('!')) return !text.toLowerCase().includes(r.slice(1).trim().toLowerCase());
  return text.toLowerCase().includes(r.toLowerCase());
}

export type ArrayOpResult = { ok: true; value: unknown; note?: string } | { ok: false; code: 'NOT_A_LIST' | 'BAD_PATH' };

/** Runs one List Tools operation. `arg` meaning depends on the operation (see BRANCHING_PROMPTS.md 0.3). */
export function applyArrayOp(op: ArrayOp, input: string, arg = ''): ArrayOpResult {
  if (op === 'split_lines') return { ok: true, value: splitLines(input) };
  if (op === 'split_by') {
    const sep = arg === '' ? ',' : arg.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    return { ok: true, value: input.split(sep).map((s) => s.trim()).filter(Boolean) };
  }
  const list = toList(input);
  if (!list) return { ok: false, code: 'NOT_A_LIST' };
  switch (op) {
    case 'filter':
      return { ok: true, value: list.filter((item) => filterMatches(item, arg)) };
    case 'sort': {
      const desc = /^desc/i.test(arg.trim());
      const allNumbers = list.length > 0 && list.every((v) => asNumber(v) !== null);
      const sorted = [...list].sort((a, b) =>
        allNumbers ? (asNumber(a) as number) - (asNumber(b) as number) : stringifyValue(a).localeCompare(stringifyValue(b), undefined, { numeric: true, sensitivity: 'base' })
      );
      return { ok: true, value: desc ? sorted.reverse() : sorted };
    }
    case 'take': {
      const n = Number.parseInt(arg, 10);
      const count = Number.isFinite(n) && n >= 0 ? n : 3;
      return { ok: true, value: list.slice(0, count) };
    }
    case 'unique': {
      const seen = new Set<string>();
      return {
        ok: true,
        value: list.filter((v) => {
          const key = typeof v === 'string' ? v : JSON.stringify(v);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      };
    }
    case 'count':
      return { ok: true, value: list.length };
    case 'join': {
      const sep = arg === '' ? ', ' : arg.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      return { ok: true, value: list.map(stringifyValue).join(sep) };
    }
    case 'pluck': {
      if (!arg.trim()) return { ok: false, code: 'BAD_PATH' };
      const out: unknown[] = [];
      let missing = 0;
      for (const item of list) {
        const got = getPath(item, arg);
        if (!got.found && got.reason === 'bad_path') return { ok: false, code: 'BAD_PATH' };
        if (got.found) out.push(got.value);
        else missing++;
      }
      return { ok: true, value: out, ...(missing ? { note: `${missing} item(s) had no "${arg.trim()}" and were left out.` } : {}) };
    }
    case 'reverse':
      return { ok: true, value: [...list].reverse() };
    default:
      return { ok: false, code: 'NOT_A_LIST' };
  }
}
