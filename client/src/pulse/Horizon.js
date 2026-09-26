import React, { useEffect, useState } from 'react';
import { fetchHorizon } from './pulseApi';
import { Degraded } from './components/Instrument';
import { SkeletonList } from './components/Skeleton';

const DAY = 86400000;

const fmt = (ms, withYear) =>
  new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: '2-digit' } : {})
  });

/**
 * Pick roughly 4-7 ticks on a round-ish interval. A timeline with no axis is a
 * picture of bars, not a plan — the old strip put its only dates in a `title`
 * attribute, which is invisible on touch and to screen readers.
 */
function buildTicks(fromMs, toMs) {
  const span = Math.max(toMs - fromMs, 1);
  const candidates = [DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY, 180 * DAY, 365 * DAY];
  const target = span / 5;
  const step = candidates.find((c) => c >= target) || candidates[candidates.length - 1];

  const ticks = [];
  const first = Math.ceil(fromMs / step) * step;
  for (let t = first; t <= toMs; t += step) {
    ticks.push({ ms: t, pct: ((t - fromMs) / span) * 100 });
  }
  const multiYear = new Date(fromMs).getFullYear() !== new Date(toMs).getFullYear();
  return { ticks, multiYear, span };
}

export function Horizon({ projectKey }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHorizon(projectKey)
      .then((data) => { setPayload(data); setError(''); })
      .catch((err) => setError(err.response?.data?.error || 'Could not load Horizon'));
  }, [projectKey]);

  if (error) return <div className="empty-state"><h3>{error}</h3></div>;
  if (!payload) return <SkeletonList rows={4} label="Loading Horizon" />;

  const bars = payload.data?.bars || [];
  const degraded = (payload.meta?.degraded || []).find((row) => row.metric === 'horizon');
  const longest = payload.data?.criticalPath;
  const range = payload.data?.range;

  const fromMs = range?.from ? new Date(range.from).getTime() : null;
  const toMs = range?.to ? new Date(range.to).getTime() : null;
  const hasAxis = fromMs != null && toMs != null && !Number.isNaN(fromMs) && !Number.isNaN(toMs);
  const { ticks, multiYear } = hasAxis ? buildTicks(fromMs, toMs) : { ticks: [], multiYear: false };

  const nowMs = Date.now();
  const nowPct = hasAxis && nowMs >= fromMs && nowMs <= toMs
    ? ((nowMs - fromMs) / Math.max(toMs - fromMs, 1)) * 100
    : null;

  const undated = bars.filter((bar) => bar.leftPct == null);
  const dated = bars.filter((bar) => bar.leftPct != null);

  return (
    <div className="pulse-horizon">
      <p className="pulse-lede">
        Manager question: which outcomes occupy the calendar, and which one has been open the longest?
        Each bar is a mission (a result you would defend in a review), not a ticket. The vertical line is today —
        the date you are making the call. Work with no mission stays off this chart: it is activity, not a commitment.
        {/* Not a critical path: there are no dependency edges, so the highlight is simply the longest open mission. */}
        {longest ? ` Longest open mission (capital still in play): ${longest.title}.` : ''}
      </p>
      {degraded ? <Degraded reason={degraded.reason} /> : null}

      {dated.length ? (
        <div className="pulse-horizon-chart">
          <div className="pulse-horizon-axis">
            <span className="pulse-horizon-axis-label" />
            <div className="pulse-horizon-axis-lane">
              {ticks.map((tick) => (
                <span key={tick.ms} className="pulse-horizon-tick" style={{ left: `${tick.pct}%` }}>
                  {fmt(tick.ms, multiYear)}
                </span>
              ))}
            </div>
          </div>

          <div className="pulse-horizon-track">
            {dated.map((bar) => (
              <div key={bar.missionId} className="pulse-horizon-row">
                <span className="pulse-horizon-name" title={bar.title}>{bar.title}</span>
                <div className="pulse-horizon-lane">
                  {ticks.map((tick) => (
                    <span key={tick.ms} className="pulse-horizon-grid" style={{ left: `${tick.pct}%` }} />
                  ))}
                  {nowPct != null ? (
                    <span className="pulse-horizon-now" style={{ left: `${nowPct}%` }} />
                  ) : null}
                  <div
                    className={`pulse-horizon-bar${longest && longest.missionId === bar.missionId ? ' on' : ''}`}
                    style={{ left: `${bar.leftPct}%`, width: `${Math.max(bar.widthPct, 2)}%` }}
                  >
                    <span className="pulse-horizon-dates">
                      {fmt(new Date(bar.start).getTime(), multiYear)} → {fmt(new Date(bar.end).getTime(), multiYear)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nowPct != null ? (
            <div className="pulse-horizon-axis">
              <span className="pulse-horizon-axis-label" />
              <div className="pulse-horizon-axis-lane">
                <span className="pulse-horizon-now-label" style={{ left: `${nowPct}%` }}>today</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {undated.length ? (
        <Degraded
          reason={`${undated.length} mission${undated.length === 1 ? '' : 's'} have no dates yet: ${undated.map((b) => b.title).join(', ')}`}
        />
      ) : null}

      {!bars.length && !degraded ? (
        <div className="empty-state">
          <h3>No outcomes on the calendar yet</h3>
          <p>Create a mission (an outcome you will own) and claim bugs into it. Horizon has nothing to plot until then.</p>
        </div>
      ) : null}
    </div>
  );
}
