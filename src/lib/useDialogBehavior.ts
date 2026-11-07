import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]';

/**
 * Keyboard behaviour every pop-up window needs, so people who do not use a mouse are not stuck behind it:
 *  - focus moves into the window when it opens (and back to where it was when it closes)
 *  - Tab and Shift+Tab stay inside the window
 *  - Escape closes it (only when `onEscape` is given, because some windows must not be dismissed mid-action)
 */
export function useDialogBehavior(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Move focus in unless something inside already has it (for example an input with autofocus)
    if (!node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>(FOCUSABLE);
      if (first) first.focus();
      else {
        node.tabIndex = -1;
        node.focus();
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
    // The window's own content changes while it is open (steps, errors); the key handler only reads the live DOM
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref]);
}
