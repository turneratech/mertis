/**
 * Thin client for the Turnera Tech licence server (https://license.turneratech.com).
 *
 * Why this lives on the server and not in the browser: the licence server
 * enforces a CORS allowlist, and a self-hosted Mertis can be on any hostname —
 * you cannot enumerate every customer's domain. So activation is always
 * Mertis server -> licence server.
 *
 * When this server is contacted, and when it is not:
 *
 *   - ONCE at activation, to exchange a TT- key for a signed token.
 *   - Then once every LICENSE_AUTO_REFRESH_HOURS (default 24) for installs
 *     activated with a TT- key, to pick up a rolled-forward expiry. Sends the
 *     licence key and the install id, nothing else. Disable with
 *     LICENSE_AUTO_REFRESH=false.
 *   - NEVER for installs activated with an offline token, and never for
 *     Community installs that were never activated.
 *
 * Verification itself is always offline, against a public key pinned in this
 * build — which is what keeps air-gapped installs viable. This comment used to
 * claim the server was contacted only once; that stopped being true when the
 * refresh timer was added, and in a source-available product a false comment is
 * a worse trust failure than a false line of marketing copy.
 */

const licenseConfig = require('../config/license.config');

/** Node's fetch ignores HTTP(S)_PROXY unless we hand it an agent explicitly. */
const proxyDispatcher = () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxy) return undefined;
  try {
    const { ProxyAgent } = require('undici');
    return new ProxyAgent(proxy);
  } catch (_) {
    return undefined;
  }
};

class LicenseServerError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'LicenseServerError';
    this.code = code;
    this.status = status;
  }
}

const post = async (path, body) => {
  const url = `${licenseConfig.licenseServerUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), licenseConfig.licenseServerTimeoutMs);

  let res;
  try {
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    };
    const dispatcher = proxyDispatcher();
    if (dispatcher) opts.dispatcher = dispatcher;
    res = await fetch(url, opts);
  } catch (error) {
    const reason = error.name === 'AbortError' ? 'timed out' : error.message;
    throw new LicenseServerError(
      `Could not reach the licence server at ${licenseConfig.licenseServerUrl} (${reason}). `
      + 'If this install has no outbound internet access, use the offline option and paste a licence token instead.',
      'LICENSE_SERVER_UNREACHABLE',
      503
    );
  } finally {
    clearTimeout(timer);
  }

  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    data = {};
  }

  if (res.ok) return data;

  const detail = typeof data.detail === 'string' ? data.detail : '';
  if (res.status === 403 && /bound to another machine/i.test(detail)) {
    throw new LicenseServerError(
      'This licence key is already activated on another installation. Each key binds to one '
      + 'install. Release it from the original install (Admin -> Deployment -> License), or '
      + 'contact licensing@turneratech.com to unbind it.',
      'LICENSE_BOUND_ELSEWHERE',
      409
    );
  }
  if (res.status === 403) {
    throw new LicenseServerError(
      `This licence key is not valid (${detail || 'rejected by the licence server'}).`,
      'LICENSE_INVALID',
      400
    );
  }
  if (res.status === 429) {
    throw new LicenseServerError(
      'Too many requests to the licence server. Wait a minute and try again.',
      'LICENSE_RATE_LIMITED',
      429
    );
  }
  throw new LicenseServerError(
    `Licence server error (HTTP ${res.status})${detail ? `: ${detail}` : ''}.`,
    'LICENSE_SERVER_ERROR',
    502
  );
};

/** Exchange an opaque TT-... key for a signed ES256 token, binding this machine. */
const activate = (licenseKey, machineId) =>
  post('/v1/activate', { license_key: licenseKey, machine_id: machineId });

/** Re-check a key and pick up a rolled-forward expiry. */
const validate = (licenseKey, machineId) =>
  post('/v1/validate', { license_key: licenseKey, machine_id: machineId });

/** Unbind this machine so the key can be used on a new install. */
const release = (licenseKey, machineId) =>
  post('/v1/release', { license_key: licenseKey, machine_id: machineId });

/** A licence-server key looks like TT-XXXX-XXXX-XXXX-XXXX; a token is a JWT. */
const looksLikeServerKey = (value) => /^TT-[A-Z0-9-]+$/i.test((value || '').trim());

module.exports = { activate, validate, release, looksLikeServerKey, LicenseServerError };
