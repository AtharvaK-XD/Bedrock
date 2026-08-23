import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Key, 
  Palette, 
  Bell, 
  Shield, 
  CreditCard,
  LogOut,
  Save,
  Check
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';

type Tab = 'account' | 'api-keys' | 'appearance' | 'notifications' | 'privacy';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'account', label: 'Account Profile', icon: User },
    { id: 'api-keys', label: 'Models & API Keys', icon: Key },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Data', icon: Shield },
  ];

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-10 lg:py-16 min-h-[calc(100vh-80px)]">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-editorial font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2">Manage your account, API keys, and app preferences.</p>
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
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-left",
                    isActive 
                      ? "bg-white/10 text-white shadow-md" 
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <tab.icon className={cn("w-4 h-4", isActive ? "text-copper-400" : "text-gray-500")} />
                  {tab.label}
                </button>
              );
            })}
            
            <div className="h-px bg-white/10 my-4 mx-4"></div>
            
            <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-900/20 transition-all duration-200 text-left">
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-[#1a1a1a]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-sm min-h-[500px] relative overflow-hidden">
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
                  <h2 className="text-xl font-bold text-white mb-6">Account Profile</h2>
                  
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-copper-500 to-copper-300 text-white flex items-center justify-center font-bold text-2xl shadow-md">
                      AK
                    </div>
                    <div>
                      <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-lg transition-colors">
                        Change Avatar
                      </button>
                      <p className="text-xs text-gray-500 mt-2">JPG, GIF or PNG. Max size of 800K</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-300">Full Name</label>
                      <input 
                        type="text" 
                        defaultValue="Atharva K."
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-300">Email Address</label>
                      <input 
                        type="email" 
                        defaultValue="atharva@example.com"
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/10"></div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    Subscription Plan
                  </h3>
                  <div className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/10">
                    <div>
                      <p className="font-semibold text-white">Free Tier</p>
                      <p className="text-sm text-gray-400">Core model access, limited messages</p>
                    </div>
                    <button className="px-4 py-2 bg-copper-500 hover:bg-copper-600 text-white text-sm font-semibold rounded-lg shadow-sm shadow-copper-500/20 transition-all">
                      Upgrade
                    </button>
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
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-white">Default Model</label>
                      </div>
                      <select className="w-full px-4 py-3 bg-[#111] border border-white/10 text-white rounded-xl text-sm focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all appearance-none">
                        <option>Gemini 1.5 Pro (Free API)</option>
                        <option>Llama 3 70B (via Groq)</option>
                        <option>OpenAI GPT-4o (BYOK)</option>
                        <option>Ollama (Local)</option>
                      </select>
                    </div>

                    <div className="h-px bg-white/10 my-2"></div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white">Google Gemini API Key</label>
                      <input 
                        type="password" 
                        placeholder="AIzaSy..."
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                      <p className="text-xs text-gray-500">Get a free key from Google AI Studio.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white">Groq API Key</label>
                      <input 
                        type="password" 
                        placeholder="gsk_..."
                        className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-copper-500 focus:ring-1 focus:ring-copper-500 transition-all font-mono"
                      />
                      <p className="text-xs text-gray-500">Get a free key from Groq Cloud to run open-source models lightning fast.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white">OpenAI API Key</label>
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

            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-xl font-bold text-white mb-6">Appearance</h2>
                  
                  <div className="space-y-4">
                    <label className="text-sm font-semibold text-white">Theme</label>
                    <div className="grid grid-cols-3 gap-4">
                      {['Light', 'Dark', 'System'].map((theme, i) => (
                        <button 
                          key={theme}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all",
                            i === 0 ? "border-copper-500 bg-copper-500/5 ring-1 ring-copper-500" : "border-white/10 bg-transparent hover:bg-white/5 text-white"
                          )}
                        >
                          <div className={cn("w-12 h-8 rounded-md mb-3 border", i === 1 ? "bg-[#111] border-white/10" : "bg-transparent border-white/20")}></div>
                          <span className={cn("text-sm font-semibold", i === 0 ? "text-copper-400" : "text-gray-300")}>{theme}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Other tabs can be similarly implemented */}
            {(activeTab === 'notifications' || activeTab === 'privacy') && (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center h-[300px] text-gray-500 text-sm"
              >
                {activeTab === 'notifications' ? 'Notification settings coming soon.' : 'Privacy settings coming soon.'}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Save Button */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-[#111] to-transparent flex justify-end">
            <button 
              onClick={handleSave}
              disabled={isSaving || saved}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-black shadow-md transition-all duration-300",
                saved 
                  ? "bg-green-500 shadow-green-500/20 text-white" 
                  : "bg-white hover:bg-gray-200 hover:-translate-y-0.5",
                isSaving && "opacity-80"
              )}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
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
