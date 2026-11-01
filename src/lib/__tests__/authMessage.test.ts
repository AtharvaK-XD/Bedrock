import { describe, expect, it } from 'vitest';
import { isTrustedAuthMessage } from '../authMessage';

const OWN = 'https://bedrock-steel.vercel.app';

describe('isTrustedAuthMessage', () => {
  it('accepts the sign-in popup message from Bedrock\'s own address', () => {
    expect(isTrustedAuthMessage('clerk-auth-complete', OWN, OWN)).toBe(true);
    expect(isTrustedAuthMessage('clerk-auth-complete', 'http://127.0.0.1:5173', 'http://127.0.0.1:5173')).toBe(true);
  });

  it('refuses the same text from another website or another port', () => {
    expect(isTrustedAuthMessage('clerk-auth-complete', 'https://evil.example', OWN)).toBe(false);
    expect(isTrustedAuthMessage('clerk-auth-complete', 'https://bedrock-steel.vercel.app.evil.example', OWN)).toBe(false);
    expect(isTrustedAuthMessage('clerk-auth-complete', 'http://127.0.0.1:9999', 'http://127.0.0.1:5173')).toBe(false);
    expect(isTrustedAuthMessage('clerk-auth-complete', 'null', OWN)).toBe(false);
    expect(isTrustedAuthMessage('clerk-auth-complete', '', OWN)).toBe(false);
  });

  it('refuses other messages and an unknown own address', () => {
    expect(isTrustedAuthMessage('something-else', OWN, OWN)).toBe(false);
    expect(isTrustedAuthMessage({ type: 'clerk-auth-complete' }, OWN, OWN)).toBe(false);
    expect(isTrustedAuthMessage('clerk-auth-complete', '', '')).toBe(false);
  });
});
