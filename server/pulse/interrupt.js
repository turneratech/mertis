const DEFAULT_INTERRUPT_BUDGET_PCT = 35;
const DAY_MS = 24 * 3600 * 1000;
const WINDOW_MS = 7 * DAY_MS;

const toMs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? NaN : ms;
};

const triagedAtMs = (bug) => toMs(bug && (bug.triagedAt || bug.triaged_at));

const resolveWindow = (opts = {}) => {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const start = opts.windowStart != null ? Number(opts.windowStart) : toMs(opts.from);
  const end = opts.windowEnd != null ? Number(opts.windowEnd) : toMs(opts.to);
  if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
    const name = opts.windowName != null ? String(opts.windowName).trim() : '';
    return {
      nowMs,
      windowStart: start,
      windowEnd: end,
      windowName: name || 'named window',
      windowDays: Math.max(1, Math.round((end - start) / DAY_MS))
    };
  }
  return {
    nowMs,
    windowStart: nowMs - WINDOW_MS,
    windowEnd: nowMs,
    windowName: null,
    windowDays: 7
  };
};

const interruptOptsFromQuery = (query = {}) => {
  const start = toMs(query.from);
  const end = toMs(query.to);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return {};
  const name = query.name == null ? '' : String(query.name).trim().slice(0, 80);
  return {
    windowStart: start,
    windowEnd: end,
    windowName: name || 'named window'
  };
};

const computeInterrupt = (bugs, opts = {}) => {
  const budgetPct = opts.budgetPct != null ? opts.budgetPct : DEFAULT_INTERRUPT_BUDGET_PCT;
  const window = resolveWindow(opts);
  const { windowStart, windowEnd, windowName, windowDays } = window;

  let interruptCount = 0;
  let committedCount = 0;
  const interruptIds = [];
  const committedIds = [];

  for (const bug of bugs || []) {
    const ts = triagedAtMs(bug);
    const acceptedThisWindow = !Number.isNaN(ts) && ts >= windowStart && ts <= windowEnd;
    if (acceptedThisWindow) {
      interruptCount += 1;
      if (bug.bugId) interruptIds.push(bug.bugId);
      continue;
    }
    if (bug.status === 'In Progress' && !Number.isNaN(ts) && ts < windowStart) {
      committedCount += 1;
      if (bug.bugId) committedIds.push(bug.bugId);
    }
  }

  const named = Boolean(windowName);
  if (named && interruptCount === 0) {
    return {
      loadPct: null,
      budgetPct,
      overflow: false,
      overflowPct: null,
      interruptCount: 0,
      committedCount,
      interruptIds: [],
      committedIds,
      windowDays,
      windowName,
      sentence: null,
      segments: { planned: 0, reserved: 0, overflow: 0 },
      degraded: {
        metric: 'interrupt',
        reason: 'no Pit accepts in this window'
      }
    };
  }

  const total = interruptCount + committedCount;
  if (total === 0) {
    return {
      loadPct: null,
      budgetPct,
      overflow: false,
      overflowPct: null,
      interruptCount: 0,
      committedCount: 0,
      interruptIds: [],
      committedIds: [],
      windowDays,
      windowName,
      sentence: null,
      segments: { planned: 0, reserved: 0, overflow: 0 },
      degraded: {
        metric: 'interrupt',
        reason: 'not enough committed work to measure interrupt'
      }
    };
  }

  const loadPct = Math.round((100 * interruptCount) / total);
  const overflowPct = Math.max(0, loadPct - budgetPct);
  const reservedPct = budgetPct;
  const plannedPct = 100 - reservedPct - overflowPct;
  const overflow = loadPct > budgetPct;
  const windowPhrase = windowName || `the last ${windowDays} days`;
  const sentence = overflow
    ? `Interrupt took ${loadPct}% of ${windowPhrase} against a ${budgetPct}% budget. The plan is over-committed.`
    : `Interrupt took ${loadPct}% of ${windowPhrase}; ${budgetPct}% is reserved for Pit arrivals.`;

  return {
    loadPct,
    budgetPct,
    overflow,
    overflowPct,
    interruptCount,
    committedCount,
    interruptIds,
    committedIds,
    windowDays,
    windowName,
    sentence,
    segments: {
      planned: plannedPct,
      reserved: reservedPct,
      overflow: overflowPct
    },
    degraded: null
  };
};

module.exports = {
  DEFAULT_INTERRUPT_BUDGET_PCT,
  WINDOW_MS,
  computeInterrupt,
  interruptOptsFromQuery,
  resolveWindow
};
