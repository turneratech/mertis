/**
 * @verifies VER-LIC-016 … VER-LIC-019
 *
 * The SQL path (MySQL/Postgres) resolves a licence from the `licenses` row.
 * It had no test at all, and two bugs lived there:
 *
 *   1. activateLicense stores `payload.maxUsers || null`, but licence-server
 *      tokens carry no maxUsers claim — so the row holds NULL. buildStatus
 *      guarded with `!== undefined`, which a SQL NULL passes, and checkLimit
 *      treats null as unlimited. A free Community key therefore granted
 *      unlimited users and projects on the backends we actually sell.
 *   2. Nothing re-verified the stored token, so editing the row was a full
 *      unlock. The CSV path re-verifies every time and was strictly stronger.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { TIERS, TIER_LIMITS } = require('../../config/features');

// Shape of a real licence-server token: no tier, no limits.
const serverPayload = (overrides = {}) => ({
  v: 1, fmt: 'jwt', jti: 'lic_sqlpath', company: 'co_test', product: 'pr_test',
  machine: 'a'.repeat(64), email: 'sql@example.com', grace_days: 7,
  exp: Math.floor(Date.now() / 1000) + 86400,
  ...overrides
});

describe('Licence SQL path [VER-LIC]', () => {
  let licenseService, sign, previousKey;

  before(() => {
    const pair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    previousKey = process.env.LICENSE_PUBLIC_KEY;
    process.env.LICENSE_PUBLIC_KEY = pair.publicKey;
    sign = (p) => jwt.sign(p, pair.privateKey, { algorithm: 'ES256', issuer: 'turneratech.com' });
    licenseService = require('../../services/licenseService');
  });

  after(() => {
    if (previousKey === undefined) delete process.env.LICENSE_PUBLIC_KEY;
    else process.env.LICENSE_PUBLIC_KEY = previousKey;
  });

  it('VER-LIC-016: a Community row with NULL limit columns stays capped', () => {
    // This is the giveaway. activateLicense writes NULL because the token has
    // no maxUsers claim; NULL must mean "use the tier default", not "unlimited".
    const status = licenseService._buildStatus({
      tier: 'community',
      status: 'active',
      license_key: sign(serverPayload()),
      max_users: null,
      max_projects: null,
      expires_at: new Date(Date.now() + 86400000)
    });

    const base = TIER_LIMITS[TIERS.COMMUNITY];
    assert.equal(status.tier, TIERS.COMMUNITY);
    assert.equal(status.limits.maxUsers, base.maxUsers, 'NULL must not mean unlimited');
    assert.equal(status.limits.maxProjects, base.maxProjects, 'NULL must not mean unlimited');
    assert.equal(status.limits.maxBugs, base.maxBugs);
  });

  it('VER-LIC-017: editing the tier column does not grant a higher tier', () => {
    // The stored token says nothing about tier, so the tier must come from the
    // verified payload (absent -> Community), never from the editable column.
    const status = licenseService._buildStatus({
      tier: 'enterprise',
      status: 'active',
      license_key: sign(serverPayload()),
      max_users: null,
      max_projects: null,
      expires_at: new Date(Date.now() + 86400000)
    });
    assert.equal(status.tier, TIERS.COMMUNITY, 'an edited tier column must not be honoured');
    assert.equal(status.limits.maxUsers, TIER_LIMITS[TIERS.COMMUNITY].maxUsers);
  });

  it('VER-LIC-018: a row with no stored token resolves to Community', () => {
    // The seeded Community rows have license_key NULL. They must not error.
    const status = licenseService._buildStatus({
      tier: 'community', status: 'active', license_key: null,
      max_users: 5, max_projects: 3
    });
    assert.equal(status.tier, TIERS.COMMUNITY);
    assert.equal(status.valid, true);
  });

  it('VER-LIC-019: a suspended row is Community regardless of its token', () => {
    const status = licenseService._buildStatus({
      tier: 'professional',
      status: 'suspended',
      license_key: sign(serverPayload({ tier: 'professional' })),
      max_users: null, max_projects: null
    });
    assert.equal(status.tier, TIERS.COMMUNITY);
    assert.equal(status.valid, false);
  });
});
