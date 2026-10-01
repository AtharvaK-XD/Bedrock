import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, X, ArrowUpCircle } from 'lucide-react';
import { subscribeToUpdates, applyUpdate } from '../../lib/updater';
import type { UpdateStatus } from '../../lib/updater';
import { isDesktopApp } from '../../lib/platform';

export function UpdateBanner() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const isDesktop = isDesktopApp();

  useEffect(() => {
    if (!isDesktop) return;
    const unsubscribe = subscribeToUpdates((status) => {
      setUpdateStatus(status);
      if (status.status === 'downloaded') {
        setDismissed(false); // Always surface when update is ready to install
      }
    });
    return unsubscribe;
  }, [isDesktop]);

  if (!isDesktop || dismissed) return null;

  const isDownloading = updateStatus.status === 'downloading';
  const isDownloaded = updateStatus.status === 'downloaded';

  if (!isDownloading && !isDownloaded) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-[#121214]/95 backdrop-blur-xl border border-copper-500/40 shadow-2xl shadow-copper-950/50 rounded-2xl p-4 text-white overflow-hidden"
      >
        {/* Ambient background glow */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-copper-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-copper-500/20 to-copper-400/10 border border-copper-500/30 flex items-center justify-center shrink-0 text-copper-400">
            {isDownloading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-copper-400" />
            ) : (
              <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-copper-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {isDownloading ? 'Downloading Update' : 'Update Ready'}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-200 mt-1 leading-snug">
              {isDownloading ? (
                `Downloading Bedrock v${updateStatus.version || ''} update (${updateStatus.percent || 0}%)...`
              ) : (
                <>Bedrock v{updateStatus.version || '1.3.0'} is available! Restart to apply update.</>
              )}
            </p>

            {isDownloading && typeof updateStatus.percent === 'number' && (
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-copper-500 to-amber-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, updateStatus.percent))}%` }}
                />
              </div>
            )}

            {isDownloaded && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => applyUpdate()}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white text-xs font-semibold shadow-md shadow-copper-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restart Now
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Later
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
