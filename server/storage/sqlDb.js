/**
 * Returns the active SQL db module (mysql or postgres) based on initialized storage type.
 */
const getSqlDb = () => {
  try {
    const type = require('./index').getStorageType();
    if (type === 'postgres') return require('./postgres/db');
    if (type === 'mysql') return require('./mysql/db');
  } catch (_) {
    // storage not initialized yet
  }
  return require('./mysql/db');
};

module.exports = getSqlDb;
