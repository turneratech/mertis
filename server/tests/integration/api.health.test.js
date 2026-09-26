/**
 * @verifies VER-API-001
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createTestApp } = require('../helpers/testApp');
const { listenOnRandomPort, getBaseUrl, closeServer } = require('../helpers/bootstrap');
const { request } = require('../helpers/httpClient');

describe('API health [VER-API]', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await listenOnRandomPort(createTestApp());
    baseUrl = getBaseUrl(server);
  });

  after(async () => {
    await closeServer(server);
  });

  it('VER-API-001: GET /api/health returns ok with storage info', async () => {
    const { status, data } = await request(baseUrl, 'GET', '/api/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
    assert.ok(data.storage);
    assert.ok(['csv', 'mysql', 'postgres'].includes(data.storage.type));
    assert.ok(data.timestamp);
  });
});
