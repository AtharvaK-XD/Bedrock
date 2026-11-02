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

import {
  executeAiCompletion,
  AiCompletionError,
  stripReasoningText,
  createReasoningStreamFilter,
  AI_OUTPUT_BUDGET,
  refineOutputBudget,
  testOutputBudget,
  sumUsage,
  tokensForTrace,
} from '../ai.js';
import { recordProviderFailure } from '../loadBalancer.js';

/** Runs chunks through the stream filter and returns the joined output. */
function filterChunks(chunks: string[]): string {
  let out = '';
  const filter = createReasoningStreamFilter((t) => (out += t));
  for (const c of chunks) filter.push(c);
  filter.flush();
  return out;
}

describe('createReasoningStreamFilter (streamed answers)', () => {
  it('passes normal text through unchanged, including "<" and HTML-like tags', () => {
    const text = '  # Title\nUse a < b and <b>bold</b>, <thin> is not a tag, end with <';
    expect(filterChunks([text])).toBe(text);
    expect(filterChunks(text.split(''))).toBe(text);
  });

  it('removes think blocks even when the tags are split across chunks, in any letter case', () => {
    expect(filterChunks(['Hel', 'lo <th', 'ink>sec', 'ret</thi', 'nk> world'])).toBe('Hello  world');
    expect(filterChunks(['<THINK>', 'plan the answer', '</Think>\n\n# Final'])).toBe('# Final');
    expect(filterChunks(['A<think>x</think>B<think>y</think>C'])).toBe('ABC');
  });

  it('drops an unclosed think block (reasoning cut off) and keeps the answer before it', () => {
    expect(filterChunks(['Answer. ', '<think>still reason', 'ing'])).toBe('Answer. ');
    expect(filterChunks(['<think>only reasoning'])).toBe('');
  });

  it('gives the same answer as stripReasoningText for every way of splitting the text into two or three chunks', () => {
    const samples = [
      '<think>secret plan</think>\n# Prompt\nBody <b>ok</b>',
      'Intro <think>secret</think> middle <THINK>secret 2</THINK> end',
      'No reasoning at all, just a < and a >',
      'Answer first <think>secret cut off',
      '<think></think>Empty block',
    ];
    for (const s of samples) {
      const expected = stripReasoningText(s).trimStart();
      for (let i = 0; i <= s.length; i++) {
        expect(filterChunks([s.slice(0, i), s.slice(i)]).trimStart()).toBe(expected);
        const j = Math.min(s.length, i + 3);
        expect(filterChunks([s.slice(0, i), s.slice(i, j), s.slice(j)]).trimStart()).toBe(expected);
      }
      expect(filterChunks(s.split(''))).not.toContain('secret');
    }
  });
});

describe('stripReasoningText', () => {
  it('leaves normal text untouched', () => {
    expect(stripReasoningText('  # Title\nbody  ')).toBe('  # Title\nbody  ');
  });

  it('removes closed think blocks, including several', () => {
    expect(stripReasoningText('<think>a</think>Hello <THINK>b\nc</THINK>world')).toBe('Hello world');
  });

  it('drops everything after an unclosed think tag', () => {
    expect(stripReasoningText('Answer.\n<think>still reasoning when cut off')).toBe('Answer.\n');
    expect(stripReasoningText('<think>only reasoning')).toBe('');
  });
});

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
    // one attempt per provider in the Groq family (2 models since DeepSeek was removed); none repeated
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on an error body that merely contains "503"', async () => {
    fetchMock.mockResolvedValue(errBody(400, 'request id 5031 invalid'));
    await expect(executeAiCompletion('p', 's')).rejects.toBeInstanceOf(AiCompletionError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('strips <think> reasoning blocks from the returned answer', async () => {
    fetchMock.mockResolvedValueOnce(okBody('<think>private chain of thought</think>\n# Final prompt'));
    const result = await executeAiCompletion('p', 's');
    expect(result.text).toBe('# Final prompt');
  });

  /** A provider SSE stream (Groq/OpenAI format) sending the given deltas, optionally breaking afterwards. */
  const sseBody = (deltas: string[], breakAfter = false) => {
    const enc = new TextEncoder();
    let next = 0;
    return {
      ok: true,
      status: 200,
      // One chunk per read, so every delta is really read before the stream breaks
      // (controller.error() would otherwise discard chunks still in the queue)
      body: new ReadableStream({
        pull(controller) {
          if (next < deltas.length) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: deltas[next++] } }] })}\n\n`));
          } else if (breakAfter) {
            controller.error(new Error('stream broke'));
          } else {
            controller.enqueue(enc.encode('data: [DONE]\n\n'));
            controller.close();
          }
        },
      }),
    };
  };

  it('never streams <think> reasoning to the client, even when the tags arrive split', async () => {
    fetchMock.mockResolvedValueOnce(sseBody(['<thi', 'nk>private chain', ' of thought</th', 'ink>\n# Final', ' prompt']));
    const streamed: string[] = [];
    const result = await executeAiCompletion('idea', 'system', undefined, (t) => streamed.push(t));

    expect(streamed.join('')).toBe('# Final prompt');
    expect(streamed.join('')).not.toContain('private');
    expect(result.text).toBe('# Final prompt');
  });

  it('can still fail over when a provider broke while it was only thinking (nothing reached the client)', async () => {
    fetchMock
      .mockResolvedValueOnce(sseBody(['<think>reasoning that never ends'], true))
      .mockResolvedValueOnce(sseBody(['Answer from ', 'the next model']));
    const streamed: string[] = [];
    const result = await executeAiCompletion('idea', 'system', undefined, (t) => streamed.push(t));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(streamed.join('')).toBe('Answer from the next model');
    expect(result.text).toBe('Answer from the next model');
  });

  it('still refuses to fail over once real answer text was streamed (it would be sent twice)', async () => {
    fetchMock
      .mockResolvedValueOnce(sseBody(['Visible start '], true))
      .mockResolvedValueOnce(sseBody(['should not be used']));
    await expect(executeAiCompletion('idea', 'system', undefined, () => {})).rejects.toMatchObject({ code: 'AI_STREAM_INTERRUPTED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never returns a provider "reasoning" field as the answer', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '', reasoning: 'internal notes' } }] }) })
      .mockResolvedValueOnce(okBody('real answer'));
    const result = await executeAiCompletion('p', 's');
    expect(result.text).toBe('real answer');
  });

  it('sends Langfuse only model, timing and sizes, never the prompt or the answer', async () => {
    const { recordLangfuseGeneration } = await import('../langfuse.js');
    const record = vi.mocked(recordLangfuseGeneration);
    record.mockClear();
    fetchMock.mockResolvedValueOnce(okBody('ANSWER-TEXT-123'));
    await executeAiCompletion('USER-PROMPT-TEXT', 'SYSTEM-PROMPT-TEXT', 'user_1');

    expect(record).toHaveBeenCalledTimes(1);
    const sent = record.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('input');
    expect(sent).not.toHaveProperty('output');
    const serialized = JSON.stringify(sent);
    expect(serialized).not.toContain('USER-PROMPT-TEXT');
    expect(serialized).not.toContain('SYSTEM-PROMPT-TEXT');
    expect(serialized).not.toContain('ANSWER-TEXT-123');
    expect(sent.metadata).toMatchObject({ inputChars: expect.any(Number), outputChars: 'ANSWER-TEXT-123'.length });
  });

  it('reports only the error code to Langfuse when every provider fails', async () => {
    const { recordLangfuseGeneration } = await import('../langfuse.js');
    const record = vi.mocked(recordLangfuseGeneration);
    record.mockClear();
    fetchMock.mockResolvedValue(errBody(500, 'upstream echoed USER-PROMPT-TEXT'));
    await executeAiCompletion('USER-PROMPT-TEXT', 's').catch(() => {});

    const sent = record.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(sent.statusMessage).toBe('AI_ALL_PROVIDERS_FAILED');
    expect(JSON.stringify(sent)).not.toContain('USER-PROMPT-TEXT');
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

// ---------- Phase 1: output limits, cut-off answers, failover rules, server-only keys ----------

const chatBody = (text: string, finishReason = 'stop') => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: text }, finish_reason: finishReason }] }),
});
const geminiBody = (text: string, finishReason = 'STOP') => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }),
});
/** Provider SSE stream: the given deltas, then a last chunk carrying the finish reason. */
const chatStream = (deltas: string[], finishReason: string, lastChunkExtra: Record<string, unknown> = {}) => {
  const enc = new TextEncoder();
  const chunks = [
    ...deltas.map((d) => ({ choices: [{ delta: { content: d }, finish_reason: null }] })),
    { choices: [{ delta: {}, finish_reason: finishReason }], ...lastChunkExtra },
  ];
  let next = 0;
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      pull(controller) {
        if (next < chunks.length) controller.enqueue(enc.encode('data: ' + JSON.stringify(chunks[next++]) + '\n\n'));
        else {
          controller.enqueue(enc.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    }),
  };
};

describe('AI core: keys, output limits and failover rules', () => {
  const fetchMock = vi.fn();
  const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);
  const sentUrl = (call = 0) => String(fetchMock.mock.calls[call][0]);

  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(recordProviderFailure).mockClear();
    vi.stubGlobal('fetch', fetchMock);
    for (const name of ['GROQ', 'GEMINI', 'OPENROUTER']) {
      vi.stubEnv(name + '_API_KEY', '');
      vi.stubEnv('VITE_' + name + '_API_KEY', '');
    }
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key-not-real');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('never uses a VITE_ variable as a provider key (those belong to the browser bundle)', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('VITE_GROQ_API_KEY', 'secret-sitting-in-a-browser-variable');
    vi.stubEnv('VITE_GEMINI_API_KEY', 'secret-sitting-in-a-browser-variable');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'secret-sitting-in-a-browser-variable');
    await expect(executeAiCompletion('p', 's')).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the requested output limit to Groq and OpenRouter, and 3500 when none is given', async () => {
    fetchMock.mockResolvedValue(chatBody('ok'));
    await executeAiCompletion('p', 's', undefined, undefined, undefined, { maxOutputTokens: AI_OUTPUT_BUDGET.questions });
    expect(sentUrl()).toContain('api.groq.com');
    expect(sentBody().max_tokens).toBe(1200);

    await executeAiCompletion('p', 's');
    expect(sentBody(1).max_tokens).toBe(3500);

    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key-not-real');
    await executeAiCompletion('p', 's', undefined, undefined, undefined, { maxOutputTokens: 777 });
    expect(sentUrl(2)).toContain('openrouter.ai');
    expect(sentBody(2).max_tokens).toBe(777);
  });

  it('gives Gemini an output limit too (room for its hidden thinking tokens added), and sends no thinking setting', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key-not-real');
    fetchMock.mockResolvedValue(geminiBody('answer'));
    await executeAiCompletion('p', 's', undefined, undefined, undefined, { maxOutputTokens: 1200 });

    expect(sentUrl()).toContain('generativelanguage.googleapis.com');
    expect(sentBody().generationConfig.maxOutputTokens).toBe(1200 + 4096);
    expect(sentBody().generationConfig).not.toHaveProperty('thinkingConfig');
  });

  it('reports a cut-off answer (Groq length, Gemini MAX_TOKENS), and leaves the field out for normal answers', async () => {
    fetchMock.mockResolvedValueOnce(chatBody('half a doc', 'length'));
    expect(await executeAiCompletion('p', 's')).toMatchObject({ text: 'half a doc', truncated: true });

    fetchMock.mockResolvedValueOnce(chatBody('whole doc', 'stop'));
    const normal = await executeAiCompletion('p', 's');
    expect(normal.text).toBe('whole doc');
    expect(normal).not.toHaveProperty('truncated');

    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'gemini-test-key-not-real');
    fetchMock.mockResolvedValueOnce(geminiBody('half a doc', 'MAX_TOKENS'));
    expect(await executeAiCompletion('p', 's')).toMatchObject({ text: 'half a doc', truncated: true });
    fetchMock.mockResolvedValueOnce(geminiBody('whole doc', 'STOP'));
    expect(await executeAiCompletion('p', 's')).not.toHaveProperty('truncated');
  });

  it('reports a cut-off answer in a live stream too, using the last chunk', async () => {
    fetchMock.mockResolvedValueOnce(chatStream(['Part one, ', 'part two'], 'length'));
    const streamed: string[] = [];
    const result = await executeAiCompletion('p', 's', undefined, (t) => streamed.push(t));
    expect(streamed.join('')).toBe('Part one, part two');
    expect(result).toMatchObject({ text: 'Part one, part two', truncated: true });

    fetchMock.mockResolvedValueOnce(chatStream(['All done'], 'stop'));
    expect(await executeAiCompletion('p', 's', undefined, () => {})).not.toHaveProperty('truncated');
  });

  describe('failover', () => {
    beforeEach(() => {
      vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key-not-real');
    });

    it('a request refused for its own content (400) moves on without counting against the provider', async () => {
      fetchMock.mockResolvedValueOnce(errBody(400, 'prompt is too long for this model')).mockResolvedValueOnce(chatBody('fine'));
      const result = await executeAiCompletion('p', 's');
      expect(result.text).toBe('fine');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(recordProviderFailure).not.toHaveBeenCalled();
    });

    it('a server error counts against the provider, as not rate limited', async () => {
      fetchMock.mockResolvedValueOnce(errBody(500, 'internal error')).mockResolvedValueOnce(chatBody('fine'));
      await executeAiCompletion('p', 's');
      expect(recordProviderFailure).toHaveBeenCalledTimes(1);
      expect(recordProviderFailure).toHaveBeenCalledWith('groq-llama-70b', expect.stringContaining('500'), { rateLimited: false });
    });

    it('429 is read from the HTTP status: counted as a rate limit, and the sibling models of that key are skipped', async () => {
      fetchMock.mockResolvedValueOnce(errBody(429, 'slow down')).mockResolvedValueOnce(chatBody('fine'));
      await executeAiCompletion('p', 's');
      expect(recordProviderFailure).toHaveBeenCalledWith('groq-llama-70b', expect.any(String), { rateLimited: true });
      // The next attempt goes to another provider, not to the second Groq model that shares the key
      expect(sentUrl(1)).toContain('openrouter.ai');
    });

    it('a refused key (401) also skips the sibling models, without being called a rate limit', async () => {
      fetchMock.mockResolvedValueOnce(errBody(401, 'invalid api key')).mockResolvedValueOnce(chatBody('fine'));
      await executeAiCompletion('p', 's');
      expect(recordProviderFailure).toHaveBeenCalledWith('groq-llama-70b', expect.any(String), { rateLimited: false });
      expect(sentUrl(1)).toContain('openrouter.ai');
    });

    it('the digits 429 inside a 400 message do not look like a rate limit', async () => {
      fetchMock.mockResolvedValueOnce(errBody(400, 'request id 4291 rejected: 429 tokens over the context window')).mockResolvedValueOnce(chatBody('fine'));
      await executeAiCompletion('p', 's');
      // Next attempt is the second Groq model (not skipped), and nothing was counted against Groq
      expect(sentUrl(1)).toContain('api.groq.com');
      expect(recordProviderFailure).not.toHaveBeenCalled();
    });
  });
});

describe('output budgets', () => {
  it('refine: grows with the prompt (about 3 characters per token), within 2,500 and 8,000', () => {
    expect(refineOutputBudget(0)).toBe(2_500);
    expect(refineOutputBudget(3_000)).toBe(2_500);
    expect(refineOutputBudget(9_000)).toBe(4_500);
    expect(refineOutputBudget(20_000)).toBe(8_000);
    expect(refineOutputBudget(1_000_000)).toBe(8_000);
  });

  it('test route: uses the client value within 256 and 6,000, 3,500 otherwise', () => {
    expect(testOutputBudget(undefined)).toBe(3_500);
    expect(testOutputBudget('4096')).toBe(3_500);
    expect(testOutputBudget(NaN)).toBe(3_500);
    expect(testOutputBudget(4_096)).toBe(4_096);
    expect(testOutputBudget(99_999)).toBe(6_000);
    expect(testOutputBudget(1)).toBe(256);
    expect(testOutputBudget(-5)).toBe(256);
  });
});

// ---------- Phase 2: real token counts, Gemini key header, stopping when the client leaves ----------

describe('AI core Phase 2', () => {
  const fetchMock = vi.fn();
  const GEMINI_KEY = 'gemini-test-key-not-real';

  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(recordProviderFailure).mockClear();
    vi.stubGlobal('fetch', fetchMock);
    for (const name of ['GROQ', 'GEMINI', 'OPENROUTER']) {
      vi.stubEnv(name + '_API_KEY', '');
      vi.stubEnv('VITE_' + name + '_API_KEY', '');
    }
    vi.stubEnv('GROQ_API_KEY', 'groq-test-key-not-real');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('real token counts', () => {
    it('reads the provider\'s usage (Groq / OpenRouter style) and leaves it out when none is sent', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
        }),
      });
      expect(await executeAiCompletion('p', 's')).toMatchObject({ usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 } });

      fetchMock.mockResolvedValueOnce(chatBody('answer'));
      expect(await executeAiCompletion('p', 's')).not.toHaveProperty('usage');
    });

    it('reads usage from the last chunk of a live stream (usage or x_groq.usage)', async () => {
      fetchMock.mockResolvedValueOnce(chatStream(['Hel', 'lo'], 'stop', { x_groq: { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } } }));
      const viaGroq = await executeAiCompletion('p', 's', undefined, () => {});
      expect(viaGroq.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });

      fetchMock.mockResolvedValueOnce(chatStream(['Hi'], 'stop', { usage: { prompt_tokens: 3, completion_tokens: 2 } }));
      const viaUsage = await executeAiCompletion('p', 's', undefined, () => {});
      // total is worked out from the two parts when the provider does not send it
      expect(viaUsage.usage).toEqual({ inputTokens: 3, outputTokens: 2, totalTokens: 5 });
    });

    it('counts Gemini\'s hidden thinking tokens as output, because they are billed', async () => {
      vi.stubEnv('GROQ_API_KEY', '');
      vi.stubEnv('GEMINI_API_KEY', GEMINI_KEY);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'answer' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 7, thoughtsTokenCount: 3, totalTokenCount: 15 },
        }),
      });
      expect((await executeAiCompletion('p', 's')).usage).toEqual({ inputTokens: 5, outputTokens: 10, totalTokens: 15 });
    });

    it('ignores nonsense usage values instead of storing them', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 'many', completion_tokens: -4, total_tokens: null },
        }),
      });
      expect(await executeAiCompletion('p', 's')).not.toHaveProperty('usage');
    });

    it('sumUsage adds calls up and tokensForTrace prefers the real number', () => {
      expect(sumUsage(undefined, undefined)).toBeUndefined();
      expect(sumUsage({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }, undefined, { inputTokens: 10, outputTokens: 20, totalTokens: 30 })).toEqual({
        inputTokens: 11,
        outputTokens: 22,
        totalTokens: 33,
      });
      expect(tokensForTrace({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }, 999)).toBe(3);
      expect(tokensForTrace(undefined, 999)).toBe(999);
    });
  });

  describe('Gemini key', () => {
    beforeEach(() => {
      vi.stubEnv('GROQ_API_KEY', '');
      vi.stubEnv('GEMINI_API_KEY', GEMINI_KEY);
    });

    it('is sent in the x-goog-api-key header, never in the URL (non-stream and stream)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'answer' }] }, finishReason: 'STOP' }] }),
      });
      await executeAiCompletion('p', 's');
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('generateContent');
      expect(String(url)).not.toContain('key=');
      expect(String(url)).not.toContain(GEMINI_KEY);
      expect(init.headers['x-goog-api-key']).toBe(GEMINI_KEY);

      const enc = new TextEncoder();
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(enc.encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }) + '\n\n'));
            controller.close();
          },
        }),
      });
      await executeAiCompletion('p', 's', undefined, () => {});
      const [streamUrl, streamInit] = fetchMock.mock.calls[1];
      expect(String(streamUrl)).toContain('streamGenerateContent?alt=sse');
      expect(String(streamUrl)).not.toContain(GEMINI_KEY);
      expect(streamInit.headers['x-goog-api-key']).toBe(GEMINI_KEY);
    });

    it('is not leaked in the error that is thrown when Gemini fails', async () => {
      fetchMock.mockResolvedValue(errBody(500, 'upstream failure'));
      const error: any = await executeAiCompletion('p', 's').catch((e) => e);
      expect(error).toBeInstanceOf(AiCompletionError);
      expect(JSON.stringify(error.message)).not.toContain(GEMINI_KEY);
    });
  });

  describe('client disconnect', () => {
    /** A fetch that never answers on its own and rejects like the real one when its signal aborts. */
    const hangingFetch = () =>
      fetchMock.mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })), { once: true });
          })
      );

    it('stops the provider call, tries no other provider, and does not blame the provider', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', 'openrouter-test-key-not-real');
      hangingFetch();
      const client = new AbortController();
      const pending = executeAiCompletion('p', 's', undefined, undefined, undefined, { signal: client.signal });
      const outcome = pending.catch((e) => e);

      await new Promise((r) => setTimeout(r, 10));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      client.abort();

      const error: any = await outcome;
      expect(error).toBeInstanceOf(AiCompletionError);
      expect(error.code).toBe('AI_CLIENT_ABORTED');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(recordProviderFailure).not.toHaveBeenCalled();
    });

    it('does not start any call when the client is already gone', async () => {
      const client = new AbortController();
      client.abort();
      await expect(executeAiCompletion('p', 's', undefined, undefined, undefined, { signal: client.signal })).rejects.toMatchObject({ code: 'AI_CLIENT_ABORTED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('cleans up: a finished call leaves no listener on the client signal that could cancel a later call', async () => {
      fetchMock.mockResolvedValueOnce(chatBody('fine'));
      const client = new AbortController();
      const result = await executeAiCompletion('p', 's', undefined, undefined, undefined, { signal: client.signal });
      expect(result.text).toBe('fine');
      // aborting afterwards must not throw or change anything
      expect(() => client.abort()).not.toThrow();
    });

    it('works without a signal exactly as before', async () => {
      fetchMock.mockResolvedValueOnce(chatBody('fine'));
      expect((await executeAiCompletion('p', 's')).text).toBe('fine');
    });
  });

  describe('failed calls name the model that was tried last', () => {
    it('when every provider fails', async () => {
      fetchMock.mockResolvedValue(errBody(500, 'internal error'));
      const error: any = await executeAiCompletion('p', 's').catch((e) => e);
      expect(error.code).toBe('AI_ALL_PROVIDERS_FAILED');
      expect(error.model).toMatch(/Groq/);
    });
  });
});
