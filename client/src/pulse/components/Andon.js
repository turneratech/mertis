import React from 'react';

/**
 * Andon — the factory cord. A red line has to be visible from across the room,
 * so it is a banner with a rank, not a 1px border colour change (which is all
 * "pulse-andon" used to be).
 *
 * level: 'stop'  — something escaped to Production / a Critical is burning
 *        'watch' — over budget, bouncing, a queue is building
 */
export function Andon({ level = 'watch', label, children, evidence, action }) {
  return (
    <div className={`pulse-andon-banner pulse-andon-${level}`} role={level === 'stop' ? 'alert' : undefined}>
      <span className="pulse-andon-lamp" aria-hidden="true" />
      <div className="pulse-andon-body">
        {label ? <h4>{label}</h4> : null}
        <p>{children}</p>
        {evidence && evidence.length ? (
          <p className="pulse-evidence">{evidence}</p>
        ) : null}
      </div>
      {action ? <div className="pulse-andon-action">{action}</div> : null}
    </div>
  );
}
