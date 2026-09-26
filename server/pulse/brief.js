const { computeQualityTax } = require('./qualityTax');
const { computeInterrupt } = require('./interrupt');
const { computeProjectLine } = require('./line');
const { computeEscaped } = require('./escaped');
const { computeGravity } = require('./gravity');
const { isTriaged } = require('./projections');

const STATION_LABEL = {
  dev_queue: 'Dev queue',
  dev: 'Dev',
  qa: 'QA',
  qa_testing: 'QA testing'
};

const cap = (ids) => (ids || []).filter(Boolean).slice(0, 8);

const formatDwell = (ms) => {
  if (ms == null) return null;
  const hours = ms / 3600000;
  if (hours >= 24) return `${(hours / 24).toFixed(1)}d`;
  if (hours >= 1) return `${Math.round(hours)}h`;
  return `${Math.max(1, Math.round(hours * 60))}m`;
};

const oldestPitBug = (bugs) => {
  const pit = (bugs || []).filter((bug) => !isTriaged(bug) && bug.status !== 'Closed');
  pit.sort((a, b) => {
    const aMs = new Date(a.created || a.created_at || 0).getTime();
    const bMs = new Date(b.created || b.created_at || 0).getTime();
    return aMs - bMs;
  });
  return pit[0] || null;
};

const computeBrief = (bugs, opts = {}) => {
  const triaged = (bugs || []).filter(isTriaged);
  const tax = computeQualityTax(triaged);
  const interrupt = computeInterrupt(bugs, opts);
  const line = computeProjectLine(bugs, opts);
  const pit = oldestPitBug(bugs);
  const degraded = [];
  if (tax.degraded) degraded.push(tax.degraded);
  if (interrupt.degraded) degraded.push(interrupt.degraded);
  for (const entry of line.degraded || []) {
    if (entry.metric === 'line') degraded.push(entry);
  }

  const mixIds = cap(triaged.map((bug) => bug.bugId));
  const mix = {
    id: 'mix',
    text: tax.sentence || tax.degraded.reason,
    evidence: tax.sentence ? mixIds : [],
    degraded: tax.degraded ? tax.degraded.reason : null
  };

  let bottleneck;
  if (line.bottleneck && line.bottleneck.medianMs != null) {
    const label = STATION_LABEL[line.bottleneck.station] || line.bottleneck.station;
    const dwell = formatDwell(line.bottleneck.medianMs);
    bottleneck = {
      id: 'bottleneck',
      text: `Queue is at ${label} — median ${dwell} × ${line.bottleneck.currentCount} in station.`,
      evidence: cap(line.reconstructed
        .filter((row) => row.currentStation === line.bottleneck.station)
        .map((row) => row.bugId)),
      degraded: null
    };
  } else {
    const reason = line.insufficientHistoryCount > 0
      ? 'insufficient history'
      : 'no dwell yet';
    bottleneck = {
      id: 'bottleneck',
      text: `Queue location unavailable — ${reason}.`,
      evidence: [],
      degraded: reason
    };
  }

  const interruptClause = {
    id: 'interrupt',
    text: interrupt.sentence || interrupt.degraded.reason,
    evidence: interrupt.sentence ? cap(interrupt.interruptIds) : [],
    degraded: interrupt.degraded ? interrupt.degraded.reason : null
  };

  const pitClause = {
    id: 'pit',
    text: pit ? `Oldest Pit item is ${pit.bugId}.` : 'The Pit is empty.',
    evidence: pit ? [pit.bugId] : [],
    degraded: null
  };

  const headline = {
    id: 'headline',
    text: [mix.text, bottleneck.degraded ? null : bottleneck.text, interruptClause.text].filter(Boolean).join(' '),
    evidence: cap([...mix.evidence, ...bottleneck.evidence, ...interruptClause.evidence]),
    degraded: null
  };

  // Structured numbers behind the sentences. The Command Deck constellation needs
  // values, not prose, and parsing our own English back out would be exactly the
  // "English activityLog" mistake the spec forbids. Nothing new is computed that
  // the clauses above did not already require; escaped and gravity reuse the
  // caller's memoized reconstruction when one is supplied.
  //
  // These deliberately do NOT add to `degraded` — a constellation that cannot
  // place a node simply renders it neutral, and the clauses stay the contract.
  const escaped = computeEscaped(bugs);
  const gravity = computeGravity(bugs, opts);
  const open = (bugs || []).filter((bug) => bug && bug.status !== 'Closed');

  const metrics = {
    bugCount: (bugs || []).length,
    triagedCount: triaged.length,
    openCount: open.length,
    taxPct: tax.percent != null ? tax.percent : null,
    interruptPct: interrupt.loadPct != null ? interrupt.loadPct : null,
    interruptOverflow: Boolean(interrupt.overflow),
    bottleneckStation: line.bottleneck ? line.bottleneck.station : null,
    bottleneckMedianMs: line.bottleneck ? line.bottleneck.medianMs : null,
    escapedCount: escaped && escaped.count != null ? escaped.count : null,
    escapedCritical: escaped && escaped.criticalCount != null ? escaped.criticalCount : null,
    reopenTotal: Object.values(gravity.byBugId || {}).reduce((sum, n) => sum + (n || 0), 0)
  };

  return {
    clauses: [headline, mix, bottleneck, interruptClause, pitClause],
    oldestPit: pit ? { bugId: pit.bugId, title: pit.title || '' } : null,
    metrics,
    degraded
  };
};

module.exports = { computeBrief };
