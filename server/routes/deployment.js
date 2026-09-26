/**
 * Deployment configuration API — database, storage, webhooks, plugins.
 * Godmode only for writes; admins can view and test connections.
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const deploymentConfig = require('../config/deployment.config');
const deploymentSettingsService = require('../services/deploymentSettingsService');
const connectionTestService = require('../services/connectionTestService');
const webhookService = require('../services/webhookService');

const isPrivileged = (user) => user && (user.role === 'godmode' || user.role === 'admin');
const isGodmode = (user) => user && user.role === 'godmode';
const setupService = require('../services/setupService');

router.get('/setup-status', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const status = await setupService.getSetupStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/setup/complete', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await setupService.completeSetup({
      licenseSkipped: !!req.body.licenseSkipped,
      licenseKey: req.body.licenseKey,
      organizationName: req.body.organizationName,
      completedBy: req.user.username
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/providers', authMiddleware, (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  res.json({
    databaseProviders: deploymentConfig.DATABASE_PROVIDERS,
    fileStorageProviders: deploymentConfig.FILE_STORAGE_PROVIDERS,
    webhookEvents: deploymentConfig.WEBHOOK_EVENTS,
    documentation: '/docs/DEPLOYMENT.md'
  });
});

router.get('/status', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const storage = require('../storage');
    res.json({
      ...deploymentSettingsService.getSettingsForClient(),
      runtime: {
        databaseType: storage.getStorageType(),
        databaseConnected: await storage.getStorage().isConnected().catch(() => false)
      }
    });
  } catch (err) {
    res.json({
      ...deploymentSettingsService.getSettingsForClient(),
      runtime: { databaseType: 'unknown', databaseConnected: false, error: err.message }
    });
  }
});

router.post('/settings', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await deploymentSettingsService.saveSettings(req.body);
    webhookService.reloadPlugins();
    res.json({
      ...result,
      restartRequired: !!req.body.database,
      message: req.body.database
        ? 'Database settings saved. Restart the server for database changes to take effect.'
        : 'Settings saved.'
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/test/database', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { provider, config } = req.body;
  const result = await connectionTestService.testDatabase(provider, config || {});
  res.json(result);
});

router.post('/test/storage', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const result = await connectionTestService.testFileStorage(req.body.provider);
  res.json(result);
});

router.post('/test/webhook', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { url, secret } = req.body;
  const result = await connectionTestService.testWebhookUrl(url, secret);
  res.json(result);
});

router.get('/plugins', authMiddleware, (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const loaded = webhookService.loadPlugins().map(p => ({
    name: p.name,
    description: p.module.description || null
  }));

  res.json({
    loaded,
    pluginDir: deploymentConfig.getWebhookConfig().pluginDir,
    hint: 'Drop .js files in server/plugins/ exporting { name, description, onEvent(event, data) }'
  });
});

module.exports = router;
