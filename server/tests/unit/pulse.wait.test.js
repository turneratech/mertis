const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { computeWait } = require('../../pulse/wait');

const DAY = 86400000;
const NOW = 100 * DAY;
const iso = (n) => new Date(n).toISOString();

const known = new Set(['asha', 'ravi', 'meera']);

const bug = (over = {}) => ({
  bugId: 'SM-0001',
  status: 'Open',
  assignee: 'asha',
  arb: [],
  created: iso(NOW - 2 * DAY),
  activityLog: [{ action: 'comment', user: 'asha', timestamp: iso(NOW - 2 * DAY) }],
  ...over
});

describe('Pulse The Wait [VER-PULSE-WAIT]', () => {
  it('VER-PULSE-WAIT: work parked on a person becomes their queue, oldest first', () => {
    const out = computeWait(
      [
        bug({ bugId: 'SM-1', assignee: 'asha', arb: ['ravi'], activityLog: [{ action: 'comment', user: 'asha', timestamp: iso(NOW - 9 * DAY) }] }),
        bug({ bugId: 'SM-2', assignee: 'asha', arb: ['ravi'] }),
        bug({ bugId: 'SM-3', assignee: 'ravi', arb: ['meera'] })
      ],
      { nowMs: NOW, knownUsers: known }
    );

    const ravi = out.queues.find((q) => q.user === 'ravi');
    assert.equal(ravi.count, 2);
    assert.equal(ravi.oldestDays, 9);
    assert.deepEqual(ravi.bugIds, ['SM-1', 'SM-2']);
    // Oldest wait leads — the question is what has been parked longest.
    assert.equal(out.queues[0].user, 'ravi');
    assert.match(out.sentence, /3 items parked on 2 people\./);
  });

  it('VER-PULSE-WAIT: a sink holds work and waits on nobody', () => {
    const out = computeWait(
      [
        // asha waits on ravi; ravi waits on meera; meera waits on no one.
        bug({ bugId: 'SM-1', assignee: 'asha', arb: ['ravi'] }),
        bug({ bugId: 'SM-2', assignee: 'ravi', arb: ['meera'] })
      ],
      { nowMs: NOW, knownUsers: known }
    );
    assert.deepEqual(out.sinks.map((s) => s.user), ['meera']);
  });

  it('VER-PULSE-WAIT: a standoff is a real two-cycle, not two busy people', () => {
    const cycle = computeWait(
      [
        bug({ bugId: 'SM-1', assignee: 'asha', arb: ['ravi'] }),
        bug({ bugId: 'SM-2', assignee: 'ravi', arb: ['asha'] })
      ],
      { nowMs: NOW, knownUsers: known }
    );
    assert.equal(cycle.standoffs.length, 1);
    assert.deepEqual([cycle.standoffs[0].a, cycle.standoffs[0].b].sort(), ['asha', 'ravi']);
    assert.deepEqual(cycle.standoffs[0].bugIds.sort(), ['SM-1', 'SM-2']);

    // Both busy, but the waiting does not point back: no standoff.
    const busy = computeWait(
      [
        bug({ bugId: 'SM-1', assignee: 'asha', arb: ['meera'] }),
        bug({ bugId: 'SM-2', assignee: 'ravi', arb: ['meera'] })
      ],
      { nowMs: NOW, knownUsers: known }
    );
    assert.deepEqual(busy.standoffs, []);
  });

  it('VER-PULSE-WAIT: unresolved ARB names are counted, never dropped', () => {
    // Free-text leftovers ("QA team", an ex-employee) must be visible, or the
    // messiest teams silently look the tidiest.
    const out = computeWait(
      [bug({ bugId: 'SM-1', assignee: 'asha', arb: ['ravi', 'QA team', 'former-dev'] })],
      { nowMs: NOW, knownUsers: known }
    );
    assert.equal(out.unresolvedArbCount, 2);
    assert.deepEqual(out.queues.map((q) => q.user), ['ravi']);
  });

  it('VER-PULSE-WAIT: Closed bugs never appear', () => {
    const out = computeWait(
      [
        bug({ bugId: 'SM-1', status: 'Closed', assignee: 'asha', arb: ['ravi'] }),
        bug({ bugId: 'SM-2', status: 'Open', assignee: 'asha', arb: ['ravi'] })
      ],
      { nowMs: NOW, knownUsers: known }
    );
    assert.equal(out.queues[0].count, 1);
    assert.deepEqual(out.queues[0].bugIds, ['SM-2']);
  });

  it('VER-PULSE-WAIT: self-parking is not a wait on anyone else', () => {
    // Assignee and ARB are the same person: it is their own queue, and it must
    // not manufacture an edge that could fake a standoff.
    const out = computeWait(
      [
        bug({ bugId: 'SM-1', assignee: 'asha', arb: ['asha'] }),
        bug({ bugId: 'SM-2', assignee: 'ravi', arb: ['asha'] })
      ],
      { nowMs: NOW, knownUsers: known }
    );
    assert.equal(out.queues.find((q) => q.user === 'asha').count, 2);
    assert.deepEqual(out.standoffs, []);
    // asha waits on nobody, so asha is the sink.
    assert.deepEqual(out.sinks.map((s) => s.user), ['asha']);
  });

  it('VER-PULSE-WAIT: an empty ARB field degrades, it does not claim nobody is waiting', () => {
    // "No queues" and "the field is unused" look identical on screen and mean
    // completely different things.
    const out = computeWait([bug({ bugId: 'SM-1', arb: [] }), bug({ bugId: 'SM-2', arb: [] })], {
      nowMs: NOW,
      knownUsers: known
    });
    assert.deepEqual(out.queues, []);
    assert.ok(out.degraded);
    assert.equal(out.degraded.metric, 'wait');
    assert.match(out.degraded.reason, /no Action Required By/);
  });

  it('VER-PULSE-WAIT: ARB accepts the stored shapes, and output never ranks people', () => {
    const out = computeWait(
      [
        bug({ bugId: 'SM-1', assignee: 'asha', arb: '["ravi"]' }),
        bug({ bugId: 'SM-2', assignee: 'asha', arb: 'ravi, meera' })
      ],
      { nowMs: NOW, knownUsers: known }
    );
    assert.equal(out.queues.find((q) => q.user === 'ravi').count, 2);
    assert.equal(out.queues.find((q) => q.user === 'meera').count, 1);
    const json = JSON.stringify(out);
    assert.equal(/worst|slowest|rank|score/i.test(json), false, 'never a performance report');
  });
});
