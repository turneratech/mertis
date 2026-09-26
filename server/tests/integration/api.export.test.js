const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createTestApp } = require('../helpers/testApp');
const { listenOnRandomPort, getBaseUrl, closeServer } = require('../helpers/bootstrap');
const { request } = require('../helpers/httpClient');

/**
 * @verifies VER-EXP-001 … VER-EXP-005
 *
 * LICENSING.md tells customers that export is on every tier including free, and
 * that leaving is a supported feature. Until this route existed that sentence
 * described software we did not ship. These rows keep it honest: the export
 * exists, it carries the whole instance, it is not gated behind a licence
 * feature, and it never emits a password.
 */
describe('API export [VER-EXP]', () => {
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

    const projects = await request(baseUrl, 'GET', '/api/projects', { token });
    if (projects.data.length) {
      projectKey = projects.data[0].key;
    } else {
      const created = await request(baseUrl, 'POST', '/api/projects', {
        token,
        body: { name: 'Export Test', key: 'EXP', description: 'Export', client: 'Internal' }
      });
      assert.equal(created.status, 201);
      projectKey = created.data.key;
    }

    await request(baseUrl, 'POST', `/api/bugs/${projectKey}`, {
      token,
      body: { title: 'Exportable bug, with a "quoted" phrase', severity: 'High', priority: 'High' }
    });
  });

  after(async () => {
    await closeServer(server);
  });

  it('VER-EXP-001: the whole instance comes back as JSON', async () => {
    const { status, data, headers } = await request(baseUrl, 'GET', '/api/export', { token });
    assert.equal(status, 200);
    assert.equal(data.format, 'mertis-export-v1');
    assert.ok(headers.get('content-disposition').includes('attachment'));
    assert.ok(Array.isArray(data.projects) && data.projects.length >= 1);
    assert.ok(data.bugs[projectKey].length >= 1, 'bugs are grouped by project key');
    assert.equal(
      data.counts.bugs,
      Object.values(data.bugs).reduce((sum, list) => sum + list.length, 0),
      'the count must match what is actually in the file'
    );
  });

  it('VER-EXP-002: no password leaves the building', async () => {
    const { data } = await request(baseUrl, 'GET', '/api/export', { token });
    assert.ok(data.users.length >= 1);
    for (const user of data.users) {
      assert.equal(user.password, undefined);
      assert.ok(user.username, 'a user row is still useful without its password');
    }
    assert.ok(!JSON.stringify(data).includes('$2a$'), 'no bcrypt hash anywhere in the payload');
  });

  it('VER-EXP-003: a project exports as CSV with quoted fields', async () => {
    const { status, data, headers } = await request(baseUrl, 'GET', `/api/export?format=csv&project=${projectKey}`, { token });
    assert.equal(status, 200);
    assert.ok(headers.get('content-type').startsWith('text/csv'));
    const lines = String(data).trim().split('\r\n');
    assert.ok(lines[0].startsWith('"bugId","projectKey","title"'));
    assert.ok(lines.length >= 2, 'header plus at least one bug');
    // A title containing quotes must survive as doubled quotes, not break the row.
    assert.ok(String(data).includes('""quoted""'));
  });

  it('VER-EXP-004: export is not behind a licence feature', async () => {
    // Community is the tier under test. If this ever 403s on a feature gate,
    // the promise in LICENSING.md has stopped being true.
    const { status } = await request(baseUrl, 'GET', '/api/export', { token });
    assert.equal(status, 200);
  });

  it('VER-EXP-005: unauthenticated and unsupported requests are refused clearly', async () => {
    const anon = await request(baseUrl, 'GET', '/api/export');
    assert.equal(anon.status, 401);

    const badFormat = await request(baseUrl, 'GET', '/api/export?format=xml', { token });
    assert.equal(badFormat.status, 400);
    assert.match(badFormat.data.error, /json or csv/i);

    const csvNoProject = await request(baseUrl, 'GET', '/api/export?format=csv', { token });
    assert.equal(csvNoProject.status, 400);
  });
});
