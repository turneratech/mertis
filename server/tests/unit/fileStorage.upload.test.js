/**
 * StorageManager.upload takes one options object (same as attachments route).
 * The deployment "Test Storage" probe used to pass positional args and crashed
 * with Cannot read properties of undefined (reading 'replace').
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const StorageManager = require('../../../hybrid-storage/src/core/StorageManager');
const LocalProvider = require('../../../hybrid-storage/src/providers/LocalProvider');

describe('File storage upload probe shape', () => {
  let dir;
  let manager;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mertis-storage-'));
    manager = new StorageManager();
    manager.registerProvider('local', new LocalProvider({ basePath: dir, baseUrl: '/uploads' }));
    manager.setDefault('local');
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('positional upload(buffer, name) throws on fileName.replace', async () => {
    await assert.rejects(
      () => manager.upload(Buffer.from('x'), 'probe.txt', { provider: 'local' }),
      /replace/
    );
  });

  it('options-object upload then delete succeeds', async () => {
    const uploaded = await manager.upload({
      file: Buffer.from('mertis connection test'),
      fileName: '_mertis_connection_test.txt',
      mimeType: 'text/plain',
      metadata: { purpose: 'connection-test' },
      provider: 'local'
    });
    assert.ok(uploaded.storagePath);
    await manager.delete(uploaded.storagePath, 'local');
    assert.equal(await manager.exists(uploaded.storagePath, 'local'), false);
  });
});
