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

export const DEFAULT_GENERATOR_HISTORY: HistoryPromptItem[] = [
  // Pinned items from screenshot
  {
    id: 'pin-1',
    title: 'Interactive prompt refinement',
    ideaText: 'Interactive prompt refinement system with multi-turn feedback and structural improvisation',
    targetType: 'coding_agent',
    isPinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: 'pin-2',
    title: 'Selection operator examples',
    ideaText: 'Selection operator examples and genetic algorithm optimization pipeline in TypeScript',
    targetType: 'coding_agent',
    isPinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 'pin-3',
    title: 'Sutradhar study guide prep',
    ideaText: 'Sutradhar study guide preparation with comprehensive chapter-by-chapter analysis',
    targetType: 'freelance_sow',
    isPinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
  },
  {
    id: 'pin-4',
    title: 'Presentation explanation notes',
    ideaText: 'Executive presentation explanation notes and slide-by-slide speaker talking points',
    targetType: 'freelance_sow',
    isPinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'pin-5',
    title: 'Hackathon problem statement',
    ideaText: 'AI agentic workflow hackathon problem statement and lean 24-hour MVP sprint plan',
    targetType: 'hackathon_mvp',
    isPinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 36,
  },
  // Chats and tasks from screenshot
  {
    id: 'chat-1',
    title: 'Laptop purchase feedback',
    ideaText: 'Comprehensive laptop purchase feedback and hardware benchmark analysis',
    targetType: 'coding_agent',
    isPinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: 'chat-2',
    title: 'Node MCU LED pin definition',
    ideaText: 'NodeMCU ESP8266 LED pin definitions, GPIO mapping, and PWM controller firmware',
    targetType: 'cli_tool',
    isPinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 60,
  },
  {
    id: 'chat-3',
    title: 'Project explanation and technical specs',
    ideaText: 'Project explanation and technical specification blueprint with Mermaid architecture',
    targetType: 'full_stack',
    isPinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
  },
  {
    id: 'chat-4',
    title: 'Clarification needed',
    ideaText: 'Clarification needed on authentication architecture and session tokens',
    targetType: 'full_stack',
    isPinned: false,
    statusColor: '#e5ad65',
    createdAt: Date.now() - 1000 * 60 * 60 * 84,
  },
  {
    id: 'chat-5',
    title: 'Greeting exchange',
    ideaText: 'Greeting exchange and welcome onboard flow with personalized onboarding wizard',
    targetType: 'coding_agent',
    isPinned: false,
    statusColor: '#e5ad65',
    createdAt: Date.now() - 1000 * 60 * 60 * 96,
  },
  {
    id: 'chat-6',
    title: 'Detailed explanations in simple terms',
    ideaText: 'Detailed technical explanations broken down in simple, accessible terms for stakeholders',
    targetType: 'freelance_sow',
    isPinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 110,
  },
  {
    id: 'chat-7',
    title: 'Miniterm and macterm definitions',
    ideaText: 'Miniterm and maxterm Boolean algebra definitions with Karnaugh map simplification examples',
    targetType: 'coding_agent',
    isPinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 130,
  },
];

export function getStoredGeneratorHistory(): HistoryPromptItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GENERATOR_HISTORY));
      return DEFAULT_GENERATOR_HISTORY;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Error loading generator history:', err);
  }
  return DEFAULT_GENERATOR_HISTORY;
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
  return newItem;
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
  return updated;
}
