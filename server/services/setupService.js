/**
 * First-run setup — unauthenticated bootstrap until setupComplete is set.
 * Website portal accounts are separate; the instance admin is created here.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const deploymentConfig = require('../config/deployment.config');
const instanceConfig = require('../config/instance.config');
const organization = require('../config/organization');
const deploymentSettingsService = require('./deploymentSettingsService');
const connectionTestService = require('./connectionTestService');
const storage = require('../storage');
const { generateToken } = require('../middleware/auth');

const setupError = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isSetupComplete = () =>
  instanceConfig.skipSetupWizard === true
  || deploymentConfig.reloadLocalConfig().setupComplete === true;

const assertSetupOpen = () => {
  if (isSetupComplete()) throw setupError('Setup already completed', 403);
};

/**
 * Stable per-install identifier, used as the licence server's machine_id.
 *
 * This lived only in server/data/deployment.local.json, which is gitignored and
 * not in any backup of the database. A container rebuilt without a volume on
 * server/data, or a DB restored without that file, generated a fresh UUID and
 * the licence server answered 403 "bound to another machine" — with no
 * self-service way back. So the JSON file stays the fast path, but the value is
 * mirrored into deployment settings (SQL) and recovered from there.
 */
const getInstanceId = () => {
  const local = deploymentConfig.reloadLocalConfig();
  if (local.instanceId) return local.instanceId;
  const id = crypto.randomUUID();
  deploymentConfig.saveLocalConfig({ instanceId: id });
  return id;
};

/**
 * Async form: recovers the id from the activated licence row before minting a
 * new one, so a lost deployment.local.json on a SQL install does not orphan the
 * licence binding. CSV installs keep everything in server/data, so there the
 * answer is a persistent volume (see docker-compose).
 */
const resolveInstanceId = async () => {
  const local = deploymentConfig.reloadLocalConfig();
  if (local.instanceId) return local.instanceId;

  let stored = null;
  try {
    stored = await require('./licenseService').getStoredInstanceId();
  } catch (_) {
    stored = null;
  }

  const id = stored || crypto.randomUUID();
  deploymentConfig.saveLocalConfig({ instanceId: id });
  return id;
};

const hasPrivilegedUser = async () => {
  const users = await storage.getAllUsers();
  return users.some(u => u.role === 'admin' || u.role === 'godmode');
};

const getSetupStatus = async () => {
  const local = deploymentConfig.reloadLocalConfig();
  const setupComplete = isSetupComplete();
  const needsBootstrapAdmin = !(await hasPrivilegedUser());
  const needsSetup = !setupComplete;

  let license = { tier: 'community', status: 'active' };
  try {
    const licenseService = require('./licenseService');
    license = await licenseService.getLicenseStatus();
  } catch (_) {
    /* community default */
  }

  const dbType = storage.getStorageType();
  const dbConnected = dbType !== 'csv'
    && await storage.getStorage().isConnected().catch(() => false);

  const databaseOk = dbConnected && dbType !== 'csv';
  const licenseOk = instanceConfig.skipLicenseChecks === true
    || !!local.activatedLicenseKey
    || !!(license.email || license.licensee)
    || local.licenseSkipped === true;

  return {
    needsSetup,
    setupComplete,
    needsBootstrapAdmin,
    instanceId: getInstanceId(),
    organizationName: organization.getOrganizationName(),
    steps: {
      admin: { complete: !needsBootstrapAdmin },
      database: { complete: databaseOk, provider: dbType, connected: dbConnected },
      storage: { complete: true, default: deploymentConfig.getFileStorageConfig().default },
      license: {
        complete: licenseOk,
        tier: license.tier,
        skipped: local.licenseSkipped === true
      }
    }
  };
};

const bootstrapAdmin = async ({ username, password, email }) => {
  assertSetupOpen();

  if (await hasPrivilegedUser()) {
    throw setupError('An administrator account already exists', 409);
  }

  const name = (username || '').trim();
  if (!name || name.length < 3) {
    throw setupError('Username must be at least 3 characters');
  }
  if (!password || password.length < 8) {
    throw setupError('Password must be at least 8 characters');
  }

  const existing = await storage.getUserByUsername(name);
  if (existing) throw setupError('Username already exists');

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await storage.createUser({
    id: uuidv4(),
    username: name,
    password: hashedPassword,
    email: (email || '').trim(),
    // The person running first-run setup owns this instance, so they get the
    // top role. Previously this was 'admin', which left godmode unreachable:
    // only a godmode may promote anyone, nobody may promote themselves, and no
    // godmode existed. The owner could not reset a colleague's password on
    // their own install.
    role: 'godmode'
  });

  const token = generateToken(newUser);

  return {
    token,
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    }
  };
};

const saveSetupSettings = async (settings) => {
  assertSetupOpen();
  return deploymentSettingsService.saveSettings(settings);
};

const testDatabase = (provider, config) =>
  connectionTestService.testDatabase(provider, config || {});

const testStorage = (provider) =>
  connectionTestService.testFileStorage(provider);

const completeSetup = async ({ licenseSkipped, licenseKey, completedBy, organizationName }) => {
  assertSetupOpen();

  if (!(await hasPrivilegedUser())) {
    throw setupError('Create an administrator account before finishing setup');
  }

  const savedOrg = organization.normalizeOrganizationName(
    organizationName || organization.getOrganizationName()
  );

  const key = (licenseKey || '').trim();
  const devBypass = process.env.MERTIS_DEV_DEFAULTS === 'true';

  if (!key && !devBypass) {
    throw setupError(
      'A licence key is required. Register free at turneratech.com to get a Community key by email, then paste it here.'
    );
  }

  if (key) {
    // Accepts a TT- key (exchanged with the licence server) or a pasted token
    // (offline path). See services/licenseActivation.js.
    await require('./licenseActivation').applyLicense(key, completedBy);
  }

  const partial = {
    setupComplete: true,
    setupCompletedAt: new Date().toISOString(),
    setupCompletedBy: completedBy || 'setup-wizard',
    organizationName: savedOrg
  };

  if (licenseSkipped && devBypass) partial.licenseSkipped = true;

  deploymentConfig.saveLocalConfig(partial);

  return { setupComplete: true, message: 'Setup complete' };
};

const getProviders = () => ({
  databaseProviders: deploymentConfig.DATABASE_PROVIDERS,
  fileStorageProviders: deploymentConfig.FILE_STORAGE_PROVIDERS,
  webhookEvents: deploymentConfig.WEBHOOK_EVENTS,
  documentation: '/docs/DEPLOYMENT.md'
});

module.exports = {
  isSetupComplete,
  getSetupStatus,
  bootstrapAdmin,
  saveSetupSettings,
  testDatabase,
  testStorage,
  completeSetup,
  getProviders,
  hasPrivilegedUser,
  getInstanceId,
  resolveInstanceId
};
