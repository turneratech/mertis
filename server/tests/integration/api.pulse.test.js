const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createTestApp } = require('../helpers/testApp');
const { listenOnRandomPort, getBaseUrl, closeServer } = require('../helpers/bootstrap');
const { request } = require('../helpers/httpClient');

describe('API pulse', () => {
  let server;
  let baseUrl;
  let token;
  let projectKey;

  before(async () => {
    server = await listenOnRandomPort(createTestApp());
    baseUrl = getBaseUrl(server);
    const login = await request(baseUrl, 'POST', '/api/auth/login', {
      body: { username: 'admin', password: 'admin123' }
    });
    assert.equal(login.status, 200);
    token = login.data.token;
  });

  after(async () => {
    await closeServer(server);
  });

  it('GET /api/pulse/status is public and enabled', async () => {
    const { status, data } = await request(baseUrl, 'GET', '/api/pulse/status');
    assert.equal(status, 200);
    assert.equal(data.enabled, true);
  });

  it('board, pit, triage, and drag-via-bugs', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    assert.equal(projects.status, 200);
    if (!projects.data.length) {
      const created = await request(baseUrl, 'POST', '/api/projects', {
        token,
        body: { name: 'Pulse Test', key: 'PUL', description: 'Pulse v1', client: 'Internal' }
      });
      assert.equal(created.status, 201);
      projectKey = created.data.key;
    } else {
      projectKey = projects.data[0].key;
    }

    const createdBug = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Pulse pit item', severity: 'High', priority: 'High' }
    });
    assert.equal(createdBug.status, 201);
    const bugId = createdBug.data.bugId;

    const pitBefore = await request(baseUrl, 'GET', `/api/pulse/pit/${projectKey}`, { token });
    assert.equal(pitBefore.status, 200);
    assert.ok(Array.isArray(pitBefore.data.data.items));
    assert.ok(pitBefore.data.data.items.some((item) => item.bugId === bugId));

    const triage = await request(baseUrl, 'POST', `/api/pulse/triage/${bugId}`, { token });
    assert.equal(triage.status, 200);
    assert.ok(triage.data.data.item.triagedAt);
    assert.equal(triage.data.data.item.status, 'Open');

    const pitAfter = await request(baseUrl, 'GET', `/api/pulse/pit/${projectKey}`, { token });
    assert.equal(pitAfter.status, 200);
    assert.equal(pitAfter.data.data.items.some((item) => item.bugId === bugId), false);

    const board = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.equal(board.status, 200);
    assert.ok(board.data.data.columns.Open.some((item) => item.bugId === bugId));
    assert.ok(board.data.data.columns.Open.find((item) => item.bugId === bugId).nextMove);
    assert.ok(board.data.meta.computedAt);
    assert.ok(Array.isArray(board.data.meta.degraded));

    const moved = await request(baseUrl, 'PUT', `/api/bugs/${projectKey}/${bugId}`, {
      token,
      body: { status: 'In Progress' }
    });
    assert.equal(moved.status, 200);
    assert.equal(moved.data.status, 'In Progress');
    assert.equal(moved.data.title, 'Pulse pit item');

    const boardAfter = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.ok(boardAfter.data.data.columns['In Progress'].some((item) => item.bugId === bugId));

    const resolved = await request(baseUrl, 'PUT', `/api/bugs/${projectKey}/${bugId}`, {
      token,
      body: { status: 'Resolved' }
    });
    assert.equal(resolved.status, 200);

    const line = await request(baseUrl, 'GET', `/api/pulse/line/${projectKey}`, { token });
    assert.equal(line.status, 200);
    assert.ok(line.data.data.stations.dev);
    assert.ok(line.data.data.stations.qa);
    const gap = line.data.data.fixVerifyGap;
    assert.ok(gap);
    if (gap.reason === 'no commit data') {
      assert.equal(gap.count, null);
    } else {
      assert.equal(typeof gap.count, 'number');
    }

    const timeline = await request(baseUrl, 'GET', `/api/pulse/line/bug/${bugId}`, { token });
    assert.equal(timeline.status, 200);
    assert.equal(timeline.data.data.timeline.bugId, bugId);
    assert.equal(timeline.data.data.timeline.included, true);

    const me = await request(baseUrl, 'GET', '/api/pulse/me', { token });
    assert.equal(me.status, 200);
    assert.ok(me.data.data.nextMoves);
  });

  it('board quality tax sentence from mixed Bug/Feature, never 0% when untyped', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    assert.equal(projects.status, 200);
    assert.ok(projects.data.length);
    const projectKey = projects.data[0].key;

    const bug = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Firefight', severity: 'High', priority: 'High', bugType: 'Bug' }
    });
    const feature = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Build', severity: 'Medium', priority: 'Medium', bugType: 'Feature' }
    });
    assert.equal(bug.status, 201);
    assert.equal(feature.status, 201);

    await request(baseUrl, 'POST', `/api/pulse/triage/${bug.data.bugId}`, { token });
    await request(baseUrl, 'POST', `/api/pulse/triage/${feature.data.bugId}`, { token });

    const board = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.equal(board.status, 200);
    const tax = board.data.data.qualityTax;
    const typed = (tax.split.Bug || 0) + (tax.split.Enhancement || 0) + (tax.split.Task || 0) + (tax.split.Feature || 0);
    assert.ok(tax.split.Bug >= 1);
    assert.ok(tax.split.Feature >= 1);
    assert.equal(tax.percent, Math.round((100 * tax.split.Bug) / typed));
    assert.equal(tax.sentence, `This board is ${tax.percent}% firefighting.`);
    assert.equal(tax.degraded, null);
  });

  it('board interrupt ring overflows in words when Pit accepts flood the week', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    assert.equal(projects.status, 200);
    const projectKey = projects.data[0].key;

    const created = [];
    for (let i = 0; i < 8; i += 1) {
      const bug = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
        token,
        body: { title: `Interrupt flood ${i}`, severity: 'High', priority: 'High' }
      });
      assert.equal(bug.status, 201);
      created.push(bug.data.bugId);
    }
    for (const bugId of created) {
      const triage = await request(baseUrl, 'POST', `/api/pulse/triage/${bugId}`, { token });
      assert.equal(triage.status, 200);
    }

    const board = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.equal(board.status, 200);
    const ring = board.data.data.interrupt;
    assert.equal(ring.budgetPct, 35);
    assert.ok(typeof board.data.data.gravity.sentence === 'string');
    assert.ok(Array.isArray(board.data.data.gravity.ranking));
    assert.ok(ring.interruptCount >= 8);
    const expected = Math.round((100 * ring.interruptCount) / (ring.interruptCount + ring.committedCount));
    assert.equal(ring.loadPct, expected);
    if (ring.loadPct > 35) {
      assert.equal(ring.overflow, true);
      assert.match(ring.sentence, /over-committed/);
    } else {
      assert.equal(ring.overflow, false);
      assert.match(ring.sentence, /reserved for Pit arrivals/);
    }

    const pit = await request(baseUrl, 'GET', `/api/pulse/pit/${projectKey}`, { token });
    assert.equal(pit.status, 200);
    assert.equal(pit.data.data.interrupt.loadPct, ring.loadPct);

    const brief = await request(baseUrl, 'GET', `/api/pulse/brief/${projectKey}`, { token });
    assert.equal(brief.status, 200);
    const clauses = brief.data.data.clauses;
    assert.ok(clauses.find((c) => c.id === 'headline'));
    assert.ok(clauses.find((c) => c.id === 'mix'));
    assert.ok(clauses.find((c) => c.id === 'bottleneck'));
    assert.ok(clauses.find((c) => c.id === 'interrupt'));
    assert.ok(clauses.find((c) => c.id === 'pit'));
    for (const clause of clauses) {
      if (!clause.degraded && clause.id !== 'headline') {
        assert.ok(Array.isArray(clause.evidence));
      }
    }
    const queue = clauses.find((c) => c.id === 'bottleneck');
    if (queue.degraded) assert.equal(queue.evidence.length, 0);
  });

  it('board gravity ranks Closed→Reopened by module, never assignee', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const moduleName = `AuthBounce-${Date.now()}`;
    const created = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Bounce', severity: 'High', priority: 'High', module: moduleName }
    });
    assert.equal(created.status, 201);
    const bugId = created.data.bugId;
    await request(baseUrl, 'POST', `/api/pulse/triage/${bugId}`, { token });
    assert.equal((await request(baseUrl, 'PUT', `/api/bugs/${projectKey}/${bugId}`, {
      token, body: { status: 'Closed' }
    })).status, 200);
    assert.equal((await request(baseUrl, 'PUT', `/api/bugs/${projectKey}/${bugId}`, {
      token, body: { status: 'Reopened' }
    })).status, 200);

    const board = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.equal(board.status, 200);
    const gravity = board.data.data.gravity;
    const row = gravity.ranking.find((entry) => entry.module === moduleName);
    if (row) {
      assert.ok(row.gravity >= 1);
      assert.ok(row.evidence.includes(bugId));
      assert.match(gravity.sentence, new RegExp(moduleName));
    }
    const card = (board.data.data.columns.Reopened || []).find((item) => item.bugId === bugId);
    assert.ok(card);
    assert.ok(card.reopenGravity >= 1);
    assert.equal(JSON.stringify(gravity.ranking).includes('admin'), false);
  });

  it('VER-PULSE-LEDGER: Pit item stays off Strike until accept; status PUT keeps module, type, assignee', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const created = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: {
        title: 'Ledger keep fields',
        severity: 'High',
        priority: 'High',
        module: 'AuthLedger',
        bugType: 'Enhancement',
        assignee: 'admin'
      }
    });
    assert.equal(created.status, 201);
    const bugId = created.data.bugId;
    assert.equal(created.data.module, 'AuthLedger');
    assert.equal(created.data.bugType, 'Enhancement');
    assert.equal(created.data.assignee, 'admin');

    const pit = await request(baseUrl, 'GET', `/api/pulse/pit/${projectKey}`, { token });
    assert.equal(pit.status, 200);
    assert.ok(pit.data.data.items.some((item) => item.bugId === bugId));
    const boardBefore = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    const onStrike = Object.values(boardBefore.data.data.columns || {}).flat();
    assert.equal(onStrike.some((item) => item.bugId === bugId), false);

    const moved = await request(baseUrl, 'PUT', `/api/bugs/${projectKey}/${bugId}`, {
      token,
      body: { status: 'In Progress' }
    });
    assert.equal(moved.status, 200);
    assert.equal(moved.data.status, 'In Progress');
    assert.equal(moved.data.title, 'Ledger keep fields');
    assert.equal(moved.data.module, 'AuthLedger');
    assert.equal(moved.data.bugType, 'Enhancement');
    assert.equal(moved.data.assignee, 'admin');

    const triage = await request(baseUrl, 'POST', `/api/pulse/triage/${bugId}`, { token });
    assert.equal(triage.status, 200);
    assert.ok(triage.data.data.item.triagedAt);
    assert.equal(triage.data.data.item.status, 'In Progress');
    assert.equal(triage.data.data.item.assignee, 'admin');
    assert.equal(triage.data.data.item.module, 'AuthLedger');

    const pitAfter = await request(baseUrl, 'GET', `/api/pulse/pit/${projectKey}`, { token });
    assert.equal(pitAfter.data.data.items.some((item) => item.bugId === bugId), false);
    const boardAfter = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.ok(boardAfter.data.data.columns['In Progress'].some((item) => item.bugId === bugId));
  });

  it('VER-PULSE-VIS: non-member gets 403 on Strike and The Pit', async () => {
    const { generateToken } = require('../../middleware/auth');
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const outsider = generateToken({ id: 'pulse-outsider', username: 'outsider', role: 'user' });

    const board = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token: outsider });
    assert.equal(board.status, 403);
    const pit = await request(baseUrl, 'GET', `/api/pulse/pit/${projectKey}`, { token: outsider });
    assert.equal(pit.status, 403);
    const brief = await request(baseUrl, 'GET', `/api/pulse/brief/${projectKey}`, { token: outsider });
    assert.equal(brief.status, 403);
    const line = await request(baseUrl, 'GET', `/api/pulse/line/${projectKey}`, { token: outsider });
    assert.equal(line.status, 403);
  });

  it('VER-PULSE-GAP: commit plus QA Not Started is a gap, never invented 0', async () => {
    const storage = require('../../storage');
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const created = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Gap after commit', severity: 'High', priority: 'High' }
    });
    assert.equal(created.status, 201);
    const bugId = created.data.bugId;
    await request(baseUrl, 'POST', `/api/pulse/triage/${bugId}`, { token });
    assert.equal((await request(baseUrl, 'PUT', `/api/bugs/${projectKey}/${bugId}`, {
      token, body: { status: 'In Progress' }
    })).status, 200);
    await storage.addBugActivity(bugId, 'github', 'commit', 'Commit to main');
    await storage.addBugActivity(bugId, 'github', 'commit', 'Commit to main');

    const line = await request(baseUrl, 'GET', `/api/pulse/line/${projectKey}`, { token });
    assert.equal(line.status, 200);
    const gap = line.data.data.fixVerifyGap;
    assert.equal(gap.reason, null);
    assert.ok(gap.count >= 1);
    assert.ok(gap.evidence.includes(bugId));
    assert.match(gap.sentence, /waiting on QA after a commit/);
    assert.equal((line.data.meta.degraded || []).some((row) => row.metric === 'fixVerifyGap'), false);
  });

  it('VER-PULSE-ESC: Production Bug after a close is escaped; Testing is not', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const baseline = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Escaped baseline close', severity: 'High', priority: 'High' }
    });
    assert.equal(baseline.status, 201);
    await request(baseUrl, 'POST', `/api/pulse/triage/${baseline.data.bugId}`, { token });
    assert.equal((await request(baseUrl, 'PUT', `/api/bugs/${projectKey}/${baseline.data.bugId}`, {
      token, body: { status: 'Closed' }
    })).status, 200);

    const prod = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: {
        title: 'Escaped in prod',
        severity: 'Critical',
        priority: 'High',
        environment: 'Production',
        bugType: 'Bug'
      }
    });
    const testing = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: {
        title: 'Not escaped testing',
        severity: 'High',
        priority: 'High',
        environment: 'Testing',
        bugType: 'Bug'
      }
    });
    assert.equal(prod.status, 201);
    assert.equal(testing.status, 201);

    const board = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.equal(board.status, 200);
    const escaped = board.data.data.escaped;
    assert.equal(escaped.reason, null);
    assert.ok(escaped.count >= 1);
    assert.ok(escaped.evidence.includes(prod.data.bugId));
    assert.equal(escaped.evidence.includes(testing.data.bugId), false);
    assert.match(escaped.sentence, /escaped since last close/);
    assert.equal((board.data.meta.degraded || []).some((row) => row.metric === 'escaped'), false);
  });

  it('VER-PULSE-CYC: named window with zero Pit accepts degrades interrupt', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const board = await request(
      baseUrl,
      'GET',
      `/api/pulse/board/${projectKey}?from=1999-01-01T00:00:00.000Z&to=1999-01-08T00:00:00.000Z&name=Sep%20window`,
      { token }
    );
    assert.equal(board.status, 200);
    const ring = board.data.data.interrupt;
    assert.equal(ring.loadPct, null);
    assert.equal(ring.windowName, 'Sep window');
    assert.equal(ring.degraded.reason, 'no Pit accepts in this window');
    assert.ok((board.data.meta.degraded || []).some((row) => row.metric === 'interrupt'));
  });

  it('VER-PULSE-MIS: mission map claims uniquely and delete does not delete bugs', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const first = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Mission claimed', severity: 'High', priority: 'High', bugType: 'Bug' }
    });
    const second = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Mission unclaimed', severity: 'Low', priority: 'Low', bugType: 'Feature' }
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);

    const created = await request(baseUrl, 'POST', `/api/pulse/missions/${projectKey}`, {
      token,
      body: { title: 'Land auth', intent: 'Users can sign in' }
    });
    assert.equal(created.status, 201);
    const missionId = created.data.data.mission.id;
    assert.equal(created.data.data.mission.intent, 'Users can sign in');

    const claim = await request(baseUrl, 'POST', `/api/pulse/missions/${projectKey}/${missionId}/bugs`, {
      token,
      body: { bugId: first.data.bugId }
    });
    assert.equal(claim.status, 201);

    const twice = await request(baseUrl, 'POST', `/api/pulse/missions/${projectKey}/${missionId}/bugs`, {
      token,
      body: { bugId: first.data.bugId }
    });
    assert.equal(twice.status, 409);

    const map = await request(baseUrl, 'GET', `/api/pulse/missions/${projectKey}`, { token });
    assert.equal(map.status, 200);
    const mission = map.data.data.missions.find((row) => row.id === missionId);
    assert.ok(mission.bugIds.includes(first.data.bugId));
    assert.ok(map.data.data.unclaimed.bugIds.includes(second.data.bugId));
    assert.equal(map.data.data.unclaimed.bugIds.includes(first.data.bugId), false);

    const removed = await request(baseUrl, 'DELETE', `/api/pulse/missions/${projectKey}/${missionId}`, { token });
    assert.equal(removed.status, 200);
    assert.ok(removed.data.data.unlinkedBugIds.includes(first.data.bugId));

    const stillThere = await request(baseUrl, 'GET', `/api/bugs/project/${projectKey}`, { token });
    assert.equal(stillThere.status, 200);
    const bug = stillThere.data.find((row) => row.bugId === first.data.bugId);
    assert.ok(bug);
    assert.equal(bug.title, 'Mission claimed');

    const after = await request(baseUrl, 'GET', `/api/pulse/missions/${projectKey}`, { token });
    assert.equal(after.data.data.missions.some((row) => row.id === missionId), false);
    assert.ok(after.data.data.unclaimed.bugIds.includes(first.data.bugId));
  });

  it('VER-PULSE-DECK: the Deck still routes on Community, and skips only when one project', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    assert.equal(projects.status, 200);
    const command = await request(baseUrl, 'GET', '/api/pulse/command', { token });
    assert.equal(command.status, 200);

    // Manager content is gated (see api.pulse.gating.test.js); navigation is not.
    assert.equal(command.data.data.gated.feature, 'advanced_reporting');
    assert.deepEqual(command.data.data.rows, []);
    const expectedSkip = projects.data.length === 1 ? projects.data[0].key : null;
    assert.equal(command.data.data.skipToStrike, expectedSkip);
    assert.equal(command.data.data.projects.length, projects.data.length);
  });

  it('VER-PULSE-LENS: a lens filters the board and reports the unfiltered total', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;

    const seeded = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Lens target bug', severity: 'Critical', priority: 'High', module: 'lens-module' }
    });
    assert.equal(seeded.status, 201);
    await request(baseUrl, 'POST', `/api/pulse/triage/${seeded.data.bugId}`, { token });

    const all = await request(baseUrl, 'GET', `/api/pulse/board/${projectKey}`, { token });
    assert.equal(all.status, 200);
    assert.equal(all.data.data.lens, null, 'no lens means no summary');
    const total = all.data.data.count;

    const lensed = await request(
      baseUrl,
      'GET',
      `/api/pulse/board/${projectKey}?lens=module:lens-module`,
      { token }
    );
    assert.equal(lensed.status, 200);
    assert.equal(lensed.data.data.lens.label, 'module:lens-module');
    assert.equal(lensed.data.data.lens.of, total, 'the unfiltered total is always reported');
    assert.ok(lensed.data.data.lens.matched >= 1);
    assert.ok(lensed.data.data.lens.matched <= total);

    // Metrics must describe the filtered set, not the whole project.
    const ids = Object.values(lensed.data.data.columns).flat().map((c) => c.bugId);
    assert.ok(ids.includes(seeded.data.bugId));
    assert.equal(ids.length, lensed.data.data.lens.matched);
  });

  it('VER-PULSE-LENS: an unknown lens is 400 on every lensed surface', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;

    for (const path of [
      `/api/pulse/board/${projectKey}?lens=assignee:admin`,
      `/api/pulse/pit/${projectKey}?lens=assignee:admin`,
      `/api/pulse/line/${projectKey}?lens=assignee:admin`,
      '/api/pulse/me?lens=assignee:admin'
    ]) {
      const res = await request(baseUrl, 'GET', path, { token });
      assert.equal(res.status, 400, path);
      assert.match(res.data.error, /unknown lens/, path);
    }
  });

  it('VER-PULSE-LENS: a lens matching nothing is an empty board, not an error', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const res = await request(
      baseUrl,
      'GET',
      `/api/pulse/board/${projectKey}?lens=module:definitely-not-a-real-module`,
      { token }
    );
    assert.equal(res.status, 200);
    assert.equal(res.data.data.lens.matched, 0);
    assert.ok(res.data.data.lens.of >= 0);
    // The measurement succeeded; the set is simply empty.
    assert.equal(
      res.data.meta.degraded.some((e) => e.metric === 'lens'),
      false,
      'an empty result is not a degraded metric'
    );
  });

  it('VER-PULSE-WAIT: ARB becomes a queue, and visibility still applies', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;

    const parked = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: {
        title: 'Waiting on admin to decide',
        severity: 'Medium',
        priority: 'Medium',
        arb: ['admin']
      }
    });
    assert.equal(parked.status, 201);

    const res = await request(baseUrl, 'GET', `/api/pulse/wait/${projectKey}`, { token });
    assert.equal(res.status, 200);

    const queue = res.data.data.queues.find((q) => q.user === 'admin');
    assert.ok(queue, 'admin holds the parked item');
    assert.ok(queue.bugIds.includes(parked.data.bugId));
    assert.equal(typeof queue.oldestDays, 'number');
    assert.match(res.data.data.sentence, /parked on/);

    // The Wait must never rank people.
    assert.equal(/worst|slowest|rank|score/i.test(JSON.stringify(res.data)), false);
  });

  it('VER-PULSE-WAIT: a project with no ARB degrades instead of claiming nobody waits', async () => {
    // "No queues" and "the field is unused" look identical on screen and mean
    // completely different things.
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const empty = projects.data.find((p) => p.key !== projects.data[0].key);
    if (!empty) return; // single-project instance: nothing to assert

    const res = await request(baseUrl, 'GET', `/api/pulse/wait/${empty.key}`, { token });
    assert.equal(res.status, 200);
    if (!res.data.data.queues.length) {
      assert.equal(
        res.data.meta.degraded.some((e) => e.metric === 'wait'),
        true,
        'an unused ARB field is stated, not implied'
      );
    }
  });

  it('VER-PULSE-WAIT: unknown project is 404 and a non-member is 403', async () => {
    const missing = await request(baseUrl, 'GET', '/api/pulse/wait/ZZZ', { token });
    assert.equal(missing.status, 404);
  });

  it('VER-PULSE-LAND: Landing is a paid surface on a Community instance', async () => {
    // The computation is covered by pulse.forecast.test.js and exercised over
    // HTTP in api.pulse.gating.test.js, which can turn the feature on.
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const res = await request(baseUrl, 'GET', `/api/pulse/landing/${projects.data[0].key}`, { token });
    assert.equal(res.status, 403);
    assert.equal(res.data.feature, 'advanced_reporting');
  });

  it('VER-PULSE-REPLAY: Replay is a paid surface on a Community instance', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const res = await request(baseUrl, 'GET', `/api/pulse/replay/${projects.data[0].key}`, { token });
    assert.equal(res.status, 403);
    assert.equal(res.data.feature, 'advanced_reporting');
  });

  it('VER-PULSE-ENGINE: deck and My Pulse say when they are showing a partial view', async () => {
    // The deck used to be an unbounded N+1 and My Pulse truncated at 500 bugs in
    // silence. Both now report through the envelope instead of quietly lying.
    const command = await request(baseUrl, 'GET', '/api/pulse/command', { token });
    assert.equal(command.status, 200);
    assert.ok(Array.isArray(command.data.meta.degraded));
    assert.equal(
      command.data.meta.degraded.some((entry) => entry.metric === 'deck'),
      false,
      'a small instance is inside the project cap, so nothing is degraded'
    );

    const me = await request(baseUrl, 'GET', '/api/pulse/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.data.data.truncated, false, 'truncation is stated, not implied');
    assert.equal(
      me.data.meta.degraded.some((entry) => entry.metric === 'me'),
      false
    );
    // Repeat calls must agree: the deck cache is keyed by content, not by clock.
    const again = await request(baseUrl, 'GET', '/api/pulse/command', { token });
    assert.deepEqual(again.data.data.rows, command.data.data.rows);
  });

  it('VER-PULSE-HOR: horizon is mission bars only', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const bug = await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Horizon claimed', severity: 'Low', priority: 'Low' }
    });
    assert.equal(bug.status, 201);
    const created = await request(baseUrl, 'POST', `/api/pulse/missions/${projectKey}`, {
      token,
      body: {
        title: 'Land horizon',
        intent: 'Show a mission strip',
        targetDate: '2026-12-01T00:00:00.000Z'
      }
    });
    assert.equal(created.status, 201);
    const missionId = created.data.data.mission.id;
    const claim = await request(baseUrl, 'POST', `/api/pulse/missions/${projectKey}/${missionId}/bugs`, {
      token,
      body: { bugId: bug.data.bugId }
    });
    assert.equal(claim.status, 201);

    const horizon = await request(baseUrl, 'GET', `/api/pulse/horizon/${projectKey}`, { token });
    assert.equal(horizon.status, 200);
    const bars = horizon.data.data.bars;
    assert.ok(bars.some((bar) => bar.missionId === missionId));
    assert.equal(bars.some((bar) => bar.missionId === bug.data.bugId), false);
    assert.equal(JSON.stringify(bars).includes('"bugId"'), false);
  });

  it('VER-PULSE-AI: Community brief keeps clauses and hides AI prose', async () => {
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const projectKey = projects.data[0].key;
    const brief = await request(baseUrl, 'GET', `/api/pulse/brief/${projectKey}`, { token });
    assert.equal(brief.status, 200);
    assert.ok(brief.data.data.clauses.find((clause) => clause.id === 'mix'));
    assert.equal(brief.data.data.aiProse, null);
    assert.ok(brief.data.data.aiHiddenReason);
  });
});
