const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeHorizon } = require('../../pulse/horizon');
const { computeMissionMap } = require('../../pulse/missions');

const iso = (n) => new Date(n).toISOString();

describe('Pulse Horizon VER-PULSE-HOR', () => {
  it('VER-PULSE-HOR: bars are missions, never bugs', () => {
    const map = computeMissionMap({
      bugs: [
        { bugId: 'HZ-1', created: iso(1000) },
        { bugId: 'HZ-2', created: iso(2000) },
        { bugId: 'HZ-U', created: iso(1500) }
      ],
      missions: [
        { id: 'm1', title: 'Land login', status: 'striking', createdAt: iso(1000), targetDate: iso(5000) },
        { id: 'm2', title: 'Ship reports', status: 'hunting', createdAt: iso(2000), targetDate: iso(8000) }
      ],
      links: [
        { bugId: 'HZ-1', missionId: 'm1' },
        { bugId: 'HZ-2', missionId: 'm2' }
      ]
    });
    const horizon = computeHorizon({
      missions: map.missions,
      bugs: [
        { bugId: 'HZ-1', created: iso(1000) },
        { bugId: 'HZ-2', created: iso(2000) },
        { bugId: 'HZ-U', created: iso(1500) }
      ],
      unclaimed: map.unclaimed
    });
    assert.equal(horizon.bars.length, 2);
    assert.equal(horizon.bars.some((bar) => bar.missionId === 'HZ-1' || bar.title === 'HZ-1'), false);
    assert.equal(JSON.stringify(horizon.bars).includes('HZ-U'), false);
    assert.equal(horizon.unclaimedCount, 1);
    assert.equal(horizon.criticalPath.missionId, 'm2');
    assert.equal(horizon.degraded, null);
  });

  it('VER-PULSE-HOR: no mission dates degrades, never a fake chart', () => {
    const horizon = computeHorizon({
      missions: [{ id: 'empty', title: 'Soon', status: 'hunting', bugIds: [] }],
      bugs: [{ bugId: 'HZ-X' }],
      unclaimed: { bugIds: ['HZ-X'], count: 1 }
    });
    assert.equal(horizon.range, null);
    assert.equal(horizon.bars[0].leftPct, null);
    assert.equal(horizon.degraded[0].metric, 'horizon');
    assert.equal(horizon.degraded[0].reason, 'no mission dates');
  });

  it('empty mission list degrades', () => {
    const horizon = computeHorizon({ missions: [], bugs: [], unclaimed: { count: 0 } });
    assert.equal(horizon.bars.length, 0);
    assert.equal(horizon.degraded[0].reason, 'no missions');
  });
});
