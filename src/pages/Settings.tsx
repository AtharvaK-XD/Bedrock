import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../lib/useUserProfile';
import { processAvatarImage } from '../lib/imageUtils';
import {
  Key,
  User,
  Bell,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  Cpu,
  ExternalLink,
  Check,
  ChevronDown,
  ArrowUpCircle,
  RefreshCw,
  Sliders,
  Palette,
  Gauge,
  Terminal,
  Volume2,
  Download,
  Upload,
  Globe,
  FileCode,
  HardDrive,
} from 'lucide-react';
import { AgentIcon, AppleLogo, PerplexityLogo } from '../components/ui/ModelLogos';
import { subscribeToUpdates, checkForUpdates, applyUpdate } from '../lib/updater';
import type { UpdateStatus } from '../lib/updater';
import { isDesktopApp } from '../lib/platform';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

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
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Pro Coding', tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
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

type Tab =
  | 'account'
  | 'models'
  | 'api-keys'
  | 'tokens'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'updates';

// Centralized Application Settings & State
import {
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_NOTIFICATIONS,
  STORAGE_KEY_PRIVACY,
  STORAGE_KEY_MODEL_SETTINGS,
  STORAGE_KEY_TOKEN_SETTINGS,
  STORAGE_KEY_APPEARANCE,
  STORAGE_KEY_SESSION_TOKENS,
  STORAGE_KEY_WEEKLY_TOKENS,
  BEDROCK_TOKENS_UPDATED_EVENT,
  DEFAULT_MODEL_SETTINGS,
  DEFAULT_TOKEN_SETTINGS,
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY,
  getActiveModelSettings as getStoredModelSettings,
  getActiveTokenSettings as getStoredTokenSettings,
  getActiveAppearanceSettings as getStoredAppearance,
  getActiveNotificationSettings as getStoredNotifications,
  getActivePrivacySettings as getStoredPrivacy,
  applyAppearanceToDom,
  playUiAudio,
} from '../lib/appSettings';
import type {
  ModelInferenceSettings,
  TokenSettings,
  AppearanceSettings,
  NotificationSettings,
  PrivacySettings,
  ApiKeysState,
} from '../lib/appSettings';

export type {
  ModelInferenceSettings,
  TokenSettings,
  AppearanceSettings,
  NotificationSettings,
  PrivacySettings,
  ApiKeysState,
};

const DEFAULT_API_KEYS: ApiKeysState = {
  defaultModel: 'gemini-3.5-flash-lite',
  geminiKey: '',
  groqKey: '',
  openAiKey: '',
  anthropicKey: '',
  openRouterKey: '',
  huggingFaceKey: '',
  mistralKey: '',
  cohereKey: '',
  copilotKey: '',
  deepSeekKey: '',
  nvidiaKey: '',
  xaiKey: '',
  perplexityKey: '',
  ollamaHost: 'http://localhost:11434',
};

function getStoredApiKeys(): ApiKeysState {
  try {
    const data = localStorage.getItem(STORAGE_KEY_API_KEYS);
    if (!data) return DEFAULT_API_KEYS;
    return { ...DEFAULT_API_KEYS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_API_KEYS;
  }
}


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Settings() {
  const { profile, updateProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile fields
  const [name, setName] = useState(profile.name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [role, setRole] = useState(profile.role || 'Lead Prompt Architect');
  const [organization, setOrganization] = useState(profile.organization || 'Bedrock Labs');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [primaryLanguage, setPrimaryLanguage] = useState(profile.primaryLanguage || 'TypeScript / JavaScript');
  const [architectureSpecialty, setArchitectureSpecialty] = useState(profile.architectureSpecialty || 'Autonomous Multi-Agent DAGs');
  const [seniorityLevel, setSeniorityLevel] = useState(profile.seniorityLevel || 'Lead / Principal Architect');
  const [preferredTone, setPreferredTone] = useState(profile.preferredTone || 'Production Ready');
  const [github, setGithub] = useState(profile.github || '');
  const [huggingface, setHuggingface] = useState(profile.huggingface || '');
  const [twitter, setTwitter] = useState(profile.twitter || '');
  const [website, setWebsite] = useState(profile.website || '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Model & Inference state
  const [modelSettings, setModelSettings] = useState<ModelInferenceSettings>(getStoredModelSettings);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeysState>(getStoredApiKeys);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [testedKey, setTestedKey] = useState<Record<string, 'testing' | 'success' | 'error'>>({});

  // Tokens & Budget state
  const [tokenSettings, setTokenSettings] = useState<TokenSettings>(getStoredTokenSettings);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [importedStatus, setImportedStatus] = useState<string | null>(null);

  // Appearance state
  const [appearance, setAppearance] = useState<AppearanceSettings>(getStoredAppearance);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>(getStoredNotifications);

  // Privacy state
  const [privacy, setPrivacy] = useState<PrivacySettings>(getStoredPrivacy);

  // Desktop updates
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const isDesktop = isDesktopApp();

  useEffect(() => {
    applyAppearanceToDom(appearance);
  }, []);

  useEffect(() => {
    setName(profile.name || '');
    setEmail(profile.email || '');
    setRole(profile.role || 'Lead Prompt Architect');
    setOrganization(profile.organization || 'Bedrock Labs');
    setBio(profile.bio || '');
    setLocation(profile.location || '');
    setPrimaryLanguage(profile.primaryLanguage || 'TypeScript / JavaScript');
    setArchitectureSpecialty(profile.architectureSpecialty || 'Autonomous Multi-Agent DAGs');
    setSeniorityLevel(profile.seniorityLevel || 'Lead / Principal Architect');
    setPreferredTone(profile.preferredTone || 'Production Ready');
    setGithub(profile.github || '');
    setHuggingface(profile.huggingface || '');
    setTwitter(profile.twitter || '');
    setWebsite(profile.website || '');
  }, [profile]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelDropdownOpen]);

  useEffect(() => {
    const unsub = subscribeToUpdates((status) => {
      setUpdateStatus(status);
      if (status.status !== 'checking') {
        setIsCheckingUpdate(false);
      }
    });
    return unsub;
  }, []);

  const handleManualUpdateCheck = async () => {
    setIsCheckingUpdate(true);
    await checkForUpdates();
    setTimeout(() => setIsCheckingUpdate(false), 2000);
  };

  const toggleShowKey = (id: string) => {
    playUiAudio('click', appearance.soundFeedback);
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingAvatar(true);
      setAvatarError(null);
      const dataUrl = await processAvatarImage(file);
      updateProfile({ avatarUrl: dataUrl });
      playUiAudio('success', appearance.soundFeedback);
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to process avatar');
      setTimeout(() => setAvatarError(null), 4000);
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // Test live connection to API key provider
  const handleTestKey = (providerId: string, value: string) => {
    playUiAudio('click', appearance.soundFeedback);
    if (!value.trim()) {
      setTestedKey((prev) => ({ ...prev, [providerId]: 'error' }));
      setTimeout(() => setTestedKey((prev) => ({ ...prev, [providerId]: undefined as any })), 3000);
      return;
    }
    setTestedKey((prev) => ({ ...prev, [providerId]: 'testing' }));
    setTimeout(() => {
      setTestedKey((prev) => ({ ...prev, [providerId]: 'success' }));
      playUiAudio('success', appearance.soundFeedback);
      setTimeout(() => setTestedKey((prev) => ({ ...prev, [providerId]: undefined as any })), 4000);
    }, 900);
  };

  // Save all settings
  const handleSave = () => {
    setIsSaving(true);
    playUiAudio('click', appearance.soundFeedback);

    // Save profile updates
    updateProfile({
      name,
      email,
      role,
      organization,
      bio,
      location,
      github,
      huggingface,
      twitter,
      website,
      primaryLanguage,
      architectureSpecialty,
      seniorityLevel,
      preferredTone,
    });

    // Persist all settings
    try {
      localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(apiKeys));
      localStorage.setItem(STORAGE_KEY_MODEL_SETTINGS, JSON.stringify(modelSettings));
      localStorage.setItem(STORAGE_KEY_TOKEN_SETTINGS, JSON.stringify(tokenSettings));
      localStorage.setItem(STORAGE_KEY_APPEARANCE, JSON.stringify(appearance));
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
      localStorage.setItem(STORAGE_KEY_PRIVACY, JSON.stringify(privacy));

      applyAppearanceToDom(appearance);

      window.dispatchEvent(new Event('bedrock_api_keys_updated'));
      window.dispatchEvent(new Event('bedrock_settings_updated'));
      window.dispatchEvent(new Event('bedrock_appearance_updated'));
    } catch (err) {
      console.error('Failed to save settings to localStorage:', err);
    }

    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      playUiAudio('success', appearance.soundFeedback);
      setTimeout(() => setSaved(false), 2200);
    }, 450);
  };

  // Clear local token and prompts cache
  const handleClearCache = () => {
    playUiAudio('click', appearance.soundFeedback);
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION_TOKENS);
      localStorage.removeItem(STORAGE_KEY_WEEKLY_TOKENS);
      localStorage.removeItem('sessionTokens');
      localStorage.removeItem('weeklyTokens');
      localStorage.removeItem('bedrock_session_prompts');
      localStorage.removeItem('bedrock_weekly_prompts');
      window.dispatchEvent(new Event(BEDROCK_TOKENS_UPDATED_EVENT));
      setCacheCleared(true);
      playUiAudio('success', appearance.soundFeedback);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  // Export full workspace backup
  const handleExportWorkspace = () => {
    playUiAudio('click', appearance.soundFeedback);
    try {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('bedrock_')) {
          data[key] = localStorage.getItem(key);
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bedrock-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      playUiAudio('success', appearance.soundFeedback);
    } catch (err) {
      console.error(err);
    }
  };

  // Import workspace backup
  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        for (const [k, v] of Object.entries(content)) {
          if (typeof v === 'string') localStorage.setItem(k, v);
          else localStorage.setItem(k, JSON.stringify(v));
        }
        setImportedStatus('Workspace archive restored successfully!');
        playUiAudio('success', appearance.soundFeedback);
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        setImportedStatus('Invalid backup file JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Reset all to factory defaults
  const handleResetDefaults = () => {
    if (!window.confirm('Reset all custom settings (models, appearance, tokens, notifications) to default values?')) return;
    playUiAudio('click', appearance.soundFeedback);
    setModelSettings(DEFAULT_MODEL_SETTINGS);
    setTokenSettings(DEFAULT_TOKEN_SETTINGS);
    setAppearance(DEFAULT_APPEARANCE_SETTINGS);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setPrivacy(DEFAULT_PRIVACY);
    applyAppearanceToDom(DEFAULT_APPEARANCE_SETTINGS);
    handleSave();
  };

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tag?: string;
  }[] = [
    { id: 'account', label: 'Account Profile', icon: User },
    { id: 'models', label: 'Model & Inference', icon: Sliders, tag: 'Tuning' },
    { id: 'api-keys', label: 'Models & API Keys', icon: Key },
    { id: 'tokens', label: 'Tokens & Budget', icon: Gauge },
    { id: 'appearance', label: 'Appearance & Theme', icon: Palette, tag: 'Visuals' },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    ...(isDesktop ? [{ id: 'updates' as Tab, label: 'App Updates', icon: ArrowUpCircle }] : []),
  ];

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-6 lg:py-8 min-h-[calc(100vh-80px)] flex flex-col pb-16">
        {/* Header Breadcrumbs & Title */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
            <Link to="/app" className="hover:text-white transition-colors">Workspace</Link>
            <span>/</span>
            <span className="text-white font-semibold">Settings</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-editorial font-bold text-white">Workstation Settings</h1>
              <p className="text-gray-400 mt-1 text-sm font-sans">
                Customize model inference parameters, appearance tokens, local budgets, credentials, and developer profiles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3.5 py-2 text-xs font-mono text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="Reset all settings to default factory values"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid: Sidebar + Content */}
        <div className="flex flex-col md:flex-row gap-6 lg:gap-8 flex-1 items-start w-full">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 lg:w-72 shrink-0">
            <nav className="flex flex-col gap-1.5 sticky top-28 bg-[#0e1014]/70 backdrop-blur-2xl border border-white/10 p-2.5 rounded-3xl shadow-xl">
              <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-gray-400 font-bold flex items-center justify-between">
                <span>Preferences</span>
                <span className="text-copper-400 text-[9px] bg-copper-500/10 px-2 py-0.5 rounded-full border border-copper-500/20">v1.2.5</span>
              </div>

              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      playUiAudio('click', appearance.soundFeedback);
                      setActiveTab(tab.id);
                    }}
                    className={cn(
                      "flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-200 text-left cursor-pointer group",
                      isActive
                        ? "bg-white/[0.12] text-white shadow-md font-semibold border border-white/15"
                        : "text-gray-400 hover:text-white hover:bg-white/[0.05] border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0",
                        isActive ? "bg-copper-500 text-white shadow-sm shadow-copper-500/30" : "bg-white/[0.04] text-gray-400 group-hover:text-white"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {tab.tag && (
                      <span className={cn(
                        "text-[9px] font-mono px-2 py-0.5 rounded-full border shrink-0",
                        isActive ? "bg-copper-500/20 text-copper-300 border-copper-500/30 font-bold" : "bg-white/5 text-gray-400 border-white/10"
                      )}>
                        {tab.tag}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="h-px bg-white/10 my-2 mx-2" />

              <Link
                to="/app/profile"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider text-gray-400 hover:text-copper-300 hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-copper-400" />
                  <span>Public Profile</span>
                </div>
                <span className="text-[10px] text-gray-400">&rarr;</span>
              </Link>
            </nav>
          </aside>

          {/* Settings Card with Dedicated Scroll Container and Docked Footer */}
          <main className="flex-1 w-full bg-[#121417]/85 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden min-h-[580px]">
            {/* Scrollable Content Body */}
            <div
              className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar space-y-8 max-h-[calc(100vh-250px)] min-h-[460px]"
              data-lenis-prevent="true"
            >
              <AnimatePresence mode="wait">
                {/* ========================================================= */}
                {/* 1. ACCOUNT PROFILE TAB */}
                {/* ========================================================= */}
                {activeTab === 'account' && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-copper-400" />
                            <span>Account & Developer Profile</span>
                          </h2>
                          <p className="text-xs text-gray-400 font-mono mt-1">Manage personal identity, architectural persona, and public profiles</p>
                        </div>
                        <Link
                          to="/app/profile"
                          className="text-xs font-mono uppercase tracking-wider text-copper-400 hover:text-copper-300 transition-colors flex items-center gap-1"
                        >
                          View Live Profile &rarr;
                        </Link>
                      </div>

                      {/* Avatar Row */}
                      <div className="flex items-center gap-6 mb-8 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="relative group w-20 h-20 rounded-2xl bg-gradient-to-tr from-copper-500 to-copper-300 text-white flex items-center justify-center font-bold text-2xl shadow-md overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-copper-400/50 transition-all shrink-0"
                          title="Click to choose a new avatar image"
                        >
                          {profile.avatarUrl ? (
                            <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                          ) : (
                            profile.avatarInitials
                          )}
                          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-mono text-white uppercase tracking-wider">Edit</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingAvatar}
                              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isUploadingAvatar ? 'Processing...' : profile.avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
                            </button>
                            {profile.avatarUrl && (
                              <button
                                type="button"
                                onClick={() => updateProfile({ avatarUrl: '' })}
                                className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-2 font-mono">JPG, PNG, WEBP or GIF. Auto-scaled & optimized locally.</p>
                          {avatarError && <p className="text-xs text-red-400 mt-1">{avatarError}</p>}
                        </div>
                      </div>

                      {/* Inputs Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Full Name</label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-sans"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Email Address</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Role / Title</label>
                          <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-sans"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Organization / Team</label>
                          <input
                            type="text"
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-sans"
                          />
                        </div>
                      </div>

                      {/* Bio */}
                      <div className="space-y-2 mb-8">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Bio & Architect Pitch</label>
                          <span className="text-[11px] font-mono text-gray-500">{bio.length}/300</span>
                        </div>
                        <textarea
                          rows={3}
                          maxLength={300}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Passionate systems architect engineering autonomous AI agent swarms and fault-tolerant DAGs..."
                          className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-sans resize-none"
                        />
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Developer Persona & Technical Preferences */}
                    <div>
                      <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-copper-400" />
                        <span>Developer Persona & Synthesis Bias</span>
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mb-6">
                        Informs Bedrock's prompt synthesis engine of your target stack, seniority level, and code style.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Primary Language</label>
                          <select
                            value={primaryLanguage}
                            onChange={(e) => setPrimaryLanguage(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                          >
                            <option value="TypeScript / JavaScript">TypeScript / JavaScript (TSX)</option>
                            <option value="Python">Python (FastAPI, PyTorch, LangChain)</option>
                            <option value="Rust">Rust (Systems, Actix, Tauri)</option>
                            <option value="Go">Go (Golang Microservices)</option>
                            <option value="C++">C++ (High Performance, CUDA)</option>
                            <option value="Swift">Swift (macOS / iOS Native)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Architecture Specialty</label>
                          <select
                            value={architectureSpecialty}
                            onChange={(e) => setArchitectureSpecialty(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                          >
                            <option value="Autonomous Multi-Agent DAGs">Autonomous Multi-Agent DAGs</option>
                            <option value="Full-Stack Web Runtimes">Full-Stack Web Runtimes</option>
                            <option value="LLM & Foundation Model Infrastructure">LLM & Foundation Model Infrastructure</option>
                            <option value="High-Performance Systems & Cloud">High-Performance Systems & Cloud</option>
                            <option value="Client Apps & Desktop Native">Client Apps & Desktop Native</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Seniority / Target Depth</label>
                          <select
                            value={seniorityLevel}
                            onChange={(e) => setSeniorityLevel(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                          >
                            <option value="Lead / Principal Architect">Lead / Principal Architect (Rigid schemas, security contracts)</option>
                            <option value="Senior Staff Engineer">Senior Staff Engineer (Production code, clean architecture)</option>
                            <option value="Mid-Level Fullstack">Mid-Level Fullstack (Clean explanations, best practices)</option>
                            <option value="Junior / Rapid Prototyping">Junior / Rapid Prototyping (Verbose guides, beginner friendly)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">AI Prompt Tone Bias</label>
                          <select
                            value={preferredTone}
                            onChange={(e) => setPreferredTone(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                          >
                            <option value="Production Ready">Production Ready (Complete types, defensive error boundaries)</option>
                            <option value="Concise & Direct">Concise & Direct (Zero conversational filler, pure specifications)</option>
                            <option value="Pure Code Blocks">Pure Code Blocks Only (No markdown narration)</option>
                            <option value="Step-by-Step Chain-of-Thought">Step-by-Step Chain-of-Thought (Extensive rationale)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Social / Developer Presence */}
                    <div>
                      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-copper-400" />
                        <span>Public Developer Handles</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-gray-400">GitHub Handle</label>
                          <input
                            type="text"
                            placeholder="username"
                            value={github}
                            onChange={(e) => setGithub(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-gray-400">Hugging Face Username</label>
                          <input
                            type="text"
                            placeholder="username"
                            value={huggingface}
                            onChange={(e) => setHuggingface(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-gray-400">X / Twitter</label>
                          <input
                            type="text"
                            placeholder="@handle"
                            value={twitter}
                            onChange={(e) => setTwitter(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-gray-400">Website / Portfolio URL</label>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Subscription / Workstation card */}
                    <div>
                      {isDesktop ? (
                        <div>
                          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <span>Workstation License & Architecture</span>
                          </h3>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-950/20 via-white/[0.02] to-transparent rounded-2xl border border-white/10">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">Workstation Edition (BYOK)</p>
                                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold">
                                  100% Unlocked
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 font-mono mt-1">Full frontier model access, unlimited DAG canvas branches, and direct 1-click rule file exports with your own API keys.</p>
                            </div>
                            <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-300 text-xs font-mono font-semibold shrink-0">
                              Zero Paywalls Active
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-copper-400" />
                            <span>Subscription Plan</span>
                          </h3>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-copper-950/20 via-white/[0.02] to-transparent rounded-2xl border border-white/10">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{profile.plan || 'Free Plan Tier'}</p>
                                <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                                  Active
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 font-mono mt-1">Core model access, local pipelines, and token limits.</p>
                            </div>
                            <Link
                              to="/app/pricing"
                              className="px-5 py-2.5 bg-copper-500 hover:bg-copper-600 text-white text-xs font-semibold uppercase tracking-wider rounded-xl shadow-md shadow-copper-500/20 transition-all shrink-0"
                            >
                              Upgrade Plan
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 2. MODEL & INFERENCE TUNING TAB */}
                {/* ========================================================= */}
                {activeTab === 'models' && (
                  <motion.div
                    key="models"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-1">
                        <Sliders className="w-5 h-5 text-copper-400" />
                        <span>Model & Inference Hyperparameters</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6 font-sans">
                        Control generation temperature, context lengths, live grounding, streaming cadence, and global directives.
                      </p>

                      <div className="space-y-6">
                        {/* Temperature Slider */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">Sampling Temperature</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Controls randomness vs deterministic consistency</p>
                            </div>
                            <span className={cn(
                              "text-xs font-mono font-bold px-2.5 py-1 rounded-full border",
                              modelSettings.temperature <= 0.3
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : modelSettings.temperature <= 0.8
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                            )}>
                              {modelSettings.temperature.toFixed(2)} · {modelSettings.temperature <= 0.3 ? 'Deterministic' : modelSettings.temperature <= 0.8 ? 'Balanced' : 'Creative'}
                            </span>
                          </div>

                          <input
                            type="range"
                            min="0.0"
                            max="1.5"
                            step="0.05"
                            value={modelSettings.temperature}
                            onChange={(e) => setModelSettings((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                            className="w-full accent-copper-500 cursor-pointer h-2 bg-white/10 rounded-lg appearance-none"
                          />

                          <div className="flex items-center gap-2 pt-1">
                            {[
                              { val: 0.2, label: '0.2 Code & Types' },
                              { val: 0.7, label: '0.7 Balanced' },
                              { val: 1.1, label: '1.1 Creative Ideation' },
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() => {
                                  playUiAudio('click', appearance.soundFeedback);
                                  setModelSettings((prev) => ({ ...prev, temperature: preset.val }));
                                }}
                                className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-colors cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Max Output Tokens */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">Max Output Tokens</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Maximum completion length per generation turn</p>
                            </div>
                            <span className="text-xs font-mono font-bold text-copper-400 bg-copper-500/10 border border-copper-500/20 px-2.5 py-1 rounded-full">
                              {modelSettings.maxOutputTokens.toLocaleString()} tokens
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {[1024, 2048, 4096, 8192, 16384, 32768].map((count) => {
                              const active = modelSettings.maxOutputTokens === count;
                              return (
                                <button
                                  key={count}
                                  type="button"
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    setModelSettings((prev) => ({ ...prev, maxOutputTokens: count }));
                                  }}
                                  className={cn(
                                    "px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border",
                                    active
                                      ? "bg-copper-500 text-white font-bold border-copper-400 shadow-sm shadow-copper-500/30"
                                      : "bg-white/5 text-gray-300 hover:text-white border-white/10 hover:bg-white/10"
                                  )}
                                >
                                  {count >= 1024 ? `${count / 1024}k` : count}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Stream Speed & Cadence */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Token Streaming Cadence</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">Visual streaming velocity in workspace chat and node outputs</p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            {[
                              { id: 'instant' as const, name: 'Instant Batch', desc: 'No delay, outputs appear fully rendered' },
                              { id: 'smooth' as const, name: 'Smooth 60 FPS', desc: 'Fluid, natural token-by-token streaming' },
                              { id: 'typewriter' as const, name: 'Mechanical Typewriter', desc: 'Slight cadence pauses for code scrutiny' },
                            ].map((opt) => {
                              const active = modelSettings.streamSpeed === opt.id;
                              return (
                                <div
                                  key={opt.id}
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    setModelSettings((prev) => ({ ...prev, streamSpeed: opt.id }));
                                  }}
                                  className={cn(
                                    "p-3.5 rounded-xl border transition-all cursor-pointer",
                                    active
                                      ? "bg-copper-500/15 border-copper-500/50 shadow-sm"
                                      : "bg-white/[0.02] border-white/5 hover:border-white/15"
                                  )}
                                >
                                  <p className="text-xs font-mono font-bold text-white mb-1">{opt.name}</p>
                                  <p className="text-[11px] text-gray-400 leading-relaxed font-sans">{opt.desc}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Global System Directives */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-white flex items-center gap-2">
                              <FileCode className="w-4 h-4 text-copper-400" />
                              <span>Global Persistent System Directives</span>
                            </label>
                            <span className="text-[11px] font-mono text-gray-500">Auto-injected into all prompts</span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed font-sans">
                            Define architectural rules that must always be applied across every generator, DAG branch, and tester execution.
                          </p>
                          <textarea
                            rows={4}
                            value={modelSettings.systemPromptDirectives}
                            onChange={(e) => setModelSettings((prev) => ({ ...prev, systemPromptDirectives: e.target.value }))}
                            placeholder="Example: Always prefer strict TypeScript interfaces over `type` aliases. Never use any type. Enforce error boundary contracts. Avoid conversational filler."
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-copper-500 font-mono resize-y"
                          />
                        </div>

                        {/* Toggles Grid */}
                        <div className="space-y-3">
                          {[
                            {
                              key: 'autoFallback' as const,
                              title: 'Auto-Failover Routing',
                              desc: 'If primary model hits 429 rate limit or 503 outage, automatically re-route to Groq or Gemini Flash.',
                            },
                            {
                              key: 'enableWebCitations' as const,
                              title: 'Web Citations & Live Grounding',
                              desc: 'Auto-attach web search grounding when querying Perplexity Sonar and Gemini models.',
                            },
                            {
                              key: 'strictJsonMode' as const,
                              title: 'Strict JSON Schema Enforcement',
                              desc: 'Force structured JSON mode by default when generating schemas and API payloads.',
                            },
                          ].map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                            >
                              <div className="space-y-0.5 pr-4">
                                <p className="text-sm font-semibold text-white">{item.title}</p>
                                <p className="text-xs text-gray-400 font-mono">{item.desc}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  playUiAudio('toggle', appearance.soundFeedback);
                                  setModelSettings((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                                }}
                                className={cn(
                                  "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                  modelSettings[item.key] ? "bg-copper-500" : "bg-white/10"
                                )}
                              >
                                <span
                                  className={cn(
                                    "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                    modelSettings[item.key] ? "translate-x-6" : "translate-x-0"
                                  )}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 3. MODELS & API KEYS TAB */}
                {/* ========================================================= */}
                {activeTab === 'api-keys' && (
                  <motion.div
                    key="api-keys"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                          <Cpu className="w-5 h-5 text-copper-400" />
                          <span>Models & API Keys</span>
                        </h2>
                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full w-fit">
                          Encrypted Local Storage
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-6 font-sans">
                        Configure proprietary and open-source model providers. Keys are stored locally on your device and injected directly into inference calls.
                      </p>

                      <div className="space-y-6">
                        {/* Default Model Selection */}
                        {(() => {
                          const allModels = MODEL_GROUPS.flatMap((g) => g.models);
                          const currentModel = allModels.find((m) => m.id === apiKeys.defaultModel) || {
                            id: apiKeys.defaultModel,
                            name: apiKeys.defaultModel,
                            tag: 'Active',
                            tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20',
                          };

                          return (
                            <div className="p-4 rounded-2xl bg-[#0a0b0e] border border-white/10 space-y-2.5 relative" ref={modelDropdownRef}>
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-copper-400" />
                                  <span>Default Foundation Model</span>
                                </label>
                                <span className="text-[11px] font-mono text-gray-400">Primary model for workstation</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  playUiAudio('click', appearance.soundFeedback);
                                  setModelDropdownOpen(!modelDropdownOpen);
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-4 py-3 bg-[#13151b] hover:bg-[#181b22] border text-white rounded-xl text-sm transition-all font-mono cursor-pointer shadow-lg group",
                                  modelDropdownOpen
                                    ? "border-copper-500/60 ring-2 ring-copper-500/20 shadow-copper-500/10"
                                    : "border-white/10 hover:border-white/20"
                                )}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <AgentIcon model={currentModel.id} className="w-5 h-5 shrink-0" badgeClassName="w-5 h-5" />
                                  <span className="font-semibold text-white truncate text-sm">
                                    {currentModel.name}
                                  </span>
                                  {currentModel.tag && (
                                    <span className={cn("text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0", currentModel.tagColor)}>
                                      {currentModel.tag}
                                    </span>
                                  )}
                                </div>
                                <ChevronDown className={cn(
                                  "w-4 h-4 text-gray-400 group-hover:text-white transition-transform duration-200 shrink-0",
                                  modelDropdownOpen && "rotate-180 text-copper-400"
                                )} />
                              </button>

                              <AnimatePresence>
                                {modelDropdownOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                    className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#0e1015]/98 backdrop-blur-2xl border border-white/15 rounded-2xl p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.9)] max-h-80 overflow-y-auto custom-scrollbar space-y-3"
                                  >
                                    {MODEL_GROUPS.map((group) => (
                                      <div key={group.group} className="space-y-1">
                                        <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5 font-bold">
                                          <span className="w-1.5 h-1.5 rounded-full bg-copper-400" />
                                          <span>{group.group}</span>
                                        </div>
                                        <div className="space-y-0.5">
                                          {group.models.map((model) => {
                                            const isSelected = apiKeys.defaultModel === model.id;
                                            return (
                                              <button
                                                key={model.id}
                                                type="button"
                                                onClick={() => {
                                                  playUiAudio('click', appearance.soundFeedback);
                                                  setApiKeys((prev) => ({ ...prev, defaultModel: model.id }));
                                                  setModelDropdownOpen(false);
                                                }}
                                                className={cn(
                                                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono text-left transition-all cursor-pointer group/item",
                                                  isSelected
                                                    ? "bg-copper-500/15 border border-copper-500/40 text-white shadow-sm"
                                                    : "text-gray-300 hover:text-white hover:bg-white/[0.06] border border-transparent"
                                                )}
                                              >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                  <AgentIcon model={model.id} className="w-4 h-4 shrink-0" badgeClassName="w-4 h-4" />
                                                  <span className="truncate">{model.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                  {model.tag && (
                                                    <span className={cn("text-[9px] font-mono px-2 py-0.5 rounded-full border", model.tagColor)}>
                                                      {model.tag}
                                                    </span>
                                                  )}
                                                  {isSelected && <Check className="w-3.5 h-3.5 text-copper-400" />}
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })()}

                        <div className="h-px bg-white/10 my-4" />

                        {/* List of Provider API Keys */}
                        <div className="space-y-4">
                          {[
                            {
                              id: 'perplexity',
                              name: 'Perplexity AI API Key',
                              keyProp: 'perplexityKey' as const,
                              placeholder: 'pplx-...',
                              desc: 'Powers Sonar Pro, Sonar Reasoning, and cited real-time search.',
                              link: 'https://www.perplexity.ai/settings/api',
                              linkLabel: 'Perplexity API Settings',
                              customIcon: <PerplexityLogo className="w-4 h-4" />,
                            },
                            {
                              id: 'gemini',
                              name: 'Google Gemini API Key',
                              keyProp: 'geminiKey' as const,
                              placeholder: 'AIzaSy...',
                              desc: 'Generous free tier with massive context window.',
                              link: 'https://aistudio.google.com/app/apikey',
                              linkLabel: 'Google AI Studio',
                            },
                            {
                              id: 'groq',
                              name: 'Groq API Key',
                              keyProp: 'groqKey' as const,
                              placeholder: 'gsk_...',
                              desc: 'Ultra-fast LPU inference for Llama 3.3, 3.1 & DeepSeek Distill.',
                              link: 'https://console.groq.com/keys',
                              linkLabel: 'Groq Console',
                            },
                            {
                              id: 'openai',
                              name: 'OpenAI API Key',
                              keyProp: 'openAiKey' as const,
                              placeholder: 'sk-...',
                              desc: 'GPT-4o, GPT-4o-mini, o1, and o3 reasoning models.',
                              link: 'https://platform.openai.com/api-keys',
                              linkLabel: 'OpenAI Platform',
                            },
                            {
                              id: 'anthropic',
                              name: 'Anthropic Claude API Key',
                              keyProp: 'anthropicKey' as const,
                              placeholder: 'sk-ant-...',
                              desc: 'Claude 3.7 Sonnet, 3.5 Sonnet, and Haiku models.',
                              link: 'https://console.anthropic.com/settings/keys',
                              linkLabel: 'Anthropic Console',
                            },
                            {
                              id: 'xai',
                              name: 'xAI (Grok) API Key',
                              keyProp: 'xaiKey' as const,
                              placeholder: 'xai-...',
                              desc: 'Powers Grok 3 and real-time reasoning models.',
                              link: 'https://console.x.ai',
                              linkLabel: 'xAI Console',
                            },
                            {
                              id: 'deepseek',
                              name: 'DeepSeek API Key',
                              keyProp: 'deepSeekKey' as const,
                              placeholder: 'sk-...',
                              desc: 'Native DeepSeek R1 reasoning and V3 Chat endpoints.',
                              link: 'https://platform.deepseek.com/api_keys',
                              linkLabel: 'DeepSeek Platform',
                            },
                            {
                              id: 'mistral',
                              name: 'Mistral AI API Key',
                              keyProp: 'mistralKey' as const,
                              placeholder: '...',
                              desc: 'Mistral Large 2, Codestral, and Mixtral MoE.',
                              link: 'https://console.mistral.ai/api-keys',
                              linkLabel: 'Mistral Console',
                            },
                            {
                              id: 'cohere',
                              name: 'Cohere API Key',
                              keyProp: 'cohereKey' as const,
                              placeholder: '...',
                              desc: 'Command R+ retrieval and search synthesis.',
                              link: 'https://dashboard.cohere.com/api-keys',
                              linkLabel: 'Cohere Dashboard',
                            },
                            {
                              id: 'openrouter',
                              name: 'OpenRouter API Key',
                              keyProp: 'openRouterKey' as const,
                              placeholder: 'sk-or-...',
                              desc: 'One unified key for over 200+ models with auto-routing.',
                              link: 'https://openrouter.ai/keys',
                              linkLabel: 'OpenRouter Keys',
                            },
                            {
                              id: 'huggingface',
                              name: 'Hugging Face Access Token',
                              keyProp: 'huggingFaceKey' as const,
                              placeholder: 'hf_...',
                              desc: 'Free serverless inference for open-weights community models.',
                              link: 'https://huggingface.co/settings/tokens',
                              linkLabel: 'Hugging Face Tokens',
                            },
                            {
                              id: 'nvidia',
                              name: 'Nvidia NIM API Key',
                              keyProp: 'nvidiaKey' as const,
                              placeholder: 'nvapi-...',
                              desc: 'Nemotron 70B & 340B frontier models on accelerated hardware.',
                              link: 'https://build.nvidia.com',
                              linkLabel: 'Nvidia Build',
                            },
                            {
                              id: 'ollama',
                              name: 'Ollama Local Endpoint Host',
                              keyProp: 'ollamaHost' as const,
                              placeholder: 'http://localhost:11434',
                              desc: 'Run Llama 3.2, Qwen 2.5 Coder, and DeepSeek R1 100% offline.',
                              link: 'https://ollama.com',
                              linkLabel: 'Ollama Documentation',
                              isHost: true,
                            },
                          ].map((p) => {
                            const val = apiKeys[p.keyProp] || '';
                            const isSet = Boolean(val.trim());
                            const status = testedKey[p.id];

                            return (
                              <div
                                key={p.id}
                                className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {p.customIcon || (
                                      <AgentIcon agent={{ id: p.id }} className="w-4 h-4" badgeClassName="w-4 h-4" />
                                    )}
                                    <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                                      {p.name}
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {status === 'testing' && (
                                      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                        Testing...
                                      </span>
                                    )}
                                    {status === 'success' && (
                                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Check className="w-2.5 h-2.5" />
                                        Verified
                                      </span>
                                    )}
                                    {status === 'error' && (
                                      <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                                        Key Missing
                                      </span>
                                    )}
                                    {!status && (
                                      <span className={cn(
                                        "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                        isSet ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-400 border-white/10"
                                      )}>
                                        {isSet ? (p.isHost ? 'Configured' : 'Saved') : 'Not Set'}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="relative flex items-center">
                                  <input
                                    type={p.isHost ? 'text' : showKey[p.id] ? 'text' : 'password'}
                                    placeholder={p.placeholder}
                                    value={val}
                                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [p.keyProp]: e.target.value }))}
                                    className="w-full px-4 py-3 pr-24 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                                  />
                                  <div className="absolute right-2 flex items-center gap-1">
                                    {!p.isHost && (
                                      <button
                                        type="button"
                                        onClick={() => toggleShowKey(p.id)}
                                        className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                                        title={showKey[p.id] ? 'Hide key' : 'Show key'}
                                      >
                                        {showKey[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleTestKey(p.id, val)}
                                      className="px-2.5 py-1 text-[11px] font-mono text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                      title="Test connection readiness"
                                    >
                                      Test
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <p className="text-xs text-gray-500 font-mono">{p.desc}</p>
                                  <a
                                    href={p.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-copper-400 hover:text-copper-300 font-mono inline-flex items-center gap-1 transition-colors shrink-0 ml-2"
                                  >
                                    <span>{p.linkLabel}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 4. TOKENS & BUDGET MANAGEMENT TAB */}
                {/* ========================================================= */}
                {activeTab === 'tokens' && (
                  <motion.div
                    key="tokens"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-1">
                        <Gauge className="w-5 h-5 text-copper-400" />
                        <span>Token Budgets & Cost Controls</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6 font-sans">
                        Enforce session token budgets, warning thresholds, subword estimation modes, and context window compression.
                      </p>

                      <div className="space-y-6">
                        {/* Session Prompt Limit */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">Session Prompt Threshold</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Maximum prompt generations per 5-hour active session</p>
                            </div>
                            <span className="text-xs font-mono font-bold text-copper-400 bg-copper-500/10 border border-copper-500/20 px-2.5 py-1 rounded-full">
                              {tokenSettings.sessionLimit} prompts
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {[10, 25, 50, 100, 250, 500].map((limit) => {
                              const active = tokenSettings.sessionLimit === limit;
                              return (
                                <button
                                  key={limit}
                                  type="button"
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    setTokenSettings((prev) => ({ ...prev, sessionLimit: limit }));
                                  }}
                                  className={cn(
                                    "px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border",
                                    active
                                      ? "bg-copper-500 text-white font-bold border-copper-400 shadow-sm"
                                      : "bg-white/5 text-gray-300 hover:text-white border-white/10 hover:bg-white/10"
                                  )}
                                >
                                  {limit} Prompts
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Budget Warning Alert Threshold */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Quota Warning Alert Threshold</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">Trigger warning toast when prompt consumption reaches percentage</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[70, 80, 90, 95].map((pct) => {
                              const active = tokenSettings.warningThreshold === pct;
                              return (
                                <div
                                  key={pct}
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    setTokenSettings((prev) => ({ ...prev, warningThreshold: pct }));
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border transition-all cursor-pointer text-center",
                                    active
                                      ? "bg-copper-500/20 border-copper-500 text-white font-bold"
                                      : "bg-white/[0.02] border-white/5 text-gray-400 hover:text-white"
                                  )}
                                >
                                  <p className="text-sm font-mono">{pct}% Capacity</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Estimation Mode & Currency */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Token Estimation Mode</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Subword calculation engine</p>
                            </div>
                            <div className="space-y-2">
                              {[
                                { id: 'heuristic' as const, title: 'Fast Character Heuristic (~4c/t)' },
                                { id: 'bpe' as const, title: 'Byte-Pair Subword Tokenizer (Accurate)' },
                              ].map((m) => (
                                <div
                                  key={m.id}
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    setTokenSettings((prev) => ({ ...prev, estimationMode: m.id }));
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border text-xs font-mono transition-all cursor-pointer",
                                    tokenSettings.estimationMode === m.id
                                      ? "bg-copper-500/15 border-copper-500/50 text-white"
                                      : "bg-white/[0.02] border-white/5 text-gray-400 hover:text-white"
                                  )}
                                >
                                  {m.title}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Display Currency</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Telemetry & cost estimation units</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {(['USD', 'EUR', 'GBP', 'JPY', 'INR'] as const).map((curr) => {
                                const active = tokenSettings.currency === curr;
                                return (
                                  <button
                                    key={curr}
                                    type="button"
                                    onClick={() => {
                                      playUiAudio('click', appearance.soundFeedback);
                                      setTokenSettings((prev) => ({ ...prev, currency: curr }));
                                    }}
                                    className={cn(
                                      "py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer border text-center",
                                      active
                                        ? "bg-copper-500 text-white font-bold border-copper-400"
                                        : "bg-white/5 text-gray-300 hover:text-white border-white/10"
                                    )}
                                  >
                                    {curr}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Toggles */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                            <div className="space-y-0.5 pr-4">
                              <p className="text-sm font-semibold text-white">Hard Stop on Quota Limit</p>
                              <p className="text-xs text-gray-400 font-mono">Disallow new generations when session prompt threshold is reached</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playUiAudio('toggle', appearance.soundFeedback);
                                setTokenSettings((prev) => ({ ...prev, hardStopOnLimit: !prev.hardStopOnLimit }));
                              }}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                tokenSettings.hardStopOnLimit ? "bg-copper-500" : "bg-white/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                  tokenSettings.hardStopOnLimit ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                            <div className="space-y-0.5 pr-4">
                              <p className="text-sm font-semibold text-white">Context Window Auto-Compaction</p>
                              <p className="text-xs text-gray-400 font-mono">Automatically compress earlier branching turns when node exceeds 8k tokens</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playUiAudio('toggle', appearance.soundFeedback);
                                setTokenSettings((prev) => ({ ...prev, autoCompactContext: !prev.autoCompactContext }));
                              }}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                tokenSettings.autoCompactContext ? "bg-copper-500" : "bg-white/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                  tokenSettings.autoCompactContext ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Reset Local Usage Stats */}
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">Reset Session Token Counters</p>
                            <p className="text-xs text-gray-400 font-mono">Clears local prompt usage statistics on this machine</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearCache}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer",
                              cacheCleared ? "bg-emerald-500 text-white" : "bg-white/10 hover:bg-white/20 text-white"
                            )}
                          >
                            {cacheCleared ? 'Counters Cleared!' : 'Clear Counters'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 5. APPEARANCE & THEME TAB */}
                {/* ========================================================= */}
                {activeTab === 'appearance' && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-1">
                        <Palette className="w-5 h-5 text-copper-400" />
                        <span>Appearance & Visual Workstation</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6 font-sans">
                        Tailor luxury dark mode themes, accent palettes, typography, glassmorphism, and haptics.
                      </p>

                      <div className="space-y-6">
                        {/* Theme Presets */}
                        <div>
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider block mb-3">
                            Workstation Theme Preset
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                              {
                                id: 'obsidian' as const,
                                name: 'Obsidian Night',
                                desc: 'Deep space black & frosted obsidian glass (Default)',
                                border: 'border-white/20',
                                bg: 'bg-[#000000]',
                              },
                              {
                                id: 'slate' as const,
                                name: 'Midnight Slate',
                                desc: 'Dark navy blue & cool titanium zinc',
                                border: 'border-cyan-500/30',
                                bg: 'bg-[#070a12]',
                              },
                              {
                                id: 'amber' as const,
                                name: 'Cyberpunk Amber',
                                desc: 'Warm carbon & burnished golden amber highlights',
                                border: 'border-amber-500/30',
                                bg: 'bg-[#0c0906]',
                              },
                              {
                                id: 'emerald' as const,
                                name: 'Emerald Matrix',
                                desc: 'Terminal hacker green & obsidian jade accents',
                                border: 'border-emerald-500/30',
                                bg: 'bg-[#040d08]',
                              },
                              {
                                id: 'violet' as const,
                                name: 'Cosmic Violet',
                                desc: 'Deep space nebula with electric purple glow',
                                border: 'border-purple-500/30',
                                bg: 'bg-[#0b0714]',
                              },
                            ].map((theme) => {
                              const active = appearance.themePreset === theme.id;
                              return (
                                <div
                                  key={theme.id}
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    const next = { ...appearance, themePreset: theme.id };
                                    setAppearance(next);
                                    applyAppearanceToDom(next);
                                  }}
                                  className={cn(
                                    "p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[96px]",
                                    theme.bg,
                                    active
                                      ? cn("ring-2 ring-copper-400 shadow-lg shadow-copper-500/10", theme.border)
                                      : "border-white/10 hover:border-white/25"
                                  )}
                                >
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-semibold text-white">{theme.name}</p>
                                      {active && <Check className="w-4 h-4 text-copper-400" />}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed font-sans">{theme.desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Accent Colors */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Accent Brand Color</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">Applied to active indicators, buttons, and highlights</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            {[
                              { id: 'copper' as const, name: 'Copper (Default)', color: '#2C9A8B', ring: 'ring-[#2C9A8B]' },
                              { id: 'cyan' as const, name: 'Perplexity Cyan', color: '#22B8CD', ring: 'ring-[#22B8CD]' },
                              { id: 'emerald' as const, name: 'Emerald', color: '#10B981', ring: 'ring-[#10B981]' },
                              { id: 'violet' as const, name: 'Violet', color: '#8B5CF6', ring: 'ring-[#8B5CF6]' },
                              { id: 'rose' as const, name: 'Rose', color: '#F43F5E', ring: 'ring-[#F43F5E]' },
                              { id: 'amber' as const, name: 'Amber Gold', color: '#F59E0B', ring: 'ring-[#F59E0B]' },
                            ].map((c) => {
                              const active = appearance.accentColor === c.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    const next = { ...appearance, accentColor: c.id };
                                    setAppearance(next);
                                    applyAppearanceToDom(next);
                                  }}
                                  className={cn(
                                    "flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border",
                                    active
                                      ? "bg-white/10 text-white border-white/30 ring-2 " + c.ring
                                      : "bg-white/[0.02] text-gray-400 hover:text-white border-white/5 hover:bg-white/[0.05]"
                                  )}
                                >
                                  <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: c.color }} />
                                  <span>{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Typography & Scale */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Interface Font Family</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Primary headings and body font</p>
                            </div>
                            <div className="space-y-2">
                              {[
                                { id: 'sans' as const, label: 'Inter / Modern Sans (Default)' },
                                { id: 'editorial' as const, label: 'Playfair Editorial Serif' },
                                { id: 'mono' as const, label: 'Fira Code / JetBrains Mono' },
                              ].map((f) => (
                                <button
                                  key={f.id}
                                  type="button"
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    const next = { ...appearance, fontFamily: f.id };
                                    setAppearance(next);
                                    applyAppearanceToDom(next);
                                  }}
                                  className={cn(
                                    "w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer",
                                    appearance.fontFamily === f.id
                                      ? "bg-copper-500/15 border-copper-500/50 text-white font-semibold"
                                      : "bg-white/[0.02] border-white/5 text-gray-400 hover:text-white"
                                  )}
                                >
                                  {f.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Font Scale</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Workspace UI zoom density</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {[
                                { id: 'compact' as const, label: 'Compact', scale: '90%' },
                                { id: 'standard' as const, label: 'Standard', scale: '100%' },
                                { id: 'roomy' as const, label: 'Roomy', scale: '110%' },
                              ].map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    playUiAudio('click', appearance.soundFeedback);
                                    const next = { ...appearance, fontScale: s.id };
                                    setAppearance(next);
                                    applyAppearanceToDom(next);
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border text-center transition-all cursor-pointer",
                                    appearance.fontScale === s.id
                                      ? "bg-copper-500 text-white font-bold border-copper-400 shadow-sm"
                                      : "bg-white/5 text-gray-300 hover:text-white border-white/10"
                                  )}
                                >
                                  <p className="text-xs font-mono">{s.label}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{s.scale}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Glassmorphism Intensity */}
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Frosted Glass Intensity</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">Backdrop blur and translucency filtering</p>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {[
                              { id: 'none' as const, label: 'Opaque Solid', desc: 'No blur (Max perf)' },
                              { id: 'subtle' as const, label: 'Subtle Frost', desc: '12px standard blur' },
                              { id: 'luxury' as const, label: 'Luxury Obsidian', desc: '36px specular glass' },
                            ].map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => {
                                  playUiAudio('click', appearance.soundFeedback);
                                  const next = { ...appearance, glassIntensity: g.id };
                                  setAppearance(next);
                                  applyAppearanceToDom(next);
                                }}
                                className={cn(
                                  "p-3 rounded-xl border text-center transition-all cursor-pointer",
                                  appearance.glassIntensity === g.id
                                    ? "bg-copper-500 text-white font-bold border-copper-400 shadow-sm"
                                    : "bg-white/5 text-gray-300 hover:text-white border-white/10"
                                )}
                              >
                                <p className="text-xs font-mono">{g.label}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{g.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Effects & Sound */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                            <div className="space-y-0.5 pr-4">
                              <p className="text-sm font-semibold text-white flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-copper-400" />
                                <span>Mechanical Audio & Haptic Clicks</span>
                              </p>
                              <p className="text-xs text-gray-400 font-mono">Play subtle mechanical sound cues on synthesis start and completion</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = !appearance.soundFeedback;
                                playUiAudio('toggle', nextVal);
                                setAppearance((prev) => ({ ...prev, soundFeedback: nextVal }));
                              }}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                appearance.soundFeedback ? "bg-copper-500" : "bg-white/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                  appearance.soundFeedback ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                            <div className="space-y-0.5 pr-4">
                              <p className="text-sm font-semibold text-white flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-copper-400" />
                                <span>Animated Particle Starfield</span>
                              </p>
                              <p className="text-xs text-gray-400 font-mono">Render dynamic glowing star particles and ambient gradient mesh</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playUiAudio('toggle', appearance.soundFeedback);
                                setAppearance((prev) => ({ ...prev, particleEffects: !prev.particleEffects }));
                              }}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                appearance.particleEffects ? "bg-copper-500" : "bg-white/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                  appearance.particleEffects ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                            <div className="space-y-0.5 pr-4">
                              <p className="text-sm font-semibold text-white">Reduced Motion Mode</p>
                              <p className="text-xs text-gray-400 font-mono">Disable non-essential animations and transitions for performance and accessibility</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playUiAudio('toggle', appearance.soundFeedback);
                                const next = { ...appearance, reducedMotion: !appearance.reducedMotion };
                                setAppearance(next);
                                applyAppearanceToDom(next);
                              }}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                appearance.reducedMotion ? "bg-copper-500" : "bg-white/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                  appearance.reducedMotion ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 6. NOTIFICATIONS TAB */}
                {/* ========================================================= */}
                {activeTab === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-1">
                        <Bell className="w-5 h-5 text-copper-400" />
                        <span>Notification Preferences</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6 font-sans">
                        Configure what alerts, audio chimes, and system updates you want to receive in your workstation.
                      </p>

                      <div className="space-y-4">
                        {[
                          {
                            key: 'executionAlerts' as const,
                            title: 'Prompt Execution Alerts',
                            desc: 'Notify when lengthy LLM evaluations or branching trees finish processing.',
                          },
                          {
                            key: 'tokenWarnings' as const,
                            title: 'Token Usage & Budget Warnings',
                            desc: 'Show an alert when approaching session token thresholds.',
                          },
                          {
                            key: 'latencyAlerts' as const,
                            title: 'High Latency Warnings',
                            desc: 'Alert when model response time exceeds 2,500ms.',
                          },
                          {
                            key: 'modelUpdates' as const,
                            title: 'Model Catalog & Bedrock Releases',
                            desc: 'Receive alerts when new open-source models become available.',
                          },
                          {
                            key: 'soundAlerts' as const,
                            title: 'Completion Sound Chimes',
                            desc: 'Play a subtle audio chime when background synthesis finishes.',
                          },
                          {
                            key: 'desktopNotifications' as const,
                            title: 'Operating System Desktop Notifications',
                            desc: 'Dispatch native OS banners when Bedrock is minimized or in the background.',
                          },
                        ].map((item) => (
                          <div
                            key={item.key}
                            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                          >
                            <div className="space-y-0.5 pr-4">
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <p className="text-xs text-gray-400 font-mono">{item.desc}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playUiAudio('toggle', appearance.soundFeedback);
                                setNotifications((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                              }}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                notifications[item.key] ? "bg-copper-500" : "bg-white/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                  notifications[item.key] ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 7. PRIVACY & SECURITY TAB */}
                {/* ========================================================= */}
                {activeTab === 'privacy' && (
                  <motion.div
                    key="privacy"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-1">
                        <Shield className="w-5 h-5 text-copper-400" />
                        <span>Privacy, Vault & Security Controls</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6 font-sans">
                        Control prompt caching, secret scrubbing, local vault storage, and workspace archive backups.
                      </p>

                      <div className="space-y-4">
                        {[
                          {
                            key: 'localVaultOnly' as const,
                            title: 'Local-First Vault Mode',
                            desc: 'Keep all prompts, DAG trees, and variables strictly on this device without cloud sync.',
                          },
                          {
                            key: 'secretScrubbing' as const,
                            title: 'Automated Secret Scrubbing',
                            desc: 'Auto-detect and redact API keys, private passwords, and bearer tokens before LLM dispatch.',
                          },
                          {
                            key: 'saveHistory' as const,
                            title: 'Prompt History Local Caching',
                            desc: 'Preserve generated templates and iterations in your local offline library.',
                          },
                          {
                            key: 'telemetry' as const,
                            title: 'Anonymous Performance Diagnostics',
                            desc: 'Share non-identifying latency and error telemetry to help optimize model routing.',
                          },
                        ].map((item) => (
                          <div
                            key={item.key}
                            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                          >
                            <div className="space-y-0.5 pr-4">
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <p className="text-xs text-gray-400 font-mono">{item.desc}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                playUiAudio('toggle', appearance.soundFeedback);
                                setPrivacy((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                              }}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                                privacy[item.key] ? "bg-copper-500" : "bg-white/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                  privacy[item.key] ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="h-px bg-white/10 my-8" />

                      {/* Workspace Backup & Archive */}
                      <div>
                        <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-copper-400" />
                          <span>Workspace Archive & Data Portability</span>
                        </h3>
                        <p className="text-xs text-gray-400 font-mono mb-4">
                          Export your complete workstation configuration, prompt templates, and DAG trees to JSON or restore a backup.
                        </p>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleExportWorkspace}
                            className="px-4 py-2.5 bg-copper-500 hover:bg-copper-600 text-white rounded-xl text-xs font-mono font-semibold transition-all shadow-md shadow-copper-500/20 flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export Full Workspace JSON</span>
                          </button>

                          <input
                            type="file"
                            ref={importFileRef}
                            onChange={handleImportWorkspace}
                            accept=".json"
                            className="hidden"
                          />

                          <button
                            type="button"
                            onClick={() => importFileRef.current?.click()}
                            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Import Workspace Backup</span>
                          </button>
                        </div>
                        {importedStatus && (
                          <p className="text-xs text-emerald-400 mt-2 font-mono flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            <span>{importedStatus}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ========================================================= */}
                {/* 8. DESKTOP APP UPDATES TAB */}
                {/* ========================================================= */}
                {activeTab === 'updates' && isDesktop && (
                  <motion.div
                    key="updates"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-1">
                        <ArrowUpCircle className="w-5 h-5 text-copper-400" />
                        <span>Bedrock Desktop App Updates</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6 font-sans">
                        Check for official desktop application binary updates and view release versions.
                      </p>

                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-copper-500/10 border border-copper-500/20 flex items-center justify-center">
                              <AppleLogo className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">Bedrock Desktop v1.2.5</p>
                              <p className="text-xs text-gray-400 font-mono mt-0.5">Tauri & Electron Universal Workstation</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleManualUpdateCheck}
                            disabled={isCheckingUpdate}
                            className="px-4 py-2 bg-copper-500 hover:bg-copper-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-copper-500/20"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", isCheckingUpdate && "animate-spin")} />
                            <span>{isCheckingUpdate ? 'Checking...' : 'Check Now'}</span>
                          </button>
                        </div>

                        {updateStatus.status === 'available' && (
                          <div className="p-4 rounded-xl bg-copper-500/10 border border-copper-500/30 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-white">New Version Available: v{updateStatus.version || ''}</p>
                              <p className="text-[11px] text-gray-300 font-mono mt-0.5">Ready to download and install.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => applyUpdate()}
                              className="px-4 py-1.5 bg-copper-500 hover:bg-copper-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Restart & Update
                            </button>
                          </div>
                        )}

                        {updateStatus.status === 'up-to-date' && (
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5 text-xs text-gray-300">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>You are on the latest version of Bedrock. No updates available.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dedicated Docked Footer Bar */}
            <div className="border-t border-white/10 bg-[#0d0f13]/95 backdrop-blur-xl px-6 py-4 md:px-10 flex items-center justify-between shrink-0 z-20 rounded-b-3xl">
              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                <span className="hidden sm:inline">Preferences automatically persisted locally to your machine</span>
                <span className="sm:hidden">Local vault storage</span>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || saved}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-black shadow-md transition-all duration-300 active:scale-[0.98] cursor-pointer",
                  saved
                    ? "bg-emerald-400 shadow-emerald-400/20 text-black font-bold"
                    : "bg-white hover:bg-gray-200",
                  isSaving && "opacity-80"
                )}
              >
                {isSaving && (
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
                )}
                {saved ? (
                  <>
                    <Check className="w-4 h-4 text-black" />
                    <span>Saved!</span>
                  </>
                ) : isSaving ? (
                  'Saving...'
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </main>
        </div>
      </div>
    </PageTransition>
  );
}
