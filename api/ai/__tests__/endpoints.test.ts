import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const reserveQuota = vi.fn();
const releaseQuota = vi.fn();
const executeAiCompletion = vi.fn();

vi.mock('../../_lib/auth.js', () => ({ authenticateRequest: vi.fn(async () => null) }));
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
    sendQuotaDenied: vi.fn(),
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

function mockReq(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return { method: 'POST', body, query: {}, headers } as any;
}

function mockRes() {
  const res: any = { headersSent: false, statusCode: 200, body: undefined, written: [] as string[] };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  });
  res.setHeader = vi.fn();
  res.writeHead = vi.fn(() => {
    res.headersSent = true;
  });
  res.write = vi.fn((s: string) => {
    res.written.push(s);
    return true;
  });
  res.end = vi.fn();
  return res;
}

const failure = () => new AiCompletionError('AI_ALL_PROVIDERS_FAILED', 'All AI providers are busy or unavailable. Please try again shortly.');

describe('AI endpoints', () => {
  beforeEach(() => {
    reserveQuota.mockReset().mockResolvedValue({ allowed: true, unavailable: false, bucket: 'generation', limit: 10, resetMs: 1, reservationId: 'q1' });
    releaseQuota.mockReset().mockResolvedValue(undefined);
    executeAiCompletion.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('input limits', () => {
    it('synthesize: 400 for an over-long idea, before any quota is reserved', async () => {
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'a'.repeat(4001) } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/rawIdea must be at most 4000/);
      expect(reserveQuota).not.toHaveBeenCalled();
      expect(executeAiCompletion).not.toHaveBeenCalled();
    });

    it('synthesize: 400 for an over-long answer and for too many answers', async () => {
      const long = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'ok' }, answers: [{ questionId: 'q', value: 'a'.repeat(1001) }] }), long);
      expect(long.statusCode).toBe(400);

      const many = mockRes();
      const answers = Array.from({ length: 31 }, (_, i) => ({ questionId: `q${i}`, value: 'x' }));
      await synthesize(mockReq({ idea: { rawText: 'ok' }, answers }), many);
      expect(many.statusCode).toBe(400);
      expect(reserveQuota).not.toHaveBeenCalled();
    });

    it('synthesize: accepts input exactly at the limit', async () => {
      executeAiCompletion.mockResolvedValue({ text: 'short', model: 'm' });
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'a'.repeat(4000) } }), res);
      expect(res.statusCode).toBe(200);
    });

    it('generate-questions, refine and test reject over-long input with 400', async () => {
      const q = mockRes();
      await generateQuestions(mockReq({ ideaText: 'a'.repeat(4001) }), q);
      expect(q.statusCode).toBe(400);

      const r1 = mockRes();
      await refine(mockReq({ currentPrompt: 'a'.repeat(20001), instruction: 'x' }), r1);
      expect(r1.statusCode).toBe(400);
      const r2 = mockRes();
      await refine(mockReq({ currentPrompt: 'x', instruction: 'a'.repeat(2001) }), r2);
      expect(r2.statusCode).toBe(400);

      const t1 = mockRes();
      await testEndpoint(mockReq({ prompt: 'a'.repeat(20001) }), t1);
      expect(t1.statusCode).toBe(400);
      const t2 = mockRes();
      await testEndpoint(mockReq({ prompt: 'x', systemPrompt: 'a'.repeat(10001) }), t2);
      expect(t2.statusCode).toBe(400);

      expect(reserveQuota).not.toHaveBeenCalled();
      expect(executeAiCompletion).not.toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('synthesize JSON: 500 with a generic message and code, quota refunded', async () => {
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Prompt synthesis failed on server');
      expect(res.body.code).toBe('AI_ALL_PROVIDERS_FAILED');
      expect(releaseQuota).toHaveBeenCalledTimes(1);
    });

    it('synthesize JSON: unexpected errors never leak their message', async () => {
      executeAiCompletion.mockRejectedValue(new Error('Groq API returned 401: sk-secret'));
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
      expect(res.statusCode).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain('sk-secret');
    });

    it('synthesize SSE: a failure after headers closes the stream with an error event instead of throwing', async () => {
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      await expect(
        synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), res)
      ).resolves.toBeUndefined();

      expect(res.status).not.toHaveBeenCalled();
      expect(res.end).toHaveBeenCalledTimes(1);
      const events = res.written.join('');
      expect(events).toContain('"error":"Prompt synthesis failed on server"');
      expect(events).toContain('"code":"AI_ALL_PROVIDERS_FAILED"');
      expect(events.trim().endsWith('data: [DONE]')).toBe(true);
      expect(releaseQuota).toHaveBeenCalledTimes(1);
    });

    it('test SSE: a failure after headers closes the stream with an error event', async () => {
      reserveQuota.mockResolvedValue({ allowed: true, unavailable: false, bucket: 'assist', limit: 100, resetMs: 1, reservationId: 'q2' });
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      await testEndpoint(mockReq({ prompt: 'hello', stream: true }), res);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(res.written.join('')).toContain('"error":"Prompt test execution failed"');
    });

    it('refine: 500 JSON with a generic message', async () => {
      reserveQuota.mockResolvedValue({ allowed: true, unavailable: false, bucket: 'assist', limit: 100, resetMs: 1, reservationId: 'q3' });
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      await refine(mockReq({ currentPrompt: 'p', instruction: 'make it shorter' }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.code).toBe('AI_ALL_PROVIDERS_FAILED');
    });
  });

  describe('synthesize streaming validation', () => {
    it('reports validation results and a sanitized promptText in the final event', async () => {
      executeAiCompletion.mockImplementation(async (_p: string, _s: string, _u: unknown, onToken: (t: string) => void) => {
        onToken('Sure, here is your prompt\n# Title\n');
        onToken('too short');
        return { text: 'Sure, here is your prompt\n# Title\ntoo short', model: 'm' };
      });
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), res);

      const done = res.written
        .map((l: string) => l.replace(/^data: /, '').trim())
        .filter((l: string) => l.startsWith('{') && l.includes('"done":true'))
        .map((l: string) => JSON.parse(l))[0];
      expect(done.validation).toBe('warning');
      expect(Array.isArray(done.missingSections)).toBe(true);
      expect(done.missingSections.length).toBeGreaterThan(0);
      expect(done.promptText).not.toMatch(/^Sure/);
      expect(res.written.join('')).toContain('data: [DONE]');
    });
  });

  describe('synthesize repair retry budget', () => {
    it('repairs once when there is time left', async () => {
      executeAiCompletion.mockResolvedValue({ text: 'too short', model: 'm' });
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
      expect(executeAiCompletion).toHaveBeenCalledTimes(2);
      // both calls share one deadline
      const d1 = executeAiCompletion.mock.calls[0][5].deadlineAt;
      const d2 = executeAiCompletion.mock.calls[1][5].deadlineAt;
      expect(d1).toBe(d2);
    });

    it('skips the repair call when less than 15 s of the request budget remains', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      executeAiCompletion.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + 40_000); // first call used 40 of the 50 s
        return { text: 'too short', model: 'm' };
      });
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
      expect(executeAiCompletion).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });
  });
});
