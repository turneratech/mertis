/**
 * Licence verification settings.
 *
 * Licences are ES256 JWTs issued by the Turnera Tech licence server
 * (https://license.turneratech.com, see its /v1 API). Mertis verifies them
 * OFFLINE against a pinned public key — the server is contacted once, at
 * activation, and never again for a licence to keep working.
 */

/**
 * Pinned licence-server public keys (ES256 / P-256, SPKI PEM), newest first.
 *
 * Populate from `GET https://license.turneratech.com/v1/public-key` →
 * `formats.jwt.pem`. Keeping old keys in the list makes a future key rotation a
 * rolling change rather than a flag day. `LICENSE_PUBLIC_KEY` overrides this.
 */
const PINNED_PUBLIC_KEYS = [
  // license.turneratech.com, fetched 2026-09-21 from GET /v1/public-key
  // -> formats.jwt.pem. This is a PUBLIC key; pinning it in source is the point,
  // so verification stays offline and the server cannot hand us a key to trust.
  // Newest first. Keep retired keys below a new one so rotation is a rolling
  // change rather than a flag day.
  `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/axo9hqo9OTs36Nghje+MvdXPKmn
+pUZP+/GG5JTuhGi1T1W4Uz36gMJQixcakUAKXuRkiy8b5zIovZELX5gug==
-----END PUBLIC KEY-----`
];

module.exports = {
  jwt: {
    algorithms: ['ES256'],
    issuer: 'turneratech.com',
    publicKeys: PINNED_PUBLIC_KEYS,
    // VM clock drift near expiry is a real support call; 0 (the jsonwebtoken
    // default) makes a few seconds of skew look like an expired licence.
    clockToleranceSec: 60
  },
  gracePeriodDays: 14,
  cacheExpiryMs: 5 * 60 * 1000,
  // How often an install activated with a TT- key re-checks for a rolled-forward
  // expiry. Verification stays offline; this only picks up a renewal.
  onlineCheckIntervalHours: Number(process.env.LICENSE_AUTO_REFRESH_HOURS || 24),
  // Opt-out. Set LICENSE_AUTO_REFRESH=false and Mertis makes no outbound call
  // after activation, at the cost of the licence expiring rather than renewing.
  autoRefresh: process.env.LICENSE_AUTO_REFRESH !== 'false',
  licenseServerUrl: (process.env.LICENSE_SERVER_URL || 'https://license.turneratech.com').replace(/\/$/, ''),
  licenseServerTimeoutMs: Number(process.env.LICENSE_SERVER_TIMEOUT_MS || 10000),
  enableOnlineValidation: process.env.ENABLE_ONLINE_VALIDATION === 'true',
  enableFeatureTracking: process.env.ENABLE_FEATURE_TRACKING !== 'false'
};
