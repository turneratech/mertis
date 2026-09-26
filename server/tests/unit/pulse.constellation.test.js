const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { computeBrief } = require('../../pulse/brief');
const { computeDeck } = require('../../pulse/deck');

const iso = (n) => new Date(n).toISOString();
const sc = (from, to, at, station) => ({
  action: 'status_change',
  from,
  to,
  station: station || (to === 'Closed' ? 'closed' : to === 'Reopened' ? 'dev_queue' : 'dev'),
  timestamp: iso(at)
});

const bug = (over = {}) => ({
  bugId: 'CN-1',
  status: 'Open',
  bugType: 'Bug',
  severity: 'Medium',
  environment: 'Development',
  module: 'Auth',
  created: iso(0),
  triagedAt: iso(0),
  activityLog: [],
  ...over
});

describe('Pulse constellation metrics [VER-PULSE-CON]', () => {
  it('VER-PULSE-CON: the deck carries numbers, not just sentences', () => {
    const bugs = [
      bug({ bugId: 'CN-1', bugType: 'Bug' }),
      bug({ bugId: 'CN-2', bugType: 'Feature' }),
      bug({ bugId: 'CN-3', bugType: 'Bug', status: 'Closed' })
    ];
    const brief = computeBrief(bugs, { nowMs: 10000 });

    assert.ok(brief.metrics, 'metrics are part of the brief contract');
    assert.equal(brief.metrics.bugCount, 3);
    assert.equal(brief.metrics.openCount, 2, 'Closed is not open work');
    assert.equal(brief.metrics.taxPct, 67, '2 of 3 typed items are Bugs');

    // The sentence and the number must agree — the constellation must never
    // need to parse our own English back out to place a node.
    const mix = brief.clauses.find((c) => c.id === 'mix');
    assert.ok(mix.text.includes('67%'));
  });

  it('VER-PULSE-CON: an uncomputable metric is null, never 0', () => {
    // No close recorded anywhere, so "escaped since last close" has no cut point.
    const brief = computeBrief([bug({ bugId: 'CN-9' })], { nowMs: 10000 });
    assert.equal(brief.metrics.escapedCount, null, 'null means not computable');
    assert.notEqual(brief.metrics.escapedCount, 0, 'a zero here would be a lie');
  });

  it('VER-PULSE-CON: escaped and reopen counts are real when the data supports them', () => {
    const bugs = [
      bug({
        bugId: 'CN-10',
        status: 'Closed',
        closedDate: iso(1000),
        activityLog: [sc('Open', 'Closed', 1000)]
      }),
      bug({
        bugId: 'CN-11',
        created: iso(2000),
        environment: 'Production',
        bugType: 'Bug',
        severity: 'Critical'
      }),
      bug({
        bugId: 'CN-12',
        status: 'Reopened',
        activityLog: [sc('Open', 'Closed', 500), sc('Closed', 'Reopened', 900)]
      })
    ];
    const brief = computeBrief(bugs, { nowMs: 5000 });
    assert.equal(brief.metrics.escapedCount, 1);
    assert.equal(brief.metrics.escapedCritical, 1);
    assert.equal(brief.metrics.reopenTotal, 1);
  });

  it('VER-PULSE-CON: metrics survive the deck projection', () => {
    const deck = computeDeck([
      { projectKey: 'AA', projectName: 'Alpha', bugs: [bug({ bugId: 'AA-1' })], opts: { nowMs: 10000 } },
      { projectKey: 'BB', projectName: 'Beta', bugs: [bug({ bugId: 'BB-1' })], opts: { nowMs: 10000 } }
    ]);
    assert.equal(deck.rows.length, 2);
    for (const row of deck.rows) {
      assert.ok(row.metrics, `${row.projectKey} carries metrics`);
      assert.equal(typeof row.metrics.openCount, 'number');
    }
    assert.equal(deck.skipToStrike, null, 'two projects means the Deck, not a redirect');
  });

  it('VER-PULSE-CON: adding metrics did not add degraded noise to the brief', () => {
    // escaped/gravity feed the constellation only; the clause contract is unchanged.
    const brief = computeBrief([bug({ bugId: 'CN-20' })], { nowMs: 10000 });
    const metrics = (brief.degraded || []).map((d) => d.metric);
    assert.equal(metrics.includes('escaped'), false);
    assert.equal(metrics.includes('gravity'), false);
  });
});
