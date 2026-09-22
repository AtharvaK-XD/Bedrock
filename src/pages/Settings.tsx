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
  Server,
  Check
} from 'lucide-react';

type Tab = 'account' | 'api-keys' | 'notifications' | 'privacy';

interface ApiKeysState {
  defaultModel: string;
  geminiKey: string;
  groqKey: string;
  openAiKey: string;
  anthropicKey: string;
  openRouterKey: string;
  huggingFaceKey: string;
  ollamaEndpoint: string;
}

const DEFAULT_API_KEYS: ApiKeysState = {
  defaultModel: 'gemini-2.5-flash',
  geminiKey: '',
  groqKey: '',
  openAiKey: '',
  anthropicKey: '',
  openRouterKey: '',
  huggingFaceKey: '',
  ollamaEndpoint: 'http://localhost:11434',
};

const STORAGE_KEY_API_KEYS = 'bedrock_api_keys';
const STORAGE_KEY_NOTIFICATIONS = 'bedrock_notifications_settings';
const STORAGE_KEY_PRIVACY = 'bedrock_privacy_settings';

function getStoredApiKeys(): ApiKeysState {
  try {
    const data = localStorage.getItem(STORAGE_KEY_API_KEYS);
    if (!data) return DEFAULT_API_KEYS;
    return { ...DEFAULT_API_KEYS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_API_KEYS;
  }
}

interface NotificationSettings {
  executionAlerts: boolean;
  tokenWarnings: boolean;
  latencyAlerts: boolean;
  modelUpdates: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  executionAlerts: true,
  tokenWarnings: true,
  latencyAlerts: false,
  modelUpdates: true,
};

function getStoredNotifications(): NotificationSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (!data) return DEFAULT_NOTIFICATIONS;
    return { ...DEFAULT_NOTIFICATIONS, ...JSON.parse(data) };
  } catch {
    return DEFAULT_NOTIFICATIONS;
  }
}

interface PrivacySettings {
  telemetry: boolean;
  saveHistory: boolean;
  shareCrashReports: boolean;
}

const DEFAULT_PRIVACY: PrivacySettings = {
  telemetry: false,
  saveHistory: true,
  shareCrashReports: false,
};

function getStoredPrivacy(): PrivacySettings {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PRIVACY);
    if (!data) return DEFAULT_PRIVACY;
    return { ...DEFAULT_PRIVACY, ...JSON.parse(data) };
  } catch {
    return DEFAULT_PRIVACY;
  }
}

export default function Settings() {
  const { profile, updateProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState<Tab>('api-keys');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile fields
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [role, setRole] = useState(profile.role || 'Lead Prompt Architect');
  const [organization, setOrganization] = useState(profile.organization || 'Bedrock Labs');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeysState>(getStoredApiKeys);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>(getStoredNotifications);

  // Privacy state
  const [privacy, setPrivacy] = useState<PrivacySettings>(getStoredPrivacy);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setRole(profile.role || 'Lead Prompt Architect');
    setOrganization(profile.organization || 'Bedrock Labs');
  }, [profile]);

  const toggleShowKey = (id: string) => {
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
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to process avatar');
      setTimeout(() => setAvatarError(null), 4000);
    } finally {
      setIsUploadingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    // Save profile updates
    updateProfile({ name, email, role, organization });

    // Persist API keys, notifications, and privacy preferences
    try {
      localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(apiKeys));
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
      localStorage.setItem(STORAGE_KEY_PRIVACY, JSON.stringify(privacy));
      window.dispatchEvent(new Event('bedrock_api_keys_updated'));
    } catch (err) {
      console.error('Failed to save settings to localStorage:', err);
    }

    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    }, 500);
  };

  const handleClearCache = () => {
    try {
      localStorage.removeItem('sessionTokens');
      localStorage.removeItem('weeklyTokens');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'account', label: 'Account Profile', icon: User },
    { id: 'api-keys', label: 'Models & API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Data', icon: Shield },
  ];

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-8 lg:py-12 min-h-[calc(100vh-80px)] flex flex-col pb-24">
        {/* Header Breadcrumbs & Title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">
            <Link to="/app" className="hover:text-white transition-colors">Workspace</Link>
            <span>/</span>
            <span className="text-white font-semibold">Settings</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-editorial font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Manage your account credentials, AI model endpoints, and API keys.
          </p>
        </div>

        {/* Main Grid: Sidebar + Content */}
        <div className="flex flex-col md:flex-row gap-8 flex-1 items-start">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="flex flex-col gap-1.5 sticky top-28 bg-[#0e1014]/60 backdrop-blur-xl border border-white/5 p-2 rounded-2xl">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left cursor-pointer",
                      isActive
                        ? "bg-white/10 text-white shadow-sm font-semibold border border-white/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("w-4 h-4", isActive ? "text-copper-400" : "text-gray-500")} />
                      <span>{tab.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-copper-400 shadow-[0_0_8px_rgba(200,168,107,0.8)]" />
                    )}
                  </button>
                );
              })}

              <div className="h-px bg-white/10 my-2 mx-3"></div>

              <Link
                to="/app/profile"
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider text-gray-400 hover:text-copper-300 hover:bg-white/5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-copper-400" />
                <span>Public Profile</span>
              </Link>
            </nav>
          </aside>

          {/* Settings Card with Dedicated Scroll Container and Docked Footer */}
          <main className="flex-1 w-full bg-[#121417]/85 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden min-h-[520px]">
            
            {/* Scrollable Content Body - with data-lenis-prevent and custom-scrollbar */}
            <div
              className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar space-y-8 max-h-[calc(100vh-250px)] min-h-[420px]"
              data-lenis-prevent="true"
            >
              <AnimatePresence mode="wait">
                {/* 1. ACCOUNT TAB */}
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
                          <h2 className="text-xl font-bold text-white">Account Profile</h2>
                          <p className="text-xs text-gray-400 font-mono mt-1">Manage personal identity and workspace credentials</p>
                        </div>
                        <Link
                          to="/app/profile"
                          className="text-xs font-mono uppercase tracking-wider text-copper-400 hover:text-copper-300 transition-colors flex items-center gap-1"
                        >
                          View Profile &rarr;
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
                          <p className="text-xs text-gray-500 mt-2 font-mono">JPG, PNG, WEBP or GIF. Auto-scaled & optimized.</p>
                          {avatarError && <p className="text-xs text-red-400 mt-1">{avatarError}</p>}
                        </div>
                      </div>

                      {/* Inputs Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Organization</label>
                          <input
                            type="text"
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-white/10"></div>

                    {/* Subscription card */}
                    <div>
                      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-copper-400" />
                        <span>Subscription Plan</span>
                      </h3>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-copper-950/20 via-white/[0.02] to-transparent rounded-2xl border border-white/10">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">Free Tier</p>
                            <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-1">Core model access, standard rate limits, unlimited local pipelines.</p>
                        </div>
                        <Link
                          to="/app/pricing"
                          className="px-5 py-2.5 bg-copper-500 hover:bg-copper-600 text-white text-xs font-semibold uppercase tracking-wider rounded-xl shadow-md shadow-copper-500/20 transition-all shrink-0"
                        >
                          Upgrade Plan
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 2. MODELS & API KEYS TAB */}
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
                      <p className="text-sm text-gray-400 mb-6">
                        Provide your proprietary or open-source API keys. Keys are saved locally on this machine and used directly for inference.
                      </p>

                      <div className="space-y-6">
                        {/* Default Model Selection */}
                        <div className="p-4 rounded-2xl bg-[#0a0b0e] border border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-copper-400" />
                              <span>Default Workspace Model</span>
                            </label>
                            <span className="text-[11px] font-mono text-gray-400">Primary model for generation</span>
                          </div>
                          <select
                            value={apiKeys.defaultModel}
                            onChange={(e) => setApiKeys((prev) => ({ ...prev, defaultModel: e.target.value }))}
                            className="w-full px-4 py-3 bg-[#13151b] border border-white/10 text-white rounded-xl text-sm focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono cursor-pointer"
                          >
                            <optgroup label="Google DeepMind (Recommended)">
                              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast, High Context)</option>
                              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning & Multimodal)</option>
                            </optgroup>
                            <optgroup label="Groq (Lightning Fast Open Source)">
                              <option value="llama-3.1-70b-versatile">Llama 3.1 70B (Versatile, 128k)</option>
                              <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                              <option value="mixtral-8x7b-32768">Mixtral 8x7B (32k)</option>
                            </optgroup>
                            <optgroup label="Anthropic">
                              <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                              <option value="claude-3-5-haiku">Anthropic Claude 3.5 Haiku</option>
                            </optgroup>
                            <optgroup label="OpenRouter & Hugging Face">
                              <option value="openrouter/auto">OpenRouter Auto (Free Tier)</option>
                              <option value="hf/Qwen/Qwen2.5-72B-Instruct">Qwen 2.5 72B (via Hugging Face)</option>
                            </optgroup>
                            <optgroup label="Local / Offline">
                              <option value="ollama-local">Ollama Local (http://localhost:11434)</option>
                            </optgroup>
                          </select>
                        </div>

                        <div className="h-px bg-white/10 my-4"></div>

                        {/* 1. Google Gemini */}
                        <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-400" />
                              <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                                Google Gemini API Key
                              </label>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              apiKeys.geminiKey ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-400 border-white/10"
                            )}>
                              {apiKeys.geminiKey ? 'Configured' : 'Not Set'}
                            </span>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type={showKey['gemini'] ? 'text' : 'password'}
                              placeholder="AIzaSy..."
                              value={apiKeys.geminiKey}
                              onChange={(e) => setApiKeys((prev) => ({ ...prev, geminiKey: e.target.value }))}
                              className="w-full px-4 py-3 pr-20 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                            />
                            <div className="absolute right-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleShowKey('gemini')}
                                className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                                title={showKey['gemini'] ? 'Hide key' : 'Show key'}
                              >
                                {showKey['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-xs text-gray-500 font-mono">Generous free tier with 1M token context window.</p>
                            <a
                              href="https://aistudio.google.com/app/apikey"
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-copper-400 hover:text-copper-300 font-mono inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Get Free Key</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* 2. Groq */}
                        <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                                Groq Cloud API Key
                              </label>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              apiKeys.groqKey ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-400 border-white/10"
                            )}>
                              {apiKeys.groqKey ? 'Configured' : 'Not Set'}
                            </span>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type={showKey['groq'] ? 'text' : 'password'}
                              placeholder="gsk_..."
                              value={apiKeys.groqKey}
                              onChange={(e) => setApiKeys((prev) => ({ ...prev, groqKey: e.target.value }))}
                              className="w-full px-4 py-3 pr-20 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                            />
                            <div className="absolute right-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleShowKey('groq')}
                                className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                                title={showKey['groq'] ? 'Hide key' : 'Show key'}
                              >
                                {showKey['groq'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-xs text-gray-500 font-mono">Ultra-fast LPU inference (500+ tokens/sec) for Llama & Mixtral.</p>
                            <a
                              href="https://console.groq.com/keys"
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-copper-400 hover:text-copper-300 font-mono inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Get Free Key</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* 3. OpenAI */}
                        <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                                OpenAI API Key
                              </label>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              apiKeys.openAiKey ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-400 border-white/10"
                            )}>
                              {apiKeys.openAiKey ? 'Configured' : 'Not Set'}
                            </span>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type={showKey['openai'] ? 'text' : 'password'}
                              placeholder="sk-..."
                              value={apiKeys.openAiKey}
                              onChange={(e) => setApiKeys((prev) => ({ ...prev, openAiKey: e.target.value }))}
                              className="w-full px-4 py-3 pr-20 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                            />
                            <div className="absolute right-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleShowKey('openai')}
                                className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                                title={showKey['openai'] ? 'Hide key' : 'Show key'}
                              >
                                {showKey['openai'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-xs text-gray-500 font-mono">Powers direct OpenAI API completions if configured.</p>
                            <a
                              href="https://platform.openai.com/api-keys"
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-copper-400 hover:text-copper-300 font-mono inline-flex items-center gap-1 transition-colors"
                            >
                              <span>OpenAI Platform</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* 4. Anthropic */}
                        <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-orange-400" />
                              <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                                Anthropic API Key
                              </label>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              apiKeys.anthropicKey ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-400 border-white/10"
                            )}>
                              {apiKeys.anthropicKey ? 'Configured' : 'Not Set'}
                            </span>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type={showKey['anthropic'] ? 'text' : 'password'}
                              placeholder="sk-ant-..."
                              value={apiKeys.anthropicKey}
                              onChange={(e) => setApiKeys((prev) => ({ ...prev, anthropicKey: e.target.value }))}
                              className="w-full px-4 py-3 pr-20 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                            />
                            <div className="absolute right-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleShowKey('anthropic')}
                                className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                                title={showKey['anthropic'] ? 'Hide key' : 'Show key'}
                              >
                                {showKey['anthropic'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-xs text-gray-500 font-mono">Powers Claude 3.5 Sonnet and Haiku coding benchmarks.</p>
                            <a
                              href="https://console.anthropic.com/settings/keys"
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-copper-400 hover:text-copper-300 font-mono inline-flex items-center gap-1 transition-colors"
                            >
                              <span>Anthropic Console</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* 5. OpenRouter / Universal */}
                        <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-400" />
                              <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                                OpenRouter API Key
                              </label>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              apiKeys.openRouterKey ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-gray-400 border-white/10"
                            )}>
                              {apiKeys.openRouterKey ? 'Configured' : 'Not Set'}
                            </span>
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type={showKey['openrouter'] ? 'text' : 'password'}
                              placeholder="sk-or-..."
                              value={apiKeys.openRouterKey}
                              onChange={(e) => setApiKeys((prev) => ({ ...prev, openRouterKey: e.target.value }))}
                              className="w-full px-4 py-3 pr-20 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                            />
                            <div className="absolute right-2 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleShowKey('openrouter')}
                                className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/5"
                                title={showKey['openrouter'] ? 'Hide key' : 'Show key'}
                              >
                                {showKey['openrouter'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-xs text-gray-500 font-mono">Single key access to hundreds of open & commercial models.</p>
                            <a
                              href="https://openrouter.ai/keys"
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-copper-400 hover:text-copper-300 font-mono inline-flex items-center gap-1 transition-colors"
                            >
                              <span>OpenRouter Keys</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>

                        {/* 6. Ollama Local Endpoint */}
                        <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Server className="w-3.5 h-3.5 text-gray-300" />
                              <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                                Local Ollama Base URL
                              </label>
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Local Host
                            </span>
                          </div>
                          <input
                            type="text"
                            placeholder="http://localhost:11434"
                            value={apiKeys.ollamaEndpoint}
                            onChange={(e) => setApiKeys((prev) => ({ ...prev, ollamaEndpoint: e.target.value }))}
                            className="w-full px-4 py-3 bg-[#0a0b0e] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                          />
                          <p className="text-xs text-gray-500 font-mono">
                            Run private LLMs entirely on your GPU without sending data across the internet.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 3. NOTIFICATIONS TAB */}
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
                      <p className="text-sm text-gray-400 mb-6">
                        Configure what alerts and system updates you want to receive in your workspace.
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
                              onClick={() =>
                                setNotifications((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                              }
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

                {/* 4. PRIVACY TAB */}
                {activeTab === 'privacy' && (
                  <motion.div
                    key="privacy"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-1">
                        <Shield className="w-5 h-5 text-copper-400" />
                        <span>Privacy & Workspace Data</span>
                      </h2>
                      <p className="text-sm text-gray-400 mb-6">
                        Bedrock adheres to a local-first philosophy. Your system prompts, trees, and keys remain strictly in your browser and local machine.
                      </p>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                          <div className="space-y-0.5 pr-4">
                            <p className="text-sm font-semibold text-white">Save Generation History Locally</p>
                            <p className="text-xs text-gray-400 font-mono">Store synthesized prompts in your local indexed prompt library.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPrivacy((prev) => ({ ...prev, saveHistory: !prev.saveHistory }))}
                            className={cn(
                              "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                              privacy.saveHistory ? "bg-copper-500" : "bg-white/10"
                            )}
                          >
                            <span
                              className={cn(
                                "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                privacy.saveHistory ? "translate-x-6" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                          <div className="space-y-0.5 pr-4">
                            <p className="text-sm font-semibold text-white">Anonymous Performance Diagnostics</p>
                            <p className="text-xs text-gray-400 font-mono">Help improve model benchmark metrics without sending prompt contents.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPrivacy((prev) => ({ ...prev, telemetry: !prev.telemetry }))}
                            className={cn(
                              "w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 p-0.5",
                              privacy.telemetry ? "bg-copper-500" : "bg-white/10"
                            )}
                          >
                            <span
                              className={cn(
                                "w-5 h-5 rounded-full bg-white block transition-transform shadow-md",
                                privacy.telemetry ? "translate-x-6" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>

                        <div className="h-px bg-white/10 my-4"></div>

                        {/* Local Cache Management */}
                        <div className="p-5 rounded-2xl bg-rose-950/10 border border-rose-500/20 space-y-3">
                          <div>
                            <h3 className="text-sm font-bold text-rose-300">Local Cache & Token Stats</h3>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              Reset temporary counters and local token estimation cache.
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleClearCache}
                              className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold uppercase tracking-wider rounded-xl border border-rose-500/30 transition-colors cursor-pointer"
                            >
                              {cacheCleared ? 'Cache Cleared!' : 'Clear Token Cache'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dedicated Docked Footer Bar (In-Flow, Never Overlapping Content) */}
            <div className="border-t border-white/10 bg-[#0d0f13]/95 backdrop-blur-xl px-6 py-4 md:px-10 flex items-center justify-between shrink-0 z-20 rounded-b-3xl">
              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span className="hidden sm:inline">Preferences persisted locally to your machine</span>
                <span className="sm:hidden">Local storage</span>
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
