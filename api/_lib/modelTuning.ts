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
    // 2026-11-03 eval: built a "custom Rust service" for a no-code app, and scored lowest on no-code (5.7)
    extraWording: `[STRICT COMPLIANCE DIRECTIVE - ZERO TOLERANCE FOR FORMAT DRIFT]
1. Follow the exact requested output format (pure JSON when JSON is asked). For a prompt document, that means the role blueprint: every heading, in order, with its words kept, and every table filled with real rows for this idea, never the template's sample rows.
2. Absolutely no conversational filler, preambles or closing remarks. Output only the requested document.
3. Write every section in full: no "TODO", "etc." or cut-short parts. Bracketed fill-in fields are allowed only for facts that only the user can know (names, prices, dates, their own numbers).
4. Use only the tools, platforms and technologies the user chose or the role blueprint names. Never add a custom service, another programming language or extra infrastructure on your own.
5. Never invent numbers, studies, quotes, customers or results.
6. Strictly obey all negative constraints and the role's rules.
7. Plan the length so that the last section is complete.`,
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
1. Adhere strictly to the requested output format (pure JSON when JSON is asked); for a prompt document, the role blueprint: every heading, in order, with its words kept, and no conversational wrappers.
2. Write every section in full and specific to the user's idea; never skip lines. Bracketed fill-in fields only for facts that only the user can know.
3. Never invent numbers, studies, quotes or customers; mark any claim from the idea that you cannot verify.
4. Meet the blueprint's content depth targets, and plan the length so that the last section is complete.
5. Obey all negative constraints without exception.`,
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
    // 2026-11-03 eval: shortest documents, followed the fake-study and one-sided-contract premises, and copied the
    // internal self-audit checklist into 11 of 21 documents
    extraWording: `[PRECISE DIRECTIVE]
1. Start directly with the requested output (the title for a prompt document, pure JSON when JSON is asked). Do NOT explain what you are going to do.
2. Cover every requested section in depth, concrete and specific to the user's idea. Meet the blueprint's content depth targets: every table has every row the project needs. Do not compress the document to save space.
3. Premise check before writing: find any claim in the user's idea you cannot verify (a named study, statistics, user or revenue numbers) and any one-sided terms. Do not adopt them as fact or as terms; follow the final integrity check.
4. Never invent numbers, studies, quotes, customers or results.
5. Never copy the self-audit checklist or any instruction marked internal into the document.
6. Enforce all negative constraints.`,
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
    // 2026-11-03 eval: the most detailed documents, but invented a "92% alignment" result for a non-existent study
    extraWording: `[PRECISION DIRECTIVE]
- Ground every recommendation in current, proven practice for the target tool or audience.
- Make every section complete, concrete and directly usable; for a prompt document, follow the role blueprint's headings and order exactly.
- Never invent numbers, findings, studies or quotes to make a section look stronger: use the user's facts, well-established knowledge, or a bracketed field the user must verify.
- Stay within the role's length range so that the final section is complete.
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
- Keep the requested output format; for a prompt document, follow the role blueprint's headings and order exactly. Make every table and list fully structured. Eliminate generic boilerplate.
- Never invent numbers, studies, quotes or customers; mark any claim you cannot verify.
- Stay within the role's length range so that the final section is complete.`,
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
- Reason through the user's constraints before writing, then deliver complete, internally consistent sections in the role blueprint's order.
- Output only the final document: no reasoning text, no <think> blocks, no conversational wrapper.`,
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
- Deliver publication-grade documents for the role's real target, complete in every section of the role blueprint.
- Cover the failure modes and edge cases that matter in this domain, and how the result is checked.`,
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
- Reason thoroughly through the trade-offs and edge cases of the user's domain before outputting the final document.
- Deliver a definitive, logically sound document in the role blueprint's order. Output only the final document, no reasoning text.`,
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
1. Follow the exact requested output format; for a prompt document, every heading of the role blueprint, in order, every section written in full.
2. Absolutely no conversational filler or preambles.
3. Never invent numbers, studies, quotes or customers.
4. Strictly obey all negative constraints.`,
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
- Exercise expert craftsmanship: bespoke, specific and complete for the target tool or audience, in the role blueprint's order.
- Never invent numbers, studies, quotes or customers.
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
- Make every section complete, concrete and directly usable, in the role blueprint's order.
- Never invent numbers, studies, quotes or customers.`,
  };
}
