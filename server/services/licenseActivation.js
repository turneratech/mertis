/**
 * One place that turns "whatever the admin pasted" into an activated licence.
 *
 * Accepts either form:
 *   - TT-XXXX-XXXX-XXXX-XXXX  the key emailed on registration. Exchanged with
 *     the licence server for a signed token, binding this install.
 *   - a raw ES256 token       the offline / air-gapped path. Never touches the
 *     network, which is why it must keep working.
 *
 * Shared by the first-run wizard and the admin licence screen so the two cannot
 * drift apart.
 */

const deploymentConfig = require('../config/deployment.config');
const storage = require('../storage');
const licenseServerClient = require('./licenseServerClient');

const activationError = (message, status = 400, code = 'LICENSE_INVALID') => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

/**
 * @param {string} input     TT- key or a signed token
 * @param {string} actor     who performed the activation (for the audit row)
 * @returns {{tier: string, offline: boolean, expiresAt: ?string}}
 */
const applyLicense = async (input, actor) => {
  const licenseService = require('./licenseService');
  const setupService = require('./setupService');

  const raw = (input || '').trim();
  if (!raw) throw activationError('A licence key is required.');

  let token = raw;
  let serverKey = null;
  let instanceId = null;

  if (licenseServerClient.looksLikeServerKey(raw)) {
    instanceId = await setupService.resolveInstanceId();
    const result = await licenseServerClient.activate(raw, instanceId);
    if (!result || !result.token) {
      throw activationError('The licence server did not return a licence token.', 502, 'LICENSE_SERVER_ERROR');
    }
    token = result.token;
    serverKey = raw;
  }

  const validation = await licenseService.validateLicense(token);
  if (!validation.valid) {
    throw activationError(`Invalid licence key: ${validation.error}`);
  }

  if (storage.isSqlStorage()) {
    await licenseService.activateLicense(token, actor, serverKey, instanceId);
  } else {
    deploymentConfig.saveLocalConfig({
      activatedLicenseKey: token,
      ...(serverKey ? { licenseServerKey: serverKey } : {}),
      ...(instanceId ? { instanceId } : {})
    });
    licenseService.invalidateCache();
  }

  const status = await licenseService.getLicenseStatus();
  return { tier: status.tier, offline: !serverKey, expiresAt: status.expiresAt || null };
};

/**
 * Unbind this install at the licence server so the key can be reused elsewhere.
 * Requires the original TT- key; a token alone is not enough.
 */
const releaseLicense = async () => {
  const licenseService = require('./licenseService');
  const setupService = require('./setupService');

  const serverKey = await licenseService.getStoredServerKey();
  if (!serverKey) {
    throw activationError(
      'This install has no licence-server key on record (it was activated offline with a pasted token), '
      + 'so it cannot be released automatically. Contact licensing@turneratech.com to unbind it.',
      400,
      'NO_SERVER_KEY'
    );
  }
  const instanceId = await setupService.resolveInstanceId();
  await licenseServerClient.release(serverKey, instanceId);
  return { released: true };
};

/**
 * Re-check the licence with the server and store any fresher token.
 *
 * This is what makes rolling renewal work: the server pushes a self-serve
 * licence's expiry forward when it is validated near expiry, so without this a
 * free install would still hit the 365-day cliff. Entirely best-effort — if the
 * server is unreachable we keep the token we have and try again later.
 */
const refreshLicense = async () => {
  const licenseService = require('./licenseService');
  const setupService = require('./setupService');

  const serverKey = await licenseService.getStoredServerKey();
  if (!serverKey) return { refreshed: false, reason: 'no-server-key' };

  let result;
  try {
    const instanceId = await setupService.resolveInstanceId();
    result = await licenseServerClient.validate(serverKey, instanceId);
  } catch (error) {
    return { refreshed: false, reason: error.code || 'unreachable' };
  }
  if (!result || !result.token) return { refreshed: false, reason: 'no-token' };

  const validation = await licenseService.validateLicense(result.token);
  if (!validation.valid) return { refreshed: false, reason: 'invalid-token' };

  if (storage.isSqlStorage()) {
    await licenseService.activateLicense(
      result.token, 'auto-refresh', serverKey, await setupService.resolveInstanceId()
    );
  } else {
    deploymentConfig.saveLocalConfig({ activatedLicenseKey: result.token });
    licenseService.invalidateCache();
  }
  return { refreshed: true, expiresAt: validation.payload.exp ? new Date(validation.payload.exp * 1000).toISOString() : null };
};

/**
 * Kick off the periodic refresh. Safe to call when no licence is activated.
 *
 * Opt-OUT rather than opt-in, deliberately: this is what rolls a self-serve
 * licence forward before it expires, so defaulting it off would hand everyone a
 * silent expiry twelve months after launch. Offline and Community installs
 * exclude themselves — refreshLicense() returns early when there is no stored
 * TT- key, so they never make a network call at all.
 */
const startRefreshTimer = () => {
  const licenseConfig = require('../config/license.config');
  if (!licenseConfig.autoRefresh) {
    console.log('[License] Automatic renewal check disabled (LICENSE_AUTO_REFRESH=false).');
    return null;
  }
  const hours = licenseConfig.onlineCheckIntervalHours;
  if (!hours || hours <= 0) return null;
  const everyMs = hours * 60 * 60 * 1000;
  const tick = () => {
    refreshLicense().catch(() => { /* never let a licence check crash the app */ });
  };
  const timer = setInterval(tick, everyMs);
  if (timer.unref) timer.unref();
  return timer;
};

module.exports = { applyLicense, releaseLicense, refreshLicense, startRefreshTimer };
