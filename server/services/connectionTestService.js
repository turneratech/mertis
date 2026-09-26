/**
 * Test connectivity for database and file-storage providers before saving deployment config.
 */

const deploymentConfig = require('../config/deployment.config');

const testMySQL = async (config = {}) => {
  const db = { ...deploymentConfig.getDatabaseConfig().mysql, ...config };
  try {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
      ssl: db.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000
    });
    await conn.query('SELECT 1');
    let tablesReady = false;
    try {
      await conn.query('SELECT 1 FROM users LIMIT 1');
      tablesReady = true;
    } catch {
      tablesReady = false;
    }
    await conn.end();
    return {
      success: true,
      message: tablesReady
        ? 'Connected to MySQL. Schema is ready.'
        : 'Connected to MySQL. Run server/database/mantis.sql to initialize schema.',
      tablesReady
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const testPostgres = async (connectionString) => {
  const url = connectionString || deploymentConfig.getDatabaseConfig().postgres.connectionString
    || deploymentConfig.getDatabaseConfig().supabase.databaseUrl;

  if (!url) {
    return { success: false, message: 'No PostgreSQL connection string (DATABASE_URL or SUPABASE_DB_URL) provided.' };
  }

  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: url,
      ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000
    });
    await client.connect();
    await client.query('SELECT 1');
    let tablesReady = false;
    try {
      await client.query('SELECT 1 FROM users LIMIT 1');
      tablesReady = true;
    } catch {
      tablesReady = false;
    }
    await client.end();
    return {
      success: true,
      message: tablesReady
        ? 'Connected to PostgreSQL. Schema is ready.'
        : 'Connected to PostgreSQL. Apply server/database/mantis.postgres.sql (Supabase SQL editor or psql).',
      tablesReady,
      note: 'PostgreSQL backend is active when DATABASE_PROVIDER=postgres or supabase.'
    };
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      return { success: false, message: 'Install pg package: npm install pg' };
    }
    return { success: false, message: err.message };
  }
};

const testSupabase = async () => {
  const { supabase: sb } = deploymentConfig.getDatabaseConfig();
  if (!sb.url || !sb.serviceRoleKey) {
    return { success: false, message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.' };
  }

  try {
    const res = await fetch(`${sb.url.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        apikey: sb.serviceRoleKey,
        Authorization: `Bearer ${sb.serviceRoleKey}`
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok && res.status !== 404) {
      return { success: false, message: `Supabase API returned ${res.status}` };
    }
  } catch (err) {
    return { success: false, message: `Supabase API unreachable: ${err.message}` };
  }

  if (sb.databaseUrl) {
    return testPostgres(sb.databaseUrl);
  }

  return {
    success: true,
    message: 'Supabase project API is reachable. Add SUPABASE_DB_URL for database schema verification.',
    tablesReady: null
  };
};

const testDatabase = async (provider, overrides = {}) => {
  const p = (provider || deploymentConfig.getDatabaseProvider()).toLowerCase();

  switch (p) {
    case 'mysql':
      return testMySQL(overrides.mysql);
    case 'postgres':
      return testPostgres(overrides.postgres?.connectionString);
    case 'supabase':
      return testSupabase();
    case 'csv':
      return { success: true, message: 'CSV mode uses local files in server/data/ — no remote database required.' };
    case 'auto':
      return testMySQL(overrides.mysql);
    default:
      return { success: false, message: `Unknown database provider: ${p}` };
  }
};

const testFileStorage = async (provider) => {
  const path = require('path');
  let createStorage;

  const possiblePaths = [
    path.join(__dirname, '../../hybrid-storage/src'),
    path.join(__dirname, '../hybrid-storage/src')
  ];

  for (const p of possiblePaths) {
    try {
      createStorage = require(p).createStorage;
      if (createStorage) break;
    } catch {
      // try next
    }
  }

  if (!createStorage) {
    return { success: false, message: 'hybrid-storage module not found. Run npm install in hybrid-storage/.' };
  }

  const config = deploymentConfig.getFileStorageConfig();
  const target = provider || config.default;

  try {
    const manager = createStorage(config);
    const providers = manager.listProviders();

    if (!providers.includes(target)) {
      return {
        success: false,
        message: `Provider "${target}" is not configured. Available: ${providers.join(', ') || 'none'}`
      };
    }

    const testKey = `_mertis_connection_test_${Date.now()}.txt`;
    const testBuffer = Buffer.from('mertis connection test');

    const uploaded = await manager.upload({
      file: testBuffer,
      fileName: testKey,
      mimeType: 'text/plain',
      metadata: { purpose: 'connection-test' },
      provider: target
    });
    await manager.delete(uploaded.storagePath, target);

    return {
      success: true,
      message: `File storage (${target}) read/write verified.`,
      providers
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const testWebhookUrl = async (url, secret) => {
  if (!url) return { success: false, message: 'Webhook URL is required.' };

  try {
    const crypto = require('crypto');
    const payload = JSON.stringify({
      event: 'connection.test',
      timestamp: new Date().toISOString(),
      data: { message: 'Mertis deployment webhook test' }
    });
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Mertis-Webhook/1.0' };
    if (secret) {
      headers['X-Mertis-Signature'] = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(15000)
    });

    if (res.ok) {
      return { success: true, message: `Webhook endpoint responded with ${res.status}.` };
    }
    return { success: false, message: `Webhook endpoint returned ${res.status}.` };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

module.exports = {
  testMySQL,
  testPostgres,
  testSupabase,
  testDatabase,
  testFileStorage,
  testWebhookUrl
};
