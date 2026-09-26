import React from 'react';

/**
 * The three visual ranks every Pulse surface is built from.
 *
 *   headline   - the one sentence that is the product. One per surface.
 *   instrument - a measured thing: a ring, a band, a count. Always paired with
 *                its number in words, because the sentence is the product and
 *                the ring is decoration.
 *   footnote   - evidence IDs, counts, and "we cannot compute this" reasons.
 *                Quiet on purpose; it must never compete with a real number.
 *
 * Before this, all three rendered as the same grey box, so a headline metric and
 * a degraded-data apology carried identical weight.
 */
export function Instrument({
  rank = 'instrument',
  tone = 'neutral',
  label,
  children,
  evidence,
  title
}) {
  const classes = [
    'pulse-inst',
    `pulse-inst-${rank}`,
    tone !== 'neutral' ? `pulse-tone-${tone}` : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} title={title}>
      {label ? <h4 className="pulse-inst-label">{label}</h4> : null}
      <div className="pulse-inst-body">{children}</div>
      {evidence && evidence.length ? <div className="pulse-inst-evidence">{evidence}</div> : null}
    </section>
  );
}

/**
 * "Not computable here" — never a zero, and never the same weight as a number.
 * Pulse's strongest rule is that a missing measurement is stated, not faked.
 */
export function Degraded({ reason, children }) {
  return (
    <p className="pulse-inst pulse-inst-footnote pulse-degraded-note">
      <span className="pulse-degraded-mark" aria-hidden="true" />
      <span>{reason || children}</span>
    </p>
  );
}

/**
 * Renders whichever degraded entry matches this metric, or the instrument.
 * Replaces the hardcoded blacklist that used to filter degraded rows by name.
 */
export function withDegraded(degraded, metric) {
  return (degraded || []).find((entry) => entry && entry.metric === metric) || null;
}
