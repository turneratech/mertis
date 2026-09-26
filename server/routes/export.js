const express = require('express');
const storage = require('../storage');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * Data export.
 *
 * LICENSING.md promises that a customer can always retrieve their data, on
 * every tier including Community, and that leaving is a supported feature. This
 * route is what makes that sentence true, so it deliberately has no
 * requireFeature gate: an export that a lapsed licence could switch off would
 * be exactly the hostage-taking the promise rules out.
 *
 * Everything goes through the storage abstraction, so it behaves identically on
 * mysql, postgres and csv.
 */

const isPrivileged = (user) => user && (user.role === 'godmode' || user.role === 'admin');

// Passwords are the one thing that must never leave, hashed or not.
const publicUser = ({ id, username, email, role, createdAt, created_at: createdSql }) => ({
  id, username, email, role, createdAt: createdAt || createdSql || null
});

const CSV_COLUMNS = [
  'bugId', 'projectKey', 'title', 'status', 'severity', 'priority', 'bugType',
  'module', 'environment', 'client', 'reporter', 'assignee', 'qaOwner', 'qaStatus',
  'arb', 'targetFixVersion', 'dueSLA', 'created', 'lastUpdated', 'closedDate', 'closureReason'
];

/** RFC 4180: quote every field, double the quotes inside. Excel-safe, no dependency. */
const csvCell = (value) => {
  if (value === null || value === undefined) return '""';
  const flat = Array.isArray(value) ? value.join('; ') : String(value);
  return `"${flat.replace(/"/g, '""')}"`;
};

const toCsv = (bugs) => {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const bug of bugs) {
    lines.push(CSV_COLUMNS.map((col) => csvCell(bug[col])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
};

const stamp = () => new Date().toISOString().slice(0, 10);

router.get('/', authMiddleware, async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({ error: 'Only admins can export the instance' });
    }

    const format = String(req.query.format || 'json').toLowerCase();
    const projectKey = req.query.project ? String(req.query.project).toUpperCase() : null;

    if (format === 'csv') {
      if (!projectKey) {
        return res.status(400).json({ error: 'CSV export needs a project: /api/export?format=csv&project=KEY' });
      }
      const project = await storage.getProjectByKey(projectKey);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const bugs = await storage.getBugsByProject(projectKey);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="mertis-${projectKey}-${stamp()}.csv"`);
      return res.send(toCsv(bugs));
    }

    if (format !== 'json') {
      return res.status(400).json({ error: `Unsupported format '${format}'. Use json or csv.` });
    }

    const [projects, users] = await Promise.all([
      storage.getAllProjects(req.user.username, true),
      storage.getAllUsers()
    ]);

    // Per project rather than getAllBugs(): that call takes a limit and the
    // point of an export is that nothing is left behind.
    const bugsByProject = {};
    for (const project of projects) {
      bugsByProject[project.key] = await storage.getBugsByProject(project.key);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.username,
      format: 'mertis-export-v1',
      storage: storage.getStorageType(),
      counts: {
        projects: projects.length,
        users: users.length,
        bugs: Object.values(bugsByProject).reduce((sum, list) => sum + list.length, 0)
      },
      projects,
      users: users.map(publicUser),
      bugs: bugsByProject
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mertis-export-${stamp()}.json"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
