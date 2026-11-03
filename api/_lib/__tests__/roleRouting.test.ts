import { describe, it, expect } from 'vitest';
import { roleKey } from '../useCaseProfiles.js';
import { validateSynthesisOutput, detectForbiddenTerms, inferRoleFromDocument, sanitizePromptOutput, stripInternalChecklist } from '../validation.js';
import {
  resolveDomainGuardrails,
  buildRefineSystemPrompt,
  FINAL_INTEGRITY_CHECK,
  BEDROCK_UNIVERSAL_GUARDRAILS,
  BEDROCK_CODING_GUARDRAILS,
  BEDROCK_VISUAL_GUARDRAILS,
  BEDROCK_WRITING_GUARDRAILS,
  BEDROCK_NO_CODE_GUARDRAILS,
} from '../aiPrompts.js';
import { getGroundedFacts } from '../ragGrounding.js';
import { getModelTuning } from '../modelTuning.js';
import { AI_PROVIDERS } from '../loadBalancer.js';
import * as masterPrompts from '../masterRolePrompts.js';

// Found by the prompt-quality eval (2026-11-03): role checks compared raw strings, so some roles were checked
// against the CODING rules. Example: a "writing" essay failed the coding section check, and the automatic repair
// then rewrote the essay into a software spec ("File Tree Topology", "Phase 1: Schema Definition").

describe('roleKey: every spelling of a role maps to the same checks', () => {
  it.each([
    ['coding_agent', 'coding_agent'],
    ['coding-agent', 'coding_agent'],
    ['image_generation', 'image_generation'],
    ['image-prompt', 'image_generation'],
    ['video_generation', 'video_generation'],
    ['video-generation', 'video_generation'],
    ['writing', 'writing'],
    ['freelancer_brief', 'freelancer_brief'],
    ['freelance-brief', 'freelancer_brief'],
    ['hackathon_pitch', 'hackathon_pitch'],
    ['pitch', 'hackathon_pitch'],
    ['no_code', 'no_code'],
    ['no-code', 'no_code'],
  ])('%s -> %s', (input, expected) => {
    expect(roleKey(input)).toBe(expected);
  });

  it('an unknown or empty role falls back to coding, as before', () => {
    expect(roleKey(undefined)).toBe('coding_agent');
    expect(roleKey('')).toBe('coding_agent');
  });
});

describe('section checks per role', () => {
  const essay = `# Working Titles & Lead Hooks
1. The Silicon Mirage. Hook: every benchmark win hides a category error.

## Narrative Spine & Central Thesis
The thesis: general intelligence is not a quantity that scales.

## Section-by-Section Structural Outline
1. Opening scene. 2. The benchmark trap. 3. What intelligence is for.

## Voice, Tone & Cadence Modulation Guide
Dry, precise, short sentences; no hype.

## Closing
End on the reader's own daily tools.
${'More detail about the argument and its evidence. '.repeat(10)}`;

  it('a writing document is checked against the writing sections, not the coding ones', () => {
    const result = validateSynthesisOutput(essay, 'writing', 'an essay on why AGI is a category error');
    expect(result.missingSections).toEqual([]);
    expect(result.missingSections.join(' ')).not.toMatch(/file tree|schema|negative constraints/i);
  });

  it('a writing document that lacks its parts is told what it lacks in writing terms', () => {
    const result = validateSynthesisOutput(`# A title\n${'Just some prose. '.repeat(30)}`, 'writing', 'an essay');
    expect(result.missingSections.length).toBeGreaterThan(0);
    expect(result.missingSections.join(' ')).not.toMatch(/file tree|schema|api|route/i);
  });

  it('the image check is the same whichever spelling the client sends', () => {
    const doc = `# Prompt\n${'a misty harbour at dawn, 35mm, soft light. '.repeat(20)}`;
    const a = validateSynthesisOutput(doc, 'image_generation', 'a harbour photo');
    const b = validateSynthesisOutput(doc, 'image-prompt', 'a harbour photo');
    expect(b.missingSections).toEqual(a.missingSections);
  });

  it('code terms are flagged in an image prompt under either spelling', () => {
    const text = 'Render the scene, then run npm install and write a React component with useState.';
    const a = detectForbiddenTerms(text, 'image_generation', 'a harbour photo');
    const b = detectForbiddenTerms(text, 'image-prompt', 'a harbour photo');
    expect(a.forbiddenTerms.length).toBeGreaterThan(0);
    expect(b.forbiddenTerms).toEqual(a.forbiddenTerms);
  });

  it('everyday picture words that are also library names are not flagged as code in image/video prompts', () => {
    const text =
      'Angular shadows across wet cobblestones, a light drizzle, a svelte dancer turns to react, vue sur la mer, luz a través de un prisma.';
    for (const t of ['image_generation', 'video_generation']) {
      expect(detectForbiddenTerms(text, t, 'a rainy street photo').forbiddenTerms).toEqual([]);
    }
    // the code forms still are
    const code = 'Install drizzle-orm and the Prisma client, then write a React component with @angular imports.';
    expect(detectForbiddenTerms(code, 'image_generation', 'a rainy street photo').forbiddenTerms).toEqual(
      expect.arrayContaining(['drizzle-orm', 'prisma client', 'react component', '@angular'])
    );
    expect(detectForbiddenTerms('Which React version should the scene use?', 'image_generation', 'a lighthouse').forbiddenTerms).toContain('react version');
  });

  it('the coding check accepts the <negative_constraints> block the coding prompt itself asks for', () => {
    const doc = `# Plan
## Role Persona
x
<negative_constraints>
- Never use any.
</negative_constraints>
${'filler line about the plan. '.repeat(20)}`;
    const result = validateSynthesisOutput(doc, 'coding_agent', 'a todo app');
    expect(result.missingSections).not.toContain('Strict Negative Constraints Matrix');
  });
});

describe('each role prompt and its section check agree', () => {
  // A model that writes exactly the structure the role prompt asks for must pass the section check. Before
  // 2026-11-03 several did not (coding: <negative_constraints>; pitch: "30-Second Elevator Hook"; writing: checked
  // against coding), so every such answer cost a needless repair call and showed a false warning.
  const ROLES: Array<[string, string]> = [
    ['coding_agent', 'CODING_AGENT_MASTER_PROMPT'],
    ['image_generation', 'IMAGE_GENERATION_MASTER_PROMPT'],
    ['video_generation', 'VIDEO_GENERATION_MASTER_PROMPT'],
    ['writing', 'WRITING_MASTER_PROMPT'],
    ['freelancer_brief', 'FREELANCER_BRIEF_MASTER_PROMPT'],
    ['hackathon_pitch', 'HACKATHON_PITCH_MASTER_PROMPT'],
    ['no_code', 'NO_CODE_MASTER_PROMPT'],
  ];

  it.each(ROLES)('%s', (targetType, promptName) => {
    const template = (masterPrompts as Record<string, unknown>)[promptName];
    expect(typeof template, promptName).toBe('string');
    const region = (template as string).slice(Math.max(0, (template as string).search(/MANDATORY STRUCTURAL BLUEPRINT/i)));
    // What a faithful answer keeps: the headings, the label of each call-out (its example text is replaced by
    // the model's own), and the XML-style block tags
    const skeleton = region
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^#{1,4} |^> |^<\/?[a-z_]+>/.test(l))
      .map((l) => (l.startsWith('> ') && l.includes(':') ? l.slice(0, l.indexOf(':') + 1) : l))
      .join('\n');
    const doc = `${skeleton}\n${'Specific content for this section. '.repeat(20)}`;
    expect(validateSynthesisOutput(doc, targetType, 'a test idea').missingSections).toEqual([]);
  });
});

describe('guardrails per role', () => {
  it('no-code gets its own rules, not the coding ones (TypeScript, file trees)', () => {
    for (const t of ['no_code', 'no-code']) {
      const g = resolveDomainGuardrails(t);
      expect(g).toContain(BEDROCK_NO_CODE_GUARDRAILS);
      expect(g).not.toContain(BEDROCK_CODING_GUARDRAILS);
    }
  });

  it('every spelling of a role gets the same guardrails', () => {
    expect(resolveDomainGuardrails('image-prompt')).toBe(resolveDomainGuardrails('image_generation'));
    expect(resolveDomainGuardrails('video-generation')).toContain(BEDROCK_VISUAL_GUARDRAILS);
    expect(resolveDomainGuardrails('writing')).toContain(BEDROCK_WRITING_GUARDRAILS);
    expect(resolveDomainGuardrails('freelance-brief')).toBe(resolveDomainGuardrails('freelancer_brief'));
    expect(resolveDomainGuardrails('pitch')).toBe(resolveDomainGuardrails('hackathon_pitch'));
    expect(resolveDomainGuardrails('coding_agent')).toContain(BEDROCK_CODING_GUARDRAILS);
  });

  it('grounded facts for video are the same under both spellings', () => {
    const a = getGroundedFacts('a slow drone shot over a city', 'video-generation');
    const b = getGroundedFacts('a slow drone shot over a city', 'video_generation');
    expect(a.groundedFactsBlock).toBe(b.groundedFactsBlock);
    expect(a.groundedFactsBlock).toMatch(/Runway/);
  });
});

describe('refine uses the rules of the document it refines', () => {
  it('an image or pitch refine gets its own rules, not the coding ones', () => {
    const image = buildRefineSystemPrompt('image_generation');
    expect(image).toContain(BEDROCK_VISUAL_GUARDRAILS);
    expect(image).not.toContain(BEDROCK_CODING_GUARDRAILS);
    expect(buildRefineSystemPrompt('hackathon_pitch')).not.toContain(BEDROCK_CODING_GUARDRAILS);
  });

  it('an unknown role gets only the universal rules, and "more detail" no longer means TypeScript and Zod', () => {
    const p = buildRefineSystemPrompt(null);
    expect(p).toContain(BEDROCK_UNIVERSAL_GUARDRAILS);
    expect(p).not.toContain(BEDROCK_CODING_GUARDRAILS);
    expect(p).not.toMatch(/add concrete TypeScript types, Zod schemas/);
    expect(p).toMatch(/Never add a tech stack, code or programming terms to a document that has none/);
  });

  it('a coding document still gets the coding rules', () => {
    expect(buildRefineSystemPrompt('coding_agent')).toContain(BEDROCK_CODING_GUARDRAILS);
  });

  it('reads the role from the document when the client does not send it', () => {
    const image = `# Noir Detective Cat - Image Prompt Pack
## 1. Master Midjourney Prompt (Ready to Copy-Paste)
/imagine a detective cat --ar 2:3 --style raw
## 2. Master FLUX & DALL-E Natural Language Prompt
A film-noir poster ...
## 3. Optical, Cinematography & Lighting Specifications Sheet
85mm f/1.4, hard key light
## 4. Color Palette & Film Stock Profile
Ilford HP5
## 5. Negative Prompt & Exclusion List (Stable Diffusion / ComfyUI)
blurry, text
## 6. Composition & Aspect Ratio Variations Matrix
2:3, 1:1`;
    expect(inferRoleFromDocument(image)).toBe('image_generation');
    expect(inferRoleFromDocument('Just a sentence with nothing in it.')).toBeNull();
    expect(inferRoleFromDocument('')).toBeNull();
  });
});

describe('internal checklist and invented facts', () => {
  it("removes the template's internal self-audit checklist when a model copies it into the document", () => {
    const doc = `# Contract

## 7. Handover, Sign-Off & Warranty Protocol
Two weeks of fixes.

### PRE-FLIGHT SILENT SELF-AUDIT
1. The payment trigger total equals the budget.
2. Every answer is used.`;
    const out = sanitizePromptOutput(doc);
    expect(out).not.toMatch(/SELF-AUDIT|payment trigger total/);
    expect(out).toContain('Two weeks of fixes.');

    // also in the middle of a document, and in bold form
    const middle = `# A\n**PRE-FLIGHT SILENT SELF-AUDIT**\n1. check\n## B\nkeep me`;
    expect(stripInternalChecklist(middle)).toMatch(/^# A\n+## B\nkeep me$/);
  });

  it('the role templates mark that checklist internal and no longer show an invented statistic as the example', () => {
    const all = (Object.values(masterPrompts) as unknown[]).filter((v) => typeof v === 'string').join('\n');
    const headers = all.match(/PRE-FLIGHT SILENT SELF-AUDIT[^\n]*/g) ?? [];
    expect(headers.length).toBeGreaterThan(0);
    for (const h of headers) expect(h).toMatch(/internal: never write this checklist into the output/);
    expect(all).not.toContain('50,000 paramedics');
  });

  it('the synthesis system prompt ends with the integrity check', () => {
    expect(FINAL_INTEGRITY_CHECK).toMatch(/Never state such a claim as fact/);
    expect(FINAL_INTEGRITY_CHECK).toMatch(/fair, professional version/);
  });
});

describe('per-model wording added to every role', () => {
  it('does not ask for code (TypeScript, Zod, schemas, type definitions) in any role', () => {
    for (const p of AI_PROVIDERS) {
      const wording = getModelTuning(p.model).extraWording;
      expect(wording, p.model).not.toMatch(/typescript|zod|schema|type definitions|executable|code\b/i);
    }
  });
});
