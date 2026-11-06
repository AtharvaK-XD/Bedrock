/**
 * Bedrock Real-time Application Settings & State Manager
 *
 * Centralized, reactive state for all user configuration:
 * - Model & Inference parameters (Temperature, Max Output Tokens, Top-P, Stream Speed, System Directives, Auto-Fallback, Strict JSON)
 * - Tokens & Budget guardrails (Session Limit, Hard Stop, Warning Threshold, Currency)
 * - Appearance & UI (Theme, Accent, Font Scale, Font Family, Glass Intensity, Click sounds, Reduced Motion)
 * - Notification alerts
 * - Privacy controls (Diagnostics, History saving, Secret scrubbing, Local-only vault)
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
const STORAGE_KEY_SESSION_STARTED = 'bedrock_session_tokens_started';
const STORAGE_KEY_WEEK_STARTED = 'bedrock_weekly_tokens_started';

export const BEDROCK_SETTINGS_UPDATED_EVENT = 'bedrock_settings_updated';
export const BEDROCK_APPEARANCE_UPDATED_EVENT = 'bedrock_appearance_updated';
export const BEDROCK_TOKENS_UPDATED_EVENT = 'bedrock_tokens_updated';
export const BEDROCK_BUDGET_WARNING_EVENT = 'bedrock_budget_warning';

/** A token "session" lasts 5 hours, like the prompt session on the website. The weekly counter lasts 7 days. */
const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000;
const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
  strictJsonMode: boolean;
}

export interface TokenSettings {
  /** Session token budget in thousands of tokens (50 = 50,000 tokens per 5-hour session) */
  sessionLimit: number;
  weeklyLimit: number;
  warningThreshold: number;
  hardStopOnLimit: boolean;
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'INR';
}

export interface AppearanceSettings {
  themePreset: 'obsidian' | 'slate' | 'amber' | 'emerald' | 'violet';
  accentColor: 'copper' | 'cyan' | 'emerald' | 'violet' | 'rose' | 'amber';
  fontScale: 'compact' | 'standard' | 'roomy';
  fontFamily: 'sans' | 'editorial' | 'mono';
  codeTheme: 'tokyo-night' | 'dracula' | 'monokai' | 'github-dark' | 'one-dark';
  glassIntensity: 'none' | 'subtle' | 'luxury';
  soundFeedback: boolean;
  reducedMotion: boolean;
}

export interface NotificationSettings {
  executionAlerts: boolean;
  tokenWarnings: boolean;
  latencyAlerts: boolean;
  soundAlerts: boolean;
  desktopNotifications: boolean;
}

export interface PrivacySettings {
  /** Crash reports, usage analytics and your personal run log on the Dashboard */
  telemetry: boolean;
  saveHistory: boolean;
  secretScrubbing: boolean;
  /** Keep prompts and workflows on this device only (no cloud backup) */
  localVaultOnly: boolean;
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
  strictJsonMode: false,
};

export const DEFAULT_TOKEN_SETTINGS: TokenSettings = {
  sessionLimit: 50,
  weeklyLimit: 250,
  warningThreshold: 80,
  hardStopOnLimit: true,
  currency: 'USD',
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  themePreset: 'obsidian',
  accentColor: 'copper',
  fontScale: 'standard',
  fontFamily: 'sans',
  codeTheme: 'tokyo-night',
  glassIntensity: 'luxury',
  soundFeedback: false,
  reducedMotion: false,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  executionAlerts: true,
  tokenWarnings: true,
  latencyAlerts: false,
  soundAlerts: false,
  desktopNotifications: false,
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  telemetry: true,
  saveHistory: true,
  secretScrubbing: true,
  localVaultOnly: false,
};

// ============================================================================
// ACTIVE SETTINGS GETTERS
// ============================================================================

function readStored<T extends object>(key: string, defaults: T): T {
  try {
    if (typeof localStorage === 'undefined') return defaults;
    const data = localStorage.getItem(key);
    if (!data) return defaults;
    return { ...defaults, ...JSON.parse(data) };
  } catch {
    return defaults;
  }
}

export function getActiveModelSettings(): ModelInferenceSettings {
  return readStored(STORAGE_KEY_MODEL_SETTINGS, DEFAULT_MODEL_SETTINGS);
}

export function getActiveTokenSettings(): TokenSettings {
  return readStored(STORAGE_KEY_TOKEN_SETTINGS, DEFAULT_TOKEN_SETTINGS);
}

export function getActiveAppearanceSettings(): AppearanceSettings {
  return readStored(STORAGE_KEY_APPEARANCE, DEFAULT_APPEARANCE_SETTINGS);
}

export function getActiveNotificationSettings(): NotificationSettings {
  return readStored(STORAGE_KEY_NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
}

export function getActivePrivacySettings(): PrivacySettings {
  return readStored(STORAGE_KEY_PRIVACY, DEFAULT_PRIVACY);
}

/** True when the user asked to keep prompts and workflows on this device only. */
export function isLocalVaultOnly(): boolean {
  return getActivePrivacySettings().localVaultOnly === true;
}

// ============================================================================
// DOM & APPEARANCE APPLICATION
// ============================================================================

const FONT_CLASSES = ['font-editorial-mode', 'font-mono-mode'];

export function applyAppearanceToDom(settings?: AppearanceSettings): void {
  if (typeof document === 'undefined') return;
  const current = settings || getActiveAppearanceSettings();
  try {
    const root = document.documentElement;

    // Fade colours smoothly when the theme or accent actually changes (not on first load)
    const themeChanged =
      (root.hasAttribute('data-theme') && root.getAttribute('data-theme') !== current.themePreset) ||
      (root.hasAttribute('data-accent') && root.getAttribute('data-accent') !== current.accentColor);
    const wantsMotion = !current.reducedMotion && !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (themeChanged && wantsMotion) {
      root.classList.add('theme-transition');
      window.setTimeout(() => root.classList.remove('theme-transition'), 500);
    }

    root.setAttribute('data-theme', current.themePreset);
    root.setAttribute('data-accent', current.accentColor);
    root.setAttribute('data-font-scale', current.fontScale);
    root.setAttribute('data-glass', current.glassIntensity);

    root.style.fontSize = current.fontScale === 'compact' ? '14px' : current.fontScale === 'roomy' ? '17px' : '16px';

    root.classList.remove(...FONT_CLASSES);
    if (current.fontFamily === 'editorial') root.classList.add('font-editorial-mode');
    else if (current.fontFamily === 'mono') root.classList.add('font-mono-mode');

    // Honor the in-app toggle and the operating system's reduced-motion preference
    const osPrefersReducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.toggle('reduce-motion', current.reducedMotion || osPrefersReducedMotion);
  } catch (e) {
    console.error('[Settings] Failed to apply appearance to DOM:', e);
  }
}

// ============================================================================
// AUDIO FEEDBACK ENGINE
// ============================================================================

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    // One shared context: browsers only allow a handful per page
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') sharedAudioContext = new AudioCtx();
    if (sharedAudioContext.state === 'suspended') void sharedAudioContext.resume();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Plays a short interface sound. Honors Settings > Appearance > "Interface sounds" unless `force` is true
 * (used so the toggle itself can confirm the new state).
 */
export function playUiAudio(type: 'click' | 'success' | 'toggle' | 'alert' = 'click', force = false): void {
  if (typeof window === 'undefined') return;
  if (!force && !getActiveAppearanceSettings().soundFeedback) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start();
      osc.stop(t + 0.2);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.setValueAtTime(330, t + 0.1);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start();
      osc.stop(t + 0.25);
    } else if (type === 'toggle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, t);
      gain.gain.setValueAtTime(0.025, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start();
      osc.stop(t + 0.08);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, t);
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.start();
      osc.stop(t + 0.04);
    }
  } catch {
    // Audio context may be restricted by autoplay policy
  }
}

/** The completion chime (Settings > Notifications > Completion sound). Independent from click sounds. */
export function playCompletionChime(): void {
  if (getActiveNotificationSettings().soundAlerts) playUiAudio('success', true);
}

// ============================================================================
// TOKEN USAGE & HARD STOP BUDGET GUARD
// ============================================================================

/** Reads a counter that resets itself once its time window is over. */
function readWindowedCounter(valueKey: string, startedKey: string, windowMs: number): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const started = parseInt(localStorage.getItem(startedKey) || '0', 10);
    if (started && Date.now() - started > windowMs) {
      localStorage.removeItem(valueKey);
      localStorage.removeItem(startedKey);
      return 0;
    }
    const value = parseInt(localStorage.getItem(valueKey) || '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function getSessionTokensCount(): number {
  return readWindowedCounter(STORAGE_KEY_SESSION_TOKENS, STORAGE_KEY_SESSION_STARTED, SESSION_WINDOW_MS);
}

export function getWeeklyTokensCount(): number {
  return readWindowedCounter(STORAGE_KEY_WEEKLY_TOKENS, STORAGE_KEY_WEEK_STARTED, WEEK_WINDOW_MS);
}

/** Clears the token counters (also used by "Reset session counters" in Settings). */
export function resetTokenCounters(): void {
  try {
    [STORAGE_KEY_SESSION_TOKENS, STORAGE_KEY_WEEKLY_TOKENS, STORAGE_KEY_SESSION_STARTED, STORAGE_KEY_WEEK_STARTED, 'sessionTokens', 'weeklyTokens'].forEach((k) =>
      localStorage.removeItem(k)
    );
    budgetWarningShown = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(BEDROCK_TOKENS_UPDATED_EVENT, { detail: { sessionTokens: 0, weeklyTokens: 0 } }));
    }
  } catch (e) {
    console.error('[Settings] Failed to reset token counters:', e);
  }
}

export function recordTokenUsage(tokens: number): void {
  if (tokens <= 0 || typeof localStorage === 'undefined') return;
  try {
    const currentSession = getSessionTokensCount() + tokens;
    const currentWeekly = getWeeklyTokensCount() + tokens;

    localStorage.setItem(STORAGE_KEY_SESSION_TOKENS, currentSession.toString());
    localStorage.setItem(STORAGE_KEY_WEEKLY_TOKENS, currentWeekly.toString());
    if (!localStorage.getItem(STORAGE_KEY_SESSION_STARTED)) localStorage.setItem(STORAGE_KEY_SESSION_STARTED, Date.now().toString());
    if (!localStorage.getItem(STORAGE_KEY_WEEK_STARTED)) localStorage.setItem(STORAGE_KEY_WEEK_STARTED, Date.now().toString());

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(BEDROCK_TOKENS_UPDATED_EVENT, {
          detail: { sessionTokens: currentSession, weeklyTokens: currentWeekly },
        })
      );
    }
  } catch (e) {
    console.error('[Settings] Failed to persist token usage:', e);
  }
}

// The warning is shown once per page load (and again after the counters are reset)
let budgetWarningShown = false;

/**
 * Enforces the user's Token Budget setting prior to executing any model inference call.
 * With "Hard stop" on, generation stops once the session budget has been used up.
 */
export function checkTokenBudgetGuard(_tokensToRequest = 0): void {
  const tokenSettings = getActiveTokenSettings();
  const currentTokens = getSessionTokensCount();
  // sessionLimit is in thousands of tokens (e.g. 50 = 50,000 tokens)
  const maxSessionTokens = tokenSettings.sessionLimit * 1000;

  if (tokenSettings.hardStopOnLimit && currentTokens >= maxSessionTokens) {
    playUiAudio('alert', true);
    throw new ApiError(
      `Session budget reached: you have used ${currentTokens.toLocaleString()} of ${maxSessionTokens.toLocaleString()} tokens in this 5-hour session. ` +
      `Raise the limit or turn off the hard stop in Settings > Tokens & Budget.`,
      false,
      'Token Budget Guard',
      429
    );
  }

  const warningTokens = (tokenSettings.warningThreshold / 100) * maxSessionTokens;
  if (!budgetWarningShown && currentTokens >= warningTokens && typeof window !== 'undefined') {
    budgetWarningShown = true;
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
  // OpenAI (incl. sk-proj-), Anthropic (sk-ant-), OpenRouter (sk-or-v1-), DeepSeek: the old form stopped at the first "-"
  /\bsk-[A-Za-z0-9][A-Za-z0-9_-]{19,}/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/g, // Clerk / Stripe secret key
  /hf_[a-zA-Z0-9]{20,}/g, // Hugging Face token
  /gsk_[a-zA-Z0-9]{20,}/g, // Groq key
  /xai-[a-zA-Z0-9]{20,}/g, // xAI key
  /pplx-[a-zA-Z0-9]{20,}/g, // Perplexity key
  /ghp_[a-zA-Z0-9]{20,}/g, // GitHub personal access token
  /Bearer\s+[a-zA-Z0-9_.-]{20,}/gi, // Bearer JWT or API token
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
