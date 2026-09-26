import React from 'react';
import { Instrument, Degraded } from './Instrument';

/**
 * The forecast, as a sentence with a band underneath.
 *
 * The sentence is the product; the band is decoration. The band shows P50 to
 * P85 as a filled span so the *width* of the uncertainty is visible at a glance
 * — a single date would imply a precision the data does not support.
 */
export function Landing({ row }) {
  if (!row) return null;

  if (row.degraded) {
    // Refusing is a feature. A confident wrong date would be worse than silence.
    return <Degraded reason={row.degraded.reason} />;
  }

  if (row.landed) {
    return (
      <Instrument rank="instrument" label="Landing" tone="ok">
        {row.sentence}
      </Instrument>
    );
  }

  if (!row.p50) return null;

  const driver = (row.drivers || [])[0];

  return (
    <Instrument rank="instrument" label="Landing" tone={driver ? 'warn' : 'neutral'}>
      {row.sentence}
      <div className="pulse-landing-band" aria-hidden="true">
        <span className="pulse-landing-p50" />
        <span className="pulse-landing-span" />
        <span className="pulse-landing-p85" />
      </div>
      <span className="pulse-landing-legend">
        <span><strong>{row.p50Label || row.p50}</strong> likely</span>
        <span><strong>{row.p85Label || row.p85}</strong> 85% confident</span>
      </span>
    </Instrument>
  );
}
