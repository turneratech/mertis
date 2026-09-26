const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createTestApp } = require('../helpers/testApp');
const { listenOnRandomPort, getBaseUrl, closeServer } = require('../helpers/bootstrap');
const { request } = require('../helpers/httpClient');

const instanceConfig = require('../../config/instance.config');
const featureService = require('../../services/featureService');

/**
 * M23 — packaging.
 *
 * The wedge (Strike, Pit, My Pulse, The Line, The Wait) is Community: it is what
 * makes a team adopt Pulse, and Community is capped at 5 users / 3 projects /
 * 250 bugs so it cannot serve a real team anyway.
 *
 * The manager surfaces (Command Deck, Landing, Replay) sit behind
 * `advanced_reporting`, because the job they do — not hand-writing the Friday
 * status — is the thing worth paying for.
 *
 * Runs in its own file so toggling the licence waiver cannot leak into the other
 * suites (node's test runner gives each file its own process).
 */
describe('API pulse gating [VER-PULSE-GATE]', () => {
  let server;
  let baseUrl;
  let token;
  let projectKey;

  const asPaidTier = async (fn) => {
    instanceConfig.skipLicenseChecks = true;
    featureService.clearCache();
    try {
      return await fn();
    } finally {
      instanceConfig.skipLicenseChecks = false;
      featureService.clearCache();
    }
  };

  before(async () => {
    server = await listenOnRandomPort(createTestApp());
    baseUrl = getBaseUrl(server);
    const login = await request(baseUrl, 'POST', '/api/auth/login', {
      body: { username: 'admin', password: 'admin123' }
    });
    token = login.data.token;
    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    projectKey = projects.data[0].key;
    // Community is the default for a CSV instance.
    instanceConfig.skipLicenseChecks = false;
    featureService.clearCache();
  });

  after(async () => {
    instanceConfig.skipLicenseChecks = false;
    featureService.clearCache();
    await closeServer(server);
  });

  it('VER-PULSE-GATE: Community keeps the whole wedge', async () => {
    for (const path of [
      `/api/pulse/board/${projectKey}`,
      `/api/pulse/pit/${projectKey}`,
      `/api/pulse/line/${projectKey}`,
      `/api/pulse/wait/${projectKey}`,
      `/api/pulse/brief/${projectKey}`,
      '/api/pulse/me'
    ]) {
      const res = await request(baseUrl, 'GET', path, { token });
      assert.equal(res.status, 200, `${path} must stay free`);
    }
  });

  it('VER-PULSE-GATE: Community is refused Landing and Replay with an upgrade payload', async () => {
    for (const path of [
      `/api/pulse/landing/${projectKey}`,
      `/api/pulse/replay/${projectKey}`
    ]) {
      const res = await request(baseUrl, 'GET', path, { token });
      assert.equal(res.status, 403, path);
      // A bare 403 is a dead end; the client needs to know what to offer.
      assert.equal(res.data.feature, 'advanced_reporting', path);
      assert.equal(res.data.upgradeRequired, true, path);
      assert.ok(res.data.currentTier, `${path} names the current tier`);
    }
  });

  it('VER-PULSE-GATE: the Deck stays reachable on Community but withholds the briefs', async () => {
    // Hard-gating this route would strand a Community user with one project:
    // /pulse redirects via skipToStrike, so a 403 here means nowhere to land.
    const res = await request(baseUrl, 'GET', '/api/pulse/command', { token });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.data.rows, [], 'no manager content');
    assert.equal(res.data.data.gated.feature, 'advanced_reporting');
    assert.ok(Array.isArray(res.data.data.projects), 'navigation still works');

    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    const expected = projects.data.length === 1 ? projects.data[0].key : null;
    assert.equal(res.data.data.skipToStrike, expected, 'the redirect still resolves');
  });

  it('VER-PULSE-GATE: a paid tier gets the Deck, Landing and Replay', async () => {
    await asPaidTier(async () => {
      const deck = await request(baseUrl, 'GET', '/api/pulse/command', { token });
      assert.equal(deck.status, 200);
      assert.equal(deck.data.data.gated, undefined, 'no longer withheld');
      assert.ok(deck.data.data.rows.length >= 1);
      assert.ok(deck.data.data.rows[0].clauses.length >= 1, 'briefs are back');

      const landing = await request(baseUrl, 'GET', `/api/pulse/landing/${projectKey}`, { token });
      assert.equal(landing.status, 200);
      assert.ok(Array.isArray(landing.data.data.missions));

      const replay = await request(baseUrl, 'GET', `/api/pulse/replay/${projectKey}`, { token });
      assert.equal(replay.status, 200);
      assert.ok(replay.data.data.counts);
    });
  });

  it('VER-PULSE-GATE: the gate closes again afterwards', async () => {
    // Guards against a test leaving the waiver on and silently un-gating the
    // product for every suite that runs after it.
    const res = await request(baseUrl, 'GET', `/api/pulse/landing/${projectKey}`, { token });
    assert.equal(res.status, 403);
  });
});
