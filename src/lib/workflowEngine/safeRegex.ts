/**
 * Safe regular expressions for workflow nodes (engine dependency `regexTest`).
 *
 * JavaScript regexes can take seconds, minutes or "forever" on some pattern + text pairs (ReDoS). In the browser that
 * freezes the whole page, so a pattern typed by a user (or written by AI, or inside a shared workflow) is checked
 * BEFORE it runs. Checks are done by reading the pattern, never by running it, so a refusal is always instant.
 *
 * A pattern is refused ("unsafe") when it has a shape known to explode:
 *  1. a repeat inside a repeat, e.g. (a+)+  (.*)*  (\w+\s?)*  (a{1,3}){10}
 *  2. a backreference (\1, \k<name>) inside a repeat, e.g. (a\1)*
 *  3. a repeated group whose choices overlap, e.g. (a|aa)+  (a|)*  (\w|\d)+
 *  4. two open-ended repeats next to each other that can match the same characters, e.g. .*.*  \d+\d*  \w+\s*\w+
 *  5. three or more open-ended repeats of "almost anything" (. \S \D [^x] ...) anywhere, e.g. .*a.*b.*c
 * Anything else still runs with the text cut to 50,000 characters. Plain patterns stay fast; a single `.*` on the
 * maximum text length can still take around a second in the worst case (measured: `.*x` on 50,000 letters ~0.9 s).
 *
 * Matching is always case-insensitive, like the existing condition node's regex rule (which this file does not change).
 */

export type SafeRegexReason = 'too_long' | 'invalid' | 'unsafe';
export type SafeRegexResult = { ok: true; matched: boolean } | { ok: false; reason: SafeRegexReason };
export type RegexCheck = { ok: true } | { ok: false; reason: SafeRegexReason };

export const SAFE_REGEX_LIMITS = {
  /** Longest pattern accepted. */
  patternChars: 200,
  /** Text is cut to this many characters before matching. */
  textChars: 50_000,
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// A small parser for the pattern syntax JavaScript accepts without the `u` flag. It only runs on patterns that
// `new RegExp(pattern, 'i')` already accepted, so it can be lenient about errors.

type Item =
  | { kind: 'char'; src: string } // exactly one character: a literal, an escape such as \d, a [class] or "."
  | { kind: 'group'; alts: Item[][]; look: boolean }
  | { kind: 'backref' }
  | { kind: 'assert' } // ^ $ \b \B
  | { kind: 'repeat'; child: Item; min: number; max: number };

function parsePattern(src: string): Item[][] {
  let pos = 0;

  function parseQuantifier(): { min: number; max: number } | null {
    const c = src[pos];
    let q: { min: number; max: number } | null = null;
    if (c === '*') { q = { min: 0, max: Infinity }; pos += 1; }
    else if (c === '+') { q = { min: 1, max: Infinity }; pos += 1; }
    else if (c === '?') { q = { min: 0, max: 1 }; pos += 1; }
    else if (c === '{') {
      const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(src.slice(pos));
      if (!m) return null; // a lone "{" is a literal character without the u flag
      const min = Number(m[1]);
      const max = m[2] ? (m[3] ? Number(m[3]) : Infinity) : min;
      q = { min, max };
      pos += m[0].length;
    }
    if (q && src[pos] === '?') pos += 1; // lazy form, same backtracking cost
    return q;
  }

  function parseAtom(): Item {
    const start = pos;
    const c = src[pos];
    if (c === '(') {
      pos += 1;
      let look = false;
      if (src.startsWith('?:', pos)) pos += 2;
      else if (src.startsWith('?=', pos) || src.startsWith('?!', pos)) { pos += 2; look = true; }
      else if (src.startsWith('?<=', pos) || src.startsWith('?<!', pos)) { pos += 3; look = true; }
      else if (src.startsWith('?<', pos)) {
        const end = src.indexOf('>', pos);
        pos = end === -1 ? src.length : end + 1;
      }
      const alts = parseAlternatives();
      if (src[pos] === ')') pos += 1;
      return { kind: 'group', alts, look };
    }
    if (c === '[') {
      pos += 1;
      while (pos < src.length) {
        if (src[pos] === '\\') pos += 2;
        else if (src[pos] === ']') { pos += 1; break; }
        else pos += 1;
      }
      return { kind: 'char', src: src.slice(start, pos) };
    }
    if (c === '\\') {
      const next = src[pos + 1] ?? '';
      if (/[1-9]/.test(next)) {
        pos += 1;
        while (/\d/.test(src[pos] ?? '')) pos += 1;
        return { kind: 'backref' };
      }
      if (next === 'k' && src[pos + 2] === '<') {
        const end = src.indexOf('>', pos);
        pos = end === -1 ? src.length : end + 1;
        return { kind: 'backref' };
      }
      if (next === 'b' || next === 'B') { pos += 2; return { kind: 'assert' }; }
      if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(src.slice(pos + 2, pos + 4))) pos += 4;
      else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(src.slice(pos + 2, pos + 6))) pos += 6;
      else if (next === 'c' && /^[A-Za-z]$/.test(src[pos + 2] ?? '')) pos += 3;
      else pos += 2;
      return { kind: 'char', src: src.slice(start, pos) };
    }
    pos += 1;
    if (c === '^' || c === '$') return { kind: 'assert' };
    return { kind: 'char', src: c };
  }

  function parseAlternatives(): Item[][] {
    const alts: Item[][] = [[]];
    while (pos < src.length) {
      const c = src[pos];
      if (c === '|') { pos += 1; alts.push([]); continue; }
      if (c === ')') break;
      const atom = parseAtom();
      const q = parseQuantifier();
      alts[alts.length - 1].push(q ? { kind: 'repeat', child: atom, ...q } : atom);
    }
    return alts;
  }

  const top: Item[][] = [];
  while (pos < src.length) {
    top.push(...parseAlternatives());
    if (src[pos] === ')') pos += 1; // cannot happen for a valid pattern; never loop forever
  }
  return top.length ? top : [[]];
}

// ---------------------------------------------------------------------------------------------------------------------
// Which characters a one-character item can match, tested against a fixed sample of characters.

const SAMPLE_CHARS: string[] = (() => {
  const out: string[] = ['\t', '\n', '\r', ' ', ' ', 'é', 'ß', 'ü', 'İ', '中', 'ж', '٣', 'K'];
  for (let code = 0x20; code <= 0x7e; code += 1) out.push(String.fromCharCode(code));
  return out;
})();

const matchCache = new Map<string, Set<number>>();

function sampleMatches(src: string): Set<number> {
  const cached = matchCache.get(src);
  if (cached) return cached;
  const hits = new Set<number>();
  try {
    const re = new RegExp(`^(?:${src})$`, 'i');
    SAMPLE_CHARS.forEach((ch, i) => { if (re.test(ch)) hits.add(i); });
  } catch {
    // Treat an item we cannot test on its own as matching everything (the safe assumption)
    SAMPLE_CHARS.forEach((_, i) => hits.add(i));
  }
  if (matchCache.size > 500) matchCache.clear();
  matchCache.set(src, hits);
  return hits;
}

function overlaps(a: string, b: string): boolean {
  const ha = sampleMatches(a);
  for (const i of sampleMatches(b)) if (ha.has(i)) return true;
  return false;
}

/** "Almost anything": matches more than 80% of the sample (".", \S, \D, [^x], [\s\S], ...; not \w or \d). */
function isBroad(src: string): boolean {
  return sampleMatches(src).size > SAMPLE_CHARS.length * 0.8;
}

/** A plain literal character (or escaped punctuation such as \.), lower-cased; null for classes, \d, "." and so on. */
function literalChar(src: string): string | null {
  if (src.length === 1 && src !== '.') return src.toLowerCase();
  if (src.length === 2 && src[0] === '\\' && /[^A-Za-z0-9]/.test(src[1])) return src[1];
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------

function* descendants(item: Item): Generator<Item> {
  if (item.kind === 'repeat') {
    yield item.child;
    yield* descendants(item.child);
  } else if (item.kind === 'group') {
    for (const alt of item.alts) for (const child of alt) { yield child; yield* descendants(child); }
  }
}

function* allItems(alts: Item[][]): Generator<Item> {
  for (const alt of alts) for (const item of alt) { yield item; yield* descendants(item); }
}

/** Groups with one choice add nothing, so `.*(.*)` is read like `.*.*`. */
function flatten(seq: Item[]): Item[] {
  const out: Item[] = [];
  for (const item of seq) {
    if (item.kind === 'group' && !item.look && item.alts.length === 1) out.push(...flatten(item.alts[0]));
    else out.push(item);
  }
  return out;
}

function* sequences(alts: Item[][]): Generator<Item[]> {
  for (const alt of alts) {
    yield alt;
    for (const item of alt) for (const d of [item, ...descendants(item)]) if (d.kind === 'group') yield* d.alts;
  }
}

function repeatedChoicesOverlap(group: Extract<Item, { kind: 'group' }>): boolean {
  if (group.alts.length < 2) return false;
  const literals: string[] = [];
  const singles: string[] = [];
  for (const alt of group.alts) {
    if (alt.length === 0) return true; // (a|)* can repeat "nothing" in many ways
    if (alt.length === 1 && alt[0].kind === 'char') singles.push(alt[0].src);
    const chars = alt.map((it) => (it.kind === 'char' ? literalChar(it.src) : null));
    if (chars.every((c) => c !== null)) literals.push(chars.join(''));
  }
  for (let i = 0; i < literals.length; i += 1) {
    for (let j = 0; j < literals.length; j += 1) {
      if (i !== j && literals[j].startsWith(literals[i])) return true; // (a|aa)+  (ab|ab)*
    }
  }
  for (let i = 0; i < singles.length; i += 1) {
    for (let j = i + 1; j < singles.length; j += 1) if (overlaps(singles[i], singles[j])) return true; // (\w|\d)+
  }
  return false;
}

function adjacentOpenRepeatsOverlap(seq: Item[]): boolean {
  const flat = flatten(seq);
  for (let i = 0; i < flat.length; i += 1) {
    const a = flat[i];
    if (a.kind !== 'repeat' || a.max !== Infinity || a.child.kind !== 'char') continue;
    for (let j = i + 1; j < flat.length; j += 1) {
      const b = flat[j];
      if (b.kind === 'assert') continue;
      if (b.kind === 'repeat' && b.child.kind === 'char' && b.max === Infinity && overlaps(a.child.src, b.child.src)) return true;
      if (b.kind === 'repeat' && b.min === 0) continue; // optional items in between do not separate the two repeats
      break;
    }
  }
  return false;
}

function shapeIsUnsafe(alts: Item[][]): boolean {
  let broadOpenRepeats = 0;
  for (const item of allItems(alts)) {
    if (item.kind !== 'repeat') continue;
    if (item.max === Infinity && item.child.kind === 'char' && isBroad(item.child.src)) broadOpenRepeats += 1;
    if (item.max <= 1) continue;
    for (const inner of descendants(item.child)) {
      if (inner.kind === 'backref') return true; // rule 2
      if (inner.kind === 'repeat' && inner.max > inner.min && (item.max === Infinity || inner.max === Infinity || item.max >= 10)) {
        return true; // rule 1
      }
    }
    if (item.child.kind === 'backref') return true;
    if (item.child.kind === 'repeat' && item.child.max > item.child.min) return true;
    if (item.child.kind === 'group' && repeatedChoicesOverlap(item.child)) return true; // rule 3
  }
  if (broadOpenRepeats >= 3) return true; // rule 5
  for (const seq of sequences(alts)) if (adjacentOpenRepeatsOverlap(seq)) return true; // rule 4
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------

const compiled = new Map<string, RegExp>();

function compile(pattern: string): RegExp | null {
  const hit = compiled.get(pattern);
  if (hit) return hit;
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    return null;
  }
  if (compiled.size > 200) compiled.clear();
  compiled.set(pattern, re);
  return re;
}

/** Checks a pattern without running it. Use it to warn while the user is typing. */
export function checkRegexPattern(pattern: unknown): RegexCheck {
  if (typeof pattern !== 'string') return { ok: false, reason: 'invalid' };
  if (pattern.length > SAFE_REGEX_LIMITS.patternChars) return { ok: false, reason: 'too_long' };
  if (!compile(pattern)) return { ok: false, reason: 'invalid' };
  if (shapeIsUnsafe(parsePattern(pattern))) return { ok: false, reason: 'unsafe' };
  return { ok: true };
}

/**
 * Tests `text` against `pattern` (always case-insensitive), or explains why it will not run the pattern.
 * Text longer than 50,000 characters is cut before matching.
 */
export function safeRegexTest(pattern: string, text: string): SafeRegexResult {
  const check = checkRegexPattern(pattern);
  if (!check.ok) return check;
  const re = compile(pattern);
  if (!re) return { ok: false, reason: 'invalid' };
  re.lastIndex = 0;
  const input = typeof text === 'string' ? text : String(text ?? '');
  return { ok: true, matched: re.test(input.length > SAFE_REGEX_LIMITS.textChars ? input.slice(0, SAFE_REGEX_LIMITS.textChars) : input) };
}

/** A plain-English message for the UI and node errors. */
export function explainRegexProblem(reason: SafeRegexReason): string {
  switch (reason) {
    case 'too_long':
      return `This pattern is too long. Keep it under ${SAFE_REGEX_LIMITS.patternChars} characters.`;
    case 'invalid':
      return 'This pattern is not valid. Check the brackets and special characters such as ( ) [ ] * + ?';
    case 'unsafe':
    default:
      return 'This pattern could freeze the page. Try a simpler one.';
  }
}
