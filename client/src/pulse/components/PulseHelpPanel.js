import React, { useEffect, useRef } from 'react';
import { PulseHelpExplainer } from '../../components/PulseHelpExplainer';
import { PulseHelpWorkflows } from '../../components/PulseHelpWorkflows';

/**
 * In-context help.
 *
 * The glossary already existed — 27 control rows and a Jira/Trello/Linear
 * comparison — but lived only in the Help modal, reachable from nowhere inside
 * /pulse. Pulse's vocabulary (Pit, Strike, The Line, Andon) is a real adoption
 * cost, so the explanation belongs one click from the thing it explains.
 */
export function PulseHelpPanel({ open, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the panel so a keyboard user is not left behind it.
    if (closeRef.current) closeRef.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="pulse-help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="What the Pulse controls mean"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pulse-help-panel">
        <header className="pulse-help-panel-head">
          <h2>What everything here means</h2>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            data-tip="Close (Esc)"
          >
            Close
          </button>
        </header>
        <div className="pulse-help-panel-body">
          <PulseHelpExplainer />
          <PulseHelpWorkflows />
        </div>
      </div>
    </div>
  );
}
