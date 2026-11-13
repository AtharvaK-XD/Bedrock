import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Launch-eve resilience (CHG-0158):
// 1. Every AI route counts its 50 s AI budget from the moment the request ARRIVED, so slow sign-in / quota checks
//    cannot push the request past Vercel's 60 s limit (before: only synthesize did this).
// 2. Usage traces are written after the answer (waitUntil): a database that never answers cannot hold back an answer
//    that was already paid for.
// 3. A stream whose answer was cut off says so in its final event: truncated: true plus a message.

const h = vi.hoisted(() => ({
  now: 1_000_000,
  reserveQuota: vi.fn(),
  releaseQuota: vi.fn(),
  executeAiCompletion: vi.fn(),
  authenticateRequest: vi.fn(),
  recordExecutionTrace: vi.fn(),
  waitUntil: vi.fn((_p: Promise<unknown>) => {}),
}));

vi.mock('@vercel/functions', () => ({ waitUntil: h.waitUntil }));
vi.mock('../../_lib/auth.js', () => ({ authenticateRequest: (...a: unknown[]) => h.authenticateRequest(...a) }));
vi.mock('../../_lib/rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async () => true),
  getClientIp: vi.fn(() => '203.0.113.7'),
  getRedisClient: () => null,
}));
vi.mock('../../_lib/db.js', () => ({ getDb: () => async () => [] }));
vi.mock('../../_lib/security.js', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/security.js')>('../../_lib/security.js');
  return {
    ...actual,
    reserveQuota: (...a: unknown[]) => h.reserveQuota(...a),
    releaseQuota: (...a: unknown[]) => h.releaseQuota(...a),
    sendQuotaDenied: vi.fn(),
    recordExecutionTrace: (...a: unknown[]) => h.recordExecutionTrace(...a),
    checkPromptInjection: vi.fn(() => false),
  };
});
vi.mock('../../_lib/ai.js', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/ai.js')>('../../_lib/ai.js');
  return { ...actual, executeAiCompletion: (...a: unknown[]) => h.executeAiCompletion(...a) };
});

import synthesize from '../synthesize.js';
import refine from '../refine.js';
import testEndpoint from '../test.js';
import generateQuestions from '../generate-questions.js';
import workflows from '../../workflows/index.js';
import { AiCompletionError, AI_DEFAULT_BUDGET_MS } from '../../_lib/ai.js';
import { afterResponse, TRUNCATED_ANSWER_MESSAGE } from '../../_lib/aiHttp.js';
import { getUseCaseProfile } from '../../_lib/useCaseProfiles.js';

const signedInUser = { id: 'user_A', email: 'a@example.com', name: 'A', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false };

function mockReq(body: Record<string, unknown>, query: Record<string, string> = {}) {
  return { method: 'POST', body, query, headers: {} } as any;
}

function mockRes() {
  const res: any = { headersSent: false, statusCode: 200, body: undefined, written: [] as string[], ended: false };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((b: unknown) => ((res.body = b), res));
  res.setHeader = vi.fn();
  res.writeHead = vi.fn(() => void (res.headersSent = true));
  res.write = vi.fn((s: string) => (res.written.push(s), true));
  res.end = vi.fn(() => void (res.ended = true));
  return res;
}

const sseEvents = (res: any) =>
  res.written
    .filter((l: string) => l.startsWith('data: ') && !l.includes('[DONE]'))
    .map((l: string) => JSON.parse(l.slice(6)));

/** Fails the test instead of hanging when a handler waits on something that never finishes. */
async function settlesQuickly(p: Promise<unknown>, ms = 2_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => (timer = setTimeout(() => resolve('timeout'), ms)));
  const outcome = await Promise.race([p.then(() => 'done' as const), timeout]);
  clearTimeout(timer);
  return outcome;
}

/** A database write that never answers. */
const never = () => new Promise<void>(() => {});

const VALID_QUESTIONS = JSON.stringify([
  { id: 'q1', questionText: 'Which platforms must the app support at launch?', questionType: 'multi_select', options: ['Web', 'iOS', 'Android'] },
  { id: 'q2', questionText: 'How should people sign in to the app?', questionType: 'single_select', options: ['Email', 'Google', 'GitHub'] },
  { id: 'q3', questionText: 'What data does the app need to store for each user?', questionType: 'free_text' },
]);

beforeEach(() => {
  h.now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => h.now);
  h.reserveQuota.mockReset().mockResolvedValue({ allowed: true, unavailable: false, bucket: 'assist', limit: 10, resetMs: 1, reservationId: 'q1' });
  h.releaseQuota.mockReset().mockResolvedValue(undefined);
  h.executeAiCompletion.mockReset();
  h.recordExecutionTrace.mockReset().mockResolvedValue(undefined);
  h.waitUntil.mockClear();
  // Signing in takes 8 s (cold database): that time must come out of the AI budget, not be added on top of it
  h.authenticateRequest.mockReset().mockImplementation(async () => {
    h.now += 8_000;
    return signedInUser;
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const deadlineOfCall = (i = 0) => (h.executeAiCompletion.mock.calls[i][5] as { deadlineAt?: number }).deadlineAt;

describe('the AI budget is counted from the request\'s arrival', () => {
  const arrivedAt = 1_000_000;

  it.each([
    ['synthesize', () => synthesize(mockReq({ idea: { rawText: 'an idea' } }), mockRes()), 'a long enough prompt document'],
    ['synthesize stream', () => synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), mockRes()), 'text'],
    ['refine', () => refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes()), '<updated_prompt>new</updated_prompt>'],
    ['test', () => testEndpoint(mockReq({ prompt: 'hello' }), mockRes()), 'hi'],
    ['test stream', () => testEndpoint(mockReq({ prompt: 'hello', stream: true }), mockRes()), 'hi'],
    ['generate-questions', () => generateQuestions(mockReq({ ideaText: 'an app' }), mockRes()), VALID_QUESTIONS],
  ])('%s', async (_name, call, text) => {
    h.executeAiCompletion.mockResolvedValue({ text, model: 'm' });
    await call();
    expect(h.executeAiCompletion).toHaveBeenCalled();
    // Before: test, refine and generate-questions started a fresh 50 s at the AI call (8 s too late here)
    expect(deadlineOfCall()).toBe(arrivedAt + AI_DEFAULT_BUDGET_MS);
  });

  it.each([
    ['generate', { description: 'Summarise an article, then translate it' }, '{"title":"t","nodes":[{"id":"a","type":"input","label":"In"}],"edges":[]}'],
    ['explain', { nodes: [{ id: 'a', type: 'input', data: { label: 'In' } }], edges: [] }, '{"summary":"s","steps":[]}'],
  ])('workflows %s', async (action, body, text) => {
    h.executeAiCompletion.mockResolvedValue({ text, model: 'm' });
    const res = mockRes();
    await workflows(mockReq(body, { action }), res);
    expect(h.executeAiCompletion).toHaveBeenCalled();
    expect(deadlineOfCall()).toBe(arrivedAt + AI_DEFAULT_BUDGET_MS);
  });
});

describe('usage traces never hold back the answer', () => {
  beforeEach(() => {
    // The trace insert never finishes (database stuck): with an awaited trace the handler would never answer
    h.recordExecutionTrace.mockImplementation(never);
  });

  it('synthesize (JSON): answers 200 and hands the trace to waitUntil', async () => {
    h.executeAiCompletion.mockResolvedValue({ text: 'x'.repeat(50), model: 'm', truncated: true });
    const res = mockRes();
    expect(await settlesQuickly(synthesize(mockReq({ idea: { rawText: 'an idea' } }), res))).toBe('done');
    expect(res.statusCode).toBe(200);
    expect(res.body.promptText).toBeTruthy();
    expect(h.recordExecutionTrace).toHaveBeenCalledTimes(1);
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('synthesize (stream): the final event and the end of the stream are sent', async () => {
    h.executeAiCompletion.mockImplementation(async (_p: string, _s: string, _u: unknown, onToken: (t: string) => void) => {
      onToken('# Title\n');
      return { text: '# Title\n', model: 'm' };
    });
    const res = mockRes();
    expect(await settlesQuickly(synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), res))).toBe('done');
    expect(sseEvents(res).find((e: any) => e.done)).toBeTruthy();
    expect(res.written.at(-1)).toBe('data: [DONE]\n\n');
    expect(res.ended).toBe(true);
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['test (JSON)', () => testEndpoint(mockReq({ prompt: 'hello' }), mockRes())],
    ['test (stream)', () => testEndpoint(mockReq({ prompt: 'hello', stream: true }), mockRes())],
    ['refine', () => refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes())],
    ['generate-questions', () => generateQuestions(mockReq({ ideaText: 'an app' }), mockRes())],
  ])('%s', async (name, call) => {
    h.executeAiCompletion.mockResolvedValue({ text: name === 'generate-questions' ? VALID_QUESTIONS : '<updated_prompt>new</updated_prompt>', model: 'm' });
    expect(await settlesQuickly(call())).toBe('done');
    expect(h.recordExecutionTrace).toHaveBeenCalledTimes(1);
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('a failed call: the error answer and the quota refund still go out', async () => {
    const err = new AiCompletionError('AI_ALL_PROVIDERS_FAILED', 'All AI providers are busy or unavailable. Please try again shortly.');
    err.model = 'm';
    h.executeAiCompletion.mockRejectedValue(err);
    const res = mockRes();
    expect(await settlesQuickly(testEndpoint(mockReq({ prompt: 'hello' }), res))).toBe('done');
    expect(res.statusCode).toBe(503);
    expect(h.releaseQuota).toHaveBeenCalledTimes(1);
    expect(h.recordExecutionTrace.mock.calls[0][0]).toMatchObject({ status: 'error', modelTarget: 'm' });
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('generate-questions: unusable questions fall back to the built-in ones without waiting on the trace', async () => {
    h.executeAiCompletion.mockResolvedValue({ text: 'not json at all', model: 'm' });
    const res = mockRes();
    expect(await settlesQuickly(generateQuestions(mockReq({ ideaText: 'an app' }), res))).toBe('done');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(getUseCaseProfile('coding-agent').fallbackQuestions);
  });
});

describe('a cut-off stream says so in its final event', () => {
  const streamOnce = (truncated: boolean) =>
    h.executeAiCompletion.mockImplementation(async (_p: string, _s: string, _u: unknown, onToken: (t: string) => void) => {
      onToken('partial');
      return { text: 'partial', model: 'm', ...(truncated ? { truncated: true } : {}) };
    });

  it.each([
    ['synthesize', () => mockReq({ idea: { rawText: 'an idea' }, stream: true }), synthesize],
    ['test', () => mockReq({ prompt: 'hello', stream: true }), testEndpoint],
  ] as const)('%s: truncated + message; the clients do not read it as an error', async (_name, req, handler) => {
    streamOnce(true);
    const res = mockRes();
    await handler(req(), res);
    const done = sseEvents(res).find((e: any) => e.done);
    expect(done).toMatchObject({ done: true, truncated: true, message: TRUNCATED_ANSWER_MESSAGE });
    // src/lib/api.ts and src/lib/callLLM.ts treat an event as a failure only with `error`, or `code` without `done`
    expect(done.error).toBeUndefined();
    expect(done.code).toBeUndefined();
    expect(res.written.at(-1)).toBe('data: [DONE]\n\n');
  });

  it.each([
    ['synthesize', () => mockReq({ idea: { rawText: 'an idea' }, stream: true }), synthesize],
    ['test', () => mockReq({ prompt: 'hello', stream: true }), testEndpoint],
  ] as const)('%s: a complete answer has neither field', async (_name, req, handler) => {
    streamOnce(false);
    const res = mockRes();
    await handler(req(), res);
    const done = sseEvents(res).find((e: any) => e.done);
    expect(done).not.toHaveProperty('truncated');
    expect(done).not.toHaveProperty('message');
  });
});

describe('afterResponse', () => {
  it('never throws, and a failing task is logged instead of becoming an unhandled rejection', async () => {
    const failing = Promise.reject(new Error('db down'));
    expect(() => afterResponse(failing)).not.toThrow();
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    expect(console.error).toHaveBeenCalledWith('[AI] Background bookkeeping failed:', 'db down');
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('keeps working when waitUntil itself throws', () => {
    h.waitUntil.mockImplementationOnce(() => {
      throw new TypeError('no request context');
    });
    expect(() => afterResponse(Promise.resolve())).not.toThrow();
  });
});
