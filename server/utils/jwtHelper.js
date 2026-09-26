const jwt = require('jsonwebtoken');
const licenseConfig = require('../config/license.config');

/**
 * Candidate ES256 public keys, newest first.
 *
 * LICENSE_PUBLIC_KEY (single PEM, or several comma-separated) is **added to**
 * the keys pinned in license.config.js, not substituted for them. It used to
 * replace them, which meant a customer rotating a key silently un-trusted every
 * pinned key — one typo and a valid production licence stopped verifying with a
 * misleading error.
 *
 * This is robustness, not protection. Anyone who controls the deployment can
 * trust their own key whatever we do here; that hole is unclosable by design,
 * which is why enforcement is the licence terms rather than the code. What this
 * does buy is a visible signal: extra trusted keys are logged once at startup,
 * so tampering shows up in a support bundle.
 *
 * Pinning the *public* key in source is deliberate: fetching it from the licence
 * server at runtime would let that server mint itself a trusted key and would
 * make verification an online operation, which breaks air-gapped installs.
 */
let warnedAboutExtraKeys = false;

const publicKeys = () => {
  const fromEnv = (process.env.LICENSE_PUBLIC_KEY || '').trim();
  const extra = fromEnv
    ? fromEnv.split(/,(?=\s*-----BEGIN)/).map(k => k.trim()).filter(Boolean)
    : [];

  if (extra.length && !warnedAboutExtraKeys) {
    warnedAboutExtraKeys = true;
    console.warn(
      `[License] ${extra.length} additional signing key(s) trusted from `
      + 'LICENSE_PUBLIC_KEY, alongside the keys pinned in this build.'
    );
  }

  const keys = [...licenseConfig.jwt.publicKeys, ...extra];
  if (!keys.length) {
    throw new Error(
      'No licence public key available. Set LICENSE_PUBLIC_KEY, or pin one in server/config/license.config.js.'
    );
  }
  return keys;
};

/**
 * Verify a licence JWT and return its payload.
 *
 * Expiry is checked by the caller via isExpired(), NOT by jsonwebtoken. If we
 * let jwt.verify throw TokenExpiredError we lose the payload, and with it the
 * expiry date — so nothing downstream can say "your licence lapsed on <date>"
 * and an expired install just silently degrades to Community.
 */
const verifyLicenseKey = (licenseKey) => {
  const keys = publicKeys();
  let lastError;
  for (const key of keys) {
    try {
      return jwt.verify(licenseKey, key, {
        algorithms: licenseConfig.jwt.algorithms,
        issuer: licenseConfig.jwt.issuer,
        ignoreExpiration: true,
        clockTolerance: licenseConfig.jwt.clockToleranceSec
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const decodeLicenseKey = (licenseKey) => {
  return jwt.decode(licenseKey);
};

const isExpired = (payload) => {
  if (!payload || !payload.exp) return false;
  const toleranceMs = (licenseConfig.jwt.clockToleranceSec || 0) * 1000;
  return Date.now() > (payload.exp * 1000) + toleranceMs;
};

const getExpirationDate = (payload) => {
  if (!payload || !payload.exp) return null;
  return new Date(payload.exp * 1000);
};

module.exports = { verifyLicenseKey, decodeLicenseKey, isExpired, getExpirationDate };
