import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, innermost last: only the top one reacts to Escape and Tab.
const stack: HTMLElement[] = [];

/**
 * Modal behaviour for a dialog container: focus moves into it when it opens,
 * Tab stays inside it, Escape closes it, and focus returns to whatever opened
 * it afterwards. Put the returned ref on the element with role="dialog".
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    let registered: HTMLElement | null = null;

    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      registered = el;
      stack.push(el);
      const first = (el.querySelector('[autofocus]') || el.querySelector(FOCUSABLE)) as HTMLElement | null;
      (first || el).focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el || stack[stack.length - 1] !== el) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = Array.from(el.querySelectorAll(FOCUSABLE)) as HTMLElement[];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (registered) stack.splice(stack.indexOf(registered), 1);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  return ref;
}
