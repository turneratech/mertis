import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NextMovePip } from './NextMovePip';
import { TruthClock } from './TruthClock';

const KNOWN_SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function BugCard({ item, draggable, onDragStart, onDragEnd, className = '', historical = false }) {
  const [dragging, setDragging] = useState(false);
  const raw = (item.severity || 'Medium').toLowerCase();
  // An unexpected severity used to render with no accent at all. Fall back to
  // medium so the card always carries a rank.
  const severity = KNOWN_SEVERITIES.includes(raw) ? raw : 'medium';

  const classes = ['pulse-card', `sev-${severity}`, dragging ? 'dragging' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={classes}
      draggable={Boolean(draggable)}
      onDragStart={(e) => {
        setDragging(true);
        if (onDragStart) onDragStart(e);
      }}
      onDragEnd={(e) => {
        setDragging(false);
        if (onDragEnd) onDragEnd(e);
      }}
    >
      <header className="pulse-card-top">
        <Link className="pulse-id" to={`/projects/${item.projectKey}/bugs/${item.bugId}`}>
          {item.bugId}
        </Link>
        {historical ? null : <TruthClock truthClock={item.truthClock} />}
      </header>
      <p className="pulse-card-title">{item.title}</p>
      <footer className="pulse-card-meta">
        {/*
          A replayed card must not claim things we cannot know about the past.
          Next move and the truth clock are live projections — showing today's
          values under a rewound board would assert a history we never recorded.
        */}
        {historical ? null : <NextMovePip nextMove={item.nextMove} />}
        {item.environment === 'Production' ? <span className="pulse-env">Prod</span> : null}
        {!historical && item.reopenGravity > 0 ? (
          <span className="pulse-gravity" title={`Reopened ${item.reopenGravity}×`}>
            ↻{item.reopenGravity}
          </span>
        ) : null}
        {item.bugType && item.bugType !== 'Bug' ? <span className="pulse-type">{item.bugType}</span> : null}
      </footer>
    </article>
  );
}
