import React from 'react';
import { Instrument, Degraded } from './Instrument';

const DAY = 86400000;

const label = (ms) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' });

/**
 * The time scrubber.
 *
 * Dragging it rewinds the board. While rewound the board is READ-ONLY: dropping
 * a card would write a status change computed from a state that is no longer
 * true. The bar says so rather than letting someone find out.
 */
export function ReplayBar({ earliest, at, now, onChange, onReset, change, degraded, busy }) {
  if (!earliest) return null;

  const min = new Date(earliest).getTime();
  const max = new Date(now).getTime();
  const value = at ? new Date(at).getTime() : max;
  if (Number.isNaN(min) || Number.isNaN(max) || max <= min) return null;

  const live = value >= max - 60000;
  const daysBack = Math.max(0, Math.round((max - value) / DAY));

  return (
    <div className={`pulse-replay${live ? '' : ' rewound'}`}>
      <div className="pulse-replay-controls">
        <label className="pulse-replay-label" htmlFor="pulse-replay-range">
          {live ? 'Now' : `${daysBack} day${daysBack === 1 ? '' : 's'} ago · ${label(value)}`}
        </label>
        <input
          id="pulse-replay-range"
          type="range"
          min={min}
          max={max}
          step={DAY}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Rewind the board"
          data-tip="Drag to rewind the board and see how it looked then"
        />
        {!live ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReset} data-tip="Return to the live board and re-enable dragging">
            Back to now
          </button>
        ) : null}
      </div>

      <p className="pulse-replay-range-note">
        History starts {label(min)}
        {busy ? ' · loading…' : ''}
      </p>

      {!live ? (
        <Instrument rank="instrument" label="Read-only" tone="warn">
          You are looking at the past. Cards cannot be moved until you return to now.
          {change?.sentence ? <span className="pulse-replay-change">{change.sentence}</span> : null}
        </Instrument>
      ) : null}

      {degraded ? <Degraded reason={degraded.reason} /> : null}
    </div>
  );
}
