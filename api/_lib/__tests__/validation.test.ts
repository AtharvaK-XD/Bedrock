import { describe, it, expect } from 'vitest';
import { validateSynthesisOutput } from '../validation.js';

const longBody = 'x'.repeat(200);

describe('validateSynthesisOutput lazy stubs', () => {
  it('reports a lazy stub as a forbidden_term issue instead of throwing', () => {
    const output = `# Title\n${longBody}\n// TODO: implement\n`;
    const result = validateSynthesisOutput(output, 'coding_agent', 'a todo app');

    expect(result.isValid).toBe(false);
    const stubIssue = result.issues.find((i) => i.message.includes('lazy placeholder stub'));
    expect(stubIssue).toBeDefined();
    expect(stubIssue?.type).toBe('forbidden_term');
    expect(stubIssue?.term).toBe('// todo: implement');
  });
});
