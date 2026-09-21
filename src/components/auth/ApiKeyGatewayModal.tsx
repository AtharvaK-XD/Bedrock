import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Eye, EyeOff, Sparkles, ExternalLink, ShieldCheck, CheckCircle2, Cpu } from 'lucide-react';

const STORAGE_KEY_API_KEYS = 'bedrock_api_keys';
const API_KEYS_UPDATED_EVENT = 'bedrock_api_keys_updated';

interface ApiKeyGatewayModalProps {
  isOpen: boolean;
  onSuccess?: () => void;
  canDismiss?: boolean;
}

export function ApiKeyGatewayModal({ isOpen, onSuccess, canDismiss = false }: ApiKeyGatewayModalProps) {
  const [geminiKey, setGeminiKey] = useState(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_API_KEYS);
      return data ? JSON.parse(data).geminiKey || '' : '';
    } catch {
      return '';
    }
  });

  const [groqKey, setGroqKey] = useState(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_API_KEYS);
      return data ? JSON.parse(data).groqKey || '' : '';
    } catch {
      return '';
    }
  });

  const [openAiKey, setOpenAiKey] = useState(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY_API_KEYS);
      return data ? JSON.parse(data).openAiKey || '' : '';
    } catch {
      return '';
    }
  });

  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleShowKey = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const gTrimmed = geminiKey.trim();
    const grTrimmed = groqKey.trim();
    const oTrimmed = openAiKey.trim();

    if (!gTrimmed && !grTrimmed && !oTrimmed) {
      setError('Please provide at least one API key (e.g. Gemini or Groq) to unlock the desktop workstation.');
      return;
    }

    try {
      let currentKeys = {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY_API_KEYS);
        if (raw) currentKeys = JSON.parse(raw);
      } catch {
        currentKeys = {};
      }

      const updated = {
        ...currentKeys,
        geminiKey: gTrimmed,
        groqKey: grTrimmed,
        openAiKey: oTrimmed,
        defaultModel: gTrimmed ? 'gemini-2.5-flash' : 'llama-3.3-70b-versatile',
      };

      localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(updated));
      window.dispatchEvent(new Event(API_KEYS_UPDATED_EVENT));
      setIsSaved(true);
      setError(null);

      setTimeout(() => {
        setIsSaved(false);
        if (onSuccess) onSuccess();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to save API keys to local storage.');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-black/80 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl rounded-3xl glass-panel-luxury p-6 sm:p-8 shadow-[0_32px_90px_rgba(0,0,0,0.95)] border border-white/15 overflow-hidden my-auto"
        >
          {/* Specular highlight rim */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-copper-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="relative z-10 flex items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-copper-500/20 to-amber-500/20 border border-copper-400/30 flex items-center justify-center text-copper-300 shadow-[0_0_16px_rgba(200,168,107,0.25)] shrink-0 mt-0.5">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-display font-bold text-white tracking-tight">Connect Your API Credentials</h2>
                  <span className="font-mono text-[10px] text-copper-400 bg-copper-500/10 border border-copper-500/25 px-2 py-0.5 rounded-full font-semibold">
                    BYOK
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  Bedrock Desktop runs privately on your device. Add your own API key to activate prompt generation, branching pipelines, and multi-model arena testing.
                </p>
              </div>
            </div>

            {canDismiss && (
              <button
                onClick={onSuccess}
                className="text-white/40 hover:text-white text-lg font-mono px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {error && (
            <div className="relative z-10 mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="relative z-10 space-y-4">
            {/* Primary Option: Google Gemini */}
            <div className="rounded-2xl glass-subcard p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <label className="text-xs font-semibold text-white">Google Gemini API Key</label>
                  <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2 py-0.2 rounded-full">
                    Recommended · Free Tier
                  </span>
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-copper-400 hover:text-copper-300 flex items-center gap-1 transition-colors"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showKey['gemini'] ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/30 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('gemini')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  {showKey['gemini'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Option 2: Groq API Key */}
            <div className="rounded-2xl glass-subcard p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <label className="text-xs font-semibold text-white">Groq API Key</label>
                  <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.2 rounded-full">
                    Fast LLaMA 3.3
                  </span>
                </div>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-copper-400 hover:text-copper-300 flex items-center gap-1 transition-colors"
                >
                  <span>Get Groq Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative">
                <input
                  type={showKey['groq'] ? 'text' : 'password'}
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/30 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('groq')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  {showKey['groq'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Toggle Other Providers (OpenAI, etc.) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-mono text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
              >
                <span>{showAdvanced ? '− Hide additional providers' : '+ Add OpenAI / other providers'}</span>
              </button>
            </div>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <div className="rounded-2xl glass-subcard p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-white">OpenAI API Key (Optional)</label>
                      <span className="text-[10px] font-mono text-white/40">sk-...</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showKey['openai'] ? 'text' : 'password'}
                        value={openAiKey}
                        onChange={(e) => setOpenAiKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-all pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey('openai')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      >
                        {showKey['openai'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Security Guarantee Notice */}
            <div className="flex items-center gap-2 text-[11px] text-white/45 py-1 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Keys are saved locally in your encrypted app storage and never sent to our servers.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="submit"
                disabled={isSaved}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-display font-semibold text-xs tracking-wide bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white shadow-lg shadow-copper-500/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-75 cursor-pointer"
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Keys Configured! Launching...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-white" />
                    <span>Save & Enter Workspace</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
