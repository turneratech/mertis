const { stationForStatus } = require('../utils/pulseTransition');

const ACTIVE_STATIONS = ['dev_queue', 'dev', 'qa', 'qa_testing'];
const BUG_STATUSES = new Set(['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened']);
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;

const emptyStation = () => ({
  medianMs: null,
  p85Ms: null,
  medianHours: null,
  p85Hours: null,
  p85MedianRatio: null,
  currentCount: 0,
  sampleCount: 0
});

const toMs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? NaN : ms;
};

const toIso = (ms) => new Date(ms).toISOString();

const transitionFields = (row) => ({
  from: row.from ?? row.fromStatus ?? row.Temp1 ?? null,
  to: row.to ?? row.toStatus ?? row.Temp2 ?? null,
  station: row.station ?? row.Temp3 ?? null
});

const isStructuredStatusChange = (row) => {
  if (!row || row.action !== 'status_change') return false;
  const { to, station } = transitionFields(row);
  return Boolean(to || station);
};

const dedupeKey = (bugId, row) => {
  const { to } = transitionFields(row);
  const ts = toMs(row.timestamp || row.created_at);
  return `${bugId}|${row.action}|${ts}|${to || ''}`;
};

const structuredChanges = (bug) => {
  const log = Array.isArray(bug.activityLog) ? bug.activityLog : [];
  const seen = new Set();
  const rows = [];
  for (const row of log) {
    if (!isStructuredStatusChange(row)) continue;
    const key = dedupeKey(bug.bugId, row);
    if (seen.has(key)) continue;
    seen.add(key);
    const ts = toMs(row.timestamp || row.created_at);
    if (Number.isNaN(ts)) continue;
    rows.push({ ...transitionFields(row), timestamp: ts, raw: row });
  }
  rows.sort((a, b) => a.timestamp - b.timestamp);
  return rows;
};

const hasLegacyOnlyHistory = (bug) => {
  const log = Array.isArray(bug.activityLog) ? bug.activityLog : [];
  const anyStructured = log.some(isStructuredStatusChange);
  const anyUpdated = log.some((row) => row && row.action === 'updated');
  return !anyStructured && anyUpdated;
};

const percentile = (sorted, p) => {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

const currentStation = (bug) => {
  const status = bug.status;
  const qa = bug.qaStatus || bug.qa_status || 'Not Started';
  if (status === 'Resolved' && qa === 'Testing') return 'qa_testing';
  return stationForStatus(status);
};

const uniqueCommits = (bugs, botUsers = []) => {
  const bots = new Set((botUsers || []).map((u) => String(u).toLowerCase()));
  const seen = new Set();
  const commits = [];
  for (const bug of bugs || []) {
    const log = Array.isArray(bug.activityLog) ? bug.activityLog : [];
    for (const row of log) {
      if (!row || row.action !== 'commit') continue;
      const user = String(row.user || '').toLowerCase();
      if (user && bots.has(user)) continue;
      const ts = toMs(row.timestamp || row.created_at);
      if (Number.isNaN(ts)) continue;
      const key = `${bug.bugId}|commit|${ts}|${row.message || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      commits.push({ bugId: bug.bugId, timestamp: ts });
    }
  }
  return commits;
};

const firstResolvedMs = (bug) => {
  const hit = structuredChanges(bug).find((row) => row.to === 'Resolved');
  return hit ? hit.timestamp : NaN;
};

const computeFixVerifyGap = (bugs, opts = {}) => {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const lookbackMs = opts.lookbackMs != null ? opts.lookbackMs : THIRTY_DAYS_MS;
  const bots = opts.botUsers || [];
  const inWindow = (row) => !Number.isNaN(row.timestamp) && nowMs - row.timestamp <= lookbackMs;
  const recent = uniqueCommits(bugs, bots).filter(inWindow);
  if (!recent.length) {
    return {
      count: null,
      medianMs: null,
      evidence: [],
      sentence: null,
      reason: 'no commit data',
      degraded: { metric: 'fixVerifyGap', reason: 'no commit data' }
    };
  }

  const evidence = [];
  const gaps = [];
  for (const bug of bugs || []) {
    const mine = uniqueCommits([bug], bots).filter(inWindow);
    if (!mine.length) continue;
    const firstCommit = Math.min(...mine.map((row) => row.timestamp));
    const resolved = firstResolvedMs(bug);
    if (!Number.isNaN(resolved) && resolved > firstCommit) {
      gaps.push(resolved - firstCommit);
    }
    const qa = bug.qaStatus || bug.qa_status || 'Not Started';
    if (qa === 'Not Started' && (bug.status === 'In Progress' || bug.status === 'Resolved')) {
      evidence.push(bug.bugId);
    }
  }

  const sorted = gaps.slice().sort((a, b) => a - b);
  const medianMs = percentile(sorted, 0.5);
  const count = evidence.length;
  const sentence = count === 0
    ? 'No fix–verify gap — commits are being verified.'
    : medianMs != null
      ? `${count} waiting on QA after a commit. Median commit to Resolved is ${(medianMs / 3600000).toFixed(1)}h.`
      : `${count} waiting on QA after a commit.`;

  return {
    count,
    medianMs,
    evidence,
    sentence,
    reason: null,
    degraded: null
  };
};

const splitQaOverlay = (intervals, qaEvents) => {
  if (!qaEvents.length) return intervals;
  const out = [];
  for (const interval of intervals) {
    if (interval.station !== 'qa') {
      out.push(interval);
      continue;
    }
    const inside = qaEvents.filter((ev) => ev.timestamp > interval.fromMs && ev.timestamp < interval.toMs);
    if (!inside.length) {
      out.push(interval);
      continue;
    }
    let cursor = interval.fromMs;
    let station = 'qa';
    for (const ev of inside) {
      if (ev.timestamp > cursor) {
        out.push({ station, fromMs: cursor, toMs: ev.timestamp });
      }
      station = ev.to === 'Testing' ? 'qa_testing' : 'qa';
      cursor = ev.timestamp;
    }
    if (interval.toMs > cursor) {
      out.push({ station, fromMs: cursor, toMs: interval.toMs });
    }
  }
  return out;
};

const reconstructBug = (bug, nowMs) => {
  const createdMs = toMs(bug.created || bug.created_at) || nowMs;
  const changes = structuredChanges(bug);
  const statusChanges = changes.filter((row) => BUG_STATUSES.has(row.to));
  const qaEvents = changes.filter((row) => row.station === 'qa_testing' || !BUG_STATUSES.has(row.to));

  if (hasLegacyOnlyHistory(bug) && statusChanges.length === 0) {
    return {
      bugId: bug.bugId,
      included: false,
      reason: 'insufficient history',
      intervals: [],
      dwellMs: {},
      reopenGravity: 0,
      currentStation: currentStation(bug)
    };
  }

  if (statusChanges.length < 2) {
    return {
      bugId: bug.bugId,
      included: false,
      reason: statusChanges.length === 0 ? 'no activity' : 'fewer than two transitions',
      intervals: [],
      dwellMs: {},
      reopenGravity: statusChanges.filter((row) => row.to === 'Reopened').length,
      currentStation: currentStation(bug)
    };
  }

  const firstFrom = statusChanges[0].from && BUG_STATUSES.has(statusChanges[0].from)
    ? statusChanges[0].from
    : 'Open';
  let cursorMs = createdMs;
  let cursorStatus = firstFrom;
  const statusIntervals = [];
  for (const row of statusChanges) {
    statusIntervals.push({
      station: stationForStatus(cursorStatus),
      fromMs: cursorMs,
      toMs: row.timestamp
    });
    cursorStatus = row.to;
    cursorMs = row.timestamp;
  }
  statusIntervals.push({
    station: stationForStatus(cursorStatus),
    fromMs: cursorMs,
    toMs: nowMs
  });

  const intervals = splitQaOverlay(statusIntervals, qaEvents)
    .filter((interval) => interval.toMs > interval.fromMs)
    .map((interval) => ({
      station: interval.station,
      from: toIso(interval.fromMs),
      to: toIso(interval.toMs),
      ms: interval.toMs - interval.fromMs
    }));

  const dwellMs = {};
  for (const station of [...ACTIVE_STATIONS, 'closed']) dwellMs[station] = 0;
  for (const interval of intervals) {
    dwellMs[interval.station] = (dwellMs[interval.station] || 0) + interval.ms;
  }

  return {
    bugId: bug.bugId,
    included: true,
    reason: null,
    intervals,
    dwellMs,
    reopenGravity: statusChanges.filter((row) => row.to === 'Reopened').length,
    currentStation: currentStation(bug)
  };
};

const hours = (ms) => (ms == null ? null : ms / 3600000);

const computeProjectLine = (bugs, opts = {}) => {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const lookbackMs = opts.lookbackMs != null ? opts.lookbackMs : THIRTY_DAYS_MS;
  // opts.reconstruct lets the engine hand us a memoized reconstructBug so /board
  // does not replay every activity log once per metric. Defaults to the raw one.
  const reconstruct = opts.reconstruct || ((bug) => reconstructBug(bug, nowMs));
  const reconstructed = (bugs || []).map((bug) => reconstruct(bug));

  const samples = {};
  const currentCount = {};
  for (const station of ACTIVE_STATIONS) {
    samples[station] = [];
    currentCount[station] = 0;
  }

  let insufficientHistoryCount = 0;
  let includedBugCount = 0;
  for (const item of reconstructed) {
    if (item.reason === 'insufficient history') insufficientHistoryCount += 1;
    if (ACTIVE_STATIONS.includes(item.currentStation)) {
      currentCount[item.currentStation] += 1;
    }
    if (!item.included) continue;
    includedBugCount += 1;
    for (const station of ACTIVE_STATIONS) {
      const ms = item.dwellMs[station] || 0;
      if (ms > 0) samples[station].push(ms);
    }
  }

  const stations = {};
  let bottleneck = null;
  for (const station of ACTIVE_STATIONS) {
    const sorted = samples[station].slice().sort((a, b) => a - b);
    const medianMs = percentile(sorted, 0.5);
    const p85Ms = percentile(sorted, 0.85);
    const count = currentCount[station];
    const ratio = medianMs ? p85Ms / medianMs : null;
    stations[station] = {
      medianMs,
      p85Ms,
      medianHours: hours(medianMs),
      p85Hours: hours(p85Ms),
      p85MedianRatio: ratio,
      currentCount: count,
      sampleCount: sorted.length
    };
    if (medianMs != null && count > 0) {
      const score = medianMs * count;
      if (!bottleneck || score > bottleneck.score) {
        bottleneck = { station, score, medianMs, currentCount: count };
      }
    }
  }

  const degraded = [];
  if (insufficientHistoryCount > 0) {
    degraded.push({
      metric: 'line',
      reason: 'insufficient history',
      count: insufficientHistoryCount
    });
  }

  const fixVerifyGap = computeFixVerifyGap(bugs, {
    nowMs,
    lookbackMs,
    botUsers: opts.botUsers || []
  });
  if (fixVerifyGap.degraded) degraded.push(fixVerifyGap.degraded);

  return {
    reconstructed,
    stations,
    bottleneck,
    fixVerifyGap,
    insufficientHistoryCount,
    includedBugCount,
    degraded
  };
};

module.exports = {
  ACTIVE_STATIONS,
  // Exported so Replay dedupes transitions exactly as The Line does. bug_activity
  // has no unique constraint and the GitHub webhook can replay rows, so a second
  // implementation would double-count.
  structuredChanges,
  computeProjectLine,
  computeFixVerifyGap,
  reconstructBug,
  currentStation,
  isStructuredStatusChange,
  uniqueCommits
};
