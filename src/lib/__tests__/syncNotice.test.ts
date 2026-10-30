import { describe, it, expect } from 'vitest';
import { describeSaveLimit, reportSyncProblem } from '../syncNotice';

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('describeSaveLimit', () => {
  it('explains the prompt limit on a 409 PROMPT_LIMIT_REACHED', async () => {
    const msg = await describeSaveLimit(jsonResponse(409, { code: 'PROMPT_LIMIT_REACHED' }));
    expect(msg).toContain('saved prompts');
  });

  it('explains the workflow limit on a 409 WORKFLOW_LIMIT_REACHED', async () => {
    const msg = await describeSaveLimit(jsonResponse(409, { code: 'WORKFLOW_LIMIT_REACHED' }));
    expect(msg).toContain('saved workflows');
  });

  it('stays quiet for other 409 codes and other statuses', async () => {
    expect(await describeSaveLimit(jsonResponse(409, { code: 'PROMPT_ID_CONFLICT' }))).toBeNull();
    expect(await describeSaveLimit(jsonResponse(500, { code: 'PROMPT_LIMIT_REACHED' }))).toBeNull();
    expect(await describeSaveLimit(jsonResponse(200, {}))).toBeNull();
  });

  it('does not throw when the body is not JSON', async () => {
    const res = new Response('nope', { status: 409 });
    expect(await describeSaveLimit(res)).toBeNull();
  });
});

describe('reportSyncProblem', () => {
  it('does nothing outside a browser', () => {
    expect(() => reportSyncProblem('x')).not.toThrow();
  });
});
