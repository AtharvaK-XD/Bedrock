import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MODEL_TUNING_TABLE,
  getModelTuning,
  classifyModelTier,
  buildTunedPrompt,
  callLLM,
  callLLMWithMeta,
  FewShotExample,
} from '../src/lib/callLLM';

describe('Per-Model Tuning Table', () => {
  it('defines distinct configurations across compact, mid, and frontier tiers', () => {
    expect(MODEL_TUNING_TABLE['llama-3.1-8b-instant']).toBeDefined();
    expect(MODEL_TUNING_TABLE['llama-3.3-70b-versatile']).toBeDefined();
    expect(MODEL_TUNING_TABLE['claude-3-5-sonnet']).toBeDefined();
    expect(MODEL_TUNING_TABLE['gpt-4o']).toBeDefined();
  });

  describe('Compact / Weaker Models (Tier: compact)', () => {
    it('configures lower temperatures (0.15 - 0.3) for weaker models', () => {
      const llama8b = MODEL_TUNING_TABLE['llama-3.1-8b-instant'];
      const geminiLite = MODEL_TUNING_TABLE['gemini-flash-lite-latest'];
      const gpt4oMini = MODEL_TUNING_TABLE['openai/gpt-4o-mini'];
      const gpt35 = MODEL_TUNING_TABLE['gpt-3.5-turbo'];

      expect(llama8b.tier).toBe('compact');
      expect(llama8b.temperature).toBeLessThanOrEqual(0.3);
      expect(llama8b.temperature).toBeGreaterThanOrEqual(0.15);

      expect(geminiLite.tier).toBe('compact');
      expect(geminiLite.temperature).toBeLessThanOrEqual(0.3);

      expect(gpt4oMini.tier).toBe('compact');
      expect(gpt4oMini.temperature).toBeLessThanOrEqual(0.3);

      expect(gpt35.tier).toBe('compact');
      expect(gpt35.temperature).toBeLessThanOrEqual(0.3);
    });

    it('allocates MORE few-shot examples (3 to 4) for weaker models', () => {
      const llama8b = MODEL_TUNING_TABLE['llama-3.1-8b-instant'];
      const geminiLite = MODEL_TUNING_TABLE['gemini-flash-lite-latest'];
      const gpt35 = MODEL_TUNING_TABLE['gpt-3.5-turbo'];

      expect(llama8b.numExamples).toBeGreaterThanOrEqual(3);
      expect(geminiLite.numExamples).toBeGreaterThanOrEqual(3);
      expect(gpt35.numExamples).toBe(4);
    });

    it('injects strict, zero-tolerance guardrails for weaker models', () => {
      const llama8b = MODEL_TUNING_TABLE['llama-3.1-8b-instant'];
      expect(llama8b.extraWording).toContain('STRICT COMPLIANCE DIRECTIVE');
      expect(llama8b.extraWording).toContain('ZERO CONVERSATIONAL FILLER');
      expect(llama8b.extraWording).toContain('OBEY ALL NEGATIVE CONSTRAINTS');
    });
  });

  describe('Frontier / Stronger Models (Tier: frontier)', () => {
    it('configures optimal reasoning/synthesis temperatures (0.6 - 0.7) for frontier models', () => {
      const claudeSonnet = MODEL_TUNING_TABLE['claude-3-5-sonnet'];
      const gpt4o = MODEL_TUNING_TABLE['gpt-4o'];
      const deepseekR1 = MODEL_TUNING_TABLE['deepseek/deepseek-r1'];
      const grok3 = MODEL_TUNING_TABLE['grok-3'];

      expect(claudeSonnet.tier).toBe('frontier');
      expect(claudeSonnet.temperature).toBe(0.7);

      expect(gpt4o.tier).toBe('frontier');
      expect(gpt4o.temperature).toBe(0.7);

      expect(deepseekR1.tier).toBe('frontier');
      expect(deepseekR1.temperature).toBe(0.6);

      expect(grok3.tier).toBe('frontier');
      expect(grok3.temperature).toBe(0.65);
    });

    it('allocates MINIMAL few-shot examples (1) for frontier models to avoid context bloat', () => {
      const claudeSonnet = MODEL_TUNING_TABLE['claude-3-5-sonnet'];
      const gpt4o = MODEL_TUNING_TABLE['gpt-4o'];
      const deepseekR1 = MODEL_TUNING_TABLE['deepseek/deepseek-r1'];

      expect(claudeSonnet.numExamples).toBe(1);
      expect(gpt4o.numExamples).toBe(1);
      expect(deepseekR1.numExamples).toBe(1);
    });

    it('injects light, empowering synthesis directives for frontier models', () => {
      const claudeSonnet = MODEL_TUNING_TABLE['claude-3-5-sonnet'];
      expect(claudeSonnet.extraWording).toContain('FRONTIER SYNTHESIS DIRECTIVE');
      expect(claudeSonnet.extraWording).toContain('principal architect craftsmanship');
      expect(claudeSonnet.extraWording).not.toContain('ZERO TOLERANCE');
    });
  });

  describe('Mid-Tier / Balanced Models (Tier: mid)', () => {
    it('configures balanced temperatures (0.45 - 0.55) and 2 few-shot examples', () => {
      const llama70b = MODEL_TUNING_TABLE['llama-3.3-70b-versatile'];
      const geminiFlash = MODEL_TUNING_TABLE['gemini-flash-latest'];

      expect(llama70b.tier).toBe('mid');
      expect(llama70b.temperature).toBe(0.5);
      expect(llama70b.numExamples).toBe(2);

      expect(geminiFlash.tier).toBe('mid');
      expect(geminiFlash.temperature).toBe(0.55);
      expect(geminiFlash.numExamples).toBe(2);
    });
  });
});

describe('Model Resolution & Fallbacks (getModelTuning)', () => {
  it('resolves exact model identifiers', () => {
    const tuning = getModelTuning('claude-3-5-sonnet');
    expect(tuning.tier).toBe('frontier');
    expect(tuning.temperature).toBe(0.7);
  });

  it('resolves aliases and provider prefixes', () => {
    const tuning1 = getModelTuning('llama-8b');
    expect(tuning1.modelId).toBe('llama-3.1-8b-instant');
    expect(tuning1.tier).toBe('compact');

    const tuning2 = getModelTuning('anthropic/claude-3.5-sonnet');
    expect(tuning2.modelId).toBe('claude-3-5-sonnet');
    expect(tuning2.tier).toBe('frontier');

    const tuning3 = getModelTuning('gemini');
    expect(tuning3.modelId).toBe('gemini-flash-latest');
  });

  it('classifies unknown models into appropriate tiers by name heuristic', () => {
    expect(classifyModelTier('my-custom-8b-agent')).toBe('compact');
    expect(classifyModelTier('qwen-2.5-7b-chat')).toBe('compact');
    expect(classifyModelTier('meta-llama-3-instant')).toBe('compact');

    expect(classifyModelTier('anthropic-claude-opus-v2')).toBe('frontier');
    expect(classifyModelTier('custom-gpt-4o-tuned')).toBe('frontier');
    expect(classifyModelTier('frontier-reasoning-r1')).toBe('frontier');

    expect(classifyModelTier('qwen-2.5-72b-instruct')).toBe('mid');
    expect(classifyModelTier('custom-general-model')).toBe('mid');
  });

  it('applies fallback tier defaults for unregistered models', () => {
    const compactUnregistered = getModelTuning('unregistered-small-7b');
    expect(compactUnregistered.tier).toBe('compact');
    expect(compactUnregistered.temperature).toBe(0.25);
    expect(compactUnregistered.numExamples).toBe(3);
    expect(compactUnregistered.extraWording).toContain('STRICT COMPLIANCE DIRECTIVE');

    const frontierUnregistered = getModelTuning('unregistered-sonnet-enterprise');
    expect(frontierUnregistered.tier).toBe('frontier');
    expect(frontierUnregistered.temperature).toBe(0.7);
    expect(frontierUnregistered.numExamples).toBe(1);
  });
});

describe('Prompt Building & Parameter Merging (buildTunedPrompt)', () => {
  const dummyExamples: FewShotExample[] = [
    { input: 'Build a todo app', output: 'Todo Blueprint Contract' },
    { input: 'Build an auth system', output: 'Auth Blueprint Contract' },
    { input: 'Build a billing gateway', output: 'Billing Blueprint Contract' },
    { input: 'Build a search engine', output: 'Search Blueprint Contract' },
  ];

  it('slices few-shot examples according to model tuning capacity', () => {
    const compactTuning = getModelTuning('llama-3.1-8b-instant'); // numExamples = 3
    const frontierTuning = getModelTuning('claude-3-5-sonnet'); // numExamples = 1

    const compactPrompt = buildTunedPrompt('My user prompt', compactTuning, 'synthesize', {
      fewShotExamples: dummyExamples,
    });
    expect(compactPrompt.examplesUsedCount).toBe(3);
    expect(compactPrompt.effectiveUserPrompt).toContain('Example 1');
    expect(compactPrompt.effectiveUserPrompt).toContain('Example 2');
    expect(compactPrompt.effectiveUserPrompt).toContain('Example 3');
    expect(compactPrompt.effectiveUserPrompt).not.toContain('Example 4');

    const frontierPrompt = buildTunedPrompt('My user prompt', frontierTuning, 'synthesize', {
      fewShotExamples: dummyExamples,
    });
    expect(frontierPrompt.examplesUsedCount).toBe(1);
    expect(frontierPrompt.effectiveUserPrompt).toContain('Example 1');
    expect(frontierPrompt.effectiveUserPrompt).not.toContain('Example 2');
  });

  it('injects extra wording into effective system prompt', () => {
    const compactTuning = getModelTuning('llama-3.1-8b-instant');
    const { effectiveSystemPrompt } = buildTunedPrompt('Input', compactTuning, 'questions');

    expect(effectiveSystemPrompt).toContain('STRICT COMPLIANCE DIRECTIVE');
    expect(effectiveSystemPrompt).toContain('[TASK PURPOSE: QUESTIONS]');
    expect(effectiveSystemPrompt).toContain('MANDATORY FRONTIER GUARDRAILS');
  });

  it('uses model tuned temperature by default but respects caller override', () => {
    const compactTuning = getModelTuning('llama-3.1-8b-instant');

    // Default
    const defaultResult = buildTunedPrompt('Input', compactTuning);
    expect(defaultResult.temperature).toBe(0.2);

    // Override
    const overriddenResult = buildTunedPrompt('Input', compactTuning, 'general', { temperature: 0.1 });
    expect(overriddenResult.temperature).toBe(0.1);
  });
});

describe('callLLM and callLLMWithMeta Dispatching', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('merges per-model tuning into callLLMWithMeta telemetry', async () => {
    // Mock global fetch for testing
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Synthesized architecture blueprint' } }],
      }),
    }) as any;

    const dummyExamples: FewShotExample[] = [
      { input: 'A', output: 'B' },
      { input: 'C', output: 'D' },
      { input: 'E', output: 'F' },
    ];

    const result = await callLLMWithMeta('Create a REST API', 'llama-3.1-8b-instant', 'synthesize', {
      fewShotExamples: dummyExamples,
    });

    expect(result.text).toBe('Synthesized architecture blueprint');
    expect(result.modelId).toBe('llama-3.1-8b-instant');
    expect(result.tuning.tier).toBe('compact');
    expect(result.temperatureUsed).toBe(0.2);
    expect(result.examplesCount).toBe(3);
    expect(result.extraWordingApplied).toContain('STRICT COMPLIANCE DIRECTIVE');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('applies frontier tuning when calling a frontier model', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Frontier level output' } }],
      }),
    }) as any;

    const dummyExamples: FewShotExample[] = [
      { input: 'A', output: 'B' },
      { input: 'C', output: 'D' },
    ];

    const result = await callLLMWithMeta('System design', 'claude-3-5-sonnet', 'synthesize', {
      fewShotExamples: dummyExamples,
    });

    expect(result.text).toBe('Frontier level output');
    expect(result.modelId).toBe('claude-3-5-sonnet');
    expect(result.tuning.tier).toBe('frontier');
    expect(result.temperatureUsed).toBe(0.7);
    expect(result.examplesCount).toBe(1); // Frontier gets only 1 example!
    expect(result.extraWordingApplied).toContain('FRONTIER SYNTHESIS DIRECTIVE');
  });

  it('convenience callLLM returns clean string output directly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Direct prompt output string' } }],
      }),
    }) as any;

    const output = await callLLM('Test prompt', 'gpt-4o', 'test');
    expect(output).toBe('Direct prompt output string');
  });

  it('automatically triggers validation and a single repair retry when output contains forbidden terms', async () => {
    let callIndex = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: any) => {
      callIndex++;
      const body = JSON.parse(init?.body || '{}');
      if (callIndex === 1) {
        // Attempt 1 returns flawed output with forbidden terms
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'To create this image, use React 19 and npm install three.js' } }],
          }),
        };
      }
      // Attempt 2 (Retry) receives the repair message
      expect(body.messages[1].content).toContain('CRITICAL ARCHITECTURAL REPAIR REQUIRED');
      expect(body.messages[1].content).toContain('FORBIDDEN TERMS DETECTED: [react, react 19, npm, npm install]');
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: `# Apple Macro Photography - Production AI Image Specification\n\n## 1. Visual Concept & Art Direction\nVisual premise: Organic honeycrisp apple on rustic oak.\n\n## 2. Master Prompt Block\n\`\`\`\neditorial photo of honeycrisp apple on rustic oak, window light --ar 16:9 --v 6.1\n\`\`\`\n\n## 3. Optical & Cinematography Specifications\nCamera lens: 85mm f/1.4 lens, diffused morning lighting.\n\n## 4. Color Palette & Film Stock Profile\nKodak Portra 400 emulation.\n\n## 5. Negative Prompt & Exclusion List\n\`\`\`\nblurry, low resolution, watermark, deformed\n\`\`\`\n\n## 6. Composition & Aspect Ratio Variations\n16:9 widescreen composition.`
            }
          }],
        }),
      };
    }) as any;

    const result = await callLLMWithMeta('A photo of a red apple', 'llama-3.1-8b-instant', 'synthesize', {
      targetType: 'image_generation',
      userIdea: 'A photo of a red apple',
    });

    expect(callIndex).toBe(2); // Retried exactly once
    expect(result.repaired).toBe(true);
    expect(result.validationPassed).toBe(true);
    expect(result.text).toContain('Apple Macro Photography');
  });
});
