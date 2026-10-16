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
import geminiLogoImg from '../../assets/logos/gemini.png';
import grokLogoImg from '../../assets/logos/grok.png';
import cursorLogoImg from '../../assets/logos/cursor.png';
import universalLogoImg from '../../assets/logos/universal.png';
import appleLogoImg from '../../assets/logos/apple.png';

export function AppleLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={appleLogoImg}
      alt="Apple macOS"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function AppleIconSvg({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={cn("fill-current shrink-0", className)} viewBox="0 0 170 170">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.73-14.19-5.99-9.35-10.74-20.2-14.25-32.55-3.51-12.35-5.27-24.08-5.27-35.18 0-14.68 3.73-26.68 11.19-36 7.46-9.31 16.73-14.07 27.81-14.27 4.9 0 10.42 1.25 16.56 3.75 6.14 2.5 10.15 3.79 12.04 3.86 1.48 0 5.66-1.39 12.56-4.16 6.9-2.78 12.7-3.95 17.4-3.52 13.51 1.07 24.16 6.36 31.95 15.86-11.97 7.24-17.84 17.3-17.62 30.17.21 10.22 4.1 18.73 11.66 25.53 7.56 6.8 16.64 10.59 27.24 11.37-2.58 8.04-5.83 16.14-9.76 24.31zM119.22 31.84c0-7.39 2.66-14.28 7.97-20.67 5.32-6.39 11.83-10.45 19.55-12.17.64 1.71.96 3.42.96 5.13 0 7.39-2.77 14.33-8.31 20.84-5.54 6.5-12.18 10.4-19.92 11.7-.1-.95-.25-2.57-.25-4.83z" />
    </svg>
  );
}

export function WindowsLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={cn("fill-current shrink-0", className)} viewBox="0 0 88 88">
      <path d="M0 12.402l35.687-4.86.016 34.423-35.67.202L0 12.402zm35.67 33.529l.028 34.453L.028 75.48l-.02-29.347 35.662-.202zm4.326-39.043L87.914 0v41.526l-47.918.378V6.888zm47.918 38.647L88 87.999l-47.962-6.791-.038-34.195 48.002.046z" />
    </svg>
  );
}

export function GeminiLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={geminiLogoImg}
      alt="Google Gemini"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

export function CursorLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <img
      src={cursorLogoImg}
      alt="Cursor"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
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
    <img
      src={grokLogoImg}
      alt="xAI Grok"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
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
    <img
      src={universalLogoImg}
      alt="Universal"
      draggable={false}
      className={cn("object-contain shrink-0 select-none", className)}
    />
  );
}

/**
 * Returns the matching logo component for any given agent or model key.
 */
export function getLogoComponent(idOrName?: string, fallbackName?: string): React.ComponentType<{ className?: string }> {
  const key = `${idOrName || ''} ${fallbackName || ''}`.toLowerCase().trim();

  // 0. Universal (Global default)
  if (
    key.includes('universal') ||
    key === 'auto' ||
    key.includes('auto-select') ||
    key.includes('all models')
  ) {
    return UniversalLogo;
  }

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

  // 14. Cursor IDE / Cursorrules
  if (key.includes('cursor') || key.includes('cursorrules')) return CursorLogo;

  // 14. Groq
  if (key.includes('groq')) return GroqLogo;

  // 15. Qwen
  if (key.includes('qwen')) return QwenLogo;

  // 16. Ollama
  if (key.includes('ollama')) return OllamaLogo;

  // 17. Apple macOS / Darwin
  if (key.includes('apple') || key.includes('macos') || key.includes('darwin') || key.includes('mac')) return AppleLogo;

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
 * High-res, authentic brand logo for model and agent icons.
 * Clean, borderless presentation so all model icons render crisp, unboxed, and clearly visible.
 */
export function AgentIcon({
  agent,
  model,
  className = "w-4 h-4",
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
        "inline-flex items-center justify-center shrink-0 select-none",
        badgeClassName
      )}
      title={titleText}
    >
      <Logo className={cn("shrink-0 object-contain", className)} />
    </span>
  );
}
