const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveNextMove } = require('../../pulse/nextMove');

describe('Pulse nextMove §12.7', () => {
  it('Closed has nobody', () => {
    const move = resolveNextMove({ status: 'Closed', assignee: 'priya', arb: ['alex'] });
    assert.equal(move.user, null);
    assert.equal(move.role, null);
  });

  it('Resolved + QA not started goes to qa_owner', () => {
    const move = resolveNextMove({
      status: 'Resolved',
      qaStatus: 'Not Started',
      qaOwner: 'sam',
      assignee: 'priya'
    });
    assert.equal(move.user, 'sam');
    assert.equal(move.role, 'qa');
  });

  it('Resolved without QA owner is labelled qa?', () => {
    const move = resolveNextMove({
      status: 'Resolved',
      qaStatus: 'Testing',
      assignee: 'priya'
    });
    assert.equal(move.user, 'priya');
    assert.equal(move.role, 'qa?');
  });

  it('Failed QA bounces to assignee as dev', () => {
    const move = resolveNextMove({ status: 'In Progress', qaStatus: 'Failed', assignee: 'priya' });
    assert.equal(move.user, 'priya');
    assert.equal(move.role, 'dev');
  });

  it('single ARB is the face', () => {
    const move = resolveNextMove({ status: 'Open', assignee: 'priya', arb: ['alex'] }, new Set(['alex', 'priya']));
    assert.equal(move.user, 'alex');
    assert.equal(move.role, 'arb');
    assert.equal(move.extraCount, 0);
  });

  it('multi ARB shows +N and does not hide extras', () => {
    const move = resolveNextMove(
      { status: 'Open', assignee: 'priya', arb: ['alex', 'jordan'] },
      new Set(['alex', 'jordan', 'priya'])
    );
    assert.equal(move.role, 'arb');
    assert.equal(move.extraCount, 1);
  });

  it('assignee is dev when no ARB', () => {
    const move = resolveNextMove({ status: 'In Progress', assignee: 'priya', arb: [] });
    assert.equal(move.user, 'priya');
    assert.equal(move.role, 'dev');
  });

  it('unassigned open bug is triage', () => {
    const move = resolveNextMove({ status: 'Open', assignee: '', arb: [] });
    assert.equal(move.role, 'triage');
  });
});
