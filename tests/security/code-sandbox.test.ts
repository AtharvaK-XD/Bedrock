// Tests public/sandbox/code-runner.js (the script loaded inside the sandboxed iframe that runs
// workflow code nodes). The browser sandbox itself cannot run in Node; this checks the message
// contract and that output matches the old in-page runner.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../../public/sandbox/code-runner.js'), 'utf-8');

function loadRunner() {
  const posted: any[] = [];
  let handler: ((e: any) => void) | null = null;
  const parent = { postMessage: (msg: any) => posted.push(msg) };
  const win: any = { parent, addEventListener: (_t: string, fn: any) => { handler = fn; } };
  vm.runInNewContext(source, { window: win, JSON, String });
  const send = (data: any, source = parent) => handler!({ source, data });
  return { posted, send, parent };
}

describe('workflow code sandbox runner', () => {
  it('runs a script and formats objects like the old runner', () => {
    const { posted, send } = loadRunner();
    send({ type: 'bedrock-code-run', id: 'a', script: 'return input.toUpperCase();', input: 'hi' });
    send({ type: 'bedrock-code-run', id: 'b', script: 'return { n: input.length };', input: 'abc' });
    expect(posted).toEqual([
      { type: 'bedrock-code-result', id: 'a', ok: true, output: 'HI', error: undefined },
      { type: 'bedrock-code-result', id: 'b', ok: true, output: JSON.stringify({ n: 3 }, null, 2), error: undefined },
    ]);
  });

  it('reports script errors instead of throwing', () => {
    const { posted, send } = loadRunner();
    send({ type: 'bedrock-code-run', id: 'c', script: 'throw new Error("boom")', input: '' });
    expect(posted[0]).toMatchObject({ id: 'c', ok: false, error: 'boom' });
  });

  it('ignores messages that do not come from the embedding page or are malformed', () => {
    const { posted, send } = loadRunner();
    send({ type: 'bedrock-code-run', id: 'd', script: 'return 1' }, { postMessage() {} } as any);
    send({ type: 'other', id: 'e', script: 'return 1' });
    send({ type: 'bedrock-code-run', id: 5, script: 'return 1' });
    expect(posted).toHaveLength(0);
  });
});
