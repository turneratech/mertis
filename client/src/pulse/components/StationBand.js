import React from 'react';
import { LINE_STATIONS, STATION_LABELS } from '../constants';

export function formatDwell(ms) {
  if (ms == null) return null;
  const hours = ms / 3600000;
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  if (hours >= 1) return `${Math.round(hours)}h`;
  const minutes = Math.max(1, Math.round(hours * 60));
  return `${minutes}m`;
}

export function StationBand({ stations, bottleneck }) {
  const max = Math.max(0, ...LINE_STATIONS.map((key) => stations?.[key]?.medianMs || 0));

  return (
    <div className="pulse-line-bands" aria-label="Station dwell">
      {LINE_STATIONS.map((key) => {
        const station = stations?.[key] || {};
        const median = formatDwell(station.medianMs);
        const flex = max > 0 && station.medianMs ? Math.max(0.12, station.medianMs / max) : 0.12;
        const noisy = station.p85MedianRatio != null && station.p85MedianRatio >= 2;
        const title = median
          ? `Median ${median}` + (station.p85Ms != null ? `, p85 ${formatDwell(station.p85Ms)}` : '')
            + (noisy ? ' — p85 is much larger than median (process noise)' : '')
          : 'No dwell yet';
        return (
          <div
            key={key}
            className={`pulse-line-band${bottleneck?.station === key ? ' bottleneck' : ''}`}
            style={{ flex }}
            title={title}
          >
            <span>{STATION_LABELS[key]}</span>
            <strong>{median || 'no dwell'}</strong>
            <em>{station.currentCount || 0}</em>
          </div>
        );
      })}
    </div>
  );
}
