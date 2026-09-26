import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const DEFAULT_CAP = 12;

/**
 * Bug IDs as links, not `bugIds.join(' · ')`.
 *
 * The Mission Map rendered an unclickable monospace wall of IDs while the Friday
 * brief linked the same data correctly — inconsistent inside one module. Long
 * sets collapse so a 200-bug mission does not bury the card.
 */
export function BugChips({ projectKey, bugIds, cap = DEFAULT_CAP }) {
  const [expanded, setExpanded] = useState(false);
  const ids = bugIds || [];
  if (!ids.length) return null;

  const shown = expanded ? ids : ids.slice(0, cap);
  const hidden = ids.length - shown.length;

  return (
    <p className="pulse-evidence">
      {shown.map((id) => (
        <Link key={id} to={`/projects/${projectKey}/bugs/${id}`}>{id}</Link>
      ))}
      {hidden > 0 ? (
        <button type="button" className="pulse-chip-more" onClick={() => setExpanded(true)} data-tip="Show every bug in this set">
          +{hidden} more
        </button>
      ) : null}
      {expanded && ids.length > cap ? (
        <button type="button" className="pulse-chip-more" onClick={() => setExpanded(false)} data-tip="Collapse the list">
          show fewer
        </button>
      ) : null}
    </p>
  );
}
