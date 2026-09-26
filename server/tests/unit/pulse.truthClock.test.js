const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { truthClock } = require('../../pulse/truthClock');

describe('Pulse truthClock §12.6', () => {
  it('ignores updated and created', () => {
    const clock = truthClock({
      created: '2026-01-01T00:00:00.000Z',
      activityLog: [
        { action: 'created', timestamp: '2026-01-01T00:00:00.000Z', user: 'priya' },
        { action: 'updated', timestamp: '2026-09-16T12:00:00.000Z', user: 'priya' }
      ]
    });
    assert.equal(clock.hasActivity, false);
  });

  it('uses latest status_change', () => {
    const clock = truthClock({
      created: '2026-01-01T00:00:00.000Z',
      activityLog: [
        { action: 'status_change', timestamp: '2026-09-01T10:00:00.000Z', user: 'priya' },
        { action: 'comment', timestamp: '2026-09-02T10:00:00.000Z', user: 'sam' }
      ]
    });
    assert.equal(clock.hasActivity, true);
    assert.equal(clock.lastRealActivityAt, '2026-09-02T10:00:00.000Z');
  });

  it('skips configured bots', () => {
    const clock = truthClock({
      created: '2026-01-01T00:00:00.000Z',
      activityLog: [
        { action: 'commit', timestamp: '2026-09-16T08:00:00.000Z', user: 'dependabot' },
        { action: 'assigned', timestamp: '2026-09-10T08:00:00.000Z', user: 'priya' }
      ]
    }, ['dependabot']);
    assert.equal(clock.lastRealActivityAt, '2026-09-10T08:00:00.000Z');
  });
});
