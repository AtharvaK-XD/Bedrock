import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { SYNC_NOTICE_EVENT } from '../../lib/syncNotice';

export function SyncNotice() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handle = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setMessage(typeof text === 'string' ? text : null);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMessage(null), 8000);
    };
    window.addEventListener(SYNC_NOTICE_EVENT, handle);
    return () => {
      window.removeEventListener(SYNC_NOTICE_EVENT, handle);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-md flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-zinc-950/95 backdrop-blur-xl px-4 py-3 shadow-2xl"
    >
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-xs text-gray-200 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        aria-label="Dismiss notice"
        className="text-gray-400 hover:text-white transition-colors shrink-0"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
