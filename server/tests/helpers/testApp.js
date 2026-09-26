/**
 * Minimal Express app for integration tests — avoids GitHub webhook IP fetch
 * and other long-lived side effects from server/index.js.
 */
require('../../config/envAliases').applyEnvAliases();

const express = require('express');
const cors = require('cors');
const { attachLicenseInfo } = require('../../middleware/licenseValidator');
const authRoutes = require('../../routes/auth');
const licenseRoutes = require('../../routes/license');
const pulseRoutes = require('../../routes/pulse');
const bugRoutes = require('../../routes/bugs');
const projectRoutes = require('../../routes/projects');
const exportRoutes = require('../../routes/export');
const storage = require('../../storage');
const fileStorageService = require('../../services/fileStorageService');
const deploymentConfig = require('../../config/deployment.config');

function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(attachLicenseInfo);
  app.use('/api/auth', authRoutes);
  app.use('/mertis/api/auth', authRoutes);
  app.use('/api/license', licenseRoutes);
  app.use('/api/pulse', pulseRoutes);
  app.use('/api/bugs', bugRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/export', exportRoutes);

  app.get('/api/health', async (req, res) => {
    try {
      const storageType = storage.getStorageType();
      const isConnected = await storage.getStorage().isConnected();
      const fileStorage = fileStorageService.getFileStorage();
      res.json({
        status: 'ok',
        storage: {
          type: storageType,
          connected: isConnected,
          provider: deploymentConfig.getDatabaseProvider()
        },
        fileStorage: {
          default: fileStorage?.defaultProvider || 'local',
          providers: fileStorage?.listProviders() || ['local']
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.json({
        status: 'ok',
        storage: { type: 'unknown', connected: false, error: error.message },
        timestamp: new Date().toISOString()
      });
    }
  });

  return app;
}

module.exports = { createTestApp };
