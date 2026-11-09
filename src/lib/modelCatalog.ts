import { isDesktopApp } from './platform';
import { getCachedProviderModels } from './dynamicModelDiscovery';

/** Models offered in Settings > Models. Moved out of the Settings page so other screens can reuse it. */
export interface ModelOption {
  id: string;
  name: string;
  tag?: string;
  tagColor?: string;
}

export interface ModelGroup {
  group: string;
  models: ModelOption[];
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    group: 'Google DeepMind (Recommended)',
    models: [
      { id: 'google/gemini-4-argon', name: 'Gemini 4 Argon', tag: 'Autonomous Reasoning Flagship', tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: 'Deep Multimodal 1M+ Context', tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
      { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash', tag: 'High-Speed Rapid Coding', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Workhorse Multimodal', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tag: 'Zero-Cost Free Tier', tagColor: 'text-gray-300 bg-white/5 border-white/10' },
    ],
  },
  {
    group: 'OpenAI',
    models: [
      { id: 'openai/gpt-6-astra', name: 'GPT-6 Astra', tag: 'Frontier Flagship', tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', tag: 'Agentic Coding & Reasoning', tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
      { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna', tag: 'Fast 1.05M Context', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', tag: 'Balanced Reasoning', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
      { id: 'openai/o1', name: 'OpenAI o1', tag: 'Reasoning Specialist', tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      { id: 'openai/o3-mini', name: 'OpenAI o3-mini', tag: 'High-Speed Math & STEM', tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', tag: 'Omni Industry Benchmark', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast & Lightweight', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
    ],
  },
  {
    group: 'Anthropic',
    models: [
      { id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', tag: 'Frontier Flagship', tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      { id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', tag: 'Deep Reasoning & Coding', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5', tag: 'Ultra-Fast 1M Context', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tag: 'Hybrid Reasoning', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Pro Coding', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', tag: 'Fast', tagColor: 'text-orange-300 bg-orange-500/10 border-orange-500/20' },
    ],
  },
  {
    group: 'DeepSeek',
    models: [
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tag: '671B Reasoning Flagship', tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 Chat', tag: '671B MoE General Benchmark', tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', tag: 'Code Pro', tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    ],
  },
  {
    group: 'Meta (Llama)',
    models: [
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', tag: '405B Parameter Giant', tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', tag: 'State of the Art Open Weights', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    ],
  },
  {
    group: 'Perplexity AI (Live Grounding)',
    models: [
      { id: 'perplexity/sonar-reasoning-pro', name: 'Sonar Reasoning Pro', tag: 'Chain-of-Thought Web Search', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
      { id: 'perplexity/sonar-pro', name: 'Sonar Pro', tag: 'Web Search & Reasoning', tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
      { id: 'sonar', name: 'Sonar', tag: 'Fast Search', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'sonar-huge', name: 'Sonar Huge', tag: 'Deep Synthesis', tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    ],
  },
  {
    group: 'xAI (Grok)',
    models: [
      { id: 'x-ai/grok-4.7', name: 'Grok 4.7 (xAI)', tag: 'Flagship Real-Time Intelligence', tagColor: 'text-neutral-200 bg-white/10 border-white/20' },
      { id: 'x-ai/grok-latest', name: 'Grok Latest', tag: 'Auto-Redirect Flagship', tagColor: 'text-neutral-300 bg-white/5 border-white/10' },
      { id: 'grok-3', name: 'Grok 3 (xAI)', tag: 'Flagship Reasoning', tagColor: 'text-neutral-200 bg-white/10 border-white/20' },
      { id: 'grok-2-1212', name: 'Grok 2 (xAI)', tag: 'Real-Time X', tagColor: 'text-neutral-300 bg-white/5 border-white/10' },
    ],
  },
  {
    group: 'Mistral AI',
    models: [
      { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', tag: 'European Frontier Flagship', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'mistral-large', name: 'Mistral Large 2', tag: 'Flagship', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'codestral-latest', name: 'Codestral', tag: 'Code Spec', tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20' },
    ],
  },
  {
    group: 'Groq (Lightning Fast Open Source)',
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', tag: 'Flagship Zero-Cost', tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20' },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', tag: 'Ultra-Fast Zero-Cost', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', tag: '32k Context MoE', tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20' },
    ],
  },
  {
    group: 'Cohere & Microsoft',
    models: [
      { id: 'command-r-plus', name: 'Cohere Command R+', tag: 'RAG & Search', tagColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
      { id: 'copilot-pro', name: 'Microsoft Copilot Pro', tag: 'Ecosystem', tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    ],
  },
  {
    group: 'Ollama (Local Models)',
    models: [
      { id: 'ollama/llama3.2', name: 'Llama 3.2 (Local)', tag: 'Offline Local', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
      { id: 'ollama/qwen2.5-coder', name: 'Qwen 2.5 Coder (Local)', tag: 'Offline Code', tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
      { id: 'ollama/deepseek-r1', name: 'DeepSeek R1 (Local)', tag: 'Offline Reasoning', tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    ],
  },
];

const GROUP_PROVIDER_MAP: Record<string, string> = {
  'Google DeepMind (Recommended)': 'gemini',
  'OpenAI': 'openai',
  'Anthropic': 'anthropic',
  'DeepSeek': 'deepseek',
  'Meta (Llama)': 'openrouter',
  'Perplexity AI (Live Grounding)': 'perplexity',
  'xAI (Grok)': 'xai',
  'Mistral AI': 'mistral',
  'Groq (Lightning Fast Open Source)': 'groq',
  'Cohere & Microsoft': 'cohere',
  'OpenRouter & Hugging Face': 'openrouter',
  'Ollama (Local Models)': 'ollama',
};

/**
 * Returns model groups.
 * Strict Invariant: On website (isDesktopApp() === false), returns ONLY static curated models.
 * On desktop (isDesktopApp() === true), merges with dynamically discovered BYOK models.
 */
export function getModelGroups(): ModelGroup[] {
  if (!isDesktopApp()) {
    return MODEL_GROUPS;
  }

  return MODEL_GROUPS.map((grp) => {
    const provider = GROUP_PROVIDER_MAP[grp.group];
    if (!provider) return grp;

    const dynamicModels = getCachedProviderModels(provider);
    if (!dynamicModels || dynamicModels.length === 0) return grp;

    const map = new Map<string, ModelOption>();
    for (const m of grp.models) {
      map.set(m.id.toLowerCase(), m);
    }
    for (const dm of dynamicModels) {
      const k = dm.id.toLowerCase();
      if (!map.has(k)) {
        map.set(k, {
          id: dm.id,
          name: dm.name,
          tag: dm.tag,
          tagColor: dm.tagColor,
        });
      }
    }
    return {
      ...grp,
      models: Array.from(map.values()),
    };
  });
}
