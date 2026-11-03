/**
 * Bedrock Per-Model Tuning Table (Serverless Runtime)
 * Standardizes sampling temperature, few-shot example depth, and tiered system prompt wording
 * across all cloud LLM endpoints.
 */

export type ModelTier = 'frontier' | 'mid' | 'compact';

export interface ModelTuningConfig {
  modelId: string;
  name: string;
  tier: ModelTier;
  temperature: number;
  numExamples: number;
  extraWording: string;
  maxTokens?: number;
  provider?: 'gemini' | 'groq' | 'openai' | 'anthropic' | 'openrouter';
  aliases?: string[];
  notes?: string;
}

export const MODEL_TUNING_TABLE: Record<string, ModelTuningConfig> = {
  // Compact & Weaker Models (Low temp 0.2-0.3, High examples 3-4, Strict wording)
  // Replaced llama-3.1-8b-instant (retired by Groq, 404 on 2026-11-03)
  'openai/gpt-oss-20b': {
    modelId: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    tier: 'compact',
    temperature: 0.3,
    numExamples: 3,
    provider: 'groq',
    maxTokens: 4096,
    aliases: ['gpt-oss-20b', 'groq-gpt-oss-20b'],
    extraWording: `[STRICT COMPLIANCE DIRECTIVE - ZERO TOLERANCE FOR FORMAT DRIFT]
1. Follow the exact requested structure and format without deviation.
2. Absolutely no conversational filler or preambles. Output only the requested document.
3. Write every section in full: no placeholders, "TODO", "etc." or cut-short parts.
4. Strictly obey all negative constraints and the role's rules.`,
  },
  'gemini-flash-lite-latest': {
    modelId: 'gemini-flash-lite-latest',
    name: 'Gemini Flash Lite',
    tier: 'compact',
    temperature: 0.25,
    numExamples: 3,
    provider: 'gemini',
    maxTokens: 3000,
    aliases: ['gemini-3.5-flash-lite', 'gemini-lite'],
    extraWording: `[STRICT EXECUTION DIRECTIVE - HIGH PRECISION MODE]
1. Adhere strictly to the requested document structure without omitting sections or adding conversational wrappers.
2. Write every section in full and specific to the user's idea; never skip lines or leave placeholders.
3. Obey all negative constraints without exception.`,
  },
  'openai/gpt-4o-mini': {
    modelId: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    tier: 'compact',
    temperature: 0.3,
    numExamples: 3,
    provider: 'openrouter',
    maxTokens: 3500,
    aliases: ['gpt-4o-mini'],
    extraWording: `[PRECISE DIRECTIVE]
1. Start directly with the primary title/heading. Do NOT explain what you are going to do.
2. Cover every requested section in depth, concrete and specific to the user's idea; no lazy commentary or placeholders.
3. Enforce all negative constraints.`,
  },

  // Mid-Tier Models (Moderate temp 0.45-0.55, Balanced examples 2, Focused guidance)
  // Replaced llama-3.3-70b-versatile (retired by Groq, 404 on 2026-11-03)
  'openai/gpt-oss-120b': {
    modelId: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    tier: 'mid',
    temperature: 0.5,
    numExamples: 2,
    provider: 'groq',
    maxTokens: 4096,
    aliases: ['gpt-oss-120b', 'groq-gpt-oss-120b'],
    extraWording: `[PRECISION DIRECTIVE]
- Ground every recommendation in current, proven practice for the target tool or audience.
- Make every section complete, concrete and directly usable.
- Omit conversational preamble; deliver dense, specific instructions.`,
  },
  'gemini-flash-latest': {
    modelId: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    tier: 'mid',
    temperature: 0.55,
    numExamples: 2,
    provider: 'gemini',
    maxTokens: 4096,
    aliases: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash'],
    extraWording: `[EXPERT DIRECTIVE]
- Deliver deep, specific content for every requested section, tailored to the user's idea.
- Make every table and list fully structured. Eliminate generic boilerplate.`,
  },
  'deepseek-r1-distill-llama-70b': {
    modelId: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B',
    tier: 'mid',
    temperature: 0.5,
    numExamples: 2,
    provider: 'groq',
    maxTokens: 4096,
    aliases: ['deepseek-r1-70b', 'r1-distill-70b'],
    extraWording: `[REASONING-DRIVEN DIRECTIVE]
- Provide rigorous logical breakdowns and complete schema contracts.
- Eliminate conversational wrapper; output direct engineering specifications.`,
  },

  // Frontier Models (Higher temp 0.65-0.7, 1 example, Light empowering directives)
  'claude-3-5-sonnet': {
    modelId: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    tier: 'frontier',
    temperature: 0.7,
    numExamples: 1,
    provider: 'openrouter',
    maxTokens: 8192,
    aliases: ['anthropic/claude-3.5-sonnet', 'claude-sonnet'],
    extraWording: `[FRONTIER SYNTHESIS DIRECTIVE]
- Exercise principal architect craftsmanship: provide bespoke, elegant systems design with complete contracts and verification protocols.
- Skip basic tutorials and conversational filler; prioritize bespoke, high-leverage engineering decisions.`,
  },
  'gpt-4o': {
    modelId: 'gpt-4o',
    name: 'GPT-4o',
    tier: 'frontier',
    temperature: 0.7,
    numExamples: 1,
    provider: 'openai',
    maxTokens: 4096,
    aliases: ['openai/gpt-4o', 'gpt-4o-latest'],
    extraWording: `[ENTERPRISE ARCHITECT DIRECTIVE]
- Deliver publication-grade technical specifications with complete TypeScript/Zod schemas.
- Cover critical failure modes, optimistic updates, and end-to-end verification workflows.`,
  },
  'deepseek/deepseek-r1': {
    modelId: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    tier: 'frontier',
    temperature: 0.6,
    numExamples: 1,
    provider: 'openrouter',
    maxTokens: 8192,
    aliases: ['deepseek-r1', 'r1'],
    extraWording: `[REASONING & SYNTHESIS DIRECTIVE]
- Reason thoroughly through system trade-offs, state transitions, and edge cases before outputting the final specification.
- Deliver definitive, logically sound architectural blueprints.`,
  },
};

export function classifyModelTier(modelId: string): ModelTier {
  const norm = modelId.toLowerCase().trim();
  if (
    /(8b|7b|3b|1b|mini|lite|instant|small|nano)/i.test(norm) &&
    !/(70b|72b|large|pro|plus|ultra)/i.test(norm)
  ) {
    return 'compact';
  }
  if (
    /(sonnet|opus|gpt-4o|gpt-4-turbo|deepseek-r1|r1|grok|command-r-plus|405b|frontier)/i.test(norm) &&
    !/(mini|lite|instant)/i.test(norm)
  ) {
    return 'frontier';
  }
  return 'mid';
}

export function getModelTuning(modelId = 'auto'): ModelTuningConfig {
  const norm = modelId.toLowerCase().trim();
  if (MODEL_TUNING_TABLE[norm]) return MODEL_TUNING_TABLE[norm];

  const stripped = norm.replace(/^(openai|anthropic|meta-llama|deepseek|mistralai|hf|nvidia|google|cohere|x-ai)\//i, '');
  if (MODEL_TUNING_TABLE[stripped]) return MODEL_TUNING_TABLE[stripped];

  for (const config of Object.values(MODEL_TUNING_TABLE)) {
    if (config.aliases?.some((a) => a.toLowerCase() === norm || a.toLowerCase() === stripped)) {
      return config;
    }
  }

  const tier = classifyModelTier(norm);
  if (tier === 'compact') {
    return {
      modelId: norm,
      name: norm.toUpperCase(),
      tier: 'compact',
      temperature: 0.25,
      numExamples: 3,
      extraWording: `[STRICT COMPLIANCE DIRECTIVE - ZERO TOLERANCE FOR FORMAT DRIFT]
1. Follow the exact requested structure and format without deviation.
2. Absolutely no conversational filler or preambles.
3. Strictly obey all negative constraints.`,
    };
  }
  if (tier === 'frontier') {
    return {
      modelId: norm,
      name: norm.toUpperCase(),
      tier: 'frontier',
      temperature: 0.7,
      numExamples: 1,
      extraWording: `[FRONTIER SYNTHESIS DIRECTIVE]
- Exercise expert craftsmanship: bespoke, specific and complete for the target tool or audience.
- Skip basic tutorials and conversational filler.`,
    };
  }
  return {
    modelId: norm,
    name: norm.toUpperCase(),
    tier: 'mid',
    temperature: 0.5,
    numExamples: 2,
    extraWording: `[PRECISION DIRECTIVE]
- Ground every recommendation in current, proven practice for the target tool or audience.
- Make every section complete, concrete and directly usable.`,
  };
}
