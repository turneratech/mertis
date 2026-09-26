const { reconstructBug } = require('./line');

const moduleName = (bug) => {
  const value = bug && bug.module;
  const name = value == null ? '' : String(value).trim();
  return name || '(no module)';
};

const computeGravity = (bugs, opts = {}) => {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  // Shares the engine's memoized reconstruction with The Line when one is passed.
  const reconstruct = opts.reconstruct || ((bug) => reconstructBug(bug, nowMs));
  const byBugId = {};
  const modules = {};

  for (const bug of bugs || []) {
    const row = reconstruct(bug);
    const gravity = row.reopenGravity || 0;
    byBugId[bug.bugId] = gravity;
    const module = moduleName(bug);
    if (!modules[module]) {
      modules[module] = { module, gravity: 0, heavy: 0, evidence: [] };
    }
    modules[module].gravity += gravity;
    if (gravity >= 2) modules[module].heavy += 1;
    if (gravity >= 1 && modules[module].evidence.length < 8) {
      modules[module].evidence.push(bug.bugId);
    }
  }

  const ranking = Object.values(modules)
    .filter((row) => row.gravity > 0)
    .sort((a, b) => b.gravity - a.gravity || a.module.localeCompare(b.module))
    .slice(0, 3);

  return {
    byBugId,
    ranking,
    sentence: ranking.length
      ? `Top bounce: ${ranking.map((row) => `${row.module} (${row.gravity})`).join(', ')}.`
      : 'No reopen gravity yet.',
    degraded: null
  };
};

module.exports = { computeGravity };
