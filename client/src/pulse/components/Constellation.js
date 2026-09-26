import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * The Command Deck constellation.
 *
 * Four channels, all from numbers the brief already computed:
 *
 *   size      = open volume          (how much work is in flight)
 *   colour    = quality tax          (green build -> red firefight)
 *   altitude  = escaped to Production(higher = defects reached customers)
 *   halo      = Andon                (escaped, or interrupt over budget)
 *
 * Hand-rolled SVG on purpose: it has to ship inside a self-hosted bundle, so no
 * 3D engine and no second charting library. It also has to paste into a slide
 * with zero editing, which is why the legend is inside the picture.
 */

const W = 1000;
const H = 320;
const PAD_X = 104;   // room for the altitude labels at the left edge
const PAD_TOP = 40;
const PAD_BOTTOM = 74;  // keys sit clear of a node resting on the ground line

// Quality tax -> colour. Uses the Pulse token palette, sampled at three stops.
function taxColour(pct) {
  if (pct == null) return 'var(--p-text-mute)';
  if (pct >= 75) return 'var(--p-danger)';
  if (pct >= 45) return 'var(--p-warn)';
  return 'var(--p-acc)';
}

function radius(openCount, maxOpen) {
  const min = 9;
  const max = 26;
  if (!maxOpen) return min;
  // sqrt so area, not radius, tracks volume
  return min + (max - min) * Math.sqrt(Math.min(openCount, maxOpen) / maxOpen);
}

export function Constellation({ rows }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(null);

  const nodes = useMemo(() => {
    const list = (rows || []).filter(Boolean);
    if (!list.length) return [];

    const maxOpen = Math.max(...list.map((r) => r.metrics?.openCount || 0), 1);
    const maxEscaped = Math.max(...list.map((r) => r.metrics?.escapedCount || 0), 1);

    const usableW = W - PAD_X * 2;
    const usableH = H - PAD_TOP - PAD_BOTTOM;
    const step = list.length > 1 ? usableW / (list.length - 1) : 0;

    return list.map((row, i) => {
      const m = row.metrics || {};
      const escaped = m.escapedCount;
      // Altitude: unknown escaped sits on the baseline rather than inventing a height.
      const lift = escaped == null ? 0 : Math.min(escaped, maxEscaped) / maxEscaped;
      const cx = list.length > 1 ? PAD_X + step * i : W / 2;
      const cy = PAD_TOP + usableH * (1 - lift);
      return {
        key: row.projectKey,
        name: row.projectName || row.projectKey,
        cx,
        cy,
        r: radius(m.openCount || 0, maxOpen),
        colour: taxColour(m.taxPct),
        taxPct: m.taxPct,
        openCount: m.openCount || 0,
        escaped,
        andon: (escaped != null && escaped > 0) || m.interruptOverflow,
        stop: escaped != null && escaped > 0,
        unknownAltitude: escaped == null
      };
    });
  }, [rows]);

  if (!nodes.length) return null;

  const baselineY = H - PAD_BOTTOM;

  return (
    <figure className="pulse-constellation">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projects by open volume, quality tax and escaped defects">
        {/* Altitude axis */}
        <line className="pulse-con-axis" x1={PAD_X - 40} y1={PAD_TOP} x2={PAD_X - 40} y2={baselineY} />
        <text className="pulse-con-axis-label" x={PAD_X - 48} y={PAD_TOP + 4} textAnchor="end">escaped</text>
        <text className="pulse-con-axis-label" x={PAD_X - 48} y={baselineY} textAnchor="end">none</text>

        {/* Ground line — "nothing reached Production" */}
        <line className="pulse-con-ground" x1={PAD_X - 40} y1={baselineY} x2={W - PAD_X + 40} y2={baselineY} />

        {nodes.map((n) => (
          <g
            key={n.key}
            className={`pulse-con-node${hover === n.key ? ' on' : ''}`}
            tabIndex={0}
            role="button"
            aria-label={`${n.name}: ${n.openCount} open, ${n.taxPct == null ? 'quality tax not computable' : `${n.taxPct}% firefighting`}, ${n.escaped == null ? 'escaped not computable' : `${n.escaped} escaped`}`}
            onClick={() => navigate(`/pulse/${n.key}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/pulse/${n.key}`);
              }
            }}
            onMouseEnter={() => setHover(n.key)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(n.key)}
            onBlur={() => setHover(null)}
          >
            {/* Tether to the ground so altitude is readable, not just implied */}
            <line className="pulse-con-tether" x1={n.cx} y1={n.cy} x2={n.cx} y2={baselineY} />
            {n.andon ? (
              <circle
                className={`pulse-con-halo${n.stop ? ' stop' : ' watch'}`}
                cx={n.cx}
                cy={n.cy}
                r={n.r + 7}
              />
            ) : null}
            <circle
              className="pulse-con-body"
              cx={n.cx}
              cy={n.cy}
              r={n.r}
              style={{ fill: n.colour }}
            />
            {n.r >= 15 ? (
              <text className="pulse-con-count" x={n.cx} y={n.cy + 5} textAnchor="middle">
                {n.openCount}
              </text>
            ) : null}
            <text className="pulse-con-key" x={n.cx} y={baselineY + 34} textAnchor="middle">
              {n.key}
            </text>
            {n.unknownAltitude ? (
              <text className="pulse-con-unknown" x={n.cx} y={baselineY + 50} textAnchor="middle">
                escaped n/a
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      <figcaption className="pulse-con-legend">
        <span><i className="pulse-con-swatch" style={{ background: 'var(--p-acc)' }} /> building</span>
        <span><i className="pulse-con-swatch" style={{ background: 'var(--p-warn)' }} /> mixed</span>
        <span><i className="pulse-con-swatch" style={{ background: 'var(--p-danger)' }} /> firefighting</span>
        <span className="pulse-con-legend-sep">size = open work · height = escaped to Production · ring = needs attention</span>
      </figcaption>
    </figure>
  );
}
