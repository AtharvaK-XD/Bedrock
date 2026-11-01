import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import { getUseCaseProfile } from '../../_lib/useCaseProfiles.js';

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

const signedInUser = { id: 'user_A', email: 'a@example.com', name: 'A', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false };
const signIn = () => authenticateRequest.mockResolvedValue(signedInUser);

const failure = () => new AiCompletionError('AI_ALL_PROVIDERS_FAILED', 'All AI providers are busy or unavailable. Please try again shortly.');

describe('AI endpoints', () => {
  beforeEach(() => {
    reserveQuota.mockReset().mockResolvedValue({ allowed: true, unavailable: false, bucket: 'generation', limit: 10, resetMs: 1, reservationId: 'q1' });
    releaseQuota.mockReset().mockResolvedValue(undefined);
    executeAiCompletion.mockReset();
    authenticateRequest.mockReset().mockResolvedValue(null);
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

      signIn();
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
    it('synthesize JSON: busy providers give 503 + Retry-After with a generic message and code, quota refunded', async () => {
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
      expect(res.statusCode).toBe(503);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '15');
      expect(res.body.error).toBe('Prompt synthesis failed on server');
      expect(res.body.code).toBe('AI_ALL_PROVIDERS_FAILED');
      expect(res.body.retryAfterSeconds).toBe(15);
      expect(releaseQuota).toHaveBeenCalledTimes(1);
    });

    it('synthesize JSON: a deadline overrun is also reported as busy (503)', async () => {
      executeAiCompletion.mockRejectedValue(new AiCompletionError('AI_DEADLINE_EXCEEDED', 'The AI request took too long. Please try again.'));
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('AI_DEADLINE_EXCEEDED');
    });

    it('synthesize JSON: a missing server configuration stays a 500 without Retry-After', async () => {
      executeAiCompletion.mockRejectedValue(new AiCompletionError('AI_NOT_CONFIGURED', 'AI service is not available right now. Please try again later.'));
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
      expect(res.statusCode).toBe(500);
      expect(res.setHeader).not.toHaveBeenCalledWith('Retry-After', expect.anything());
      expect(res.body.retryAfterSeconds).toBeUndefined();
    });

    it('every AI response carries a request id; failures include it in the body', async () => {
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      await synthesize(mockReq({ idea: { rawText: 'an idea' } }, { 'x-vercel-id': 'bom1::abc-123' }), res);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'bom1::abc-123');
      expect(res.body.requestId).toBe('bom1::abc-123');
    });

    it('the structured log line never contains the user idea', async () => {
      const errorLog = vi.mocked(console.error);
      executeAiCompletion.mockRejectedValue(failure());
      await synthesize(mockReq({ idea: { rawText: 'MY-SECRET-STARTUP-IDEA' } }), mockRes());
      const line = errorLog.mock.calls.map((c) => c[0]).find((c) => typeof c === 'string' && c.includes('"type":"ai_request"'));
      expect(line).toBeDefined();
      expect(JSON.parse(line as string)).toMatchObject({ route: 'ai/synthesize', outcome: 'error', code: 'AI_ALL_PROVIDERS_FAILED' });
      expect(line).not.toContain('MY-SECRET-STARTUP-IDEA');
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
      expect(events).toContain('"retryAfterSeconds":15');
      expect(events.trim().endsWith('data: [DONE]')).toBe(true);
      expect(releaseQuota).toHaveBeenCalledTimes(1);
    });

    it('test SSE: a failure after headers closes the stream with an error event', async () => {
      reserveQuota.mockResolvedValue({ allowed: true, unavailable: false, bucket: 'assist', limit: 100, resetMs: 1, reservationId: 'q2' });
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      signIn();
      await testEndpoint(mockReq({ prompt: 'hello', stream: true }), res);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(res.written.join('')).toContain('"error":"Prompt test execution failed"');
    });

    it('refine: busy providers give 503 JSON with a generic message', async () => {
      reserveQuota.mockResolvedValue({ allowed: true, unavailable: false, bucket: 'assist', limit: 100, resetMs: 1, reservationId: 'q3' });
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      await refine(mockReq({ currentPrompt: 'p', instruction: 'make it shorter' }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('AI_ALL_PROVIDERS_FAILED');
    });

    it('test JSON: busy providers give 503 + Retry-After', async () => {
      reserveQuota.mockResolvedValue({ allowed: true, unavailable: false, bucket: 'assist', limit: 100, resetMs: 1, reservationId: 'q4' });
      executeAiCompletion.mockRejectedValue(failure());
      const res = mockRes();
      signIn();
      await testEndpoint(mockReq({ prompt: 'hello' }), res);
      expect(res.statusCode).toBe(503);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '15');
    });
  });

  describe('generate-questions output shape', () => {
    const ask = async () => {
      const res = mockRes();
      await generateQuestions(mockReq({ ideaText: 'a moody portrait of a lighthouse keeper', targetType: 'image-prompt' }), res);
      return res;
    };

    it('repairs a model answer that uses "question" / "type", so no card is blank', async () => {
      executeAiCompletion.mockResolvedValue({
        // What DeepSeek / Groq return when the prompt does not name the keys
        text: '```json\n[{"question":"Which visual style?","type":"single_select","options":["35mm film","Oil painting"]},{"question":"Which mood?","type":"multi_select","options":["Calm","Tense"]},{"question":"Any must-have details?","type":"free_text"}]\n```',
        model: 'm',
      });
      const res = await ask();

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([
        { id: 'q1', questionText: 'Which visual style?', questionType: 'single_select', options: ['35mm film', 'Oil painting'] },
        { id: 'q2', questionText: 'Which mood?', questionType: 'multi_select', options: ['Calm', 'Tense'] },
        { id: 'q3', questionText: 'Any must-have details?', questionType: 'free_text' },
      ]);
      expect(releaseQuota).not.toHaveBeenCalled();
    });

    it('passes a correctly shaped answer through unchanged', async () => {
      const good = [
        { id: 'q1', questionText: 'Which runtime?', questionType: 'single_select', options: ['Node 22', 'Bun'] },
        { id: 'q2', questionText: 'Constraints?', questionType: 'free_text' },
      ];
      executeAiCompletion.mockResolvedValue({ text: JSON.stringify(good), model: 'm' });
      expect((await ask()).body).toEqual(good);
    });

    it('sends the output schema to the model in the system prompt', async () => {
      executeAiCompletion.mockResolvedValue({ text: '[{"question":"A?"},{"question":"B?"}]', model: 'm' });
      await ask();
      const systemPrompt = executeAiCompletion.mock.calls[0][1] as string;
      expect(systemPrompt).toContain('"questionText"');
      expect(systemPrompt).toContain('"questionType"');
    });

    it('falls back to the built-in questions (and refunds the quota) when nothing usable came back', async () => {
      const profile = getUseCaseProfile('image-prompt');
      for (const text of ['[{"options":["a","b"]},{"id":"q2"}]', 'Sorry, I cannot help with that.', '[{"question":"Only one?"}]']) {
        releaseQuota.mockClear();
        executeAiCompletion.mockResolvedValue({ text, model: 'm' });
        const res = await ask();
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(profile.fallbackQuestions);
        expect(releaseQuota).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Phase 1: sign-in for the prompt tester, output limits, cut-off answers', () => {
    const options = (callIndex = 0) => executeAiCompletion.mock.calls[callIndex][5];
    const sseEvents = (res: any) =>
      res.written
        .map((l: string) => l.replace(/^data: /, '').trim())
        .filter((l: string) => l.startsWith('{'))
        .map((l: string) => JSON.parse(l));

    describe('POST /api/ai/test needs a signed-in account', () => {
      it('refuses a signed-out caller with 401 before any quota, rate limit or AI call', async () => {
        const res = mockRes();
        await testEndpoint(mockReq({ prompt: 'run this on your keys' }), res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toMatchObject({ code: 'AUTH_REQUIRED' });
        expect(typeof res.body.message).toBe('string');
        expect(reserveQuota).not.toHaveBeenCalled();
        expect(executeAiCompletion).not.toHaveBeenCalled();
      });

      it('lets a signed-in user and the local development guest through', async () => {
        executeAiCompletion.mockResolvedValue({ text: 'answer', model: 'm' });
        signIn();
        const user = mockRes();
        await testEndpoint(mockReq({ prompt: 'hello' }), user);
        expect(user.statusCode).toBe(200);

        authenticateRequest.mockResolvedValue({ ...signedInUser, id: 'usr_lead_architect_01', isGuest: true });
        const guest = mockRes();
        await testEndpoint(mockReq({ prompt: 'hello' }), guest);
        expect(guest.statusCode).toBe(200);
      });

      it('uses the answer length the client asks for, within 256 and 6,000 tokens (3,500 when it sends none)', async () => {
        executeAiCompletion.mockResolvedValue({ text: 'answer', model: 'm' });
        signIn();
        await testEndpoint(mockReq({ prompt: 'a', maxOutputTokens: 4096 }), mockRes());
        await testEndpoint(mockReq({ prompt: 'a', maxOutputTokens: 99999 }), mockRes());
        await testEndpoint(mockReq({ prompt: 'a', maxOutputTokens: 1 }), mockRes());
        await testEndpoint(mockReq({ prompt: 'a' }), mockRes());
        expect([0, 1, 2, 3].map((i) => options(i).maxOutputTokens)).toEqual([4096, 6000, 256, 3500]);
      });

      it('says so when the answer was cut off, and leaves the field out otherwise (JSON and stream)', async () => {
        signIn();
        executeAiCompletion.mockResolvedValueOnce({ text: 'cut', model: 'm', truncated: true });
        const cut = mockRes();
        await testEndpoint(mockReq({ prompt: 'a' }), cut);
        expect(cut.body.truncated).toBe(true);

        executeAiCompletion.mockResolvedValueOnce({ text: 'whole', model: 'm' });
        const whole = mockRes();
        await testEndpoint(mockReq({ prompt: 'a' }), whole);
        expect(whole.body).not.toHaveProperty('truncated');

        executeAiCompletion.mockImplementationOnce(async (_p: string, _s: string, _u: unknown, onToken: (t: string) => void) => {
          onToken('cut');
          return { text: 'cut', model: 'm', truncated: true };
        });
        const streamed = mockRes();
        await testEndpoint(mockReq({ prompt: 'a', stream: true }), streamed);
        expect(sseEvents(streamed).find((e: any) => e.done)).toMatchObject({ truncated: true });
      });
    });

    describe('output limits and cut-off answers on the other routes', () => {
      it('generate-questions asks for at most 1,200 tokens', async () => {
        executeAiCompletion.mockResolvedValue({ text: '[{"question":"A?"},{"question":"B?"}]', model: 'm' });
        await generateQuestions(mockReq({ ideaText: 'an idea' }), mockRes());
        expect(options().maxOutputTokens).toBe(1200);
      });

      it('refine: the limit grows with the prompt', async () => {
        executeAiCompletion.mockResolvedValue({ text: '<updated_prompt>new prompt</updated_prompt>', model: 'm' });
        await refine(mockReq({ currentPrompt: 'a'.repeat(9000), instruction: 'shorter' }), mockRes());
        await refine(mockReq({ currentPrompt: 'a'.repeat(600), instruction: 'shorter' }), mockRes());
        expect(options(0).maxOutputTokens).toBe(4500);
        expect(options(1).maxOutputTokens).toBe(2500);
      });

      it('refine: a rewrite cut off at the limit is refused (422), never returned in place of the user\'s prompt', async () => {
        executeAiCompletion.mockResolvedValue({ text: '<updated_prompt>half of the new prom', model: 'm', truncated: true });
        const res = mockRes();
        await refine(mockReq({ currentPrompt: 'the original prompt', instruction: 'expand it' }), res);

        expect(res.statusCode).toBe(422);
        expect(res.body).toMatchObject({ code: 'AI_OUTPUT_TRUNCATED' });
        expect(res.body).not.toHaveProperty('updatedMarkdown');
        expect(typeof res.body.message).toBe('string');
        expect(releaseQuota).toHaveBeenCalledTimes(1);
      });

      it('synthesize: asks for at most 4,000 tokens, and flags a cut-off answer without repairing it', async () => {
        executeAiCompletion.mockResolvedValue({ text: 'too short to be valid', model: 'm', truncated: true });
        const res = mockRes();
        await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body.truncated).toBe(true);
        expect(res.body.useCaseProfile.validation).toBe('warning');
        // A repair rewrite with the same limit would be cut off at the same place
        expect(executeAiCompletion).toHaveBeenCalledTimes(1);
        expect(options().maxOutputTokens).toBe(4000);
        expect(typeof options().deadlineAt).toBe('number');
      });

      it('synthesize: a normal answer has no truncated field; the repair call also gets the 4,000-token limit', async () => {
        executeAiCompletion.mockResolvedValue({ text: 'too short', model: 'm' });
        const res = mockRes();
        await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
        expect(res.body).not.toHaveProperty('truncated');
        expect(executeAiCompletion).toHaveBeenCalledTimes(2);
        expect(options(1).maxOutputTokens).toBe(4000);
      });

      it('synthesize stream: the final event says when the answer was cut off', async () => {
        executeAiCompletion.mockImplementation(async (_p: string, _s: string, _u: unknown, onToken: (t: string) => void) => {
          onToken('# Title\n');
          return { text: '# Title\n', model: 'm', truncated: true };
        });
        const res = mockRes();
        await synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), res);
        const done = sseEvents(res).find((e: any) => e.done);
        expect(done).toMatchObject({ truncated: true, validation: 'warning' });
      });
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
