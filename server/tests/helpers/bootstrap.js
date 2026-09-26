/**
 * Initialize storage + license for integration tests (CSV mode by default).
 *
 * Each test process gets its own throwaway CSV data directory. Without this the
 * suite wrote into the developer's real server/data/*.csv and accumulated bugs
 * across runs until the project hit the Community 250-bug cap and every POST
 * /api/bugs started coming back 403. MERTIS_DEV_DEFAULTS seeds a fresh dir with
 * the admin user and the default projects, so no fixtures are needed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

let initialized = false;

function useIsolatedDataDir() {
  if (process.env.MERTIS_DATA_DIR) return process.env.MERTIS_DATA_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mertis-test-data-'));
  process.env.MERTIS_DATA_DIR = dir;
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort — a leftover temp dir is harmless */
    }
  };
  process.once('exit', cleanup);
  return dir;
}

async function bootstrapTestEnv() {
  if (initialized) return;

  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.MERTIS_DEV_DEFAULTS = process.env.MERTIS_DEV_DEFAULTS || 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'mertis-test-jwt-secret';
  process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'csv';
  useIsolatedDataDir();

  const storage = require('../../storage');
  const licenseService = require('../../services/licenseService');
  const fileStorageService = require('../../services/fileStorageService');

  await storage.initializeStorage();
  fileStorageService.initFileStorage();
  await licenseService.initialize();

  initialized = true;
}

async function listenOnRandomPort(app) {
  await bootstrapTestEnv();
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function getBaseUrl(server) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = {
  bootstrapTestEnv,
  useIsolatedDataDir,
  listenOnRandomPort,
  getBaseUrl,
  closeServer
};
