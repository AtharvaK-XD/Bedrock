import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../lib/useUserProfile';
import { processAvatarImage } from '../lib/imageUtils';

type Tab = 'account' | 'api-keys' | 'notifications' | 'privacy';

export default function Settings() {
  const { profile, updateProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
    updateProfile({ name, email });
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 600);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: 'Account Profile' },
    { id: 'api-keys', label: 'Models & API Keys' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'privacy', label: 'Privacy & Data' },
  ];

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-10 lg:py-16 min-h-[calc(100vh-80px)]">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-editorial font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2 text-sm">Manage your account credentials, API keys, and workspace preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-1 sticky top-24">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left",
                    isActive 
                      ? "bg-white/10 text-white shadow-sm font-semibold" 
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <span>{tab.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-copper-400" />}
                </button>
              );
            })}
            
            <div className="h-px bg-white/10 my-4 mx-4"></div>
            
            <button className="px-4 py-3 rounded-xl text-xs font-mono uppercase tracking-wider text-rose-400 hover:bg-rose-950/30 transition-all duration-200 text-left">
              Sign Out
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-[#1a1a1a]/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-sm min-h-[500px] relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Account Profile</h2>
                    <Link to="/app/profile" className="text-xs font-mono uppercase tracking-wider text-copper-400 hover:text-copper-300 transition-colors">
                      View Profile &rarr;
                    </Link>
                  </div>
                  
                  <div className="flex items-center gap-6 mb-8">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleAvatarFileChange} 
                      accept="image/*" 
                      className="hidden" 
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="relative group w-20 h-20 rounded-full bg-gradient-to-tr from-copper-500 to-copper-300 text-white flex items-center justify-center font-bold text-2xl shadow-md overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-copper-400/50 transition-all"
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
                      <div className="flex items-center gap-3">
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUploadingAvatar ? 'Processing...' : (profile.avatarUrl ? 'Change Avatar' : 'Upload Avatar')}
                        </button>
                        {profile.avatarUrl && (
                          <button 
                            type="button"
                            onClick={() => updateProfile({ avatarUrl: '' })}
                            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-2 font-mono">JPG, PNG, WEBP or GIF. Auto-scaled & optimized</p>
                      {avatarError && <p className="text-xs text-red-400 mt-1">{avatarError}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Full Name</label>
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-mono font-semibold text-gray-300 uppercase tracking-wider">Email Address</label>
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/10"></div>

                <div>
                  <h3 className="text-base font-bold text-white mb-4">
                    Subscription Plan
                  </h3>
                  <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/10">
                    <div>
                      <p className="font-semibold text-white">Free Tier</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">Core model access, limited messages</p>
                    </div>
                    <Link to="/app/pricing" className="px-4 py-2 bg-copper-500 hover:bg-copper-600 text-white text-xs font-semibold uppercase tracking-wider rounded-lg shadow-sm shadow-copper-500/20 transition-all">
                      Upgrade
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'api-keys' && (
              <motion.div
                key="api-keys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">Models & API Keys</h2>
                  <p className="text-sm text-gray-400 mb-6">Provide your own API keys to use proprietary and open-source models directly.</p>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">Default Model</label>
                      <select className="w-full px-4 py-3 bg-[#111] border border-white/10 text-white rounded-xl text-sm focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all appearance-none font-mono">
                        <option>Gemini 1.5 Pro (Free API)</option>
                        <option>Llama 3 70B (via Groq)</option>
                        <option>OpenAI GPT-4o (BYOK)</option>
                        <option>Ollama (Local)</option>
                      </select>
                    </div>

                    <div className="h-px bg-white/10 my-2"></div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">Google Gemini API Key</label>
                      <input 
                        type="password" 
                        placeholder="AIzaSy..."
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                      <p className="text-xs text-gray-500 font-mono">Get a free key from Google AI Studio.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">Groq API Key</label>
                      <input 
                        type="password" 
                        placeholder="gsk_..."
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                      <p className="text-xs text-gray-500 font-mono">Get a free key from Groq Cloud to run open-source models lightning fast.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-mono font-semibold text-white uppercase tracking-wider">OpenAI API Key</label>
                      <input 
                        type="password" 
                        placeholder="sk-..."
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {(activeTab === 'notifications' || activeTab === 'privacy') && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center h-[300px] text-gray-500 text-xs font-mono uppercase tracking-wider"
              >
                {activeTab === 'notifications' ? 'Notification preferences coming soon.' : 'Privacy controls coming soon.'}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Save Button */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-[#111] to-transparent flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isSaving || saved}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-black shadow-md transition-all duration-300 active:scale-[0.98]",
                saved 
                  ? "bg-emerald-400 shadow-emerald-400/20 text-black font-bold" 
                  : "bg-white hover:bg-gray-200",
                isSaving && "opacity-80"
              )}
            >
              {isSaving && (
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
              )}
              {saved ? 'Saved!' : isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </main>
      </div>
      </div>
    </PageTransition>
  );
}
