const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { TIERS } = require('../../config/features');
const { collectPayload, buildOne, readEnforcement, MANIFEST_DIR } = require('../../../scripts/package');

/**
 * @verifies VER-PKG-001 … VER-PKG-004
 *
 * Eight output folders are safe only while they are generated. The moment one
 * of them carries a fix the others do not, the folders have become the eight
 * branches we chose not to have. These tests hold that line: one payload,
 * every tier accounted for, nothing shipped that should not leave the machine,
 * and a generated doc that cannot promise more than the code enforces.
 */
describe('release packaging [VER-PKG]', () => {
  const tiers = Object.values(TIERS);

  it('VER-PKG-001: every tier in the catalogue has a manifest, and no manifest invents a tier', () => {
    const manifests = fs.readdirSync(MANIFEST_DIR).filter((f) => f.endsWith('.json'));
    assert.equal(manifests.length, tiers.length,
      `build/offerings has ${manifests.length} manifests for ${tiers.length} tiers`);

    for (const tier of tiers) {
      const file = path.join(MANIFEST_DIR, `${tier}.json`);
      assert.ok(fs.existsSync(file), `missing manifest for tier '${tier}'`);
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.equal(manifest.tier, tier);
      assert.ok(manifest.label, `manifest '${tier}' has no label`);
      assert.ok(manifest.env && typeof manifest.env === 'object', `manifest '${tier}' has no env preset`);
    }
  });

  it('VER-PKG-002: all offerings share one byte-identical payload', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mertis-pkg-'));
    try {
      const payload = collectPayload();
      const hashes = tiers.map((tier) => buildOne(tier, payload, out).payloadHash);
      assert.equal(new Set(hashes).size, 1,
        'offerings have diverging payloads — a fix would now have to be made more than once');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('VER-PKG-003: no credentials, live data or fixtures reach a bundle', () => {
    const payload = collectPayload();
    const forbidden = [
      [/(^|\/)\.env($|\.)/, 'an .env file'],
      [/(^|\/)server\/data\//, "a live install's rows"],
      [/(^|\/)uploads\//, 'uploaded attachments'],
      [/(^|\/)server\/tests\//, 'test fixtures'],
      [/(^|\/)node_modules\//, 'node_modules'],
      [/(^|\/)imgs\/screenshots\//, 'screenshots of a live install'],
      [/\.min\.js$/, 'a stale minified fork of a route']
    ];

    for (const rel of payload) {
      for (const [pattern, what] of forbidden) {
        assert.ok(!pattern.test(rel), `packaged ${what}: ${rel}`);
      }
    }
    assert.ok(payload.length > 50, 'payload looks empty — the include list is probably wrong');
  });

  it('VER-PKG-005: the payload is tracked source, not whatever is on disk', () => {
    const { execFileSync } = require('child_process');
    let tracked;
    try {
      tracked = new Set(execFileSync('git', ['ls-files', '-z'], {
        cwd: path.join(__dirname, '../../..'),
        maxBuffer: 32 * 1024 * 1024
      }).toString('utf8').split('\u0000').filter(Boolean));
    } catch (error) {
      return; // not a checkout; the walk fallback is covered by VER-PKG-003
    }

    for (const rel of collectPayload()) {
      assert.ok(tracked.has(rel), `packaged an untracked file: ${rel}`);
    }
  });

  it('VER-PKG-004: a bundle describes only the limits and features the code enforces', () => {
    const { featureGates, limitGates } = readEnforcement();

    // These are the gates the app actually applies today. If one disappears,
    // the generated QUICKSTART would silently start claiming it.
    for (const limit of ['users', 'projects', 'bugs']) {
      assert.ok(limitGates.has(limit), `limit '${limit}' is no longer enforced by checkLimit`);
    }
    assert.ok(featureGates.has('project_management'), 'project_management is no longer gated');
    assert.ok(featureGates.has('advanced_reporting'), 'advanced_reporting is no longer gated');

    // Declared-but-unenforced must stay declared. Selling these as guarantees
    // is the failure this row exists to prevent.
    for (const limit of ['webhooks', 'instances', 'aiRequests']) {
      assert.ok(!limitGates.has(limit), `'${limit}' is enforced now — update the bundle docs and the sales copy`);
    }
  });
});
