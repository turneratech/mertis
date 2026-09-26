const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeBrief } = require('../../pulse/brief');

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-01-01T00:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const sc = (from, to, at) => ({
  action: 'status_change',
  from,
  to,
  station: to === 'Resolved' ? 'qa' : to === 'In Progress' ? 'dev' : 'closed',
  timestamp: iso(at)
});

describe('Pulse Friday brief (deterministic)', () => {
  it('links every numbered clause to bug IDs and never invents a dwell', () => {
    const nowMs = T0 + 10 * DAY;
    const brief = computeBrief([
      {
        bugId: 'BR-BUG',
        status: 'Resolved',
        bugType: 'Bug',
        triagedAt: iso(T0 + 9 * DAY),
        created: iso(T0),
        activityLog: [
          sc('Open', 'In Progress', T0 + 2 * DAY),
          sc('In Progress', 'Resolved', T0 + 5 * DAY)
        ]
      },
      {
        bugId: 'BR-FEAT',
        status: 'Open',
        bugType: 'Feature',
        triagedAt: iso(T0 + 9 * DAY),
        created: iso(T0),
        activityLog: [{ action: 'created', timestamp: iso(T0) }]
      },
      {
        bugId: 'BR-PIT',
        status: 'Open',
        bugType: 'Bug',
        created: iso(T0 - DAY),
        activityLog: []
      }
    ], { nowMs });

    const byId = Object.fromEntries(brief.clauses.map((c) => [c.id, c]));
    assert.match(byId.mix.text, /firefighting/);
    assert.ok(byId.mix.evidence.includes('BR-BUG'));
    assert.match(byId.bottleneck.text, /QA/);
    assert.ok(byId.bottleneck.evidence.includes('BR-BUG'));
    assert.equal(byId.pit.text, 'Oldest Pit item is BR-PIT.');
    assert.deepEqual(byId.pit.evidence, ['BR-PIT']);
    assert.equal(byId.bottleneck.degraded, null);
  });

  it('degrades the queue clause on legacy history instead of inventing a number', () => {
    const brief = computeBrief([{
      bugId: 'BR-OLD',
      status: 'In Progress',
      bugType: 'Bug',
      triagedAt: '2026-01-01T00:00:00.000Z',
      created: '2026-01-01T00:00:00.000Z',
      activityLog: [{ action: 'updated', timestamp: '2026-01-02T00:00:00.000Z', message: 'Updated: status' }]
    }], { nowMs: Date.parse('2026-01-03T00:00:00.000Z') });
    const queue = brief.clauses.find((c) => c.id === 'bottleneck');
    assert.equal(queue.degraded, 'insufficient history');
    assert.equal(queue.evidence.length, 0);
    assert.doesNotMatch(queue.text, /\d+(\.\d+)?d/);
  });
});
