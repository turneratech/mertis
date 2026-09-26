const { isStructuredStatusChange } = require('./line');

const KNOWN_ENV = new Set(['Development', 'Staging', 'Production', 'Testing']);

const toMs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? NaN : ms;
};

const envOf = (bug) => String((bug && bug.environment) || '').trim();
const typeOf = (bug) => String((bug && (bug.bugType || bug.bug_type)) || '').trim();

const createdMs = (bug) => toMs(bug && (bug.created || bug.created_at));

const closeMs = (bug) => {
  let latest = toMs(bug && (bug.closedDate || bug.closed_at));
  const log = Array.isArray(bug && bug.activityLog) ? bug.activityLog : [];
  for (const row of log) {
    if (!isStructuredStatusChange(row)) continue;
    const to = row.to ?? row.toStatus ?? row.Temp2;
    if (to !== 'Closed') continue;
    const ts = toMs(row.timestamp || row.created_at);
    if (!Number.isNaN(ts) && (Number.isNaN(latest) || ts > latest)) latest = ts;
  }
  return latest;
};

const lastCloseMs = (bugs) => {
  let latest = NaN;
  for (const bug of bugs || []) {
    const ts = closeMs(bug);
    if (!Number.isNaN(ts) && (Number.isNaN(latest) || ts > latest)) latest = ts;
  }
  return latest;
};

const degrade = (reason, lastCloseAt = null) => ({
  count: null,
  criticalCount: null,
  evidence: [],
  sentence: null,
  lastCloseAt,
  reason,
  degraded: { metric: 'escaped', reason }
});

/**
 * Spec §12.8 / M10 — Production Bugs after the last close.
 * No pulse_drops until a customer has two named releases. Never invent 0.
 */
const computeEscaped = (bugs) => {
  const cut = lastCloseMs(bugs);
  if (Number.isNaN(cut)) return degrade('no close recorded');

  const lastCloseAt = new Date(cut).toISOString();
  const after = [];
  for (const bug of bugs || []) {
    const created = createdMs(bug);
    if (Number.isNaN(created) || created <= cut) continue;
    after.push(bug);
  }

  const untyped = after.some((bug) => !KNOWN_ENV.has(envOf(bug)));
  if (untyped) return degrade('untyped environment', lastCloseAt);

  const evidence = [];
  let criticalCount = 0;
  for (const bug of after) {
    if (envOf(bug) !== 'Production') continue;
    if (typeOf(bug) !== 'Bug') continue;
    evidence.push(bug.bugId);
    if (bug.severity === 'Critical') criticalCount += 1;
  }

  const count = evidence.length;
  const sentence = count === 0
    ? 'No escaped Production bugs since last close.'
    : `${count} escaped since last close${criticalCount ? ` (${criticalCount} Critical)` : ''}.`;

  return {
    count,
    criticalCount,
    evidence: evidence.slice(0, 8),
    sentence,
    lastCloseAt,
    reason: null,
    degraded: null
  };
};

module.exports = { computeEscaped, KNOWN_ENV };
