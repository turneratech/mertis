// M19 — Lenses.
//
// Over BOARD_CAP the board returns empty columns and tells the user to "narrow
// your lens" — and until now no lens existed anywhere in Pulse. This is that
// lens: a small, closed set of named filters, applied to the bug set BEFORE any
// metric is computed, so the numbers always describe exactly what is on screen.
//
// Deliberately not a query language. The moment lenses compose arbitrarily we
// owe the user a parser, an editor, docs and saved-query management — which is
// JQL, which is on the Refuse list.

const { truthClock } = require('./truthClock');
const { resolveNextMove } = require('./nextMove');

const STALE_DAYS = 14;
const MAX_Q = 120;

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const ENVIRONMENTS = ['Development', 'Staging', 'Production', 'Testing'];

/**
 * needsValue   — `module:payments` style, a bare `module` is a 400.
 * needsMissions— the route must load mission links before applying it.
 * values       — closed vocabulary, matched case-insensitively.
 */
const LENS_SPECS = {
  mine: { needsValue: false },
  stale: { needsValue: false },
  unclaimed: { needsValue: false, needsMissions: true },
  module: { needsValue: true },
  severity: { needsValue: true, values: SEVERITIES },
  environment: { needsValue: true, values: ENVIRONMENTS },
  mission: { needsValue: true, needsMissions: true }
};

const LENS_NAMES = Object.keys(LENS_SPECS);

const err = (message) => ({ ok: false, error: message });

/**
 * Parse `?lens=` and `?q=`. Returns { ok, lens } or { ok:false, error }.
 * `lens` is null when neither parameter is present — no filtering at all.
 */
const parseLens = (query = {}) => {
  const rawLens = query.lens == null ? '' : String(query.lens).trim();
  const rawQ = query.q == null ? '' : String(query.q).trim();

  if (rawQ.length > MAX_Q) {
    return err(`q is too long (max ${MAX_Q} characters)`);
  }

  if (!rawLens) {
    // A bare ?q= is a valid lens on its own.
    return { ok: true, lens: rawQ ? { name: null, value: null, q: rawQ } : null };
  }

  const idx = rawLens.indexOf(':');
  const name = (idx === -1 ? rawLens : rawLens.slice(0, idx)).trim().toLowerCase();
  const value = idx === -1 ? '' : rawLens.slice(idx + 1).trim();

  const spec = LENS_SPECS[name];
  if (!spec) {
    // Never fail open: a filter that silently returns everything is worse than
    // no filter, because the user believes they are looking at a subset.
    return err(`unknown lens "${name}" — expected one of: ${LENS_NAMES.join(', ')}`);
  }

  if (spec.needsValue && !value) {
    return err(`lens "${name}" needs a value, e.g. ${name}:<value>`);
  }
  if (!spec.needsValue && value) {
    return err(`lens "${name}" does not take a value`);
  }

  if (spec.values) {
    const match = spec.values.find((v) => v.toLowerCase() === value.toLowerCase());
    if (!match) {
      return err(`lens "${name}" expects one of: ${spec.values.join(', ')}`);
    }
    return { ok: true, lens: { name, value: match, q: rawQ || null } };
  }

  return { ok: true, lens: { name, value: value || null, q: rawQ || null } };
};

const needsMissions = (lens) => Boolean(lens && lens.name && LENS_SPECS[lens.name]?.needsMissions);

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();

const matchesName = (bug, lens, ctx) => {
  switch (lens.name) {
    case 'mine': {
      // "Mine" means the next move is yours — the same rule My Pulse uses, not
      // "any bug you can see".
      const next = resolveNextMove(bug, ctx.knownUsers);
      return Boolean(ctx.username && next.user === ctx.username);
    }
    case 'stale': {
      const clock = truthClock(bug, ctx.botUsers);
      if (!clock.lastRealActivityAt) return true; // never touched is the stalest thing there is
      const ms = new Date(clock.lastRealActivityAt).getTime();
      if (Number.isNaN(ms)) return false;
      return ctx.nowMs - ms >= STALE_DAYS * 86400000;
    }
    case 'module':
      return norm(bug.module) === norm(lens.value);
    case 'severity':
      return norm(bug.severity) === norm(lens.value);
    case 'environment':
      return norm(bug.environment) === norm(lens.value);
    case 'mission':
      return (ctx.missionByBugId || {})[bug.bugId] === lens.value;
    case 'unclaimed':
      return !(ctx.missionByBugId || {})[bug.bugId];
    default:
      return true;
  }
};

const matchesQ = (bug, q) => {
  if (!q) return true;
  const needle = q.toLowerCase();
  const title = String(bug.title || '').toLowerCase();
  const id = String(bug.bugId || '').toLowerCase();
  return title.includes(needle) || id.includes(needle);
};

/**
 * Apply the lens. `ctx` carries what the named lenses need:
 * { username, knownUsers, botUsers, nowMs, missionByBugId }
 */
const applyLens = (bugs, lens, ctx = {}) => {
  const list = Array.isArray(bugs) ? bugs : [];
  if (!lens) return list;
  const withCtx = { nowMs: Date.now(), ...ctx };
  return list.filter(
    (bug) => bug && (!lens.name || matchesName(bug, lens, withCtx)) && matchesQ(bug, lens.q)
  );
};

/**
 * The summary the client renders. `of` is the unfiltered total — without it the
 * user cannot tell whether a small number means "small project" or "narrow
 * lens", and every metric on the page silently changes denominator.
 */
const lensSummary = (lens, matched, of) => {
  if (!lens) return null;
  return {
    name: lens.name || null,
    value: lens.value || null,
    q: lens.q || null,
    label: lens.name ? (lens.value ? `${lens.name}:${lens.value}` : lens.name) : `"${lens.q}"`,
    matched,
    of
  };
};

module.exports = {
  LENS_NAMES,
  LENS_SPECS,
  SEVERITIES,
  ENVIRONMENTS,
  STALE_DAYS,
  MAX_Q,
  parseLens,
  applyLens,
  lensSummary,
  needsMissions
};
