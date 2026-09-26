// M22 — Replay.
//
// Scrub the board back in time. "What did this project look like three weeks
// ago, and what changed?" currently costs someone an afternoon of reading
// history; here it is a projection over data Pulse already stores.
//
// This is NOT an event store. `line.js` already replays one bug's intervals from
// structured `status_change` rows; replaying the whole board at an instant is
// that same walk, widened. No new table.
//
// HONESTY RULES THIS PACKET LIVES BY
//
// 1. Structured transitions only exist from the day The Line shipped. Asking for
//    a date before that must return the BOUNDARY, not an empty board — an empty
//    board would say "nothing was happening", which is a lie about the past and
//    the worst possible failure for a feature whose whole value is historical
//    fidelity. The boundary is derived from the data, not hardcoded.
//
// 2. Bugs with no structured history are excluded AND counted, never silently
//    dropped.
//
// 3. This replays STATUS only. Title, assignee and severity are not versioned
//    anywhere, so the UI must not imply a full time machine.

const { structuredChanges } = require('./line');
const { STATUSES } = require('./projections');

const BUG_STATUSES = new Set(STATUSES);

const toMs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? NaN : ms;
};

const createdMs = (bug) => toMs(bug.created || bug.created_at);

/**
 * Earliest structured transition anywhere in this set. Before this instant we
 * have no reliable record, so we refuse rather than guess.
 */
const historyBoundary = (bugs) => {
  let earliest = NaN;
  for (const bug of bugs || []) {
    for (const row of structuredChanges(bug)) {
      if (!Number.isNaN(row.timestamp) && (Number.isNaN(earliest) || row.timestamp < earliest)) {
        earliest = row.timestamp;
      }
    }
  }
  return earliest;
};

/**
 * The status this bug was in at `atMs`.
 * Returns null when the bug did not exist yet.
 */
const statusAt = (bug, atMs) => {
  const born = createdMs(bug);
  if (!Number.isNaN(born) && born > atMs) return null; // did not exist yet

  const changes = structuredChanges(bug).filter((row) => BUG_STATUSES.has(row.to));
  if (!changes.length) return null; // no structured history — counted by the caller

  let status = null;
  for (const row of changes) {
    if (row.timestamp <= atMs) status = row.to;
    else break;
  }
  if (status) return status;

  // Before its first recorded transition, the bug sat in whatever that
  // transition moved it out of.
  const first = changes[0];
  return first.from && BUG_STATUSES.has(first.from) ? first.from : 'Open';
};

/**
 * The board as it stood at `atMs`.
 */
const replayBoard = (bugs, atMs, opts = {}) => {
  const list = Array.isArray(bugs) ? bugs : [];
  const boundary = opts.boundary != null ? opts.boundary : historyBoundary(list);

  if (Number.isNaN(boundary)) {
    return {
      at: new Date(atMs).toISOString(),
      columns: {},
      counts: {},
      total: 0,
      notYetCreated: 0,
      withoutHistory: list.length,
      boundary: null,
      degraded: {
        metric: 'replay',
        reason: 'no structured history on this project yet — nothing to replay'
      }
    };
  }

  if (atMs < boundary) {
    const iso = new Date(boundary).toISOString();
    return {
      at: new Date(atMs).toISOString(),
      columns: {},
      counts: {},
      total: 0,
      notYetCreated: 0,
      withoutHistory: 0,
      boundary: iso,
      degraded: {
        metric: 'replay',
        reason: `replay starts ${iso.slice(0, 10)} — earlier history is unstructured`
      }
    };
  }

  const columns = {};
  for (const status of STATUSES) columns[status] = [];

  let notYetCreated = 0;
  let withoutHistory = 0;

  for (const bug of list) {
    const born = createdMs(bug);
    if (!Number.isNaN(born) && born > atMs) {
      notYetCreated += 1;
      continue;
    }
    const status = statusAt(bug, atMs);
    if (!status) {
      withoutHistory += 1;
      continue;
    }
    const bucket = columns[status] ? status : 'Open';
    columns[bucket].push({
      bugId: bug.bugId,
      title: bug.title,
      severity: bug.severity,
      bugType: bug.bugType || 'Bug',
      module: bug.module || null,
      projectKey: bug.projectKey,
      status: bucket
    });
  }

  const counts = {};
  let total = 0;
  for (const status of STATUSES) {
    counts[status] = columns[status].length;
    total += counts[status];
  }

  return {
    at: new Date(atMs).toISOString(),
    columns,
    counts,
    total,
    notYetCreated,
    withoutHistory,
    boundary: new Date(boundary).toISOString(),
    degraded: withoutHistory
      ? {
          metric: 'replay',
          reason: `${withoutHistory} bug${withoutHistory === 1 ? '' : 's'} have no structured history and are not shown`,
          count: withoutHistory
        }
      : null
  };
};

/**
 * What changed between two instants. Pure arithmetic over the same transitions.
 *
 * Deliberately does NOT include a QA-dwell delta. Comparing dwell across two
 * windows needs enough completed samples in each to be meaningful, and on a
 * short window it would report noise as a trend.
 */
const changeSummary = (bugs, fromMs, toMs_, opts = {}) => {
  const list = Array.isArray(bugs) ? bugs : [];
  const before = opts.before || replayBoard(list, fromMs);
  const after = opts.after || replayBoard(list, toMs_);

  let landed = 0;
  let reopened = 0;
  let arrived = 0;

  for (const bug of list) {
    const born = createdMs(bug);
    if (!Number.isNaN(born) && born > fromMs && born <= toMs_) arrived += 1;
    for (const row of structuredChanges(bug)) {
      if (row.timestamp <= fromMs || row.timestamp > toMs_) continue;
      if (row.to === 'Closed') landed += 1;
      if (row.to === 'Reopened') reopened += 1;
    }
  }

  const openOf = (board) =>
    STATUSES.filter((s) => s !== 'Closed').reduce((sum, s) => sum + (board.counts[s] || 0), 0);

  const openBefore = openOf(before);
  const openAfter = openOf(after);

  const parts = [];
  if (landed) parts.push(`${landed} landed`);
  if (reopened) parts.push(`${reopened} reopened`);
  if (arrived) parts.push(`${arrived} arrived`);
  const net = openAfter - openBefore;
  parts.push(`${net === 0 ? 'no net change' : `${net > 0 ? '+' : ''}${net}`} open`);

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs_).toISOString(),
    landed,
    reopened,
    arrived,
    openBefore,
    openAfter,
    netOpen: net,
    sentence: `Since ${new Date(fromMs).toISOString().slice(0, 10)}: ${parts.join(', ')}.`
  };
};

module.exports = { replayBoard, changeSummary, statusAt, historyBoundary };
