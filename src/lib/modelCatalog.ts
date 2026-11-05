import { getCachedAnthropicModels } from './anthropicModels';

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
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tag: 'Ultra Fast', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', tag: 'Fast', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', tag: 'Balanced', tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Standard', tagColor: 'text-gray-300 bg-white/5 border-white/10' },
    ],
  },
  {
    group: 'Perplexity AI (Live Grounding)',
    models: [
      { id: 'sonar-pro', name: 'Sonar Pro', tag: 'Web Search & Reasoning', tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', tag: 'Chain-of-Thought', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
      { id: 'sonar', name: 'Sonar', tag: 'Fast Search', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'sonar-huge', name: 'Sonar Huge', tag: 'Deep Synthesis', tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    ],
  },
  {
    group: 'Groq (Lightning Fast Open Source)',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: 'Versatile Flagship', tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', tag: 'Ultra-Fast Instant', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', tag: 'Deep Reasoning', tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', tag: '32k Context MoE', tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20' },
    ],
  },
  {
    group: 'Anthropic',
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tag: 'Hybrid Reasoning', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', tag: 'Frontier Flagship', tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', tag: 'Deep Reasoning', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Pro Coding', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', tag: 'Ultra-Fast', tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', tag: 'Fast', tagColor: 'text-orange-300 bg-orange-500/10 border-orange-500/20' },
    ],
  },
  {
    group: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Omni Flagship', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Fast & Lightweight', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
      { id: 'o1', name: 'OpenAI o1', tag: 'Reasoning Specialist', tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
      { id: 'o3-mini', name: 'OpenAI o3-mini', tag: 'High-Speed Math & Code', tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    ],
  },
  {
    group: 'OpenRouter & Hugging Face',
    models: [
      { id: 'openrouter/auto', name: 'OpenRouter Auto', tag: 'Free Tier', tagColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
      { id: 'hf/Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B (HuggingFace)', tag: '72B Weights', tagColor: 'text-copper-300 bg-copper-500/10 border-copper-500/20' },
    ],
  },
  {
    group: 'DeepSeek',
    models: [
      { id: 'deepseek-r1', name: 'DeepSeek R1', tag: 'Reasoning', tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', tag: 'Code Pro', tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
      { id: 'deepseek-chat', name: 'DeepSeek V3 Chat', tag: 'Fast', tagColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    ],
  },
  {
    group: 'Nvidia NIM',
    models: [
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B (Free)', tag: 'Flagship', tagColor: 'text-green-400 bg-green-500/10 border-green-500/20' },
      { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron-4 340B', tag: '340B Frontier', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    ],
  },
  {
    group: 'Mistral AI',
    models: [
      { id: 'mistral-large', name: 'Mistral Large 2', tag: 'Flagship', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
      { id: 'codestral-latest', name: 'Codestral', tag: 'Code Spec', tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20' },
      { id: 'mixtral-8x22b', name: 'Mixtral 8x22B', tag: 'MoE', tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
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
    group: 'xAI (Grok)',
    models: [
      { id: 'grok-3', name: 'Grok 3 (xAI)', tag: 'Flagship Reasoning', tagColor: 'text-neutral-200 bg-white/10 border-white/20' },
      { id: 'grok-2-1212', name: 'Grok 2 (xAI)', tag: 'Real-Time X', tagColor: 'text-neutral-300 bg-white/5 border-white/10' },
      { id: 'grok-beta', name: 'Grok Beta', tag: 'Fast', tagColor: 'text-neutral-400 bg-white/5 border-white/10' },
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

/**
 * Returns model groups merged with dynamically discovered models (e.g. Anthropic BYOK).
 */
export function getModelGroups(): ModelGroup[] {
  const dynamicAnthropic = getCachedAnthropicModels();
  return MODEL_GROUPS.map((grp) => {
    if (grp.group !== 'Anthropic') return grp;
    const map = new Map<string, ModelOption>();
    for (const m of grp.models) map.set(m.id.toLowerCase(), m);
    for (const dm of dynamicAnthropic) {
      const k = dm.id.toLowerCase();
      if (!map.has(k)) {
        map.set(k, { id: dm.id, name: dm.name, tag: dm.tag, tagColor: dm.tagColor });
      }
    }
    return {
      ...grp,
      models: Array.from(map.values()),
    };
  });
}
