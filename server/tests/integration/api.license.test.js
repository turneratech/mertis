/**
 * @verifies VER-API-002 … VER-API-003
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createTestApp } = require('../helpers/testApp');
const { listenOnRandomPort, getBaseUrl, closeServer } = require('../helpers/bootstrap');
const { request } = require('../helpers/httpClient');

describe('API license [VER-API]', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await listenOnRandomPort(createTestApp());
    baseUrl = getBaseUrl(server);
  });

  after(async () => {
    await closeServer(server);
  });

  it('VER-API-002: GET /api/license/status is public and returns community defaults', async () => {
    const { status, data } = await request(baseUrl, 'GET', '/api/license/status');
    assert.equal(status, 200);
    assert.equal(data.tier, 'community');
    assert.equal(data.limits.maxWebhooks, 1);
    assert.equal(data.limits.maxUsers, 5);
    assert.ok(Array.isArray(data.features));
    assert.ok(typeof data.featureMap === 'object');
  });

  it('VER-API-003: GET /api/license/limits requires auth', async () => {
    const { status } = await request(baseUrl, 'GET', '/api/license/limits');
    assert.equal(status, 401);
  });
});
