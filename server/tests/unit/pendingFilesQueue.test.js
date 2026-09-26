/**
 * Mirrors client/src/utils/pendingAttachments.js queue semantics for automation.
 * @verifies VER-ATT-001 … VER-ATT-003
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Isomorphic queue logic (same as client pendingAttachments minus axios upload)
function createPendingQueue() {
  const pendingFiles = [];
  return {
    queue(file) { pendingFiles.push(file); return pendingFiles.length; },
    getAll() { return [...pendingFiles]; },
    clear() { pendingFiles.length = 0; },
    count() { return pendingFiles.length; },
    async flush(bugId, uploadFn, maxBytes = 25 * 1024 * 1024) {
      if (!bugId || pendingFiles.length === 0) return [];
      const files = [...pendingFiles];
      pendingFiles.length = 0;
      const uploaded = [];
      for (const file of files) {
        if (file.size > maxBytes) continue;
        uploaded.push(await uploadFn(bugId, file));
      }
      return uploaded;
    }
  };
}

describe('Pending attachment queue [VER-ATT]', () => {
  let queue;

  beforeEach(() => {
    queue = createPendingQueue();
  });

  it('VER-ATT-001: queues files before bugId exists', () => {
    queue.queue({ name: 'a.pdf', size: 100 });
    queue.queue({ name: 'b.png', size: 200 });
    assert.equal(queue.count(), 2);
    assert.deepEqual(queue.getAll().map(f => f.name), ['a.pdf', 'b.png']);
  });

  it('VER-ATT-002: flush uploads all queued files and clears queue', async () => {
    queue.queue({ name: 'doc.pdf', size: 500 });
    const uploaded = await queue.flush('SM-0001', async (bugId, file) => ({
      id: 'att-1', bugId, fileName: file.name
    }));
    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0].fileName, 'doc.pdf');
    assert.equal(queue.count(), 0);
  });

  it('VER-ATT-003: skips files over size limit during flush', async () => {
    queue.queue({ name: 'huge.zip', size: 30 * 1024 * 1024 });
    queue.queue({ name: 'small.txt', size: 10 });
    const uploaded = await queue.flush('SM-0002', async (bugId, file) => ({
      id: file.name, fileName: file.name
    }), 25 * 1024 * 1024);
    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0].fileName, 'small.txt');
  });
});
