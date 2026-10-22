/**
 * Bedrock Real-time Application Settings & State Manager
 * 
 * Centralized, reactive state for all user configuration:
 * - Model & Inference parameters (Temperature, Max Output Tokens, Top-P, Stream Speed, System Directives, Auto-Fallback, Strict JSON)
 * - Tokens & Budget guardrails (Session Limit, Hard Stop, Currency, Estimation Mode)
 * - Appearance & UI Themes (Theme Preset, Accent, Font Scale, Font Family, Glass Intensity, Sound, Reduced Motion)
 * - Notification alerts
 * - Privacy controls (Telemetry toggle, History saving, Secret scrubbing)
 */

import { ApiError } from './api';

// ============================================================================
// STORAGE KEYS & EVENT CONSTANTS
// ============================================================================

export const STORAGE_KEY_API_KEYS = 'bedrock_api_keys';
export const STORAGE_KEY_MODEL_SETTINGS = 'bedrock_model_settings';
export const STORAGE_KEY_TOKEN_SETTINGS = 'bedrock_token_settings';
export const STORAGE_KEY_APPEARANCE = 'bedrock_appearance_settings';
export const STORAGE_KEY_NOTIFICATIONS = 'bedrock_notifications_settings';
export const STORAGE_KEY_PRIVACY = 'bedrock_privacy_settings';
export const STORAGE_KEY_SESSION_TOKENS = 'bedrock_session_tokens';
export const STORAGE_KEY_WEEKLY_TOKENS = 'bedrock_weekly_tokens';

export const BEDROCK_SETTINGS_UPDATED_EVENT = 'bedrock_settings_updated';
export const BEDROCK_APPEARANCE_UPDATED_EVENT = 'bedrock_appearance_updated';
export const BEDROCK_TOKENS_UPDATED_EVENT = 'bedrock_tokens_updated';
export const BEDROCK_BUDGET_WARNING_EVENT = 'bedrock_budget_warning';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ModelInferenceSettings {
  defaultModel: string;
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  streamSpeed: 'instant' | 'smooth' | 'typewriter';
  systemPromptDirectives: string;
  autoFallback: boolean;
  enableWebCitations: boolean;
  strictJsonMode: boolean;
}

export interface TokenSettings {
  sessionLimit: number;
  weeklyLimit: number;
  warningThreshold: number;
  hardStopOnLimit: boolean;
  estimationMode: 'heuristic' | 'bpe';
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'INR';
  autoCompactContext: boolean;
  costWarningThreshold: number;
}

export interface AppearanceSettings {
  themePreset: 'obsidian' | 'slate' | 'amber' | 'emerald' | 'violet';
  accentColor: 'copper' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'amber';
  fontScale: 'compact' | 'standard' | 'roomy';
  fontFamily: 'sans' | 'editorial' | 'mono';
  codeTheme: 'tokyo-night' | 'dracula' | 'monokai' | 'github-dark' | 'one-dark';
  glassIntensity: 'none' | 'subtle' | 'luxury';
  particleEffects: boolean;
  soundFeedback: boolean;
  reducedMotion: boolean;
}

export interface NotificationSettings {
  executionAlerts: boolean;
  tokenWarnings: boolean;
  latencyAlerts: boolean;
  modelUpdates: boolean;
  soundAlerts: boolean;
  desktopNotifications: boolean;
}

export interface PrivacySettings {
  telemetry: boolean;
  saveHistory: boolean;
  shareCrashReports: boolean;
  secretScrubbing: boolean;
  localVaultOnly: boolean;
  autoLockTimeout: string;
}

export interface ApiKeysState {
  defaultModel: string;
  geminiKey: string;
  groqKey: string;
  openAiKey: string;
  anthropicKey: string;
  openRouterKey: string;
  huggingFaceKey: string;
  mistralKey: string;
  cohereKey: string;
  copilotKey: string;
  deepSeekKey: string;
  nvidiaKey: string;
  xaiKey: string;
  perplexityKey: string;
  ollamaHost: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const DEFAULT_MODEL_SETTINGS: ModelInferenceSettings = {
  defaultModel: 'gemini-3.5-flash-lite',
  temperature: 0.7,
  maxOutputTokens: 4096,
  topP: 0.95,
  streamSpeed: 'smooth',
  systemPromptDirectives: '',
  autoFallback: true,
  enableWebCitations: true,
  strictJsonMode: false,
};

export const DEFAULT_TOKEN_SETTINGS: TokenSettings = {
  sessionLimit: 50,
  weeklyLimit: 250,
  warningThreshold: 80,
  hardStopOnLimit: true,
  estimationMode: 'heuristic',
  currency: 'USD',
  autoCompactContext: true,
  costWarningThreshold: 5.0,
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  themePreset: 'obsidian',
  accentColor: 'copper',
  fontScale: 'standard',
  fontFamily: 'sans',
  codeTheme: 'tokyo-night',
  glassIntensity: 'luxury',
  particleEffects: true,
  soundFeedback: true,
  reducedMotion: false,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  executionAlerts: true,
  tokenWarnings: true,
  latencyAlerts: false,
  modelUpdates: true,
  soundAlerts: true,
  desktopNotifications: false,
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  telemetry: false,
  saveHistory: true,
  shareCrashReports: false,
  secretScrubbing: true,
  localVaultOnly: true,
  autoLockTimeout: 'never',
};

// ============================================================================
// ACTIVE SETTINGS GETTERS
// ============================================================================

export function getActiveModelSettings(): ModelInferenceSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_MODEL_SETTINGS;
    const data = localStorage.getItem(STORAGE_KEY_MODEL_SETTINGS);
    if (!data) return DEFAULT_MODEL_SETTINGS;
    return { ...DEFAULT_MODEL_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_MODEL_SETTINGS;
  }
}

export function getActiveTokenSettings(): TokenSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_TOKEN_SETTINGS;
    const data = localStorage.getItem(STORAGE_KEY_TOKEN_SETTINGS);
    if (!data) return DEFAULT_TOKEN_SETTINGS;
    return { ...DEFAULT_TOKEN_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_TOKEN_SETTINGS;
  }
}

export function getActiveAppearanceSettings(): AppearanceSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_APPEARANCE_SETTINGS;
    const data = localStorage.getItem(STORAGE_KEY_APPEARANCE);
    if (!data) return DEFAULT_APPEARANCE_SETTINGS;
    return { ...DEFAULT_APPEARANCE_SETTINGS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_APPEARANCE_SETTINGS;
  }
}

export function getActiveNotificationSettings(): NotificationSettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_NOTIFICATIONS;
    const data = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (!data) return DEFAULT_NOTIFICATIONS;
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

export function getActivePrivacySettings(): PrivacySettings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PRIVACY;
    const data = localStorage.getItem(STORAGE_KEY_PRIVACY);
    if (!data) return DEFAULT_PRIVACY;
    return { ...DEFAULT_PRIVACY, ...JSON.parse(data) };
  } catch {
    return DEFAULT_PRIVACY;
  }
}

// ============================================================================
// DOM & APPEARANCE APPLICATION
// ============================================================================

export function applyAppearanceToDom(settings?: AppearanceSettings): void {
  if (typeof document === 'undefined') return;
  const current = settings || getActiveAppearanceSettings();
  try {
    const root = document.documentElement;
    root.setAttribute('data-theme', current.themePreset);
    root.setAttribute('data-accent', current.accentColor);
    root.setAttribute('data-font-scale', current.fontScale);
    root.setAttribute('data-glass', current.glassIntensity);

    if (current.fontScale === 'compact') {
      root.style.fontSize = '14px';
    } else if (current.fontScale === 'roomy') {
      root.style.fontSize = '17px';
    } else {
      root.style.fontSize = '16px';
    }

    root.classList.remove('font-sans-mode', 'font-editorial-mode', 'font-mono-mode');
    if (current.fontFamily === 'editorial') root.classList.add('font-editorial-mode');
    else if (current.fontFamily === 'mono') root.classList.add('font-mono-mode');
    else root.classList.add('font-sans-mode');

    if (current.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  } catch (e) {
    console.error('[Settings] Failed to apply appearance to DOM:', e);
  }
}

// ============================================================================
// AUDIO FEEDBACK ENGINE
// ============================================================================

export function playUiAudio(type: 'click' | 'success' | 'toggle' | 'alert' = 'click', force = false): void {
  if (typeof window === 'undefined') return;
  const appearance = getActiveAppearanceSettings();
  const notifications = getActiveNotificationSettings();

  const isEnabled = force || (appearance.soundFeedback && notifications.soundAlerts);
  if (!isEnabled) return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'toggle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    }
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

// ============================================================================
// TOKEN USAGE & HARD STOP BUDGET GUARD
// ============================================================================

export function getSessionTokensCount(): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    return parseInt(localStorage.getItem(STORAGE_KEY_SESSION_TOKENS) || '0', 10);
  } catch {
    return 0;
  }
}

export function getWeeklyTokensCount(): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    return parseInt(localStorage.getItem(STORAGE_KEY_WEEKLY_TOKENS) || '0', 10);
  } catch {
    return 0;
  }
}

export function recordTokenUsage(tokens: number): void {
  if (tokens <= 0 || typeof localStorage === 'undefined') return;
  try {
    const currentSession = getSessionTokensCount() + tokens;
    const currentWeekly = getWeeklyTokensCount() + tokens;

    localStorage.setItem(STORAGE_KEY_SESSION_TOKENS, currentSession.toString());
    localStorage.setItem(STORAGE_KEY_WEEKLY_TOKENS, currentWeekly.toString());

    window.dispatchEvent(
      new CustomEvent(BEDROCK_TOKENS_UPDATED_EVENT, {
        detail: { sessionTokens: currentSession, weeklyTokens: currentWeekly },
      })
    );
  } catch (e) {
    console.error('[Settings] Failed to persist token usage:', e);
  }
}

/**
 * Enforces the user's Token Budget setting prior to executing any model inference call.
 * If hardStopOnLimit is enabled and session tokens exceed the limit, execution is strictly stopped.
 */
export function checkTokenBudgetGuard(tokensToRequest = 100): void {
  const tokenSettings = getActiveTokenSettings();
  const currentTokens = getSessionTokensCount();
  // sessionLimit is in thousands of tokens (e.g. 50k = 50,000)
  const maxSessionTokens = tokenSettings.sessionLimit * 1000;

  if (tokenSettings.hardStopOnLimit && (currentTokens + tokensToRequest) > maxSessionTokens) {
    playUiAudio('alert', true);
    throw new ApiError(
      `Token Budget Guard Enforced: Session token limit (${tokenSettings.sessionLimit.toLocaleString()}k tokens) reached. ` +
      `Hard stop is active in Settings > Tokens & Budget. Increase your session limit or clear local token stats to continue.`,
      false,
      'Token Budget Guard',
      429
    );
  }

  // Check if warning threshold reached
  const warningTokens = (tokenSettings.warningThreshold / 100) * maxSessionTokens;
  if (currentTokens >= warningTokens) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(BEDROCK_BUDGET_WARNING_EVENT, {
          detail: {
            currentTokens,
            maxSessionTokens,
            percent: Math.round((currentTokens / maxSessionTokens) * 100),
          },
        })
      );
    }
  }
}

// ============================================================================
// CURRENCY CONVERSION & FORMATTER
// ============================================================================

export function formatCurrency(amountUsd: number, currencyOverride?: TokenSettings['currency']): string {
  const targetCurrency = currencyOverride || getActiveTokenSettings().currency;

  const rates: Record<TokenSettings['currency'], number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 154.5,
    INR: 86.8,
  };

  const converted = amountUsd * (rates[targetCurrency] || 1.0);

  switch (targetCurrency) {
    case 'EUR':
      return `€${converted.toFixed(2)}`;
    case 'GBP':
      return `£${converted.toFixed(2)}`;
    case 'JPY':
      return `¥${Math.round(converted).toLocaleString()}`;
    case 'INR':
      return `₹${converted.toFixed(2)}`;
    case 'USD':
    default:
      return `$${converted.toFixed(2)}`;
  }
}

// ============================================================================
// PRIVACY & SECRET SCRUBBING
// ============================================================================

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g, // Google API key
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI key
  /gsk_[a-zA-Z0-9]{20,}/g, // Groq key
  /xai-[a-zA-Z0-9]{20,}/g, // xAI key
  /pplx-[a-zA-Z0-9]{20,}/g, // Perplexity key
  /ghp_[a-zA-Z0-9]{20,}/g, // GitHub personal access token
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, // Bearer JWT or API token
];

export function scrubSecrets(input: string): string {
  const privacy = getActivePrivacySettings();
  if (!privacy.secretScrubbing || !input) return input;

  let cleaned = input;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED_API_KEY]');
  }
  return cleaned;
}

// ============================================================================
// STREAMING PACER ENGINE
// ============================================================================

/**
 * Creates an async streaming consumer that spaces token deliveries in real time according
 * to the user's Stream Speed preference in Settings ('instant' | 'smooth' | 'typewriter').
 */
export function createStreamingPacer(
  streamSpeed: ModelInferenceSettings['streamSpeed'] = 'smooth',
  onToken?: (token: string) => void
): (token: string) => Promise<void> {
  if (!onToken) {
    return async () => {};
  }

  if (streamSpeed === 'instant') {
    return async (token: string) => {
      onToken(token);
    };
  }

  const delayMs = streamSpeed === 'typewriter' ? 24 : 8;

  return async (token: string) => {
    onToken(token);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  };
}
