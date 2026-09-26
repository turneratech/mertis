import { useEffect } from 'react';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * True when the user is typing and a bare letter must not be a command.
 * The old Pit handler only checked INPUT/TEXTAREA, so a single "a" pressed
 * inside the rich description editor (contentEditable) triaged a bug.
 */
export function isTypingTarget(target) {
  if (!target) return false;
  if (TYPING_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest && target.closest('[contenteditable="true"]'));
}

/**
 * Shared single-key shortcut model for Pulse.
 *
 * `handlers` maps a key to a function: { j: fn, k: fn, a: fn, '?': fn }.
 *
 * Any modifier (ctrl/meta/alt) means the keystroke belongs to the browser or the
 * OS, not to us. Without that guard **Ctrl+A / Cmd+A fired a triage POST**, which
 * is the kind of thing that only hurts once you are pointed at real data.
 */
export function usePulseKeys(handlers, deps = []) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const handler = handlers[event.key];
      if (!handler) return;
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `deps` is supplied by the caller on purpose: the handler map is rebuilt
    // every render, so keying the effect on it would re-bind on every keystroke.
  }, deps);
}
