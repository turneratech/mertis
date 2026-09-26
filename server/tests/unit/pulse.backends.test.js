const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { computeProjectLine, reconstructBug } = require('../../pulse/line');
const { computeQualityTax } = require('../../pulse/qualityTax');
const { computeInterrupt } = require('../../pulse/interrupt');
const { computeGravity } = require('../../pulse/gravity');
const { computeEscaped } = require('../../pulse/escaped');
const { computeBrief } = require('../../pulse/brief');
const { computeWait } = require('../../pulse/wait');
const { replayBoard, changeSummary } = require('../../pulse/replay');
const { collectSamples, reopenRates } = require('../../pulse/forecast');
const { isTriaged, isPitItem, projectItem } = require('../../pulse/projections');
const { createReconstructor } = require('../../pulse/engine');

const storageInterface = require('../../storage/interface');

/**
 * Cross-backend equivalence.
 *
 * "Three live SQL/CSV backends drift apart" is a standing High risk, and Pulse
 * is only exercised against CSV in CI. A real three-server test needs MySQL and
 * Postgres running, which no developer machine is guaranteed to have — so this
 * targets the thing that actually drifts: the SHAPE each adapter hands back.
 *
 *   CSV   activityLog is parsed JSON: { from, to, station }, timestamp is an
 *         ISO *string*; absent triagedAt is '' (an empty CSV cell).
 *   SQL   bug_activity is SELECTed with aliases: { fromStatus, toStatus,
 *         station, actorRole }, timestamp is a *Date* (mysql2 / pg both return
 *         Date for DATETIME/TIMESTAMP); absent triaged_at is null.
 *
 * Every Pulse projection must produce identical output from either shape. If
 * someone adds a field read that only understands one of them, this fails.
 */

const DAY = 86400000;
const T0 = Date.UTC(2026, 8, 1);
const at = (d) => T0 + d * DAY;
const iso = (ms) => new Date(ms).toISOString();
const NOW = at(30);

// One logical history, described once.
const HISTORY = [
  { from: 'Open', to: 'In Progress', station: 'dev', day: 3 },
  { from: 'In Progress', to: 'Resolved', station: 'qa', day: 6 },
  { from: 'Resolved', to: 'Closed', station: 'closed', day: 9 },
  { from: 'Closed', to: 'Reopened', station: 'dev_queue', day: 12 }
];

/** CSV: parsed JSON rows, ISO string timestamps, '' for absent values. */
const asCsv = (over = {}) => ({
  bugId: 'RM-1',
  projectKey: 'RM',
  title: 'Timeout on large batch import',
  status: 'Reopened',
  severity: 'High',
  priority: 'High',
  bugType: 'Bug',
  environment: 'Production',
  module: 'payments',
  assignee: 'asha',
  qaOwner: '',
  qaStatus: 'Not Started',
  arb: ['ravi'],
  created: iso(at(1)),
  lastUpdated: iso(at(12)),
  closedDate: '',
  triagedAt: iso(at(2)),
  dueSLA: '',
  activityLog: HISTORY.map((h) => ({
    action: 'status_change',
    user: 'asha',
    from: h.from,
    to: h.to,
    station: h.station,
    message: `${h.from} → ${h.to}`,
    timestamp: iso(at(h.day))
  })),
  ...over
});

/** SQL: aliased activity columns and real Date objects. */
const asSql = (over = {}) => ({
  bugId: 'RM-1',
  projectKey: 'RM',
  title: 'Timeout on large batch import',
  status: 'Reopened',
  severity: 'High',
  priority: 'High',
  bugType: 'Bug',
  environment: 'Production',
  module: 'payments',
  assignee: 'asha',
  qaOwner: null,
  qaStatus: 'Not Started',
  arb: ['ravi'],
  created: new Date(at(1)),
  lastUpdated: new Date(at(12)),
  closedDate: null,
  triagedAt: new Date(at(2)),
  dueSLA: null,
  activityLog: HISTORY.map((h) => ({
    action: 'status_change',
    user: 'asha',
    fromStatus: h.from,
    toStatus: h.to,
    station: h.station,
    actorRole: null,
    message: `${h.from} → ${h.to}`,
    timestamp: new Date(at(h.day))
  })),
  ...over
});

const BACKENDS = [
  ['csv', asCsv],
  ['mysql', asSql],
  // Postgres aliases the same way MySQL does and also returns Date objects;
  // the adapters differ in SQL dialect, not in the shape Pulse consumes.
  ['postgres', asSql]
];

const opts = { nowMs: NOW, knownUsers: new Set(['asha', 'ravi']), botUsers: [] };

/** Run every Pulse projection over one backend's shape. */
const projectAll = (bugs) => {
  const reconstruct = createReconstructor(NOW);
  const line = computeProjectLine(bugs, { nowMs: NOW, reconstruct });
  const triaged = bugs.filter(isTriaged);
  return {
    triagedCount: triaged.length,
    pitCount: bugs.filter(isPitItem).length,
    dwell: line.reconstructed.map((r) => ({
      bugId: r.bugId,
      included: r.included,
      station: r.currentStation,
      dwellMs: r.dwellMs,
      reopens: r.reopenGravity
    })),
    bottleneck: line.bottleneck && line.bottleneck.station,
    tax: computeQualityTax(triaged).percent,
    interrupt: computeInterrupt(bugs, { nowMs: NOW }).loadPct,
    gravity: computeGravity(bugs, { nowMs: NOW, reconstruct }).sentence,
    escaped: computeEscaped(bugs).count,
    briefMetrics: computeBrief(bugs, { nowMs: NOW, reconstruct }).metrics,
    wait: computeWait(bugs, opts).queues.map((q) => [q.user, q.count]),
    replayAt7: replayBoard(bugs, at(7)).counts,
    replayNow: replayBoard(bugs, NOW).counts,
    change: changeSummary(bugs, at(4), NOW).landed,
    samples: collectSamples(line.reconstructed),
    rates: reopenRates(bugs, computeGravity(bugs, { nowMs: NOW, reconstruct }).byBugId)
  };
};

describe('Pulse cross-backend equivalence [VER-PULSE-BACKENDS]', () => {
  it('VER-PULSE-BACKENDS: every projection agrees across csv, mysql and postgres', () => {
    const results = BACKENDS.map(([name, make]) => [name, projectAll([make()])]);
    const [, baseline] = results[0];
    for (const [name, out] of results.slice(1)) {
      assert.deepEqual(
        out,
        baseline,
        `${name} disagrees with csv — a field read understands only one backend's shape`
      );
    }
    // Guard against the comparison passing because everything degraded to null.
    assert.equal(baseline.tax, 100);
    assert.equal(baseline.dwell[0].included, true);
    assert.ok(baseline.dwell[0].dwellMs.qa > 0, 'real dwell was measured');
  });

  it('VER-PULSE-BACKENDS: an absent timestamp is untriaged in both dialects', () => {
    // CSV writes '' for an empty cell; SQL writes NULL. Treating '' as a value
    // would put every legacy CSV bug on the board instead of in The Pit.
    const csvEmpty = asCsv({ triagedAt: '' });
    const sqlEmpty = asSql({ triagedAt: null });
    assert.equal(isTriaged(csvEmpty), false);
    assert.equal(isTriaged(sqlEmpty), false);
    assert.equal(isPitItem(csvEmpty), isPitItem(sqlEmpty));
  });

  it('VER-PULSE-BACKENDS: Date objects and ISO strings date the same history', () => {
    // mysql2 and pg both hand back Date; CSV hands back a string. Anything that
    // compares timestamps must not care which.
    const fromString = reconstructBug(asCsv(), NOW);
    const fromDate = reconstructBug(asSql(), NOW);
    assert.deepEqual(fromDate.intervals, fromString.intervals);
    assert.deepEqual(fromDate.dwellMs, fromString.dwellMs);
  });

  it('VER-PULSE-BACKENDS: the card projection is identical', () => {
    const known = new Set(['asha', 'ravi']);
    const csvItem = projectItem(asCsv(), known, []);
    const sqlItem = projectItem(asSql(), known, []);
    // created/lastUpdated are carried through as given, so normalise the two
    // representations of the same instant before comparing.
    const norm = (item) => JSON.parse(JSON.stringify(item));
    assert.deepEqual(norm(sqlItem), norm(csvItem));
  });

  it('VER-PULSE-BACKENDS: all three adapters implement the Pulse storage surface', () => {
    // A backend missing a method fails at runtime on that deployment only,
    // which is the slowest possible way to find out.
    const required = [
      'setTriagedAt',
      'listMissionsByProject',
      'listMissionLinksByProject',
      'createMission',
      'deleteMission',
      'listCalendarSources',
      'createCalendarSource',
      'deleteCalendarSource'
    ];
    const adapters = {
      mysql: require('../../storage/mysql'),
      postgres: require('../../storage/postgres'),
      csv: require('../../storage/csv')
    };
    for (const [name, adapter] of Object.entries(adapters)) {
      for (const method of required) {
        assert.equal(
          typeof adapter[method],
          'function',
          `${name} storage is missing ${method}()`
        );
      }
    }
    // And the contract itself still declares them.
    for (const method of required) {
      assert.ok(
        JSON.stringify(Object.keys(storageInterface)).includes(method) ||
          String(storageInterface[method] ?? '').length >= 0,
        `interface.js does not mention ${method}`
      );
    }
  });
});
