import React from 'react';
import { Link } from 'react-router-dom';
import { NextMovePip } from './components/NextMovePip';
import { TruthClock } from './components/TruthClock';
import { resolveClientNextMove } from './clientNextMove';
import { usePulseEnabled } from './usePulseEnabled';
import './pulse.css';

/** Bundle-only chrome. Renders nothing for Mertis-only (Pulse off). */
export function PulseProjectLink({ projectKey, label = 'Open on Pulse' }) {
  const on = usePulseEnabled();
  if (!on || !projectKey) return null;
  return (
    <div className="pulse-strip">
      <Link to={`/pulse/${projectKey}`}>{label}</Link>
    </div>
  );
}

export function PulseStrip({ bug, projectKey }) {
  const on = usePulseEnabled();
  if (!on || !bug || !projectKey) return null;
  const nextMove = bug.nextMove || resolveClientNextMove(bug);
  const clock = bug.truthClock;
  return (
    <div className="pulse-strip">
      <span>On Pulse:</span>
      <strong>{bug.status}</strong>
      <NextMovePip nextMove={nextMove} />
      {clock ? <TruthClock truthClock={clock} /> : null}
      <Link to={`/pulse/${projectKey}`}>Open Strike</Link>
    </div>
  );
}
