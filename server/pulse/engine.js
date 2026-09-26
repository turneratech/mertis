// Pulse reconstruction engine.
//
// `reconstructBug` is the most expensive thing Pulse does and it used to run 2-3x
// per request: /board calls computeGravity (which reconstructs every bug) and
// computeProjectLine separately, and computeMissionMap reconstructs again per
// mission. Forecast and Replay need it many more times than that.
//
// Two layers here:
//
//   1. createReconstructor(nowMs) - a memoized reconstructBug. Keyed on the bug
//      OBJECT identity via a WeakMap, so it cannot go stale: a fresh read from
//      storage is a fresh object and misses the memo by construction. Within one
//      request the same bugs array is passed to every module, so they share work.
//
//   2. createCache() - a small TTL + fingerprint cache for whole-project results,
//      used by the Command Deck to avoid an unbounded N+1 across every project.
//      The fingerprint includes the storage type because DATABASE_PROVIDER=auto
//      can swap backends between restarts.
//
// Nothing here requires ../storage: the storage type is passed in, so these stay
// pure and unit-testable.

const { reconstructBug } = require('./line');

const DEFAULT_TTL_MS = 15000;

// WeakMap<bug, Map<nowMs, reconstruction>>
const memo = new WeakMap();

const stats = { calls: 0, misses: 0 };

/**
 * A memoized reconstructBug bound to a single "now". Pass the result to
 * computeProjectLine / computeGravity / computeMissionMap as opts.reconstruct so
 * they all share one pass over the activity log.
 */
const createReconstructor = (nowMs) => {
  const at = nowMs != null ? nowMs : Date.now();
  return (bug) => {
    stats.calls += 1;
    if (!bug || typeof bug !== 'object') {
      stats.misses += 1;
      return reconstructBug(bug, at);
    }
    let byTime = memo.get(bug);
    if (!byTime) {
      byTime = new Map();
      memo.set(bug, byTime);
    }
    if (byTime.has(at)) return byTime.get(at);
    stats.misses += 1;
    const result = reconstructBug(bug, at);
    byTime.set(at, result);
    return result;
  };
};

// Test seam: proves the memo is actually being hit rather than silently bypassed.
const reconstructionStats = () => ({ ...stats });
const resetReconstructionStats = () => {
  stats.calls = 0;
  stats.misses = 0;
};

const toMs = (raw) => {
  if (raw == null || raw === '') return NaN;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? NaN : ms;
};

/**
 * Cheap content fingerprint for a project's bugs. Changes whenever a bug is
 * added, removed, or touched, so a cached deck row cannot outlive its data even
 * inside the TTL window.
 */
const fingerprintBugs = (bugs) => {
  const list = Array.isArray(bugs) ? bugs : [];
  let latest = 0;
  let activityCount = 0;
  for (const bug of list) {
    const log = Array.isArray(bug && bug.activityLog) ? bug.activityLog : [];
    activityCount += log.length;
    for (const row of log) {
      const ms = toMs(row && (row.timestamp || row.created_at));
      if (!Number.isNaN(ms) && ms > latest) latest = ms;
    }
    const updated = toMs(bug && (bug.lastUpdated || bug.updated_at));
    if (!Number.isNaN(updated) && updated > latest) latest = updated;
  }
  return `${list.length}:${activityCount}:${latest}`;
};

/**
 * Cache key for a per-project computation. The storage type is part of the key
 * on purpose - DATABASE_PROVIDER=auto may resolve to MySQL on one boot and CSV
 * on the next, and those must never share a cache entry.
 */
const projectCacheKey = (storageType, projectKey, bugs) =>
  `${storageType || 'unknown'}|${projectKey}|${fingerprintBugs(bugs)}`;

const createCache = ({ ttlMs = DEFAULT_TTL_MS, now = () => Date.now(), maxEntries = 200 } = {}) => {
  const entries = new Map();

  const sweep = (at) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= at) entries.delete(key);
    }
    // Bound memory even if every key is unique (a busy instance with many projects).
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      entries.delete(oldest);
    }
  };

  return {
    get(key) {
      const at = now();
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= at) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      const at = now();
      sweep(at);
      entries.set(key, { value, expiresAt: at + ttlMs });
      return value;
    },
    wrap(key, compute) {
      const hit = this.get(key);
      if (hit !== undefined) return hit;
      return this.set(key, compute());
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    }
  };
};

// Shared cache for the Command Deck. One instance per process; keys carry the
// storage type and a content fingerprint, so entries are self-invalidating.
const deckCache = createCache();

module.exports = {
  DEFAULT_TTL_MS,
  createReconstructor,
  reconstructionStats,
  resetReconstructionStats,
  fingerprintBugs,
  projectCacheKey,
  createCache,
  deckCache
};
