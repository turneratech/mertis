const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { computeProjectLine, reconstructBug, uniqueCommits } = require('../../pulse/line');

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-01-01T00:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

const sc = (from, to, at, station) => ({
  action: 'status_change',
  from,
  to,
  station: station || (to === 'Open' || to === 'Reopened' ? 'dev_queue'
    : to === 'In Progress' ? 'dev'
      : to === 'Resolved' ? 'qa'
        : 'closed'),
  timestamp: iso(at)
});

describe('Pulse line §12.1–12.2 / §12.9', () => {
  it('linear Open-IP-Resolved-Closed dwell matches constructed timestamps', () => {
    const nowMs = T0 + 10 * DAY;
    const bug = {
      bugId: 'LN-1',
      status: 'Closed',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 2 * DAY),
        sc('In Progress', 'Resolved', T0 + 5 * DAY),
        sc('Resolved', 'Closed', T0 + 6 * DAY)
      ]
    };
    const timeline = reconstructBug(bug, nowMs);
    assert.equal(timeline.included, true);
    assert.equal(timeline.dwellMs.dev_queue, 2 * DAY);
    assert.equal(timeline.dwellMs.dev, 3 * DAY);
    assert.equal(timeline.dwellMs.qa, 1 * DAY);
    assert.equal(timeline.dwellMs.closed, 4 * DAY);
  });

  it('reopened bug sums two dev intervals and gravity is 1', () => {
    const nowMs = T0 + 7 * DAY;
    const bug = {
      bugId: 'LN-2',
      status: 'Closed',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 1 * DAY),
        sc('In Progress', 'Resolved', T0 + 2 * DAY),
        sc('Resolved', 'Closed', T0 + 3 * DAY),
        sc('Closed', 'Reopened', T0 + 4 * DAY),
        sc('Reopened', 'In Progress', T0 + 5 * DAY),
        sc('In Progress', 'Closed', T0 + 6 * DAY)
      ]
    };
    const timeline = reconstructBug(bug, nowMs);
    assert.equal(timeline.reopenGravity, 1);
    assert.equal(timeline.dwellMs.dev, 2 * DAY);
  });

  it('bug with no activity is excluded, not zero', () => {
    const timeline = reconstructBug({
      bugId: 'LN-3',
      status: 'Open',
      created: iso(T0),
      activityLog: [{ action: 'created', timestamp: iso(T0) }]
    }, T0 + DAY);
    assert.equal(timeline.included, false);
    assert.equal(timeline.reason, 'no activity');
    assert.deepEqual(timeline.dwellMs, {});
  });

  it('duplicate commit rows are counted once', () => {
    const stamp = iso(T0 + DAY);
    const commits = uniqueCommits([{
      bugId: 'LN-4',
      activityLog: [
        { action: 'commit', timestamp: stamp, message: 'LN-4 fix' },
        { action: 'commit', timestamp: stamp, message: 'LN-4 fix' }
      ]
    }]);
    assert.equal(commits.length, 1);
  });

  it('legacy updated-only CSV rows are insufficient history', () => {
    const timeline = reconstructBug({
      bugId: 'LN-5',
      status: 'In Progress',
      created: iso(T0),
      activityLog: [
        { action: 'updated', timestamp: iso(T0 + DAY), message: 'status changed' }
      ]
    }, T0 + 2 * DAY);
    assert.equal(timeline.included, false);
    assert.equal(timeline.reason, 'insufficient history');
  });

  it('project with zero commits reports no commit data, never 0', () => {
    const nowMs = T0 + 10 * DAY;
    const linear = {
      bugId: 'LN-1',
      status: 'Closed',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 2 * DAY),
        sc('In Progress', 'Resolved', T0 + 5 * DAY),
        sc('Resolved', 'Closed', T0 + 6 * DAY)
      ]
    };
    const line = computeProjectLine([linear], { nowMs });
    assert.equal(line.fixVerifyGap.count, null);
    assert.equal(line.fixVerifyGap.reason, 'no commit data');
    assert.ok(line.degraded.some((row) => row.metric === 'fixVerifyGap'));
  });

  it('bottleneck is median dwell times current count, not greatest count', () => {
    const nowMs = T0 + 10 * DAY;
    const closedLinear = {
      bugId: 'LN-CLOSED',
      status: 'Closed',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 2 * DAY),
        sc('In Progress', 'Resolved', T0 + 5 * DAY),
        sc('Resolved', 'Closed', T0 + 6 * DAY)
      ]
    };
    const inQa = {
      bugId: 'LN-QA',
      status: 'Resolved',
      qaStatus: 'Not Started',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 1 * DAY),
        sc('In Progress', 'Resolved', T0 + 2 * DAY)
      ]
    };
    const line = computeProjectLine([closedLinear, inQa], { nowMs });
    // Hand compute: only LN-QA is at an active station (qa).
    // qa samples: closedLinear 1d + inQa 8d → median interpolates to 4.5d
    // currentCount qa = 1 → bottleneck qa.
    assert.equal(line.bottleneck.station, 'qa');
    assert.equal(line.bottleneck.currentCount, 1);
    assert.equal(line.stations.qa.medianMs, 4.5 * DAY);
    assert.equal(line.bottleneck.score, 4.5 * DAY);
  });

  it('same seeded dataset yields identical numbers when cloned', () => {
    const nowMs = T0 + 10 * DAY;
    const bugs = [{
      bugId: 'LN-1',
      status: 'Resolved',
      qaStatus: 'Not Started',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 2 * DAY),
        sc('In Progress', 'Resolved', T0 + 5 * DAY)
      ]
    }];
    const a = computeProjectLine(bugs, { nowMs });
    const b = computeProjectLine(JSON.parse(JSON.stringify(bugs)), { nowMs });
    assert.deepEqual(a.stations, b.stations);
    assert.deepEqual(a.bottleneck, b.bottleneck);
    assert.deepEqual(a.fixVerifyGap, b.fixVerifyGap);
  });

  it('does not parse English activity messages', () => {
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../pulse/line.js'), 'utf8');
    assert.equal(src.includes('Updated:'), false);
    assert.equal(/\u2192/.test(src), false);
  });

  it('VER-PULSE-GAP: commit then Resolved reports the wait, duplicate commits count once', () => {
    const nowMs = T0 + 10 * DAY;
    const stamp = iso(T0 + 4 * DAY);
    const waiting = {
      bugId: 'LN-GAP',
      status: 'Resolved',
      qaStatus: 'Not Started',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 2 * DAY),
        { action: 'commit', timestamp: stamp, message: 'LN-GAP fix', user: 'priya' },
        { action: 'commit', timestamp: stamp, message: 'LN-GAP fix', user: 'priya' },
        sc('In Progress', 'Resolved', T0 + 6 * DAY)
      ]
    };
    const line = computeProjectLine([waiting], { nowMs });
    assert.equal(line.fixVerifyGap.count, 1);
    assert.equal(line.fixVerifyGap.reason, null);
    assert.equal(line.fixVerifyGap.medianMs, 2 * DAY);
    assert.deepEqual(line.fixVerifyGap.evidence, ['LN-GAP']);
    assert.match(line.fixVerifyGap.sentence, /1 waiting on QA after a commit/);
    assert.equal(line.degraded.some((row) => row.metric === 'fixVerifyGap'), false);
    assert.equal(uniqueCommits([waiting]).length, 1);
  });

  it('VER-PULSE-GAP: commit on another bug is ignored; bot-only commits degrade', () => {
    const nowMs = T0 + 10 * DAY;
    const other = {
      bugId: 'LN-OTHER',
      status: 'In Progress',
      qaStatus: 'Not Started',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 1 * DAY),
        { action: 'commit', timestamp: iso(T0 + 2 * DAY), message: 'LN-OTHER', user: 'priya' }
      ]
    };
    const waiting = {
      bugId: 'LN-WAIT',
      status: 'In Progress',
      qaStatus: 'Not Started',
      created: iso(T0),
      activityLog: [sc('Open', 'In Progress', T0 + 1 * DAY)]
    };
    const withOther = computeProjectLine([waiting, other], { nowMs });
    assert.equal(withOther.fixVerifyGap.count, 1);
    assert.deepEqual(withOther.fixVerifyGap.evidence, ['LN-OTHER']);
    assert.equal(withOther.fixVerifyGap.evidence.includes('LN-WAIT'), false);

    const botOnly = computeProjectLine([{
      bugId: 'LN-BOT',
      status: 'Resolved',
      qaStatus: 'Not Started',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 1 * DAY),
        { action: 'commit', timestamp: iso(T0 + 2 * DAY), message: 'deps', user: 'dependabot' },
        sc('In Progress', 'Resolved', T0 + 3 * DAY)
      ]
    }], { nowMs, botUsers: ['dependabot'] });
    assert.equal(botOnly.fixVerifyGap.count, null);
    assert.equal(botOnly.fixVerifyGap.reason, 'no commit data');
    assert.ok(botOnly.degraded.some((row) => row.metric === 'fixVerifyGap'));
  });

  it('VER-PULSE-GAP: commits with QA underway count 0, not degraded', () => {
    const nowMs = T0 + 10 * DAY;
    const verified = {
      bugId: 'LN-OK',
      status: 'Resolved',
      qaStatus: 'Testing',
      created: iso(T0),
      activityLog: [
        sc('Open', 'In Progress', T0 + 2 * DAY),
        { action: 'commit', timestamp: iso(T0 + 3 * DAY), message: 'LN-OK', user: 'priya' },
        sc('In Progress', 'Resolved', T0 + 4 * DAY)
      ]
    };
    const line = computeProjectLine([verified], { nowMs });
    assert.equal(line.fixVerifyGap.count, 0);
    assert.equal(line.fixVerifyGap.reason, null);
    assert.match(line.fixVerifyGap.sentence, /No fix–verify gap/);
    assert.equal(line.degraded.some((row) => row.metric === 'fixVerifyGap'), false);
  });
});
