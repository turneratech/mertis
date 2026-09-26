const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const licenseService = require('../services/licenseService');
const featureService = require('../services/featureService');
const licenseActivation = require('../services/licenseActivation');

const router = express.Router();

const isAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'godmode')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/license/status — Public: returns current tier, features, limits
router.get('/status', async (req, res) => {
  try {
    const status = await licenseService.getLicenseStatus();
    const featureMap = await featureService.getFeatureAvailabilityMap();
    res.json({ ...status, featureMap });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve license status' });
  }
});

// POST /api/license/activate — Admin: activate a licence.
// Accepts either a TT- key from the licence server or a pasted token (offline).
router.post('/activate', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({ error: 'licenseKey is required' });
    }
    const result = await licenseActivation.applyLicense(
      licenseKey,
      req.user.email || req.user.username
    );
    featureService.clearCache();
    res.json({ message: 'License activated successfully', ...result });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message, code: error.code });
  }
});

// POST /api/license/release — Admin: unbind this install at the licence server
// so the same key can be activated on a new one.
router.post('/release', authMiddleware, isAdmin, async (req, res) => {
  try {
    const result = await licenseActivation.releaseLicense();
    res.json({ message: 'License released. This install is now unbound.', ...result });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message, code: error.code });
  }
});

// POST /api/license/validate — Admin: decode and validate a key without activating
router.post('/validate', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { licenseKey } = req.body;
    if (!licenseKey || typeof licenseKey !== 'string') {
      return res.status(400).json({ error: 'licenseKey is required' });
    }
    const result = await licenseService.validateLicense(licenseKey);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/license/limits — Auth: current resource counts vs tier limits
router.get('/limits', authMiddleware, async (req, res) => {
  try {
    const [users, projects, bugs] = await Promise.all([
      licenseService.checkLimit('users'),
      licenseService.checkLimit('projects'),
      licenseService.checkLimit('bugs')
    ]);
    res.json({ users, projects, bugs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve limit information' });
  }
});

// DELETE /api/license/deactivate — Admin: suspend active license, revert to Community
router.delete('/deactivate', authMiddleware, isAdmin, async (req, res) => {
  try {
    const status = await licenseService.deactivateLicense();
    featureService.clearCache();
    res.json({ message: 'License deactivated — reverted to Community Edition', ...status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
