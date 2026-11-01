import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { SYNC_NOTICE_EVENT } from '../../lib/syncNotice';
import { TOAST_EVENT, type ToastDetail, type ToastKind } from '../../lib/notify';
import { BEDROCK_BUDGET_WARNING_EVENT, getActiveNotificationSettings } from '../../lib/appSettings';
import { cn } from '../../lib/utils';

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const MAX_TOASTS = 3;

const KIND_STYLE: Record<ToastKind, { icon: typeof Info; border: string; iconColor: string }> = {
  info: { icon: Info, border: 'border-white/15', iconColor: 'text-copper-400' },
  success: { icon: CheckCircle2, border: 'border-emerald-500/30', iconColor: 'text-emerald-400' },
  warning: { icon: AlertTriangle, border: 'border-amber-500/30', iconColor: 'text-amber-400' },
  error: { icon: XCircle, border: 'border-rose-500/30', iconColor: 'text-rose-400' },
};

/**
 * Bottom-of-screen messages. Shows cloud-sync problems, run notifications (Settings > Notifications)
 * and the token budget warning. Kept under its old name so existing imports keep working.
 */
export function SyncNotice() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.filter((t) => t.message !== message), { id, message, kind }].slice(-MAX_TOASTS));
      timers.current.set(id, setTimeout(() => dismiss(id), kind === 'success' || kind === 'info' ? 6000 : 8000));
    },
    [dismiss]
  );

  useEffect(() => {
    const onSync = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string' && text) push(text, 'warning');
    };
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (detail?.message) push(detail.message, detail.kind || 'info');
    };
    const onBudget = (e: Event) => {
      if (!getActiveNotificationSettings().tokenWarnings) return;
      const percent = (e as CustomEvent<{ percent?: number }>).detail?.percent;
      push(
        `You have used ${typeof percent === 'number' ? `${percent}%` : 'most'} of this session's token budget. You can change the limit in Settings > Tokens & Budget.`,
        'warning'
      );
    };
    window.addEventListener(SYNC_NOTICE_EVENT, onSync);
    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(BEDROCK_BUDGET_WARNING_EVENT, onBudget);
    const activeTimers = timers.current;
    return () => {
      window.removeEventListener(SYNC_NOTICE_EVENT, onSync);
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(BEDROCK_BUDGET_WARNING_EVENT, onBudget);
      activeTimers.forEach((t) => clearTimeout(t));
      activeTimers.clear();
    };
  }, [push]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-md flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const style = KIND_STYLE[toast.kind];
          const Icon = style.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-2xl border bg-sf-0a0a0a/95 backdrop-blur-xl px-4 py-3 shadow-2xl',
                style.border
              )}
            >
              <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', style.iconColor)} aria-hidden="true" />
              <p className="flex-1 text-xs text-gray-200 leading-relaxed">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notice"
                className="text-gray-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
