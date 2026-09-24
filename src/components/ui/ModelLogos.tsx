import React from 'react';
import { cn } from '../../lib/utils';

export function GeminiLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
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
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("text-emerald-400", className)}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1635a.0804.0804 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4018-.6863zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1635a.0804.0804 0 0 1-.038-.0567V6.0748a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.4598a.7948.7948 0 0 0-.3927.6813v6.7219zm1.093-2.4573l3.4323-1.9845 3.4323 1.9845v3.969l-3.4323 1.9845-3.4323-1.9845z" />
    </svg>
  );
}

export function ClaudeLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13.827 3.5h3.693l6.48 17h-3.693l-6.48-17zm-10.327 0h3.693l6.48 17H9.98l-1.42-3.8H3.94l-1.42 3.8H0l3.5-17zm2.42 9.7h3.76L7.9 6.8l-1.98 6.4z"
        fill="#D97757"
      />
    </svg>
  );
}

export function LlamaLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="meta-loop-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0866FF" />
          <stop offset="100%" stopColor="#0081FB" />
        </linearGradient>
      </defs>
      <path
        d="M16.99 4.5c-2.5 0-4.4 1.3-5 2.8-.6-1.5-2.5-2.8-5-2.8C3.1 4.5 0 7.8 0 12s3.1 7.5 6.99 7.5c3.2 0 5-2.2 5.01-2.2s1.8 2.2 5 2.2C20.9 19.5 24 16.2 24 12s-3.1-7.5-7.01-7.5zm-10 12.2C4.6 16.7 2.6 14.5 2.6 12s2-4.7 4.39-4.7c2.1 0 3.5 1.7 4.01 3.5-.5 1.8-1.9 3.5-4.01 3.9zm10 0c-2.1-.4-3.5-2.1-4.01-3.9.5-1.8 1.9-3.5 4.01-3.5 2.39 0 4.39 2.2 4.39 4.7s-2 4.7-4.39 4.7z"
        fill="url(#meta-loop-grad)"
      />
    </svg>
  );
}

export function MistralLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      {/* 4-tier orange brick pattern */}
      <rect x="2.5" y="3.5" width="4" height="3.5" rx="0.75" fill="#FF7000" />
      <rect x="17.5" y="3.5" width="4" height="3.5" rx="0.75" fill="#FF7000" />
      <rect x="2.5" y="8" width="4" height="3.5" rx="0.75" fill="#FF5A00" />
      <rect x="7.5" y="8" width="4" height="3.5" rx="0.75" fill="#FF5A00" />
      <rect x="12.5" y="8" width="4" height="3.5" rx="0.75" fill="#FF5A00" />
      <rect x="17.5" y="8" width="4" height="3.5" rx="0.75" fill="#FF5A00" />
      <rect x="2.5" y="12.5" width="4" height="3.5" rx="0.75" fill="#FF4500" />
      <rect x="10" y="12.5" width="4" height="3.5" rx="0.75" fill="#FF4500" />
      <rect x="17.5" y="12.5" width="4" height="3.5" rx="0.75" fill="#FF4500" />
      <rect x="2.5" y="17" width="4" height="3.5" rx="0.75" fill="#E62E00" />
      <rect x="17.5" y="17" width="4" height="3.5" rx="0.75" fill="#E62E00" />
    </svg>
  );
}

export function DeepSeekLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="deepseek-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E88E5" />
          <stop offset="100%" stopColor="#0D47A1" />
        </linearGradient>
      </defs>
      <path
        d="M2.5 13.2c1.2-4.8 5.6-8.2 10.8-8.2 5.5 0 9.8 3.5 10.2 7.8.3 3.2-2.1 5.7-5.2 5.7-2.6 0-3.9-1.2-6-1.2s-3.4 1.2-6 1.2c-2.3 0-3.5-1.7-3.8-5.3z"
        fill="url(#deepseek-grad)"
      />
      <circle cx="8" cy="11" r="1.3" fill="#FFFFFF" />
      <path d="M18.5 6l1.2-2 1.8 1.2-1.2 2 1.8 1.2-2.2-.2-.8 2-.8-2-2.2.2 1.8-1.2-1.2-2z" fill="#00E5FF" />
    </svg>
  );
}

export function HuggingFaceLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="#FFD21E" />
      <ellipse cx="8.5" cy="10" rx="1.2" ry="1.6" fill="#1F2937" />
      <ellipse cx="15.5" cy="10" rx="1.2" ry="1.6" fill="#1F2937" />
      <circle cx="8" cy="9.4" r="0.5" fill="#FFFFFF" />
      <circle cx="15" cy="9.4" r="0.5" fill="#FFFFFF" />
      <ellipse cx="6.5" cy="12.5" rx="1.5" ry="0.9" fill="#FF8399" opacity="0.8" />
      <ellipse cx="17.5" cy="12.5" rx="1.5" ry="0.9" fill="#FF8399" opacity="0.8" />
      <path d="M8.5 13.5c1 1.8 6 1.8 7 0" stroke="#1F2937" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M4 14.5c.8-.8 2-1 2.8-.2l.7.7c.4.4.4 1 0 1.4l-1.8 1.8c-.8.8-2 .8-2.8 0-.8-.8-.8-2.2.1-3.2l1-.5z" fill="#FFB703" />
      <path d="M20 14.5c-.8-.8-2-1-2.8-.2l-.7.7c-.4.4-.4 1 0 1.4l1.8 1.8c.8.8 2 .8 2.8 0 .8-.8.8-2.2-.1-3.2l-1-.5z" fill="#FFB703" />
    </svg>
  );
}

export function NvidiaLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4.5 12c0-4.14 3.36-7.5 7.5-7.5 3.4 0 6.27 2.27 7.18 5.4.15.53-.25 1.05-.8 1.05-.44 0-.8-.32-.91-.75-.72-2.53-3.04-4.35-5.47-4.35-3.4 0-6.15 2.76-6.15 6.15s2.75 6.15 6.15 6.15c2.43 0 4.75-1.82 5.47-4.35.11-.43.47-.75.91-.75.55 0 .95.52.8 1.05-.91 3.13-3.78 5.4-7.18 5.4-4.14 0-7.5-3.36-7.5-7.5z"
        fill="#76B900"
      />
      <circle cx="12" cy="12" r="3.2" fill="#76B900" />
      <path d="M12 10.5a1.5 1.5 0 0 1 1.5 1.5" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function OpenRouterLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="openrouter-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <path d="M12 2.5L3.5 7.2v9.6L12 21.5l8.5-4.7V7.2L12 2.5z" stroke="url(#openrouter-grad)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 12L3.5 7.2M12 12v9.5M12 12l8.5-4.8" stroke="#A5B4FC" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.2" fill="#6366F1" />
    </svg>
  );
}

export function PerplexityLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#0A2229" stroke="#20B2AA" strokeWidth="1" />
      <path d="M12 4.5v15M5.5 8.25l13 7.5M5.5 15.75l13-7.5" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="#20B2AA" />
    </svg>
  );
}

export function GrokLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("text-white", className)}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function CohereLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="cohere-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7759" />
          <stop offset="100%" stopColor="#D94126" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill="url(#cohere-grad)" />
      <path d="M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z" fill="#191919" />
      <circle cx="13" cy="10" r="1.5" fill="#FFE5D9" />
    </svg>
  );
}

export function CopilotLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="copilot-g1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0078D4" />
          <stop offset="100%" stopColor="#00BCF2" />
        </linearGradient>
        <linearGradient id="copilot-g2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF0078" />
          <stop offset="100%" stopColor="#7F00FF" />
        </linearGradient>
      </defs>
      <path d="M12 4c-3.8 0-7 2.7-7 6.5 0 2.3 1.2 4.4 3.1 5.5l-.6 2.5 3.1-1.3c.5.2 1 .3 1.4.3 3.8 0 7-2.7 7-6.5S15.8 4 12 4z" fill="url(#copilot-g1)" opacity="0.9" />
      <path d="M15 8.5c-2.8 0-5 1.8-5 4.5 0 1.6.8 3 2.1 3.8l-.4 1.7 2.1-.9c.4.1.8.2 1.2.2 2.8 0 5-1.8 5-4.5s-2.2-4.8-5-4.8z" fill="url(#copilot-g2)" />
    </svg>
  );
}

export function GroqLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#F55036" />
      <path d="M14 6.5L8.5 13.5h4L10 18.5l6.5-7.5h-4.5L14 6.5z" fill="#FFFFFF" />
    </svg>
  );
}

export function OllamaLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9.5" fill="#18181B" stroke="white" strokeWidth="1" />
      <path d="M10 6h4v5h2v6h-2v2h-1v-2h-2v2h-1v-2H8v-6h2V6z" fill="#FFFFFF" />
      <circle cx="11" cy="9" r="0.8" fill="#18181B" />
    </svg>
  );
}

export function QwenLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
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
    <svg viewBox="0 0 24 24" fill="none" className={className}>
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
  const key = (idOrName || fallbackName || '').toLowerCase().trim();

  if (key.includes('gemini') || key.includes('google')) return GeminiLogo;
  if (key.includes('llama') || key.includes('meta')) return LlamaLogo;
  if (key.includes('mistral') || key.includes('mixtral')) return MistralLogo;
  if (key.includes('deepseek')) return DeepSeekLogo;
  if (key.includes('hugging') || key.includes('hf/')) return HuggingFaceLogo;
  if (key.includes('openrouter')) return OpenRouterLogo;
  if (key.includes('nvidia') || key.includes('nemotron')) return NvidiaLogo;
  if (key.includes('perplexity') || key.includes('sonar')) return PerplexityLogo;
  if (key.includes('grok') || key.includes('x.ai') || key.includes('xai')) return GrokLogo;
  if (key.includes('cohere') || key.includes('command')) return CohereLogo;
  if (key.includes('copilot') || key.includes('microsoft') || key.includes('phi')) return CopilotLogo;
  if (key.includes('gpt') || key.includes('chatgpt') || key.includes('openai')) return OpenAILogo;
  if (key.includes('claude') || key.includes('anthropic')) return ClaudeLogo;
  if (key.includes('groq')) return GroqLogo;
  if (key.includes('ollama')) return OllamaLogo;
  if (key.includes('qwen')) return QwenLogo;

  return UniversalLogo;
}

/**
 * Pure SVG logo for inline usage without surrounding badge
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
  const id = agent?.id || model || '';
  const name = agent?.name || model || '';
  const Logo = getLogoComponent(id, name);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-md bg-white/[0.08] border border-white/10 shadow-sm overflow-hidden select-none",
        badgeClassName
      )}
      title={name || id}
    >
      <Logo className={cn("shrink-0", className)} />
    </span>
  );
}
