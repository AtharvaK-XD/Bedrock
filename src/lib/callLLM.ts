/**
 * Bedrock Per-Model Tuning Table & Unified LLM Dispatcher
 *
 * Implements per-model tuning merged inside callLLM:
 * - Temperature: lower/stricter for compact/weaker models, balanced for mid-tier, higher for frontier models
 * - Number of examples: more examples (3-4) for weaker models to lock in format, fewer (1) for frontier models
 * - Extra wording: strict, zero-tolerance guardrails for weaker models, light empowering directives for frontier models
 * - Seamless provider dispatching across OpenRouter, Groq, Gemini, OpenAI, HuggingFace, and Backend Proxies
 */

import { resolveDomainGuardrails } from './aiPrompts';
import { getActiveApiKeys, parseApiErrorResponse, ApiError } from './api';
import {
  validateSynthesisOutput,
  validateQuestionsOutput,
  buildRepairMessage,
  sanitizePromptOutput,
  type ValidationIssue,
} from './validation';
import { getGroundedFacts } from './ragGrounding';

export type ModelTier = 'frontier' | 'mid' | 'compact';

export type LLMPurpose =
  | 'questions'
  | 'synthesize'
  | 'refine'
  | 'test'
  | 'classify'
  | 'plan'
  | 'eval'
  | 'general';

export interface FewShotExample {
  input: string;
  output: string;
  title?: string;
}

export interface ModelTuningConfig {
  /** Canonical model identifier */
  modelId: string;
  /** Human-readable display name */
  name: string;
  /** Tier classification: compact (weaker/smaller), mid (balanced), frontier (strongest) */
  tier: ModelTier;
  /** Default/recommended sampling temperature */
  temperature: number;
  /** Optimal count of few-shot examples to include in the context */
  numExamples: number;
  /** Extra wording injected into system directives: stricter for weaker, lighter for stronger */
  extraWording: string;
  /** Default max completion tokens */
  maxTokens?: number;
  /** Recommended provider routing */
  provider?: 'gemini' | 'groq' | 'openai' | 'anthropic' | 'openrouter' | 'huggingface';
  /** Known aliases or partial matches */
  aliases?: string[];
  /** Description or performance characteristics */
  notes?: string;
}

// ============================================================================
// PER-MODEL TUNING TABLE
// ============================================================================

export const MODEL_TUNING_TABLE: Record<string, ModelTuningConfig> = {
  // --------------------------------------------------------------------------
  // COMPACT & WEAKER MODELS (Tier: 'compact')
  // Tuning: Low temp (0.15 - 0.3), High examples (3 - 4), Strict wording
  // --------------------------------------------------------------------------
  'llama-3.1-8b-instant': {
    modelId: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    tier: 'compact',
    temperature: 0.2,
    numExamples: 3,
    provider: 'groq',
    maxTokens: 2048,
    aliases: ['llama-3.1-8b', 'meta-llama/llama-3.1-8b-instruct', 'llama-8b'],
    notes: 'Fast & lightweight; prone to format drift and hallucinations if temperature exceeds 0.4. Needs strict negative rules.',
    extraWording: `[STRICT COMPLIANCE DIRECTIVE - ZERO TOLERANCE FOR FORMAT DRIFT]
1. STRICT FORMAT ADHERENCE: Follow the exact structure, schema, and keys requested. Do NOT alter field names or invent new properties.
2. ZERO CONVERSATIONAL FILLER: Absolutely no greetings, polite remarks, "Sure, here is...", or post-generation explanations. Output only the requested document/JSON.
3. CONCRETE COMPLETION: Never leave lazy placeholders like "// TODO", "...rest of code", or truncated stubs. Write out all logic completely.
4. ABSOLUTE GROUNDING: Restrict all recommendations to verified, existing libraries and APIs. Do not fabricate package names.
5. OBEY ALL NEGATIVE CONSTRAINTS: Every constraint marked 'NEVER' is absolute and overrides any default behavior.`,
  },

  'gemini-flash-lite-latest': {
    modelId: 'gemini-flash-lite-latest',
    name: 'Gemini Flash Lite',
    tier: 'compact',
    temperature: 0.25,
    numExamples: 3,
    provider: 'gemini',
    maxTokens: 3000,
    aliases: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-lite'],
    notes: 'High speed, cost-effective; requires explicit schema constraints and anti-truncation directives.',
    extraWording: `[STRICT EXECUTION DIRECTIVE - HIGH PRECISION MODE]
1. EXACT STRUCTURAL ADHERENCE: Adhere strictly to the requested blueprint anatomy without omitting sections or adding conversational wrappers.
2. UNTRUNCATED CODE: Provide complete TypeScript interfaces, Zod schemas, or architectural blocks without skipping lines or using ellipsis (...).
3. ZERO REPETITION: Do not repeat section headers or output redundant paragraphs.
4. BOUNDARY INTEGRITY: Stay strictly proportionate to the user's explicit domain scope.`,
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
    notes: 'Extremely capable compact model, benefits from 3 few-shots and clear negative constraints to prevent over-explaining.',
    extraWording: `[DENSE TECHNICAL DIRECTIVE - CONCISE & PRECISE]
1. NO PREAMBLE: Start directly with the primary title/heading. Do NOT explain what you are going to do.
2. SYNTACTIC COMPLETENESS: Output valid, executable schemas and specifications without lazy commentary.
3. RIGID SCHEMA COMPLIANCE: If JSON is requested, output raw JSON only without markdown code fences.
4. ENFORCE NEGATIVE CONSTRAINTS: Do not use deprecated packages or obsolete syntax.`,
  },

  'gpt-3.5-turbo': {
    modelId: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    tier: 'compact',
    temperature: 0.2,
    numExamples: 4,
    provider: 'openai',
    maxTokens: 2048,
    aliases: ['gpt-3.5'],
    notes: 'Legacy compact model; requires maximum few-shot anchors (4 examples) and strict JSON enforcement.',
    extraWording: `[MANDATORY RIGID CONSTRAINTS - STRICT CONTRACT]
1. OUTPUT ONLY THE EXACT REQUESTED FORMAT.
2. NO INTRODUCTIONS. NO OUTRO. NO CONVERSATION.
3. FOLLOW THE FEW-SHOT EXAMPLES EXACTLY IN TONE, DENSITY, AND STRUCTURE.
4. ZERO PLACEHOLDERS. COMPLETE ALL DETAILS EXHAUSTIVELY.`,
  },

  'hf/mistralai/Mistral-7B-Instruct-v0.3': {
    modelId: 'hf/mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B v0.3',
    tier: 'compact',
    temperature: 0.2,
    numExamples: 3,
    provider: 'huggingface',
    maxTokens: 2048,
    aliases: ['mistral-7b', 'hf/mistral-7b'],
    notes: 'Open-weight 7B model; requires strict stopping criteria and few-shot formatting.',
    extraWording: `[STRICT SYSTEM CONTRACT]
Follow the exact instructions. Do not generate conversational dialogue. Output only the requested engineering specification. Never output repetitive loops.`,
  },

  'hf/meta-llama/Meta-Llama-3-8B-Instruct': {
    modelId: 'hf/meta-llama/Meta-Llama-3-8B-Instruct',
    name: 'Llama 3 8B (HuggingFace)',
    tier: 'compact',
    temperature: 0.2,
    numExamples: 3,
    provider: 'huggingface',
    maxTokens: 2048,
    aliases: ['hf/llama-3-8b'],
    notes: 'HuggingFace serverless inference; strict format adherence required.',
    extraWording: `[STRICT OUTPUT CONTRACT]
Output must strictly follow the schema. Zero preamble, zero conversation. All code and schema definitions must be complete and valid.`,
  },

  'hf/HuggingFaceH4/zephyr-7b-beta': {
    modelId: 'hf/HuggingFaceH4/zephyr-7b-beta',
    name: 'Zephyr 7B Beta',
    tier: 'compact',
    temperature: 0.2,
    numExamples: 3,
    provider: 'huggingface',
    maxTokens: 1500,
    aliases: ['zephyr-7b'],
    notes: '7B chat model; needs strict format enforcement.',
    extraWording: `[STRICT DIRECTIVE]
Do not converse. Output strictly the requested technical artifact. Adhere to negative constraints without exception.`,
  },

  // --------------------------------------------------------------------------
  // MID-TIER & BALANCED MODELS (Tier: 'mid')
  // Tuning: Moderate temp (0.45 - 0.55), Balanced examples (2), Focused wording
  // --------------------------------------------------------------------------
  'llama-3.3-70b-versatile': {
    modelId: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B Versatile',
    tier: 'mid',
    temperature: 0.5,
    numExamples: 2,
    provider: 'groq',
    maxTokens: 4096,
    aliases: ['llama-3.3-70b', 'llama-70b', 'groq-llama-70b'],
    notes: 'Excellent open-source workhorse; highly capable with 2 few-shots and clear architectural directives.',
    extraWording: `[ARCHITECTURAL PRECISION DIRECTIVE]
- Ground all specifications in current, pinned engineering standards (React 19, Next.js 15 App Router, TypeScript 5.5+ strict).
- Provide complete, syntactically valid type definitions and actionable contracts.
- Omit conversational preamble; deliver high-signal, production-ready specifications with zero placeholder comments.`,
  },

  'gemini-flash-latest': {
    modelId: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    tier: 'mid',
    temperature: 0.55,
    numExamples: 2,
    provider: 'gemini',
    maxTokens: 4096,
    aliases: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash', 'gemini'],
    notes: 'Fast frontier multimodal model with large context window; handles complex blueprints with balanced temperature.',
    extraWording: `[PRODUCTION ARCHITECT DIRECTIVE]
- Deliver deep technical architecture with complete contracts, data schemas, and runnable verification commands.
- Ensure all diagrams and tables are fully structured.
- Eliminate generic boilerplate; focus on bespoke logic tailored directly to the user's project requirements.`,
  },

  'deepseek-chat': {
    modelId: 'deepseek-chat',
    name: 'DeepSeek Chat',
    tier: 'mid',
    temperature: 0.45,
    numExamples: 2,
    provider: 'openrouter',
    maxTokens: 4096,
    aliases: ['deepseek/deepseek-chat'],
    notes: 'Strong coding and reasoning; best with structured schemas and 2 few-shots.',
    extraWording: `[TECHNICAL DEPTH DIRECTIVE]
- Ensure absolute syntactic correctness across all code, interfaces, and schemas.
- Provide thorough error handling and boundary conditions.
- Omit meta-commentary; jump straight into the technical specification.`,
  },

  'deepseek-coder-v2': {
    modelId: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    tier: 'mid',
    temperature: 0.4,
    numExamples: 2,
    provider: 'openrouter',
    maxTokens: 4096,
    aliases: ['deepseek/deepseek-coder'],
    notes: 'Dedicated coding model; requires concrete type definitions and exact syntax.',
    extraWording: `[ENGINEERING RIGOR DIRECTIVE]
- Focus strictly on code correctness, type safety, and clean separation of concerns.
- Never use 'any' types in TypeScript.
- Provide runnable verification commands (tsc --noEmit, vitest run).`,
  },

  'mistral-large': {
    modelId: 'mistral-large',
    name: 'Mistral Large',
    tier: 'mid',
    temperature: 0.5,
    numExamples: 2,
    provider: 'openrouter',
    maxTokens: 4096,
    aliases: ['mistralai/mistral-large'],
    notes: 'European flagship model; strong multilingual and code reasoning.',
    extraWording: `[CONCISE ARCHITECTURAL DIRECTIVE]
- Deliver structured, high-density engineering specifications with elegant organization.
- Keep prose concise and prioritize code, tables, and exact type contracts.`,
  },

  'mixtral-8x7b-32768': {
    modelId: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B (Groq)',
    tier: 'mid',
    temperature: 0.45,
    numExamples: 2,
    provider: 'groq',
    maxTokens: 3000,
    aliases: ['mixtral-8x7b', 'groq-mixtral'],
    notes: 'MoE architecture via Groq; fast, structured output.',
    extraWording: `[FOCUSED SPECIFICATION DIRECTIVE]
- Adhere strictly to the chosen blueprint format.
- Output complete code without truncating. Omit conversational filler.`,
  },

  'nvidia/llama-3.1-nemotron-70b-instruct:free': {
    modelId: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    name: 'Nemotron 70B (Free)',
    tier: 'mid',
    temperature: 0.5,
    numExamples: 2,
    provider: 'openrouter',
    maxTokens: 3500,
    aliases: ['nvidia/nemotron-70b'],
    notes: 'Nvidia fine-tuned Llama 3.1 70B; strong instruction following and reasoning.',
    extraWording: `[HIGH ACCURACY DIRECTIVE]
- Follow all directives and constraints with meticulous accuracy.
- Provide comprehensive architectural coverage with concrete implementation steps.`,
  },

  'hf/Qwen/Qwen2.5-72B-Instruct': {
    modelId: 'hf/Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    tier: 'mid',
    temperature: 0.45,
    numExamples: 2,
    provider: 'huggingface',
    maxTokens: 3500,
    aliases: ['qwen-2.5-72b', 'hf/qwen-72b'],
    notes: 'High-capability 72B open weights model; strong at math, code, and structured output.',
    extraWording: `[COMPREHENSIVE ENGINEERING DIRECTIVE]
- Output production-grade specifications with rigorous schema validation.
- Zero conversational fluff.`,
  },

  // --------------------------------------------------------------------------
  // FRONTIER & STRONGEST MODELS (Tier: 'frontier')
  // Tuning: Higher temp (0.6 - 0.7), Minimal examples (1), Light empowering wording
  // --------------------------------------------------------------------------
  'claude-3-5-sonnet': {
    modelId: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    tier: 'frontier',
    temperature: 0.7,
    numExamples: 1,
    provider: 'openrouter',
    maxTokens: 8192,
    aliases: ['anthropic/claude-3.5-sonnet', 'claude-3.5-sonnet', 'claude-sonnet'],
    notes: 'World-class reasoning & coding; 1 few-shot is optimal. Does not need heavy guardrails, benefits from empowering creative-technical freedom.',
    extraWording: `[FRONTIER SYNTHESIS DIRECTIVE]
- Exercise principal architect craftsmanship: provide bespoke, elegant systems design with complete contracts and verification protocols.
- Skip basic tutorials and conversational filler; jump directly into high-signal engineering specifications.`,
  },

  'claude-3-5-haiku': {
    modelId: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    tier: 'frontier',
    temperature: 0.6,
    numExamples: 2,
    provider: 'openrouter',
    maxTokens: 4096,
    aliases: ['anthropic/claude-3.5-haiku', 'claude-haiku'],
    notes: 'Ultra-fast frontier tier model; balanced temperature and high-velocity precision.',
    extraWording: `[RAPID FRONTIER DIRECTIVE]
- Combine swift execution with sharp architectural accuracy.
- Produce dense, actionable specifications with zero fluff.`,
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
    notes: 'OpenAI flagship model; handles intricate specifications with ease using 1 anchor example.',
    extraWording: `[ENTERPRISE ARCHITECT DIRECTIVE]
- Deliver publication-grade technical specifications with complete TypeScript/Zod schemas.
- Cover critical failure modes, optimistic updates, and end-to-end verification workflows.`,
  },

  'gpt-4-turbo': {
    modelId: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    tier: 'frontier',
    temperature: 0.65,
    numExamples: 1,
    provider: 'openai',
    maxTokens: 4096,
    aliases: ['openai/gpt-4-turbo'],
    notes: 'High-capability frontier model; 1 example sufficient.',
    extraWording: `[TECHNICAL SPECIFICATION DIRECTIVE]
- Write complete, robust architectural blueprints with verified syntax and zero lazy shortcuts.`,
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
    notes: 'Frontier reasoning model; deep step-by-step thinking. Light guidance lets reasoning shine.',
    extraWording: `[REASONING & SYNTHESIS DIRECTIVE]
- Reason thoroughly through system trade-offs, state transitions, and edge cases before outputting the final specification.
- Deliver definitive, logically sound architectural blueprints.`,
  },

  'deepseek-r1-distill-llama-70b': {
    modelId: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B (Groq)',
    tier: 'frontier',
    temperature: 0.6,
    numExamples: 1,
    provider: 'groq',
    maxTokens: 4096,
    aliases: ['deepseek-r1-70b', 'r1-distill-70b'],
    notes: 'Distilled reasoning model on Groq hardware; ultra-fast with high cognitive depth.',
    extraWording: `[REASONING-DRIVEN DIRECTIVE]
- Provide rigorous logical breakdowns and complete schema contracts.
- Eliminate conversational wrapper; output direct engineering specifications.`,
  },

  'grok-3': {
    modelId: 'grok-3',
    name: 'Grok 3 (xAI)',
    tier: 'frontier',
    temperature: 0.65,
    numExamples: 1,
    provider: 'openrouter',
    maxTokens: 8192,
    aliases: ['x-ai/grok-3', 'grok-2', 'grok-1.5'],
    notes: 'xAI flagship model; high reasoning and candid precision.',
    extraWording: `[FRONTIER INTELLIGENCE DIRECTIVE]
- Deliver cutting-edge, uncompromising engineering blueprints with real-world clarity.
- Focus on practical, highly actionable patterns with zero unnecessary bureaucracy.`,
  },

  'command-r-plus': {
    modelId: 'command-r-plus',
    name: 'Command R+',
    tier: 'frontier',
    temperature: 0.6,
    numExamples: 1,
    provider: 'openrouter',
    maxTokens: 4096,
    aliases: ['cohere/command-r-plus', 'command-r'],
    notes: 'Cohere frontier enterprise model; outstanding retrieval and document synthesis.',
    extraWording: `[ENTERPRISE SYNTHESIS DIRECTIVE]
- Structure documentation with immaculate typography and clear section hierarchies.
- Ensure all business objectives and technical requirements align seamlessly.`,
  },
};

// ============================================================================
// DEFAULT TIER CONFIGURATIONS (Fallback for Unregistered Models)
// ============================================================================

export const TIER_DEFAULTS: Record<ModelTier, Omit<ModelTuningConfig, 'modelId' | 'name'>> = {
  compact: {
    tier: 'compact',
    temperature: 0.25,
    numExamples: 3,
    maxTokens: 2048,
    extraWording: `[STRICT COMPLIANCE DIRECTIVE - ZERO TOLERANCE FOR FORMAT DRIFT]
1. Follow the exact requested schema and format without deviation.
2. Absolutely no conversational filler or preambles. Output only the requested document.
3. Write complete code without lazy placeholders (no // TODO or truncated stubs).
4. Strictly obey all negative constraints.`,
  },
  mid: {
    tier: 'mid',
    temperature: 0.5,
    numExamples: 2,
    maxTokens: 4096,
    extraWording: `[ARCHITECTURAL PRECISION DIRECTIVE]
- Ground all specifications in modern, production-proven standards.
- Provide complete, syntactically valid type definitions and actionable contracts.
- Omit conversational preamble; deliver concise, high-density technical instructions.`,
  },
  frontier: {
    tier: 'frontier',
    temperature: 0.7,
    numExamples: 1,
    maxTokens: 8192,
    extraWording: `[FRONTIER SYNTHESIS DIRECTIVE]
- Exercise principal architect craftsmanship: provide bespoke, elegant systems design with complete contracts and verification protocols.
- Skip basic tutorials and conversational filler; prioritize bespoke, high-leverage engineering decisions.`,
  },
};

// ============================================================================
// MODEL TUNING LOOKUP & RESOLUTION
// ============================================================================

/**
 * Normalizes a model identifier string for lookup.
 */
function normalizeModelId(rawId: string): string {
  return rawId.toLowerCase().trim();
}

/**
 * Classifies an unknown model ID into a capability tier using heuristic pattern matching.
 */
export function classifyModelTier(modelId: string): ModelTier {
  const norm = normalizeModelId(modelId);

  // Weaker / Compact patterns (8b, 7b, mini, lite, instant, small, nano, flash-lite)
  if (
    /(8b|7b|3b|1b|mini|lite|instant|small|nano|haiku-instant|flash-lite)/i.test(norm) &&
    !/(70b|72b|large|pro|plus|ultra)/i.test(norm)
  ) {
    return 'compact';
  }

  // Frontier patterns (sonnet, opus, 4o, r1, grok, command-r-plus, 405b, frontier, o1, o3)
  if (
    /(sonnet|opus|gpt-4o|gpt-4-turbo|deepseek-r1|r1|grok|command-r-plus|405b|frontier|o1|o3)/i.test(norm) &&
    !/(mini|lite|instant)/i.test(norm)
  ) {
    return 'frontier';
  }

  // Default to mid-tier (70b, versatile, flash, chat, mixtral, etc.)
  return 'mid';
}

/**
 * Retrieves the tuning configuration for a specific model ID.
 * Resolves exact matches, aliases, and pattern-matched tier defaults.
 */
export function getModelTuning(modelId = 'auto'): ModelTuningConfig {
  const norm = normalizeModelId(modelId);

  // 1. Direct exact match
  if (MODEL_TUNING_TABLE[norm]) {
    return MODEL_TUNING_TABLE[norm];
  }

  // 2. Check by alias or stripped prefix (e.g. "openai/gpt-4o" vs "gpt-4o")
  const stripped = norm.replace(/^(openai|anthropic|meta-llama|deepseek|mistralai|hf|nvidia|google|cohere|x-ai)\//i, '');
  if (MODEL_TUNING_TABLE[stripped]) {
    return MODEL_TUNING_TABLE[stripped];
  }

  for (const config of Object.values(MODEL_TUNING_TABLE)) {
    if (config.aliases?.some((alias) => normalizeModelId(alias) === norm || normalizeModelId(alias) === stripped)) {
      return config;
    }
  }

  // 3. Fallback based on pattern-matched tier classification
  const tier = classifyModelTier(norm);
  const defaults = TIER_DEFAULTS[tier];

  return {
    modelId: norm,
    name: norm.toUpperCase(),
    tier,
    temperature: defaults.temperature,
    numExamples: defaults.numExamples,
    extraWording: defaults.extraWording,
    maxTokens: defaults.maxTokens,
  };
}

// ============================================================================
// CALL LLM OPTIONS & INTERFACES
// ============================================================================

export interface CallLLMOptions {
  /** Optional system prompt override */
  systemPrompt?: string;
  /** Explicit temperature override; if omitted, uses the model's tuned temperature */
  temperature?: number;
  /** Few-shot examples to include. Sliced automatically according to tuning.numExamples! */
  fewShotExamples?: FewShotExample[];
  /** Extra wording override or additions */
  extraWordingOverride?: string;
  /** Streaming token callback */
  onToken?: (token: string) => void;
  /** Specific provider override */
  preferredProvider?: 'gemini' | 'groq' | 'openai' | 'anthropic' | 'openrouter' | 'huggingface';
  /** Custom max tokens */
  maxTokens?: number;
  /** Signal for cancellation */
  signal?: AbortSignal;
  /** Target blueprint/use case type (e.g. 'coding_agent', 'image_generation', 'video_generation', etc.) */
  targetType?: string;
  /** User's initial project idea (used for domain-grounding and distinguishing creative vs code requests) */
  userIdea?: string;
  /** Enable strict validation against schema & forbidden-term list with automatic single repair retry */
  validateAndRetry?: boolean;
}

export interface CallLLMResult {
  text: string;
  modelId: string;
  tuning: ModelTuningConfig;
  temperatureUsed: number;
  examplesCount: number;
  extraWordingApplied: string;
  provider: string;
  latencyMs: number;
  validationPassed?: boolean;
  repaired?: boolean;
  validationIssues?: string[];
}

// ============================================================================
// PROMPT MERGER & TUNING BUILDER
// ============================================================================

/**
 * Builds the effective system prompt and user prompt by merging the model's tuning parameters:
 * - Injects extra wording (stricter for weaker models, lighter for stronger models)
 * - Slices few-shot examples to tuning.numExamples
 * - Enforces Bedrock core guardrails
 */
export function buildTunedPrompt(
  userPrompt: string,
  modelTuning: ModelTuningConfig,
  purpose: LLMPurpose = 'general',
  options?: CallLLMOptions
): {
  effectiveSystemPrompt: string;
  effectiveUserPrompt: string;
  temperature: number;
  examplesUsedCount: number;
} {
  // 1. Resolve Temperature: explicit option > model tuned default adjusted by target domain
  const targetType = options?.targetType || 'coding_agent';
  let rawTemp = options?.temperature !== undefined ? options.temperature : modelTuning.temperature;
  let temperature = rawTemp;
  if (options?.targetType) {
    if (targetType === 'coding_agent' || targetType === 'full_stack' || targetType === 'cli_tool' || targetType === 'coding-agent') {
      temperature = Math.min(0.2, rawTemp);
    } else if (targetType === 'freelance_brief' || targetType === 'freelancer_brief' || targetType === 'freelance-brief') {
      temperature = Math.min(0.3, rawTemp);
    } else if (targetType === 'writing') {
      temperature = Math.min(0.45, rawTemp);
    } else if (targetType === 'image_generation' || targetType === 'video_generation' || targetType === 'image-prompt' || targetType === 'video-generation') {
      temperature = Math.min(0.7, Math.max(0.6, rawTemp));
    }
  }

  // 2. Resolve Few-Shot Examples: Slice strictly to tuning.numExamples
  const rawExamples = options?.fewShotExamples || [];
  const effectiveExamples = rawExamples.slice(0, modelTuning.numExamples);

  // 3. Resolve Extra Wording: model tuning extra wording + any caller additions
  const extraWording = options?.extraWordingOverride
    ? `${modelTuning.extraWording}\n\n${options.extraWordingOverride}`
    : modelTuning.extraWording;

  // 4. Construct Purpose Context, Domain Guardrails & RAG Grounded Facts
  const purposeContext = purpose !== 'general' ? `[TASK PURPOSE: ${purpose.toUpperCase()}]` : '';
  const domainGuardrails = resolveDomainGuardrails(targetType);
  const ragFacts = getGroundedFacts(userPrompt, targetType);
  const ragBlock = ragFacts.groundedFactsBlock ? ragFacts.groundedFactsBlock : '';

  // 5. Build Effective System Prompt
  const baseSystem = options?.systemPrompt || 'You are Bedrock’s Principal System Architect and Prompt Engineer.';
  const effectiveSystemPrompt = [
    baseSystem,
    domainGuardrails,
    ragBlock,
    purposeContext,
    extraWording,
  ]
    .filter(Boolean)
    .join('\n\n');

  // 6. Build Effective User Prompt (incorporating sliced few-shot examples)
  let effectiveUserPrompt = userPrompt;
  if (effectiveExamples.length > 0) {
    const formattedExamples = effectiveExamples
      .map((ex, index) => {
        const header = ex.title ? `### Example ${index + 1}: ${ex.title}` : `### Example ${index + 1}`;
        return `${header}\n**Input:**\n${ex.input}\n\n**Output:**\n${ex.output}`;
      })
      .join('\n\n---\n\n');

    effectiveUserPrompt = `## REFERENCE EXAMPLES (${effectiveExamples.length} Selected for Model Optimization):\n\n${formattedExamples}\n\n---\n\n## CURRENT TASK:\n${userPrompt}`;
  }

  return {
    effectiveSystemPrompt,
    effectiveUserPrompt,
    temperature,
    examplesUsedCount: effectiveExamples.length,
  };
}

// ============================================================================
// CORE CALL LLM DISPATCHER
// ============================================================================

/**
 * Universal callLLM abstraction with per-model tuning merged inside:
 *
 * 1. Looks up tuning configuration for target modelId
 * 2. Merges temperature (lower for compact, optimal for frontier)
 * 3. Filters few-shot examples strictly to modelTuning.numExamples (more for compact, fewer for frontier)
 * 4. Injects model-tuned extra wording (stricter for weaker models, lighter for stronger models)
 * 5. Dispatches request to the appropriate provider client with streaming support
 *
 * @param prompt The user prompt string or task description
 * @param modelId Target model identifier (e.g. 'llama-3.1-8b-instant', 'gpt-4o', 'gemini-flash-latest')
 * @param purpose Purpose of the call ('questions' | 'synthesize' | 'refine' | 'test' | 'classify' | 'plan' | 'general')
 * @param options Additional options (fewShotExamples, temperature override, onToken streaming, systemPrompt)
 * @returns Resolves to completion text
 */
export async function callLLM(
  prompt: string,
  modelId = 'auto',
  purpose: LLMPurpose = 'general',
  options?: CallLLMOptions
): Promise<string> {
  const result = await callLLMWithMeta(prompt, modelId, purpose, options);
  return result.text;
}

/**
 * Full execution telemetry version of callLLM that returns detailed metadata along with output text.
 */
export async function callLLMWithMeta(
  prompt: string,
  modelId = 'auto',
  purpose: LLMPurpose = 'general',
  options?: CallLLMOptions
): Promise<CallLLMResult> {
  const startTime = Date.now();
  const keys = getActiveApiKeys();

  // 1. Resolve Target Model & Tuning Configuration
  let effectiveModelId = modelId;
  if (!effectiveModelId || effectiveModelId === 'auto') {
    // Smart auto-selection based on available keys
    if (keys.geminiKey) effectiveModelId = 'gemini-flash-latest';
    else if (keys.groqKey) effectiveModelId = 'llama-3.3-70b-versatile';
    else if (keys.openAiKey) effectiveModelId = 'gpt-4o';
    else if (keys.openRouterKey) effectiveModelId = 'openai/gpt-4o-mini';
    else effectiveModelId = 'gemini-flash-latest';
  }

  // 1.5 Security & Subscription Guard: Verify user's plan permits target model
  const tuning = getModelTuning(effectiveModelId);

  // 2. Build Tuned Prompt & Merge All Parameters
  const {
    effectiveSystemPrompt,
    effectiveUserPrompt,
    temperature,
    examplesUsedCount,
  } = buildTunedPrompt(prompt, tuning, purpose, options);

  // 3. Provider Routing & Execution
  const callResult = await dispatchProviderCall(
    effectiveModelId,
    tuning,
    effectiveUserPrompt,
    effectiveSystemPrompt,
    temperature,
    keys,
    options
  );
  let text = callResult.text;
  let providerUsed = callResult.providerUsed;

  // 4. Section 3: Validation and Single Repair Retry Protocol
  let validationPassed = true;
  let repaired = false;
  let validationIssues: string[] = [];

  const shouldValidate =
    options?.validateAndRetry ??
    (purpose === 'synthesize' || purpose === 'questions');

  if (shouldValidate) {
    const targetType = options?.targetType || 'coding_agent';
    const userIdea = options?.userIdea || prompt;

    if (purpose === 'questions') {
      const qVal = validateQuestionsOutput(text, targetType, userIdea);
      if (!qVal.isValid) {
        validationPassed = false;
        validationIssues = qVal.issues.map((i: ValidationIssue) => i.message);
        console.warn(
          `[Bedrock Quality Validation] Questions failed validation (${validationIssues.join('; ')}). Initiating single repair retry...`
        );

        const repair = buildRepairMessage({
          previousOutput: text,
          validation: qVal,
          targetType,
          userIdea,
          mode: 'questions',
        });

        try {
          const retryRes = await dispatchProviderCall(
            effectiveModelId,
            tuning,
            repair.repairUserPrompt,
            repair.repairSystemPrompt,
            Math.min(0.2, temperature),
            keys,
            options
          );

          const retryVal = validateQuestionsOutput(retryRes.text, targetType, userIdea);
          if (retryVal.isValid) {
            text = retryRes.text;
            repaired = true;
            validationPassed = true;
            console.log('[Bedrock Quality Validation] Questions repair retry succeeded!');
          } else {
            console.warn('[Bedrock Quality Validation] Repair retry still had issues, retaining best effort output.');
          }
        } catch (retryErr) {
          console.error('[Bedrock Quality Validation] Questions repair retry call failed:', retryErr);
        }
      }
    } else if (purpose === 'synthesize') {
      const sVal = validateSynthesisOutput(text, targetType, userIdea);
      if (!sVal.isValid) {
        validationPassed = false;
        validationIssues = sVal.issues.map((i: ValidationIssue) => i.message);
        console.warn(
          `[Bedrock Quality Validation] Synthesis failed validation (${validationIssues.join('; ')}). Initiating single repair retry...`
        );

        const repair = buildRepairMessage({
          previousOutput: text,
          validation: sVal,
          targetType,
          userIdea,
          mode: 'synthesis',
        });

        try {
          const retryRes = await dispatchProviderCall(
            effectiveModelId,
            tuning,
            repair.repairUserPrompt,
            repair.repairSystemPrompt,
            Math.min(0.25, temperature),
            keys,
            options
          );

          const retryVal = validateSynthesisOutput(retryRes.text, targetType, userIdea);
          if (retryVal.isValid || retryVal.issues.length < sVal.issues.length) {
            text = retryRes.text;
            repaired = true;
            validationPassed = retryVal.isValid;
            console.log('[Bedrock Quality Validation] Synthesis repair retry applied!');
          }
        } catch (retryErr) {
          console.error('[Bedrock Quality Validation] Synthesis repair retry call failed:', retryErr);
        }

        // Apply final deterministic sanitization (strip conversational fluff, leaked json wrappers)
        text = sanitizePromptOutput(text);
      }
    }
  }

  const latencyMs = Date.now() - startTime;

  return {
    text,
    modelId: effectiveModelId,
    tuning,
    temperatureUsed: temperature,
    examplesCount: examplesUsedCount,
    extraWordingApplied: tuning.extraWording,
    provider: providerUsed,
    latencyMs,
    validationPassed,
    repaired,
    validationIssues,
  };
}

/**
 * Intelligently maps friendly model names and legacy identifiers to valid active OpenRouter models.
 */
function resolveOpenRouterModelId(modelId: string): string {
  if (modelId.includes('/')) return modelId;
  const lower = modelId.toLowerCase();
  if (lower.includes('claude-3-5-haiku') || lower.includes('claude-haiku')) return 'anthropic/claude-haiku-5.5';
  if (lower.startsWith('claude')) return 'anthropic/claude-sonnet-5.5';
  if (lower.includes('gpt-4o-mini') || lower.includes('gpt-3.5')) return 'openai/gpt-4o-mini';
  if (lower.includes('gpt-4o') || lower.includes('gpt-4')) return 'openai/gpt-4o';
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistralai/mistral-large';
  if (lower.includes('llama')) return 'meta-llama/llama-3.3-70b-instruct';
  if (lower.includes('sonar') || lower.includes('perplexity')) return 'perplexity/sonar';
  if (lower.includes('grok')) return 'x-ai/grok-2';
  if (lower.includes('nemotron')) return 'nvidia/nemotron-3-ultra-550b-a55b:free';
  if (lower.includes('poolside')) return 'poolside/laguna-s-2.1:free';
  return `openai/${modelId}`;
}

/**
 * Dispatches an inference request to the resolved provider adapter.
 */
async function dispatchProviderCall(
  effectiveModelId: string,
  tuning: ModelTuningConfig,
  effectiveUserPrompt: string,
  effectiveSystemPrompt: string,
  temperature: number,
  keys: ReturnType<typeof getActiveApiKeys>,
  options?: CallLLMOptions
): Promise<{ text: string; providerUsed: string }> {
  const lowerModel = effectiveModelId.toLowerCase();
  const onToken = options?.onToken;
  let text = '';
  let providerUsed = tuning.provider || 'unknown';

  // A. Local Ollama Runtime (Air-gapped private inference)
  if (lowerModel.startsWith('ollama/') || lowerModel.includes('ollama')) {
    providerUsed = 'Ollama Local';
    text = await callOllamaDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.ollamaEndpoint || 'http://localhost:11434',
      effectiveModelId,
      temperature,
      onToken
    );
  }
  // B. Perplexity AI (Sonar Live Grounding)
  else if (
    (lowerModel.startsWith('sonar') || lowerModel.includes('perplexity')) &&
    keys.perplexityKey
  ) {
    providerUsed = 'Perplexity AI';
    text = await callPerplexityDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.perplexityKey,
      effectiveModelId,
      temperature,
      onToken
    );
  }
  // C. Google Gemini
  else if (
    (options?.preferredProvider === 'gemini' ||
      tuning.provider === 'gemini' ||
      lowerModel.includes('gemini')) &&
    keys.geminiKey
  ) {
    providerUsed = 'Google Gemini';
    const targetGemini =
      lowerModel === 'gemini' || lowerModel === 'gemini-2.5-flash'
        ? 'gemini-3.5-flash-lite'
        : effectiveModelId;

    text = await callGeminiDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.geminiKey,
      targetGemini,
      temperature,
      onToken
    );
  }
  // D. Groq (Qwen, GPT-OSS, DeepSeek, Mixtral)
  else if (
    (options?.preferredProvider === 'groq' ||
      tuning.provider === 'groq' ||
      lowerModel.includes('groq') ||
      lowerModel.includes('mixtral') ||
      lowerModel.includes('qwen') ||
      lowerModel.includes('gpt-oss') ||
      lowerModel.includes('deepseek-r1-distill') ||
      (lowerModel.includes('llama') && !keys.openRouterKey)) &&
    keys.groqKey
  ) {
    providerUsed = 'Groq';
    const targetGroq =
      effectiveModelId === 'llama' || effectiveModelId === 'groq' || lowerModel.includes('llama')
        ? 'qwen/qwen3.8-27b'
        : effectiveModelId;

    text = await callGroqDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.groqKey,
      targetGroq,
      temperature,
      onToken
    );
  }
  // C. OpenAI Direct
  else if (
    (options?.preferredProvider === 'openai' ||
      tuning.provider === 'openai' ||
      (lowerModel.startsWith('gpt-') && !lowerModel.includes('/'))) &&
    keys.openAiKey
  ) {
    providerUsed = 'OpenAI';
    text = await callOpenAiDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.openAiKey,
      effectiveModelId,
      temperature,
      onToken
    );
  }
  // D. Hugging Face with resilient zero-cost fallback
  else if (
    (effectiveModelId.startsWith('hf/') || tuning.provider === 'huggingface') &&
    keys.huggingFaceKey
  ) {
    providerUsed = 'Hugging Face';
    try {
      text = await callHuggingFaceDirect(
        effectiveUserPrompt,
        effectiveSystemPrompt,
        keys.huggingFaceKey,
        effectiveModelId.replace(/^hf\//, ''),
        temperature
      );
    } catch (hfErr) {
      console.warn('[Bedrock] Hugging Face serverless unavailable, routing to OpenRouter free:', hfErr);
      if (keys.openRouterKey) {
        providerUsed = 'OpenRouter (HF Free Fallback)';
        const fallbackTarget = resolveOpenRouterModelId(effectiveModelId);
        text = await callOpenRouterDirect(
          effectiveUserPrompt,
          effectiveSystemPrompt,
          keys.openRouterKey,
          fallbackTarget,
          temperature,
          onToken
        );
      } else if (keys.groqKey) {
        providerUsed = 'Groq (HF Fallback)';
        text = await callGroqDirect(
          effectiveUserPrompt,
          effectiveSystemPrompt,
          keys.groqKey,
          'qwen/qwen3.8-27b',
          temperature,
          onToken
        );
      } else {
        throw hfErr;
      }
    }
  }
  // E. OpenRouter (Frontier Multi-Model Router for Claude, GPT, Grok, etc.)
  else if (keys.openRouterKey) {
    providerUsed = 'OpenRouter';
    const targetOpenRouter = resolveOpenRouterModelId(effectiveModelId);

    text = await callOpenRouterDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.openRouterKey,
      targetOpenRouter,
      temperature,
      onToken
    );
  }
  // F. Fallback: Any configured key
  else if (keys.geminiKey) {
    providerUsed = 'Google Gemini (Fallback)';
    text = await callGeminiDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.geminiKey,
      'gemini-flash-latest',
      temperature,
      onToken
    );
  } else if (keys.groqKey) {
    providerUsed = 'Groq (Fallback)';
    text = await callGroqDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.groqKey,
      'llama-3.3-70b-versatile',
      temperature,
      onToken
    );
  } else if (keys.openAiKey) {
    providerUsed = 'OpenAI (Fallback)';
    text = await callOpenAiDirect(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      keys.openAiKey,
      'gpt-4o-mini',
      temperature,
      onToken
    );
  }
  // G. Backend API Proxy Fallback
  else {
    providerUsed = 'Bedrock Backend Proxy';
    text = await callBackendProxy(
      effectiveUserPrompt,
      effectiveSystemPrompt,
      effectiveModelId,
      temperature,
      onToken
    );
  }

  return { text, providerUsed };
}

// ============================================================================
// DIRECT CLIENT TRANSPORT ADAPTERS
// ============================================================================

async function callOllamaDirect(
  prompt: string,
  systemPrompt?: string,
  endpoint = 'http://localhost:11434',
  targetModel = 'llama3.2',
  temperature = 0.7,
  onToken?: (token: string) => void
): Promise<string> {
  const cleanModel = targetModel.replace(/^ollama\//, '');
  const url = `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;
  const isStreaming = typeof onToken === 'function';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cleanModel,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
        stream: isStreaming,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new ApiError(`Ollama local error (${response.status}): ${errText}`, false, 'Ollama Local');
    }

    if (isStreaming && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            const chunk = json.choices?.[0]?.delta?.content || '';
            if (chunk) {
              accumulated += chunk;
              onToken(chunk);
            }
          } catch {}
        }
      }
      if (accumulated) return accumulated;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      `Cannot connect to Ollama at ${endpoint}. Please ensure Ollama is installed and running ('ollama serve').`,
      false,
      'Ollama Local'
    );
  }
}

async function callPerplexityDirect(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'sonar-pro',
  temperature = 0.7,
  onToken?: (token: string) => void
): Promise<string> {
  const isStreaming = typeof onToken === 'function';
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature,
      stream: isStreaming,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const parsed = parseApiErrorResponse('Perplexity', response.status, errText);
    throw parsed;
  }

  if (isStreaming && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;
        try {
          const json = JSON.parse(dataStr);
          const chunk = json.choices?.[0]?.delta?.content || '';
          if (chunk) {
            accumulated += chunk;
            onToken(chunk);
          }
        } catch {}
      }
    }
    if (accumulated) return accumulated;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGeminiDirect(
  prompt: string,
  systemInstruction?: string,
  apiKey?: string,
  targetModel = 'gemini-3.5-flash-lite',
  temperature = 0.7,
  onToken?: (token: string) => void
): Promise<string> {
  const normalized =
    targetModel === 'gemini-flash-latest' ||
    targetModel.includes('2.5') ||
    targetModel.includes('1.5') ||
    targetModel.includes('3.8')
      ? 'gemini-3.5-flash-lite'
      : targetModel;

  const modelsToTry = [
    normalized,
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemma-4-26b-a4b-it',
  ];
  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: Error | null = null;
  const isStreaming = typeof onToken === 'function';

  for (const model of uniqueModels) {
    try {
      const endpoint = isStreaming ? 'streamGenerateContent?alt=sse&key=' : 'generateContent?key=';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}${apiKey}`;
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        if (isStreaming && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const json = JSON.parse(dataStr);
                const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (chunk) {
                  accumulated += chunk;
                  onToken(chunk);
                }
              } catch {
                // Ignore parse errors on SSE chunks
              }
            }
          }
          if (accumulated) return accumulated;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }

      const errText = await response.text();
      const parsedErr = parseApiErrorResponse('Google Gemini', response.status, errText);
      if (parsedErr.isApiKeyError) throw parsedErr;
      lastError = parsedErr;
    } catch (err: any) {
      if (err.isApiKeyError) throw err;
      lastError = err;
    }
  }

  throw lastError || new ApiError('Failed to generate response from Google Gemini', false, 'Google Gemini');
}

async function callGroqDirect(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'qwen/qwen3.8-27b',
  temperature = 0.5,
  onToken?: (token: string) => void
): Promise<string> {
  const modelsToTry = [
    targetModel.includes('llama') ? 'qwen/qwen3.8-27b' : targetModel,
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
  ];
  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: Error | null = null;
  const isStreaming = typeof onToken === 'function';

  for (const model of uniqueModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
          stream: isStreaming,
        }),
      });

      if (response.ok) {
        if (isStreaming && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const json = JSON.parse(dataStr);
                const chunk =
                  json.choices?.[0]?.delta?.content ||
                  json.choices?.[0]?.delta?.reasoning ||
                  '';
                if (chunk) {
                  accumulated += chunk;
                  onToken(chunk);
                }
              } catch {
                // Ignore partial chunks
              }
            }
          }
          if (accumulated) return accumulated;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning;
        if (text) return text;
      }

      const errText = await response.text();
      const parsedErr = parseApiErrorResponse('Groq', response.status, errText);
      if (parsedErr.isApiKeyError) throw parsedErr;
      lastError = parsedErr;
    } catch (err: any) {
      if (err.isApiKeyError) throw err;
      lastError = err;
    }
  }

  throw lastError || new ApiError('Failed to generate response from Groq', false, 'Groq');
}

async function callOpenAiDirect(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'gpt-4o',
  temperature = 0.7,
  onToken?: (token: string) => void
): Promise<string> {
  const models = [targetModel, 'gpt-4o-mini', 'gpt-4o'];
  const uniqueModels = Array.from(new Set(models));
  let lastError: Error | null = null;
  const isStreaming = typeof onToken === 'function';

  for (const model of uniqueModels) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
          stream: isStreaming,
        }),
      });

      if (response.ok) {
        if (isStreaming && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;
              try {
                const json = JSON.parse(dataStr);
                const chunk = json.choices?.[0]?.delta?.content || '';
                if (chunk) {
                  accumulated += chunk;
                  onToken(chunk);
                }
              } catch {
                // Ignore partial chunk
              }
            }
          }
          if (accumulated) return accumulated;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }

      const errText = await response.text();
      const parsedErr = parseApiErrorResponse('OpenAI', response.status, errText);
      if (parsedErr.isApiKeyError) throw parsedErr;
      lastError = parsedErr;
    } catch (err: any) {
      if (err.isApiKeyError) throw err;
      lastError = err;
    }
  }

  throw lastError || new ApiError('Failed to generate response from OpenAI', false, 'OpenAI');
}

async function callOpenRouterDirect(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'openai/gpt-4o-mini',
  temperature = 0.7,
  onToken?: (token: string) => void
): Promise<string> {
  const isStreaming = typeof onToken === 'function';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bedrock.app',
      'X-Title': 'Bedrock Studio',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature,
      stream: isStreaming,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw parseApiErrorResponse('OpenRouter', response.status, errText);
  }

  if (isStreaming && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;
        try {
          const json = JSON.parse(dataStr);
          const chunk =
            json.choices?.[0]?.delta?.content ||
            json.choices?.[0]?.delta?.reasoning ||
            json.choices?.[0]?.delta?.text ||
            '';
          if (chunk) {
            accumulated += chunk;
            onToken(chunk);
          }
        } catch {
          // Ignore partial
        }
      }
    }
    if (accumulated) return accumulated;
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  return choice?.message?.content || choice?.message?.reasoning || choice?.text || '';
}

async function callHuggingFaceDirect(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  model = 'mistralai/Mistral-7B-Instruct-v0.3',
  temperature = 0.2
): Promise<string> {
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: 2048,
    }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  const errText = await res.text();
  throw parseApiErrorResponse('Hugging Face', res.status, errText);
}

async function callBackendProxy(
  prompt: string,
  systemPrompt?: string,
  targetModel = 'auto',
  temperature = 0.7,
  onToken?: (token: string) => void
): Promise<string> {
  const isStreaming = typeof onToken === 'function';
  const response = await fetch('/api/ai/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(isStreaming ? { Accept: 'text/event-stream' } : {}),
    },
    body: JSON.stringify({
      targetModel,
      systemPrompt,
      prompt,
      temperature,
      stream: isStreaming,
    }),
  });

  if (response.ok) {
    const contentType = response.headers.get('content-type') || '';
    if (isStreaming && contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            if (json.token) {
              accumulated += json.token;
              onToken(json.token);
            }
          } catch {
            // Ignore
          }
        }
      }
      if (accumulated) return accumulated;
    }

    const data = await response.json();
    return data.text || data.content || '';
  }

  throw new ApiError(
    'Please enter your Google Gemini, Groq, or OpenAI API key in Settings to call models directly.',
    true,
    'Bedrock Workspace',
    401
  );
}
