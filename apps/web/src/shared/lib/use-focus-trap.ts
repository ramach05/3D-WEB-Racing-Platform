import { useEffect, type RefObject } from 'react';

/** Selectors that receive Tab focus inside a modal */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

type TUseFocusTrapArgs = {
  /** Trap the focus while the modal is open */
  active: boolean;
  /** Modal panel that owns the focus */
  containerRef: RefObject<HTMLElement | null>;
};

/** On open focuses the first control, cycles Tab inside the container and restores the opener focus on close */
export const useFocusTrap = ({ active, containerRef }: TUseFocusTrapArgs): void => {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) {
      return;
    }
    const opener = document.activeElement;

    const getFocusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    getFocusables()[0]?.focus();

    // Listener on document: a stray focus outside the panel is pulled back on the next Tab
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusables = getFocusables();
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        return;
      }
      const current = document.activeElement;
      const outside = !container.contains(current);
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    };
  }, [active, containerRef]);
};
