import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Eye, EyeOff, ExternalLink, X, Check, ShieldCheck, ArrowRight } from 'lucide-react';
import { AgentIcon } from './ModelLogos';
import { getRequiredProviderForModel, saveModelApiKey } from '../../lib/apiKeysHelper';
import { useNavigate } from 'react-router-dom';

interface ApiKeyPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelId?: string;
  modelName?: string;
  agentId?: string;
  onKeySaved?: () => void;
}

export function ApiKeyPromptModal({
  isOpen,
  onClose,
  modelId,
  modelName,
  agentId,
  onKeySaved,
}: ApiKeyPromptModalProps) {
  const navigate = useNavigate();
  const req = getRequiredProviderForModel(modelId, agentId);
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeyValue('');
      setShowKey(false);
      setError(null);
      setIsSaved(false);
    }
  }, [isOpen, modelId, agentId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyValue.trim()) {
      setError(`Please enter a valid ${req.keyLabel}`);
      return;
    }

    saveModelApiKey(req.keyField, keyValue.trim());
    setIsSaved(true);

    setTimeout(() => {
      onKeySaved?.();
      onClose();
    }, 600);
  };

  const handleGoToSettings = () => {
    onClose();
    navigate('/app/settings');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg bg-[#0e1014] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/90 overflow-hidden text-white"
        >
          {/* Subtle Ambient Background Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-copper-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
              <AgentIcon model={modelId} agent={{ id: agentId || req.providerId }} className="w-6 h-6" />
            </div>
            <div className="min-w-0 pr-6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-copper-400 bg-copper-500/10 border border-copper-500/20 px-2 py-0.5 rounded-full font-semibold">
                  API Key Required
                </span>
                <span className="text-[10px] font-mono text-zinc-400">BYOK Desktop</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1.5 truncate">
                Configure {req.providerName}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                To use <span className="text-zinc-200 font-medium">{modelName || modelId || req.providerName}</span> in Bedrock Desktop, add your {req.keyLabel}. Keys are stored locally on your machine and never transmitted to third parties.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono font-medium text-zinc-300">
                  {req.keyLabel}
                </label>
                <a
                  href={req.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-copper-400 hover:text-copper-300 flex items-center gap-1 transition-colors"
                >
                  <span>Get API Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  autoFocus
                  value={keyValue}
                  onChange={(e) => {
                    setKeyValue(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={req.placeholder}
                  className="w-full pl-10 pr-12 py-3 bg-white/[0.03] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-copper-500/80 focus:ring-1 focus:ring-copper-500/50 font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <p className="text-xs text-rose-400 font-mono mt-1.5">{error}</p>
              )}

              <p className="text-[11px] text-zinc-400 mt-2">
                {req.description}
              </p>
            </div>

            {/* Privacy Guarantee */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Direct Client-Side BYOK: Injected directly into secure TLS API calls.</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 gap-3">
              <button
                type="button"
                onClick={handleGoToSettings}
                className="text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer py-2"
              >
                Manage all keys in Settings &rarr;
              </button>

              <button
                type="submit"
                disabled={isSaved}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white font-semibold text-xs uppercase tracking-wider shadow-md shadow-copper-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Key Saved</span>
                  </>
                ) : (
                  <>
                    <span>Save & Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
