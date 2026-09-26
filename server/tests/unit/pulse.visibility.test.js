const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  canUserAccessProject,
  canUserViewBug,
  filterBugsForUser
} = require('../../utils/bugVisibility');
const { isPitItem, isTriaged } = require('../../pulse/projections');

describe('Pulse visibility + Pit membership VER-PULSE-VIS', () => {
  it('non-member is denied a project they are not on', () => {
    const keys = new Set(['ALPHA']);
    assert.equal(canUserAccessProject('SM', false, keys), false);
    assert.equal(canUserAccessProject('ALPHA', false, keys), true);
    assert.equal(canUserAccessProject('sm', true, keys), true);
  });

  it('outsider cannot view a bug they do not own', () => {
    const bug = { bugId: 'SM-1', projectKey: 'SM', assignee: 'priya', reporter: 'admin', arb: [] };
    assert.equal(canUserViewBug(bug, 'outsider', false, new Set()), false);
    assert.equal(canUserViewBug(bug, 'priya', false, new Set()), true);
  });

  it('filter drops other projects for a regular user', () => {
    const bugs = [
      { bugId: 'SM-1', projectKey: 'SM' },
      { bugId: 'AL-1', projectKey: 'ALPHA', assignee: 'outsider' }
    ];
    const visible = filterBugsForUser(bugs, 'outsider', false, new Set(['ALPHA']));
    assert.deepEqual(visible.map((row) => row.bugId), ['AL-1']);
  });

  it('empty list has no Pit items; Closed and triaged stay off The Pit', () => {
    assert.equal([].filter(isPitItem).length, 0);
    assert.equal(isPitItem({ status: 'Open' }), true);
    assert.equal(isPitItem({ status: 'Closed' }), false);
    assert.equal(isPitItem({ status: 'Open', triagedAt: '2026-09-16T00:00:00.000Z' }), false);
    assert.equal(isTriaged({ triaged_at: '2026-09-16T00:00:00.000Z' }), true);
  });
});
