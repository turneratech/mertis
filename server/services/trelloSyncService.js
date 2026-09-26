/**
 * Bidirectional sync between Mertis bugs and Trello cards.
 */

const trelloService = require('./trelloService');
const {
  parseTrelloConfig,
  mapStatusToListId,
  mapListIdToStatus,
  buildCardFromBug
} = require('../utils/trelloProject');

const recentSyncs = new Map();
const SYNC_COOLDOWN_MS = 12000;

const markSync = (key) => {
  recentSyncs.set(key, Date.now());
  setTimeout(() => recentSyncs.delete(key), SYNC_COOLDOWN_MS);
};

const isRecentSync = (key) => {
  const t = recentSyncs.get(key);
  return t && Date.now() - t < SYNC_COOLDOWN_MS;
};

const getWebhookCallbackUrl = () => {
  const base = process.env.TRELLO_WEBHOOK_BASE_URL
    || process.env.PUBLIC_URL
    || `http://localhost:${process.env.PORT || 5000}`;
  return `${base.replace(/\/$/, '')}/api/webhooks/trello`;
};

const enrichProject = (project) => {
  if (!project) return null;
  const trello = parseTrelloConfig(project);
  return { ...project, trello };
};

const getProjectForBug = async (storage, projectKey) => {
  const projects = await storage.getAllProjects(null, true);
  const project = projects.find((p) => (p.key || '').toUpperCase() === projectKey.toUpperCase());
  return enrichProject(project);
};

const saveBugTrelloLink = async (storage, bugId, cardId, cardUrl) => {
  await storage.updateBug(bugId, {
    trelloCardId: cardId,
    trelloCardUrl: cardUrl
  }, 'trello-sync');
};

const syncBugToTrello = async (bug, project, options = {}) => {
  const storage = require('../storage');
  const enriched = enrichProject(project);
  if (!enriched?.trello?.boardId || !enriched.trello.syncEnabled) {
    return { skipped: true, reason: 'Trello not configured for project' };
  }

  if (isRecentSync(`trello:${bug.trelloCardId || bug.bugId}`)) {
    return { skipped: true, reason: 'Sync cooldown' };
  }

  const lists = await trelloService.getBoardLists(enriched.trello.boardId);
  const listId = mapStatusToListId(bug.status || 'Open', enriched.trello, lists);
  if (!listId) {
    return { skipped: true, reason: 'No target list found' };
  }

  const baseUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const cardPayload = buildCardFromBug(bug, baseUrl);
  let card;

  if (bug.trelloCardId) {
    markSync(`trello:${bug.trelloCardId}`);
    card = await trelloService.updateCard(bug.trelloCardId, cardPayload);
    const currentList = await trelloService.getCardListId(bug.trelloCardId);
    if (currentList !== listId) {
      await trelloService.moveCard(bug.trelloCardId, listId);
    }
  } else {
    card = await trelloService.createCard({
      ...cardPayload,
      idList: listId
    });
    markSync(`trello:${card.id}`);
    await saveBugTrelloLink(storage, bug.bugId, card.id, card.shortUrl);
  }

  return { synced: true, card, created: !bug.trelloCardId };
};

const handleWebhookAction = async (payload) => {
  const storage = require('../storage');
  const action = payload?.action;
  if (!action?.type) return { handled: false };

  const cardId = action.data?.card?.id;
  if (!cardId) return { handled: false };

  if (isRecentSync(`trello:${cardId}`)) {
    return { handled: true, skipped: true, reason: 'Recent outbound sync' };
  }

  const bug = await storage.getBugByTrelloCardId(cardId);
  if (!bug) return { handled: true, skipped: true, reason: 'No linked bug' };

  const project = await getProjectForBug(storage, bug.projectKey);
  if (!project?.trello?.boardId) return { handled: true, skipped: true };

  markSync(`mertis:${bug.bugId}`);

  if (action.type === 'updateCard') {
    const updates = {};
    const card = action.data.card;

    if (card.name && card.name !== `[${bug.bugId}] ${bug.title}`) {
      const stripped = card.name.replace(/^\[[^\]]+\]\s*/, '').trim();
      if (stripped && stripped !== bug.title) updates.title = stripped.slice(0, 500);
    }

    if (card.idList && card.idList !== action.data.listBefore?.id) {
      const lists = await trelloService.getBoardLists(project.trello.boardId);
      const newStatus = mapListIdToStatus(card.idList, project.trello, lists);
      if (newStatus && newStatus !== bug.status) updates.status = newStatus;
    }

    if (Object.keys(updates).length > 0) {
      await storage.updateBug(bug.bugId, updates, 'trello-webhook');
      return { handled: true, bugId: bug.bugId, updates };
    }
  }

  if (action.type === 'commentCard') {
    const text = action.data.text;
    if (text) {
      await storage.addBugComment(bug.bugId, 'trello', `[Trello] ${text}`);
      return { handled: true, bugId: bug.bugId, comment: true };
    }
  }

  return { handled: true, skipped: true };
};

const registerProjectWebhook = async (project) => {
  const enriched = enrichProject(project);
  if (!enriched?.trello?.boardId || !enriched.trello.syncEnabled) {
    return { registered: false };
  }

  const callbackUrl = getWebhookCallbackUrl();
  const existingId = enriched.trello.webhookId;

  if (existingId) {
    try {
      await trelloService.deleteWebhook(existingId);
    } catch { /* may already be gone */ }
  }

  const webhook = await trelloService.createWebhook({
    callbackUrl,
    idModel: enriched.trello.boardId,
    description: `Mertis sync — ${project.key || project.name}`
  });

  return { registered: true, webhookId: webhook.id, callbackUrl };
};

const unregisterProjectWebhook = async (project) => {
  const enriched = enrichProject(project);
  const webhookId = enriched?.trello?.webhookId;
  if (!webhookId) return { removed: false };
  try {
    await trelloService.deleteWebhook(webhookId);
    return { removed: true };
  } catch {
    return { removed: false };
  }
};

module.exports = {
  getWebhookCallbackUrl,
  enrichProject,
  syncBugToTrello,
  handleWebhookAction,
  registerProjectWebhook,
  unregisterProjectWebhook,
  markSync,
  isRecentSync
};
