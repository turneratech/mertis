const { computeGravity } = require('./gravity');
const { computeQualityTax } = require('./qualityTax');

const MISSION_STATUSES = ['hunting', 'striking', 'landed', 'abandoned'];

const normalizeStatus = (value) => {
  const status = String(value || 'hunting').trim().toLowerCase();
  return MISSION_STATUSES.includes(status) ? status : null;
};

const gravityTotal = (byBugId) =>
  Object.values(byBugId || {}).reduce((sum, n) => sum + (n || 0), 0);

const computeMissionMap = ({ bugs, missions, links, reconstruct } = {}) => {
  const items = Array.isArray(bugs) ? bugs : [];
  const byBugId = {};
  for (const link of links || []) {
    if (!link || !link.bugId || !link.missionId) continue;
    if (byBugId[link.bugId]) continue;
    byBugId[link.bugId] = link.missionId;
  }

  const claimed = new Set(Object.keys(byBugId));
  const unclaimedBugs = items.filter((bug) => bug && bug.bugId && !claimed.has(bug.bugId));
  const unclaimed = {
    bugIds: unclaimedBugs.map((bug) => bug.bugId),
    count: unclaimedBugs.length
  };

  const mapped = (missions || []).map((mission) => {
    const set = items.filter((bug) => byBugId[bug.bugId] === mission.id);
    const gravity = computeGravity(set, { reconstruct });
    const qualityTax = computeQualityTax(set);
    const degraded = [];
    if (qualityTax.degraded) degraded.push(qualityTax.degraded);
    return {
      id: mission.id,
      projectId: mission.projectId,
      title: mission.title,
      intent: mission.intent,
      owner: mission.owner || null,
      targetDate: mission.targetDate || null,
      status: mission.status || 'hunting',
      bugIds: set.map((bug) => bug.bugId),
      gravity: {
        sentence: gravity.sentence,
        ranking: gravity.ranking,
        total: gravityTotal(gravity.byBugId),
        byBugId: gravity.byBugId
      },
      qualityTax,
      degraded
    };
  });

  return { missions: mapped, unclaimed };
};

module.exports = { MISSION_STATUSES, normalizeStatus, computeMissionMap };
