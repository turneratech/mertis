const licenseService = require('../services/licenseService');
const featureService = require('../services/featureService');
const { TIER_FEATURES, TIERS } = require('../config/features');

// Attaches req.license to every request — lightweight, uses cached status
const attachLicenseInfo = async (req, res, next) => {
  try {
    req.license = await licenseService.getLicenseStatus();
  } catch (_) {
    req.license = {
      tier: TIERS.COMMUNITY,
      status: 'active',
      valid: true,
      features: TIER_FEATURES[TIERS.COMMUNITY],
      limits: require('../config/features').TIER_LIMITS[TIERS.COMMUNITY]
    };
  }
  next();
};

// Middleware factory: gate a route behind a specific feature flag
const requireFeature = (featureName) => async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    await featureService.requireFeature(featureName, userId);
    next();
  } catch (error) {
    if (error.code === 'FEATURE_NOT_AVAILABLE') {
      return res.status(403).json({
        error: 'Feature not available on your current license tier',
        feature: error.feature,
        currentTier: error.currentTier,
        upgradeRequired: true
      });
    }
    next(error);
  }
};

// Counting rows and then letting the route do the insert leaves a window: N
// concurrent creates at 249/250 all read 249 and all commit. So a create holds
// a per-limit-type lock from the count until its response is sent, which makes
// check-and-create atomic within this process. Creation is low-frequency, so
// the serialisation costs nothing a user can perceive.
//
// A lock is only as safe as its release. It is released when the response
// finishes, when the connection closes, and — as a backstop against a handler
// that does neither — after a timeout, so a single wedged request can never
// stop the instance creating anything ever again.
const LOCK_TIMEOUT_MS = Number(process.env.MERTIS_LIMIT_LOCK_TIMEOUT_MS) || 30000;
const limitLocks = new Map();

const acquire = (limitType) => {
  const previous = limitLocks.get(limitType) || Promise.resolve();
  let release;
  const next = previous.then(() => new Promise((resolve) => { release = resolve; }));
  limitLocks.set(limitType, next.catch(() => {}));
  return previous.then(() => release);
};

const releaseOnce = (release, timer) => {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    clearTimeout(timer.id);
    release();
  };
};

// Middleware factory: enforce a user/project/bug count limit before creating a resource
const checkLimit = (limitType) => async (req, res, next) => {
  const release = await acquire(limitType);
  const timer = {};
  const done = releaseOnce(release, timer);
  timer.id = setTimeout(() => {
    console.warn(`[License] Limit lock for '${limitType}' timed out after ${LOCK_TIMEOUT_MS}ms — releasing`);
    done();
  }, LOCK_TIMEOUT_MS);
  if (timer.id.unref) timer.id.unref();

  res.on('finish', done);
  res.on('close', done);

  try {
    const result = await licenseService.checkLimit(limitType);
    if (!result.allowed) {
      return res.status(403).json({
        error: `${limitType.charAt(0).toUpperCase() + limitType.slice(1)} limit reached for your license tier`,
        limitType,
        current: result.current,
        max: result.max,
        upgradeRequired: true
      });
    }
    next();
  } catch (error) {
    // Fail open — a broken limit check must never block core functionality
    console.warn(`[License] Limit check error for '${limitType}':`, error.message);
    done();
    next();
  }
};

// Middleware factory: enforce attachment size against tier limit (run after multer)
const enforceAttachmentSize = async (req, res, next) => {
  try {
    if (!req.file) return next();
    const maxBytes = await licenseService.getAttachmentLimitBytes();
    if (maxBytes === null) return next();
    if (req.file.size > maxBytes) {
      const maxMB = Math.round(maxBytes / (1024 * 1024));
      return res.status(403).json({
        error: `Attachment size exceeds ${maxMB}MB limit for your license tier`,
        maxSizeMB: maxMB,
        upgradeRequired: true
      });
    }
    next();
  } catch (error) {
    console.warn('[License] Attachment size check error:', error.message);
    next();
  }
};

module.exports = { attachLicenseInfo, requireFeature, checkLimit, enforceAttachmentSize };
