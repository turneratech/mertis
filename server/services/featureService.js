const licenseService = require('./licenseService');
const licenseConfig = require('../config/license.config');
const instanceConfig = require('../config/instance.config');
const { FEATURES, TIER_FEATURES, TIERS } = require('../config/features');

let featureCache = new Map();
let featureCacheExpiry = 0;

const clearCache = () => {
  featureCache.clear();
  featureCacheExpiry = 0;
};

const isFeatureAvailable = async (featureName) => {
  if (instanceConfig.skipLicenseChecks === true) {
    return true;
  }

  const now = Date.now();
  if (featureCache.has(featureName) && now < featureCacheExpiry) {
    return featureCache.get(featureName);
  }

  try {
    const status = await licenseService.getLicenseStatus();
    const available = status.valid && Array.isArray(status.features) && status.features.includes(featureName);

    // Refresh entire cache together for efficiency
    if (!featureCache.size) {
      for (const f of Object.values(FEATURES)) {
        featureCache.set(f, status.valid && Array.isArray(status.features) && status.features.includes(f));
      }
      featureCacheExpiry = now + licenseConfig.cacheExpiryMs;
    } else {
      featureCache.set(featureName, available);
    }

    return available;
  } catch (_) {
    // Fail-safe: allow all Community features
    return TIER_FEATURES[TIERS.COMMUNITY].includes(featureName);
  }
};

const logFeatureUsage = async (featureName, userId, allowed, currentTier) => {
  if (!licenseConfig.enableFeatureTracking) return;
  try {
    const storage = require('../storage');
    if (storage.getStorageType() !== 'mysql') return;
    const { query } = require('../storage/mysql/db');
    await query(
      `INSERT INTO feature_usage_log (feature_name, user_id, allowed, current_tier) VALUES (?, ?, ?, ?)`,
      [featureName, userId || null, allowed ? 1 : 0, currentTier]
    );
  } catch (_) {
    // Non-blocking
  }
};

const requireFeature = async (featureName, userId = null) => {
  const available = await isFeatureAvailable(featureName);

  let currentTier = TIERS.COMMUNITY;
  try {
    const status = await licenseService.getLicenseStatus();
    currentTier = status.tier;
  } catch (_) {}

  // Fire-and-forget usage log
  logFeatureUsage(featureName, userId, available, currentTier);

  if (!available) {
    const err = new Error(`Feature '${featureName}' requires a higher license tier`);
    err.code = 'FEATURE_NOT_AVAILABLE';
    err.feature = featureName;
    err.currentTier = currentTier;
    throw err;
  }

  return true;
};

const getFeatureAvailabilityMap = async () => {
  if (instanceConfig.skipLicenseChecks === true) {
    const map = {};
    for (const feature of Object.values(FEATURES)) {
      map[feature] = true;
    }
    return map;
  }

  const status = await licenseService.getLicenseStatus();
  const map = {};
  for (const feature of Object.values(FEATURES)) {
    map[feature] = status.valid && Array.isArray(status.features) && status.features.includes(feature);
  }
  return map;
};

module.exports = { isFeatureAvailable, requireFeature, getFeatureAvailabilityMap, clearCache };
