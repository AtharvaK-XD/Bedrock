import { describe, it, expect } from 'vitest';
import { normalizeQuestions, QUESTION_OUTPUT_FORMAT, QuestionsArraySchema, getUseCaseProfile, USE_CASE_PROFILES } from '../useCaseProfiles.js';

// The wizard shows blank cards when a model answers with its own key names ("question", "type").
// normalizeQuestions() repairs the answer; QUESTION_OUTPUT_FORMAT asks for the right keys in the first place.

describe('normalizeQuestions', () => {
  it('maps the usual wrong key names ("question", "type") to questionText / questionType', () => {
    const out = normalizeQuestions([
      { question: 'Which art style?', type: 'single_select', options: ['Film photo', 'Oil painting'] },
      { question: 'Which colors may it use?', type: 'multi_select', options: ['Warm', 'Cool', 'Neutral'] },
      { question: 'Anything else to include?', type: 'free_text' },
    ]);
    expect(out).toEqual([
      { id: 'q1', questionText: 'Which art style?', questionType: 'single_select', options: ['Film photo', 'Oil painting'] },
      { id: 'q2', questionText: 'Which colors may it use?', questionType: 'multi_select', options: ['Warm', 'Cool', 'Neutral'] },
      { id: 'q3', questionText: 'Anything else to include?', questionType: 'free_text' },
    ]);
  });

  it('leaves a correct answer unchanged', () => {
    const good = [
      { id: 'runtime', questionText: 'Which runtime?', questionType: 'single_select', options: ['Node 22', 'Bun'] },
      { id: 'notes', questionText: 'Any constraints?', questionType: 'free_text' },
    ];
    expect(normalizeQuestions(good)).toEqual(good);
  });

  it('takes the text from text / title / prompt / label too, and prefers questionText', () => {
    expect(normalizeQuestions([{ text: 'From text?' }])[0].questionText).toBe('From text?');
    expect(normalizeQuestions([{ title: 'From title?' }])[0].questionText).toBe('From title?');
    expect(normalizeQuestions([{ prompt: 'From prompt?' }])[0].questionText).toBe('From prompt?');
    expect(normalizeQuestions([{ questionText: 'Right one?', question: 'Wrong one?' }])[0].questionText).toBe('Right one?');
    expect(normalizeQuestions([{ questionText: '   ', question: 'Fallback?' }])[0].questionText).toBe('Fallback?');
  });

  it('understands other names for the three kinds, in any case', () => {
    const kind = (type: string) => normalizeQuestions([{ question: 'Q?', type, options: ['a', 'b'] }])[0].questionType;
    expect(kind('Single-Select')).toBe('single_select');
    expect(kind('radio')).toBe('single_select');
    expect(kind('multiple_choice')).toBe('single_select');
    expect(kind('MULTI SELECT')).toBe('multi_select');
    expect(kind('checkbox')).toBe('multi_select');
    expect(kind('text')).toBe('free_text');
    expect(kind('textarea')).toBe('free_text');
  });

  it('guesses the kind from the options when none (or an unknown one) is given', () => {
    expect(normalizeQuestions([{ question: 'Q?', options: ['a', 'b'] }])[0].questionType).toBe('single_select');
    expect(normalizeQuestions([{ question: 'Q?', type: 'slider', options: ['a', 'b'] }])[0].questionType).toBe('single_select');
    expect(normalizeQuestions([{ question: 'Q?' }])[0].questionType).toBe('free_text');
    expect(normalizeQuestions([{ question: 'Q?', type: 'slider' }])[0].questionType).toBe('free_text');
  });

  it('never returns a select question without options (it would render as an empty list)', () => {
    for (const options of [undefined, [], [''], ['  '], null, 'not an array']) {
      const [q] = normalizeQuestions([{ question: 'Q?', type: 'single_select', options }]);
      expect(q.questionType).toBe('free_text');
      expect(q.options).toBeUndefined();
    }
  });

  it('drops options from free-text questions', () => {
    const [q] = normalizeQuestions([{ question: 'Q?', type: 'free_text', options: ['a', 'b'] }]);
    expect(q).toEqual({ id: 'q1', questionText: 'Q?', questionType: 'free_text' });
  });

  it('cleans options: strings, numbers and { label | text | value } objects, trimmed, no empty or repeated ones', () => {
    const [q] = normalizeQuestions([
      {
        question: 'Pick?',
        type: 'single_select',
        options: ['  React ', 'React', 7, { label: 'Vue' }, { text: 'Svelte' }, { value: 'Solid' }, { nothing: true }, '', null, 'Angular'],
      },
    ]);
    expect(q.options).toEqual(['React', '7', 'Vue', 'Svelte', 'Solid', 'Angular']);
  });

  it('gives every question a unique id, so answers cannot overwrite each other', () => {
    const out = normalizeQuestions([
      { id: 'same', question: 'A?' },
      { id: 'same', question: 'B?' },
      { question: 'C?' },
      { id: 3, question: 'D?' },
      { id: 'q3', question: 'E?' },
    ]);
    const ids = out.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('same');
    expect(ids[3]).toBe('3');
  });

  it('drops items without real question text instead of inventing one', () => {
    const out = normalizeQuestions([
      { id: 'a', options: ['x', 'y'] },
      { question: '   ' },
      null,
      'a string',
      42,
      ['nested'],
      { question: 'The only real one?' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].questionText).toBe('The only real one?');
  });

  it('accepts a { "questions": [...] } wrapper and returns nothing for anything else', () => {
    expect(normalizeQuestions({ questions: [{ question: 'Wrapped?' }] })).toHaveLength(1);
    for (const junk of [null, undefined, 'text', 5, {}, { questions: 'no' }]) {
      expect(normalizeQuestions(junk)).toEqual([]);
    }
  });

  it('limits the number of questions and the length of texts and options', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ question: `Question ${i}?` }));
    expect(normalizeQuestions(many)).toHaveLength(6);

    const [q] = normalizeQuestions([
      { question: 'q'.repeat(2000), type: 'multi_select', options: Array.from({ length: 20 }, (_, i) => `option ${i} ${'o'.repeat(500)}`) },
    ]);
    expect(q.questionText).toHaveLength(500);
    expect(q.options).toHaveLength(8);
    expect(q.options!.every((o) => o.length <= 200)).toBe(true);
  });

  it('produces output the profile schema accepts', () => {
    const out = normalizeQuestions([
      { question: 'Which style?', type: 'single_select', options: ['A', 'B'] },
      { question: 'Anything else?', type: 'text' },
    ]);
    expect(QuestionsArraySchema.safeParse(out).success).toBe(true);
  });
});

describe('question prompts', () => {
  const profiles = Object.values(USE_CASE_PROFILES);

  it('covers all 7 profiles', () => {
    expect(profiles).toHaveLength(7);
  });

  it('every profile prompt carries the exact output schema, so models use the right key names', () => {
    for (const profile of profiles) {
      expect(profile.questionPrompt, profile.id).toContain(QUESTION_OUTPUT_FORMAT);
      expect(profile.questionPrompt, profile.id).toContain('"questionText"');
      expect(profile.questionPrompt, profile.id).toContain('"questionType"');
      expect(profile.questionPrompt, profile.id).toContain('"single_select", "multi_select" or "free_text"');
      // The old wording named no keys, which is how models picked "question" and "type"
      expect(profile.questionPrompt, profile.id).not.toContain('JSON array of question objects without markdown');
    }
  });

  it('the schema example itself is valid JSON in the shape the wizard expects', () => {
    const example = QUESTION_OUTPUT_FORMAT.slice(QUESTION_OUTPUT_FORMAT.indexOf('['), QUESTION_OUTPUT_FORMAT.lastIndexOf(']') + 1);
    const parsed = JSON.parse(example);
    expect(normalizeQuestions(parsed)).toEqual(parsed);
  });

  it('the built-in fallback questions already match the contract', () => {
    for (const profile of profiles) {
      expect(normalizeQuestions(profile.fallbackQuestions), profile.id).toEqual(profile.fallbackQuestions);
    }
    expect(getUseCaseProfile('coding-agent').fallbackQuestions.length).toBeGreaterThan(0);
  });
});
