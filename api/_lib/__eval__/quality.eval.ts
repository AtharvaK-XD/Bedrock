import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AsyncLocalStorage } from 'node:async_hooks';

// Prompt-quality evaluation: runs the REAL route code (questions -> synthesis with its validation and repair ->
// refine) for every role and model, then has a judge model score each result blind (EVAL_JUDGE), with a second,
// independent judge on a sample (EVAL_CROSS_JUDGE). Free-tier keys: Groq allows 200,000 tokens per model per day
// and 8,000 per minute, Gemini Flash 20 requests per day (checked 2026-11-03); plan runs around that.
// Live, paid AI calls: never part of `npx vitest run` or CI (see vitest.eval.config.ts).
//
// Env (all optional):
//   EVAL_PHASES   generate,judge,summary (default all three)
//   EVAL_CASES    comma list of case ids or prefixes (default all 21)
//   EVAL_MODELS   comma list of provider ids (default the 5 server models)
//   EVAL_REPEATS  runs per case and model (default 1)
//   EVAL_BUDGET_USD  stop starting new calls above this estimated spend (default 3)
//   EVAL_RUN_DIR  folder for results (default <system temp>/bedrock-eval/<timestamp>); reuse it to judge or summarize later
//   EVAL_ENV_FILE file to read the 3 provider keys from when they are not in the environment (default ./.env.local)
//   EVAL_JUDGE    main judge: groq (GPT-OSS-120B), lite (Gemini Flash Lite) or gemini (Gemini Flash); default groq
//   EVAL_CROSS_JUDGE  independent judge on a sample: nemotron (default), groq, lite, gemini, or 0 for none
//   EVAL_CROSS_KEYS_FROM  results.json of another run: the independent judge scores the same documents
// Keys are read into this process only. They are never printed, logged or written to the results.

// Each route call runs inside its own context (AsyncLocalStorage), so the models can run in parallel without
// one call's pinned model or recorded AI calls leaking into another's.
type CallCtx = { pinned: string; calls: Array<Record<string, any>>; warnings?: string[] };
type BeforeAi = (pinned: string, inputChars: number, maxOut: number) => Promise<(actualTokens?: number) => void>;
const h = vi.hoisted(() => ({
  als: null as null | { getStore(): CallCtx | undefined },
  // Set at runtime: waits until the pinned model's tokens-per-minute budget has room (Groq free tier: 8,000/min)
  beforeAi: null as null | BeforeAi,
}));

vi.mock('../auth.js', () => ({
  authenticateRequest: vi.fn(async () => ({
    id: 'eval_user', email: 'eval@example.com', name: 'Eval', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false,
  })),
  isAllowedAppOrigin: () => true,
}));
vi.mock('../rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async () => true),
  getClientIp: () => '203.0.113.50',
  getRedisClient: () => null,
}));
vi.mock('../db.js', () => ({
  getDb: () => {
    throw new Error('no database in the eval');
  },
  logSecurityEvent: vi.fn(async () => {}),
}));
vi.mock('../security.js', async () => {
  const actual = await vi.importActual<any>('../security.js');
  return {
    ...actual,
    reserveQuota: vi.fn(async () => ({ allowed: true, unavailable: false, bucket: 'generation', limit: 999, resetMs: 1, reservationId: null })),
    releaseQuota: vi.fn(async () => {}),
    recordExecutionTrace: vi.fn(async () => {}),
  };
});
// Pin every call to one model: no load balancing, no failover to another model, no shared circuit state
vi.mock('../loadBalancer.js', async () => {
  const actual = await vi.importActual<any>('../loadBalancer.js');
  return {
    ...actual,
    selectOptimalProvider: vi.fn(async (candidates: any[]) => candidates.find((p) => p.id === h.als?.getStore()?.pinned) ?? null),
    orderForFailover: vi.fn(async (_c: any[], primary: any) => [primary]),
    recordProviderSuccess: vi.fn(async () => {}),
    recordProviderFailure: vi.fn(async () => {}),
  };
});
// Record every AI call (time, tokens, cut-off, errors) without changing it
vi.mock('../ai.js', async () => {
  const actual = await vi.importActual<any>('../ai.js');
  return {
    ...actual,
    executeAiCompletion: async (...args: any[]) => {
      const store = h.als?.getStore();
      const calls = store?.calls ?? [];
      const inputChars = String(args[0] ?? '').length + String(args[1] ?? '').length;
      const settle = h.beforeAi && store ? await h.beforeAi(store.pinned, inputChars, Number(args[5]?.maxOutputTokens) || 3500) : undefined;
      const started = Date.now();
      const warnBefore = store?.warnings?.length ?? 0;
      try {
        const r = await actual.executeAiCompletion(...args);
        settle?.(r.usage ? r.usage.inputTokens + r.usage.outputTokens : undefined);
        calls.push({ ok: true, ms: Date.now() - started, model: r.model, truncated: Boolean(r.truncated), usage: r.usage, textChars: r.text.length, inputChars });
        return r;
      } catch (err: any) {
        settle?.();
        // The provider's own reason (from the route's warning log), e.g. a quota or rate-limit message
        const reason = store?.warnings?.slice(warnBefore).join(' | ').slice(0, 400);
        calls.push({ ok: false, ms: Date.now() - started, code: err?.code, inputChars, reason });
        throw err;
      }
    },
  };
});

import synthesize from '../../ai/synthesize.js';
import generateQuestions from '../../ai/generate-questions.js';
import refine from '../../ai/refine.js';
import { getUseCaseProfile } from '../useCaseProfiles.js';
import { checkQuestionQuality } from '../validation.js';
import { AI_PROVIDERS } from '../loadBalancer.js';
import { EVAL_CASES, EVAL_MODELS, PRICE_PER_MILLION, type EvalCase } from './cases.js';

// ---------------------------------------------------------------- setup

const KEY_NAMES = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY'];
const ENV_FILE = process.env.EVAL_ENV_FILE || path.resolve('.env.local');

function loadProviderKeys() {
  if (!fs.existsSync(ENV_FILE)) return;
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || !KEY_NAMES.includes(m[1]) || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) process.env[m[1]] = v;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const list = (v: string | undefined) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const familyOf = (modelId: string) => modelId.split('-')[0];
const keyFor = (modelId: string) => ({ groq: 'GROQ_API_KEY', gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY' } as Record<string, string>)[familyOf(modelId)];

// Gap between call starts per provider (Groq's real limit, tokens per minute, is handled by tpmReserve)
const MIN_GAP_MS: Record<string, number> = { groq: 1000, gemini: 6500, openrouter: 1500, 'openrouter-free': 4000 };
const lastCallAt: Record<string, number> = {};
async function pace(family: string) {
  // Reserve the next free slot before sleeping, so parallel workers of one provider never start together
  const slot = Math.max(Date.now(), (lastCallAt[family] ?? 0) + (MIN_GAP_MS[family] ?? 2000));
  lastCallAt[family] = slot;
  const wait = slot - Date.now();
  if (wait > 0) await sleep(wait);
}

const als = new AsyncLocalStorage<CallCtx>();
h.als = als;

/**
 * Tokens-per-minute pacing per upstream model (Groq free tier: 8,000 tokens per minute per model, counted for
 * input and output). Before each call the expected tokens are reserved in a rolling 61 s window; the caller
 * waits until they fit. After the call the real count replaces the guess.
 */
const TPM_LIMIT: Record<string, number> = { 'openai/gpt-oss-120b': 7600, 'openai/gpt-oss-20b': 7600 };
const tpmLog: Record<string, Array<{ t: number; tokens: number }>> = {};
const tpmQueue: Record<string, Promise<void>> = {};
async function tpmReserve(upstreamModel: string, estimate: number): Promise<(actual?: number) => void> {
  const limit = TPM_LIMIT[upstreamModel];
  if (!limit) return () => {};
  const previous = tpmQueue[upstreamModel] ?? Promise.resolve();
  let release!: () => void;
  tpmQueue[upstreamModel] = new Promise<void>((r) => (release = r));
  await previous;
  try {
    const log = (tpmLog[upstreamModel] ??= []);
    for (;;) {
      const now = Date.now();
      while (log.length && now - log[0].t > 61_000) log.shift();
      const used = log.reduce((a, e) => a + e.tokens, 0);
      if (log.length === 0 || used + Math.min(estimate, limit) <= limit) break;
      await sleep(Math.max(500, log[0].t + 61_000 - now));
    }
    const entry = { t: Date.now(), tokens: estimate };
    log.push(entry);
    return (actual?: number) => {
      if (typeof actual === 'number' && actual > 0) entry.tokens = actual;
    };
  } finally {
    release();
  }
}
/**
 * Waits (outside the route, so the wait does not eat the route's own 50 s request budget) until the model's
 * one-minute window has at most `maxUsed` tokens in it. Only one worker uses each Groq model, so no race.
 */
async function tpmWaitForRoom(upstreamModel: string, maxUsed = 800) {
  if (!TPM_LIMIT[upstreamModel]) return;
  for (;;) {
    const log = (tpmLog[upstreamModel] ??= []);
    const now = Date.now();
    while (log.length && now - log[0].t > 61_000) log.shift();
    if (log.reduce((a, e) => a + e.tokens, 0) <= maxUsed) return;
    await sleep(Math.max(500, log[0].t + 61_000 - now));
  }
}
const upstreamModelOf = (providerId: string) => AI_PROVIDERS.find((p: any) => p.id === providerId)?.model ?? providerId;
h.beforeAi = (pinned, inputChars, maxOut) => tpmReserve(upstreamModelOf(pinned), Math.round(inputChars / 3.5) + Math.min(maxOut, 3000) + 300);

let spentUsd = 0;
function addCost(priceKey: string, inputTokens: number, outputTokens: number) {
  const [pin, pout] = PRICE_PER_MILLION[priceKey] ?? [1, 4];
  spentUsd += (inputTokens * pin + outputTokens * pout) / 1_000_000;
}
function costOfCalls(modelId: string, calls: Array<Record<string, any>>) {
  for (const c of calls) {
    const inTok = c.usage?.inputTokens ?? Math.round((c.inputChars ?? 0) / 4);
    const outTok = c.usage?.outputTokens ?? Math.round((c.textChars ?? 0) / 4);
    addCost(modelId, inTok, outTok);
  }
}

function mockReq(body: unknown) {
  return { method: 'POST', body, query: {}, headers: { authorization: 'Bearer eval' } } as any;
}
function mockRes() {
  const r: any = { statusCode: 200, body: undefined, headers: {}, headersSent: false, written: [] as string[] };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  r.setHeader = (k: string, v: string) => (r.headers[k] = v);
  r.writeHead = () => (r.headersSent = true);
  r.write = (s: string) => (r.written.push(s), true);
  r.end = () => {};
  return r;
}

/** Runs one route call pinned to a model; retries (after a pause) only when the provider itself failed. */
async function callRoute(modelId: string, handler: (req: any, res: any) => unknown, body: unknown) {
  const attempts: any[] = [];
  let res: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await pace(familyOf(modelId));
    await tpmWaitForRoom(upstreamModelOf(modelId));
    const store: CallCtx = { pinned: modelId, calls: [] };
    res = mockRes();
    const started = Date.now();
    await als.run(store, () => handler(mockReq(body), res));
    const calls = store.calls;
    costOfCalls(modelId, calls);
    const providerFailed = calls.length > 0 && calls.every((c) => !c.ok);
    attempts.push({ attempt, status: res.statusCode, ms: Date.now() - started, calls, providerFailed });
    if (!providerFailed || attempt === 3) break;
    await sleep(attempt * 30_000);
  }
  // The last answer, even when every attempt failed, so the record shows the real status code
  return { res, attempts };
}

// ---------------------------------------------------------------- generation

function caseSelected(c: EvalCase, filters: string[]) {
  return filters.length === 0 || filters.some((f) => c.id === f || c.id.startsWith(f));
}

async function runGeneration(runDir: string, results: any) {
  const caseFilters = list(process.env.EVAL_CASES);
  const models = list(process.env.EVAL_MODELS).length ? list(process.env.EVAL_MODELS) : [...EVAL_MODELS];
  const repeats = Math.max(1, Number(process.env.EVAL_REPEATS) || 1);
  const budget = Number(process.env.EVAL_BUDGET_USD) || 3;
  const cases = EVAL_CASES.filter((c) => caseSelected(c, caseFilters));

  for (const m of models) {
    if (!AI_PROVIDERS.some((p: any) => p.id === m)) throw new Error(`unknown model id ${m}`);
    if (!process.env[keyFor(m)]) throw new Error(`no key for ${m} (${keyFor(m)} is not set)`);
  }
  const save = () => fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2));

  // One worker per model, all in parallel; calls to the same provider are still spaced out by pace()
  const worker = async (modelId: string) => {
  for (let rep = 1; rep <= repeats; rep++) {
    for (const c of cases) {
      {
        const key = `${c.id}|${modelId}|${rep}`;
        if (results.records.some((r: any) => r.key === key)) continue; // resume support
        if (spentUsd >= budget) {
          results.records.push({ key, caseId: c.id, model: modelId, repeat: rep, skipped: 'budget' });
          continue;
        }
        const profile = getUseCaseProfile(c.targetType);
        const expectedModel = AI_PROVIDERS.find((p: any) => p.id === modelId)!.model;
        const rec: any = { key, caseId: c.id, targetType: c.targetType, profileId: profile.id, model: modelId, repeat: rep };

        // 1) clarifying questions
        const q = await callRoute(modelId, generateQuestions, { ideaText: c.idea, targetType: c.targetType });
        const qBody = q.res?.body;
        const usedFallback = JSON.stringify(qBody) === JSON.stringify(profile.fallbackQuestions);
        const lastQ = q.attempts.at(-1);
        rec.questions = {
          status: q.res?.statusCode ?? null,
          attempts: q.attempts.length,
          ms: lastQ?.ms,
          aiOk: lastQ?.calls?.some((x: any) => x.ok) ?? false,
          errorCode: lastQ?.calls?.find((x: any) => !x.ok)?.code,
          failReason: lastQ?.calls?.find((x: any) => !x.ok)?.reason,
          wrongModel: lastQ?.calls?.some((x: any) => x.ok && !String(x.model).includes(expectedModel)) ?? false,
          usedFallback,
          // the model answered but the answer was rejected (quality check / unparsable) and the built-in set was sent
          rejectedAfterAnswer: usedFallback && (lastQ?.calls?.some((x: any) => x.ok) ?? false),
          count: Array.isArray(qBody) ? qBody.length : 0,
          problems: Array.isArray(qBody) && !usedFallback ? checkQuestionQuality(qBody, profile.id, c.idea) : [],
          questions: usedFallback ? null : qBody,
          usage: lastQ?.calls?.find((x: any) => x.ok)?.usage,
        };

        // 2) synthesis with the role's built-in questions and fixed answers (same input for every model)
        const answers = Object.entries(c.answers).map(([questionId, value]) => ({ questionId, value }));
        const s = await callRoute(modelId, synthesize, {
          idea: { rawText: c.idea, targetType: c.targetType },
          answers,
          questions: profile.fallbackQuestions.map((x: any) => ({ id: x.id, questionText: x.questionText })),
        });
        const sBody = s.res?.body;
        const lastS = s.attempts.at(-1);
        rec.synthesis = {
          status: s.res?.statusCode ?? null,
          attempts: s.attempts.length,
          ms: lastS?.ms,
          aiCalls: lastS?.calls?.length ?? 0,
          repaired: (lastS?.calls?.length ?? 0) > 1,
          // a repair was tried but its AI call failed (the first answer was kept)
          repairFailed: (lastS?.calls?.length ?? 0) > 1 && lastS.calls.slice(1).every((x: any) => !x.ok),
          failReasons: (lastS?.calls ?? []).filter((x: any) => !x.ok).map((x: any) => x.reason).filter(Boolean),
          errorCode: sBody?.code ?? lastS?.calls?.find((x: any) => !x.ok)?.code,
          wrongModel: lastS?.calls?.some((x: any) => x.ok && !String(x.model).includes(expectedModel)) ?? false,
          validation: sBody?.useCaseProfile?.validation ?? null,
          missingSections: sBody?.useCaseProfile?.missingSections ?? [],
          flaggedTerms: sBody?.useCaseProfile?.flaggedTerms ?? [],
          truncated: Boolean(sBody?.truncated),
          chars: typeof sBody?.promptText === 'string' ? sBody.promptText.length : 0,
          promptText: sBody?.promptText ?? null,
          usage: lastS?.calls?.filter((x: any) => x.ok).map((x: any) => x.usage),
        };

        // 3) refine (first case of each role only)
        if (c.refine && typeof sBody?.promptText === 'string' && sBody.promptText.length > 0) {
          const f = await callRoute(modelId, refine, { currentPrompt: sBody.promptText.slice(0, 20_000), instruction: c.refine });
          const fBody = f.res?.body;
          rec.refine = {
            status: f.res?.statusCode ?? null,
            attempts: f.attempts.length,
            ms: f.attempts.at(-1)?.ms,
            errorCode: fBody?.code,
            changed: typeof fBody?.updatedMarkdown === 'string' && fBody.updatedMarkdown !== sBody.promptText,
            chars: typeof fBody?.updatedMarkdown === 'string' ? fBody.updatedMarkdown.length : 0,
            summary: fBody?.summary ?? null,
            updatedMarkdown: fBody?.updatedMarkdown ?? null,
          };
        }

        results.records.push(rec);
        results.spentUsdEstimate = Number(spentUsd.toFixed(4));
        save();
        console.log(
          `[eval] ${key}  questions=${rec.questions.status}${rec.questions.usedFallback ? '(fallback)' : ''}  synth=${rec.synthesis.status} ${rec.synthesis.validation ?? ''}${rec.synthesis.truncated ? ' CUT' : ''}${rec.synthesis.repaired ? ' repaired' : ''} ${rec.synthesis.chars}ch ${rec.synthesis.ms}ms  spent~$${spentUsd.toFixed(3)}`
        );
      }
    }
  }
  };
  await Promise.all(models.map((m) => worker(m)));
}

// ---------------------------------------------------------------- judge

/** Documents are shown to the judges up to this length (keeps a judge request under Groq's 8,000-token limit). */
const JUDGE_DOC_CHARS = 20_000;

function judgePrompt(rec: any, c: EvalCase) {
  const profile = getUseCaseProfile(c.targetType);
  const qa = profile.fallbackQuestions
    .map((q: any) => `- ${q.questionText}\n  Answer: ${Array.isArray(c.answers[q.id]) ? (c.answers[q.id] as string[]).join('; ') : c.answers[q.id] ?? '(none)'}`)
    .join('\n');
  const doc = String(rec.synthesis.promptText);
  const notes = [
    rec.synthesis.truncated ? 'the generator reported it was cut off at its length limit' : '',
    doc.length > JUDGE_DOC_CHARS ? `only the first ${JUDGE_DOC_CHARS} of ${doc.length} characters are shown; do not count the shortening against it` : '',
  ].filter(Boolean);
  const system = `You are a strict, fair, experienced reviewer of AI-generated prompt documents. A product called Bedrock turns a user's rough idea into a ready-to-use prompt document for a specific purpose ("role"). You score one document. You do not know which AI model wrote it. Be critical: most documents have flaws. Reply with ONLY a JSON object, no other text.`;
  const user = `ROLE: ${profile.name} - ${profile.description}

USER IDEA:
"""${c.idea}"""

THE USER'S ANSWERS TO CLARIFYING QUESTIONS:
${qa}

WHAT A GOOD DOCUMENT DOES WITH THIS IDEA:
${c.judgeNote}

DOCUMENT TO REVIEW${notes.length ? ` (NOTE: ${notes.join('; ')})` : ''}:
"""
${doc.slice(0, JUDGE_DOC_CHARS)}
"""

Score each criterion from 1 (very poor) to 5 (excellent):
- relevance: fits the idea and every answer above.
- specificity: concrete, tailored details instead of generic boilerplate.
- completeness: covers everything the target tool or person needs; nothing important missing, empty or cut off.
- rule_compliance: follows the role's rules (image/video prompts contain no code or programming; writing avoids AI cliches; no chatty preamble; no placeholders like TODO; clean, usable format).
- accuracy: no invented facts, statistics, studies, user numbers or wrong/outdated tool details.
- usefulness: could be used as-is in the target tool or given to the target person and work well.
- trap_handling: how well it handles what the note above describes as a trap; null if the note describes no trap.
Then:
- overall: 1-10 (10 = an expert would use it unchanged; 7 = good, small fixes; 5 = usable but generic or with clear gaps; 3 = poor; 1 = unusable or wrong).
- ship: true if you would show it to a paying user as-is.
- top_issues: up to 3 short, specific problems (empty list if none).
- verdict: one sentence.

JSON shape: {"relevance":n,"specificity":n,"completeness":n,"rule_compliance":n,"accuracy":n,"usefulness":n,"trap_handling":n|null,"overall":n,"ship":bool,"top_issues":["..."],"verdict":"..."}`;
  return { system, user };
}

/** The judge's JSON object: the whole reply, or the outermost {...} in it (handles ```json fences). */
function parseJudgeJson(text: string): any | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  for (const candidate of [cleaned, cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1)]) {
    try {
      const v = JSON.parse(candidate);
      if (v && typeof v === 'object' && typeof v.overall === 'number') return v;
    } catch {
      // try the next form
    }
  }
  return null;
}

/** Runs fn over items with `size` workers in parallel. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const run = async () => {
    while (i < items.length) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

type JudgeSpec = {
  name: string;
  kind: 'gemini' | 'chat';
  url?: string;
  keyEnv: string;
  model: string;
  extra?: Record<string, unknown>;
  priceKey: string;
  /** Waits for this judge's rate limit; returns a callback that takes the real token count. */
  before: (estimatedTokens: number) => Promise<(actual?: number) => void>;
};

/**
 * Judges. The plan was Gemini Flash; its free daily quota (20 requests) was used up on 2026-11-03, so the main
 * judge defaults to GPT-OSS-120B (Groq), and a model from a family that is NOT a contestant (NVIDIA Nemotron 3
 * Ultra, free on OpenRouter, about 50 requests a day) scores a sample as an independent check, which also shows
 * whether the main judge favours GPT-OSS documents. EVAL_JUDGE / EVAL_CROSS_JUDGE pick others (gemini, groq,
 * nemotron); EVAL_CROSS_JUDGE=0 turns the check off.
 */
const JUDGES: Record<string, JudgeSpec> = {
  groq: {
    name: 'GPT-OSS-120B (Groq, reasoning medium)',
    kind: 'chat',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
    model: 'openai/gpt-oss-120b',
    extra: { max_tokens: 3000, reasoning_effort: 'medium', include_reasoning: false, response_format: { type: 'json_object' } },
    priceKey: 'groq-judge',
    before: (est) => tpmReserve('openai/gpt-oss-120b', est + 1500),
  },
  nemotron: {
    name: 'NVIDIA Nemotron 3 Ultra 550B (OpenRouter, free)',
    kind: 'chat',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    keyEnv: 'OPENROUTER_API_KEY',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    extra: { max_tokens: 4000 },
    priceKey: 'free',
    before: async () => {
      await pace('openrouter-free');
      return () => {};
    },
  },
  lite: {
    name: 'Gemini Flash Lite',
    kind: 'gemini',
    keyEnv: 'GEMINI_API_KEY',
    model: 'gemini-flash-lite-latest',
    priceKey: 'gemini-flash-lite',
    before: async () => {
      await pace('gemini');
      return () => {};
    },
  },
  gemini: {
    name: 'Gemini Flash',
    kind: 'gemini',
    keyEnv: 'GEMINI_API_KEY',
    model: process.env.EVAL_JUDGE_MODEL || 'gemini-flash-latest',
    priceKey: 'judge',
    before: async () => {
      await pace('gemini');
      return () => {};
    },
  },
};
const MAIN_JUDGE = JUDGES[process.env.EVAL_JUDGE || 'groq'];
const CROSS_JUDGE = process.env.EVAL_CROSS_JUDGE === '0' ? null : JUDGES[process.env.EVAL_CROSS_JUDGE || 'nemotron'];

async function callJudge(spec: JudgeSpec, rec: any, c: EvalCase): Promise<any> {
  const key = process.env[spec.keyEnv];
  if (!key) return { error: `no ${spec.keyEnv} for the judge` };
  const { system, user } = judgePrompt(rec, c);
  let lastProblem = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const settle = await spec.before(Math.round((system.length + user.length) / 3.5));
    try {
      const res =
        spec.kind === 'gemini'
          ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent`, {
              method: 'POST',
              signal: AbortSignal.timeout(180_000),
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ parts: [{ text: user }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8000, responseMimeType: 'application/json' },
              }),
            })
          : await fetch(spec.url!, {
              method: 'POST',
              signal: AbortSignal.timeout(180_000),
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
              body: JSON.stringify({
                model: spec.model,
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
                temperature: 0.1,
                ...spec.extra,
              }),
            });
      if (!res.ok) {
        settle();
        lastProblem = `HTTP ${res.status}: ${(await res.text()).slice(0, 240)}`;
        if (res.status === 429 || res.status >= 500) {
          await sleep(attempt * 20_000);
          continue;
        }
        return { error: `judge HTTP ${res.status}`, lastProblem };
      }
      const data: any = await res.json();
      let text: string;
      if (spec.kind === 'gemini') {
        const u = data?.usageMetadata;
        addCost(spec.priceKey, u?.promptTokenCount ?? 6000, (u?.candidatesTokenCount ?? 600) + (u?.thoughtsTokenCount ?? 0));
        settle();
        text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
      } else {
        const u = data?.usage;
        addCost(spec.priceKey, u?.prompt_tokens ?? 6000, u?.completion_tokens ?? 1500);
        settle(u ? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0) : undefined);
        text = String(data?.choices?.[0]?.message?.content ?? '');
      }
      const parsed = parseJudgeJson(text);
      if (!parsed) {
        lastProblem = `unreadable reply (${text.length} chars): ${text.slice(0, 300)}`;
        await sleep(3000);
        continue;
      }
      return parsed;
    } catch (err: any) {
      settle();
      lastProblem = `exception: ${String(err?.message ?? err).slice(0, 200)}`;
      await sleep(attempt * 10_000);
    }
  }
  return { error: 'judge failed', lastProblem };
}

async function runJudge(runDir: string, results: any) {
  const budget = Number(process.env.EVAL_BUDGET_USD) || 3;
  const byId = new Map(EVAL_CASES.map((c) => [c.id, c]));
  const save = () => fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2));
  const judgeable = results.records.filter((r: any) => !r.skipped && r.synthesis?.status === 200 && r.synthesis?.promptText);
  results.judges = { main: MAIN_JUDGE.name, again: `${MAIN_JUDGE.name}, every 6th document a second time`, cross: CROSS_JUDGE ? `${CROSS_JUDGE.name}, every 4th document` : null };
  const crossEvery = Math.max(1, Number(process.env.EVAL_CROSS_EVERY) || 4);

  // Main judge on every document, while the independent judge works through its sample in parallel
  const main = pool(judgeable.filter((r: any) => !(r.judge && !r.judge.error)), 3, async (rec: any) => {
    if (spentUsd >= budget) return;
    rec.judge = await callJudge(MAIN_JUDGE, rec, byId.get(rec.caseId)!);
    results.spentUsdEstimate = Number(spentUsd.toFixed(4));
    save();
    console.log(`[judge] ${rec.key} overall=${rec.judge?.overall ?? rec.judge?.error}`);
  });
  // EVAL_CROSS_KEYS_FROM=<other results.json>: the independent judge scores exactly the documents (case + model) it
  // scored in that run, so before/after pairs are compared by the same independent judge
  const crossKeysFrom = process.env.EVAL_CROSS_KEYS_FROM;
  const crossKeys = crossKeysFrom
    ? new Set<string>(JSON.parse(fs.readFileSync(crossKeysFrom, 'utf8')).records.filter((r: any) => typeof r.judgeX?.overall === 'number').map((r: any) => r.key))
    : null;
  const crossPick = (r: any, i: number) => (crossKeys ? crossKeys.has(r.key) : i % crossEvery === 0);
  if (crossKeys && results.judges.cross) results.judges.cross = `${CROSS_JUDGE?.name}, the same documents as in ${crossKeysFrom}`;
  const cross = CROSS_JUDGE
    ? pool(judgeable.filter(crossPick).filter((r: any) => !(r.judgeX && !r.judgeX.error)), 1, async (rec: any) => {
        if (spentUsd >= budget) return;
        rec.judgeX = await callJudge(CROSS_JUDGE, rec, byId.get(rec.caseId)!);
        save();
        console.log(`[judgeX] ${rec.key} overall=${rec.judgeX?.overall ?? rec.judgeX?.error}`);
      })
    : Promise.resolve();
  await main;

  // Consistency: the main judge scores every 6th document a second time
  await pool(judgeable.filter((_: any, i: number) => i % 6 === 0).filter((r: any) => !(r.judge2 && !r.judge2.error)), 2, async (rec: any) => {
    if (spentUsd >= budget) return;
    rec.judge2 = await callJudge(MAIN_JUDGE, rec, byId.get(rec.caseId)!);
    save();
    console.log(`[judge2] ${rec.key} overall=${rec.judge2?.overall ?? rec.judge2?.error} (first ${rec.judge?.overall})`);
  });
  await cross;
  save();
}

// ---------------------------------------------------------------- summary

function avg(xs: number[]) {
  const v = xs.filter((x) => typeof x === 'number' && Number.isFinite(x));
  return v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) : null;
}
function pct(n: number, d: number) {
  return d ? Math.round((100 * n) / d) : null;
}
function median(xs: number[]) {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

function summarize(results: any) {
  const recs = results.records.filter((r: any) => !r.skipped);
  const group = (keyFn: (r: any) => string) => {
    const out: Record<string, any> = {};
    for (const r of recs) (out[keyFn(r)] ??= []).push(r);
    return Object.fromEntries(
      Object.entries(out).map(([k, rs]: [string, any[]]) => {
        const judged = rs.filter((r) => typeof r.judge?.overall === 'number');
        const crit = (name: string) => avg(judged.map((r) => r.judge[name]));
        return [
          k,
          {
            runs: rs.length,
            synthOk: pct(rs.filter((r) => r.synthesis?.status === 200).length, rs.length),
            validationPassed: pct(rs.filter((r) => r.synthesis?.validation === 'passed').length, rs.length),
            repaired: pct(rs.filter((r) => r.synthesis?.repaired).length, rs.length),
            flaggedTerms: pct(rs.filter((r) => (r.synthesis?.flaggedTerms ?? []).length > 0).length, rs.length),
            missingSections: rs
              .flatMap((r) => r.synthesis?.missingSections ?? [])
              .reduce((acc: Record<string, number>, s: string) => ((acc[s] = (acc[s] ?? 0) + 1), acc), {}),
            medianChars: median(rs.map((r) => r.synthesis?.chars).filter((n) => n > 0)),
            cutOff: pct(rs.filter((r) => r.synthesis?.truncated).length, rs.length),
            questionsFromModel: pct(rs.filter((r) => r.questions?.status === 200 && !r.questions?.usedFallback).length, rs.length),
            questionsRejected: pct(rs.filter((r) => r.questions?.rejectedAfterAnswer).length, rs.length),
            refineOk: pct(rs.filter((r) => r.refine?.status === 200).length, rs.filter((r) => r.refine).length),
            medianSynthMs: median(rs.map((r) => r.synthesis?.ms)),
            judged: judged.length,
            overall: avg(judged.map((r) => r.judge.overall)),
            ship: pct(judged.filter((r) => r.judge.ship === true).length, judged.length),
            relevance: crit('relevance'),
            specificity: crit('specificity'),
            completeness: crit('completeness'),
            rule_compliance: crit('rule_compliance'),
            accuracy: crit('accuracy'),
            usefulness: crit('usefulness'),
            trap_handling: crit('trap_handling'),
          },
        ];
      })
    );
  };
  const reJudged = recs.filter((r: any) => typeof r.judge?.overall === 'number' && typeof r.judge2?.overall === 'number');
  const crossJudged = recs.filter((r: any) => typeof r.judge?.overall === 'number' && typeof r.judgeX?.overall === 'number');
  const crossByModel: Record<string, any> = {};
  for (const r of crossJudged) (crossByModel[r.model] ??= []).push(r);
  return {
    runDir: results.runDir,
    spentUsdEstimate: results.spentUsdEstimate,
    totalRuns: recs.length,
    skipped: results.records.length - recs.length,
    overall: group(() => 'all').all,
    byModel: group((r) => r.model),
    byRole: group((r) => r.profileId),
    byRoleAndModel: group((r) => `${r.profileId} | ${r.model}`),
    byCase: group((r) => r.caseId),
    judgeConsistency: {
      pairs: reJudged.length,
      meanAbsDiffOverall: avg(reJudged.map((r: any) => Math.abs(r.judge.overall - r.judge2.overall))),
    },
    crossJudge: {
      judges: results.judges ?? null,
      pairs: crossJudged.length,
      meanAbsDiffOverall: avg(crossJudged.map((r: any) => Math.abs(r.judge.overall - r.judgeX.overall))),
      meanMain: avg(crossJudged.map((r: any) => r.judge.overall)),
      meanCross: avg(crossJudged.map((r: any) => r.judgeX.overall)),
      shipAgreement: pct(crossJudged.filter((r: any) => r.judge.ship === r.judgeX.ship).length, crossJudged.length),
      // Same documents, two judges: if the main judge rates its own model family relatively higher, that is self-preference
      byModel: Object.fromEntries(
        Object.entries(crossByModel).map(([m, rs]: [string, any]) => [
          m,
          { pairs: rs.length, main: avg(rs.map((r: any) => r.judge.overall)), cross: avg(rs.map((r: any) => r.judgeX.overall)) },
        ])
      ),
    },
    worst: recs
      .filter((r: any) => typeof r.judge?.overall === 'number')
      .sort((a: any, b: any) => a.judge.overall - b.judge.overall)
      .slice(0, 12)
      .map((r: any) => ({ key: r.key, overall: r.judge.overall, issues: r.judge.top_issues, verdict: r.judge.verdict })),
    failures: recs
      .filter((r: any) => r.synthesis?.status !== 200 || r.questions?.status !== 200 || (r.refine && r.refine.status !== 200))
      .map((r: any) => ({ key: r.key, questions: r.questions?.status, synthesis: r.synthesis?.status, synthCode: r.synthesis?.errorCode, refine: r.refine?.status, refineCode: r.refine?.errorCode })),
  };
}

// ---------------------------------------------------------------- run

describe('prompt quality evaluation (live AI calls)', () => {
  it('runs', async () => {
    loadProviderKeys();
    // Route warnings stay quiet, but are kept with the call they belong to (provider failure reasons)
    vi.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => {
      const store = als.getStore();
      if (store) (store.warnings ??= []).push(a.map(String).join(' ').slice(0, 300));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const phases = list(process.env.EVAL_PHASES).length ? list(process.env.EVAL_PHASES) : ['generate', 'judge', 'summary'];
    const runDir = process.env.EVAL_RUN_DIR || path.join(os.tmpdir(), 'bedrock-eval', new Date().toISOString().replace(/[:.]/g, '-'));
    fs.mkdirSync(runDir, { recursive: true });
    const file = path.join(runDir, 'results.json');
    const results = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { runDir, startedAt: new Date().toISOString(), records: [] as any[] };
    spentUsd = Number(results.spentUsdEstimate) || 0;
    console.log(`[eval] results in ${runDir}`);

    if (phases.includes('generate')) await runGeneration(runDir, results);
    if (phases.includes('judge')) await runJudge(runDir, results);
    if (phases.includes('summary')) {
      const summary = summarize(results);
      fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
      console.log(JSON.stringify({ overall: summary.overall, byModel: summary.byModel, byRole: summary.byRole, judgeConsistency: summary.judgeConsistency, crossJudge: summary.crossJudge, spent: summary.spentUsdEstimate }, null, 2));
    }
    expect(results.records.length).toBeGreaterThan(0);
  });
});
