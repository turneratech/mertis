const storage = require('../storage');

const hasElevatedPrivileges = (user) =>
  Boolean(user && (user.role === 'godmode' || user.role === 'admin'));

const normalizeProjectKey = (projectKey) => (projectKey || '').toUpperCase();

const getAccessibleProjectKeys = async (user, isPrivileged) => {
  if (isPrivileged) return null;
  const projects = await storage.getAllProjects(user.username, false);
  return new Set(projects.map((project) => normalizeProjectKey(project.key)));
};

const canUserAccessProject = (projectKey, isPrivileged, accessibleProjectKeys) => {
  if (isPrivileged) return true;
  return accessibleProjectKeys?.has(normalizeProjectKey(projectKey));
};

const parseArbList = (arb) => {
  if (Array.isArray(arb)) return arb;
  if (typeof arb === 'string') return arb.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
};

const canUserViewBug = (bug, username, isPrivileged, accessibleProjectKeys) => {
  if (isPrivileged) return true;

  const projectKey = bug.projectKey || bug.project_key;
  if (canUserAccessProject(projectKey, isPrivileged, accessibleProjectKeys)) return true;

  if (bug.assignee === username) return true;
  if (bug.reporter === username) return true;
  if ((bug.qaOwner || bug.qa_owner) === username) return true;

  const arbList = parseArbList(bug.arb || []);
  if (arbList.includes(username)) return true;

  return false;
};

const filterBugsForUser = (bugs, username, isPrivileged, accessibleProjectKeys) => {
  if (isPrivileged) return bugs;
  return bugs.filter((bug) =>
    canUserViewBug(bug, username, isPrivileged, accessibleProjectKeys)
  );
};

module.exports = {
  hasElevatedPrivileges,
  normalizeProjectKey,
  getAccessibleProjectKeys,
  canUserAccessProject,
  canUserViewBug,
  filterBugsForUser
};
