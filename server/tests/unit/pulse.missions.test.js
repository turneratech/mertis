const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeMissionMap } = require('../../pulse/missions');

const iso = (n) => new Date(n).toISOString();
const reopen = (id, moduleName) => ({
  bugId: id,
  module: moduleName,
  bugType: 'Bug',
  status: 'Reopened',
  activityLog: [
    { action: 'status_change', from: 'Open', to: 'Closed', timestamp: iso(500) },
    { action: 'status_change', from: 'Closed', to: 'Reopened', timestamp: iso(1000) }
  ]
});

describe('Pulse missions VER-PULSE-MIS', () => {
  it('VER-PULSE-MIS: gravity well is reopen gravity of the claimed set, not a person', () => {
    const map = computeMissionMap({
      bugs: [
        reopen('MS-1', 'Auth'),
        reopen('MS-2', 'Auth'),
        { bugId: 'MS-3', module: 'Auth', bugType: 'Feature', assignee: 'alice', activityLog: [] }
      ],
      missions: [{ id: 'm1', title: 'Land Auth', intent: 'Ship login', status: 'striking' }],
      links: [{ bugId: 'MS-1', missionId: 'm1' }, { bugId: 'MS-2', missionId: 'm1' }]
    });
    const mission = map.missions[0];
    assert.deepEqual(mission.bugIds, ['MS-1', 'MS-2']);
    assert.equal(mission.gravity.total, 2);
    assert.equal(mission.gravity.ranking[0].module, 'Auth');
    assert.equal(JSON.stringify(mission).includes('alice'), false);
    assert.equal(mission.qualityTax.percent, 100);
    assert.deepEqual(map.unclaimed.bugIds, ['MS-3']);
  });

  it('VER-PULSE-MIS: unclaimed bugs are listed when they have no mission', () => {
    const map = computeMissionMap({
      bugs: [{ bugId: 'MS-A', bugType: 'Task' }, { bugId: 'MS-B', bugType: 'Task' }],
      missions: [{ id: 'm1', title: 'One', intent: 'Do one thing' }],
      links: [{ bugId: 'MS-A', missionId: 'm1' }]
    });
    assert.deepEqual(map.unclaimed.bugIds, ['MS-B']);
    assert.equal(map.unclaimed.count, 1);
  });

  it('VER-PULSE-MIS: English Reopened comment is gravity 0 on the mission set', () => {
    const map = computeMissionMap({
      bugs: [{
        bugId: 'MS-ENG',
        module: 'Core',
        bugType: 'Bug',
        activityLog: [{ action: 'comment', message: 'Reopened', timestamp: iso(1) }]
      }],
      missions: [{ id: 'm1', title: 'Core', intent: 'Hold the line' }],
      links: [{ bugId: 'MS-ENG', missionId: 'm1' }]
    });
    assert.equal(map.missions[0].gravity.total, 0);
    assert.equal(map.missions[0].gravity.sentence, 'No reopen gravity yet.');
  });

  it('VER-PULSE-MIS: empty mission degrades tax, never 0%', () => {
    const map = computeMissionMap({
      bugs: [{ bugId: 'MS-X', bugType: 'Bug' }],
      missions: [{ id: 'empty', title: 'Empty', intent: 'Nothing claimed yet' }],
      links: []
    });
    const tax = map.missions[0].qualityTax;
    assert.equal(tax.percent, null);
    assert.equal(tax.degraded.metric, 'qualityTax');
    assert.deepEqual(map.unclaimed.bugIds, ['MS-X']);
  });

  it('one bug cannot sit in two missions in the map', () => {
    const map = computeMissionMap({
      bugs: [{ bugId: 'MS-1', bugType: 'Bug' }],
      missions: [
        { id: 'm1', title: 'A', intent: 'A' },
        { id: 'm2', title: 'B', intent: 'B' }
      ],
      links: [
        { bugId: 'MS-1', missionId: 'm1' },
        { bugId: 'MS-1', missionId: 'm2' }
      ]
    });
    assert.deepEqual(map.missions[0].bugIds, ['MS-1']);
    assert.deepEqual(map.missions[1].bugIds, []);
  });
});
