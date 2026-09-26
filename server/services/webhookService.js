/**
 * Outbound webhooks and plugin hooks for external database / workflow integrations.
 * Customers can sync Mertis events to their own systems (Zapier, n8n, custom ETL, etc.).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const deploymentConfig = require('../config/deployment.config');

let plugins = [];
let pluginsLoaded = false;

const loadPlugins = () => {
  if (pluginsLoaded) return plugins;

  const { pluginDir } = deploymentConfig.getWebhookConfig();
  plugins = [];

  if (!fs.existsSync(pluginDir)) {
    pluginsLoaded = true;
    return plugins;
  }

  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js') && f !== 'index.js');
  for (const file of files) {
    try {
      const pluginPath = path.join(pluginDir, file);
      delete require.cache[require.resolve(pluginPath)];
      const plugin = require(pluginPath);
      if (typeof plugin.onEvent === 'function') {
        plugins.push({ name: plugin.name || file.replace('.js', ''), module: plugin });
        console.log(`[Plugins] Loaded: ${plugin.name || file}`);
      }
    } catch (err) {
      console.warn(`[Plugins] Failed to load ${file}:`, err.message);
    }
  }

  pluginsLoaded = true;
  return plugins;
};

const reloadPlugins = () => {
  pluginsLoaded = false;
  plugins = [];
  return loadPlugins();
};

const signPayload = (payload, secret) => {
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

const deliverWebhook = async (endpoint, event, data) => {
  const payload = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data
  });

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mertis-Webhook/1.0',
    'X-Mertis-Event': event
  };

  const secret = endpoint.secret || deploymentConfig.getWebhookConfig().secret;
  const signature = signPayload(payload, secret);
  if (signature) headers['X-Mertis-Signature'] = signature;

  const res = await fetch(endpoint.url, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return true;
};

/**
 * Dispatch an event to registered webhooks and local plugins.
 * Failures are logged but never block the main request.
 */
const dispatch = async (event, data) => {
  const { enabled, endpoints } = deploymentConfig.getWebhookConfig();
  if (!enabled) return;

  const activeEndpoints = endpoints.filter(ep =>
    ep.enabled !== false &&
    ep.url &&
    (!ep.events || ep.events.length === 0 || ep.events.includes(event) || ep.events.includes('*'))
  );

  loadPlugins();

  const tasks = [];

  for (const ep of activeEndpoints) {
    tasks.push(
      deliverWebhook(ep, event, data).catch(err => {
        console.warn(`[Webhook] ${ep.url} failed for ${event}:`, err.message);
      })
    );
  }

  for (const { name, module: plugin } of plugins) {
    tasks.push(
      Promise.resolve()
        .then(() => plugin.onEvent(event, data))
        .catch(err => {
          console.warn(`[Plugin] ${name} failed for ${event}:`, err.message);
        })
    );
  }

  await Promise.allSettled(tasks);
};

module.exports = {
  loadPlugins,
  reloadPlugins,
  dispatch,
  signPayload
};
