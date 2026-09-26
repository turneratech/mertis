/**
 * Parse / serialize Trello integration fields stored on projects (Temp3, Temp4).
 */

const MERTIS_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const parseTrelloConfig = (project) => {
  if (!project) {
    return { boardId: '', defaultListId: '', listMapping: {}, syncEnabled: false, webhookId: '', autoSync: true };
  }

  let extra = {};
  try {
    if (project.trelloConfigJson) {
      extra = typeof project.trelloConfigJson === 'string'
        ? JSON.parse(project.trelloConfigJson)
        : project.trelloConfigJson;
    } else if (project.Temp4) {
      extra = JSON.parse(project.Temp4);
    }
  } catch {
    extra = {};
  }

  return {
    boardId: project.trelloBoardId || project.Temp3 || '',
    defaultListId: extra.defaultListId || '',
    listMapping: extra.listMapping || {},
    syncEnabled: extra.syncEnabled !== false,
    webhookId: extra.webhookId || '',
    autoSync: extra.autoSync !== false
  };
};

const serializeTrelloConfig = ({ boardId, defaultListId, listMapping, syncEnabled, webhookId, autoSync }) => ({
  trelloBoardId: boardId || '',
  trelloConfigJson: JSON.stringify({
    defaultListId: defaultListId || '',
    listMapping: listMapping || {},
    syncEnabled: syncEnabled !== false,
    webhookId: webhookId || '',
    autoSync: autoSync !== false
  })
});

const mapStatusToListId = (status, trelloConfig, lists) => {
  if (trelloConfig.listMapping?.[status]) {
    return trelloConfig.listMapping[status];
  }
  if (trelloConfig.defaultListId) return trelloConfig.defaultListId;
  if (!lists?.length) return null;

  const nameMap = {
    Open: ['to do', 'open', 'backlog', 'todo'],
    'In Progress': ['in progress', 'doing', 'active', 'wip'],
    Resolved: ['resolved', 'review', 'qa', 'testing', 'done'],
    Closed: ['closed', 'complete', 'completed', 'archive']
  };
  const targets = nameMap[status] || [status.toLowerCase()];
  const match = lists.find((l) => targets.some((t) => l.name.toLowerCase().includes(t)));
  return match?.id || lists[0]?.id;
};

const mapListIdToStatus = (listId, trelloConfig, lists) => {
  const mapping = trelloConfig.listMapping || {};
  for (const [status, id] of Object.entries(mapping)) {
    if (id === listId) return status;
  }

  const list = lists?.find((l) => l.id === listId);
  if (!list) return null;
  const name = list.name.toLowerCase();

  if (name.includes('closed') || name.includes('complete') || name.includes('archive')) return 'Closed';
  if (name.includes('resolved') || name.includes('review') || name.includes('qa') || name.includes('test')) return 'Resolved';
  if (name.includes('progress') || name.includes('doing') || name.includes('wip') || name.includes('active')) return 'In Progress';
  if (name.includes('to do') || name.includes('open') || name.includes('backlog') || name.includes('todo')) return 'Open';
  return null;
};

const buildCardFromBug = (bug, baseUrl = '') => {
  const lines = [
    `[${bug.bugId}] ${bug.title}`,
    '',
    bug.description ? bug.description.replace(/<[^>]+>/g, '').slice(0, 4000) : '',
    '',
    `Severity: ${bug.severity || 'Medium'} | Priority: ${bug.priority || 'Medium'}`,
    `Status: ${bug.status || 'Open'}`,
    bug.assignee ? `Assignee: ${bug.assignee}` : '',
    baseUrl ? `View in Mertis: ${baseUrl}/projects/${bug.projectKey}/bugs/${bug.bugId}` : ''
  ].filter(Boolean);

  return {
    name: `[${bug.bugId}] ${bug.title}`.slice(0, 16384),
    desc: lines.join('\n').slice(0, 16384),
    due: bug.dueSLA ? new Date(bug.dueSLA).toISOString() : null
  };
};

module.exports = {
  MERTIS_STATUSES,
  parseTrelloConfig,
  serializeTrelloConfig,
  mapStatusToListId,
  mapListIdToStatus,
  buildCardFromBug
};
