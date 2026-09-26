/**
 * Persist deployment settings (webhooks, non-secret overrides) to MySQL or local JSON.
 */

const deploymentConfig = require('../config/deployment.config');
const organization = require('../config/organization');

const MASK = '••••••••';
const maskSecret = (val) => (val ? MASK : '');

/** Last four characters, so an operator can tell which key is installed. */
const secretHint = (val) => (val && val.length > 4 ? `…${val.slice(-4)}` : '');

const getSettingsForClient = () => {
  const summary = deploymentConfig.getDeploymentSummary();
  const local = deploymentConfig.reloadLocalConfig();

  return {
    ...summary,
    settings: {
      organizationName: organization.getOrganizationName(),
      database: {
        provider: local.database?.provider || summary.database.provider,
        mysql: {
          host: local.database?.mysql?.host || summary.database.mysql.host,
          port: local.database?.mysql?.port || summary.database.mysql.port,
          user: local.database?.mysql?.user || summary.database.mysql.user,
          database: local.database?.mysql?.database || summary.database.mysql.database,
          ssl: local.database?.mysql?.ssl || false,
          password: maskSecret(local.database?.mysql?.password)
        },
        postgres: {
          connectionString: local.database?.postgres?.connectionString ? MASK : ''
        },
        supabase: {
          url: local.database?.supabase?.url || summary.database.supabase.url || '',
          serviceRoleKey: maskSecret(local.database?.supabase?.serviceRoleKey),
          databaseUrl: local.database?.supabase?.databaseUrl ? MASK : ''
        }
      },
      storage: {
        default: local.storage?.default || summary.storage.default,
        s3: local.storage?.s3 ? { ...local.storage.s3, secretAccessKey: maskSecret(local.storage.s3.secretAccessKey) } : null,
        azure: local.storage?.azure ? {
          ...local.storage.azure,
          accountKey: maskSecret(local.storage.azure.accountKey),
          connectionString: maskSecret(local.storage.azure.connectionString)
        } : null,
        sharepoint: local.storage?.sharepoint ? { ...local.storage.sharepoint, clientSecret: maskSecret(local.storage.sharepoint.clientSecret) } : null,
        supabase: local.storage?.supabase ? { ...local.storage.supabase, serviceRoleKey: maskSecret(local.storage.supabase.serviceRoleKey) } : null
      },
      ai: {
        // Never return the key itself. `configured` is what the UI needs, and
        // the hint is enough for a human to recognise which key is in place.
        configured: !!deploymentConfig.getAiConfig().apiKey,
        apiKey: maskSecret(local.ai?.apiKey),
        hint: secretHint(deploymentConfig.getAiConfig().apiKey),
        baseUrl: local.ai?.baseUrl || process.env.OPENAI_BASE_URL || '',
        model: deploymentConfig.getAiConfig().model,
        fromEnv: !local.ai?.apiKey && !!process.env.OPENAI_API_KEY
      },
      webhooks: (local.webhooks || []).map(w => ({
        ...w,
        secret: maskSecret(w.secret)
      }))
    }
  };
};

const saveSettings = async (body) => {
  const partial = {};

  if (body.organizationName !== undefined) {
    partial.organizationName = organization.normalizeOrganizationName(body.organizationName);
  }

  if (body.database) {
    partial.database = { ...body.database };
    if (partial.database.mysql?.password === MASK) {
      delete partial.database.mysql.password;
    }
    if (partial.database.supabase?.serviceRoleKey === MASK) {
      delete partial.database.supabase.serviceRoleKey;
    }
    if (partial.database.postgres?.connectionString === MASK) {
      delete partial.database.postgres.connectionString;
    }
  }

  if (body.storage) {
    partial.storage = { ...body.storage };
    if (partial.storage.s3?.secretAccessKey === MASK) delete partial.storage.s3.secretAccessKey;
    if (partial.storage.azure?.accountKey === MASK) delete partial.storage.azure.accountKey;
    if (partial.storage.sharepoint?.clientSecret === MASK) delete partial.storage.sharepoint.clientSecret;
    if (partial.storage.supabase?.serviceRoleKey === MASK) delete partial.storage.supabase.serviceRoleKey;
    if (partial.storage.azure?.connectionString === MASK) delete partial.storage.azure.connectionString;
  }

  if (body.ai) {
    partial.ai = { ...body.ai };
    // A masked value means "unchanged", never "overwrite with dots".
    if (partial.ai.apiKey === MASK) delete partial.ai.apiKey;
    // An explicit empty string is a deliberate clear.
    delete partial.ai.configured;
    delete partial.ai.hint;
    delete partial.ai.fromEnv;
  }

  if (body.webhooks) {
    partial.webhooks = body.webhooks.map(w => {
      const copy = { ...w };
      if (copy.secret === MASK) delete copy.secret;
      if (!copy.id) copy.id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return copy;
    });
  }

  const saved = deploymentConfig.saveLocalConfig(partial);

  try {
    const storage = require('../storage');
    if (storage.getStorageType() === 'mysql') {
      const { query } = require('../storage/mysql/db');
      await query(
        `INSERT INTO deployment_settings (setting_key, setting_value, updated_at)
         VALUES ('deployment', ?, NOW())
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [JSON.stringify(saved)]
      ).catch(() => {});
    }
  } catch {
    // table may not exist yet
  }

  return getSettingsForClient();
};

module.exports = {
  getSettingsForClient,
  saveSettings
};
