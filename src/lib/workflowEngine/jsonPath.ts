/** Safe JSON helpers: parsing AI output and reading values by path (`items[0].title`). */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const MAX_PATH_DEPTH = 20;

export type ParsedJson = { ok: true; value: unknown } | { ok: false };

/**
 * Parses JSON text. Also accepts JSON inside a ```json fenced block, which is how AI models usually answer.
 * Plain words ("hello") are not JSON; "42", "true" and "null" are.
 */
export function parseJsonSafe(text: unknown): ParsedJson {
  if (typeof text !== 'string') return text === undefined ? { ok: false } : { ok: true, value: text };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false };
  const tryParse = (s: string): ParsedJson => {
    try {
      return { ok: true, value: JSON.parse(s) };
    } catch {
      return { ok: false };
    }
  };
  const direct = tryParse(trimmed);
  if (direct.ok) return direct;
  const fenced = trimmed.match(/```(?:json|JSON)?\s*\n([\s\S]*?)```/);
  if (fenced) return tryParse(fenced[1].trim());
  return { ok: false };
}

/** Splits `a.b[0]["c d"]` into ['a', 'b', 0, 'c d']. Returns null for a malformed or unsafe path. */
export function parsePath(path: string): Array<string | number> | null {
  let p = path.trim();
  if (p.startsWith('$')) p = p.slice(1);
  if (p.startsWith('.')) p = p.slice(1);
  if (!p) return [];
  const parts: Array<string | number> = [];
  const re = /([^.[\]]+)|\[(\d+)\]|\["([^"]*)"\]|\['([^']*)'\]/g;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(p)) !== null) {
    if (m.index !== consumed && p.slice(consumed, m.index) !== '.') return null;
    consumed = re.lastIndex;
    if (m[1] !== undefined) parts.push(/^\d+$/.test(m[1]) ? Number(m[1]) : m[1].trim());
    else if (m[2] !== undefined) parts.push(Number(m[2]));
    else parts.push((m[3] ?? m[4]) as string);
  }
  if (consumed !== p.length) return null;
  if (parts.length > MAX_PATH_DEPTH) return null;
  if (parts.some((k) => typeof k === 'string' && FORBIDDEN_KEYS.has(k))) return null;
  return parts;
}

export type PathLookup = { found: true; value: unknown } | { found: false; reason: 'bad_path' | 'missing' };

/** Reads a value by path. Only own properties are read, so `__proto__` tricks and inherited keys never match. */
export function getPath(root: unknown, path: string): PathLookup {
  const parts = parsePath(path);
  if (!parts) return { found: false, reason: 'bad_path' };
  let cur: unknown = root;
  for (const key of parts) {
    if (cur === null || cur === undefined) return { found: false, reason: 'missing' };
    if (Array.isArray(cur)) {
      const idx = typeof key === 'number' ? key : /^\d+$/.test(key) ? Number(key) : NaN;
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) return { found: false, reason: 'missing' };
      cur = cur[idx];
    } else if (typeof cur === 'object') {
      const k = String(key);
      if (!Object.prototype.hasOwnProperty.call(cur, k)) return { found: false, reason: 'missing' };
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return { found: false, reason: 'missing' };
    }
  }
  return { found: true, value: cur };
}

/** A value as text the way a person expects to read it: strings as-is, everything else as JSON. */
export function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
