/**
 * Local UI → API proxy (Create React App only; not used in production builds).
 *
 * Default: local Express on port 5000.
 * Remote EC2 API: set REACT_APP_API_TARGET in client/.env.local (see client/.env.example).
 *
 * Restart `npm run client` / `npm run dev` after changing env. Do not start local
 * `npm run server` when targeting EC2 — you want the remote Node process (there is
 * no server.py; EC2 runs server/index.js, often PORT=5045).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const API_PORT = process.env.REACT_APP_API_PORT || '5000';
const API_TARGET = process.env.REACT_APP_API_TARGET || `http://localhost:${API_PORT}`;
const stripMertisPrefix = process.env.REACT_APP_API_STRIP_MERTIS_PREFIX !== 'false';
const pathRewrite = stripMertisPrefix ? { '^/mertis': '' } : undefined;

console.log(`[setupProxy] /api and /mertis/api → ${API_TARGET}${stripMertisPrefix ? ' (strip /mertis prefix on /mertis/*)' : ''}`);

module.exports = function(app) {
  const rootProxy = {
    target: API_TARGET,
    changeOrigin: true
  };
  const mertisProxy = {
    target: API_TARGET,
    changeOrigin: true,
    pathRewrite
  };

  app.use('/api', createProxyMiddleware(rootProxy));
  app.use('/uploads', createProxyMiddleware(rootProxy));
  app.use('/mertis/api', createProxyMiddleware(mertisProxy));
  app.use('/mertis/uploads', createProxyMiddleware(mertisProxy));
};
