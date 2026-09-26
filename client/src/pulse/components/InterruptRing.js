import React from 'react';
import { Instrument, Degraded, withDegraded } from './Instrument';

// Geometry for a 3/4 open gauge: starts bottom-left, sweeps clockwise.
const SIZE = 92;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const SWEEP = 0.75; // fraction of the circle the gauge occupies
const TRACK = CIRC * SWEEP;

/**
 * An arc segment. `from`/`to` are percentages of the budget scale (0-100).
 */
function Arc({ from, to, className }) {
  const start = Math.max(0, Math.min(100, from)) / 100;
  const end = Math.max(0, Math.min(100, to)) / 100;
  const length = Math.max(0, end - start) * TRACK;
  if (length <= 0) return null;
  return (
    <circle
      className={className}
      cx={SIZE / 2}
      cy={SIZE / 2}
      r={R}
      fill="none"
      strokeWidth={STROKE}
      strokeLinecap="butt"
      strokeDasharray={`${length} ${CIRC}`}
      strokeDashoffset={-start * TRACK}
    />
  );
}

export function InterruptRing({ interrupt, degraded }) {
  const listed = withDegraded(degraded, 'interrupt');
  const reason = listed?.reason || interrupt?.degraded?.reason;
  if (reason || interrupt?.loadPct == null || !interrupt?.sentence) {
    return <Degraded reason={reason || 'Interrupt not computable yet'} />;
  }

  const segments = interrupt.segments || { planned: 0, reserved: 0, overflow: 0 };
  const planned = segments.planned || 0;
  const reserved = segments.reserved || 0;
  const overflow = segments.overflow || 0;

  const label =
    `Planned ${planned}%, interrupt within budget ${reserved}%, overflow ${overflow}%`;

  return (
    <Instrument
      rank="instrument"
      label="Interrupt budget"
      tone={interrupt.overflow ? 'danger' : 'neutral'}
      title="Unplanned Pit accepts this week versus work already In Progress. 35% is reserved for surprises. Open What is this? if that sentence is opaque."
    >
      <div className="pulse-ring-wrap">
        <div className="pulse-ring">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="pulse-ring-svg"
            role="img"
            aria-label={label}
          >
            {/* Rotated so the 3/4 sweep opens at the bottom. */}
            <g transform={`rotate(135 ${SIZE / 2} ${SIZE / 2})`}>
              <circle
                className="pulse-ring-track"
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${TRACK} ${CIRC}`}
              />
              <Arc className="pulse-ring-planned" from={0} to={planned} />
              <Arc className="pulse-ring-reserved" from={planned} to={planned + reserved} />
              <Arc
                className="pulse-ring-overflow"
                from={planned + reserved}
                to={planned + reserved + overflow}
              />
            </g>
          </svg>
          <div className="pulse-ring-centre">
            <strong>{interrupt.loadPct}%</strong>
            <span>interrupt</span>
          </div>
        </div>
        <div className="pulse-ring-read">
          <p>{interrupt.sentence}</p>
          <span className="pulse-inst-evidence">
            {interrupt.interruptCount} Pit accepts · {interrupt.committedCount} committed In Progress
            {' · '}
            {interrupt.windowName || `last ${interrupt.windowDays} days`}
          </span>
        </div>
      </div>
    </Instrument>
  );
}
