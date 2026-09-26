const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeGravity } = require('../../pulse/gravity');

const iso = (n) => new Date(n).toISOString();
const sc = (from, to, at) => ({
  action: 'status_change', from, to,
  station: to === 'Reopened' ? 'dev_queue' : to === 'Closed' ? 'closed' : 'dev',
  timestamp: iso(at)
});

describe('Pulse reopen gravity §12.4', () => {
  it('Closed→Reopened is gravity 1 and ranks the module, never an assignee', () => {
    const gravity = computeGravity([{
      bugId: 'GV-1',
      status: 'Reopened',
      module: 'Auth',
      assignee: 'alice',
      created: iso(0),
      activityLog: [
        sc('Open', 'Closed', 1000),
        sc('Closed', 'Reopened', 2000)
      ]
    }], { nowMs: 3000 });
    assert.equal(gravity.byBugId['GV-1'], 1);
    assert.equal(gravity.ranking[0].module, 'Auth');
    assert.equal(gravity.ranking[0].gravity, 1);
    assert.deepEqual(gravity.ranking[0].evidence, ['GV-1']);
    assert.equal(gravity.sentence, 'Top bounce: Auth (1).');
    assert.equal(JSON.stringify(gravity).includes('alice'), false);
  });

  it('empty bounce is a sentence, not a person table', () => {
    const gravity = computeGravity([{
      bugId: 'GV-2',
      status: 'Open',
      module: 'UI',
      assignee: 'bob',
      created: iso(0),
      activityLog: []
    }], { nowMs: 1000 });
    assert.equal(gravity.byBugId['GV-2'], 0);
    assert.equal(gravity.ranking.length, 0);
    assert.equal(gravity.sentence, 'No reopen gravity yet.');
  });

  it('VER-PULSE-GRAV: English “Reopened” comment does not count', () => {
    const gravity = computeGravity([{
      bugId: 'GV-3',
      status: 'Closed',
      module: 'Auth',
      assignee: 'alice',
      created: iso(0),
      activityLog: [
        { action: 'comment', timestamp: iso(1000), message: 'Reopened by alice' }
      ]
    }], { nowMs: 2000 });
    assert.equal(gravity.byBugId['GV-3'], 0);
    assert.equal(gravity.ranking.length, 0);
  });
});
