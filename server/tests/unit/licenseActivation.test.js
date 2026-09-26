/**
 * @verifies VER-LIC-011 … VER-LIC-015
 *
 * Covers the licence-server bridge: Mertis accepts ES256 tokens issued by
 * license.turneratech.com, whose payload carries no `tier` claim.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const { TIERS } = require('../../config/features');

// A payload in the shape the licence server actually signs (app/services.py
// _payload): no tier, no limits, no features.
const serverPayload = (overrides = {}) => ({
  v: 1,
  fmt: 'jwt',
  jti: 'lic_862861444623771a',
  company: 'co_6a886913832c411f',
  product: 'pr_83e835d1b0e46ba8',
  machine: 'a'.repeat(64),
  email: 'user@example.com',
  grace_days: 7,
  ...overrides
});

describe('Licence server bridge [VER-LIC]', () => {
  let privateKey;
  let previousKey;
  let licenseService;
  let jwtHelper;

  before(() => {
    const pair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    privateKey = pair.privateKey;
    previousKey = process.env.LICENSE_PUBLIC_KEY;
    process.env.LICENSE_PUBLIC_KEY = pair.publicKey;
    licenseService = require('../../services/licenseService');
    jwtHelper = require('../../utils/jwtHelper');
  });

  after(() => {
    if (previousKey === undefined) delete process.env.LICENSE_PUBLIC_KEY;
    else process.env.LICENSE_PUBLIC_KEY = previousKey;
  });

  const sign = (payload) =>
    jwt.sign(payload, privateKey, { algorithm: 'ES256', issuer: 'turneratech.com' });

  it('VER-LIC-011: a licence-server payload with no tier resolves to Community', () => {
    const status = licenseService._buildStatusFromPayload(serverPayload());
    assert.equal(status.tier, TIERS.COMMUNITY);
    assert.equal(status.limits.maxUsers, 5);
    assert.equal(status.limits.maxProjects, 3);
    assert.equal(status.limits.maxBugs, 250);
  });

  it('VER-LIC-012: an expired token still yields its payload and expiry date', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - (60 * 60 * 24);
    const token = sign(serverPayload({ exp: expiredAt }));

    const result = await licenseService.validateLicense(token);
    assert.equal(result.valid, false);
    // The whole point: without the payload nothing can tell the user WHEN it
    // lapsed, and the install just silently degrades.
    assert.ok(result.payload, 'expired token must still return its payload');
    assert.equal(result.payload.exp, expiredAt);
    assert.equal(jwtHelper.getExpirationDate(result.payload).getTime(), expiredAt * 1000);
  });

  it('VER-LIC-013: a valid token verifies and reports Community', async () => {
    const token = sign(serverPayload({ exp: Math.floor(Date.now() / 1000) + 3600 }));
    const result = await licenseService.validateLicense(token);
    assert.equal(result.valid, true);
    assert.equal(licenseService._buildStatusFromPayload(result.payload).tier, TIERS.COMMUNITY);
  });

  it('VER-LIC-014: inside the grace window an expired licence keeps its tier', () => {
    const justExpired = Math.floor(Date.now() / 1000) - 60;
    const status = licenseService._buildExpiredStatusFromPayload(
      serverPayload({ exp: justExpired, tier: 'professional' })
    );
    assert.equal(status.isGracePeriod, true);
    assert.equal(status.tier, 'professional');
    assert.ok(status.expiresAt, 'expiry date must be reported');

    // Past grace: fall back to Community, but still say when it expired.
    const longExpired = Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 365);
    const lapsed = licenseService._buildExpiredStatusFromPayload(
      serverPayload({ exp: longExpired, tier: 'professional' })
    );
    assert.equal(lapsed.tier, TIERS.COMMUNITY);
    assert.equal(lapsed.valid, false);
    assert.equal(lapsed.originalTier, 'professional');
    assert.ok(lapsed.expiresAt);
  });

  it('VER-LIC-015: TT- keys are told apart from signed tokens', () => {
    const { looksLikeServerKey } = require('../../services/licenseServerClient');
    assert.equal(looksLikeServerKey('TT-ABCD-EFGH-JKLM-NPQR'), true);
    assert.equal(looksLikeServerKey('  tt-abcd-efgh-jklm-npqr  '), true);
    assert.equal(looksLikeServerKey('eyJhbGciOiJFUzI1NiJ9.e30.sig'), false);
    assert.equal(looksLikeServerKey(''), false);
    assert.equal(looksLikeServerKey(null), false);
  });
});
