/**
 * Central deployment configuration for self-hosted Mertis installs.
 * Env vars are the source of truth; server/data/deployment.local.json can override non-secret settings.
 */

const fs = require('fs');
const path = require('path');

const LOCAL_CONFIG_PATH = path.join(__dirname, '../data/deployment.local.json');

const DATABASE_PROVIDERS = ['auto', 'mysql', 'postgres', 'supabase', 'csv'];
const FILE_STORAGE_PROVIDERS = ['local', 's3', 'azure', 'sharepoint', 'supabase'];

const WEBHOOK_EVENTS = [
  'bug.created', 'bug.updated', 'bug.deleted', 'bug.commented',
  'project.created', 'project.updated', 'project.deleted',
  'user.created', 'user.deleted'
];

let localOverrides = null;

const loadLocalOverrides = () => {
  if (localOverrides !== null) return localOverrides;
  try {
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      localOverrides = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
    } else {
      localOverrides = {};
    }
  } catch {
    localOverrides = {};
  }
  return localOverrides;
};

const merge = (envVal, localVal, fallback = '') => {
  if (localVal !== undefined && localVal !== null && localVal !== '') return localVal;
  if (envVal !== undefined && envVal !== null && envVal !== '') return envVal;
  return fallback;
};

const getDatabaseProvider = () => {
  const local = loadLocalOverrides();
  return merge(process.env.DATABASE_PROVIDER, local.database?.provider, 'auto').toLowerCase();
};

const getDatabaseConfig = () => {
  const local = loadLocalOverrides();
  const db = local.database || {};

  return {
    provider: getDatabaseProvider(),
    mysql: {
      host: merge(process.env.DB_HOST, db.mysql?.host, 'localhost'),
      port: parseInt(merge(process.env.DB_PORT, db.mysql?.port, '3306'), 10),
      user: merge(process.env.DB_USER, db.mysql?.user, 'root'),
      password: merge(process.env.DB_PASSWORD, db.mysql?.password, ''),
      database: merge(process.env.DB_NAME, db.mysql?.database, 'mertis'),
      ssl: process.env.DB_SSL === 'true' || db.mysql?.ssl === true
    },
    postgres: {
      connectionString: merge(
        process.env.DATABASE_URL,
        db.postgres?.connectionString || db.supabase?.databaseUrl,
        ''
      )
    },
    supabase: {
      url: merge(process.env.SUPABASE_URL, db.supabase?.url, ''),
      serviceRoleKey: merge(process.env.SUPABASE_SERVICE_ROLE_KEY, db.supabase?.serviceRoleKey, ''),
      databaseUrl: merge(process.env.SUPABASE_DB_URL, db.supabase?.databaseUrl, '')
    }
  };
};

/**
 * AI provider settings.
 *
 * The key belongs to whoever runs the instance -- we never ship one, and we
 * never proxy their traffic. Readable from the admin UI as well as env so an
 * operator is not forced onto the server's filesystem to turn AI on.
 */
const getAiConfig = () => {
  const local = loadLocalOverrides();
  const ai = local.ai || {};
  return {
    apiKey: merge(process.env.OPENAI_API_KEY, ai.apiKey, ''),
    baseUrl: merge(process.env.OPENAI_BASE_URL, ai.baseUrl, ''),
    model: merge(process.env.OPENAI_MODEL, ai.model, 'gpt-4o-mini')
  };
};

const getFileStorageConfig = () => {
  const local = loadLocalOverrides();
  const st = local.storage || {};
  const uploadsPath = path.join(__dirname, '../../uploads');

  const config = {
    local: {
      basePath: merge(process.env.LOCAL_STORAGE_PATH, st.local?.basePath, uploadsPath),
      baseUrl: merge(process.env.LOCAL_STORAGE_URL, st.local?.baseUrl, '/uploads')
    }
  };

  const s3Bucket = merge(process.env.S3_BUCKET, st.s3?.bucket, '');
  if (s3Bucket || process.env.AWS_ACCESS_KEY_ID || st.s3?.accessKeyId) {
    config.s3 = {
      bucket: s3Bucket,
      region: merge(process.env.AWS_REGION, st.s3?.region, 'us-east-1'),
      accessKeyId: merge(process.env.AWS_ACCESS_KEY_ID, st.s3?.accessKeyId, ''),
      secretAccessKey: merge(process.env.AWS_SECRET_ACCESS_KEY, st.s3?.secretAccessKey, ''),
      endpoint: merge(process.env.S3_ENDPOINT, st.s3?.endpoint, ''),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || st.s3?.forcePathStyle === true,
      baseFolder: merge(process.env.S3_BASE_FOLDER, st.s3?.baseFolder, 'attachments')
    };
  }

  const supabaseUrl = merge(process.env.SUPABASE_URL, st.supabase?.url, '');
  const supabaseKey = merge(process.env.SUPABASE_SERVICE_ROLE_KEY, st.supabase?.serviceRoleKey, '');
  if (supabaseUrl && supabaseKey && !config.s3) {
    const projectRef = supabaseUrl.replace(/https?:\/\//, '').split('.')[0];
    config.s3 = {
      bucket: merge(process.env.SUPABASE_STORAGE_BUCKET, st.supabase?.bucket, 'attachments'),
      region: merge(process.env.SUPABASE_STORAGE_REGION, st.supabase?.region, 'us-east-1'),
      accessKeyId: merge(process.env.SUPABASE_S3_ACCESS_KEY_ID, st.supabase?.s3AccessKeyId, supabaseKey),
      secretAccessKey: merge(process.env.SUPABASE_S3_SECRET_ACCESS_KEY, st.supabase?.s3SecretAccessKey, supabaseKey),
      endpoint: merge(
        process.env.SUPABASE_S3_ENDPOINT,
        st.supabase?.s3Endpoint,
        `https://${projectRef}.supabase.co/storage/v1/s3`
      ),
      forcePathStyle: true,
      baseFolder: merge(process.env.SUPABASE_STORAGE_FOLDER, st.supabase?.baseFolder, 'mertis')
    };
  }

  // Mertis ships white-label with no credentials of its own, so every secret has
  // to be settable from the admin UI, not just from a file on the server. This
  // block used to be gated on the env var alone, which meant a connection string
  // saved through the UI was silently ignored.
  const azureConnectionString = merge(
    process.env.AZURE_STORAGE_CONNECTION_STRING,
    st.azure?.connectionString,
    ''
  );
  if (azureConnectionString) {
    config.azure = {
      connectionString: azureConnectionString,
      containerName: merge(process.env.AZURE_STORAGE_CONTAINER, st.azure?.containerName, 'mertis'),
      baseFolder: merge(process.env.AZURE_STORAGE_FOLDER, st.azure?.baseFolder, 'attachments')
    };
  } else if (process.env.AZURE_BLOB_ENDPOINT && process.env.AZURE_SAS_TOKEN) {
    config.azure = {
      blobEndpoint: process.env.AZURE_BLOB_ENDPOINT,
      sasToken: process.env.AZURE_SAS_TOKEN,
      containerName: merge(process.env.AZURE_STORAGE_CONTAINER, st.azure?.containerName, 'mertis'),
      baseFolder: merge(process.env.AZURE_STORAGE_FOLDER, st.azure?.baseFolder, 'attachments')
    };
  } else if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
    config.azure = {
      accountName: process.env.AZURE_STORAGE_ACCOUNT,
      accountKey: process.env.AZURE_STORAGE_KEY,
      containerName: merge(process.env.AZURE_STORAGE_CONTAINER, st.azure?.containerName, 'mertis'),
      baseFolder: merge(process.env.AZURE_STORAGE_FOLDER, st.azure?.baseFolder, 'attachments')
    };
  } else if (st.azure?.accountName) {
    config.azure = {
      accountName: st.azure.accountName,
      accountKey: st.azure.accountKey || process.env.AZURE_STORAGE_KEY || '',
      containerName: st.azure.containerName || 'mertis',
      baseFolder: st.azure.baseFolder || 'attachments'
    };
  }

  if (process.env.SHAREPOINT_SITE || st.sharepoint?.siteName) {
    config.sharepoint = {
      clientId: merge(process.env.AZURE_CLIENT_ID, st.sharepoint?.clientId, ''),
      clientSecret: merge(process.env.AZURE_CLIENT_SECRET, st.sharepoint?.clientSecret, ''),
      tenantId: merge(process.env.AZURE_TENANT_ID, st.sharepoint?.tenantId, ''),
      siteName: merge(process.env.SHAREPOINT_SITE, st.sharepoint?.siteName, ''),
      domain: merge(process.env.SHAREPOINT_DOMAIN, st.sharepoint?.domain, ''),
      driveId: merge(process.env.SHAREPOINT_DRIVE_ID, st.sharepoint?.driveId, ''),
      baseFolder: merge(process.env.SHAREPOINT_BASE_FOLDER, st.sharepoint?.baseFolder, 'Mertis/attachments')
    };
  }

  const defaultProvider = merge(process.env.DEFAULT_STORAGE, st.default, '');
  if (defaultProvider) {
    config.default = defaultProvider;
  } else if (config.azure) {
    config.default = 'azure';
  } else if (config.s3) {
    config.default = 's3';
  } else if (config.sharepoint) {
    config.default = 'sharepoint';
  } else {
    config.default = 'local';
  }

  return config;
};

const getWebhookConfig = () => {
  const local = loadLocalOverrides();
  const endpoints = local.webhooks || [];

  let envEndpoints = [];
  try {
    if (process.env.WEBHOOK_ENDPOINTS) {
      envEndpoints = JSON.parse(process.env.WEBHOOK_ENDPOINTS);
    }
  } catch {
    envEndpoints = [];
  }

  return {
    enabled: process.env.WEBHOOKS_ENABLED !== 'false',
    secret: process.env.WEBHOOK_SECRET || '',
    endpoints: [...endpoints, ...envEndpoints].filter((e, i, arr) =>
      arr.findIndex(x => x.id === e.id || x.url === e.url) === i
    ),
    pluginDir: merge(process.env.PLUGIN_DIR, local.pluginDir, path.join(__dirname, '../plugins'))
  };
};

const getDeploymentSummary = () => {
  const db = getDatabaseConfig();
  const storage = getFileStorageConfig();
  const webhooks = getWebhookConfig();

  const configuredProviders = ['local'];
  if (storage.s3) configuredProviders.push(storage.default === 's3' && db.supabase?.url ? 'supabase' : 's3');
  if (storage.azure) configuredProviders.push('azure');
  if (storage.sharepoint) configuredProviders.push('sharepoint');

  return {
    database: {
      provider: db.provider,
      mysql: { ...db.mysql, password: db.mysql.password ? '••••••••' : '' },
      postgres: { configured: !!db.postgres.connectionString },
      supabase: {
        configured: !!(db.supabase.url && db.supabase.serviceRoleKey),
        url: db.supabase.url || null
      }
    },
    storage: {
      default: storage.default,
      providers: [...new Set(configuredProviders)],
      hasS3: !!storage.s3,
      hasAzure: !!storage.azure,
      hasSharePoint: !!storage.sharepoint
    },
    webhooks: {
      enabled: webhooks.enabled,
      count: webhooks.endpoints.filter(e => e.enabled !== false).length,
      events: WEBHOOK_EVENTS
    },
    localConfigPath: LOCAL_CONFIG_PATH,
    hasLocalOverrides: fs.existsSync(LOCAL_CONFIG_PATH)
  };
};

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Recursive merge, so an omitted key keeps its stored value.
 *
 * This has to be deep. The admin UI reads secrets back masked and the save path
 * strips the mask before writing, which means the incoming provider object has
 * no secret in it at all. A shallow merge replaced `storage.s3` wholesale and
 * therefore wiped the stored key every time someone edited, say, the bucket name.
 * Arrays are replaced, not merged -- webhooks are a list, not a patch.
 */
const deepMerge = (current, partial) => {
  const out = { ...current };
  for (const [key, value] of Object.entries(partial || {})) {
    out[key] = isPlainObject(value) && isPlainObject(current?.[key])
      ? deepMerge(current[key], value)
      : value;
  }
  return out;
};

const saveLocalConfig = (partial) => {
  const current = loadLocalOverrides();
  const merged = {
    ...deepMerge(current, partial),
    webhooks: partial.webhooks !== undefined ? partial.webhooks : current.webhooks
  };

  const dir = path.dirname(LOCAL_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  localOverrides = merged;
  return merged;
};

const reloadLocalConfig = () => {
  localOverrides = null;
  return loadLocalOverrides();
};

module.exports = {
  DATABASE_PROVIDERS,
  FILE_STORAGE_PROVIDERS,
  WEBHOOK_EVENTS,
  LOCAL_CONFIG_PATH,
  getDatabaseProvider,
  getDatabaseConfig,
  getFileStorageConfig,
  getAiConfig,
  _deepMerge: deepMerge,
  getWebhookConfig,
  getDeploymentSummary,
  saveLocalConfig,
  reloadLocalConfig
};
