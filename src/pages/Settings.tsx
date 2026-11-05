import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { useUserProfile } from '../lib/useUserProfile';
import { processAvatarImage } from '../lib/imageUtils';
import {
  Key,
  User,
  Bell,
  Shield,
  Eye,
  EyeOff,
  Cpu,
  ExternalLink,
  Check,
  ChevronDown,
  ArrowUpCircle,
  RefreshCw,
  Sliders,
  Palette,
  Gauge,
  Download,
  Upload,
  Globe,
  FileCode,
  HardDrive,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { AgentIcon, PerplexityLogo } from '../components/ui/ModelLogos';
import { subscribeToUpdates, checkForUpdates, applyUpdate, CURRENT_APP_VERSION } from '../lib/updater';
import type { UpdateStatus } from '../lib/updater';
import { isDesktopApp } from '../lib/platform';
import { getModelGroups, type ModelGroup } from '../lib/modelCatalog';
import { fetchAnthropicModels, ANTHROPIC_MODELS_EVENT } from '../lib/anthropicModels';
import { syncAllConfiguredModels, DYNAMIC_MODELS_UPDATED_EVENT } from '../lib/dynamicModelDiscovery';
import { checkProviderKey, type KeyCheckResult } from '../lib/keyCheck';
import { showToast, osNotificationsSupported, requestOsNotificationPermission } from '../lib/notify';
import { applyAnalyticsConsent } from '../lib/analyticsConsent';
import { isBackupKey } from '../lib/backupPolicy';
import { ChoiceButton, SettingCard, SettingRow, Switch, TabHeading } from '../components/settings/controls';
import {
  STORAGE_KEY_API_KEYS,
  STORAGE_KEY_NOTIFICATIONS,
  STORAGE_KEY_PRIVACY,
  STORAGE_KEY_MODEL_SETTINGS,
  STORAGE_KEY_TOKEN_SETTINGS,
  STORAGE_KEY_APPEARANCE,
  BEDROCK_SETTINGS_UPDATED_EVENT,
  BEDROCK_APPEARANCE_UPDATED_EVENT,
  BEDROCK_TOKENS_UPDATED_EVENT,
  DEFAULT_MODEL_SETTINGS,
  DEFAULT_TOKEN_SETTINGS,
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PRIVACY,
  getActiveModelSettings,
  getActiveTokenSettings,
  getActiveAppearanceSettings,
  getActiveNotificationSettings,
  getActivePrivacySettings,
  getSessionTokensCount,
  resetTokenCounters,
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

type Tab = 'account' | 'models' | 'api-keys' | 'tokens' | 'appearance' | 'notifications' | 'privacy' | 'updates';

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

// Workspace backup: keys that identify the signed-in user, hold credentials or record consent are never
// written to the backup file and never restored from one (same rule on web and desktop): see isBackupKey
const BACKUP_IMPORT_MAX_VALUE_CHARS = 2_000_000;

function getStoredApiKeys(): ApiKeysState {
  try {
    const data = localStorage.getItem(STORAGE_KEY_API_KEYS);
    if (!data) return DEFAULT_API_KEYS;
    return { ...DEFAULT_API_KEYS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_API_KEYS;
  }
}

const THEMES = [
  { id: 'obsidian' as const, name: 'Obsidian', desc: 'Pure black. The default.', swatch: '#000000' },
  { id: 'slate' as const, name: 'Midnight', desc: 'Deep navy with a cool tint.', swatch: '#070a12' },
  { id: 'amber' as const, name: 'Ember', desc: 'Warm charcoal.', swatch: '#0c0906' },
  { id: 'emerald' as const, name: 'Forest', desc: 'Dark green-black.', swatch: '#040d08' },
  { id: 'violet' as const, name: 'Nebula', desc: 'Deep purple-black.', swatch: '#0b0714' },
];

const ACCENTS = [
  { id: 'copper' as const, name: 'Teal (default)', color: '#2C9A8B' },
  { id: 'cyan' as const, name: 'Cyan', color: '#06b6d4' },
  { id: 'emerald' as const, name: 'Green', color: '#10b981' },
  { id: 'violet' as const, name: 'Violet', color: '#8b5cf6' },
  { id: 'rose' as const, name: 'Rose', color: '#f43f5e' },
  { id: 'amber' as const, name: 'Amber', color: '#f59e0b' },
];

const KEY_PROVIDERS = [
  { id: 'perplexity', name: 'Perplexity', keyProp: 'perplexityKey' as const, placeholder: 'pplx-...', desc: 'Sonar models with live web search.', link: 'https://www.perplexity.ai/settings/api', linkLabel: 'Get a key', customIcon: <PerplexityLogo className="w-4 h-4" />, isHost: false },
  { id: 'gemini', name: 'Google Gemini', keyProp: 'geminiKey' as const, placeholder: 'AIzaSy...', desc: 'Generous free tier and a very large context window.', link: 'https://aistudio.google.com/app/apikey', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'groq', name: 'Groq', keyProp: 'groqKey' as const, placeholder: 'gsk_...', desc: 'Very fast Llama models.', link: 'https://console.groq.com/keys', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'openai', name: 'OpenAI', keyProp: 'openAiKey' as const, placeholder: 'sk-...', desc: 'GPT-4o and the o-series models.', link: 'https://platform.openai.com/api-keys', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'anthropic', name: 'Anthropic', keyProp: 'anthropicKey' as const, placeholder: 'sk-ant-...', desc: 'Claude models.', link: 'https://console.anthropic.com/settings/keys', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'xai', name: 'xAI', keyProp: 'xaiKey' as const, placeholder: 'xai-...', desc: 'Grok models.', link: 'https://console.x.ai', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'deepseek', name: 'DeepSeek', keyProp: 'deepSeekKey' as const, placeholder: 'sk-...', desc: 'DeepSeek R1 and V3.', link: 'https://platform.deepseek.com/api_keys', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'mistral', name: 'Mistral', keyProp: 'mistralKey' as const, placeholder: '...', desc: 'Mistral Large, Codestral and Mixtral.', link: 'https://console.mistral.ai/api-keys', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'cohere', name: 'Cohere', keyProp: 'cohereKey' as const, placeholder: '...', desc: 'Command R+.', link: 'https://dashboard.cohere.com/api-keys', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'openrouter', name: 'OpenRouter', keyProp: 'openRouterKey' as const, placeholder: 'sk-or-...', desc: 'One key for hundreds of models.', link: 'https://openrouter.ai/keys', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'huggingface', name: 'Hugging Face', keyProp: 'huggingFaceKey' as const, placeholder: 'hf_...', desc: 'Free hosted open models.', link: 'https://huggingface.co/settings/tokens', linkLabel: 'Get a token', customIcon: undefined, isHost: false },
  { id: 'nvidia', name: 'Nvidia NIM', keyProp: 'nvidiaKey' as const, placeholder: 'nvapi-...', desc: 'Nemotron models.', link: 'https://build.nvidia.com', linkLabel: 'Get a key', customIcon: undefined, isHost: false },
  { id: 'ollama', name: 'Ollama (local)', keyProp: 'ollamaHost' as const, placeholder: 'http://localhost:11434', desc: 'Run models on your own machine.', link: 'https://ollama.com', linkLabel: 'About Ollama', customIcon: undefined, isHost: true },
];

const SESSION_BUDGETS = [10, 25, 50, 100, 250, 500];

const inputClass =
  'w-full rounded-xl border border-white/10 bg-sf-0a0b0e px-4 py-3 text-sm text-white outline-none transition-all focus:border-copper-500 focus:ring-1 focus:ring-copper-500 disabled:opacity-60';
const labelClass = 'text-xs font-medium uppercase tracking-wider text-gray-300';

export default function Settings() {
  const { profile, updateProfile } = useUserProfile();
  const isDesktop = isDesktopApp();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  // Small "Saved" confirmation next to the footer text
  const [showSaved, setShowSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashSaved = useCallback(() => {
    setShowSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setShowSaved(false), 1800);
  }, []);
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  // ---- Profile (has its own Save button, because half-typed text should never be stored)
  const [name, setName] = useState(profile.name || '');
  const [role, setRole] = useState(profile.role || '');
  const [organization, setOrganization] = useState(profile.organization || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [github, setGithub] = useState(profile.github || '');
  const [huggingface, setHuggingface] = useState(profile.huggingface || '');
  const [twitter, setTwitter] = useState(profile.twitter || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [profileState, setProfileState] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ status: 'idle' });
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteState, setDeleteState] = useState<{
    status: 'idle' | 'deleting' | 'error' | 'success';
    message?: string;
  }>({ status: 'idle' });

  const handleDeleteAccount = async () => {
    if (deleteConfirmInput !== 'DELETE') return;
    setDeleteState({ status: 'deleting' });

    try {
      let token = '';
      const clerk = (window as any).Clerk;
      if (clerk?.session) {
        token = (await clerk.session.getToken()) || '';
      }

      const res = await fetch('/api/user/profile?action=delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDeleteState({
          status: 'error',
          message: data.message || data.error || 'Failed to delete account. Please try again.',
        });
        return;
      }

      setDeleteState({
        status: 'success',
        message: data.message || 'Your account and all associated data have been permanently deleted.',
      });

      setTimeout(async () => {
        try {
          if (clerk) {
            await clerk.signOut();
          }
        } catch {}
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}
        logout();
        navigate('/');
      }, 2000);
    } catch (err: any) {
      setDeleteState({
        status: 'error',
        message: err.message || 'Network error occurred during account deletion.',
      });
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile.name || '');
    setRole(profile.role || '');
    setOrganization(profile.organization || '');
    setBio(profile.bio || '');
    setLocation(profile.location || '');
    setGithub(profile.github || '');
    setHuggingface(profile.huggingface || '');
    setTwitter(profile.twitter || '');
    setWebsite(profile.website || '');
  }, [profile]);

  const profileDirty =
    name !== (profile.name || '') ||
    role !== (profile.role || '') ||
    organization !== (profile.organization || '') ||
    bio !== (profile.bio || '') ||
    location !== (profile.location || '') ||
    github !== (profile.github || '') ||
    huggingface !== (profile.huggingface || '') ||
    twitter !== (profile.twitter || '') ||
    website !== (profile.website || '');

  const handleSaveProfile = async () => {
    setProfileState({ status: 'saving' });
    const result = await updateProfile({ name, role, organization, bio, location, github, huggingface, twitter, website });
    if (!result.ok) {
      setProfileState({ status: 'error', message: result.message });
      return;
    }
    setProfileState({ status: 'saved' });
    setTimeout(() => setProfileState({ status: 'idle' }), 2200);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingAvatar(true);
      setAvatarError(null);
      const dataUrl = await processAvatarImage(file);
      await updateProfile({ avatarUrl: dataUrl });
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to process avatar');
      setTimeout(() => setAvatarError(null), 4000);
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  // ---- Settings that save the moment you change them
  const [modelSettings, setModelSettings] = useState<ModelInferenceSettings>(getActiveModelSettings);
  const [tokenSettings, setTokenSettings] = useState<TokenSettings>(getActiveTokenSettings);
  const [appearance, setAppearance] = useState<AppearanceSettings>(getActiveAppearanceSettings);
  const [notifications, setNotifications] = useState<NotificationSettings>(getActiveNotificationSettings);
  const [privacy, setPrivacy] = useState<PrivacySettings>(getActivePrivacySettings);

  const persist = useCallback(
    (storageKey: string, value: unknown, extraEvent?: string) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
        window.dispatchEvent(new Event(BEDROCK_SETTINGS_UPDATED_EVENT));
        if (extraEvent) window.dispatchEvent(new Event(extraEvent));
        flashSaved();
      } catch {
        showToast("Couldn't save this setting. Browser storage may be full or blocked.", 'error');
      }
    },
    [flashSaved]
  );

  const updateModel = (patch: Partial<ModelInferenceSettings>) => {
    const next = { ...modelSettings, ...patch };
    setModelSettings(next);
    persist(STORAGE_KEY_MODEL_SETTINGS, next);
  };
  const updateTokens = (patch: Partial<TokenSettings>) => {
    const next = { ...tokenSettings, ...patch };
    setTokenSettings(next);
    persist(STORAGE_KEY_TOKEN_SETTINGS, next);
  };
  const updateAppearance = (patch: Partial<AppearanceSettings>) => {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    applyAppearanceToDom(next);
    persist(STORAGE_KEY_APPEARANCE, next, BEDROCK_APPEARANCE_UPDATED_EVENT);
  };
  const updateNotifications = (patch: Partial<NotificationSettings>) => {
    const next = { ...notifications, ...patch };
    setNotifications(next);
    persist(STORAGE_KEY_NOTIFICATIONS, next);
  };
  const updatePrivacy = (patch: Partial<PrivacySettings>) => {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    persist(STORAGE_KEY_PRIVACY, next);
    if ('telemetry' in patch) applyAnalyticsConsent();
  };

  const handleDesktopNotificationsToggle = async (next: boolean) => {
    if (!next) {
      updateNotifications({ desktopNotifications: false });
      return;
    }
    const permission = await requestOsNotificationPermission();
    if (permission === 'granted') {
      updateNotifications({ desktopNotifications: true });
    } else {
      showToast('Your browser blocked notifications. Allow them for this site in the browser settings, then try again.', 'warning');
    }
  };

  const [resetArmed, setResetArmed] = useState(false);
  const handleResetDefaults = () => {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 4000);
      return;
    }
    setResetArmed(false);
    setModelSettings(DEFAULT_MODEL_SETTINGS);
    setTokenSettings(DEFAULT_TOKEN_SETTINGS);
    setAppearance(DEFAULT_APPEARANCE_SETTINGS);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setPrivacy(DEFAULT_PRIVACY);
    applyAppearanceToDom(DEFAULT_APPEARANCE_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY_MODEL_SETTINGS, JSON.stringify(DEFAULT_MODEL_SETTINGS));
      localStorage.setItem(STORAGE_KEY_TOKEN_SETTINGS, JSON.stringify(DEFAULT_TOKEN_SETTINGS));
      localStorage.setItem(STORAGE_KEY_APPEARANCE, JSON.stringify(DEFAULT_APPEARANCE_SETTINGS));
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(DEFAULT_NOTIFICATIONS));
      localStorage.setItem(STORAGE_KEY_PRIVACY, JSON.stringify(DEFAULT_PRIVACY));
      window.dispatchEvent(new Event(BEDROCK_SETTINGS_UPDATED_EVENT));
      window.dispatchEvent(new Event(BEDROCK_APPEARANCE_UPDATED_EVENT));
    } catch {
      showToast("Couldn't reset the settings. Browser storage may be blocked.", 'error');
      return;
    }
    applyAnalyticsConsent();
    flashSaved();
    showToast('Settings are back to their defaults. Your profile and API keys were not touched.', 'success');
  };

  // ---- API keys (own Save button)
  const [apiKeys, setApiKeys] = useState<ApiKeysState>(getStoredApiKeys);
  const [savedApiKeys, setSavedApiKeys] = useState<ApiKeysState>(getStoredApiKeys);
  const [modelGroups, setModelGroups] = useState<ModelGroup[]>(getModelGroups);

  useEffect(() => {
    const onModelsUpdate = () => {
      setModelGroups(getModelGroups());
    };
    window.addEventListener(ANTHROPIC_MODELS_EVENT, onModelsUpdate);
    window.addEventListener(DYNAMIC_MODELS_UPDATED_EVENT, onModelsUpdate);
    return () => {
      window.removeEventListener(ANTHROPIC_MODELS_EVENT, onModelsUpdate);
      window.removeEventListener(DYNAMIC_MODELS_UPDATED_EVENT, onModelsUpdate);
    };
  }, []);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [keyChecks, setKeyChecks] = useState<Record<string, KeyCheckResult | 'checking' | undefined>>({});
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const keysDirty = JSON.stringify(apiKeys) !== JSON.stringify(savedApiKeys);

  useEffect(() => {
    if (!modelDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) setModelDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [modelDropdownOpen]);

  const handleSaveKeys = () => {
    try {
      localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(apiKeys));
      setSavedApiKeys(apiKeys);
      window.dispatchEvent(new Event('bedrock_api_keys_updated'));
      if (isDesktop) {
        syncAllConfiguredModels();
      } else if (apiKeys.anthropicKey && apiKeys.anthropicKey.trim()) {
        fetchAnthropicModels(apiKeys.anthropicKey.trim()).catch(() => {});
      }
      window.dispatchEvent(new Event(BEDROCK_SETTINGS_UPDATED_EVENT));
      showToast('API keys saved.', 'success');
    } catch {
      showToast("Couldn't save your API keys. Browser storage may be full or blocked.", 'error');
    }
  };

  const handleTestKey = async (providerId: string, value: string) => {
    setKeyChecks((prev) => ({ ...prev, [providerId]: 'checking' }));
    const result = await checkProviderKey(providerId, value);
    setKeyChecks((prev) => ({ ...prev, [providerId]: result }));
  };

  // ---- Token usage (live)
  const [sessionTokens, setSessionTokens] = useState(getSessionTokensCount);
  useEffect(() => {
    const update = () => setSessionTokens(getSessionTokensCount());
    window.addEventListener(BEDROCK_TOKENS_UPDATED_EVENT, update);
    return () => window.removeEventListener(BEDROCK_TOKENS_UPDATED_EVENT, update);
  }, []);
  const sessionBudget = tokenSettings.sessionLimit * 1000;
  const sessionPercent = Math.min(100, Math.round((sessionTokens / sessionBudget) * 100));

  // ---- Workspace backup
  const [importedStatus, setImportedStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const handleExportWorkspace = () => {
    try {
      const data: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && isBackupKey(key)) {
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
    } catch {
      showToast("Couldn't create the backup file.", 'error');
    }
  };

  const handleImportWorkspace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('Invalid backup');
        for (const [k, v] of Object.entries(content)) {
          // Restore Bedrock settings only. Login tokens and API keys are never taken from a file:
          // a crafted backup could otherwise sign the user into another account or swap in
          // someone else's API key (which would send the user's prompts to that account).
          if (!isBackupKey(k)) continue;
          const value = typeof v === 'string' ? v : JSON.stringify(v);
          if (value.length > BACKUP_IMPORT_MAX_VALUE_CHARS) continue;
          localStorage.setItem(k, value);
        }
        setImportedStatus({ ok: true, text: 'Backup restored. Reloading...' });
        setTimeout(() => window.location.reload(), 1200);
      } catch {
        setImportedStatus({ ok: false, text: "That file isn't a valid Bedrock backup." });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---- Desktop updates
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  useEffect(() => {
    const unsub = subscribeToUpdates((status) => {
      setUpdateStatus(status);
      if (status.status !== 'checking') setIsCheckingUpdate(false);
    });
    return unsub;
  }, []);
  const handleManualUpdateCheck = async () => {
    setIsCheckingUpdate(true);
    await checkForUpdates();
    setTimeout(() => setIsCheckingUpdate(false), 2000);
  };

  const keysAreEncrypted = isDesktop && Boolean((window as any).electronSecrets?.isAvailable);
  const notificationsSupported = osNotificationsSupported();

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'models', label: 'Models', icon: Sliders },
    { id: 'api-keys', label: 'API keys', icon: Key },
    { id: 'tokens', label: 'Tokens & budget', icon: Gauge },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & data', icon: Shield },
    ...(isDesktop ? [{ id: 'updates' as Tab, label: 'App updates', icon: ArrowUpCircle }] : []),
  ];

  const tabMotion = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.2 },
  };

  const allModels = modelGroups.flatMap((g) => g.models);
  const currentModel =
    allModels.find((m) => m.id === modelSettings.defaultModel) || {
      id: modelSettings.defaultModel,
      name: modelSettings.defaultModel,
      tag: undefined,
      tagColor: '',
    };

  return (
    <PageTransition>
      <div className="flex min-h-[calc(100vh-80px)] w-full flex-col px-4 py-6 pb-16 sm:px-8 lg:py-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400">
            <Link to="/app" className="transition-colors hover:text-white">Workspace</Link>
            <span>/</span>
            <span className="font-semibold text-white">Settings</span>
          </div>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="font-editorial text-3xl font-bold text-white md:text-4xl">Settings</h1>
              <p className="mt-1 text-sm text-gray-400">Your profile, models, API keys, look and privacy. Changes save as you make them.</p>
            </div>
            <button
              type="button"
              onClick={handleResetDefaults}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs transition-all',
                resetArmed
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                  : 'border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.08] hover:text-white'
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{resetArmed ? 'Click again to reset' : 'Reset to defaults'}</span>
            </button>
          </div>
        </div>

        <div className="flex w-full flex-1 flex-col items-start gap-6 md:flex-row lg:gap-8">
          <aside className="w-full shrink-0 md:w-64 lg:w-72">
            <nav className="sticky top-28 flex flex-col gap-1 rounded-3xl border border-white/10 bg-sf-0e1014/70 p-2.5 shadow-xl backdrop-blur-2xl" aria-label="Settings sections">
              <div className="flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span>Preferences</span>
                <span className="rounded-full border border-copper-500/20 bg-copper-500/10 px-2 py-0.5 text-[9px] text-copper-400">v{CURRENT_APP_VERSION}</span>
              </div>

              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition-colors duration-200',
                      isActive ? 'text-white' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="settings-tab-pill"
                        className="absolute inset-0 rounded-2xl border border-white/15 bg-white/[0.12] shadow-md"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <span
                      className={cn(
                        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isActive ? 'bg-copper-500 text-white shadow-sm shadow-copper-500/30' : 'bg-white/[0.04] text-gray-400 group-hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="relative truncate">{tab.label}</span>
                  </button>
                );
              })}

              <div className="mx-2 my-2 h-px bg-white/10" />

              <Link
                to="/app/profile"
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs uppercase tracking-wider text-gray-400 transition-all hover:bg-white/5 hover:text-copper-300"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5 text-copper-400" />
                  <span>Public profile</span>
                </div>
                <span className="text-[10px] text-gray-400">&rarr;</span>
              </Link>
            </nav>
          </aside>

          <main className="flex min-h-[580px] w-full flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-sf-121417/85 shadow-2xl backdrop-blur-2xl">
            <div
              className="custom-scrollbar max-h-[calc(100vh-250px)] min-h-[460px] flex-1 space-y-8 overflow-y-auto p-6 md:p-10"
              data-lenis-prevent="true"
            >
              <AnimatePresence mode="wait">
                {/* ============================ ACCOUNT ============================ */}
                {activeTab === 'account' && (
                  <motion.div key="account" {...tabMotion} className="space-y-8">
                    <div>
                      <div className="flex items-start justify-between">
                        <TabHeading
                          icon={<User className="h-5 w-5" />}
                          title="Account"
                          description="How you appear to others and to Bedrock."
                        />
                        <Link to="/app/profile" className="text-xs uppercase tracking-wider text-copper-400 transition-colors hover:text-copper-300">
                          View public profile &rarr;
                        </Link>
                      </div>

                      <div className="mb-8 flex items-center gap-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                        <input type="file" ref={fileInputRef} onChange={handleAvatarFileChange} accept="image/*" className="hidden" />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          aria-label="Choose a new profile picture"
                          className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-tr from-copper-500 to-copper-300 text-2xl font-bold text-white shadow-md ring-2 ring-transparent transition-all hover:ring-copper-400/50"
                        >
                          {profile.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            profile.avatarInitials
                          )}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-[10px] uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Edit
                          </span>
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingAvatar}
                              className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                            >
                              {isUploadingAvatar ? 'Processing...' : profile.avatarUrl ? 'Change picture' : 'Upload picture'}
                            </button>
                            {profile.avatarUrl && (
                              <button
                                type="button"
                                onClick={() => updateProfile({ avatarUrl: '' })}
                                className="cursor-pointer rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-rose-400 transition-colors hover:bg-rose-500/20"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-gray-500">JPG, PNG, WEBP or GIF. Resized on your device.</p>
                          {avatarError && <p className="mt-1 text-xs text-red-400">{avatarError}</p>}
                        </div>
                      </div>

                      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <label htmlFor="set-name" className={labelClass}>Full name</label>
                          <input id="set-name" type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="set-email" className={labelClass}>Email</label>
                          <input id="set-email" type="email" value={profile.email || ''} readOnly disabled className={cn(inputClass, 'font-mono')} />
                          <p className="text-xs text-gray-500">Managed by your sign-in provider.</p>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="set-role" className={labelClass}>Role</label>
                          <input id="set-role" type="text" maxLength={100} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Product engineer" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="set-org" className={labelClass}>Organization</label>
                          <input id="set-org" type="text" maxLength={100} value={organization} onChange={(e) => setOrganization(e.target.value)} className={inputClass} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label htmlFor="set-location" className={labelClass}>Location</label>
                          <input id="set-location" type="text" maxLength={100} value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="set-bio" className={labelClass}>Bio</label>
                          <span className="text-[11px] text-gray-500">{bio.length}/300</span>
                        </div>
                        <textarea
                          id="set-bio"
                          rows={3}
                          maxLength={300}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="A line or two about what you build."
                          className={cn(inputClass, 'resize-none')}
                        />
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div>
                      <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
                        <Globe className="h-4 w-4 text-copper-400" />
                        <span>Links</span>
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {[
                          { id: 'github', label: 'GitHub username', value: github, set: setGithub, placeholder: 'username', type: 'text' },
                          { id: 'hf', label: 'Hugging Face username', value: huggingface, set: setHuggingface, placeholder: 'username', type: 'text' },
                          { id: 'twitter', label: 'X / Twitter', value: twitter, set: setTwitter, placeholder: '@handle', type: 'text' },
                          { id: 'website', label: 'Website', value: website, set: setWebsite, placeholder: 'https://...', type: 'url' },
                        ].map((field) => (
                          <div key={field.id} className="space-y-1.5">
                            <label htmlFor={`set-${field.id}`} className="text-xs text-gray-400">{field.label}</label>
                            <input
                              id={`set-${field.id}`}
                              type={field.type}
                              maxLength={300}
                              placeholder={field.placeholder}
                              value={field.value}
                              onChange={(e) => field.set(e.target.value)}
                              className={cn(inputClass, 'py-2.5 font-mono')}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={!profileDirty || profileState.status === 'saving'}
                        className="cursor-pointer rounded-xl bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-black transition-all hover:bg-gray-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {profileState.status === 'saving' ? 'Saving...' : 'Save profile'}
                      </button>
                      <AnimatePresence mode="wait">
                        {profileState.status === 'saved' && (
                          <motion.span key="ok" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> Profile saved
                          </motion.span>
                        )}
                        {profileState.status === 'error' && (
                          <motion.span key="err" role="alert" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-xs text-rose-400">
                            {profileState.message}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="h-px bg-white/10" />

                    {isDesktop ? (
                      <SettingCard title="Desktop edition" description="You use your own API keys, so Bedrock sets no usage limits.">
                        <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Bring your own keys</span>
                      </SettingCard>
                    ) : (
                      <SettingCard title="Plan" description="Your current plan.">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <p className="font-semibold text-white">{profile.plan || 'Free'}</p>
                          <Link
                            to="/app/pricing"
                            className="rounded-xl bg-copper-500 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-copper-500/20 transition-all hover:bg-copper-600"
                          >
                            See plans
                          </Link>
                        </div>
                      </SettingCard>
                    )}

                    <div className="h-px bg-white/10" />

                    {/* Danger Zone: Account Deletion */}
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="flex items-center gap-2 text-sm font-bold text-rose-400">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Danger Zone</span>
                          </h3>
                          <p className="mt-1 text-xs text-gray-400">
                            Permanently delete your account, saved prompts, workflows, and usage history. This action cannot be undone.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirmInput('');
                            setDeleteState({ status: 'idle' });
                            setShowDeleteModal(true);
                          }}
                          className="cursor-pointer shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-rose-400 transition-colors hover:bg-rose-500/20 active:scale-[0.98]"
                        >
                          Delete account
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ============================ MODELS ============================ */}
                {activeTab === 'models' && (
                  <motion.div key="models" {...tabMotion} className="space-y-6">
                    <TabHeading
                      icon={<Sliders className="h-5 w-5" />}
                      title="Models"
                      description="Choose your default model and how it writes."
                    />

                    <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-copper-400" />
                      <span>
                        These apply to the Prompt Tester, Branching workflows, and any run that uses your own API key. Bedrock's built-in cloud generator uses its own tuned settings.
                      </span>
                    </div>

                    <div className="relative space-y-2.5 rounded-2xl border border-white/10 bg-sf-0a0b0e p-4" ref={modelDropdownRef}>
                      <div className="flex items-center justify-between">
                        <span className={cn(labelClass, 'flex items-center gap-2 text-white')}>
                          <Cpu className="h-3.5 w-3.5 text-copper-400" /> Default model
                        </span>
                        <span className="text-[11px] text-gray-400">Used when a screen doesn't pick one</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModelDropdownOpen((open) => !open)}
                        aria-haspopup="listbox"
                        aria-expanded={modelDropdownOpen}
                        className={cn(
                          'group flex w-full cursor-pointer items-center justify-between rounded-xl border bg-sf-13161c px-4 py-3 text-sm text-white transition-all hover:bg-sf-181b22',
                          modelDropdownOpen ? 'border-copper-500/60 ring-2 ring-copper-500/20' : 'border-white/10 hover:border-white/20'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <AgentIcon model={currentModel.id} className="h-5 w-5 shrink-0" badgeClassName="w-5 h-5" />
                          <span className="truncate font-semibold">{currentModel.name}</span>
                          {currentModel.tag && (
                            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px]', currentModel.tagColor)}>{currentModel.tag}</span>
                          )}
                        </div>
                        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-hover:text-white', modelDropdownOpen && 'rotate-180 text-copper-400')} />
                      </button>

                      <AnimatePresence>
                        {modelDropdownOpen && (
                          <motion.div
                            role="listbox"
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="custom-scrollbar absolute left-0 right-0 top-full z-50 mt-2 max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-white/15 bg-sf-0e1015/95 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
                          >
                            {modelGroups.map((group) => (
                              <div key={group.group} className="space-y-1">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-copper-400" />
                                  <span>{group.group}</span>
                                </div>
                                {group.models.map((model) => {
                                  const isSelected = modelSettings.defaultModel === model.id;
                                  return (
                                    <button
                                      key={model.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      onClick={() => {
                                        updateModel({ defaultModel: model.id });
                                        setModelDropdownOpen(false);
                                      }}
                                      className={cn(
                                        'flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-all',
                                        isSelected ? 'border-copper-500/40 bg-copper-500/15 text-white' : 'border-transparent text-gray-300 hover:bg-white/[0.06] hover:text-white'
                                      )}
                                    >
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        <AgentIcon model={model.id} className="h-4 w-4 shrink-0" badgeClassName="w-4 h-4" />
                                        <span className="truncate">{model.name}</span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-2">
                                        {model.tag && <span className={cn('rounded-full border px-2 py-0.5 text-[9px]', model.tagColor)}>{model.tag}</span>}
                                        {isSelected && <Check className="h-3.5 w-3.5 text-copper-400" />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <SettingCard
                      title="Creativity"
                      description="Low is precise and repeatable. High is more varied and surprising."
                      aside={
                        <span className="rounded-full border border-copper-500/20 bg-copper-500/10 px-2.5 py-1 text-xs font-semibold text-copper-300">
                          {modelSettings.temperature.toFixed(2)} ·{' '}
                          {modelSettings.temperature <= 0.3 ? 'Precise' : modelSettings.temperature <= 0.8 ? 'Balanced' : 'Creative'}
                        </span>
                      }
                    >
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        aria-label="Creativity (temperature)"
                        value={modelSettings.temperature}
                        onChange={(e) => updateModel({ temperature: parseFloat(e.target.value) })}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-copper-500"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { val: 0.2, label: 'Code (0.2)' },
                          { val: 0.7, label: 'Balanced (0.7)' },
                          { val: 1.1, label: 'Brainstorm (1.1)' },
                        ].map((preset) => (
                          <ChoiceButton key={preset.val} active={modelSettings.temperature === preset.val} onClick={() => updateModel({ temperature: preset.val })}>
                            {preset.label}
                          </ChoiceButton>
                        ))}
                      </div>
                    </SettingCard>

                    <SettingCard
                      title="Longest answer"
                      description="The most text the model may write in one reply."
                      aside={<span className="rounded-full border border-copper-500/20 bg-copper-500/10 px-2.5 py-1 text-xs font-semibold text-copper-300">{modelSettings.maxOutputTokens.toLocaleString()} tokens</span>}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {[1024, 2048, 4096, 8192, 16384, 32768].map((count) => (
                          <ChoiceButton key={count} active={modelSettings.maxOutputTokens === count} onClick={() => updateModel({ maxOutputTokens: count })}>
                            {count / 1024}k
                          </ChoiceButton>
                        ))}
                      </div>
                    </SettingCard>

                    <SettingCard title="Typing speed" description="How fast the answer appears on screen while it is written.">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          { id: 'instant' as const, name: 'Instant', desc: 'Text appears as soon as it arrives.' },
                          { id: 'smooth' as const, name: 'Smooth', desc: 'A steady, natural flow.' },
                          { id: 'typewriter' as const, name: 'Typewriter', desc: 'Slower, easier to follow code.' },
                        ].map((opt) => {
                          const active = modelSettings.streamSpeed === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => updateModel({ streamSpeed: opt.id })}
                              className={cn(
                                'cursor-pointer rounded-xl border p-3.5 text-left transition-all active:scale-[0.98]',
                                active ? 'border-copper-500/50 bg-copper-500/15' : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                              )}
                            >
                              <p className="mb-1 text-xs font-bold text-white">{opt.name}</p>
                              <p className="text-[11px] leading-relaxed text-gray-400">{opt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </SettingCard>

                    <SettingCard
                      title="Standing instructions"
                      description="Rules added to every prompt you run in the Prompt Tester and Branching workflows."
                      aside={<FileCode className="h-4 w-4 text-copper-400" />}
                    >
                      <textarea
                        rows={4}
                        maxLength={2000}
                        aria-label="Standing instructions"
                        value={modelSettings.systemPromptDirectives}
                        onChange={(e) => updateModel({ systemPromptDirectives: e.target.value })}
                        placeholder="Example: Use strict TypeScript. Never use the any type. Skip the small talk."
                        className={cn(inputClass, 'resize-y font-mono text-xs')}
                      />
                    </SettingCard>

                    <div className="space-y-3">
                      <SettingRow title="Switch models if one fails" description="If the chosen model is busy or rate-limited, try another one you have a key for.">
                        <Switch checked={modelSettings.autoFallback} onChange={(v) => updateModel({ autoFallback: v })} label="Switch models if one fails" />
                      </SettingRow>
                      <SettingRow title="Always answer in JSON" description="Ask models for structured JSON output where they support it.">
                        <Switch checked={modelSettings.strictJsonMode} onChange={(v) => updateModel({ strictJsonMode: v })} label="Always answer in JSON" />
                      </SettingRow>
                    </div>
                  </motion.div>
                )}

                {/* ============================ API KEYS ============================ */}
                {activeTab === 'api-keys' && (
                  <motion.div key="api-keys" {...tabMotion} className="space-y-6">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <TabHeading
                        icon={<Cpu className="h-5 w-5" />}
                        title="API keys"
                        description="Use your own provider keys. Requests go straight to the provider, never through Bedrock."
                      />
                      <span
                        className={cn(
                          'mb-6 w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
                          keysAreEncrypted ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                        )}
                      >
                        {keysAreEncrypted ? 'Encrypted on this device' : 'Stored in this browser only'}
                      </span>
                    </div>

                    {!keysAreEncrypted && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/90">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>Keys are kept in this browser's storage. Don't enter them on a shared or public computer.</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {KEY_PROVIDERS.map((p) => {
                        const val = apiKeys[p.keyProp] || '';
                        const savedVal = savedApiKeys[p.keyProp] || '';
                        const isSet = Boolean(savedVal.trim());
                        const edited = val !== savedVal;
                        const check = keyChecks[p.id];
                        return (
                          <div key={p.id} className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-white/10">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {p.customIcon || <AgentIcon agent={{ id: p.id }} className="h-4 w-4" badgeClassName="w-4 h-4" />}
                                <label htmlFor={`key-${p.id}`} className="text-xs font-semibold uppercase tracking-wider text-white">{p.name}</label>
                              </div>
                              <span
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider',
                                  edited
                                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                    : isSet
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                    : 'border-white/10 bg-white/5 text-gray-400'
                                )}
                              >
                                {edited ? 'Unsaved' : isSet ? (p.isHost ? 'Configured' : 'Saved') : 'Not set'}
                              </span>
                            </div>

                            <div className="relative flex items-center">
                              <input
                                id={`key-${p.id}`}
                                type={p.isHost || showKey[p.id] ? 'text' : 'password'}
                                autoComplete="off"
                                spellCheck={false}
                                placeholder={p.placeholder}
                                value={val}
                                onChange={(e) => {
                                  setApiKeys((prev) => ({ ...prev, [p.keyProp]: e.target.value }));
                                  setKeyChecks((prev) => ({ ...prev, [p.id]: undefined }));
                                }}
                                className={cn(inputClass, 'pr-28 font-mono')}
                              />
                              <div className="absolute right-2 flex items-center gap-1">
                                {!p.isHost && (
                                  <button
                                    type="button"
                                    onClick={() => setShowKey((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                                    className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                                    aria-label={showKey[p.id] ? `Hide ${p.name} key` : `Show ${p.name} key`}
                                  >
                                    {showKey[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                )}
                                {!p.isHost && (
                                  <button
                                    type="button"
                                    onClick={() => handleTestKey(p.id, val)}
                                    disabled={check === 'checking' || !val.trim()}
                                    className="cursor-pointer rounded-lg bg-white/5 px-2.5 py-1 text-[11px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label={`Check the ${p.name} key`}
                                  >
                                    {check === 'checking' ? 'Checking...' : 'Check'}
                                  </button>
                                )}
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {check && check !== 'checking' && (
                                <motion.p
                                  key={check.status + check.message}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  role="status"
                                  className={cn(
                                    'overflow-hidden text-xs',
                                    check.status === 'valid' && 'text-emerald-400',
                                    check.status === 'invalid' && 'text-rose-400',
                                    (check.status === 'unreachable' || check.status === 'unsupported') && 'text-amber-300'
                                  )}
                                >
                                  {check.message}
                                </motion.p>
                              )}
                            </AnimatePresence>

                            <div className="flex items-center justify-between pt-1">
                              <p className="text-xs text-gray-500">{p.desc}</p>
                              <a href={p.link} target="_blank" rel="noreferrer" className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-copper-400 transition-colors hover:text-copper-300">
                                <span>{p.linkLabel}</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-sf-0d0f13/95 p-3 backdrop-blur-xl">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSaveKeys}
                          disabled={!keysDirty}
                          className="cursor-pointer rounded-xl bg-white px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-black transition-all hover:bg-gray-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Save keys
                        </button>
                        {isDesktop && (
                          <button
                            type="button"
                            onClick={() => {
                              syncAllConfiguredModels();
                              showToast('Discovering dynamic models for all configured keys...', 'info');
                            }}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white transition-all hover:bg-white/10 active:scale-[0.98]"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-copper-400" />
                            <span>Sync Models</span>
                          </button>
                        )}
                        <span className="text-xs text-gray-400">{keysDirty ? 'You have unsaved key changes.' : 'All keys are saved.'}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ============================ TOKENS ============================ */}
                {activeTab === 'tokens' && (
                  <motion.div key="tokens" {...tabMotion} className="space-y-6">
                    <TabHeading
                      icon={<Gauge className="h-5 w-5" />}
                      title="Tokens & budget"
                      description="Keep an eye on how much your own API keys are used."
                    />

                    <SettingCard
                      title="Session budget"
                      description="How many tokens you allow in one 5-hour session. The counter starts over after 5 hours."
                      aside={
                        <span className="rounded-full border border-copper-500/20 bg-copper-500/10 px-2.5 py-1 text-xs font-semibold text-copper-300">
                          {sessionTokens.toLocaleString()} / {sessionBudget.toLocaleString()}
                        </span>
                      }
                    >
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={sessionPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Session token use">
                        <motion.div
                          className={cn('h-full rounded-full', sessionPercent >= tokenSettings.warningThreshold ? 'bg-amber-400' : 'bg-copper-500')}
                          initial={false}
                          animate={{ width: `${sessionPercent}%` }}
                          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {SESSION_BUDGETS.map((limit) => (
                          <ChoiceButton key={limit} active={tokenSettings.sessionLimit === limit} onClick={() => updateTokens({ sessionLimit: limit })}>
                            {limit}k tokens
                          </ChoiceButton>
                        ))}
                      </div>
                    </SettingCard>

                    <SettingCard title="Warn me at" description="Show a message when this much of the session budget is used.">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[70, 80, 90, 95].map((pct) => (
                          <ChoiceButton key={pct} active={tokenSettings.warningThreshold === pct} onClick={() => updateTokens({ warningThreshold: pct })} className="py-3 text-center text-sm">
                            {pct}%
                          </ChoiceButton>
                        ))}
                      </div>
                    </SettingCard>

                    <SettingCard title="Currency" description="Used for cost estimates on the Dashboard.">
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {(['USD', 'EUR', 'GBP', 'JPY', 'INR'] as const).map((curr) => (
                          <ChoiceButton key={curr} active={tokenSettings.currency === curr} onClick={() => updateTokens({ currency: curr })} className="py-2.5 text-center">
                            {curr}
                          </ChoiceButton>
                        ))}
                      </div>
                    </SettingCard>

                    <SettingRow title="Stop when the budget is used up" description="Block new runs with your own keys until the session resets, instead of only warning you.">
                      <Switch checked={tokenSettings.hardStopOnLimit} onChange={(v) => updateTokens({ hardStopOnLimit: v })} label="Stop when the budget is used up" />
                    </SettingRow>

                    <SettingRow title="Reset the counters" description="Start the session and weekly token counters from zero on this device.">
                      <button
                        type="button"
                        onClick={() => {
                          resetTokenCounters();
                          setSessionTokens(0);
                          showToast('Token counters reset.', 'success');
                        }}
                        className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.97]"
                      >
                        Reset
                      </button>
                    </SettingRow>
                  </motion.div>
                )}

                {/* ============================ APPEARANCE ============================ */}
                {activeTab === 'appearance' && (
                  <motion.div key="appearance" {...tabMotion} className="space-y-6">
                    <TabHeading
                      icon={<Palette className="h-5 w-5" />}
                      title="Appearance"
                      description="Pick a theme and accent colour. Changes apply to the whole app right away."
                    />

                    <div>
                      <span className={cn(labelClass, 'mb-3 block')}>Theme</span>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {THEMES.map((theme) => {
                          const active = appearance.themePreset === theme.id;
                          return (
                            <button
                              key={theme.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => updateAppearance({ themePreset: theme.id })}
                              style={{ backgroundColor: theme.swatch }}
                              className={cn(
                                'relative flex min-h-[96px] cursor-pointer flex-col justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.98]',
                                active ? 'border-copper-400/60 shadow-lg shadow-copper-500/10 ring-2 ring-copper-400' : 'border-white/10 hover:border-white/25'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-white">{theme.name}</p>
                                {active && (
                                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                                    <Check className="h-4 w-4 text-copper-400" />
                                  </motion.span>
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-gray-400">{theme.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <SettingCard title="Accent colour" description="Used for buttons, highlights and active items.">
                      <div className="flex flex-wrap items-center gap-3">
                        {ACCENTS.map((c) => {
                          const active = appearance.accentColor === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => updateAppearance({ accentColor: c.id })}
                              className={cn(
                                'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs transition-all active:scale-[0.97]',
                                active ? 'border-white/30 bg-white/10 text-white' : 'border-white/5 bg-white/[0.02] text-gray-400 hover:bg-white/[0.05] hover:text-white'
                              )}
                              style={active ? { boxShadow: `0 0 0 2px ${c.color}` } : undefined}
                            >
                              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: c.color }} />
                              <span>{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </SettingCard>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <SettingCard title="Font" description="The typeface used across the app.">
                        <div className="space-y-2">
                          {[
                            { id: 'sans' as const, label: 'Inter (default)' },
                            { id: 'editorial' as const, label: 'Playfair Display (serif)' },
                            { id: 'mono' as const, label: 'Fira Code (monospace)' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              aria-pressed={appearance.fontFamily === f.id}
                              onClick={() => updateAppearance({ fontFamily: f.id })}
                              className={cn(
                                'w-full cursor-pointer rounded-xl border p-3 text-left text-xs transition-all',
                                appearance.fontFamily === f.id ? 'border-copper-500/50 bg-copper-500/15 font-semibold text-white' : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                              )}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </SettingCard>

                      <SettingCard title="Text size" description="Makes everything slightly smaller or larger.">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'compact' as const, label: 'Small', scale: '88%' },
                            { id: 'standard' as const, label: 'Normal', scale: '100%' },
                            { id: 'roomy' as const, label: 'Large', scale: '106%' },
                          ].map((s) => (
                            <ChoiceButton key={s.id} active={appearance.fontScale === s.id} onClick={() => updateAppearance({ fontScale: s.id })} className="p-3 text-center">
                              <span className="block text-xs">{s.label}</span>
                              <span className="mt-0.5 block text-[10px] opacity-70">{s.scale}</span>
                            </ChoiceButton>
                          ))}
                        </div>
                      </SettingCard>
                    </div>

                    <SettingCard title="Frosted glass" description="How blurred and see-through panels are. Solid is the fastest on older computers.">
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'none' as const, label: 'Solid', desc: 'No blur' },
                          { id: 'subtle' as const, label: 'Light', desc: 'A soft blur' },
                          { id: 'luxury' as const, label: 'Full', desc: 'Strong blur' },
                        ].map((g) => (
                          <ChoiceButton key={g.id} active={appearance.glassIntensity === g.id} onClick={() => updateAppearance({ glassIntensity: g.id })} className="p-3 text-center">
                            <span className="block text-xs">{g.label}</span>
                            <span className="mt-0.5 block text-[10px] opacity-70">{g.desc}</span>
                          </ChoiceButton>
                        ))}
                      </div>
                    </SettingCard>

                    <div className="space-y-3">
                      <SettingRow title="Interface sounds" description="A soft click when you press buttons and links.">
                        <Switch
                          checked={appearance.soundFeedback}
                          onChange={(v) => {
                            updateAppearance({ soundFeedback: v });
                            if (v) playUiAudio('toggle', true);
                          }}
                          label="Interface sounds"
                        />
                      </SettingRow>
                      <SettingRow title="Reduce motion" description="Turns off most animations. Also follows your computer's own setting.">
                        <Switch checked={appearance.reducedMotion} onChange={(v) => updateAppearance({ reducedMotion: v })} label="Reduce motion" />
                      </SettingRow>
                    </div>
                  </motion.div>
                )}

                {/* ============================ NOTIFICATIONS ============================ */}
                {activeTab === 'notifications' && (
                  <motion.div key="notifications" {...tabMotion} className="space-y-6">
                    <TabHeading
                      icon={<Bell className="h-5 w-5" />}
                      title="Notifications"
                      description="Choose which messages and sounds you want."
                    />
                    <div className="space-y-3">
                      <SettingRow title="Finished runs" description="Show a message when a run takes more than 8 seconds, or finishes while Bedrock is in the background.">
                        <Switch checked={notifications.executionAlerts} onChange={(v) => updateNotifications({ executionAlerts: v })} label="Finished runs" />
                      </SettingRow>
                      <SettingRow title="Token budget warnings" description="Warn me when I get close to my session budget (set in Tokens & budget).">
                        <Switch checked={notifications.tokenWarnings} onChange={(v) => updateNotifications({ tokenWarnings: v })} label="Token budget warnings" />
                      </SettingRow>
                      <SettingRow title="Slow responses" description="Warn me when a model takes longer than 2.5 seconds to answer.">
                        <Switch checked={notifications.latencyAlerts} onChange={(v) => updateNotifications({ latencyAlerts: v })} label="Slow responses" />
                      </SettingRow>
                      <SettingRow title="Completion sound" description="Play a short chime when a run finishes.">
                        <Switch
                          checked={notifications.soundAlerts}
                          onChange={(v) => {
                            updateNotifications({ soundAlerts: v });
                            if (v) playUiAudio('success', true);
                          }}
                          label="Completion sound"
                        />
                      </SettingRow>
                      {notificationsSupported ? (
                        <SettingRow title="System notifications" description="Show a notification from your browser when a run finishes while this tab is in the background.">
                          <Switch checked={notifications.desktopNotifications} onChange={handleDesktopNotificationsToggle} label="System notifications" />
                        </SettingRow>
                      ) : (
                        !isDesktop && (
                          <SettingRow title="System notifications" description="Your browser doesn't support notifications.">
                            <Switch checked={false} onChange={() => {}} label="System notifications" disabled />
                          </SettingRow>
                        )
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ============================ PRIVACY ============================ */}
                {activeTab === 'privacy' && (
                  <motion.div key="privacy" {...tabMotion} className="space-y-8">
                    <div>
                      <TabHeading
                        icon={<Shield className="h-5 w-5" />}
                        title="Privacy & data"
                        description="Control what is saved, what is sent, and where it lives."
                      />
                      <div className="space-y-3">
                        <SettingRow title="Keep prompts on this device" description="Don't back up prompts and workflows to your Bedrock account. They won't appear on your other devices.">
                          <Switch checked={privacy.localVaultOnly} onChange={(v) => updatePrivacy({ localVaultOnly: v })} label="Keep prompts on this device" />
                        </SettingRow>
                        <SettingRow title="Hide secrets in prompts" description="Replace anything that looks like an API key or token with [REDACTED] before it is sent to a model or saved.">
                          <Switch checked={privacy.secretScrubbing} onChange={(v) => updatePrivacy({ secretScrubbing: v })} label="Hide secrets in prompts" />
                        </SettingRow>
                        <SettingRow title="Save my prompt history" description="Keep generated prompts in your History so you can find them later.">
                          <Switch checked={privacy.saveHistory} onChange={(v) => updatePrivacy({ saveHistory: v })} label="Save my prompt history" />
                        </SettingRow>
                        <SettingRow
                          title="Crash reports and usage stats"
                          description="Sends crash reports and anonymous usage numbers so bugs get fixed. Also records the run log shown on your Dashboard. Turn off to stop both."
                        >
                          <Switch checked={privacy.telemetry} onChange={(v) => updatePrivacy({ telemetry: v })} label="Crash reports and usage stats" />
                        </SettingRow>
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-white">
                        <HardDrive className="h-4 w-4 text-copper-400" />
                        <span>Backup</span>
                      </h3>
                      <p className="mb-4 text-xs leading-relaxed text-gray-400">
                        Save your settings, saved prompts and workflows to a file, or restore them from one. API keys and sign-in details are never included.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleExportWorkspace}
                          className="flex cursor-pointer items-center gap-2 rounded-xl bg-copper-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-copper-500/20 transition-all hover:bg-copper-600 active:scale-[0.98]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download backup</span>
                        </button>
                        <input type="file" ref={importFileRef} onChange={handleImportWorkspace} accept=".json" className="hidden" />
                        <button
                          type="button"
                          onClick={() => importFileRef.current?.click()}
                          className="flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>Restore from file</span>
                        </button>
                      </div>
                      {importedStatus && (
                        <p role="status" className={cn('mt-2 flex items-center gap-1.5 text-xs', importedStatus.ok ? 'text-emerald-400' : 'text-rose-400')}>
                          {importedStatus.ok && <Check className="h-3.5 w-3.5" />}
                          <span>{importedStatus.text}</span>
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ============================ UPDATES ============================ */}
                {activeTab === 'updates' && isDesktop && (
                  <motion.div key="updates" {...tabMotion} className="space-y-6">
                    <TabHeading icon={<ArrowUpCircle className="h-5 w-5" />} title="App updates" description="Check for a newer version of the Bedrock desktop app." />
                    <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-copper-500/20 bg-copper-500/10">
                            <img src="/logo-tight.png" alt="" className="h-5 w-5 object-contain" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Bedrock Desktop v{CURRENT_APP_VERSION}</p>
                            <p className="mt-0.5 text-xs text-gray-400">You are running this version.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleManualUpdateCheck}
                          disabled={isCheckingUpdate}
                          className="flex cursor-pointer items-center gap-2 rounded-xl bg-copper-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-md shadow-copper-500/20 transition-all hover:bg-copper-600 disabled:opacity-50"
                        >
                          <RefreshCw className={cn('h-3.5 w-3.5', isCheckingUpdate && 'animate-spin')} />
                          <span>{isCheckingUpdate ? 'Checking...' : 'Check now'}</span>
                        </button>
                      </div>

                      {updateStatus.status === 'available' && (
                        <div className="flex items-center justify-between rounded-xl border border-copper-500/30 bg-copper-500/10 p-4">
                          <div>
                            <p className="text-xs font-bold text-white">Version {updateStatus.version || ''} is available</p>
                            <p className="mt-0.5 text-[11px] text-gray-300">Ready to download and install.</p>
                          </div>
                          <button type="button" onClick={() => applyUpdate(updateStatus.downloadUrl)} className="cursor-pointer rounded-lg bg-copper-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-copper-600">
                            Restart & update
                          </button>
                        </div>
                      )}
                      {updateStatus.status === 'up-to-date' && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-gray-300">
                          <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                          <span>You have the latest version.</span>
                        </div>
                      )}
                      {updateStatus.status === 'error' && updateStatus.error && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">{updateStatus.error}</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="z-20 flex shrink-0 items-center justify-between rounded-b-3xl border-t border-white/10 bg-sf-0d0f13/95 px-6 py-4 backdrop-blur-xl md:px-10">
              <p className="text-xs text-gray-400">Settings save automatically on this device.</p>
              <AnimatePresence>
                {showSaved && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9, x: 8 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    role="status"
                    className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300"
                  >
                    <Check className="h-3.5 w-3.5" /> Saved
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-sf-0a0b0e p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="rounded-xl bg-rose-500/10 p-2.5">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Account</h3>
                  <p className="text-xs text-rose-400">This action is permanent and irreversible.</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-gray-300 space-y-2">
                <p>The following data will be permanently wiped:</p>
                <ul className="list-disc pl-4 space-y-1 text-gray-400">
                  <li>Your account profile and settings</li>
                  <li>All saved prompts and templates</li>
                  <li>All branching trees and workflows</li>
                  <li>All usage telemetry, quota records, and history</li>
                </ul>
              </div>

              {deleteState.status === 'success' ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <p className="text-xs font-semibold text-emerald-300">{deleteState.message}</p>
                  <p className="mt-1 text-[11px] text-gray-400">Redirecting to home...</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label htmlFor="confirm-delete" className="text-xs text-gray-400">
                      To confirm, type <span className="font-mono font-bold text-rose-400">DELETE</span> below:
                    </label>
                    <input
                      id="confirm-delete"
                      type="text"
                      value={deleteConfirmInput}
                      onChange={(e) => setDeleteConfirmInput(e.target.value)}
                      placeholder="DELETE"
                      disabled={deleteState.status === 'deleting'}
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 font-mono text-sm text-white placeholder-gray-600 outline-none focus:border-rose-500/50"
                    />
                  </div>

                  {deleteState.status === 'error' && (
                    <p className="text-xs text-rose-400" role="alert">
                      {deleteState.message}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deleteState.status === 'deleting'}
                      className="cursor-pointer rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmInput !== 'DELETE' || deleteState.status === 'deleting'}
                      className="cursor-pointer rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-rose-600/30 transition-all hover:bg-rose-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deleteState.status === 'deleting' ? 'Deleting...' : 'Permanently Delete'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
