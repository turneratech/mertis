const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const path = require('node:path');
const { request } = require('../helpers/httpClient');

describe('VER-PULSE-KILL isolated HTTP', () => {
  it('VER-PULSE-KILL: PULSE_ENABLED=false → 404 /api/pulse/board', async () => {
    const child = fork(path.join(__dirname, '../helpers/pulseKillswitchChild.js'), [], {
      env: {
        ...process.env,
        PULSE_ENABLED: 'false',
        NODE_ENV: 'test',
        MERTIS_DEV_DEFAULTS: 'true',
        JWT_SECRET: process.env.JWT_SECRET || 'mertis-test-jwt-secret'
      }
    });

    const payload = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('killswitch child timeout')), 20000);
      child.on('message', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('exit', (code) => {
        if (code) {
          clearTimeout(timer);
          reject(new Error(`killswitch child exit ${code}`));
        }
      });
    });

    try {
      if (payload.error) throw new Error(payload.error);
      const status = await request(payload.baseUrl, 'GET', '/api/pulse/status');
      assert.equal(status.status, 200);
      assert.equal(status.data.enabled, false);

      const board = await request(payload.baseUrl, 'GET', '/api/pulse/board/SM');
      assert.equal(board.status, 404);
      assert.match(String(board.data && board.data.error), /disabled/i);
    } finally {
      child.kill();
    }
  });
});
