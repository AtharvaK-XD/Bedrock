import { describe, expect, it } from 'vitest';
import { stringMatchesSomePattern } from '@sentry/core';
import { tracePropagationTargets } from '../sentryTargets';

// Sentry decides with stringMatchesSomePattern (strings match when the URL contains them), so use the same function
const gets = (url: string, origin?: string) => stringMatchesSomePattern(url, tracePropagationTargets(origin));

describe('Sentry trace header targets', () => {
  it('include Bedrock\'s own API', () => {
    expect(gets('/api/ai/synthesize')).toBe(true);
    expect(gets('https://bedrock-steel.vercel.app/api/health')).toBe(true);
    expect(gets('https://bedrockxai.com/api/health')).toBe(true);
    expect(gets('http://127.0.0.1:54321/api/prompts', 'http://127.0.0.1:54321')).toBe(true);
    expect(gets('https://bedrock-git-feature-x.vercel.app/api/prompts', 'https://bedrock-git-feature-x.vercel.app')).toBe(true);
  });

  it('exclude a local Ollama and other services', () => {
    for (const url of [
      'http://localhost:11434/api/generate',
      'http://127.0.0.1:11434/api/generate',
      'https://api.openai.com/v1/chat/completions',
      'https://api.groq.com/openai/v1/chat/completions',
      'https://generativelanguage.googleapis.com/v1beta/models',
      'https://us.i.posthog.com/e/',
      'https://some-stranger.vercel.app/api',
      'https://bedrock-steel.vercel.app.evil.example/api',
      'https://evil.example/?next=localhost',
    ]) {
      expect(gets(url, 'https://bedrock-steel.vercel.app'), url).toBe(false);
    }
  });

  it('does not let a file: or opaque origin add a target', () => {
    expect(tracePropagationTargets('null')).toHaveLength(3);
    expect(tracePropagationTargets('file://')).toHaveLength(3);
    expect(tracePropagationTargets(undefined)).toHaveLength(3);
  });
});
