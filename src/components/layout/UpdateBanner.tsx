import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, X, ArrowUpCircle, Download } from 'lucide-react';
import { subscribeToUpdates, applyUpdate, checkForUpdates } from '../../lib/updater';
import type { UpdateStatus } from '../../lib/updater';
import { isDesktopApp } from '../../lib/platform';

export function UpdateBanner() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const isDesktop = isDesktopApp();

  useEffect(() => {
    if (!isDesktop) return;

    // Subscribe to updater events
    const unsubscribe = subscribeToUpdates((status) => {
      setUpdateStatus(status);
      if (status.status === 'downloaded' || status.status === 'available') {
        // Automatically surface banner when newer release is found
        setDismissed(false);
      }
    });

    // Check GitHub releases 2.5 seconds after launch
    const initialTimer = setTimeout(() => {
      checkForUpdates();
    }, 2500);

    // Periodically check GitHub releases every 30 minutes
    const periodicTimer = setInterval(() => {
      checkForUpdates();
    }, 30 * 60 * 1000);

    return () => {
      unsubscribe();
      clearTimeout(initialTimer);
      clearInterval(periodicTimer);
    };
  }, [isDesktop]);

  // STRICT RULE: Only show in Desktop App, only when a newer version has been released, never if current
  if (!isDesktop || dismissed) return null;

  const isAvailable = updateStatus.status === 'available';
  const isDownloading = updateStatus.status === 'downloading';
  const isDownloaded = updateStatus.status === 'downloaded';

  if (!isAvailable && !isDownloading && !isDownloaded) {
    return null;
  }

  const handleUpdateClick = () => {
    applyUpdate(updateStatus.downloadUrl);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -50, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="fixed top-6 right-6 z-[999] max-w-sm w-full bg-[#0d0f13]/95 backdrop-blur-2xl border border-copper-500/40 shadow-2xl shadow-black/90 rounded-2xl p-4 text-white overflow-hidden"
      >
        {/* Ambient background glow */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-copper-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-copper-500/20 to-copper-400/10 border border-copper-500/30 flex items-center justify-center shrink-0 text-copper-400 shadow-inner">
            {isDownloading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-copper-400" />
            ) : isDownloaded ? (
              <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-copper-400" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-copper-400 flex items-center gap-1 bg-copper-500/10 border border-copper-500/20 px-2 py-0.5 rounded-full">
                {isDownloading
                  ? 'Downloading Update'
                  : isDownloaded
                  ? 'Update Ready'
                  : 'Update Available'}
              </span>
              {updateStatus.version && (
                <span className="text-[10px] font-mono text-zinc-400">
                  v{updateStatus.version}
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">
              Update Bedrock
            </h3>

            <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
              {isDownloading
                ? `Downloading Bedrock v${updateStatus.version || ''} update (${updateStatus.percent || 0}%)...`
                : isDownloaded
                ? `Bedrock v${updateStatus.version} has finished downloading. Restart now to apply update.`
                : `A new version of Bedrock (v${updateStatus.version}) is available on GitHub.`}
            </p>

            {/* Progress bar during download */}
            {isDownloading && typeof updateStatus.percent === 'number' && (
              <div className="w-full bg-white/10 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-copper-500 to-copper-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, updateStatus.percent))}%` }}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleUpdateClick}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white text-xs font-semibold shadow-md shadow-copper-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isDownloaded ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restart Now</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Update Bedrock</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
