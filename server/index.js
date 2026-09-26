// SPDX-License-Identifier: BUSL-1.1
/**
 * Mertis Server
 * 
 * Mertis — multi-project bug tracking with automatic storage backend detection.
 * Supports both MySQL and CSV storage backends.
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });

// Immediately after the .env files load and before any config module reads
// process.env: installs written against the old MANTIS_* names keep working.
require('./config/envAliases').applyEnvAliases();

const express = require('express');
const cors = require('cors');
const emailRoutes = require('./routes/email');
const emailService = require('./services/emailService');
const licenseService = require('./services/licenseService');
const licenseRoutes = require('./routes/license');
const deploymentRoutes = require('./routes/deployment');
const trelloRoutes = require('./routes/trello');
const setupRoutes = require('./routes/setup');
const brandingRoutes = require('./routes/branding');
const pulseRoutes = require('./routes/pulse');
const exportRoutes = require('./routes/export');
const { attachLicenseInfo } = require('./middleware/licenseValidator');
const webhookService = require('./services/webhookService');
const fileStorageService = require('./services/fileStorageService');

// Import storage factory
const storage = require('./storage');

// Import routes
const authRoutes = require('./routes/auth');
const bugRoutes = require('./routes/bugs');
const projectRoutes = require('./routes/projects');
const analyticsRoutes = require('./routes/analytics');
const attachmentsRoutes = require('./routes/attachments');  // NEW
const githubWebhook = require('./routes/github-webhook');
const trelloWebhook = require('./routes/trello-webhook');

const app = express();
const PORT = process.env.PORT || 5000;

// Dev origins only. Every deployment adds its own via CORS_ORIGIN (comma
// separated) -- no customer hostname belongs in the product source.
const corsOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean)
];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

const isGithubWebhookPath = (path) =>
  path === '/api/webhooks/github' || path === '/mertis/api/webhooks/github';

// FIX: Use JSON body parser for all routes EXCEPT the GitHub webhook
// The webhook needs the raw body to verify the HMAC signature
app.use((req, res, next) => {
  if (isGithubWebhookPath(req.path)) {
    // Skip JSON parsing for webhook - let the route handle it with express.raw()
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Serve uploaded files (for local storage)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Brand assets (logos) — repo root imgs/ folder, served at /mertis/imgs
app.use('/mertis/imgs', express.static(path.join(__dirname, '../imgs')));
app.use('/imgs', express.static(path.join(__dirname, '../imgs')));

// Attach license info to every request (cached, non-blocking)
app.use(attachLicenseInfo);

const mountApi = (base) => {
  app.use(`${base}/setup`, setupRoutes);
  app.use(`${base}/branding`, brandingRoutes);
  app.use(`${base}/auth`, authRoutes);
  app.use(`${base}/bugs`, bugRoutes);
  app.use(`${base}/projects`, projectRoutes);
  app.use(`${base}/analytics`, analyticsRoutes);
  app.use(`${base}/attachments`, attachmentsRoutes);
  app.use(`${base}/webhooks`, githubWebhook);
  app.use(`${base}/webhooks/trello`, trelloWebhook);
  app.use(`${base}/email`, emailRoutes);
  app.use(`${base}/license`, licenseRoutes);
  app.use(`${base}/deployment`, deploymentRoutes);
  app.use(`${base}/trello`, trelloRoutes);
  app.use(`${base}/pulse`, pulseRoutes);
  app.use(`${base}/export`, exportRoutes);
};

// Client uses axios baseURL `/mertis`, so production must serve APIs at both prefixes.
mountApi('/api');
mountApi('/mertis/api');

async function initializeEmailService() {
  if (!storage.isSqlStorage()) {
    console.log('[EmailService] Skipped — scheduled email reports require MySQL or PostgreSQL (current: CSV)');
    return;
  }

  try {
    await emailService.initializeTransporter();
    await emailService.loadScheduledReports();
    console.log('[Server] Email service initialized');
  } catch (error) {
    console.error('[Server] Email service error:', error.message);
  }
}

// Health check endpoint
const healthHandler = async (req, res) => {
  try {
    const storageType = storage.getStorageType();
    const isConnected = await storage.getStorage().isConnected();
    
    const deploymentConfig = require('./config/deployment.config');
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
      storage: {
        type: 'unknown',
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
};

app.get('/api/health', healthHandler);
app.get('/mertis/api/health', healthHandler);

// Serve static files in production (app is built for /mertis base path)
if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../client/build');
  app.use('/mertis', express.static(clientBuild));
  app.get('/mertis/*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

const startServer = async () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  // Read from package.json so the banner, the package and the image tag
  // cannot drift apart.
  const banner = `Mertis Server v${require('../package.json').version}`;
  console.log(`║${banner.padStart(Math.floor((43 + banner.length) / 2)).padEnd(43)}║`);
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Initialize storage (auto-detects MySQL or falls back to CSV)
    await storage.initializeStorage();

    fileStorageService.initFileStorage();
    webhookService.loadPlugins();

    // Initialize license service after storage is ready
    await licenseService.initialize();

    // Periodically re-check the licence so a rolled-forward expiry is picked up
    // before the current token lapses. Best-effort; never blocks startup.
    require('./services/licenseActivation').startRefreshTimer();

    console.log('');
    console.log(`Storage Type: ${storage.getStorageType().toUpperCase()}`);
    console.log('');
    
    // Start Express server
    const setupService = require('./services/setupService');
    const setupComplete = setupService.isSetupComplete();
    const devDefaults =
      process.env.NODE_ENV === 'development' || process.env.MERTIS_DEV_DEFAULTS === 'true';

    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
      console.log('Endpoints:');
      console.log(`  • API:         http://localhost:${PORT}/api`);
      console.log(`  • Health:      http://localhost:${PORT}/api/health`);
      console.log(`  • Attachments: http://localhost:${PORT}/api/attachments`);
      console.log('');
      if (!setupComplete) {
        console.log('  → First-run setup: http://localhost:3000/mertis/setup');
        console.log('    (or complete via /api/setup on this server)');
      } else if (devDefaults) {
        console.log('  Dev credentials: admin / admin123');
      }
      console.log('');
    });
    
    initializeEmailService()

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

module.exports = { app, startServer };

if (require.main === module) {
  startServer();
}
