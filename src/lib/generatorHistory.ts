import { savePromptToDb, fetchUserPromptsFromDb, deletePromptFromDb } from './telemetry';

export interface HistoryPromptItem {
  id: string;
  title: string;
  ideaText: string;
  targetType?: 'coding_agent' | 'full_stack' | 'cli_tool' | 'freelance_sow' | 'hackathon_mvp' | string;
  promptText?: string;
  isPinned: boolean;
  statusColor?: string;
  createdAt: number;
}

const STORAGE_KEY = 'bedrock_generator_history';
export const HISTORY_UPDATE_EVENT = 'bedrock_generator_history_updated';

// Mock seed IDs to purge for all existing and new users
const LEGACY_MOCK_IDS = new Set([
  'pin-1', 'pin-2', 'pin-3', 'pin-4', 'pin-5',
  'chat-1', 'chat-2', 'chat-3', 'chat-4', 'chat-5', 'chat-6', 'chat-7'
]);

export const DEFAULT_GENERATOR_HISTORY: HistoryPromptItem[] = [];

export function getStoredGeneratorHistory(): HistoryPromptItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Purge any mock/seed items from previous mock sessions for all users
      const sanitized = parsed.filter(item => item && !LEGACY_MOCK_IDS.has(item.id));
      if (sanitized.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      }
      return sanitized;
    }
  } catch (err) {
    console.error('Error loading generator history:', err);
  }
  return [];
}

export function saveGeneratorHistory(items: HistoryPromptItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(HISTORY_UPDATE_EVENT, { detail: items }));
  } catch (err) {
    console.error('Error saving generator history:', err);
  }
}

export function addPromptToHistory(
  item: Omit<HistoryPromptItem, 'id' | 'createdAt'> & { id?: string }
): HistoryPromptItem {
  const current = getStoredGeneratorHistory();
  const newItem: HistoryPromptItem = {
    id: item.id || `prompt-${Date.now()}`,
    title: item.title || item.ideaText.slice(0, 36) || 'Untitled Prompt',
    ideaText: item.ideaText,
    targetType: item.targetType || 'coding_agent',
    promptText: item.promptText,
    isPinned: Boolean(item.isPinned),
    statusColor: item.statusColor,
    createdAt: Date.now(),
  };

  // Check if item already exists by ID
  const existingIdx = current.findIndex(i => i.id === newItem.id);
  let updated: HistoryPromptItem[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...newItem };
  } else {
    // Check if an identical idea exists recently
    const duplicateIdx = current.findIndex(i => i.ideaText.trim() === newItem.ideaText.trim());
    if (duplicateIdx >= 0) {
      updated = [...current];
      updated[duplicateIdx] = { ...updated[duplicateIdx], ...newItem, createdAt: Date.now() };
    } else {
      updated = [newItem, ...current];
    }
  }

  saveGeneratorHistory(updated);
  
  // Persist prompt to Neon DB in background
  try {
    savePromptToDb({
      id: newItem.id,
      title: newItem.title,
      ideaText: newItem.ideaText,
      promptText: newItem.promptText,
      targetType: newItem.targetType,
    });
  } catch (err) {
    console.warn('Background DB prompt sync failed:', err);
  }

  return newItem;
}

export async function syncHistoryFromDb(): Promise<HistoryPromptItem[]> {
  try {
    const dbPrompts = await fetchUserPromptsFromDb();
    if (dbPrompts && dbPrompts.length > 0) {
      const local = getStoredGeneratorHistory();
      const localMap = new Map(local.map(i => [i.id, i]));
      for (const p of dbPrompts) {
        if (!localMap.has(p.id)) {
          localMap.set(p.id, p);
        }
      }
      const merged = Array.from(localMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      saveGeneratorHistory(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Failed to sync history from DB:', err);
  }
  return getStoredGeneratorHistory();
}

export function togglePinPrompt(id: string): HistoryPromptItem[] {
  const current = getStoredGeneratorHistory();
  const updated = current.map(item => {
    if (item.id === id) {
      return { ...item, isPinned: !item.isPinned };
    }
    return item;
  });
  saveGeneratorHistory(updated);
  return updated;
}

export function deletePromptFromHistory(id: string): HistoryPromptItem[] {
  const current = getStoredGeneratorHistory();
  const updated = current.filter(item => item.id !== id);
  saveGeneratorHistory(updated);
  try {
    deletePromptFromDb(id);
  } catch (err) {
    console.warn('Failed to delete prompt from DB:', err);
  }
  return updated;
}
