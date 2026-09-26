const toMs = (value) => {
  if (value == null || value === '') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

const iso = (ms) => new Date(ms).toISOString();

const missionWindow = (mission, bugsById) => {
  const claimed = (mission.bugIds || []).map((id) => bugsById[id]).filter(Boolean);
  const starts = [
    toMs(mission.createdAt),
    ...claimed.map((bug) => toMs(bug.created || bug.created_at))
  ].filter((ms) => ms != null);
  const startMs = starts.length ? Math.min(...starts) : null;
  const targetMs = toMs(mission.targetDate);
  const ends = [
    targetMs,
    ...claimed.map((bug) => toMs(bug.dueSLA || bug.dueSla || bug.lastUpdated || bug.last_updated))
  ].filter((ms) => ms != null);
  const endMs = targetMs != null ? targetMs : (ends.length ? Math.max(...ends) : startMs);
  return { startMs, endMs, bugCount: claimed.length };
};

const computeHorizon = ({ missions, bugs, unclaimed } = {}) => {
  const bugsById = {};
  for (const bug of bugs || []) {
    if (bug && bug.bugId) bugsById[bug.bugId] = bug;
  }

  const raw = (missions || []).map((mission) => {
    const window = missionWindow(mission, bugsById);
    return {
      missionId: mission.id,
      title: mission.title,
      status: mission.status || 'hunting',
      start: window.startMs != null ? iso(window.startMs) : null,
      end: window.endMs != null ? iso(window.endMs) : null,
      startMs: window.startMs,
      endMs: window.endMs,
      bugCount: window.bugCount
    };
  });

  const dated = raw.filter((bar) => bar.startMs != null && bar.endMs != null);
  const undated = raw.filter((bar) => bar.startMs == null || bar.endMs == null);
  const degraded = [];
  if (!raw.length) {
    degraded.push({ metric: 'horizon', reason: 'no missions' });
  } else if (!dated.length) {
    degraded.push({ metric: 'horizon', reason: 'no mission dates' });
  }

  let range = null;
  let bars = raw;
  if (dated.length) {
    const min = Math.min(...dated.map((bar) => bar.startMs));
    const max = Math.max(...dated.map((bar) => Math.max(bar.endMs, bar.startMs)));
    const span = Math.max(max - min, 1);
    range = { from: iso(min), to: iso(max) };
    bars = raw.map((bar) => {
      if (bar.startMs == null || bar.endMs == null) {
        return { ...bar, leftPct: null, widthPct: null };
      }
      const widthMs = Math.max(bar.endMs - bar.startMs, span * 0.02);
      return {
        ...bar,
        leftPct: ((bar.startMs - min) / span) * 100,
        widthPct: (widthMs / span) * 100
      };
    });
  } else {
    bars = raw.map((bar) => ({ ...bar, leftPct: null, widthPct: null }));
  }

  const open = dated.filter((bar) => bar.status === 'hunting' || bar.status === 'striking');
  open.sort((a, b) => (b.endMs - b.startMs) - (a.endMs - a.startMs) || a.title.localeCompare(b.title));
  const critical = open[0] || null;

  return {
    bars,
    range,
    criticalPath: critical ? { missionId: critical.missionId, title: critical.title } : null,
    unclaimedCount: unclaimed && unclaimed.count != null ? unclaimed.count : (unclaimed && unclaimed.bugIds ? unclaimed.bugIds.length : 0),
    undatedCount: undated.length,
    degraded: degraded.length ? degraded : null
  };
};

module.exports = { computeHorizon };
