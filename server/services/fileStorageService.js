/**
 * Shared file storage factory — used by attachments route and deployment tests.
 */

const path = require('path');
const deploymentConfig = require('../config/deployment.config');

let storageInstance = null;
let storageError = null;

const findCreateStorage = () => {
  const possiblePaths = [
    path.join(__dirname, '../../hybrid-storage/src'),
    path.join(__dirname, '../hybrid-storage/src'),
    path.join(__dirname, '../../hybrid-storage')
  ];

  for (const p of possiblePaths) {
    try {
      const mod = require(p);
      if (mod.createStorage) return mod.createStorage;
    } catch {
      // try next
    }
  }
  return null;
};

const initFileStorage = (force = false) => {
  if (storageInstance && !force) return storageInstance;
  if (storageError && !force) return null;

  try {
    const createStorage = findCreateStorage();
    if (!createStorage) {
      throw new Error('hybrid-storage module not found. Run: cd hybrid-storage && npm install');
    }

    const config = deploymentConfig.getFileStorageConfig();
    storageInstance = createStorage(config);
    storageError = null;
    console.log('[FileStorage] Initialized. Providers:', storageInstance.listProviders());
    console.log('[FileStorage] Default:', storageInstance.defaultProvider);
    return storageInstance;
  } catch (err) {
    storageError = err;
    console.error('[FileStorage] Init failed:', err.message);
    return null;
  }
};

const resetFileStorage = () => {
  storageInstance = null;
  storageError = null;
};

const getFileStorage = () => initFileStorage();

module.exports = {
  initFileStorage,
  resetFileStorage,
  getFileStorage,
  getFileStorageError: () => storageError
};
