import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../langfuse.js', () => ({ recordLangfuseGeneration: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../loadBalancer.js', async () => {
  const actual = await vi.importActual<typeof import('../loadBalancer.js')>('../loadBalancer.js');
  return {
    ...actual,
    selectOptimalProvider: vi.fn(async (c: any[]) => c[0]),
    recordProviderSuccess: vi.fn().mockResolvedValue(undefined),
    recordProviderFailure: vi.fn().mockResolvedValue(undefined),
  };
});

import { executeAiCompletion, AiCompletionError } from '../ai.js';

const okBody = (text: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: text } }] }),
});
const errBody = (status: number, body: string) => ({
  ok: false,
  status,
  text: async () => body,
});

describe('executeAiCompletion', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GROQ_API_KEY', 'test-key-not-real');
    vi.stubEnv('VITE_GROQ_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns text and model on success', async () => {
    fetchMock.mockResolvedValueOnce(okBody('hello world'));
    const result = await executeAiCompletion('p', 's');
    expect(result.text).toBe('hello world');
    expect(result.model).toContain('Groq');
  });

  it('retries once on a 503 from the same provider, then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(errBody(503, 'unavailable')).mockResolvedValueOnce(okBody('recovered'));
    const result = await executeAiCompletion('p', 's');
    expect(result.text).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient status such as 400', async () => {
    fetchMock.mockResolvedValue(errBody(400, 'bad request'));
    await expect(executeAiCompletion('p', 's')).rejects.toBeInstanceOf(AiCompletionError);
    // one attempt per provider in the Groq family; none repeated
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry on an error body that merely contains "503"', async () => {
    fetchMock.mockResolvedValue(errBody(400, 'request id 5031 invalid'));
    await expect(executeAiCompletion('p', 's')).rejects.toBeInstanceOf(AiCompletionError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never exposes upstream error bodies in the thrown message', async () => {
    fetchMock.mockResolvedValue(errBody(500, 'SECRET-UPSTREAM-DETAIL key=abc'));
    const err: any = await executeAiCompletion('p', 's').catch((e) => e);
    expect(err).toBeInstanceOf(AiCompletionError);
    expect(err.code).toBe('AI_ALL_PROVIDERS_FAILED');
    expect(err.message).not.toContain('SECRET-UPSTREAM-DETAIL');
    expect(err.message).not.toContain('GROQ_API_KEY');
  });

  it('reports a generic not-configured error without naming env vars', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const err: any = await executeAiCompletion('p', 's').catch((e) => e);
    expect(err.code).toBe('AI_NOT_CONFIGURED');
    expect(err.message).not.toMatch(/API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails fast with AI_DEADLINE_EXCEEDED when the budget is already spent', async () => {
    const err: any = await executeAiCompletion('p', 's', undefined, undefined, undefined, {
      deadlineAt: Date.now() + 500,
    }).catch((e) => e);
    expect(err.code).toBe('AI_DEADLINE_EXCEEDED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts a hung provider at the per-provider timeout and stays inside the overall budget', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            reject(e);
          });
        })
    );
    const start = Date.now();
    const pending = executeAiCompletion('p', 's').catch((e) => e);
    await vi.advanceTimersByTimeAsync(60_000);
    const err: any = await pending;

    expect(err).toBeInstanceOf(AiCompletionError);
    expect(Date.now() - start).toBeLessThanOrEqual(60_000);
    // 20 s timeout is not retried (AbortError), so each Groq model is tried at most once
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('does not retry or fail over once tokens were streamed to the client', async () => {
    const chunk = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
    let reads = 0;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => {
            if (reads++ === 0) return { done: false, value: chunk };
            const e: any = new Error('socket hang up');
            e.code = 'ECONNRESET';
            throw e;
          },
        }),
      },
    });
    const tokens: string[] = [];
    const err: any = await executeAiCompletion('p', 's', undefined, (t) => tokens.push(t)).catch((e) => e);

    expect(tokens).toEqual(['hi']);
    expect(err.code).toBe('AI_STREAM_INTERRUPTED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
