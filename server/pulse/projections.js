const { resolveNextMove } = require('./nextMove');
const { truthClock } = require('./truthClock');

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened'];
const BOARD_CAP = 500;

const isTriaged = (bug) => {
  const value = bug.triagedAt || bug.triaged_at;
  return Boolean(value);
};

const isPitItem = (bug) => Boolean(bug) && !isTriaged(bug) && bug.status !== 'Closed';

const projectItem = (bug, knownUsers, botUsers) => {
  const nextMove = resolveNextMove(bug, knownUsers);
  const clock = truthClock(bug, botUsers);
  return {
    bugId: bug.bugId,
    title: bug.title,
    status: bug.status,
    severity: bug.severity,
    priority: bug.priority,
    bugType: bug.bugType || 'Bug',
    environment: bug.environment,
    assignee: bug.assignee || null,
    qaOwner: bug.qaOwner || bug.qa_owner || null,
    qaStatus: bug.qaStatus || bug.qa_status || 'Not Started',
    missionId: null,
    nextMove,
    truthClock: clock,
    dueSla: bug.dueSLA || bug.due_sla || null,
    triagedAt: bug.triagedAt || bug.triaged_at || null,
    projectKey: bug.projectKey,
    projectName: bug.projectName || null,
    module: bug.module || null,
    arb: Array.isArray(bug.arb) ? bug.arb : []
  };
};

const groupByStatus = (items) => {
  const columns = {};
  for (const status of STATUSES) columns[status] = [];
  for (const item of items) {
    const key = STATUSES.includes(item.status) ? item.status : 'Open';
    columns[key].push(item);
  }
  return columns;
};

const isSlaToday = (dueSla) => {
  if (!dueSla) return false;
  const due = new Date(dueSla);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return due.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
};

const isBlocked = (bug) => {
  const arb = Array.isArray(bug.arb) ? bug.arb : [];
  return arb.length > 0 && bug.status !== 'Closed';
};

module.exports = {
  STATUSES,
  BOARD_CAP,
  isTriaged,
  isPitItem,
  projectItem,
  groupByStatus,
  isSlaToday,
  isBlocked
};
