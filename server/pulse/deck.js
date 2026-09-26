const { computeBrief } = require('./brief');

const computeDeck = (projects = []) => {
  const rows = (projects || []).map((project) => {
    // The route may hand us a brief it pulled from the engine cache, so the deck
    // does not replay every project's activity log on every page load.
    const brief = project.brief || computeBrief(project.bugs, project.opts);
    return {
      projectKey: project.projectKey,
      projectName: project.projectName || project.projectKey,
      clauses: brief.clauses,
      oldestPit: brief.oldestPit,
      metrics: brief.metrics || null,
      degraded: brief.degraded
    };
  });
  return {
    rows,
    skipToStrike: rows.length === 1 ? rows[0].projectKey : null
  };
};

module.exports = { computeDeck };
