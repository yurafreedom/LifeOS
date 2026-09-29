import React from 'react';

/* useDialog — shared behaviour for stacked modal dialogs (Calendar Day
 * Manager + its nested task editor), following the ClarifyPanel pattern:
 *
 *   · focus moves into the dialog on open and returns to the opener on close;
 *   · Tab wraps inside the dialog; Escape closes it — but ONLY the top-most
 *     dialog reacts, so Escape in a nested editor closes the editor and leaves
 *     its parent open. "Top-most" is the last [role="dialog"] in the DOM,
 *     which also covers legacy dialogs such as Quick Add opened on top;
 *   · body scroll lock is reference-counted, so closing a child dialog never
 *     unlocks the page while its parent is still open.
 *
 * Listeners sit on `document` (bubble), which runs before the legacy
 * window-level listeners — a legacy dialog on top still gets its own Escape. */

const { useEffect, useRef } = React;

export const DIALOG_FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Is `element` the last dialog in document order? */
export function isTopDialog(dialogs, element) {
  return dialogs.length > 0 && dialogs[dialogs.length - 1] === element;
}

/** Next focus index for Tab / Shift+Tab wrapping inside `count` items. */
export function wrapFocusIndex(index, count, backwards) {
  if (count <= 0) return -1;
  if (backwards) return index <= 0 ? count - 1 : index - 1;
  return index >= count - 1 ? 0 : index + 1;
}

/* Reference-counted scroll lock. The pure transition is exported for tests. */
export function nextLockState(state, delta, currentOverflow) {
  const count = Math.max(0, state.count + delta);
  if (delta > 0 && state.count === 0) return { count, saved: currentOverflow, overflow: 'hidden' };
  if (count === 0 && state.count > 0) return { count, saved: null, overflow: state.saved ?? '' };
  return { count, saved: state.saved, overflow: count > 0 ? 'hidden' : currentOverflow };
}

let lockState = { count: 0, saved: null };

function changeLock(delta) {
  if (typeof document === 'undefined') return;
  const next = nextLockState(lockState, delta, document.body.style.overflow);
  lockState = { count: next.count, saved: next.saved };
  document.body.style.overflow = next.overflow;
}

export function useDialog(dialogRef, { onClose, initialFocusRef = null }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const returnTo = document.activeElement;
    changeLock(1);
    const focusTimer = setTimeout(() => {
      const root = dialogRef.current;
      if (!root) return;
      const target = (initialFocusRef && initialFocusRef.current) || root.querySelector(DIALOG_FOCUSABLE) || root;
      target.focus();
    }, 30);

    function onKeyDown(event) {
      const root = dialogRef.current;
      if (!root || !isTopDialog(document.querySelectorAll('[role="dialog"]'), root)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(root.querySelectorAll(DIALOG_FOCUSABLE))
        .filter(element => element.offsetParent !== null || element === document.activeElement);
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement);
      const atEdge = index === -1
        || (event.shiftKey && index === 0)
        || (!event.shiftKey && index === items.length - 1);
      if (!atEdge) return;
      event.preventDefault();
      items[wrapFocusIndex(index === -1 ? (event.shiftKey ? 0 : items.length - 1) : index, items.length, event.shiftKey)].focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      changeLock(-1);
      if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) returnTo.focus();
    };
  }, []);
}
