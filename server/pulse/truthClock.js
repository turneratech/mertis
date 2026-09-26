const REAL_ACTIONS = new Set(['status_change', 'comment', 'assigned', 'commit']);

/**
 * Spec §12.6 — last real mutation, never `updated` / `created` / bulk touches.
 */
const truthClock = (bug, botUsers = []) => {
  const bots = new Set((botUsers || []).map((u) => String(u).toLowerCase()));
  const log = Array.isArray(bug.activityLog) ? bug.activityLog : [];
  let latestMs = null;
  let latestIso = null;

  for (const row of log) {
    if (!REAL_ACTIONS.has(row.action)) continue;
    const user = String(row.user || '').toLowerCase();
    if (user && bots.has(user)) continue;
    const raw = row.timestamp || row.created_at;
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (Number.isNaN(ms)) continue;
    if (latestMs === null || ms > latestMs) {
      latestMs = ms;
      latestIso = new Date(ms).toISOString();
    }
  }

  if (latestMs === null) {
    const created = bug.created || bug.created_at || null;
    return {
      lastRealActivityAt: created ? new Date(created).toISOString() : null,
      ageHours: null,
      hasActivity: false
    };
  }

  return {
    lastRealActivityAt: latestIso,
    ageHours: (Date.now() - latestMs) / 3600000,
    hasActivity: true
  };
};

module.exports = { truthClock, REAL_ACTIONS };
