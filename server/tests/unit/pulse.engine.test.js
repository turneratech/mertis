const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  createReconstructor,
  reconstructionStats,
  resetReconstructionStats,
  fingerprintBugs,
  projectCacheKey,
  createCache
} = require('../../pulse/engine');
const { reconstructBug, computeProjectLine } = require('../../pulse/line');
const { computeGravity } = require('../../pulse/gravity');

const iso = (n) => new Date(n).toISOString();
const sc = (from, to, at) => ({
  action: 'status_change',
  from,
  to,
  station: to === 'Reopened' ? 'dev_queue' : to === 'Closed' ? 'closed' : 'dev',
  timestamp: iso(at)
});

const bugFixture = (bugId, module = 'Auth') => ({
  bugId,
  status: 'Reopened',
  module,
  bugType: 'Bug',
  created: iso(0),
  activityLog: [
    sc('Open', 'In Progress', 1000),
    sc('In Progress', 'Resolved', 2000),
    sc('Resolved', 'Closed', 3000),
    sc('Closed', 'Reopened', 4000)
  ]
});

describe('Pulse engine [VER-PULSE-ENGINE]', () => {
  beforeEach(() => resetReconstructionStats());

  it('VER-PULSE-ENGINE: memoized reconstruction equals the uncached one', () => {
    const bug = bugFixture('EN-1');
    const reconstruct = createReconstructor(5000);
    assert.deepEqual(reconstruct(bug), reconstructBug(bug, 5000));
  });

  it('VER-PULSE-ENGINE: the same bug is reconstructed once across metrics', () => {
    const bugs = [bugFixture('EN-1'), bugFixture('EN-2', 'Billing')];
    const reconstruct = createReconstructor(5000);

    // This is the /board path: gravity and The Line both walk the same bugs.
    computeGravity(bugs, { reconstruct });
    computeProjectLine(bugs, { nowMs: 5000, reconstruct });

    const stats = reconstructionStats();
    assert.equal(stats.calls, 4, 'both metrics asked for both bugs');
    assert.equal(stats.misses, 2, 'but each bug was only reconstructed once');
  });

  it('VER-PULSE-ENGINE: a different "now" is a different answer, not a stale hit', () => {
    const bug = bugFixture('EN-3');
    const early = createReconstructor(5000)(bug);
    const later = createReconstructor(9000)(bug);
    assert.notDeepEqual(early.dwellMs, later.dwellMs);
    assert.equal(reconstructionStats().misses, 2);
  });

  it('VER-PULSE-ENGINE: cache key includes the storage type', () => {
    const bugs = [bugFixture('EN-1')];
    const mysql = projectCacheKey('mysql', 'SM', bugs);
    const csv = projectCacheKey('csv', 'SM', bugs);
    assert.notEqual(mysql, csv, 'DATABASE_PROVIDER=auto must not share entries');
    assert.equal(mysql, projectCacheKey('mysql', 'SM', bugs));
  });

  it('VER-PULSE-ENGINE: the fingerprint changes when the work changes', () => {
    const before = [bugFixture('EN-1')];
    const added = [bugFixture('EN-1'), bugFixture('EN-2')];
    assert.notEqual(fingerprintBugs(before), fingerprintBugs(added));

    const touched = [bugFixture('EN-1')];
    touched[0].activityLog.push(sc('Reopened', 'In Progress', 6000));
    assert.notEqual(fingerprintBugs(before), fingerprintBugs(touched));
  });

  it('VER-PULSE-ENGINE: cache entries expire and never outlive their TTL', () => {
    let clock = 0;
    const cache = createCache({ ttlMs: 100, now: () => clock });
    let computed = 0;
    const compute = () => {
      computed += 1;
      return { value: computed };
    };

    assert.deepEqual(cache.wrap('k', compute), { value: 1 });
    clock = 50;
    assert.deepEqual(cache.wrap('k', compute), { value: 1 }, 'still warm');
    assert.equal(computed, 1);

    clock = 250;
    assert.deepEqual(cache.wrap('k', compute), { value: 2 }, 'recomputed after TTL');
    assert.equal(computed, 2);
  });

  it('VER-PULSE-ENGINE: the cache stays bounded when every key is unique', () => {
    const cache = createCache({ ttlMs: 60000, maxEntries: 10 });
    for (let i = 0; i < 100; i += 1) cache.set(`k${i}`, i);
    assert.ok(cache.size <= 11, `expected a bounded cache, got ${cache.size}`);
  });
});
