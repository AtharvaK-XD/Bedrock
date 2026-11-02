import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkQuestionShape, checkQuestionQuality, validateQuestionsOutput } from '../validation.js';
import { USE_CASE_PROFILES } from '../useCaseProfiles.js';

// checkQuestionShape replaced a zod schema (zod was about half the size of the largest AI routes).
// The rules are the same ones the schema had.

const q = (over: Record<string, unknown> = {}) => ({
  id: 'q1',
  questionText: 'Which runtime should it use?',
  questionType: 'single_select',
  options: ['Node 22', 'Bun'],
  ...over,
});
const two = [q(), q({ id: 'q2', questionType: 'free_text', options: undefined })];

const messages = (r: ReturnType<typeof checkQuestionShape>) => (r.ok ? [] : r.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)));

describe('checkQuestionShape', () => {
  it('accepts 2 to 6 well-formed questions and returns them unchanged', () => {
    const r = checkQuestionShape(two);
    expect(r).toEqual({ ok: true, data: two });
    expect(checkQuestionShape(Array.from({ length: 6 }, (_, i) => q({ id: `q${i}` }))).ok).toBe(true);
  });

  it('refuses fewer than 2 and more than 6', () => {
    expect(messages(checkQuestionShape([q()]))).toEqual(['Must generate at least 2 clarifying questions']);
    expect(messages(checkQuestionShape([]))).toEqual(['Must generate at least 2 clarifying questions']);
    expect(messages(checkQuestionShape(Array.from({ length: 7 }, (_, i) => q({ id: `q${i}` }))))).toEqual(['Must generate at most 6 clarifying questions']);
  });

  it('refuses anything that is not a list', () => {
    for (const bad of [null, undefined, 'text', 5, {}, { questions: two }]) {
      expect(checkQuestionShape(bad)).toMatchObject({ ok: false });
    }
  });

  it('says which question and which field is wrong', () => {
    const r = checkQuestionShape([q(), q({ id: '', questionText: 'short', questionType: 'slider', options: ['a', ''] })]);
    expect(messages(r)).toEqual([
      '1.id: Question ID must not be empty',
      '1.questionText: Question text must be at least 8 characters long',
      '1.questionType: Invalid option: expected one of "single_select"|"multi_select"|"free_text"',
      '1.options.1: Option must be a non-empty string',
    ]);
  });

  it('refuses items that are not objects, and options that are not a list', () => {
    expect(messages(checkQuestionShape([q(), 'a question', null]))).toEqual(['1: Expected a question object', '2: Expected a question object']);
    expect(messages(checkQuestionShape([q(), q({ options: 'a, b' })]))).toEqual(['1.options: Expected an array of options']);
  });

  it('the built-in fallback questions of every profile pass it (they are what users get when the model fails)', () => {
    for (const profile of Object.values(USE_CASE_PROFILES)) {
      expect(checkQuestionShape(profile.fallbackQuestions).ok, profile.id).toBe(true);
    }
  });
});

describe('validateQuestionsOutput', () => {
  it('accepts a clean answer, also inside a ```json fence or a { questions } wrapper', () => {
    const json = JSON.stringify(two);
    for (const raw of [json, '```json\n' + json + '\n```', JSON.stringify({ questions: two })]) {
      const r = validateQuestionsOutput(raw, 'coding-agent', 'a todo app');
      expect(r.isValid, raw.slice(0, 20)).toBe(true);
      expect(r.data).toEqual(two);
    }
  });

  it('finds the list inside surrounding text', () => {
    const r = validateQuestionsOutput('Here you go:\n' + JSON.stringify(two) + '\nHope this helps', 'coding-agent', 'a todo app');
    expect(r.data).toEqual(two);
  });

  it('reports empty, unparsable and wrongly shaped answers', () => {
    expect(validateQuestionsOutput('', 'coding-agent').issues[0].message).toBe('Questions response is empty');
    expect(validateQuestionsOutput('I cannot do that', 'coding-agent').issues[0].message).toBe('Output does not contain a JSON array of questions');

    const short = validateQuestionsOutput(JSON.stringify([q(), q({ questionText: 'tiny' })]), 'coding-agent');
    expect(short.isValid).toBe(false);
    expect(short.data).toBeUndefined();
    expect(short.issues.map((i) => i.message)).toContain('1.questionText: Question text must be at least 8 characters long');
  });
});

describe('checkQuestionQuality', () => {
  const fine = [
    { id: 'q1', questionText: 'Which lighting mood do you want?', questionType: 'single_select', options: ['Golden hour', 'Neon noir'] },
    { id: 'q2', questionText: 'Which lens and framing should it use?', questionType: 'free_text' },
  ];

  it('accepts good questions for every profile', () => {
    for (const id of Object.keys(USE_CASE_PROFILES)) {
      expect(checkQuestionQuality(fine, id, 'a lighthouse keeper'), id).toEqual([]);
    }
  });

  it('reports a wrong shape in plain words', () => {
    expect(checkQuestionQuality([fine[0]], 'writing')).toEqual(['Must generate at least 2 clarifying questions']);
    expect(checkQuestionQuality('not a list', 'writing')[0]).toMatch(/array/);
  });

  it('flags coding terms for image and video profiles only, and not when the idea is about code', () => {
    const coding = [fine[0], { ...fine[1], questionText: 'Which TypeScript framework should render it?' }];
    expect(checkQuestionQuality(coding, 'image-prompt', 'a lighthouse')[0]).toMatch(/coding term "typescript".*image-prompt/);
    expect(checkQuestionQuality(coding, 'video-generation', 'a lighthouse')[0]).toMatch(/video-generation/);
    expect(checkQuestionQuality(coding, 'coding-agent', 'a todo app')).toEqual([]);
    expect(checkQuestionQuality(coding, 'image-prompt', 'a typescript api demo')).toEqual([]);
  });

  it('flags filler, and its messages never copy the user\'s own text', () => {
    const chatty = [fine[0], { ...fine[1], questionText: 'Hope this helps: what framing do you want?' }];
    const reasons = checkQuestionQuality(chatty, 'writing', 'my secret launch plan');
    expect(reasons).toEqual(['contains conversational filler "hope this helps"']);
    expect(JSON.stringify(reasons)).not.toContain('secret');
  });
});

describe('dead code stays removed', () => {
  it('has no unused helpers or types left in the server files', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const text = (f: string) => readFileSync(path.join(root, f), 'utf8');
    expect(text('loadBalancer.ts')).not.toContain('getLoadBalancerMetrics');
    expect(text('aiPrompts.ts')).not.toContain('buildQuestionsSystemPrompt');
    for (const type of ['GenerateQuestionsParams', 'SynthesizeParams', 'RefineParams']) expect(text('ai.ts')).not.toContain(type);
  });
});

describe('server code stays free of zod', () => {
  // zod is about 440 KB: it made the synthesis and questions routes twice the size of the others for schemas
  // nothing ever ran. The website keeps its own zod copy under src/.
  it('no file under api/ imports it', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, name.name);
        if (name.isDirectory()) {
          if (name.name !== '__tests__') walk(full);
        } else if (/\.(ts|js|mjs)$/.test(name.name)) files.push(full);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((f) => /from\s+['"]zod['"]|require\(['"]zod['"]\)/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
