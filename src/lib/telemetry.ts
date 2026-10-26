import type { HistoryPromptItem } from './generatorHistory';
import { getActivePrivacySettings, scrubSecrets, getSessionTokensCount } from './appSettings';

export interface UserTraceItem {
  id: string;
  time: string;
  fullDate?: string;
  node: string;
  model: string;
  tokens: number;
  latency: number;
  status: string;
}

export interface UserTelemetrySummary {
  totalInferences: number;
  totalTokens: number;
  avgLatency: number;
  p99Latency: number;
  reliability: number;
  activeModelsCount: number;
  activeModels: string[];
  traces: UserTraceItem[];
}

export const TELEMETRY_UPDATE_EVENT = 'bedrock_telemetry_updated';

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      const token = await clerk.session.getToken();
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
      }
    }
  } catch (e) {
    console.warn('Unable to get Clerk token for telemetry:', e);
  }

  try {
    const storedToken = localStorage.getItem('bedrock_token') || localStorage.getItem('bedrock_auth_token');
    if (storedToken) {
      return {
        Authorization: `Bearer ${storedToken}`,
        'Content-Type': 'application/json',
      };
    }
  } catch {
    // ignore local storage error
  }

  return { 'Content-Type': 'application/json' };
}

/**
 * Record a real execution trace in Neon DB (respects user's privacy telemetry toggle)
 */
export async function recordExecutionTrace(params: {
  node?: string;
  model?: string;
  tokens?: number;
  latency?: number;
  status?: 'OK' | 'ERR';
}): Promise<void> {
  const privacy = getActivePrivacySettings();
  if (!privacy.telemetry) {
    // User disabled telemetry in Settings > Privacy & Data Controls
    return;
  }

  try {
    const headers = await getAuthHeader();
    const res = await fetch('/api/traces', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        node: params.node || 'PROMPT_GEN',
        model: params.model || 'gemini-2.5-flash',
        tokens: params.tokens || 1024,
        latency: params.latency || 450,
        status: params.status || 'OK',
      }),
    });


    if (res.ok) {
      window.dispatchEvent(new CustomEvent(TELEMETRY_UPDATE_EVENT));
    }
  } catch (err) {
    console.warn('[Telemetry] Failed to record trace:', err);
  }
}

/**
 * Fetch real user telemetry and trace logs from Neon DB
 */
export async function getUserTelemetry(): Promise<UserTelemetrySummary> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch('/api/traces', {
      method: 'GET',
      headers,
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('[Telemetry] Failed to fetch telemetry:', err);
  }

  const localTokens = getSessionTokensCount();
  return {
    totalInferences: localTokens > 0 ? 1 : 0,
    totalTokens: localTokens,
    avgLatency: 0,
    p99Latency: 0,
    reliability: 100,
    activeModelsCount: localTokens > 0 ? 1 : 0,
    activeModels: [],
    traces: [],
  };
}

/**
 * Clear traces for current user
 */
export async function clearUserTraces(): Promise<void> {
  try {
    const headers = await getAuthHeader();
    await fetch('/api/traces', {
      method: 'DELETE',
      headers,
    });
    window.dispatchEvent(new CustomEvent(TELEMETRY_UPDATE_EVENT));
  } catch (err) {
    console.warn('[Telemetry] Failed to clear traces:', err);
  }
}

/**
 * Save prompt to Neon DB
 */
export async function savePromptToDb(prompt: {
  id?: string;
  title: string;
  ideaText: string;
  promptText?: string;
  targetType?: string;
  tags?: string[];
}): Promise<void> {
  const privacy = getActivePrivacySettings();
  if (!privacy.saveHistory) {
    // User disabled prompt history persistence
    return;
  }

  const cleanTitle = scrubSecrets(prompt.title);
  const cleanIdea = scrubSecrets(prompt.ideaText);
  const cleanPrompt = prompt.promptText ? scrubSecrets(prompt.promptText) : undefined;

  try {
    const headers = await getAuthHeader();
    await fetch('/api/prompts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: prompt.id,
        title: cleanTitle,
        content: cleanPrompt || cleanIdea,
        snippet: (cleanIdea || cleanTitle).slice(0, 160),
        targetType: prompt.targetType || 'General',
        tags: prompt.tags || [prompt.targetType || 'Custom'],
      }),
    });
  } catch (err) {
    console.warn('[Prompts] Failed to save prompt to DB:', err);
  }
}


/**
 * Fetch user's saved prompts from Neon DB
 */
export async function fetchUserPromptsFromDb(): Promise<HistoryPromptItem[]> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch('/api/prompts', {
      method: 'GET',
      headers,
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          id: p.id,
          title: p.title,
          ideaText: p.snippet || p.title,
          promptText: p.fullContent,
          targetType: p.targetType || 'coding_agent',
          isPinned: false,
          createdAt: new Date(p.createdAt).getTime(),
        }));
      }
    }
  } catch (err) {
    console.warn('[Prompts] Failed to fetch prompts from DB:', err);
  }
  return [];
}

export async function deletePromptFromDb(id: string): Promise<void> {
  try {
    const headers = await getAuthHeader();
    await fetch(`/api/prompts?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
  } catch (err) {
    console.warn('[Prompts] Failed to delete prompt from DB:', err);
  }
}
