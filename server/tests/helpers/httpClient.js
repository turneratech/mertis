/**
 * Thin fetch wrapper for integration tests (automation-friendly).
 */
async function request(baseUrl, method, path, { token, body, headers = {} } = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const opts = {
    method,
    headers: { ...headers }
  };

  if (token) {
    opts.headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { status: res.status, data, headers: res.headers };
}

module.exports = { request };
