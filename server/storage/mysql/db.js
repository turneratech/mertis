const mysql = require('mysql2/promise');
const deploymentConfig = require('../../config/deployment.config');

let pool = null;
let lastConnectError = '';

const createPool = () => {
  if (pool) return pool;

  const db = deploymentConfig.getDatabaseConfig().mysql;

  pool = mysql.createPool({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: db.ssl ? { rejectUnauthorized: false } : undefined
  });

  return pool;
};

// Get pool instance
const getPool = () => {
  if (!pool) createPool();
  return pool;
};

// Execute query
const query = async (sql, params = []) => {
  // const [rows] = await getPool().execute(sql, params);
  const [rows] = await getPool().query(sql, params);
  return rows;
};

// Get single row
const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

// Transaction helper
const transaction = async (callback) => {
  const connection = await getPool().getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Test connection
const testConnection = async () => {
  try {
    const connection = await getPool().getConnection();
    connection.release();
    lastConnectError = '';
    return true;
  } catch (error) {
    lastConnectError = error.message || String(error);
    return false;
  }
};

// Check if database and tables exist
const checkDatabase = async () => {
  try {
    // Try to query the users table
    await query('SELECT 1 FROM users LIMIT 1');
    lastConnectError = '';
    return true;
  } catch (error) {
    lastConnectError = error.message || String(error);
    return false;
  }
};

const getLastConnectError = () => lastConnectError;

module.exports = {
  createPool,
  getPool,
  query,
  queryOne,
  transaction,
  testConnection,
  checkDatabase,
  getLastConnectError
};
