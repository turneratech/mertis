/**
 * Pull an iCal feed. The link is caller-supplied, so private addresses are refused
 * before the request and again after DNS, and redirects are not followed.
 */

const dns = require('dns');
const https = require('https');
const { addressIsBlocked, calendarError, normalizeFeedUrl } = require('./calendar');

const MAX_BYTES = 1000000;
const TIMEOUT_MS = 8000;

const fetchIcs = async (rawUrl, deps = {}) => {
  const href = normalizeFeedUrl(rawUrl);
  const target = new URL(href);
  const lookup = deps.lookup || dns.promises.lookup;
  const found = await lookup(target.hostname, { all: true });
  const addresses = Array.isArray(found) ? found : (found ? [found] : []);
  if (!addresses.length || addresses.some((entry) => addressIsBlocked(entry.address))) {
    throw calendarError('That calendar link is not a public address');
  }
  if (deps.request) return deps.request({ url: target, address: addresses[0].address });

  const address = addresses[0].address;
  return new Promise((resolve, reject) => {
    const req = https.get({
      host: address,
      servername: target.hostname,
      path: `${target.pathname}${target.search}` || '/',
      headers: {
        Host: target.host,
        'User-Agent': 'MertisPulse/1',
        Accept: 'text/calendar, text/plain, */*'
      },
      timeout: TIMEOUT_MS,
      family: address.includes(':') ? 6 : 4,
      rejectUnauthorized: true
    }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400) {
        res.resume();
        reject(calendarError('Calendar link redirected. Paste the final https link.'));
        return;
      }
      if (status !== 200) {
        res.resume();
        reject(calendarError(`Calendar link returned ${status}`, status >= 500 ? 502 : 400));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy();
          reject(calendarError('Calendar feed is too large'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(calendarError('Calendar link timed out', 504));
    });
    req.on('error', () => reject(calendarError('Could not read that calendar link')));
  });
};

module.exports = { fetchIcs };
