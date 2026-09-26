/**
 * CSV Storage Implementation
 * Implements the storage interface using CSV files
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
// getDataDir() rather than the constant: MANTIS_DATA_DIR may be set after this
// module is required (integration tests), so the path must resolve lazily.
const { readCSV, writeCSV, fileExists, getDataDir } = require('./csvHandler');
const { buildStatusChange } = require('../../utils/pulseTransition');

// File names and headers
const FILES = {
  USERS: 'users.csv',
  PROJECTS: 'projects.csv',
  SEQUENCES: 'sequences.csv',
  MISSIONS: 'pulse_missions.csv',
  MISSION_BUGS: 'pulse_mission_bugs.csv',
  CALENDAR_SOURCES: 'pulse_calendar_sources.csv'
};

const HEADERS = {
  USERS: ['id', 'username', 'password', 'email', 'role', 'createdAt', 'Temp1', 'Temp2', 'Temp3', 'Temp4'],
  PROJECTS: ['id', 'name', 'key', 'description', 'client', 'status', 'createdBy', 'createdAt', 'updatedAt', 'members', 'Temp1', 'Temp2', 'Temp3', 'Temp4'],
  BUGS: ['bugId', 'projectId', 'projectKey', 'title', 'description', 'client', 'module', 'environment', 'severity', 'priority', 'status', 'reporter', 'assignee', 'qaOwner', 'qaStatus', 'targetFixVersion', 'dueSLA', 'attachmentLinks', 'closureReason', 'created', 'lastUpdated', 'closedDate', 'activityLog', 'arb', 'bugType', 'triagedAt', 'Temp2', 'Temp3', 'Temp4'],
  SEQUENCES: ['projectKey', 'lastNumber'],
  MISSIONS: ['id', 'projectId', 'title', 'intent', 'owner', 'targetDate', 'status', 'createdAt', 'updatedAt'],
  MISSION_BUGS: ['missionId', 'bugId', 'addedAt', 'addedBy'],
  CALENDAR_SOURCES: ['id', 'username', 'label', 'url', 'createdAt']
};

// Helper to get bug filename for a project
const getBugFileName = (projectKey) => `bugs_${projectKey.toLowerCase()}.csv`;

// ==================== USERS ====================

const getUserById = async (id) => {
  const users = await readCSV(FILES.USERS);
  const user = users.find(u => u.id === id);
  return user || null;
};

const getUserByUsername = async (username) => {
  const users = await readCSV(FILES.USERS);
  const user = users.find(u => u.username === username);
  return user || null;
};

const getAllUsers = async () => {
  const users = await readCSV(FILES.USERS);
  return users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt
  }));
};

const createUser = async (userData) => {
  const users = await readCSV(FILES.USERS);
  const newUser = {
    id: userData.id || uuidv4(),
    username: userData.username,
    password: userData.password,
    email: userData.email || '',
    role: userData.role || 'user',
    createdAt: new Date().toISOString(),
    Temp1: '', Temp2: '', Temp3: '', Temp4: ''
  };
  users.push(newUser);
  await writeCSV(FILES.USERS, users, HEADERS.USERS);
  return newUser;
};

const deleteUser = async (id) => {
  const users = await readCSV(FILES.USERS);
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  await writeCSV(FILES.USERS, filtered, HEADERS.USERS);
  return true;
};

const updateUserPassword = async (id, hashedPassword) => {
  const users = await readCSV(FILES.USERS);
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;
  
  users[index].password = hashedPassword;
  await writeCSV(FILES.USERS, users, HEADERS.USERS);
  return true;
};


// ==================== PROJECTS ====================

const getAllProjects = async (username, isAdmin) => {
  const projects = await readCSV(FILES.PROJECTS);
  
  let filtered = projects;
  if (!isAdmin && username) {
    filtered = projects.filter(p => {
      const members = p.members ? JSON.parse(p.members) : [];
      return members.includes(username);
    });
  }
  
  return filtered.map(p => ({
    id: p.id,
    name: p.name,
    key: p.key,
    description: p.description,
    client: p.client,
    status: p.status,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    members: p.members ? JSON.parse(p.members) : [],
    githubRepoUrl: p.Temp1 || '',
    webhookSecret: p.Temp2 || '',
    trelloBoardId: p.Temp3 || '',
    trelloConfigJson: p.Temp4 || ''
  }));
};

const getProjectById = async (id) => {
  const projects = await readCSV(FILES.PROJECTS);
  const project = projects.find(p => p.id === id);
  if (!project) return null;
  
  return {
    id: project.id,
    name: project.name,
    key: project.key,
    description: project.description,
    client: project.client,
    status: project.status,
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    members: project.members ? JSON.parse(project.members) : [],
    githubRepoUrl: project.Temp1 || '',
    webhookSecret: project.Temp2 || '',
    trelloBoardId: project.Temp3 || '',
    trelloConfigJson: project.Temp4 || ''
  };
};

const getProjectByKey = async (key) => {
  const projects = await readCSV(FILES.PROJECTS);
  const project = projects.find(p => p.key === key.toUpperCase());
  if (!project) return null;
  return { id: project.id, name: project.name, key: project.key, client: project.client };
};

const createProject = async (projectData) => {
  const projects = await readCSV(FILES.PROJECTS);
  const projectKey = projectData.key.toUpperCase();
  
  const newProject = {
    id: projectData.id || uuidv4(),
    name: projectData.name,
    key: projectKey,
    description: projectData.description || '',
    client: projectData.client || '',
    status: projectData.status || 'active',
    createdBy: projectData.createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: JSON.stringify(projectData.members || [projectData.createdBy]),
    Temp1: '', Temp2: '', Temp3: '', Temp4: ''
  };
  
  projects.push(newProject);
  await writeCSV(FILES.PROJECTS, projects, HEADERS.PROJECTS);
  
  // Initialize sequence
  const sequences = await readCSV(FILES.SEQUENCES);
  if (!sequences.find(s => s.projectKey === projectKey)) {
    sequences.push({ projectKey, lastNumber: '0' });
    await writeCSV(FILES.SEQUENCES, sequences, HEADERS.SEQUENCES);
  }
  
  return await getProjectById(newProject.id);
};

const updateProject = async (id, updates) => {
  const projects = await readCSV(FILES.PROJECTS);
  const index = projects.findIndex(p => p.id === id);
  if (index === -1) return null;
  
  const project = projects[index];
  
  if (updates.name) project.name = updates.name;
  if (updates.description !== undefined) project.description = updates.description;
  if (updates.client !== undefined) project.client = updates.client;
  if (updates.status) project.status = updates.status;
  if (updates.members) project.members = JSON.stringify(updates.members);
  if (updates.githubRepoUrl !== undefined) project.Temp1 = updates.githubRepoUrl;
  if (updates.webhookSecret !== undefined) project.Temp2 = updates.webhookSecret;
  if (updates.trelloBoardId !== undefined) project.Temp3 = updates.trelloBoardId;
  if (updates.trelloConfigJson !== undefined) project.Temp4 = updates.trelloConfigJson;
  project.updatedAt = new Date().toISOString();
  
  projects[index] = project;
  await writeCSV(FILES.PROJECTS, projects, HEADERS.PROJECTS);
  
  return await getProjectById(id);
};

const deleteProject = async (id) => {
  const projects = await readCSV(FILES.PROJECTS);
  const project = projects.find(p => p.id === id);
  if (!project) return false;
  
  const filtered = projects.filter(p => p.id !== id);
  await writeCSV(FILES.PROJECTS, filtered, HEADERS.PROJECTS);
  
  // Note: Bug file deletion could be added here if needed
  return true;
};

const addProjectMember = async (projectId, username) => {
  const projects = await readCSV(FILES.PROJECTS);
  const index = projects.findIndex(p => p.id === projectId);
  if (index === -1) return [];
  
  const members = projects[index].members ? JSON.parse(projects[index].members) : [];
  if (!members.includes(username)) {
    members.push(username);
    projects[index].members = JSON.stringify(members);
    projects[index].updatedAt = new Date().toISOString();
    await writeCSV(FILES.PROJECTS, projects, HEADERS.PROJECTS);
  }
  
  return members;
};

const removeProjectMember = async (projectId, username) => {
  const projects = await readCSV(FILES.PROJECTS);
  const index = projects.findIndex(p => p.id === projectId);
  if (index === -1) return [];
  
  let members = projects[index].members ? JSON.parse(projects[index].members) : [];
  members = members.filter(m => m !== username);
  projects[index].members = JSON.stringify(members);
  projects[index].updatedAt = new Date().toISOString();
  await writeCSV(FILES.PROJECTS, projects, HEADERS.PROJECTS);
  
  return members;
};

// ==================== BUGS ====================

const parseActivityLog = (activityLogStr) => {
  if (!activityLogStr) return [];
  try {
    return JSON.parse(activityLogStr);
  } catch {
    return [];
  }
};

const formatBug = (bug, projectName = '') => {
  return {
    bugId: bug.bugId,
    title: bug.title,
    description: bug.description,
    client: bug.client,
    module: bug.module,
    environment: bug.environment,
    severity: bug.severity,
    priority: bug.priority,
    status: bug.status,
    reporter: bug.reporter,
    assignee: bug.assignee,
    qaOwner: bug.qaOwner,
    qaStatus: bug.qaStatus,
    targetFixVersion: bug.targetFixVersion,
    dueSLA: bug.dueSLA,
    attachmentLinks: bug.attachmentLinks,
    closureReason: bug.closureReason,
    arb: bug.arb ? JSON.parse(bug.arb) : [],
    bugType: bug.bugType || 'Bug',
    triagedAt: bug.triagedAt || null,
    created: bug.created,
    lastUpdated: bug.lastUpdated,
    closedDate: bug.closedDate,
    projectId: bug.projectId,
    projectKey: bug.projectKey,
    projectName: projectName,
    activityLog: parseActivityLog(bug.activityLog),
    trelloCardId: bug.Temp3 || '',
    trelloCardUrl: bug.Temp4 || ''
  };
};

const getAllBugs = async (limit = 500) => {
  const projects = await readCSV(FILES.PROJECTS);
  const allBugs = [];
  
  for (const project of projects) {
    const bugFile = getBugFileName(project.key);
    if (fileExists(bugFile)) {
      const bugs = await readCSV(bugFile);
      bugs.forEach(bug => {
        allBugs.push(formatBug(bug, project.name));
      });
    }
  }
  
  // Sort by lastUpdated descending and limit
  allBugs.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  return allBugs.slice(0, limit);
};

const getBugsByProject = async (projectKey) => {
  const project = await getProjectByKey(projectKey);
  const bugFile = getBugFileName(projectKey);
  
  if (!fileExists(bugFile)) return [];
  
  const bugs = await readCSV(bugFile);
  return bugs.map(bug => formatBug(bug, project?.name || ''));
};

const getBugsByUser = async (username) => {
  const allBugs = await getAllBugs(10000);
  return allBugs.filter(bug => 
    bug.assignee === username || 
    bug.reporter === username || 
    bug.qaOwner === username
  );
};

const getBugById = async (bugId) => {
  // Extract project key from bug ID (e.g., SM-0001 -> SM)
  const projectKey = bugId.split('-')[0];
  const bugFile = getBugFileName(projectKey);
  
  if (!fileExists(bugFile)) return null;
  
  const bugs = await readCSV(bugFile);
  const bug = bugs.find(b => b.bugId === bugId);
  if (!bug) return null;
  
  const project = await getProjectByKey(projectKey);
  return formatBug(bug, project?.name || '');
};

const generateBugId = async (projectKey) => {
  const key = projectKey.toUpperCase();
  const sequences = await readCSV(FILES.SEQUENCES);
  
  let sequence = sequences.find(s => s.projectKey === key);
  let nextNumber = 1;
  
  if (sequence) {
    nextNumber = parseInt(sequence.lastNumber, 10) + 1;
    sequence.lastNumber = String(nextNumber);
  } else {
    sequences.push({ projectKey: key, lastNumber: '1' });
  }
  
  await writeCSV(FILES.SEQUENCES, sequences, HEADERS.SEQUENCES);
  return `${key}-${String(nextNumber).padStart(4, '0')}`;
};

const createBug = async (bugData, reporter) => {
  const { projectKey } = bugData;
  const bugFile = getBugFileName(projectKey);
  
  const bugs = fileExists(bugFile) ? await readCSV(bugFile) : [];
  
  const activityLog = [{
    user: reporter,
    action: 'created',
    message: 'Bug created',
    timestamp: new Date().toISOString()
  }];
  
  const newBug = {
    bugId: bugData.bugId,
    projectId: bugData.projectId,
    projectKey: bugData.projectKey,
    title: bugData.title || '',
    description: bugData.description || '',
    client: bugData.client || '',
    module: bugData.module || '',
    environment: bugData.environment || 'Development',
    severity: bugData.severity || 'Medium',
    priority: bugData.priority || 'Medium',
    status: 'Open',
    reporter: reporter,
    assignee: bugData.assignee || '',
    qaOwner: bugData.qaOwner || '',
    qaStatus: 'Not Started',
    targetFixVersion: bugData.targetFixVersion || '',
    dueSLA: bugData.dueSLA || '',
    attachmentLinks: bugData.attachmentLinks || '',
    closureReason: '',
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    closedDate: '',
    activityLog: JSON.stringify(activityLog),
    arb: bugData.arb ? JSON.stringify(bugData.arb) : '[]',
    bugType: bugData.bugType || 'Bug',
    triagedAt: '',
    Temp2: '', Temp3: '', Temp4: ''
  };
  
  bugs.push(newBug);
  await writeCSV(bugFile, bugs, HEADERS.BUGS);
  
  return await getBugById(bugData.bugId);
};

const updateBug = async (bugId, updates, updatedBy) => {
  const projectKey = bugId.split('-')[0];
  const bugFile = getBugFileName(projectKey);
  
  if (!fileExists(bugFile)) return null;
  
  const bugs = await readCSV(bugFile);
  const index = bugs.findIndex(b => b.bugId === bugId);
  if (index === -1) return null;
  
  const bug = bugs[index];
  const oldStatus = bug.status;
  const oldQaStatus = bug.qaStatus;
  const oldAssignee = bug.assignee;
  
  // Track changes
  const changes = [];
  const fieldsToTrack = ['priority', 'severity', 'bugType'];
  fieldsToTrack.forEach(field => {
    if (updates[field] !== undefined && updates[field] !== bug[field]) {
      changes.push(`${field}: "${bug[field] || ''}" → "${updates[field]}"`);
    }
  });
 
  // Track ARB changes
  if (updates.arb !== undefined && updates.arb !== null) {
    const oldArb = bug.arb ? JSON.parse(bug.arb) : [];
    const nextArb = Array.isArray(updates.arb) ? updates.arb : [];
    if (JSON.stringify(oldArb) !== JSON.stringify(nextArb)) {
      changes.push(`ARB: "${oldArb.join(', ')}" → "${nextArb.join(', ')}"`);
    }
  }

  // Update fields
  const updateableFields = ['title', 'description', 'client', 'module', 'environment', 
    'severity', 'priority', 'status', 'assignee', 'qaOwner', 'qaStatus',
    'targetFixVersion', 'dueSLA', 'attachmentLinks', 'closureReason', 'bugType'];
  
  updateableFields.forEach(field => {
    if (updates[field] !== undefined && updates[field] !== null) {
      bug[field] = updates[field];
    }
  });

  // Update ARB
  if (updates.arb !== undefined && updates.arb !== null) {
    bug.arb = JSON.stringify(updates.arb);
  }
  if (updates.trelloCardId !== undefined) bug.Temp3 = updates.trelloCardId;
  if (updates.trelloCardUrl !== undefined) bug.Temp4 = updates.trelloCardUrl;

  // Handle closed date and reset ARB when closed
  if (updates.status === 'Closed' && oldStatus !== 'Closed') {
    bug.closedDate = new Date().toISOString();
    bug.arb = '[]';  // Reset ARB when closed
    changes.push('ARB cleared on closure');
  } else if (updates.status && updates.status !== 'Closed') {
    bug.closedDate = '';
  }
  
  bug.lastUpdated = new Date().toISOString();
  
  const activityLog = parseActivityLog(bug.activityLog);
  const nowIso = new Date().toISOString();
  if (updates.status !== undefined && updates.status !== null && updates.status !== oldStatus) {
    const sc = buildStatusChange(oldStatus, updates.status);
    activityLog.push({
      user: updatedBy,
      action: sc.action,
      from: sc.from,
      to: sc.to,
      station: sc.station,
      message: sc.message,
      timestamp: nowIso
    });
  }
  if (updates.qaStatus !== undefined && updates.qaStatus !== null && updates.qaStatus !== oldQaStatus) {
    activityLog.push({
      user: updatedBy,
      action: 'status_change',
      from: oldQaStatus,
      to: updates.qaStatus,
      station: 'qa_testing',
      message: `qa_status: ${oldQaStatus} → ${updates.qaStatus}`,
      timestamp: nowIso
    });
  }
  if (updates.assignee !== undefined && updates.assignee !== null && updates.assignee !== oldAssignee) {
    activityLog.push({
      user: updatedBy,
      action: 'assigned',
      message: `assigned: ${oldAssignee || ''} → ${updates.assignee || ''}`,
      timestamp: nowIso
    });
  }
  if (changes.length > 0) {
    activityLog.push({
      user: updatedBy,
      action: 'updated',
      message: `Updated: ${changes.join(', ')}`,
      timestamp: nowIso
    });
  }
  bug.activityLog = JSON.stringify(activityLog);
  
  bugs[index] = bug;
  await writeCSV(bugFile, bugs, HEADERS.BUGS);
  
  return await getBugById(bugId);
};

const getBugByTrelloCardId = async (cardId) => {
  if (!cardId) return null;
  const projects = await readCSV(FILES.PROJECTS);
  for (const project of projects) {
    const bugFile = getBugFileName(project.key);
    if (!fileExists(bugFile)) continue;
    const bugs = await readCSV(bugFile);
    const bug = bugs.find((b) => b.Temp3 === cardId);
    if (bug) return formatBug(bug, project.name);
  }
  return null;
};

const deleteBug = async (bugId) => {
  const projectKey = bugId.split('-')[0];
  const bugFile = getBugFileName(projectKey);
  
  if (!fileExists(bugFile)) return false;
  
  const bugs = await readCSV(bugFile);
  const filtered = bugs.filter(b => b.bugId !== bugId);
  
  if (filtered.length === bugs.length) return false;
  
  await writeCSV(bugFile, filtered, HEADERS.BUGS);
  return true;
};

const addBugComment = async (bugId, username, comment) => {
  const projectKey = bugId.split('-')[0];
  const bugFile = getBugFileName(projectKey);
  
  if (!fileExists(bugFile)) return null;
  
  const bugs = await readCSV(bugFile);
  const index = bugs.findIndex(b => b.bugId === bugId);
  if (index === -1) return null;
  
  const bug = bugs[index];
  const activityLog = parseActivityLog(bug.activityLog);
  activityLog.push({
    user: username,
    action: 'comment',
    message: comment,
    timestamp: new Date().toISOString()
  });
  
  bug.activityLog = JSON.stringify(activityLog);
  bug.lastUpdated = new Date().toISOString();
  
  bugs[index] = bug;
  await writeCSV(bugFile, bugs, HEADERS.BUGS);
  
  return await getBugById(bugId);
};

const addBugActivity = async (bugId, username, action, message) => {
  const projectKey = bugId.split('-')[0];
  const bugFile = getBugFileName(projectKey);
  if (!fileExists(bugFile)) return null;
  const bugs = await readCSV(bugFile);
  const index = bugs.findIndex((b) => b.bugId === bugId);
  if (index === -1) return null;
  const bug = bugs[index];
  const activityLog = parseActivityLog(bug.activityLog);
  activityLog.push({
    user: username,
    action,
    message,
    timestamp: new Date().toISOString()
  });
  bug.activityLog = JSON.stringify(activityLog);
  bugs[index] = bug;
  await writeCSV(bugFile, bugs, HEADERS.BUGS);
  return true;
};

const getBugStats = async (projectKey) => {
  const bugs = await getBugsByProject(projectKey);
  
  return {
    total: bugs.length,
    open: bugs.filter(b => b.status === 'Open').length,
    inProgress: bugs.filter(b => b.status === 'In Progress').length,
    resolved: bugs.filter(b => b.status === 'Resolved').length,
    closed: bugs.filter(b => b.status === 'Closed').length,
    critical: bugs.filter(b => b.severity === 'Critical').length,
    high: bugs.filter(b => b.severity === 'High').length
  };
};

// ==================== ANALYTICS ====================

const getAdminAnalytics = async () => {
  const allBugs = await getAllBugs(10000);
  const projects = await getAllProjects(null, true);
  const users = await getAllUsers();
  
  // Overall stats
  const overallStats = {
    totalBugs: allBugs.length,
    totalProjects: projects.length,
    totalUsers: users.length,
    openBugs: allBugs.filter(b => b.status === 'Open').length,
    inProgressBugs: allBugs.filter(b => b.status === 'In Progress').length,
    resolvedBugs: allBugs.filter(b => b.status === 'Resolved').length,
    closedBugs: allBugs.filter(b => b.status === 'Closed').length,
    criticalBugs: allBugs.filter(b => b.severity === 'Critical').length,
    highBugs: allBugs.filter(b => b.severity === 'High').length,
    mediumBugs: allBugs.filter(b => b.severity === 'Medium').length,
    lowBugs: allBugs.filter(b => b.severity === 'Low').length
  };

  // Distributions
  const statusDistribution = [
    { name: 'Open', value: overallStats.openBugs, color: '#3b82f6' },
    { name: 'In Progress', value: overallStats.inProgressBugs, color: '#8b5cf6' },
    { name: 'Resolved', value: overallStats.resolvedBugs, color: '#10b981' },
    { name: 'Closed', value: overallStats.closedBugs, color: '#6b7280' }
  ].filter(s => s.value > 0);

  const severityDistribution = [
    { name: 'Critical', value: overallStats.criticalBugs, color: '#dc2626' },
    { name: 'High', value: overallStats.highBugs, color: '#f97316' },
    { name: 'Medium', value: overallStats.mediumBugs, color: '#eab308' },
    { name: 'Low', value: overallStats.lowBugs, color: '#22c55e' }
  ].filter(s => s.value > 0);

  const priorityMap = { Critical: '#dc2626', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };
  const priorityCounts = {};
  allBugs.forEach(b => {
    priorityCounts[b.priority] = (priorityCounts[b.priority] || 0) + 1;
  });
  const priorityDistribution = Object.entries(priorityCounts)
    .map(([name, value]) => ({ name, value, color: priorityMap[name] }))
    .filter(p => p.value > 0);

  // Project stats
  const projectStats = await Promise.all(projects.map(async (p) => {
    const stats = await getBugStats(p.key);
    return {
      projectId: p.id,
      projectName: p.name,
      projectKey: p.key,
      total: stats.total,
      open: stats.open,
      inProgress: stats.inProgress,
      resolved: stats.resolved,
      closed: stats.closed,
      critical: stats.critical
    };
  }));

  // User stats
  const userStats = users.map(u => {
    const assigned = allBugs.filter(b => b.assignee === u.username);
    return {
      userId: u.id,
      username: u.username,
      role: u.role,
      assigned: assigned.length,
      assignedOpen: assigned.filter(b => ['Open', 'In Progress'].includes(b.status)).length,
      reported: allBugs.filter(b => b.reporter === u.username).length,
      resolved: assigned.filter(b => ['Resolved', 'Closed'].includes(b.status)).length
    };
  });

  // Bug trend (last 30 days)
  const now = new Date();
  const bugTrend = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    bugTrend.push({
      date: dateStr,
      created: allBugs.filter(b => b.created && b.created.startsWith(dateStr)).length,
      closed: allBugs.filter(b => b.closedDate && b.closedDate.startsWith(dateStr)).length
    });
  }

  // Weekly trend
  const weeklyTrend = [];
  for (let w = 1; w <= 12; w++) {
    weeklyTrend.push({ week: `W${w}`, created: 0, closed: 0 });
  }

  // Most active bugs
  const mostActiveBugs = allBugs
    .map(b => ({
      bugId: b.bugId,
      title: b.title,
      projectName: b.projectName,
      projectKey: b.projectKey,
      status: b.status,
      severity: b.severity,
      priority: b.priority,
      assignee: b.assignee,
      reporter: b.reporter,
      lastUpdated: b.lastUpdated,
      activityCount: b.activityLog.length
    }))
    .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
    .slice(0, 10);

  // Average resolution time
  const closedBugs = allBugs.filter(b => b.closedDate && b.created);
  let avgResolutionTime = 0;
  if (closedBugs.length > 0) {
    const totalDays = closedBugs.reduce((sum, b) => {
      const created = new Date(b.created);
      const closed = new Date(b.closedDate);
      return sum + Math.ceil((closed - created) / (1000 * 60 * 60 * 24));
    }, 0);
    avgResolutionTime = Math.round(totalDays / closedBugs.length);
  }

  // Environment stats
  const envCounts = {};
  allBugs.forEach(b => {
    if (b.environment) {
      envCounts[b.environment] = (envCounts[b.environment] || 0) + 1;
    }
  });
  const environmentStats = Object.entries(envCounts)
    .map(([name, value]) => ({ name, value }))
    .filter(e => e.value > 0);

  return {
    overallStats,
    statusDistribution,
    severityDistribution,
    priorityDistribution,
    projectStats,
    userStats,
    bugTrend,
    weeklyTrend,
    mostActiveBugs,
    avgResolutionTime,
    environmentStats
  };
};

const getUserDashboard = async (username, isAdmin) => {
  const allBugs = await getAllBugs(10000);
  const projects = await getAllProjects(username, isAdmin);
  
  const assignedBugs = allBugs.filter(b => b.assignee === username);
  const reportedBugs = allBugs.filter(b => b.reporter === username);
  const qaBugs = allBugs.filter(b => b.qaOwner === username);
  
  const stats = {
    assignedTotal: assignedBugs.length,
    assignedOpen: assignedBugs.filter(b => b.status === 'Open').length,
    assignedInProgress: assignedBugs.filter(b => b.status === 'In Progress').length,
    assignedResolved: assignedBugs.filter(b => ['Resolved', 'Closed'].includes(b.status)).length,
    reportedTotal: reportedBugs.length,
    qaTotal: qaBugs.length,
    qaFailed: qaBugs.filter(b => b.qaStatus === 'Failed').length
  };

  // Project summaries
  const projectSummaries = await Promise.all(projects.map(async (p) => {
    const projectBugs = allBugs.filter(b => b.projectKey === p.key);
    const myBugs = projectBugs.filter(b => 
      b.assignee === username || b.reporter === username || b.qaOwner === username
    );
    return {
      projectId: p.id,
      projectName: p.name,
      projectKey: p.key,
      totalBugs: projectBugs.length,
      myBugs: myBugs.length,
      openBugs: projectBugs.filter(b => b.status === 'Open').length,
      criticalBugs: projectBugs.filter(b => b.severity === 'Critical').length
    };
  }));

  // Recent bugs
  const myBugs = allBugs.filter(b => 
    b.assignee === username || b.reporter === username || b.qaOwner === username
  );
  const recentBugs = myBugs
    .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))
    .slice(0, 10)
    .map(b => ({
      bugId: b.bugId,
      title: b.title,
      projectName: b.projectName,
      projectKey: b.projectKey,
      status: b.status,
      severity: b.severity,
      lastUpdated: b.lastUpdated,
      isAssigned: b.assignee === username,
      isReported: b.reporter === username
    }));

  // Status distribution
  const statusCounts = {};
  assignedBugs.forEach(b => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });
  const myStatusDistribution = Object.entries(statusCounts)
    .map(([name, value]) => ({ name, value }))
    .filter(s => s.value > 0);

  return {
    stats,
    projectSummaries,
    recentBugs,
    myStatusDistribution,
    projectCount: projects.length
  };
};

// ==================== SYSTEM ====================

const getStorageType = () => 'csv';

const isConnected = async () => true;

const listMissionsByProject = async (projectId) => {
  const rows = await readCSV(FILES.MISSIONS);
  return rows
    .filter((row) => row.projectId === projectId)
    .map((row) => ({
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      intent: row.intent,
      owner: row.owner || null,
      targetDate: row.targetDate || null,
      status: row.status || 'hunting',
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null
    }));
};

const listMissionLinksByProject = async (projectId) => {
  const missions = await listMissionsByProject(projectId);
  const ids = new Set(missions.map((row) => row.id));
  const rows = await readCSV(FILES.MISSION_BUGS);
  return rows
    .filter((row) => ids.has(row.missionId))
    .map((row) => ({
      missionId: row.missionId,
      bugId: row.bugId,
      addedAt: row.addedAt || null,
      addedBy: row.addedBy || null
    }));
};

const getMissionById = async (id) => {
  const rows = await readCSV(FILES.MISSIONS);
  const row = rows.find((item) => item.id === id);
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    intent: row.intent,
    owner: row.owner || null,
    targetDate: row.targetDate || null,
    status: row.status || 'hunting',
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null
  };
};

const createMission = async (data) => {
  const rows = await readCSV(FILES.MISSIONS);
  const now = new Date().toISOString();
  const mission = {
    id: data.id || uuidv4(),
    projectId: data.projectId,
    title: data.title,
    intent: data.intent,
    owner: data.owner || '',
    targetDate: data.targetDate || '',
    status: data.status || 'hunting',
    createdAt: now,
    updatedAt: now
  };
  rows.push(mission);
  await writeCSV(FILES.MISSIONS, rows, HEADERS.MISSIONS);
  return getMissionById(mission.id);
};

const claimMissionBug = async ({ missionId, bugId, addedBy }) => {
  const rows = await readCSV(FILES.MISSION_BUGS);
  if (rows.some((row) => row.bugId === bugId)) {
    const err = new Error('already claimed');
    err.code = 'BUG_ALREADY_CLAIMED';
    throw err;
  }
  rows.push({
    missionId,
    bugId,
    addedAt: new Date().toISOString(),
    addedBy: addedBy || ''
  });
  await writeCSV(FILES.MISSION_BUGS, rows, HEADERS.MISSION_BUGS);
  return { missionId, bugId };
};

const deleteMission = async (id) => {
  const links = await readCSV(FILES.MISSION_BUGS);
  const keptLinks = links.filter((row) => row.missionId !== id);
  const bugIds = links.filter((row) => row.missionId === id).map((row) => row.bugId);
  await writeCSV(FILES.MISSION_BUGS, keptLinks, HEADERS.MISSION_BUGS);
  const missions = await readCSV(FILES.MISSIONS);
  await writeCSV(FILES.MISSIONS, missions.filter((row) => row.id !== id), HEADERS.MISSIONS);
  return { bugIds };
};

const listCalendarSources = async (username) => {
  const rows = await readCSV(FILES.CALENDAR_SOURCES);
  return rows
    .filter((row) => row.username === username)
    .map((row) => ({
      id: row.id,
      username: row.username,
      label: row.label,
      url: row.url,
      createdAt: row.createdAt || null
    }));
};

const createCalendarSource = async (data) => {
  const rows = await readCSV(FILES.CALENDAR_SOURCES);
  const source = {
    id: data.id || uuidv4(),
    username: data.username,
    label: data.label,
    url: data.url,
    createdAt: new Date().toISOString()
  };
  rows.push(source);
  await writeCSV(FILES.CALENDAR_SOURCES, rows, HEADERS.CALENDAR_SOURCES);
  return source;
};

const deleteCalendarSource = async (id, username) => {
  const rows = await readCSV(FILES.CALENDAR_SOURCES);
  const kept = rows.filter((row) => !(row.id === id && row.username === username));
  if (kept.length === rows.length) return false;
  await writeCSV(FILES.CALENDAR_SOURCES, kept, HEADERS.CALENDAR_SOURCES);
  return true;
};

const setTriagedAt = async (bugId, timestampIso) => {
  const projectKey = bugId.split('-')[0];
  const bugFile = getBugFileName(projectKey);
  if (!fileExists(bugFile)) return null;
  const bugs = await readCSV(bugFile);
  const index = bugs.findIndex((b) => b.bugId === bugId);
  if (index === -1) return null;
  bugs[index].triagedAt = timestampIso || new Date().toISOString();
  await writeCSV(bugFile, bugs, HEADERS.BUGS);
  return await getBugById(bugId);
};

const migratePulseCsvFiles = async () => {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => /^bugs_.*\.csv$/i.test(f));
  for (const filename of files) {
    const filepath = path.join(dir, filename);
    const firstLine = fs.readFileSync(filepath, 'utf8').split(/\r?\n/)[0] || '';
    const needsType = !firstLine.includes('bugType');
    const needsTriage = !firstLine.includes('triagedAt');
    if (!needsType && !needsTriage) continue;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(filepath, `${filepath}.bak-${stamp}`);
    const rows = await readCSV(filename);
    const migrated = rows.map((row) => ({
      ...row,
      bugType: row.bugType || 'Bug',
      triagedAt: row.triagedAt || row.created || ''
    }));
    await writeCSV(filename, migrated, HEADERS.BUGS);
    console.log(`[Pulse] CSV migrated ${filename} (${migrated.length} rows)`);
  }
};

const initialize = async () => {
  await migratePulseCsvFiles();
  const users = await readCSV(FILES.USERS);
  const allowDevDefaults =
    process.env.NODE_ENV === 'development' || process.env.MANTIS_DEV_DEFAULTS === 'true';

  if (allowDevDefaults && users.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await createUser({
      id: uuidv4(),
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      role: 'admin'
    });
    console.log('[CSV] Dev default admin created (username: admin, password: admin123)');
  } else if (users.length === 0) {
    console.log('[CSV] No users yet — complete first-run setup at /mantis/setup');
  }

  const projects = await readCSV(FILES.PROJECTS);
  if (allowDevDefaults && projects.length === 0) {
    const defaultProjects = [
      { name: 'SandMaster', key: 'SM', description: 'AI-driven sand management system', client: 'Internal' },
      { name: 'RockMaster', key: 'RM', description: 'ML-based well log prediction system', client: 'Internal' },
      { name: 'Green Platform', key: 'GRN', description: 'GHG emissions platform with proprietary LLM', client: 'Internal' },
      { name: 'FieldViz', key: 'FV', description: 'AI-OCR for digitizing handwritten field documents', client: 'Internal' },
      { name: 'BugHive', key: 'BH', description: 'Internal bug tracking system', client: 'Internal' }
    ];
    
    for (const proj of defaultProjects) {
      await createProject({
        ...proj,
        createdBy: 'admin',
        members: ['admin']
      });
    }
    console.log('[CSV] Dev default projects created');
  }
  
  return true;
};

module.exports = {
  // Users
  getUserById,
  getUserByUsername,
  getAllUsers,
  createUser,
  deleteUser,
  updateUserPassword,
  // Projects
  getAllProjects,
  getProjectById,
  getProjectByKey,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  // Bugs
  getAllBugs,
  getBugsByProject,
  getBugsByUser,
  getBugById,
  getBugByTrelloCardId,
  generateBugId,
  createBug,
  updateBug,
  deleteBug,
  addBugComment,
  addBugActivity,
  getBugStats,
  setTriagedAt,
  listMissionsByProject,
  listMissionLinksByProject,
  getMissionById,
  createMission,
  claimMissionBug,
  deleteMission,
  listCalendarSources,
  createCalendarSource,
  deleteCalendarSource,
  // Analytics
  getAdminAnalytics,
  getUserDashboard,
  // System
  getStorageType,
  isConnected,
  initialize
};
