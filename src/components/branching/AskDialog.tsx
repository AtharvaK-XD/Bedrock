import { useCallback, useRef, useState } from 'react';
import { AskWindow, type AskPending } from './AskWindow';

type Pending = AskPending;

/**
 * The small window an "Ask Me" step opens while a workflow runs. `ask` returns the answer, or null when the
 * person cancels (the engine then stops the run). `cancel` closes it from outside (the Stop button).
 */
export function useAskDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const ask = useCallback((node: { id: string; question: string; default?: string }) => {
    return new Promise<string | null>((resolve) => {
      pendingRef.current?.resolve(null);
      setPending({ question: node.question, answer: node.default ?? '', resolve });
    });
  }, []);

  const finish = useCallback((value: string | null) => {
    pendingRef.current?.resolve(value);
    setPending(null);
  }, []);

  const cancel = useCallback(() => finish(null), [finish]);

  const element = <AskWindow pending={pending} onAnswer={(a) => finish(a)} onCancel={cancel} onChange={(answer) => setPending((p) => (p ? { ...p, answer } : p))} />;
  return { ask, cancel, element };
}
