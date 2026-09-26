const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeDeck } = require('../../pulse/deck');

const iso = (n) => new Date(n).toISOString();

describe('Pulse Command Deck VER-PULSE-DECK', () => {
  it('VER-PULSE-DECK: one project skips to Strike', () => {
    const deck = computeDeck([{
      projectKey: 'SOLO',
      projectName: 'Solo',
      bugs: [{ bugId: 'SO-1', status: 'Open', bugType: 'Bug', triagedAt: iso(1), activityLog: [] }]
    }]);
    assert.equal(deck.skipToStrike, 'SOLO');
    assert.equal(deck.rows.length, 1);
  });

  it('VER-PULSE-DECK: two projects stay on Deck and reuse brief clauses', () => {
    const deck = computeDeck([
      {
        projectKey: 'AA',
        projectName: 'Alpha',
        bugs: [{
          bugId: 'AA-PIT',
          status: 'Open',
          bugType: 'Bug',
          created: iso(1),
          activityLog: []
        }]
      },
      {
        projectKey: 'BB',
        projectName: 'Beta',
        bugs: [{
          bugId: 'BB-1',
          status: 'Open',
          bugType: 'Feature',
          triagedAt: iso(1),
          activityLog: []
        }]
      }
    ]);
    assert.equal(deck.skipToStrike, null);
    assert.equal(deck.rows.length, 2);
    const pit = deck.rows[0].clauses.find((c) => c.id === 'pit');
    assert.equal(pit.text, 'Oldest Pit item is AA-PIT.');
    const mix = deck.rows[1].clauses.find((c) => c.id === 'mix');
    assert.ok(mix);
  });

  it('VER-PULSE-DECK: missing Line degrades, never invents dwell', () => {
    const deck = computeDeck([{
      projectKey: 'LG',
      projectName: 'Legacy',
      bugs: [{
        bugId: 'LG-1',
        status: 'In Progress',
        bugType: 'Bug',
        triagedAt: iso(1),
        created: iso(1),
        activityLog: [{ action: 'updated', timestamp: iso(2), message: 'Updated: status' }]
      }],
      opts: { nowMs: 3 }
    }, {
      projectKey: 'OK',
      projectName: 'Ok',
      bugs: []
    }]);
    assert.equal(deck.skipToStrike, null);
    const queue = deck.rows[0].clauses.find((c) => c.id === 'bottleneck');
    assert.equal(queue.degraded, 'insufficient history');
    assert.doesNotMatch(queue.text, /\d+(\.\d+)?d/);
    assert.ok((deck.rows[0].degraded || []).some((row) => row.metric === 'line'));
  });
});
