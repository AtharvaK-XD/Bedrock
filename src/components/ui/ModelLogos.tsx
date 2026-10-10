import React from 'react';
import { cn } from '../../lib/utils';

// Authentic High-Resolution Brand Assets
import mistralLogoImg from '../../assets/logos/mistral.png';
import cohereLogoImg from '../../assets/logos/cohere.png';
import copilotLogoImg from '../../assets/logos/copilot.png';
import metaLogoImg from '../../assets/logos/meta.png';
import openrouterLogoImg from '../../assets/logos/openrouter.png';
import openaiLogoImg from '../../assets/logos/openai.png';
import claudeLogoImg from '../../assets/logos/claude.png';
import deepseekLogoImg from '../../assets/logos/deepseek.png';
import huggingfaceLogoImg from '../../assets/logos/huggingface.png';
import nvidiaLogoImg from '../../assets/logos/nvidia.png';

export function GeminiLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4E82EE" />
          <stop offset="35%" stopColor="#7B61FF" />
          <stop offset="70%" stopColor="#C060D5" />
          <stop offset="100%" stopColor="#F5576C" />
        </linearGradient>
      </defs>
      <path
        d="M12 24c0-6.627-5.373-12-12-12 6.627 0 12-5.373 12-12 0 6.627 5.373 12 12 12-6.627 0-12 5.373-12 12z"
        fill="url(#gemini-grad)"
      />
    </svg>
  );
}

export function OpenAILogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={openaiLogoImg}
      alt="OpenAI"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function ClaudeLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={claudeLogoImg}
      alt="Anthropic Claude"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function LlamaLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={metaLogoImg}
      alt="Meta Llama"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function MetaLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={metaLogoImg}
      alt="Meta"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function MistralLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={mistralLogoImg}
      alt="Mistral AI"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function DeepSeekLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={deepseekLogoImg}
      alt="DeepSeek"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function HuggingFaceLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={huggingfaceLogoImg}
      alt="Hugging Face"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function NvidiaLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={nvidiaLogoImg}
      alt="Nvidia"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function OpenRouterLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={openrouterLogoImg}
      alt="OpenRouter"
      draggable={false}
      className={cn("object-contain shrink-0 select-none rounded-[3px]", className)}
    />
  );
}

export function CohereLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={cohereLogoImg}
      alt="Cohere"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function CopilotLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={copilotLogoImg}
      alt="Microsoft Copilot"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function PerplexityLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)}>
      <circle cx="12" cy="12" r="9.5" fill="#0A2229" stroke="#20B2AA" strokeWidth="1" />
      <path d="M12 4.5v15M5.5 8.25l13 7.5M5.5 15.75l13-7.5" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="#20B2AA" />
    </svg>
  );
}

export function GrokLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("text-white shrink-0", className)}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function GroqLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)}>
      <circle cx="12" cy="12" r="9.5" fill="#F55036" />
      <path d="M14 6.5L8.5 13.5h4L10 18.5l6.5-7.5h-4.5L14 6.5z" fill="#FFFFFF" />
    </svg>
  );
}

export function OllamaLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)}>
      <circle cx="12" cy="12" r="9.5" fill="#18181B" stroke="white" strokeWidth="1" />
      <path d="M10 6h4v5h2v6h-2v2h-1v-2h-2v2h-1v-2H8v-6h2V6z" fill="#FFFFFF" />
      <circle cx="11" cy="9" r="0.8" fill="#18181B" />
    </svg>
  );
}

export function QwenLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="qwen-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8A2BE2" />
          <stop offset="100%" stopColor="#4A00E0" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9.5" fill="url(#qwen-grad)" />
      <path d="M12 6l5 3v6l-5 3-5-3V9l5-3z" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
    </svg>
  );
}

export function UniversalLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="univ-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9.5" fill="#1C1917" stroke="rgba(245,158,11,0.3)" strokeWidth="1" />
      <path
        d="M12 4c.6 3.5 3.5 6.4 7 7-3.5.6-6.4 3.5-7 7-.6-3.5-3.5-6.4-7-7 3.5-.6 6.4-3.5 7-7z"
        fill="url(#univ-grad)"
      />
      <circle cx="18" cy="6" r="1.5" fill="#FCD34D" />
    </svg>
  );
}

/**
 * Returns the matching logo component for any given agent or model key.
 */
export function getLogoComponent(idOrName?: string, fallbackName?: string): React.ComponentType<{ className?: string }> {
  const key = `${idOrName || ''} ${fallbackName || ''}`.toLowerCase().trim();

  // 1. Nvidia
  if (key.includes('nvidia') || key.includes('nemotron')) return NvidiaLogo;

  // 2. Mistral AI
  if (
    key.includes('mistral') ||
    key.includes('mixtral') ||
    key.includes('codestral') ||
    key.includes('pixtral') ||
    key.includes('ministral')
  ) {
    return MistralLogo;
  }

  // 3. Cohere
  if (
    key.includes('cohere') ||
    key.includes('command-r') ||
    key.includes('command r') ||
    key.includes('command') ||
    key.includes('coral') ||
    key.includes('aya')
  ) {
    return CohereLogo;
  }

  // 4. Microsoft Copilot
  if (
    key.includes('copilot') ||
    key.includes('microsoft') ||
    key.includes('phi-') ||
    key.includes('phi3') ||
    key.includes('phi4')
  ) {
    return CopilotLogo;
  }

  // 5. Meta / Llama
  if (
    key.includes('llama') ||
    key.includes('meta')
  ) {
    return LlamaLogo;
  }

  // 6. OpenRouter
  if (key.includes('openrouter') || key.includes('open-router')) {
    return OpenRouterLogo;
  }

  // 7. OpenAI / ChatGPT
  if (
    key.includes('openai') ||
    key.includes('chatgpt') ||
    key.includes('gpt-') ||
    key.includes('o1-') ||
    key.includes('o3-') ||
    key.includes('o4-') ||
    key.includes('gpt-4') ||
    key.includes('gpt-3') ||
    key.includes('gpt-oss')
  ) {
    return OpenAILogo;
  }

  // 8. Claude / Anthropic
  if (
    key.includes('claude') ||
    key.includes('anthropic') ||
    key.includes('sonnet') ||
    key.includes('haiku') ||
    key.includes('opus')
  ) {
    return ClaudeLogo;
  }

  // 9. DeepSeek
  if (key.includes('deepseek')) return DeepSeekLogo;

  // 10. Hugging Face
  if (key.includes('hugging') || key.includes('hf/') || key.includes('hf-')) {
    return HuggingFaceLogo;
  }

  // 11. Google Gemini
  if (key.includes('gemini') || key.includes('google') || key.includes('gemma')) {
    return GeminiLogo;
  }

  // 12. Perplexity
  if (key.includes('perplexity') || key.includes('sonar')) return PerplexityLogo;

  // 13. Grok / xAI
  if (key.includes('grok') || key.includes('x.ai') || key.includes('xai')) return GrokLogo;

  // 14. Groq
  if (key.includes('groq')) return GroqLogo;

  // 15. Qwen
  if (key.includes('qwen')) return QwenLogo;

  // 16. Ollama
  if (key.includes('ollama')) return OllamaLogo;

  return UniversalLogo;
}

/**
 * Pure image/SVG logo for inline usage without surrounding badge
 */
export function ModelLogo({
  model,
  agentId,
  className = "w-4 h-4",
}: {
  model?: string;
  agentId?: string;
  className?: string;
}) {
  const Logo = getLogoComponent(agentId || model, model);
  return <Logo className={className} />;
}

/**
 * High-res, dark-mode badge with the model's authentic brand logo.
 */
export function AgentIcon({
  agent,
  model,
  className = "w-3.5 h-3.5",
  badgeClassName,
}: {
  agent?: any;
  model?: string;
  className?: string;
  badgeClassName?: string;
}) {
  const modelLogoComp = model ? getLogoComponent(model) : null;
  const isModelSpecific = modelLogoComp && modelLogoComp !== UniversalLogo;
  
  const Logo = isModelSpecific
    ? modelLogoComp
    : getLogoComponent(agent?.id || agent?.name || model, agent?.name || model);

  const titleText = agent?.name || model || agent?.id || '';

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-md bg-white/[0.08] border border-white/10 shadow-sm overflow-hidden select-none p-0.5",
        badgeClassName
      )}
      title={titleText}
    >
      <Logo className={cn("shrink-0", className)} />
    </span>
  );
}
