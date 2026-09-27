import type React from 'react';

/**
 * Keyboard support for a clickable element that can't be a <button> (e.g. a
 * card containing other buttons): Enter or Space activates it, as a button would.
 * Keys pressed inside nested controls are left alone.
 */
export const activateOnKey = (action: () => void) => (e: React.KeyboardEvent) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
  }
};
