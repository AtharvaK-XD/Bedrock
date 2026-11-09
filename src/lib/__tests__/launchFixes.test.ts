import { describe, it, expect } from 'vitest';
import { parseQuotaResponse, quotaTitle, isQuotaCode } from '../quotaErrors';
import { replaceRetiredModel, isRetiredModel, groqModelExtras, GROQ_MAIN_MODEL, GROQ_FAST_MODEL } from '../retiredModels';
import { getPlanPrice, planPriceLabel } from '../pricing';
import { syncFailureMessage } from '../syncNotice';

function res(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('usage-limit messages', () => {
  it('shows the server message and offers an upgrade to free accounts only', async () => {
    const free = await parseQuotaResponse(res(429, { code: 'FREE_TIER_QUOTA_EXCEEDED', message: 'Free accounts can generate up to 10 prompts per 5 hours.' }));
    expect(free.message).toBe('Free accounts can generate up to 10 prompts per 5 hours.');
    expect(free.showUpgrade).toBe(true);

    const paid = await parseQuotaResponse(res(429, { code: 'PLAN_QUOTA_EXCEEDED', message: "You have reached your plan's limit of 500 prompts per 5 hours." }));
    expect(paid.showUpgrade).toBe(false);
    expect(paid.message).toContain('500 prompts per 5 hours');
  });

  it('never tells people to come back "tomorrow" when the server gave no message', async () => {
    const info = await parseQuotaResponse(res(429, {}));
    expect(info.message.toLowerCase()).not.toContain('tomorrow');
    expect(info.message).toContain('5 hours');
  });

  it('copes with an answer that is not JSON', async () => {
    const info = await parseQuotaResponse(new Response('<html>Too many requests</html>', { status: 429 }));
    expect(info.message.length).toBeGreaterThan(10);
  });

  it('recognises every limit code the backend sends, and nothing else', () => {
    for (const code of ['FREE_TIER_QUOTA_EXCEEDED', 'PLAN_QUOTA_EXCEEDED', 'AI_USAGE_LIMIT_EXCEEDED', 'ANONYMOUS_DAILY_LIMIT', 'RATE_LIMIT_EXCEEDED']) {
      expect(isQuotaCode(code)).toBe(true);
    }
    expect(isQuotaCode('SERVER_UNAVAILABLE')).toBe(false);
    expect(isQuotaCode(undefined)).toBe(false);
    expect(quotaTitle('PLAN_QUOTA_EXCEEDED')).toBe('Plan limit reached');
    expect(quotaTitle('ANONYMOUS_DAILY_LIMIT')).toBe('Sign in to continue');
  });

  it('tells people the service is briefly unavailable on a 503, and keeps other messages as they are', () => {
    expect(syncFailureMessage(res(503, {}), 'fallback')).toMatch(/briefly unavailable/);
    expect(syncFailureMessage(res(500, {}), 'fallback')).toBe('fallback');
  });
});

describe('retired Groq models', () => {
  it('swaps the three retired models for the current ones', () => {
    expect(replaceRetiredModel('llama-3.3-70b-versatile')).toBe(GROQ_MAIN_MODEL);
    expect(replaceRetiredModel('llama-3.1-8b-instant')).toBe(GROQ_FAST_MODEL);
    expect(replaceRetiredModel('deepseek-r1-distill-llama-70b')).toBe(GROQ_MAIN_MODEL);
    expect(isRetiredModel('llama-3.3-70b-versatile')).toBe(true);
  });

  it('leaves every other model alone', () => {
    expect(replaceRetiredModel('gpt-4o')).toBe('gpt-4o');
    expect(replaceRetiredModel('openai/gpt-oss-120b')).toBe('openai/gpt-oss-120b');
    expect(replaceRetiredModel(undefined)).toBeUndefined();
    expect(isRetiredModel('gemini-flash-latest')).toBe(false);
  });

  it('gives the gpt-oss models low reasoning, no reasoning text and 1,024 extra tokens', () => {
    expect(groqModelExtras('openai/gpt-oss-120b', 4096)).toEqual({ max_tokens: 5120, reasoning_effort: 'low', include_reasoning: false });
    expect(groqModelExtras('qwen/qwen3.8-27b', 4096)).toEqual({ max_tokens: 4096 });
  });
});

describe('plan prices', () => {
  it('formats USD and equivalent INR plan prices accurately', () => {
    expect(getPlanPrice('pro', 'USD')).toMatchObject({ base: '20', total: '20', totalSubunits: 2000, currency: 'USD', symbol: '$' });
    expect(getPlanPrice('ultimate', 'USD')).toMatchObject({ base: '50', total: '50', totalSubunits: 5000, currency: 'USD', symbol: '$' });
    expect(getPlanPrice('pro', 'INR')).toMatchObject({ base: '1,700', total: '1,700', totalSubunits: 170000, currency: 'INR', symbol: '₹' });
    expect(getPlanPrice('ultimate', 'INR')).toMatchObject({ base: '4,250', total: '4,250', totalSubunits: 425000, currency: 'INR', symbol: '₹' });
  });

  it('never produces the 100-paise Ultimate order that parsing "1,178.82" with parseFloat gave', () => {
    expect(getPlanPrice('ultimate', 'INR').totalPaise).toBeGreaterThan(100000);
  });

  it('has formatted labels for plan base prices in both currencies', () => {
    expect(planPriceLabel('pro', 'USD')).toBe('$20');
    expect(planPriceLabel('ultimate', 'USD')).toBe('$50');
    expect(planPriceLabel('pro', 'INR')).toBe('₹1,700');
    expect(planPriceLabel('ultimate', 'INR')).toBe('₹4,250');
  });
});
