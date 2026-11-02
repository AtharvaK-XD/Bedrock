import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const reserveQuota = vi.fn();
const releaseQuota = vi.fn();
const executeAiCompletion = vi.fn();
const authenticateRequest = vi.fn();
const enforceRateLimit = vi.fn(async (..._args: unknown[]) => true);
const recordExecutionTrace = vi.fn(async (..._args: unknown[]) => {});

vi.mock('../../_lib/auth.js', () => ({ authenticateRequest: (...a: unknown[]) => authenticateRequest(...a) }));
vi.mock('../../_lib/rateLimiter.js', () => ({
  enforceRateLimit: (...a: unknown[]) => enforceRateLimit(...a),
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
    recordExecutionTrace: (...a: unknown[]) => recordExecutionTrace(...a),
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
    recordExecutionTrace.mockClear();
    authenticateRequest.mockReset().mockResolvedValue(null);
    enforceRateLimit.mockReset().mockResolvedValue(true);
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
      executeAiCompletion.mockResolvedValue({ text: '[{"question":"Which runtime fits best?"},{"question":"Who will use it daily?"}]', model: 'm' });
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
        executeAiCompletion.mockResolvedValue({ text: '[{"question":"Which runtime fits best?"},{"question":"Who will use it daily?"}]', model: 'm' });
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

  describe('Phase 2: failed-call traces, real token counts, client disconnect', () => {
    const traces = () => recordExecutionTrace.mock.calls.map((c) => c[0] as any);
    const logLines = () =>
      [...(console.log as any).mock.calls, ...(console.error as any).mock.calls]
        .map((c: unknown[]) => String(c[0]))
        .filter((l: string) => l.includes('"type":"ai_request"'))
        .map((l: string) => JSON.parse(l));
    const aborted = () => new AiCompletionError('AI_CLIENT_ABORTED', 'The request was cancelled.');
    const failedWithModel = () => {
      const err = new AiCompletionError('AI_ALL_PROVIDERS_FAILED', 'All AI providers are busy or unavailable. Please try again shortly.');
      err.model = 'Groq LLaMA 3.1 8B';
      return err;
    };

    describe('a failed call is stored as an error trace (signed-in users only)', () => {
      it.each([
        ['synthesize', 'Wizard.synthesize', () => synthesize(mockReq({ idea: { rawText: 'an idea' } }), mockRes())],
        ['synthesize stream', 'Wizard.synthesize', () => synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), mockRes())],
        ['refine', 'RefineModal.refine', () => refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes())],
        ['test', 'Tester.test', () => testEndpoint(mockReq({ prompt: 'hello' }), mockRes())],
        ['generate-questions', 'Wizard.generateQuestions', () => generateQuestions(mockReq({ ideaText: 'an idea' }), mockRes())],
      ])('%s', async (_name, nodeOrigin, call) => {
        signIn();
        executeAiCompletion.mockRejectedValue(failedWithModel());
        await call();
        expect(traces()).toEqual([
          { userId: 'user_A', nodeOrigin, modelTarget: 'Groq LLaMA 3.1 8B', tokensUsed: 0, latencyMs: expect.any(Number), status: 'error' },
        ]);
        expect(releaseQuota).toHaveBeenCalledTimes(1);
      });

      it('a signed-out caller leaves no trace', async () => {
        executeAiCompletion.mockRejectedValue(failedWithModel());
        await synthesize(mockReq({ idea: { rawText: 'an idea' } }), mockRes());
        expect(traces()).toEqual([]);
      });

      it('an unexpected error with no model is still stored, as "unavailable"', async () => {
        signIn();
        executeAiCompletion.mockRejectedValue(new Error('something broke'));
        await refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes());
        expect(traces()[0]).toMatchObject({ modelTarget: 'unavailable', status: 'error' });
      });

      it('questions the model answered but that were unusable are stored with that model', async () => {
        signIn();
        executeAiCompletion.mockResolvedValue({ text: 'Sorry, I cannot do that.', model: 'Gemini Flash (gemini-flash-latest)' });
        const res = mockRes();
        await generateQuestions(mockReq({ ideaText: 'an idea' }), res);
        expect(res.statusCode).toBe(200); // the built-in questions
        expect(traces()).toEqual([expect.objectContaining({ modelTarget: 'Gemini Flash (gemini-flash-latest)', status: 'error', tokensUsed: 0 })]);
      });

      it('a cut-off refine is stored against the model that was cut off', async () => {
        signIn();
        executeAiCompletion.mockResolvedValue({ text: '<updated_prompt>half', model: 'Groq LLaMA 3.3 70B (llama-3.3-70b-versatile)', truncated: true });
        const res = mockRes();
        await refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), res);
        expect(res.statusCode).toBe(422);
        expect(traces()).toEqual([expect.objectContaining({ modelTarget: 'Groq LLaMA 3.3 70B (llama-3.3-70b-versatile)', status: 'error' })]);
      });
    });

    describe('the trace and the log carry the real token count when the provider sent one', () => {
      it('synthesize (JSON): counts the first call and the repair call', async () => {
        signIn();
        executeAiCompletion
          .mockResolvedValueOnce({ text: 'too short', model: 'm', usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 } })
          .mockResolvedValueOnce({ text: 'still too short', model: 'm', usage: { inputTokens: 90, outputTokens: 30, totalTokens: 120 } });
        await synthesize(mockReq({ idea: { rawText: 'an idea' } }), mockRes());
        expect(executeAiCompletion).toHaveBeenCalledTimes(2);
        expect(traces()[0]).toMatchObject({ tokensUsed: 260, status: 'success' });
        expect(logLines().find((l: any) => l.route === 'ai/synthesize')).toMatchObject({ inputTokens: 190, outputTokens: 70 });
      });

      it.each([
        ['synthesize stream', () => synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), mockRes())],
        ['refine', () => refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes())],
        ['test', () => testEndpoint(mockReq({ prompt: 'hello' }), mockRes())],
        ['generate-questions', () => generateQuestions(mockReq({ ideaText: 'an idea' }), mockRes())],
      ])('%s', async (_name, call) => {
        signIn();
        const text = '[{"question":"Which runtime fits best?"},{"question":"Who will use it daily?"}]<updated_prompt>new</updated_prompt>';
        executeAiCompletion.mockImplementation(async (_p: string, _s: string, _u: unknown, onToken?: (t: string) => void) => {
          onToken?.('x');
          return { text, model: 'm', usage: { inputTokens: 700, outputTokens: 300, totalTokens: 1000 } };
        });
        await call();
        expect(traces()[0]).toMatchObject({ tokensUsed: 1000, status: 'success' });
        expect(logLines().some((l: any) => l.inputTokens === 700 && l.outputTokens === 300)).toBe(true);
      });

      it('falls back to the old estimate when the provider sent no numbers', async () => {
        signIn();
        executeAiCompletion.mockResolvedValue({ text: 'a'.repeat(4000), model: 'm' });
        await testEndpoint(mockReq({ prompt: 'hello' }), mockRes());
        expect(traces()[0]).toMatchObject({ tokensUsed: 1000 }); // 4000 characters / 4
        expect(logLines()[0]).not.toHaveProperty('inputTokens');
      });
    });

    describe('when the client disconnects', () => {
      it.each([
        ['synthesize', () => synthesize(mockReq({ idea: { rawText: 'an idea' } }), mockRes())],
        ['refine', () => refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes())],
        ['test', () => testEndpoint(mockReq({ prompt: 'hello' }), mockRes())],
        ['generate-questions', () => generateQuestions(mockReq({ ideaText: 'an idea' }), mockRes())],
      ])('%s: no error trace, no refund, logged as "aborted" (not "error")', async (route, call) => {
        signIn();
        executeAiCompletion.mockRejectedValue(aborted());
        await call();
        expect(traces()).toEqual([]);
        expect(releaseQuota).not.toHaveBeenCalled();
        const line = logLines().find((l: any) => l.route === `ai/${route}`);
        expect(line).toMatchObject({ outcome: 'aborted', code: 'AI_CLIENT_ABORTED' });
        expect(logLines().some((l: any) => l.outcome === 'error')).toBe(false);
      });

      it('answers nothing (closes the response) instead of sending an error body', async () => {
        signIn();
        executeAiCompletion.mockRejectedValue(aborted());
        const res = mockRes();
        await synthesize(mockReq({ idea: { rawText: 'an idea' } }), res);
        expect(res.end).toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      });

      it.each([
        ['synthesize', () => synthesize(mockReq({ idea: { rawText: 'an idea' } }), mockRes())],
        ['synthesize stream', () => synthesize(mockReq({ idea: { rawText: 'an idea' }, stream: true }), mockRes())],
        ['refine', () => refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes())],
        ['test', () => testEndpoint(mockReq({ prompt: 'hello' }), mockRes())],
        ['generate-questions', () => generateQuestions(mockReq({ ideaText: 'an idea' }), mockRes())],
      ])('%s passes a cancel signal to the AI call', async (_name, call) => {
        signIn();
        executeAiCompletion.mockResolvedValue({ text: '[{"question":"Which runtime fits best?"},{"question":"Who will use it daily?"}]', model: 'm' });
        await call();
        const opts = executeAiCompletion.mock.calls[0][5];
        expect(opts.signal).toBeInstanceOf(AbortSignal);
        expect(opts.signal.aborted).toBe(false);
      });

      it('the signal fires when the response closes before it was finished, and not after a finished one', async () => {
        signIn();
        executeAiCompletion.mockResolvedValue({ text: 'answer', model: 'm' });

        // A response that closes early (client left)
        const leaving = mockRes();
        let closeHandler: () => void = () => {};
        leaving.on = vi.fn((event: string, handler: () => void) => {
          if (event === 'close') closeHandler = handler;
        });
        leaving.writableEnded = false;
        await testEndpoint(mockReq({ prompt: 'hello' }), leaving);
        const earlySignal: AbortSignal = executeAiCompletion.mock.calls[0][5].signal;
        expect(earlySignal.aborted).toBe(false);
        closeHandler();
        expect(earlySignal.aborted).toBe(true);

        // A response that finished normally ('close' also fires then)
        const finished = mockRes();
        finished.on = vi.fn((event: string, handler: () => void) => {
          if (event === 'close') closeHandler = handler;
        });
        finished.writableEnded = true;
        await testEndpoint(mockReq({ prompt: 'hello' }), finished);
        const lateSignal: AbortSignal = executeAiCompletion.mock.calls[1][5].signal;
        closeHandler();
        expect(lateSignal.aborted).toBe(false);
      });
    });
  });

  describe('Phase 3: question quality, one paid-tier rule', () => {
    const ask = async (body: Record<string, unknown>) => {
      const res = mockRes();
      await generateQuestions(mockReq(body), res);
      return res;
    };
    const answer = (questions: Array<Record<string, unknown>>) => executeAiCompletion.mockResolvedValue({ text: JSON.stringify(questions), model: 'm' });
    const good = [
      { question: 'Which lighting mood do you want?', type: 'single_select', options: ['Golden hour', 'Neon noir'] },
      { question: 'Which lens and framing should it use?', type: 'single_select', options: ['35mm wide', '85mm portrait'] },
    ];

    it('shows good questions, and falls back (refund + error trace) when one is too short to mean anything', async () => {
      signIn();
      answer(good);
      const ok = await ask({ ideaText: 'a lighthouse keeper at dusk', targetType: 'image-prompt' });
      expect(ok.body.map((x: any) => x.questionText)).toEqual(['Which lighting mood do you want?', 'Which lens and framing should it use?']);

      answer([good[0], { question: 'Why?', type: 'free_text' }]);
      const short = await ask({ ideaText: 'a lighthouse keeper at dusk', targetType: 'image-prompt' });
      expect(short.statusCode).toBe(200);
      expect(short.body).toEqual(getUseCaseProfile('image-prompt').fallbackQuestions);
      expect(releaseQuota).toHaveBeenCalledTimes(1);
      expect(recordExecutionTrace.mock.calls.at(-1)![0]).toMatchObject({ status: 'error', modelTarget: 'm' });
    });

    it('rejects coding questions for an image or video profile, but not when the idea itself is about code', async () => {
      const coding = [
        { question: 'Which React version should the scene use?', type: 'free_text' },
        { question: 'Which lighting mood do you want?', type: 'free_text' },
      ];
      answer(coding);
      const image = await ask({ ideaText: 'a lighthouse keeper at dusk', targetType: 'image-prompt' });
      expect(image.body).toEqual(getUseCaseProfile('image-prompt').fallbackQuestions);
      const video = await ask({ ideaText: 'a drone flight over a canyon', targetType: 'video-generation' });
      expect(video.body).toEqual(getUseCaseProfile('video-generation').fallbackQuestions);

      // the same questions are fine for a coding profile, and for a media idea that really is about React code
      expect((await ask({ ideaText: 'a todo app', targetType: 'coding-agent' })).body.map((x: any) => x.id)).toEqual(['q1', 'q2']);
      expect((await ask({ ideaText: 'a react component library demo reel', targetType: 'image-prompt' })).body[0].questionText).toContain('React');
    });

    it('rejects chatty filler inside a question', async () => {
      answer([good[0], { question: 'Sure, here is a question: what mood?', type: 'free_text' }]);
      const res = await ask({ ideaText: 'a lighthouse keeper at dusk', targetType: 'image-prompt' });
      expect(res.body).toEqual(getUseCaseProfile('image-prompt').fallbackQuestions);
    });

    it.each([
      ['pro', true],
      ['ultimate', true],
      ['advanced', true],
      ['free', false],
      [undefined, false],
    ])('paid plan %s gets the larger limit: %s (the same rule in all four AI routes)', async (tier, paid) => {
      authenticateRequest.mockResolvedValue({ ...signedInUser, subscriptionTier: tier });
      executeAiCompletion.mockResolvedValue({ text: 'ok', model: 'm' });
      for (const call of [
        () => synthesize(mockReq({ idea: { rawText: 'an idea' } }), mockRes()),
        () => refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes()),
        () => testEndpoint(mockReq({ prompt: 'hello' }), mockRes()),
        () => generateQuestions(mockReq({ ideaText: 'an idea' }), mockRes()),
      ]) {
        enforceRateLimit.mockClear();
        await call();
        expect(enforceRateLimit.mock.calls[0][4], `${tier}`).toBe(paid);
      }
    });

    it('a guest or signed-out caller is never paid', async () => {
      executeAiCompletion.mockResolvedValue({ text: 'ok', model: 'm' });
      authenticateRequest.mockResolvedValue({ ...signedInUser, subscriptionTier: 'pro', isGuest: true });
      await refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes());
      expect(enforceRateLimit.mock.calls[0][4]).toBe(false);
      enforceRateLimit.mockClear();
      authenticateRequest.mockResolvedValue(null);
      await refine(mockReq({ currentPrompt: 'p', instruction: 'i' }), mockRes());
      expect(enforceRateLimit.mock.calls[0][4]).toBe(false);
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
