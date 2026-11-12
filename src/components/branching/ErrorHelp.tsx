import { AlertTriangle, Lightbulb } from 'lucide-react';
import { explainNodeError } from './friendlyError';

/**
 * What a failed node shows instead of the raw error text: what went wrong, and how to fix it.
 * Display only. The node still stores the original message exactly as before.
 */
export function ErrorHelp({ message, nodeType }: { message?: string; nodeType?: string }) {
  const friendly = explainNodeError(message, nodeType);
  return (
    <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-left space-y-1.5">
      <p className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-200">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>{friendly.title}</span>
      </p>
      <p className="text-[11px] text-rose-100/80 leading-snug break-words">{friendly.message}</p>
      <p className="flex items-start gap-1.5 text-[11px] text-amber-200/90 leading-snug">
        <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-px text-amber-300" />
        <span>
          <span className="font-semibold">How to fix: </span>
          {friendly.fix}
        </span>
      </p>
    </div>
  );
}
