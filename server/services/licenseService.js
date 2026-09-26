const { TIERS, TIER_FEATURES, TIER_LIMITS } = require('../config/features');
const licenseConfig = require('../config/license.config');
const instanceConfig = require('../config/instance.config');
const { verifyLicenseKey, isExpired, getExpirationDate } = require('../utils/jwtHelper');

let cachedStatus = null;
let cacheExpiry = 0;

const COMMUNITY_STATUS = Object.freeze({
  tier: TIERS.COMMUNITY,
  status: 'active',
  valid: true,
  features: TIER_FEATURES[TIERS.COMMUNITY],
  limits: TIER_LIMITS[TIERS.COMMUNITY],
  licensee: null,
  company: null,
  email: null,
  expiresAt: null,
  gracePeriodEnds: null,
  isTrial: false,
  isGracePeriod: false
});

const getCommunityStatus = () => ({ ...COMMUNITY_STATUS });

const getBypassStatus = () => {
  const tier = instanceConfig.licenseTier || TIERS.ENTERPRISE;
  const baseLimits = TIER_LIMITS[tier] || TIER_LIMITS[TIERS.ENTERPRISE];
  return {
    tier,
    status: 'active',
    valid: true,
    features: TIER_FEATURES[tier] || TIER_FEATURES[TIERS.ENTERPRISE],
    limits: { ...baseLimits },
    // No customer name is hard-coded here. A waived instance shows the name
    // its operator set via MERTIS_ORGANIZATION_NAME, or none at all — the
    // white-label copy already renders cleanly when this is null.
    licensee: instanceConfig.licensee || null,
    company: instanceConfig.company || null,
    email: null,
    expiresAt: null,
    gracePeriodEnds: null,
    isTrial: false,
    isGracePeriod: false
  };
};

const isLicenseBypassed = () => instanceConfig.skipLicenseChecks === true;

// Lazy-load db and storage to avoid circular init issues
const getStorage = () => require('../storage');

const getDb = () => {
  try {
    const type = getStorage().getStorageType();
    if (type === 'postgres') return require('../storage/postgres/db');
  } catch (_) {}
  return require('../storage/mysql/db');
};

const isDatabaseMode = () => {
  try {
    const t = getStorage().getStorageType();
    return t === 'mysql' || t === 'postgres';
  } catch (_) {
    return false;
  }
};

const resolveLimitsFromPayload = (payload, tier) => {
  const baseLimits = TIER_LIMITS[tier] || TIER_LIMITS[TIERS.COMMUNITY];
  const payloadLimits = payload.limits || {};

  return {
    maxUsers: payloadLimits.maxUsers ?? payload.maxUsers ?? baseLimits.maxUsers,
    maxProjects: payloadLimits.maxProjects ?? payload.maxProjects ?? baseLimits.maxProjects,
    maxBugs: payloadLimits.maxBugs ?? payload.maxBugs ?? baseLimits.maxBugs,
    maxAttachmentSizeMB: payloadLimits.maxAttachmentSizeMB ?? baseLimits.maxAttachmentSizeMB,
    aiRequestsPerMonth: payloadLimits.aiRequestsPerMonth ?? baseLimits.aiRequestsPerMonth,
    maxWebhooks: payloadLimits.maxWebhooks ?? baseLimits.maxWebhooks,
    maxInstances: payloadLimits.maxInstances ?? baseLimits.maxInstances
  };
};

const buildStatusFromPayload = (payload) => {
  const tier = payload.tier || TIERS.COMMUNITY;
  const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;

  return {
    tier,
    originalTier: tier,
    status: payload.trial ? 'trial' : 'active',
    valid: true,
    isGracePeriod: false,
    isTrial: !!payload.trial,
    features: TIER_FEATURES[tier] || TIER_FEATURES[TIERS.COMMUNITY],
    limits: resolveLimitsFromPayload(payload, tier),
    licensee: payload.licensee || null,
    company: payload.company || null,
    email: payload.email || null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    gracePeriodEnds: null
  };
};

/**
 * Status for a verified-but-expired JWT (the CSV / file-mode path).
 *
 * Mirrors the grace-period behaviour buildStatus() gives SQL installs: inside
 * the grace window the tier is retained, after it we fall back to Community —
 * but either way we report expiresAt so the UI can actually say something.
 */
const buildExpiredStatusFromPayload = (payload) => {
  const base = buildStatusFromPayload(payload);
  const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
  const graceEnds = expiresAt
    ? new Date(expiresAt.getTime() + licenseConfig.gracePeriodDays * 24 * 60 * 60 * 1000)
    : null;
  const inGrace = !!(graceEnds && new Date() <= graceEnds);

  if (inGrace) {
    return {
      ...base,
      status: 'expired',
      valid: true,
      isGracePeriod: true,
      gracePeriodEnds: graceEnds.toISOString()
    };
  }

  return {
    ...getCommunityStatus(),
    originalTier: base.tier,
    status: 'expired',
    valid: false,
    email: base.email,
    expiresAt: base.expiresAt,
    gracePeriodEnds: graceEnds ? graceEnds.toISOString() : null
  };
};

/**
 * Resolve a licence from its database row (the MySQL / Postgres path).
 *
 * Entitlement comes from the **verified token**, never from the row's own
 * columns. Two bugs lived in the old column-trusting version:
 *
 *   - `activateLicense` stores `payload.maxUsers || null`, but licence-server
 *     tokens carry no maxUsers claim, so the row held NULL. The old guard was
 *     `!== undefined`, which a SQL NULL passes, and `checkLimit` reads null as
 *     unlimited — so a free Community key granted unlimited users and projects.
 *   - Nothing re-verified the stored token, so `UPDATE licenses SET tier=...`
 *     was a complete unlock. The CSV path re-verified every read and was
 *     therefore stronger than SQL.
 *
 * The row is still consulted for the two things the token cannot know: whether
 * an admin suspended this licence, and the stored grace window. Verification
 * costs one ES256 check per five minutes, since getLicenseStatus() is cached.
 */
const buildStatus = (licenseRow) => {
  // Suspension is an operator action recorded on the row, not in the token.
  if (licenseRow.status === 'suspended') {
    return {
      ...getCommunityStatus(),
      originalTier: licenseRow.tier,
      status: 'suspended',
      valid: false
    };
  }

  // Seeded Community rows carry no token. That is expected, not an error.
  const token = licenseRow.license_key;
  if (!token || token === 'COMMUNITY') {
    return getCommunityStatus();
  }

  let payload;
  try {
    payload = verifyLicenseKey(token);
  } catch (error) {
    // Loudly, never silently: a licence that stops verifying is either tampering
    // or a signing key we retired without keeping it pinned. Both need a human.
    console.error(
      `[License] Stored licence failed verification (${error.message}). `
      + 'Running at Community level. If a signing key was rotated, keep the '
      + 'retired key in PINNED_PUBLIC_KEYS.'
    );
    return getCommunityStatus();
  }

  const status = isExpired(payload)
    ? buildExpiredStatusFromPayload(payload)
    : buildStatusFromPayload(payload);

  // The row's grace window is authoritative where it exists — activateLicense
  // computed it from exp + gracePeriodDays and it may have been extended.
  const gracePeriodEnds = licenseRow.grace_period_ends
    ? new Date(licenseRow.grace_period_ends)
    : null;
  if (gracePeriodEnds && isExpired(payload)) {
    const inGrace = new Date() <= gracePeriodEnds;
    if (inGrace) {
      return {
        ...buildStatusFromPayload(payload),
        status: 'expired',
        valid: true,
        isGracePeriod: true,
        gracePeriodEnds: gracePeriodEnds.toISOString()
      };
    }
  }

  return {
    ...status,
    originalTier: licenseRow.tier || status.tier,
    isTrial: licenseRow.status === 'trial' || status.isTrial,
    gracePeriodEnds: gracePeriodEnds ? gracePeriodEnds.toISOString() : status.gracePeriodEnds
  };
};

const initialize = async () => {
  try {
    if (isLicenseBypassed()) {
      cachedStatus = getBypassStatus();
      cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
      console.log('[License] Instance bypass active — license checks waived (enterprise, no limits)');
      return;
    }

    if (!isDatabaseMode()) {
      const deploymentConfig = require('../config/deployment.config');
      const local = deploymentConfig.reloadLocalConfig();
      if (local.activatedLicenseKey) {
        const validation = await validateLicense(local.activatedLicenseKey);
        if (validation.valid) {
          cachedStatus = buildStatusFromPayload(validation.payload);
          cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
          console.log(`[License] CSV mode — tier from registered key: ${cachedStatus.tier.toUpperCase()}`);
          return;
        }
      }
      console.log('[License] CSV storage mode — Community Edition (register at portal for tracked license)');
      cachedStatus = getCommunityStatus();
      cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
      return;
    }

    const { query, queryOne } = getDb();

    // Ensure licenses table exists before querying
    try {
      const license = await queryOne(
        `SELECT * FROM licenses WHERE status IN ('active', 'trial', 'expired') ORDER BY created_at DESC LIMIT 1`
      );

      if (!license) {
        await query(
          `INSERT INTO licenses (tier, status, max_users, max_projects) VALUES (?, ?, ?, ?)`,
          [TIERS.COMMUNITY, 'active', 5, 3]
        );
        cachedStatus = getCommunityStatus();
      } else {
        cachedStatus = buildStatus(license);
      }
    } catch (dbErr) {
      // Table may not exist yet — default to Community
      console.warn('[License] licenses table not found, defaulting to Community Edition');
      console.warn('[License] Run server/database/license_schema.sql to enable license management');
      cachedStatus = getCommunityStatus();
    }

    cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
    console.log(`[License] Tier: ${cachedStatus.tier.toUpperCase()} | Status: ${cachedStatus.status}`);
  } catch (error) {
    console.warn('[License] Init error, defaulting to Community Edition:', error.message);
    cachedStatus = getCommunityStatus();
    cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
  }
};

const getLicenseStatus = async () => {
  if (isLicenseBypassed()) {
    return getBypassStatus();
  }

  if (cachedStatus && Date.now() < cacheExpiry) {
    return cachedStatus;
  }

  try {
    if (!isDatabaseMode()) {
      const deploymentConfig = require('../config/deployment.config');
      const local = deploymentConfig.reloadLocalConfig();
      if (local.activatedLicenseKey) {
        const validation = await validateLicense(local.activatedLicenseKey);
        if (validation.valid) {
          cachedStatus = buildStatusFromPayload(validation.payload);
          cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
          return cachedStatus;
        }
        // Signature verified but past exp: keep the expiry date so the UI can
        // warn, instead of silently pretending no licence was ever activated.
        if (validation.payload) {
          cachedStatus = buildExpiredStatusFromPayload(validation.payload);
          cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
          return cachedStatus;
        }
      }
      return getCommunityStatus();
    }

    const { query, queryOne } = getDb();

    const license = await queryOne(
      `SELECT * FROM licenses WHERE status IN ('active', 'trial', 'expired') ORDER BY created_at DESC LIMIT 1`
    );

    if (!license) {
      cachedStatus = getCommunityStatus();
    } else {
      cachedStatus = buildStatus(license);
      await query(`UPDATE licenses SET last_validated_at = NOW() WHERE id = ?`, [license.id]);
    }

    cacheExpiry = Date.now() + licenseConfig.cacheExpiryMs;
    return cachedStatus;
  } catch (error) {
    console.warn('[License] Status fetch failed, using cached:', error.message);
    return cachedStatus || getCommunityStatus();
  }
};

const validateLicense = async (licenseKey) => {
  try {
    const payload = verifyLicenseKey(licenseKey);
    if (isExpired(payload)) {
      return { valid: false, error: 'License key is expired', payload };
    }
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

const activateLicense = async (licenseKey, adminEmail, serverKey = null, instanceId = null) => {
  if (!isDatabaseMode()) {
    throw new Error('License activation requires MySQL or PostgreSQL storage');
  }

  const validation = await validateLicense(licenseKey);
  if (!validation.valid) {
    throw new Error(`Invalid license key: ${validation.error}`);
  }

  const payload = validation.payload;
  const expiresAt = getExpirationDate(payload);
  const gracePeriodEnds = expiresAt
    ? new Date(expiresAt.getTime() + licenseConfig.gracePeriodDays * 24 * 60 * 60 * 1000)
    : null;

  const toMysqlTimestamp = (d) => d ? d.toISOString().slice(0, 19).replace('T', ' ') : null;

  const resolvedLimits = resolveLimitsFromPayload(payload, payload.tier || TIERS.COMMUNITY);

  const { query } = getDb();

  await query(`UPDATE licenses SET status = 'suspended' WHERE status IN ('active', 'trial')`);

  await query(
    `INSERT INTO licenses
     (license_key, tier, status, customer_email, customer_name, company_name,
      max_users, max_projects, expires_at, grace_period_ends, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      licenseKey,
      payload.tier || TIERS.COMMUNITY,
      payload.trial ? 'trial' : 'active',
      payload.email || adminEmail || null,
      payload.licensee || null,
      payload.company || null,
      // Resolved limits, not raw claims. Licence-server tokens carry no
      // maxUsers/maxProjects, so the old `payload.maxUsers || null` wrote NULL
      // into every row. These columns are informational now — buildStatus()
      // resolves entitlement from the verified token — but a NULL here reads
      // as "unlimited" to anyone inspecting the database, which is a lie.
      resolvedLimits.maxUsers,
      resolvedLimits.maxProjects,
      toMysqlTimestamp(expiresAt),
      toMysqlTimestamp(gracePeriodEnds),
      JSON.stringify({ jti: payload.jti, features: payload.features || [], serverKey, instanceId })
    ]
  );

  cachedStatus = null;
  cacheExpiry = 0;

  return getLicenseStatus();
};

/**
 * The instanceId recorded when this install activated its licence.
 *
 * The licence server binds a licence to one machine_id, and ours is the
 * instanceId. If deployment.local.json is lost we must reuse the original value
 * rather than mint a new one, or activation comes back 403 with no way out.
 */
const getStoredInstanceId = async () => {
  if (!isDatabaseMode()) return null;
  try {
    const { queryOne } = getDb();
    const row = await queryOne(
      `SELECT metadata FROM licenses WHERE metadata IS NOT NULL ORDER BY created_at DESC LIMIT 1`
    );
    if (!row || !row.metadata) return null;
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    return meta.instanceId || null;
  } catch (_) {
    return null;
  }
};

/** The licence-server key (TT-...) this install activated with, if any. */
const getStoredServerKey = async () => {
  const deploymentConfig = require('../config/deployment.config');
  const local = deploymentConfig.reloadLocalConfig();
  if (local.licenseServerKey) return local.licenseServerKey;
  if (!isDatabaseMode()) return null;
  try {
    const { queryOne } = getDb();
    const row = await queryOne(
      `SELECT metadata FROM licenses WHERE status IN ('active', 'trial', 'expired') ORDER BY created_at DESC LIMIT 1`
    );
    if (!row || !row.metadata) return null;
    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
    return meta.serverKey || null;
  } catch (_) {
    return null;
  }
};

const deactivateLicense = async () => {
  if (!isDatabaseMode()) {
    throw new Error('License management requires MySQL or PostgreSQL storage');
  }

  const { query } = getDb();
  await query(`UPDATE licenses SET status = 'suspended' WHERE status IN ('active', 'trial')`);
  await query(
    `INSERT INTO licenses (tier, status, max_users, max_projects) VALUES (?, ?, ?, ?)`,
    [TIERS.COMMUNITY, 'active', 5, 3]
  );

  cachedStatus = null;
  cacheExpiry = 0;

  return getLicenseStatus();
};

const countUsers = async () => {
  if (isDatabaseMode()) {
    const rows = await getDb().query(`SELECT COUNT(*) AS count FROM users`);
    return Number(rows[0].count);
  }
  const users = await getStorage().getAllUsers();
  return users.length;
};

const countProjects = async () => {
  if (isDatabaseMode()) {
    const rows = await getDb().query(`SELECT COUNT(*) AS count FROM projects`);
    return Number(rows[0].count);
  }
  const projects = await getStorage().getAllProjects(null, true);
  return projects.length;
};

const countBugs = async () => {
  if (isDatabaseMode()) {
    const rows = await getDb().query(`SELECT COUNT(*) AS count FROM bugs`);
    return Number(rows[0].count);
  }
  const bugs = await getStorage().getAllBugs(100000);
  return bugs.length;
};

const checkLimit = async (type) => {
  if (isLicenseBypassed()) {
    return { allowed: true, current: null, max: null };
  }

  const status = await getLicenseStatus();
  const limits = status.limits;

  if (type === 'users') {
    if (limits.maxUsers === null) return { allowed: true, current: null, max: null };
    const count = await countUsers();
    return { allowed: count < limits.maxUsers, current: count, max: limits.maxUsers };
  }

  if (type === 'projects') {
    if (limits.maxProjects === null) return { allowed: true, current: null, max: null };
    const count = await countProjects();
    return { allowed: count < limits.maxProjects, current: count, max: limits.maxProjects };
  }

  if (type === 'bugs') {
    if (limits.maxBugs === null) return { allowed: true, current: null, max: null };
    const count = await countBugs();
    return { allowed: count < limits.maxBugs, current: count, max: limits.maxBugs };
  }

  return { allowed: true, current: null, max: null };
};

const getAttachmentLimitBytes = async () => {
  const status = await getLicenseStatus();
  const maxMB = status.limits.maxAttachmentSizeMB;
  if (maxMB === null || maxMB === undefined) return null;
  return maxMB * 1024 * 1024;
};

const invalidateCache = () => {
  cachedStatus = null;
  cacheExpiry = 0;
};

module.exports = {
  initialize,
  validateLicense,
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  checkLimit,
  getAttachmentLimitBytes,
  invalidateCache,
  // Test exports (Stage 1 tier catalog verification)
  _buildStatusFromPayload: buildStatusFromPayload,
  getStoredInstanceId,
  getStoredServerKey,
  _getCommunityStatus: getCommunityStatus,
  _buildExpiredStatusFromPayload: buildExpiredStatusFromPayload,
  _buildStatus: buildStatus
};
