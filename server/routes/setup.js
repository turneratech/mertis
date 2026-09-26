/**
 * Public first-run setup API — only available until setupComplete is true.
 */

const express = require('express');
const router = express.Router();
const setupService = require('../services/setupService');

const handleSetup = (fn) => async (req, res) => {
  try {
    if (setupService.isSetupComplete()) {
      return res.status(403).json({ error: 'Setup already completed' });
    }
    const result = await fn(req, res);
    if (result !== undefined) res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Setup failed' });
  }
};

router.get('/status', async (req, res) => {
  try {
    const status = await setupService.getSetupStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/providers', handleSetup(async () => setupService.getProviders()));

router.post('/bootstrap-admin', handleSetup(async (req) => {
  const { username, password, email } = req.body;
  return setupService.bootstrapAdmin({ username, password, email });
}));

router.post('/settings', handleSetup(async (req) => {
  const result = await setupService.saveSetupSettings(req.body);
  return {
    ...result,
    restartRequired: !!req.body.database,
    message: req.body.database
      ? 'Database settings saved. Restart the server for database changes to take effect.'
      : 'Settings saved.'
  };
}));

router.post('/test/database', handleSetup(async (req) => {
  const { provider, config } = req.body;
  return setupService.testDatabase(provider, config);
}));

router.post('/test/storage', handleSetup(async (req) => {
  return setupService.testStorage(req.body.provider);
}));

router.post('/complete', handleSetup(async (req) => {
  const { licenseSkipped, licenseKey, username, organizationName } = req.body;
  return setupService.completeSetup({
    licenseSkipped: !!licenseSkipped,
    licenseKey,
    organizationName,
    completedBy: username || 'setup-wizard'
  });
}));

module.exports = router;
