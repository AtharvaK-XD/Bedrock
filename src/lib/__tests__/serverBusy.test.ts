import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  readServerBusySeconds,
  serverBusyError,
  buildServerErrorFromPayload,
  readStructuredServerError,
  synthesizePrompt,
} from '../api';

const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('readServerBusySeconds', () => {
  it('uses retryAfterSeconds from a 503 body', async () => {
    expect(await readServerBusySeconds(res(503, { retryAfterSeconds: 15 }))).toBe(15);
  });

  it('falls back to the Retry-After header, then to 15 s', async () => {
    expect(await readServerBusySeconds(res(503, {}, { 'Retry-After': '30' }))).toBe(30);
    expect(await readServerBusySeconds(new Response('not json', { status: 503 }))).toBe(15);
  });

  it('caps very long waits at 300 s', async () => {
    expect(await readServerBusySeconds(res(503, { retryAfterSeconds: 99999 }))).toBe(300);
  });

  it('returns null for anything that is not a 503', async () => {
    expect(await readServerBusySeconds(res(500, { retryAfterSeconds: 15 }))).toBeNull();
    expect(await readServerBusySeconds(res(200, {}))).toBeNull();
  });

  it('leaves the original body readable', async () => {
    const r = res(503, { retryAfterSeconds: 15, message: 'busy' });
    await readServerBusySeconds(r);
    expect((await r.json()).message).toBe('busy');
  });
});

describe('serverBusyError', () => {
  it('is not treated as an API key problem by the pages', () => {
    const err = serverBusyError(15) as any;
    expect(err.isApiKeyError).toBe(false);
    expect(err.code).toBe('AI_BUSY');
    expect(err.statusCode).toBe(503);
    // Wizard/Result treat any message containing "api key" as a key error, so it must not appear
    expect(err.message.toLowerCase()).not.toContain('api key');
    expect(err.message).toContain('15 seconds');
  });
});

describe('buildServerErrorFromPayload & readStructuredServerError', () => {
  it('surfaces RATE_LIMITER_UNAVAILABLE (503) cleanly', async () => {
    const err = (await readStructuredServerError(
      res(503, { code: 'RATE_LIMITER_UNAVAILABLE', retryAfterSeconds: 30 })
    )) as any;
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('RATE_LIMITER_UNAVAILABLE');
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.message).toContain('30 seconds');
  });

  it('preserves 400 and 422 server error messages rather than masking as unavailable', async () => {
    const err400 = (await readStructuredServerError(
      res(400, { error: 'rawIdea is required' })
    )) as any;
    expect(err400.statusCode).toBe(400);
    expect(err400.message).toBe('rawIdea is required');

    const err422 = buildServerErrorFromPayload(
      { code: 'AI_OUTPUT_TRUNCATED', message: 'The result was too long to finish.' },
      422
    ) as any;
    expect(err422.statusCode).toBe(422);
    expect(err422.code).toBe('AI_OUTPUT_TRUNCATED');
    expect(err422.message).toContain('too long');
  });
});

describe('synthesizePrompt payload & SSE error handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('sends rawText alongside ideaText in /api/ai/synthesize body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      res(200, { promptText: '# Synthesized Prompt\nDone.' })
    );
    globalThis.fetch = fetchSpy as any;

    const out = await synthesizePrompt(
      { ideaText: 'a runner in snow', targetType: 'image_generation' },
      [{ questionId: 'q1', value: 'night' }],
      [{ id: 'q1', questionText: 'Lighting?', questionType: 'free_text' }]
    );

    expect(out).toContain('Synthesized Prompt');
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.idea.ideaText).toBe('a runner in snow');
    expect(body.idea.rawText).toBe('a runner in snow');
  });

  it('throws structured SSE error payload instead of masking as SERVER_UNAVAILABLE', async () => {
    const sseChunk = 'data: ' + JSON.stringify({
      error: 'Prompt synthesis failed on server',
      message: 'All AI providers are busy or unavailable. Please try again shortly.',
      code: 'AI_ALL_PROVIDERS_FAILED',
      retryAfterSeconds: 15,
    }) + '\n\ndata: [DONE]\n\n';
    const encoder = new TextEncoder();
    const bodyStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseChunk));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(bodyStream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    ) as any;

    await expect(
      synthesizePrompt(
        { ideaText: 'a runner in snow', targetType: 'image_generation' },
        [],
        [],
        () => {}
      )
    ).rejects.toMatchObject({
      code: 'AI_BUSY',
      statusCode: 503,
      retryAfterSeconds: 15,
    });
  });
});
