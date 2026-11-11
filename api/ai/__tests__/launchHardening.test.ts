import { describe, it, expect, vi, beforeEach } from 'vitest';

// Launch review (2026-11-06): request shapes that used to crash the AI routes, the quota-refund rule, and the wording
// of the "limit reached" answers. Providers and the database are faked.
const reserveQuota = vi.fn();
const releaseQuota = vi.fn();
const executeAiCompletion = vi.fn();
const authenticateRequest = vi.fn();

vi.mock('../../_lib/auth.js', () => ({ authenticateRequest: (...a: unknown[]) => authenticateRequest(...a) }));
vi.mock('../../_lib/rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async () => true),
  getClientIp: vi.fn(() => '203.0.113.7'),
  getRedisClient: () => null,
}));
vi.mock('../../_lib/security.js', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/security.js')>('../../_lib/security.js');
  return {
    ...actual,
    reserveQuota: (...a: unknown[]) => reserveQuota(...a),
    releaseQuota: (...a: unknown[]) => releaseQuota(...a),
    recordExecutionTrace: vi.fn(async () => {}),
    checkPromptInjection: vi.fn(() => false),
  };
});
vi.mock('../../_lib/ai.js', async () => {
  const actual = await vi.importActual<typeof import('../../_lib/ai.js')>('../../_lib/ai.js');
  return { ...actual, executeAiCompletion: (...a: unknown[]) => executeAiCompletion(...a) };
});

import synthesize from '../synthesize.js';
import refine from '../refine.js';
import testEndpoint from '../test.js';
import generateQuestions from '../generate-questions.js';
import { AiCompletionError } from '../../_lib/ai.js';
import { sendQuotaDenied, type QuotaReservation } from '../../_lib/security.js';

const req = (body: unknown) => ({ method: 'POST', body, query: {}, headers: {} }) as any;
function res() {
  const r: any = { headersSent: false, statusCode: 200, body: undefined, written: [] as string[] };
  r.status = vi.fn((c: number) => ((r.statusCode = c), r));
  r.json = vi.fn((b: unknown) => ((r.body = b), r));
  r.setHeader = vi.fn();
  r.writeHead = vi.fn(() => (r.headersSent = true));
  r.write = vi.fn((s: string) => (r.written.push(s), true));
  r.end = vi.fn();
  return r;
}
const call = async (handler: (q: any, s: any) => unknown, body: unknown) => {
  const r = res();
  await handler(req(body), r);
  return r;
};

beforeEach(() => {
  reserveQuota.mockReset().mockResolvedValue({ allowed: true, unavailable: false, bucket: 'assist', limit: 100, resetMs: 1, reservationId: 'q1' });
  releaseQuota.mockReset().mockResolvedValue(undefined);
  executeAiCompletion.mockReset().mockResolvedValue({ text: '# Doc\n\nok', model: 'm' });
  authenticateRequest.mockReset().mockResolvedValue({ id: 'user_A', email: 'a@x.test', name: 'A', role: 'r', plan: 'Free', subscriptionTier: 'free', isGuest: false });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('request shapes that used to crash the AI routes answer 400, before any quota or model call', () => {
  it.each([
    ['test: prompt is a number', testEndpoint, { prompt: 42 }],
    ['test: systemPrompt is an object', testEndpoint, { prompt: 'hi', systemPrompt: { a: 1 } }],
    ['test: targetType is a list', testEndpoint, { prompt: 'hi', targetType: ['x'] }],
    ['questions: ideaText is an object', generateQuestions, { ideaText: { text: 'x' } }],
    ['questions: targetType is a number', generateQuestions, { ideaText: 'an idea', targetType: 7 }],
    ['refine: currentPrompt is a list', refine, { currentPrompt: ['a'], instruction: 'x' }],
    ['refine: instruction is a number', refine, { currentPrompt: 'a', instruction: 5 }],
    ['synthesize: rawText is a number', synthesize, { idea: { rawText: 123 } }],
    ['synthesize: targetType is an object', synthesize, { idea: { rawText: 'x', targetType: {} } }],
    ['synthesize: answers is not a list', synthesize, { idea: { rawText: 'x' }, answers: { q1: 'a' } }],
    ['synthesize: an answer is null', synthesize, { idea: { rawText: 'x' }, answers: [null] }],
    ['synthesize: an answer value is an object', synthesize, { idea: { rawText: 'x' }, answers: [{ questionId: 'q1', value: { a: 1 } }] }],
    ['synthesize: questions is a string', synthesize, { idea: { rawText: 'x' }, questions: 'q1' }],
    ['synthesize: a questionText is a number', synthesize, { idea: { rawText: 'x' }, questions: [{ id: 'q1', questionText: 9 }] }],
  ])('%s', async (_label, handler, body) => {
    const r = await call(handler as any, body);
    expect(r.statusCode).toBe(400);
    expect(typeof r.body.error).toBe('string');
    expect(reserveQuota).not.toHaveBeenCalled();
    expect(executeAiCompletion).not.toHaveBeenCalled();
  });

  it('synthesize accepts numbers and lists in answers, and an empty body field falls back to the alias', async () => {
    reserveQuota.mockResolvedValue({ allowed: true, unavailable: false, bucket: 'generation', limit: 10, resetMs: 1, reservationId: 'q1' });
    const r = await call(synthesize, {
      idea: { rawText: '' },
      rawText: 'a habit tracker',
      answers: [
        { questionId: 1, value: 42 },
        { questionId: 'q2', value: ['React', 'Vite'] },
        { questionId: 'q3' },
      ],
      questions: [{ id: 1, questionText: 'How many users?' }],
    });
    expect(r.statusCode).toBe(200);
    const userContent = executeAiCompletion.mock.calls[0][0] as string;
    expect(userContent).toContain('a habit tracker');
    expect(userContent).toContain('- How many users?: 42');
    expect(userContent).toContain('- q2: React, Vite');
  });

  it('synthesize accepts the frontend ideaText field inside idea (regression check)', async () => {
    reserveQuota.mockResolvedValue({ allowed: true, unavailable: false, bucket: 'generation', limit: 10, resetMs: 1, reservationId: 'q2' });
    const r = await call(synthesize, {
      idea: { ideaText: 'a runner in snow with coffee', targetType: 'image_generation' },
      answers: [],
      questions: [],
    });
    expect(r.statusCode).toBe(200);
    const userContent = executeAiCompletion.mock.calls[0][0] as string;
    expect(userContent).toContain('a runner in snow with coffee');
  });
});

describe('quota refund: only when no provider answered', () => {
  it('every provider failed -> refunded (test, refine, synthesize, questions)', async () => {
    executeAiCompletion.mockRejectedValue(new AiCompletionError('AI_ALL_PROVIDERS_FAILED', 'busy'));
    await call(testEndpoint, { prompt: 'hi' });
    await call(refine, { currentPrompt: 'p', instruction: 'i' });
    await call(synthesize, { idea: { rawText: 'x' } });
    await call(generateQuestions, { ideaText: 'x' });
    expect(releaseQuota).toHaveBeenCalledTimes(4);
  });

  it('a stream cut off by the provider before it finished -> refunded (nothing usable was delivered)', async () => {
    executeAiCompletion.mockRejectedValue(new AiCompletionError('AI_STREAM_INTERRUPTED', 'cut'));
    await call(synthesize, { idea: { rawText: 'x' }, stream: true });
    expect(releaseQuota).toHaveBeenCalledTimes(1);
  });

  it('the model answered but the answer was unusable -> NOT refunded (it was a paid call)', async () => {
    executeAiCompletion.mockResolvedValue({ text: 'not questions at all', model: 'm' });
    const q = await call(generateQuestions, { ideaText: 'x' });
    expect(q.statusCode).toBe(200); // the built-in questions
    executeAiCompletion.mockResolvedValue({ text: '<updated_prompt>half', model: 'm', truncated: true });
    const f = await call(refine, { currentPrompt: 'p', instruction: 'i' });
    expect(f.statusCode).toBe(422);
    expect(releaseQuota).not.toHaveBeenCalled();
  });

  it('a cancelled request is never refunded (start-and-cancel must not be free)', async () => {
    executeAiCompletion.mockRejectedValue(new AiCompletionError('AI_CLIENT_ABORTED', 'cancelled'));
    await call(testEndpoint, { prompt: 'hi' });
    expect(releaseQuota).not.toHaveBeenCalled();
  });
});

describe('refine never hands back the internal self-audit checklist', () => {
  it('strips it like a synthesized document', async () => {
    executeAiCompletion.mockResolvedValue({
      text: '<summary>s</summary><updated_prompt># Doc\n\nreal content\n\n### PRE-FLIGHT SILENT SELF-AUDIT (internal)\n1. did I?\n</updated_prompt>',
      model: 'm',
    });
    const r = await call(refine, { currentPrompt: '# Doc', instruction: 'tighten' });
    expect(r.statusCode).toBe(200);
    expect(r.body.updatedMarkdown).toContain('real content');
    expect(r.body.updatedMarkdown).not.toMatch(/SELF-AUDIT|did I\?/);
  });
});

describe('"limit reached" answers say what is true', () => {
  const quota = (bucket: 'generation' | 'assist', paid: boolean): QuotaReservation => ({
    allowed: false,
    unavailable: false,
    bucket,
    limit: paid ? (bucket === 'generation' ? 500 : 1000) : bucket === 'generation' ? 10 : 100,
    paid,
    resetMs: 1,
    reservationId: null,
  });

  it.each([
    ['generation', false, 'FREE_TIER_QUOTA_EXCEEDED', /10 prompts per 5 hours.*upgrade for a higher limit/],
    ['generation', true, 'PLAN_QUOTA_EXCEEDED', /plan's limit of 500 prompts per 5 hours/],
    ['assist', false, 'AI_USAGE_LIMIT_EXCEEDED', /limit of 100 AI requests per 5 hours.*upgrade for a higher limit/],
    ['assist', true, 'AI_USAGE_LIMIT_EXCEEDED', /plan's limit of 1000 AI requests per 5 hours/],
  ] as const)('%s, paid=%s', (bucket, paid, code, message) => {
    const r = res();
    sendQuotaDenied(r, quota(bucket, paid));
    expect(r.statusCode).toBe(429);
    expect(r.body.code).toBe(code);
    expect(r.body.message).toMatch(message);
    // Paid plans are not unlimited, and the website has no own-key option (CHG-0086)
    expect(r.body.message).not.toMatch(/unlimited|API key|Settings/i);
    if (paid) expect(r.body.message).not.toMatch(/upgrade|free/i);
  });
});
