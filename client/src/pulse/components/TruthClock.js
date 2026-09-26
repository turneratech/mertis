import React from 'react';

const formatAge = (ageHours) => {
  if (ageHours == null) return null;
  if (ageHours < 1) return `${Math.max(1, Math.round(ageHours * 60))}m`;
  if (ageHours < 48) return `${ageHours.toFixed(1)}h`;
  return `${(ageHours / 24).toFixed(1)}d`;
};

export function TruthClock({ truthClock }) {
  if (!truthClock || !truthClock.hasActivity) {
    return <span className="pulse-clock muted">no activity</span>;
  }
  return <span className="pulse-clock">{formatAge(truthClock.ageHours)}</span>;
}
