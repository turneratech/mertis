import React from 'react';
import { StationBand, formatDwell } from './components/StationBand';
import { Instrument, Degraded } from './components/Instrument';
import { COLUMN_STATION, STATION_LABELS } from './constants';

export function columnIsBottleneck(status, bottleneckStation) {
  if (!bottleneckStation) return false;
  if (COLUMN_STATION[status] === bottleneckStation) return true;
  return status === 'Resolved' && bottleneckStation === 'qa_testing';
}

export function dwellForColumn(status, stations) {
  const key = COLUMN_STATION[status];
  if (!key) return null;
  return stations?.[key] || null;
}

export function TheLine({ line }) {
  const data = line?.data;
  const degraded = (line?.meta?.degraded || []).filter((entry) => entry.metric === 'line');
  const stations = data?.stations || {};
  const bottleneck = data?.bottleneck;
  const label = bottleneck ? STATION_LABELS[bottleneck.station] || bottleneck.station : null;
  const median = bottleneck ? formatDwell(bottleneck.medianMs) : null;
  const gap = data?.fixVerifyGap;
  const gapDegraded = (line?.meta?.degraded || []).find((entry) => entry.metric === 'fixVerifyGap');

  // The bottleneck and the fix–verify gap used to render as two full-width amber
  // banners stacked above the board, which out-shouted the headline sentence.
  // They are instruments: measured, labelled, side by side, below the headline.
  return (
    <div className="pulse-line">
      <div className="pulse-inst-row">
        {bottleneck && median ? (
          <Instrument rank="instrument" label="Bottleneck" tone="warn">
            Queue is at {label} — median {median} × {bottleneck.currentCount} in station.
          </Instrument>
        ) : (
          <Instrument rank="instrument" label="Bottleneck">
            No bottleneck yet — needs dwell and work sitting in a station.
          </Instrument>
        )}
        {gapDegraded || gap?.reason ? (
          <Degraded reason={gapDegraded?.reason || gap.reason} />
        ) : gap?.sentence ? (
          <Instrument rank="instrument" label="Fix–verify gap" tone="warn">
            {gap.sentence}
          </Instrument>
        ) : null}
      </div>
      {degraded.map((entry) => (
        <Degraded key={`${entry.metric}-${entry.reason}`} reason={entry.reason} />
      ))}
      <StationBand stations={stations} bottleneck={bottleneck} />
    </div>
  );
}
