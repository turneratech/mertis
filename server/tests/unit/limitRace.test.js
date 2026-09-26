/**
 * @verifies VER-LIC-020 … VER-LIC-023
 *
 * Community limits were enforced by `checkLimit` middleware that counted rows
 * and then called `next()`, leaving the route to do the insert. Between the
 * count and the insert nothing held the door: N concurrent creates at 249/250
 * all read 249, all passed, and all committed. A free user could exceed every
 * limit by double-clicking — no tampering, no edited source, no licence
 * violation on their part.
 *
 * These tests pin the serialisation that closes it, and the release guarantees
 * that stop the serialisation itself becoming a way to wedge the app.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const validatorPath = path.join(__dirname, '../../middleware/licenseValidator.js');
const servicePath = path.join(__dirname, '../../services/licenseService.js');

// Rebuild the middleware against a stubbed licenseService whose counts come
// from a store the fake route mutates — the real shape of the race.
const loadValidator = (stub) => {
  process.env.MERTIS_LIMIT_LOCK_TIMEOUT_MS = '250';
  delete require.cache[require.resolve(validatorPath)];
  delete require.cache[require.resolve(servicePath)];
  require.cache[require.resolve(servicePath)] = { id: servicePath, filename: servicePath, loaded: true, exports: stub };
  const mod = require(validatorPath);
  delete require.cache[require.resolve(servicePath)];
  return mod;
};

const tick = () => new Promise((r) => setImmediate(r));

// Minimal express-ish harness: run the middleware, then the handler.
const run = (middleware, handler) => new Promise((resolve) => {
  const res = {
    finished: false,
    _cbs: [],
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this._done(); return this; },
    end() { this._done(); return this; },
    on(evt, cb) { if (evt === 'finish' || evt === 'close') this._cbs.push(cb); return this; },
    _done() { if (this.finished) return; this.finished = true; this._cbs.forEach((cb) => cb()); resolve(this); }
  };
  middleware({}, res, () => { Promise.resolve(handler(res)).catch(() => res.status(500).end()); });
});

describe('Limit enforcement under concurrency [VER-LIC]', () => {
  it('VER-LIC-020: concurrent creates cannot exceed the cap', async () => {
    const store = { bugs: 249 };
    const stub = {
      checkLimit: async (type) => {
        await tick();                       // the count is an await in real life
        const count = store[type];
        return { allowed: count < 250, current: count, max: 250 };
      }
    };
    const { checkLimit } = loadValidator(stub);
    const mw = checkLimit('bugs');

    const create = async (res) => { await tick(); store.bugs += 1; res.json({ ok: true }); };
    const results = await Promise.all(Array.from({ length: 20 }, () => run(mw, create)));

    assert.equal(store.bugs, 250, 'exactly one create should have been admitted');
    assert.equal(results.filter((r) => r.statusCode === 200).length, 1);
    assert.equal(results.filter((r) => r.statusCode === 403).length, 19);
  });

  it('VER-LIC-021: the refusal still names the limit and asks for an upgrade', async () => {
    const stub = { checkLimit: async () => ({ allowed: false, current: 5, max: 5 }) };
    const { checkLimit } = loadValidator(stub);
    const res = await run(checkLimit('users'), async (r) => r.json({ ok: true }));

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.limitType, 'users');
    assert.equal(res.body.max, 5);
    assert.equal(res.body.upgradeRequired, true);
  });

  it('VER-LIC-022: a handler that never responds does not wedge later creates', async () => {
    const stub = { checkLimit: async () => ({ allowed: true, current: 1, max: 5 }) };
    const { checkLimit } = loadValidator(stub);
    const mw = checkLimit('projects');

    // First request abandons the response entirely.
    const abandoned = run(mw, () => new Promise(() => {}));
    await tick();

    // A later create must still get through rather than queue behind it forever.
    const after = await Promise.race([
      run(mw, async (r) => r.json({ ok: true })),
      new Promise((r) => setTimeout(() => r({ statusCode: 'TIMEOUT' }), 2000))
    ]);
    assert.equal(after.statusCode, 200, 'lock must be released on a timeout, not held for ever');
    void abandoned;
  });

  it('VER-LIC-023: a throwing limit check fails open but releases the lock', async () => {
    let calls = 0;
    const stub = {
      checkLimit: async () => { calls += 1; if (calls === 1) throw new Error('db down'); return { allowed: true, current: 1, max: 5 }; }
    };
    const { checkLimit } = loadValidator(stub);
    const mw = checkLimit('users');

    const first = await run(mw, async (r) => r.json({ ok: 'failed open' }));
    assert.equal(first.statusCode, 200, 'a broken check must not block core functionality');

    const second = await run(mw, async (r) => r.json({ ok: true }));
    assert.equal(second.statusCode, 200, 'the failed check must not leave the lock held');
  });
});
