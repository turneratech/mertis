const { Pool } = require('pg');
const deploymentConfig = require('../../config/deployment.config');

let pool = null;

const getConnectionString = () => {
  const db = deploymentConfig.getDatabaseConfig();
  return (
    db.postgres.connectionString ||
    db.supabase.databaseUrl ||
    process.env.DATABASE_URL ||
    ''
  );
};

const convertPlaceholders = (sql, params = []) => {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
};

const createPool = () => {
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('PostgreSQL connection string not configured (DATABASE_URL or SUPABASE_DB_URL)');
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    max: 10,
    connectionTimeoutMillis: 10000
  });

  return pool;
};

const getPool = () => {
  if (!pool) createPool();
  return pool;
};

const query = async (sql, params = []) => {
  const { text, values } = convertPlaceholders(sql, params);
  const result = await getPool().query(text, values);

  if (result.command === 'DELETE' || result.command === 'UPDATE' || result.command === 'INSERT') {
    return { affectedRows: result.rowCount, rowCount: result.rowCount, insertId: result.rows[0]?.id };
  }
  return result.rows;
};

const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

const transaction = async (callback) => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const conn = {
      execute: async (sql, params = []) => {
        const { text, values } = convertPlaceholders(sql, params);
        const result = await client.query(text, values);
        return [result.rows, result];
      }
    };
    const out = await callback(conn);
    await client.query('COMMIT');
    return out;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const testConnection = async () => {
  try {
    const client = await getPool().connect();
    client.release();
    return true;
  } catch {
    return false;
  }
};

const checkDatabase = async () => {
  try {
    await query('SELECT 1 FROM users LIMIT 1');
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  createPool,
  getPool,
  query,
  queryOne,
  transaction,
  testConnection,
  checkDatabase,
  convertPlaceholders
};
