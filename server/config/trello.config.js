/**
 * Trello integration configuration.
 * Env vars are the source of truth; server/data/trello.local.json can override non-secret settings.
 */

const fs = require('fs');
const path = require('path');

const LOCAL_CONFIG_PATH = path.join(__dirname, '../data/trello.local.json');

let localOverrides = null;

const loadLocalOverrides = () => {
  if (localOverrides !== null) return localOverrides;
  try {
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      localOverrides = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
    } else {
      localOverrides = {};
    }
  } catch {
    localOverrides = {};
  }
  return localOverrides;
};

const merge = (envVal, localVal, fallback = '') => {
  if (localVal !== undefined && localVal !== null && localVal !== '') return localVal;
  if (envVal !== undefined && envVal !== null && envVal !== '') return envVal;
  return fallback;
};

const getTrelloConfig = () => {
  const local = loadLocalOverrides();
  return {
    enabled: merge(process.env.TRELLO_ENABLED, local.enabled, 'true') !== 'false',
    apiKey: merge(process.env.TRELLO_API_KEY, local.apiKey, ''),
    token: merge(process.env.TRELLO_TOKEN, local.token, ''),
    defaultBoardId: merge(process.env.TRELLO_DEFAULT_BOARD_ID, local.defaultBoardId, ''),
    projectMappings: local.projectMappings || {}
  };
};

const getTrelloSummary = () => {
  const config = getTrelloConfig();
  return {
    enabled: config.enabled,
    configured: !!(config.apiKey && config.token),
    defaultBoardId: config.defaultBoardId || null,
    projectMappingCount: Object.keys(config.projectMappings).length,
    localConfigPath: LOCAL_CONFIG_PATH,
    hasLocalOverrides: fs.existsSync(LOCAL_CONFIG_PATH)
  };
};

const getTrelloConfigForClient = () => {
  const config = getTrelloConfig();
  const mask = (val) => (val ? '••••••••' : '');
  return {
    enabled: config.enabled,
    configured: !!(config.apiKey && config.token),
    apiKey: mask(config.apiKey),
    token: mask(config.token),
    defaultBoardId: config.defaultBoardId,
    projectMappings: config.projectMappings
  };
};

const saveTrelloConfig = (partial) => {
  const current = loadLocalOverrides();
  const merged = { ...current, ...partial };

  if (partial.apiKey === '••••••••') delete merged.apiKey;
  if (partial.token === '••••••••') delete merged.token;

  if (partial.projectMappings) {
    merged.projectMappings = { ...current.projectMappings, ...partial.projectMappings };
  }

  const dir = path.dirname(LOCAL_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  localOverrides = merged;
  return merged;
};

const reloadLocalConfig = () => {
  localOverrides = null;
  return loadLocalOverrides();
};

module.exports = {
  LOCAL_CONFIG_PATH,
  getTrelloConfig,
  getTrelloSummary,
  getTrelloConfigForClient,
  saveTrelloConfig,
  reloadLocalConfig
};
