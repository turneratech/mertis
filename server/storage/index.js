/**
 * Storage Factory — MySQL, PostgreSQL/Supabase, or CSV
 */

const deploymentConfig = require('../config/deployment.config');
const { shouldRefuseCsvFallback, mysqlFailureBanner } = require('./mysqlBootGuard');

let storage = null;
let storageType = null;
let initialized = false;

const failMysqlBoot = (reason) => {
  const mysql = deploymentConfig.getDatabaseConfig().mysql;
  const banner = mysqlFailureBanner({
    host: mysql.host,
    port: mysql.port,
    user: mysql.user,
    database: mysql.database,
    reason
  });
  console.error(banner);
  const err = new Error(`ERROR ACCESSING MYSQL: ${reason}`);
  err.code = 'MYSQL_BOOT';
  throw err;
};

const tryMySQL = async () => {
  const mysqlStorage = require('./mysql');
  const { testConnection, checkDatabase, getLastConnectError } = require('./mysql/db');
  if (!(await testConnection())) {
    return { ok: false, reason: getLastConnectError() || 'connection failed' };
  }
  if (!(await checkDatabase())) {
    const detail = getLastConnectError() || 'users table not found';
    return {
      ok: false,
      reason: `connected but schema check failed (${detail}) — wrong database name?`
    };
  }
  await mysqlStorage.initialize();
  return { ok: true, impl: mysqlStorage };
};

const tryPostgres = async () => {
  const postgresStorage = require('./postgres');
  const { testConnection, checkDatabase } = require('./postgres/db');
  if (!(await testConnection())) return null;
  if (!(await checkDatabase())) {
    console.log('⚠ PostgreSQL connected but schema not found — run server/database/mantis.postgres.sql');
    return null;
  }
  await postgresStorage.initialize();
  return postgresStorage;
};

const initializeStorage = async () => {
  if (initialized && storage) return storage;

  const provider = deploymentConfig.getDatabaseProvider();
  console.log(`🔍 Detecting storage backend (provider: ${provider})...`);

  if (provider === 'csv') {
    const csvStorage = require('./csv');
    await csvStorage.initialize();
    storage = csvStorage;
    storageType = 'csv';
    initialized = true;
    console.log('✓ Using CSV storage backend');
    return storage;
  }

  if (provider === 'postgres' || provider === 'supabase') {
    try {
      const pg = await tryPostgres();
      if (pg) {
        storage = pg;
        storageType = 'postgres';
        initialized = true;
        console.log('✓ Using PostgreSQL storage backend');
        return storage;
      }
      if (provider === 'postgres' || provider === 'supabase') {
        throw new Error('PostgreSQL/Supabase required but connection or schema check failed.');
      }
    } catch (err) {
      if (provider === 'postgres' || provider === 'supabase') throw err;
      console.log('⚠ PostgreSQL not available:', err.message);
    }
  }

  if (['mysql', 'auto', 'postgres', 'supabase'].includes(provider)) {
    try {
      const mysqlAttempt = await tryMySQL();
      if (mysqlAttempt.ok) {
        storage = mysqlAttempt.impl;
        storageType = 'mysql';
        initialized = true;
        console.log('✓ Using MySQL storage backend');
        return storage;
      }
      if (shouldRefuseCsvFallback(process.env, provider)) {
        failMysqlBoot(mysqlAttempt.reason);
      }
      console.log('⚠ MySQL not available:', mysqlAttempt.reason);
    } catch (err) {
      if (err.code === 'MYSQL_BOOT' || shouldRefuseCsvFallback(process.env, provider)) {
        throw err;
      }
      console.log('⚠ MySQL not available:', err.message);
    }
  }

  console.log('↪ Falling back to CSV storage backend');
  const csvStorage = require('./csv');
  await csvStorage.initialize();
  storage = csvStorage;
  storageType = 'csv';
  initialized = true;
  console.log('✓ Using CSV storage backend');
  return storage;
};

const getStorage = () => {
  if (!storage) throw new Error('Storage not initialized. Call initializeStorage() first.');
  return storage;
};

const getStorageType = () => storageType;
const isSqlStorage = () => storageType === 'mysql' || storageType === 'postgres';
const isInitialized = () => initialized;

const resetStorage = () => {
  storage = null;
  storageType = null;
  initialized = false;
};

module.exports = {
  initializeStorage,
  getStorage,
  getStorageType,
  isSqlStorage,
  isInitialized,
  resetStorage,

  getUserById: (...args) => getStorage().getUserById(...args),
  getUserByUsername: (...args) => getStorage().getUserByUsername(...args),
  getAllUsers: (...args) => getStorage().getAllUsers(...args),
  createUser: (...args) => getStorage().createUser(...args),
  deleteUser: (...args) => getStorage().deleteUser(...args),
  updateUserPassword: (...args) => getStorage().updateUserPassword(...args),

  getAllProjects: (...args) => getStorage().getAllProjects(...args),
  getProjectById: (...args) => getStorage().getProjectById(...args),
  getProjectByKey: (...args) => getStorage().getProjectByKey(...args),
  createProject: (...args) => getStorage().createProject(...args),
  updateProject: (...args) => getStorage().updateProject(...args),
  deleteProject: (...args) => getStorage().deleteProject(...args),
  addProjectMember: (...args) => getStorage().addProjectMember(...args),
  removeProjectMember: (...args) => getStorage().removeProjectMember(...args),

  getAllBugs: (...args) => getStorage().getAllBugs(...args),
  getBugsByProject: (...args) => getStorage().getBugsByProject(...args),
  getBugsByUser: (...args) => getStorage().getBugsByUser(...args),
  getBugById: (...args) => getStorage().getBugById(...args),
  generateBugId: (...args) => getStorage().generateBugId(...args),
  createBug: (...args) => getStorage().createBug(...args),
  updateBug: (...args) => getStorage().updateBug(...args),
  deleteBug: (...args) => getStorage().deleteBug(...args),
  addBugComment: (...args) => getStorage().addBugComment(...args),
  getBugStats: (...args) => getStorage().getBugStats(...args),
  addBugActivity: (...args) => getStorage().addBugActivity(...args),
  setTriagedAt: (...args) => getStorage().setTriagedAt(...args),
  listMissionsByProject: (...args) => getStorage().listMissionsByProject(...args),
  listMissionLinksByProject: (...args) => getStorage().listMissionLinksByProject(...args),
  getMissionById: (...args) => getStorage().getMissionById(...args),
  createMission: (...args) => getStorage().createMission(...args),
  claimMissionBug: (...args) => getStorage().claimMissionBug(...args),
  deleteMission: (...args) => getStorage().deleteMission(...args),
  listCalendarSources: (...args) => getStorage().listCalendarSources(...args),
  createCalendarSource: (...args) => getStorage().createCalendarSource(...args),
  deleteCalendarSource: (...args) => getStorage().deleteCalendarSource(...args),

  getAdminAnalytics: (...args) => getStorage().getAdminAnalytics(...args),
  getUserDashboard: (...args) => getStorage().getUserDashboard(...args)
};
