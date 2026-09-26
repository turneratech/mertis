import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One delegated tooltip layer for the whole Pulse module.
 *
 * Any control inside `.pulse-scope` that carries `data-tip="..."` gets a tip.
 * Delegation rather than a wrapper component because otherwise every button in
 * the module would need restructuring, and a stray un-wrapped button would
 * silently have no tip.
 *
 * Behaviour, per the request:
 *   - appears on hover after a short delay (so sweeping the cursor across a
 *     toolbar does not strobe tips)
 *   - hides itself after a couple of seconds even if the pointer stays put
 *   - hides immediately on leave, blur, scroll, click or Escape
 *
 * Also appears on keyboard focus, which is the part that makes this an
 * accessibility improvement rather than only a mouse affordance. The target
 * gets `aria-describedby` while the tip is up.
 */

const SHOW_DELAY = 260;
const HIDE_AFTER = 2200;
const TIP_ID = 'pulse-tip';

export function Tooltip() {
  const [tip, setTip] = useState(null); // { text, top, left, placement }
  const showTimer = useRef(null);
  const hideTimer = useRef(null);
  const targetRef = useRef(null);

  const clearTimers = () => {
    clearTimeout(showTimer.current);
    clearTimeout(hideTimer.current);
  };

  const hide = useCallback(() => {
    clearTimers();
    if (targetRef.current) {
      targetRef.current.removeAttribute('aria-describedby');
      targetRef.current = null;
    }
    setTip(null);
  }, []);

  const place = useCallback((el, text) => {
    const rect = el.getBoundingClientRect();
    // Above by default; flip below when there is not room, so a tip on a
    // control near the top of the viewport is never clipped.
    const above = rect.top > 64;
    targetRef.current = el;
    el.setAttribute('aria-describedby', TIP_ID);
    setTip({
      text,
      top: above ? rect.top - 8 : rect.bottom + 8,
      left: Math.min(Math.max(rect.left + rect.width / 2, 12), window.innerWidth - 12),
      placement: above ? 'above' : 'below'
    });
    hideTimer.current = setTimeout(hide, HIDE_AFTER);
  }, [hide]);

  useEffect(() => {
    const scope = () => document.querySelector('.pulse-scope');

    const findTarget = (node) => {
      if (!node || typeof node.closest !== 'function') return null;
      const el = node.closest('[data-tip]');
      if (!el) return null;
      const root = scope();
      return root && root.contains(el) ? el : null;
    };

    const onOver = (event) => {
      const el = findTarget(event.target);
      if (!el || el === targetRef.current) return;
      clearTimers();
      const text = el.getAttribute('data-tip');
      if (!text) return;
      showTimer.current = setTimeout(() => place(el, text), SHOW_DELAY);
    };

    const onOut = (event) => {
      const el = findTarget(event.target);
      if (el && el === targetRef.current) hide();
      else if (!el) clearTimeout(showTimer.current);
    };

    const onFocus = (event) => {
      const el = findTarget(event.target);
      if (!el) return;
      const text = el.getAttribute('data-tip');
      if (!text) return;
      clearTimers();
      place(el, text); // no delay for keyboard users
    };

    const onKey = (event) => {
      if (event.key === 'Escape') hide();
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKey);
    // A tip anchored to a scrolled-away element would float over nothing.
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    document.addEventListener('click', hide, true);

    return () => {
      clearTimers();
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      document.removeEventListener('click', hide, true);
    };
  }, [hide, place]);

  if (!tip) return null;

  return (
    <div
      id={TIP_ID}
      role="tooltip"
      className={`pulse-tip pulse-tip-${tip.placement}`}
      style={{ top: `${tip.top}px`, left: `${tip.left}px` }}
    >
      {tip.text}
    </div>
  );
}
