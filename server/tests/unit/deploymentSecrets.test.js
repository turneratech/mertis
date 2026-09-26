/**
 * @verifies VER-CFG-001 … VER-CFG-004
 *
 * Mertis ships white-label with no third-party credentials of its own, so every
 * secret is supplied by the instance operator through the admin UI. These tests
 * cover the two ways that goes wrong: silently erasing a stored secret, and
 * leaking one back to the browser.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const deploymentConfig = require('../../config/deployment.config');
const deepMerge = deploymentConfig._deepMerge;

describe('Deployment secrets [VER-CFG]', () => {
  it('VER-CFG-001: editing a sibling field keeps the stored secret', () => {
    // The UI reads secrets back masked, and the save path strips the mask, so
    // the incoming object has no secret at all. A shallow merge wiped the key
    // every time someone changed the bucket name.
    const stored = {
      storage: {
        default: 's3',
        s3: { bucket: 'old', region: 'us-east-1', accessKeyId: 'AKIA', secretAccessKey: 'REAL-SECRET' }
      }
    };
    const incoming = { storage: { s3: { bucket: 'new', region: 'us-east-1', accessKeyId: 'AKIA' } } };

    const merged = deepMerge(stored, incoming);
    assert.equal(merged.storage.s3.bucket, 'new');
    assert.equal(merged.storage.s3.secretAccessKey, 'REAL-SECRET',
      'omitting a secret must mean "unchanged", never "delete"');
    assert.equal(merged.storage.default, 's3');
  });

  it('VER-CFG-002: an explicit value still overwrites, at any depth', () => {
    const merged = deepMerge(
      { storage: { azure: { connectionString: 'old', containerName: 'c' } } },
      { storage: { azure: { connectionString: 'new' } } }
    );
    assert.equal(merged.storage.azure.connectionString, 'new');
    assert.equal(merged.storage.azure.containerName, 'c');
  });

  it('VER-CFG-003: arrays are replaced, not merged', () => {
    // Webhooks are a list. Merging index-wise would resurrect deleted entries.
    const merged = deepMerge({ webhooks: [{ id: 'a' }, { id: 'b' }] }, { webhooks: [{ id: 'c' }] });
    assert.deepEqual(merged.webhooks, [{ id: 'c' }]);
  });

  it('VER-CFG-004: the AI key resolves from config, and defaults to empty', () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const ai = deploymentConfig.getAiConfig();
      assert.equal(ai.apiKey, '', 'Mertis must never ship or assume an AI key');
      assert.ok(ai.model, 'a default model is fine; a default key is not');
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });
});
