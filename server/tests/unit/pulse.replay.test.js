const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { replayBoard, changeSummary, statusAt, historyBoundary } = require('../../pulse/replay');

const DAY = 86400000;
const T0 = Date.UTC(2026, 8, 1); // 1 Sep 2026
const at = (d) => T0 + d * DAY;
const iso = (ms) => new Date(ms).toISOString();

const sc = (from, to, ms) => ({
  action: 'status_change',
  from,
  to,
  station: to === 'Closed' ? 'closed' : to === 'Reopened' ? 'dev_queue' : 'dev',
  timestamp: iso(ms)
});

// Born day 1, worked day 3, resolved day 5, closed day 7.
const walked = {
  bugId: 'RM-1',
  title: 'Timeout on import',
  status: 'Closed',
  severity: 'High',
  module: 'ingest',
  created: iso(at(1)),
  activityLog: [
    sc('Open', 'In Progress', at(3)),
    sc('In Progress', 'Resolved', at(5)),
    sc('Resolved', 'Closed', at(7))
  ]
};

describe('Pulse Replay [VER-PULSE-REPLAY]', () => {
  it('VER-PULSE-REPLAY: the board at T is the status in force at T', () => {
    assert.equal(statusAt(walked, at(2)), 'Open', 'before its first transition');
    assert.equal(statusAt(walked, at(4)), 'In Progress');
    assert.equal(statusAt(walked, at(6)), 'Resolved');
    assert.equal(statusAt(walked, at(8)), 'Closed');

    const board = replayBoard([walked], at(4));
    assert.equal(board.counts['In Progress'], 1);
    assert.equal(board.counts.Resolved, 0);
    assert.equal(board.total, 1);
    assert.equal(board.columns['In Progress'][0].bugId, 'RM-1');
  });

  it('VER-PULSE-REPLAY: a bug created after T is absent, not Open', () => {
    // Showing it as Open would invent a bug that did not exist yet.
    const later = {
      bugId: 'RM-LATE',
      title: 'Not born yet',
      status: 'Open',
      created: iso(at(10)),
      activityLog: [sc('Open', 'In Progress', at(12))]
    };
    const board = replayBoard([walked, later], at(4));
    assert.equal(board.notYetCreated, 1, 'RM-LATE did not exist on day 4');
    assert.equal(board.total, 1, 'only RM-1 is on the board');
    assert.equal(JSON.stringify(board.columns).includes('RM-LATE'), false);
  });

  it('VER-PULSE-REPLAY: the boundary outranks everything below it', () => {
    // Asking for a time before any structured history cannot be answered by
    // counting "not yet created" — we simply do not know what was there.
    const board = replayBoard([walked], at(0));
    assert.equal(board.total, 0);
    assert.equal(board.notYetCreated, 0, 'no claim is made about pre-boundary state');
    assert.match(board.degraded.reason, /replay starts/);
  });

  it('VER-PULSE-REPLAY: before the boundary it says so instead of showing an empty board', () => {
    // An empty board reads as "nothing was happening" — a lie about the past,
    // and the worst failure for a feature whose value is historical fidelity.
    const board = replayBoard([walked], at(-30));
    assert.equal(board.total, 0);
    assert.deepEqual(board.columns, {});
    assert.ok(board.degraded);
    assert.match(board.degraded.reason, /replay starts 2026-09-04/);
    assert.equal(board.boundary, iso(at(3)), 'boundary is the earliest real transition');
  });

  it('VER-PULSE-REPLAY: bugs with no structured history are excluded AND counted', () => {
    const legacy = {
      bugId: 'RM-2',
      title: 'Legacy',
      status: 'Open',
      created: iso(at(1)),
      activityLog: [{ action: 'updated', user: 'asha', timestamp: iso(at(2)), message: 'Open → Closed' }]
    };
    const board = replayBoard([walked, legacy], at(4));
    assert.equal(board.total, 1, 'only the bug we can actually place');
    assert.equal(board.withoutHistory, 1);
    assert.ok(board.degraded);
    assert.match(board.degraded.reason, /no structured history/);
    // English in an activity message must never become a status.
    assert.equal(JSON.stringify(board.columns).includes('RM-2'), false);
  });

  it('VER-PULSE-REPLAY: duplicated webhook rows are counted once', () => {
    // bug_activity has no unique constraint and the GitHub webhook can replay.
    const dupes = {
      ...walked,
      bugId: 'RM-3',
      activityLog: [
        sc('Open', 'In Progress', at(3)),
        sc('Open', 'In Progress', at(3)),
        sc('In Progress', 'Resolved', at(5))
      ]
    };
    assert.equal(statusAt(dupes, at(4)), 'In Progress');
    const summary = changeSummary([dupes], at(0), at(9));
    assert.equal(summary.landed, 0);
    assert.equal(summary.arrived, 1);
  });

  it('VER-PULSE-REPLAY: the change summary is arithmetic over the window', () => {
    const reopened = {
      bugId: 'RM-4',
      title: 'Bounce',
      status: 'Reopened',
      created: iso(at(1)),
      activityLog: [
        sc('Open', 'In Progress', at(2)),
        sc('In Progress', 'Closed', at(4)),
        sc('Closed', 'Reopened', at(6))
      ]
    };
    const arrivedLater = {
      bugId: 'RM-5',
      title: 'New arrival',
      status: 'Open',
      created: iso(at(5)),
      activityLog: [sc('Open', 'In Progress', at(8))]
    };

    const s = changeSummary([walked, reopened, arrivedLater], at(3), at(7));
    assert.equal(s.landed, 2, 'RM-1 and RM-4 both hit Closed inside the window');
    assert.equal(s.reopened, 1);
    assert.equal(s.arrived, 1, 'RM-5 was created inside the window');
    assert.match(s.sentence, /^Since 2026-09-04: /);
    assert.match(s.sentence, /2 landed/);
    assert.match(s.sentence, /1 reopened/);
  });

  it('VER-PULSE-REPLAY: events outside the window are not counted', () => {
    const s = changeSummary([walked], at(8), at(9));
    assert.equal(s.landed, 0, 'the close happened on day 7, before the window');
    assert.equal(s.arrived, 0);
  });

  it('VER-PULSE-REPLAY: a project with no structured history refuses outright', () => {
    const bare = { bugId: 'RM-9', status: 'Open', created: iso(at(1)), activityLog: [] };
    assert.ok(Number.isNaN(historyBoundary([bare])));
    const board = replayBoard([bare], at(5));
    assert.ok(board.degraded);
    assert.match(board.degraded.reason, /nothing to replay/);
    assert.equal(board.boundary, null);
  });

  it('VER-PULSE-REPLAY: replaying now agrees with the bug\'s current status', () => {
    // The strongest self-check: the past rewound to the present must match
    // what the tracker says today.
    const board = replayBoard([walked], at(30));
    assert.equal(board.columns.Closed[0].bugId, 'RM-1');
    assert.equal(walked.status, 'Closed');
  });
});
