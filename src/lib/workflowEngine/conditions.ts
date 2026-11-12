import type { ConditionGroup, ConditionOp, ConditionRuleV2, SafeRegexResult } from './types';
import { getPath, parseJsonSafe, stringifyValue } from './jsonPath';
import { toList } from './arrays';

export interface ConditionOutcome {
  passed: boolean;
  /** Plain English, e.g: the answer contains "positive" */
  reason: string;
  /** Set when the rule could not be checked safely (unsafe or invalid regex) */
  problem?: 'REGEX_UNSAFE' | 'REGEX_INVALID' | 'BAD_PATH';
}

export interface ConditionContext {
  regexTest: (pattern: string, text: string) => SafeRegexResult;
  /** Score of the nearest Quality Judge above this node, if any */
  upstreamScore?: () => number | undefined;
}

const short = (s: string, max = 60) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * The original single-rule condition (contains / not_contains / length_gt / regex), same results as the page code:
 * value trimmed and lowercased, input lowercased, length_gt uses parseInt (0 when not a number), an invalid
 * regex is false. Regex now goes through the safe checker, so a pattern that could freeze the page is false too.
 */
export function evaluateLegacy(
  rule: 'contains' | 'not_contains' | 'length_gt' | 'regex' | undefined,
  conditionValue: string | undefined,
  input: string,
  ctx: ConditionContext
): ConditionOutcome {
  const r = rule || 'contains';
  const targetVal = (conditionValue || '').trim().toLowerCase();
  const testText = input.toLowerCase();
  if (r === 'contains') {
    const passed = testText.includes(targetVal);
    return { passed, reason: `the input ${passed ? 'contains' : 'does not contain'} "${short(targetVal)}"` };
  }
  if (r === 'not_contains') {
    const passed = !testText.includes(targetVal);
    return { passed, reason: `the input ${passed ? 'does not contain' : 'contains'} "${short(targetVal)}"` };
  }
  if (r === 'length_gt') {
    const limit = parseInt(targetVal, 10) || 0;
    const passed = testText.length > limit;
    return { passed, reason: `the input is ${testText.length} characters long, which is ${passed ? 'more than' : 'not more than'} ${limit}` };
  }
  const res = ctx.regexTest(targetVal, testText);
  if (!res.ok) {
    return {
      passed: false,
      reason: res.reason === 'invalid' ? 'the pattern is not valid, so the answer is FALSE' : 'the pattern could freeze the page, so it was not used (FALSE)',
      problem: res.reason === 'invalid' ? 'REGEX_INVALID' : 'REGEX_UNSAFE',
    };
  }
  return { passed: res.matched, reason: `the input ${res.matched ? 'matches' : 'does not match'} the pattern /${short(targetVal)}/` };
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function subjectLabel(field?: string): string {
  return field && field.trim() ? `\`${field.trim()}\`` : 'the input';
}

/** Reads the subject of a rule: the whole input, or the value at `field` when the input is JSON. */
function readSubject(input: string, field?: string): { ok: true; value: unknown; text: string } | { ok: false; reason: 'bad_path' | 'missing' | 'not_json' } {
  if (!field || !field.trim()) return { ok: true, value: input, text: input };
  const parsed = parseJsonSafe(input);
  if (!parsed.ok) return { ok: false, reason: 'not_json' };
  const got = getPath(parsed.value, field);
  if (!got.found) return { ok: false, reason: got.reason };
  return { ok: true, value: got.value, text: stringifyValue(got.value) };
}

function listOf(value: unknown, text: string): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return toList(text);
  return null;
}

/** One Branching v2 rule. Text comparisons ignore upper/lower case. */
export function evaluateRule(rule: ConditionRuleV2, input: string, ctx: ConditionContext): ConditionOutcome {
  const op: ConditionOp = rule.op;
  const raw = rule.value ?? '';
  const target = raw.trim();
  const who = subjectLabel(rule.field);

  if (op === 'score_gte' || op === 'score_lt') {
    const score = ctx.upstreamScore?.();
    const limit = asNumber(target);
    if (score === undefined) return { passed: false, reason: 'no Quality Judge score was found above this step' };
    if (limit === null) return { passed: false, reason: `"${short(target)}" is not a number` };
    const passed = op === 'score_gte' ? score >= limit : score < limit;
    return { passed, reason: `the Quality Judge score is ${score}, which is ${op === 'score_gte' ? (passed ? 'at least' : 'below') : passed ? 'below' : 'at least'} ${limit}` };
  }

  const subject = readSubject(input, rule.field);
  if (!subject.ok) {
    if (op === 'is_empty') return { passed: true, reason: `${who} was not found, so it counts as empty` };
    if (op === 'not_empty') return { passed: false, reason: `${who} was not found` };
    const why = subject.reason === 'not_json' ? 'the input is not JSON' : subject.reason === 'bad_path' ? `${who} is not a valid field path` : `${who} was not found in the input`;
    return { passed: false, reason: why, ...(subject.reason === 'bad_path' ? { problem: 'BAD_PATH' as const } : {}) };
  }
  const text = subject.text;
  const lower = text.toLowerCase();
  const t = target.toLowerCase();

  switch (op) {
    case 'contains': { const p = lower.includes(t); return { passed: p, reason: `${who} ${p ? 'contains' : 'does not contain'} "${short(target)}"` }; }
    case 'not_contains': { const p = !lower.includes(t); return { passed: p, reason: `${who} ${p ? 'does not contain' : 'contains'} "${short(target)}"` }; }
    case 'equals': { const p = lower.trim() === t; return { passed: p, reason: `${who} is ${p ? '' : 'not '}"${short(target)}"` }; }
    case 'not_equals': { const p = lower.trim() !== t; return { passed: p, reason: `${who} is ${p ? 'not ' : ''}"${short(target)}"` }; }
    case 'starts_with': { const p = lower.trimStart().startsWith(t); return { passed: p, reason: `${who} ${p ? 'starts' : 'does not start'} with "${short(target)}"` }; }
    case 'ends_with': { const p = lower.trimEnd().endsWith(t); return { passed: p, reason: `${who} ${p ? 'ends' : 'does not end'} with "${short(target)}"` }; }
    case 'regex': {
      const res = ctx.regexTest(target, text);
      if (!res.ok) {
        return { passed: false, reason: res.reason === 'invalid' ? 'the pattern is not valid' : 'the pattern could freeze the page, so it was not used', problem: res.reason === 'invalid' ? 'REGEX_INVALID' : 'REGEX_UNSAFE' };
      }
      return { passed: res.matched, reason: `${who} ${res.matched ? 'matches' : 'does not match'} /${short(target)}/` };
    }
    case 'length_gt':
    case 'length_lt': {
      const limit = asNumber(target);
      if (limit === null) return { passed: false, reason: `"${short(target)}" is not a number` };
      const len = text.length;
      const p = op === 'length_gt' ? len > limit : len < limit;
      return { passed: p, reason: `${who} is ${len} characters long, which is ${p ? '' : 'not '}${op === 'length_gt' ? 'more' : 'less'} than ${limit}` };
    }
    case 'is_empty': { const p = text.trim() === '' || (Array.isArray(subject.value) && subject.value.length === 0); return { passed: p, reason: `${who} is ${p ? '' : 'not '}empty` }; }
    case 'not_empty': { const p = !(text.trim() === '' || (Array.isArray(subject.value) && subject.value.length === 0)); return { passed: p, reason: `${who} is ${p ? 'not ' : ''}empty` }; }
    case 'is_json': {
      const p = typeof subject.value === 'string' ? (() => { const j = parseJsonSafe(subject.value); return j.ok && j.value !== null && typeof j.value === 'object'; })() : subject.value !== null && typeof subject.value === 'object';
      return { passed: p, reason: `${who} is ${p ? '' : 'not '}JSON` };
    }
    case 'is_array': {
      const p = Array.isArray(subject.value) || (typeof subject.value === 'string' && (() => { const j = parseJsonSafe(subject.value); return j.ok && Array.isArray(j.value); })());
      return { passed: p, reason: `${who} is ${p ? '' : 'not '}a list` };
    }
    case 'num_gt': case 'num_gte': case 'num_lt': case 'num_lte': case 'num_eq': {
      const n = asNumber(subject.value);
      const limit = asNumber(target);
      if (n === null) return { passed: false, reason: `${who} ("${short(text, 30)}") is not a number` };
      if (limit === null) return { passed: false, reason: `"${short(target)}" is not a number` };
      const table = {
        num_gt: [n > limit, 'more than'], num_gte: [n >= limit, 'at least'], num_lt: [n < limit, 'less than'],
        num_lte: [n <= limit, 'at most'], num_eq: [n === limit, 'equal to'],
      } as const;
      const [p, words] = table[op];
      return { passed: p, reason: `${who} is ${n}, which is ${p ? '' : 'not '}${words} ${limit}` };
    }
    case 'between': {
      const n = asNumber(subject.value);
      const [a, b] = target.split(',').map((s) => asNumber(s));
      if (n === null) return { passed: false, reason: `${who} ("${short(text, 30)}") is not a number` };
      if (a === null || b === null || a === undefined || b === undefined) return { passed: false, reason: 'write the range as two numbers, e.g. 10,20' };
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const p = n >= lo && n <= hi;
      return { passed: p, reason: `${who} is ${n}, which is ${p ? '' : 'not '}between ${lo} and ${hi}` };
    }
    case 'array_length_gt': case 'array_length_lt': {
      const list = listOf(subject.value, text);
      const limit = asNumber(target);
      if (!list) return { passed: false, reason: `${who} is not a list` };
      if (limit === null) return { passed: false, reason: `"${short(target)}" is not a number` };
      const p = op === 'array_length_gt' ? list.length > limit : list.length < limit;
      return { passed: p, reason: `${who} has ${list.length} item(s), which is ${p ? '' : 'not '}${op === 'array_length_gt' ? 'more' : 'fewer'} than ${limit}` };
    }
    case 'array_includes': {
      const list = listOf(subject.value, text);
      if (!list) return { passed: false, reason: `${who} is not a list` };
      const p = list.some((v) => stringifyValue(v).trim().toLowerCase() === t);
      return { passed: p, reason: `${who} ${p ? 'includes' : 'does not include'} "${short(target)}"` };
    }
    default:
      return { passed: false, reason: `unknown rule "${String(op)}"` };
  }
}

/** All rules must pass (mode "all"), or at least one (mode "any"). An empty group passes. */
export function evaluateGroup(group: ConditionGroup, input: string, ctx: ConditionContext): ConditionOutcome {
  const rules = Array.isArray(group.rules) ? group.rules : [];
  if (rules.length === 0) return { passed: true, reason: 'there are no rules, so the answer is TRUE' };
  const outcomes = rules.map((r) => evaluateRule(r, input, ctx));
  const problem = outcomes.find((o) => o.problem)?.problem;
  if (group.mode === 'any') {
    const hit = outcomes.find((o) => o.passed);
    return hit
      ? { passed: true, reason: hit.reason, ...(problem ? { problem } : {}) }
      : { passed: false, reason: outcomes.map((o) => o.reason).join('; and '), ...(problem ? { problem } : {}) };
  }
  const miss = outcomes.find((o) => !o.passed);
  return miss
    ? { passed: false, reason: miss.reason, ...(problem ? { problem } : {}) }
    : { passed: true, reason: outcomes.map((o) => o.reason).join('; and '), ...(problem ? { problem } : {}) };
}
