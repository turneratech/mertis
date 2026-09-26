// M16 AI Friday prose + M24 hardening.
//
// The prose is optional narration over arithmetic the user can already read.
// It must never be able to take the brief down, so this file is mostly about
// what happens when the upstream misbehaves:
//
//   timeout  — an 8s AbortController. Before this there was no timeout at all,
//              so a hung OpenAI call hung the whole GET /api/pulse/brief.
//   cache    — identical clauses inside the TTL do not call upstream again.
//   retry    — once, and only for a transport error. Never for a refusal or a
//              non-2xx: retrying those just pays twice for the same answer.
//
// Every failure returns the deterministic clauses untouched with a
// `hiddenReason`, so the UI drops the paragraph and keeps the numbers.
//
// BYO key only (owner decision, 19 Sep): the customer's own key, or any
// OpenAI-compatible endpoint via OPENAI_BASE_URL — a local model included.
// Nothing is ever sent to a Turnera Tech-hosted service.

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE = 200;

const cache = new Map();

const cacheKeyFor = (clauses, scope) =>
  `${scope || 'all'}|${(clauses || []).map((c) => `${c.id}:${c.text}`).join('|')}`;

const readCache = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
};

const writeCache = (key, value) => {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const clearCache = () => cache.clear();

/**
 * Transport failures are worth one retry; anything the upstream deliberately
 * answered is not.
 */
const isTransient = (error) => {
  if (!error) return false;
  if (error.name === 'AbortError') return false; // we gave up on purpose
  const status = error.status || error.statusCode;
  if (status) return status >= 500;
  return /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network/i.test(
    String(error.message || '')
  );
};

const composeAiFridayProse = async ({
  clauses,
  hasAiInsights,
  apiKey,
  generate,
  scope,
  timeoutMs = TIMEOUT_MS,
  useCache = true
} = {}) => {
  const kept = Array.isArray(clauses) ? clauses : [];
  if (!hasAiInsights) {
    return { prose: null, hiddenReason: 'tier', clauses: kept };
  }
  if (!apiKey) {
    return { prose: null, hiddenReason: 'no key', clauses: kept };
  }

  const key = cacheKeyFor(kept, scope);
  if (useCache) {
    const cached = readCache(key);
    if (cached !== null) {
      return { prose: cached, hiddenReason: null, clauses: kept, cached: true };
    }
  }

  const run = generate || defaultGenerate;

  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await run(kept, apiKey, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  let prose;
  try {
    prose = await attempt();
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return { prose: null, hiddenReason: 'timeout', clauses: kept };
    }
    if (!isTransient(error)) {
      return { prose: null, hiddenReason: 'error', clauses: kept };
    }
    try {
      prose = await attempt();
    } catch (retryError) {
      return {
        prose: null,
        hiddenReason: retryError && retryError.name === 'AbortError' ? 'timeout' : 'error',
        clauses: kept
      };
    }
  }

  const text = prose == null ? '' : String(prose).trim();
  if (!text) return { prose: null, hiddenReason: 'empty', clauses: kept };

  if (useCache) writeCache(key, text);
  return { prose: text, hiddenReason: null, clauses: kept };
};

const defaultGenerate = async (clauses, apiKey, opts = {}) => {
  const OpenAI = require('openai');
  const openai = new OpenAI({
    apiKey,
    // Any OpenAI-compatible endpoint, including a local model. Unset means
    // the customer's own OpenAI account.
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {})
  });
  const payload = (clauses || []).map((clause) => ({ id: clause.id, text: clause.text }));
  const completion = await openai.chat.completions.create(
    {
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Restate the given Pulse numbers in one paragraph. Do not add numbers that are not in the input. JSON is forbidden.'
        },
        { role: 'user', content: JSON.stringify(payload) }
      ],
      temperature: 0.3,
      max_tokens: 120
    },
    opts.signal ? { signal: opts.signal } : undefined
  );
  return completion.choices[0]?.message?.content || '';
};

module.exports = { composeAiFridayProse, clearCache, TIMEOUT_MS, CACHE_TTL_MS };
