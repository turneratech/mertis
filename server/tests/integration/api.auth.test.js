/**
 * @verifies VER-API-004 … VER-API-006
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createTestApp } = require('../helpers/testApp');
const { listenOnRandomPort, getBaseUrl, closeServer } = require('../helpers/bootstrap');
const { request } = require('../helpers/httpClient');

describe('API auth [VER-API]', () => {
  let server;
  let baseUrl;
  let token;

  before(async () => {
    server = await listenOnRandomPort(createTestApp());
    baseUrl = getBaseUrl(server);
  });

  after(async () => {
    await closeServer(server);
  });

  it('VER-API-004: POST /api/auth/login rejects invalid credentials', async () => {
    const { status } = await request(baseUrl, 'POST', '/api/auth/login', {
      body: { username: 'nonexistent_user_xyz', password: 'wrong' }
    });
    assert.equal(status, 401);
  });

  it('VER-API-004b: POST /api/auth/register without token is denied', async () => {
    const { status, data } = await request(baseUrl, 'POST', '/api/auth/register', {
      body: { username: 'newuser', password: 'secret12', role: 'user' }
    });
    assert.equal(status, 401);
    assert.equal(data.error, 'No token, authorization denied');
  });

  it('VER-API-005: POST /api/auth/login succeeds with dev defaults', async () => {
    const { status, data } = await request(baseUrl, 'POST', '/api/auth/login', {
      body: { username: 'admin', password: 'admin123' }
    });
    assert.equal(status, 200);
    assert.ok(data.token);
    assert.equal(data.user.username, 'admin');
    token = data.token;
  });

  it('VER-API-005b: POST /mertis/api/auth/login works at the client base path', async () => {
    const { status, data } = await request(baseUrl, 'POST', '/mertis/api/auth/login', {
      body: { username: 'admin', password: 'admin123' }
    });
    assert.equal(status, 200);
    assert.ok(data.token);
  });

  it('VER-API-006: GET /api/license/limits works when authenticated', async () => {
    assert.ok(token, 'login test must run first');
    const { status, data } = await request(baseUrl, 'GET', '/api/license/limits', { token });
    assert.equal(status, 200);
    assert.ok(data.users);
    assert.ok(data.projects);
    assert.ok(data.bugs);
  });
});
