// M21 — Landing.
//
// Every tool shows a date a human typed. Landing computes a date *range* from
// the project's own measured physics, and refuses to answer when it cannot.
//
// Inputs, all already computed elsewhere:
//   - per-station dwell distributions   (line.js)
//   - reopen frequency per module       (gravity.js)
//
// Method: Monte Carlo. For each unfinished bug in a mission, sample the dwell it
// still owes at each station ahead of it. After QA, re-enter Dev with the
// probability that module actually bounces. The mission lands when its last bug
// lands; report P50 and P85 of the trial distribution.
//
// TWO THINGS THIS DELIBERATELY DOES NOT DO
//
// 1. It does not apply an interrupt-capacity multiplier, although the milestone
//    sketch called for one. The dwell samples were measured *while* the team was
//    being interrupted — that drag is already inside the numbers. Multiplying by
//    interrupt load again would double-count it and inflate every date. Interrupt
//    is reported as context instead, so a reader knows the forecast assumes the
//    current load continues.
//
// 2. It does not invent a distribution when history is thin. Below the sample
//    floor it returns a refusal naming how many more completed bugs it needs. A
//    confident wrong date would destroy the premise of the whole product.

const { ACTIVE_STATIONS } = require('./line');

// Order a bug travels. qa_testing is an overlay on qa, not a separate hop.
const PATH = ['dev_queue', 'dev', 'qa'];

const TRIALS = 2000;
const MIN_SAMPLES = 8;      // per station on the path
const MAX_REWORK_LOOPS = 5; // a bounce that never converges is a broken process, not a forecast
const MAX_REOPEN_P = 0.9;

const DAY_MS = 86400000;

/** Deterministic PRNG. The same mission must forecast the same date on every
 *  refresh, or nobody will trust it — and it must be unit-testable. */
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (str) => {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const percentile = (sorted, p) => {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

/**
 * Empirical dwell samples per station, taken from reconstructed bugs. Resampling
 * observed values (a bootstrap) rather than fitting a curve keeps the shape of
 * the real data, including its tail.
 */
const collectSamples = (reconstructed) => {
  const samples = {};
  for (const station of ACTIVE_STATIONS) samples[station] = [];
  for (const row of reconstructed || []) {
    if (!row || !row.included) continue;
    for (const station of ACTIVE_STATIONS) {
      const ms = (row.dwellMs || {})[station] || 0;
      if (ms > 0) samples[station].push(ms);
    }
  }
  return samples;
};

/**
 * Measured probability that a bug in this module comes back after QA.
 * Reopens per bug, clamped — a module with more reopens than bugs is telling us
 * something real, but 100% rework would never converge.
 */
const reopenRates = (bugs, gravityByBugId) => {
  const perModule = {};
  for (const bug of bugs || []) {
    const key = (bug.module && String(bug.module).trim()) || '(no module)';
    if (!perModule[key]) perModule[key] = { bugs: 0, reopens: 0 };
    perModule[key].bugs += 1;
    perModule[key].reopens += (gravityByBugId || {})[bug.bugId] || 0;
  }
  const rates = {};
  for (const [key, row] of Object.entries(perModule)) {
    rates[key] = row.bugs ? Math.min(MAX_REOPEN_P, row.reopens / row.bugs) : 0;
  }
  return rates;
};

const stationsAhead = (currentStation) => {
  const idx = PATH.indexOf(currentStation);
  if (idx === -1) return [...PATH]; // unknown/new: owes the whole path
  return PATH.slice(idx);
};

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

/**
 * One trial for one bug: remaining dwell, plus any rework loops.
 * Returns milliseconds of remaining work.
 */
const simulateBug = (rand, ahead, samples, reopenP, allowRework) => {
  let total = 0;
  for (const station of ahead) {
    const pool = samples[station];
    if (pool && pool.length) total += pick(rand, pool);
  }
  if (!allowRework) return total;

  let loops = 0;
  while (loops < MAX_REWORK_LOOPS && rand() < reopenP) {
    loops += 1;
    for (const station of ['dev', 'qa']) {
      const pool = samples[station];
      if (pool && pool.length) total += pick(rand, pool);
    }
  }
  return total;
};

/**
 * Forecast one mission.
 *
 * `opts.nowMs` anchors the dates; `opts.trials` is fixed so results are stable.
 */
const forecastMission = (mission, opts = {}) => {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const trials = opts.trials || TRIALS;
  const samples = opts.samples || {};
  const rates = opts.reopenRates || {};
  const minSamples = opts.minSamples != null ? opts.minSamples : MIN_SAMPLES;

  const open = (mission.bugs || []).filter((b) => b && b.status !== 'Closed');

  if (!open.length) {
    return {
      missionId: mission.id,
      title: mission.title,
      p50: null,
      p85: null,
      sentence: `${mission.title} has already landed.`,
      landed: true,
      drivers: [],
      degraded: null
    };
  }

  // Which stations does this mission actually still need? Only those need history.
  const needed = new Set();
  for (const bug of open) {
    for (const station of stationsAhead(opts.stationOf ? opts.stationOf(bug) : bug.currentStation)) {
      needed.add(station);
    }
  }

  const thin = [...needed]
    .map((station) => ({ station, have: (samples[station] || []).length }))
    .filter((row) => row.have < minSamples)
    .sort((a, b) => a.have - b.have);

  if (thin.length) {
    const worst = thin[0];
    const short = minSamples - worst.have;
    return {
      missionId: mission.id,
      title: mission.title,
      p50: null,
      p85: null,
      sentence: null,
      landed: false,
      drivers: [],
      degraded: {
        metric: 'landing',
        reason: `not enough history to forecast — needs ${short} more completed bug${short === 1 ? '' : 's'} through ${worst.station.replace('_', ' ')}`
      }
    };
  }

  const run = (allowRework) => {
    const rand = mulberry32(hashSeed(`${mission.id}|${allowRework ? 'rework' : 'clean'}`));
    const totals = [];
    for (let t = 0; t < trials; t += 1) {
      let slowest = 0;
      for (const bug of open) {
        const ahead = stationsAhead(opts.stationOf ? opts.stationOf(bug) : bug.currentStation);
        const key = (bug.module && String(bug.module).trim()) || '(no module)';
        const ms = simulateBug(rand, ahead, samples, rates[key] || 0, allowRework);
        if (ms > slowest) slowest = ms;
      }
      totals.push(slowest);
    }
    totals.sort((a, b) => a - b);
    return totals;
  };

  const withRework = run(true);
  const p50 = percentile(withRework, 0.5);
  const p85 = percentile(withRework, 0.85);

  // Counterfactual: the same mission with no bounce. The gap between the two
  // P85s is the spread that rework alone is responsible for — which is the
  // clause a PM screenshots, and it is arithmetic, not a guess.
  const clean = run(false);
  const cleanP85 = percentile(clean, 0.85);
  const reworkDays = Math.round(Math.max(0, p85 - cleanP85) / DAY_MS);

  // Attribute that spread to the module that actually bounces most here.
  let topModule = null;
  let topRate = 0;
  for (const bug of open) {
    const key = (bug.module && String(bug.module).trim()) || '(no module)';
    const rate = rates[key] || 0;
    if (rate > topRate) {
      topRate = rate;
      topModule = key;
    }
  }

  const fmt = (ms) => new Date(nowMs + ms).toISOString().slice(0, 10);
  const asDate = (ms) =>
    new Date(nowMs + ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const drivers = [];
  if (reworkDays > 0 && topModule) {
    drivers.push({ kind: 'rework', module: topModule, rate: topRate, daysOfSpread: reworkDays });
  }

  const sentence =
    `${mission.title} lands ${asDate(p50)}, 85% by ${asDate(p85)}.` +
    (drivers.length
      ? ` ${reworkDays} day${reworkDays === 1 ? '' : 's'} of that spread is QA bounce in ${topModule}.`
      : '');

  return {
    missionId: mission.id,
    title: mission.title,
    p50: fmt(p50),
    p85: fmt(p85),
    // Display labels come from the SAME formatter the sentence uses. The client
    // must not re-derive them: an ISO date re-parsed in another timezone lands a
    // day out, and a card that says "85% by 15 Jan" above "Jan 14" below is
    // exactly the kind of quietly-wrong number this product exists to avoid.
    p50Label: asDate(p50),
    p85Label: asDate(p85),
    p50Ms: p50,
    p85Ms: p85,
    openCount: open.length,
    sentence,
    landed: false,
    drivers,
    degraded: null
  };
};

/**
 * Forecast every mission in a project.
 * `missions` is [{ id, title, bugs: [...] }]; bugs carry `currentStation` from
 * the engine's reconstruction.
 */
const computeLanding = (missions, opts = {}) => {
  const rows = (missions || []).map((mission) => forecastMission(mission, opts));
  const degraded = rows.filter((r) => r.degraded).map((r) => r.degraded);
  return {
    missions: rows,
    // One shared note rather than one per mission: the reader needs to know the
    // forecast assumes today's interrupt load continues, not a per-row warning.
    assumes: opts.interruptPct != null
      ? `Assumes unplanned work stays near ${opts.interruptPct}% of capacity.`
      : null,
    degraded: degraded.length ? degraded.slice(0, 1) : []
  };
};

module.exports = {
  computeLanding,
  forecastMission,
  collectSamples,
  reopenRates,
  stationsAhead,
  mulberry32,
  hashSeed,
  TRIALS,
  MIN_SAMPLES,
  PATH
};
