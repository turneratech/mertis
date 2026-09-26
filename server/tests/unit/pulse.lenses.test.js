const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseLens,
  applyLens,
  lensSummary,
  needsMissions,
  LENS_NAMES,
  STALE_DAYS
} = require('../../pulse/lenses');

const iso = (n) => new Date(n).toISOString();
const DAY = 86400000;
const NOW = 100 * DAY;

const bug = (over = {}) => ({
  bugId: 'SM-0001',
  title: 'Timeout on large batch import',
  status: 'Open',
  severity: 'High',
  environment: 'Development',
  module: 'ingest',
  assignee: 'asha',
  arb: [],
  created: iso(0),
  activityLog: [{ action: 'comment', user: 'asha', timestamp: iso(NOW - DAY) }],
  ...over
});

describe('Pulse lenses [VER-PULSE-LENS]', () => {
  it('VER-PULSE-LENS: an unknown lens is a 400, never a silent everything', () => {
    // Failing open is worse than no filter: the user believes they are looking
    // at a subset and every metric on the page has a different denominator.
    const bad = parseLens({ lens: 'assignee:asha' });
    assert.equal(bad.ok, false);
    assert.match(bad.error, /unknown lens "assignee"/);
    for (const name of LENS_NAMES) assert.match(bad.error, new RegExp(name));
  });

  it('VER-PULSE-LENS: a lens that needs a value refuses without one, and vice versa', () => {
    assert.equal(parseLens({ lens: 'module' }).ok, false);
    assert.match(parseLens({ lens: 'module' }).error, /needs a value/);
    assert.equal(parseLens({ lens: 'mine:asha' }).ok, false);
    assert.match(parseLens({ lens: 'mine:asha' }).error, /does not take a value/);
  });

  it('VER-PULSE-LENS: closed vocabularies are enforced and normalised', () => {
    const ok = parseLens({ lens: 'severity:critical' });
    assert.equal(ok.ok, true);
    assert.equal(ok.lens.value, 'Critical', 'canonical casing, not what was typed');

    const bad = parseLens({ lens: 'severity:urgent' });
    assert.equal(bad.ok, false);
    assert.match(bad.error, /Critical, High, Medium, Low/);
  });

  it('VER-PULSE-LENS: no lens and no q means no filtering at all', () => {
    const parsed = parseLens({});
    assert.equal(parsed.ok, true);
    assert.equal(parsed.lens, null);
    const bugs = [bug(), bug({ bugId: 'SM-0002' })];
    assert.equal(applyLens(bugs, parsed.lens).length, 2);
  });

  it('VER-PULSE-LENS: named lenses filter on the right field', () => {
    const bugs = [
      bug({ bugId: 'SM-1', module: 'ingest', severity: 'High', environment: 'Development' }),
      bug({ bugId: 'SM-2', module: 'payments', severity: 'Critical', environment: 'Production' }),
      bug({ bugId: 'SM-3', module: 'payments', severity: 'Low', environment: 'Staging' })
    ];
    const pick = (lensStr) => {
      const p = parseLens({ lens: lensStr });
      assert.equal(p.ok, true, lensStr);
      return applyLens(bugs, p.lens, { nowMs: NOW }).map((b) => b.bugId);
    };
    assert.deepEqual(pick('module:payments'), ['SM-2', 'SM-3']);
    assert.deepEqual(pick('severity:Critical'), ['SM-2']);
    assert.deepEqual(pick('environment:Production'), ['SM-2']);
    // Module match is case-insensitive but exact — not a substring.
    assert.deepEqual(pick('module:PAYMENTS'), ['SM-2', 'SM-3']);
    assert.deepEqual(pick('module:pay'), []);
  });

  it('VER-PULSE-LENS: "mine" means the next move is yours, not merely visible to you', () => {
    const known = new Set(['asha', 'ravi']);
    const bugs = [
      bug({ bugId: 'SM-1', assignee: 'asha' }),
      bug({ bugId: 'SM-2', assignee: 'ravi' }),
      // Assigned to asha, but the ARB says ravi owns the next move.
      bug({ bugId: 'SM-3', assignee: 'asha', arb: ['ravi'] })
    ];
    const p = parseLens({ lens: 'mine' });
    const mine = applyLens(bugs, p.lens, { username: 'asha', knownUsers: known, nowMs: NOW });
    assert.deepEqual(mine.map((b) => b.bugId), ['SM-1']);
  });

  it(`VER-PULSE-LENS: "stale" is ${STALE_DAYS} days without REAL activity`, () => {
    const bugs = [
      bug({ bugId: 'SM-1', activityLog: [{ action: 'comment', user: 'asha', timestamp: iso(NOW - DAY) }] }),
      bug({ bugId: 'SM-2', activityLog: [{ action: 'comment', user: 'asha', timestamp: iso(NOW - 20 * DAY) }] }),
      // `updated` is not real activity — it is exactly the status-theatre the
      // truth clock exists to ignore.
      bug({ bugId: 'SM-3', created: iso(NOW - 30 * DAY), activityLog: [{ action: 'updated', user: 'asha', timestamp: iso(NOW - DAY) }] })
    ];
    const p = parseLens({ lens: 'stale' });
    const stale = applyLens(bugs, p.lens, { nowMs: NOW, botUsers: [] });
    assert.deepEqual(stale.map((b) => b.bugId), ['SM-2', 'SM-3']);
  });

  it('VER-PULSE-LENS: mission and unclaimed use the link map', () => {
    const bugs = [bug({ bugId: 'SM-1' }), bug({ bugId: 'SM-2' }), bug({ bugId: 'SM-3' })];
    const missionByBugId = { 'SM-1': 'm-1', 'SM-2': 'm-2' };

    const inMission = applyLens(bugs, parseLens({ lens: 'mission:m-1' }).lens, { missionByBugId, nowMs: NOW });
    assert.deepEqual(inMission.map((b) => b.bugId), ['SM-1']);

    const unclaimed = applyLens(bugs, parseLens({ lens: 'unclaimed' }).lens, { missionByBugId, nowMs: NOW });
    assert.deepEqual(unclaimed.map((b) => b.bugId), ['SM-3']);

    assert.equal(needsMissions(parseLens({ lens: 'unclaimed' }).lens), true);
    assert.equal(needsMissions(parseLens({ lens: 'mission:m-1' }).lens), true);
    assert.equal(needsMissions(parseLens({ lens: 'stale' }).lens), false);
  });

  it('VER-PULSE-LENS: free-text q matches title or bug id, and composes with a lens', () => {
    const bugs = [
      bug({ bugId: 'SM-1', title: 'Timeout on large batch import', module: 'ingest' }),
      bug({ bugId: 'SM-2', title: 'Duplicate rows after replay', module: 'ingest' }),
      bug({ bugId: 'SM-3', title: 'Timeout on export', module: 'exports' })
    ];
    const byText = applyLens(bugs, parseLens({ q: 'timeout' }).lens, { nowMs: NOW });
    assert.deepEqual(byText.map((b) => b.bugId), ['SM-1', 'SM-3']);

    const byId = applyLens(bugs, parseLens({ q: 'SM-2' }).lens, { nowMs: NOW });
    assert.deepEqual(byId.map((b) => b.bugId), ['SM-2']);

    const both = applyLens(bugs, parseLens({ lens: 'module:ingest', q: 'timeout' }).lens, { nowMs: NOW });
    assert.deepEqual(both.map((b) => b.bugId), ['SM-1']);
  });

  it('VER-PULSE-LENS: an over-long q is refused rather than silently truncated', () => {
    const parsed = parseLens({ q: 'x'.repeat(500) });
    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /too long/);
  });

  it('VER-PULSE-LENS: the summary always reports the unfiltered total', () => {
    // Without `of`, a user cannot tell "small project" from "narrow lens", and
    // every metric on the page has quietly changed denominator.
    const lens = parseLens({ lens: 'module:payments' }).lens;
    const summary = lensSummary(lens, 12, 812);
    assert.equal(summary.matched, 12);
    assert.equal(summary.of, 812);
    assert.equal(summary.label, 'module:payments');
    assert.equal(lensSummary(null, 0, 0), null, 'no lens means no summary');
  });

  it('VER-PULSE-LENS: a lens matching nothing is empty, not degraded', () => {
    // The measurement succeeded; the set is simply empty. Emitting a degraded
    // entry here would claim we could not compute something we did compute.
    const bugs = [bug({ bugId: 'SM-1', module: 'ingest' })];
    const out = applyLens(bugs, parseLens({ lens: 'module:nothing-here' }).lens, { nowMs: NOW });
    assert.deepEqual(out, []);
    const summary = lensSummary(parseLens({ lens: 'module:nothing-here' }).lens, 0, 1);
    assert.equal(summary.matched, 0);
    assert.equal(summary.of, 1);
  });
});
