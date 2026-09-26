process.env.PULSE_ENABLED = 'false';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MERTIS_DEV_DEFAULTS = process.env.MERTIS_DEV_DEFAULTS || 'true';

const { createTestApp } = require('./testApp');
const { listenOnRandomPort, getBaseUrl } = require('./bootstrap');

(async () => {
  try {
    const server = await listenOnRandomPort(createTestApp());
    process.send({ baseUrl: getBaseUrl(server) });
  } catch (err) {
    process.send({ error: err.message });
    process.exit(1);
  }
})();
