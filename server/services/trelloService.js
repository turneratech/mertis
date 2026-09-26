/**
 * Trello REST API client for Mertis integration.
 * Uses native https — no extra dependencies.
 */

const https = require('https');
const trelloConfig = require('../config/trello.config');

const TRELLO_BASE = 'api.trello.com';

const parseResponse = (res, data, reject, resolve) => {
  if (res.statusCode >= 400) {
    let message = `Trello API error (${res.statusCode})`;
    try {
      const parsed = JSON.parse(data);
      message = parsed.message || parsed.error || message;
    } catch { /* use default */ }
    return reject(new Error(message));
  }
  if (!data) return resolve(null);
  try {
    resolve(JSON.parse(data));
  } catch {
    reject(new Error('Invalid JSON from Trello API'));
  }
};

const trelloRequest = (path, config) => {
  return new Promise((resolve, reject) => {
    const { apiKey, token } = config;
    const separator = path.includes('?') ? '&' : '?';
    const fullPath = `${path}${separator}key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`;

    const req = https.get(
      { hostname: TRELLO_BASE, path: fullPath, headers: { Accept: 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => parseResponse(res, data, reject, resolve));
      }
    );

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Trello API request timed out'));
    });
  });
};

const trelloWrite = (method, path, body, config) => {
  return new Promise((resolve, reject) => {
    const { apiKey, token } = config;
    const separator = path.includes('?') ? '&' : '?';
    const fullPath = `${path}${separator}key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`;
    const payload = body ? new URLSearchParams(body).toString() : '';

    const req = https.request(
      {
        hostname: TRELLO_BASE,
        path: fullPath,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
          } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => parseResponse(res, data, reject, resolve));
      }
    );

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Trello API request timed out'));
    });
    if (payload) req.write(payload);
    req.end();
  });
};

const trelloPost = (path, body, config) => trelloWrite('POST', path, body, config);
const trelloPut = (path, body, config) => trelloWrite('PUT', path, body, config);
const trelloDelete = (path, config) => trelloWrite('DELETE', path, null, config);

const getConfig = () => {
  const config = trelloConfig.getTrelloConfig();
  if (!config.apiKey || !config.token) {
    throw new Error('Trello is not configured. Add API key and token in Integrations → Trello.');
  }
  return config;
};

const testConnection = async () => {
  const config = getConfig();
  const member = await trelloRequest('/1/members/me?fields=fullName,username,url,avatarUrl', config);
  return {
    ok: true,
    member: {
      fullName: member.fullName,
      username: member.username,
      url: member.url,
      avatarUrl: member.avatarUrl
    }
  };
};

const getBoards = async () => {
  const config = getConfig();
  const boards = await trelloRequest(
    '/1/members/me/boards?filter=open&fields=id,name,url,desc,prefs,dateLastActivity&lists=none',
    config
  );
  return boards.map((b) => ({
    id: b.id,
    name: b.name,
    url: b.url,
    desc: b.desc || '',
    background: b.prefs?.background || 'blue',
    lastActivity: b.dateLastActivity
  }));
};

const getBoardLists = async (boardId) => {
  const config = getConfig();
  const lists = await trelloRequest(
    `/1/boards/${boardId}/lists?filter=open&fields=id,name,pos`,
    config
  );
  return lists.sort((a, b) => a.pos - b.pos).map((l) => ({ id: l.id, name: l.name }));
};

const getBoardDetail = async (boardId) => {
  const config = getConfig();
  const [board, lists, cards, members] = await Promise.all([
    trelloRequest(`/1/boards/${boardId}?fields=id,name,url,desc,dateLastActivity`, config),
    trelloRequest(`/1/boards/${boardId}/lists?filter=open&fields=id,name,pos`, config),
    trelloRequest(
      `/1/boards/${boardId}/cards?filter=open&fields=id,name,desc,due,dueComplete,labels,idList,idMembers,shortUrl,badges,dateLastActivity&members=true&member_fields=fullName,username`,
      config
    ),
    trelloRequest(`/1/boards/${boardId}/members?fields=id,fullName,username,avatarUrl`, config)
  ]);

  const sortedLists = lists.sort((a, b) => a.pos - b.pos);
  const cardsByList = {};
  sortedLists.forEach((list) => { cardsByList[list.id] = []; });
  cards.forEach((card) => {
    if (cardsByList[card.idList]) {
      cardsByList[card.idList].push(formatCard(card));
    }
  });

  return {
    board: {
      id: board.id,
      name: board.name,
      url: board.url,
      desc: board.desc || '',
      lastActivity: board.dateLastActivity
    },
    lists: sortedLists.map((l) => ({
      id: l.id,
      name: l.name,
      cards: cardsByList[l.id] || []
    })),
    members: members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      username: m.username,
      avatarUrl: m.avatarUrl
    })),
    stats: computeBoardStats(cards)
  };
};

const formatCard = (card) => ({
  id: card.id,
  name: card.name,
  desc: card.desc ? card.desc.slice(0, 200) : '',
  due: card.due,
  dueComplete: card.dueComplete,
  labels: (card.labels || []).map((l) => ({ name: l.name, color: l.color })),
  members: (card.members || []).map((m) => m.fullName || m.username),
  shortUrl: card.shortUrl,
  comments: card.badges?.comments || 0,
  attachments: card.badges?.attachments || 0,
  checkItems: card.badges?.checkItems || 0,
  checkItemsChecked: card.badges?.checkItemsChecked || 0,
  lastActivity: card.dateLastActivity
});

const computeBoardStats = (cards) => {
  const now = Date.now();
  const dayMs = 86400000;
  let overdue = 0;
  let dueSoon = 0;
  let withDue = 0;
  let withLabels = 0;

  cards.forEach((c) => {
    if (c.due && !c.dueComplete) {
      withDue++;
      const dueTime = new Date(c.due).getTime();
      if (dueTime < now) overdue++;
      else if (dueTime - now < 3 * dayMs) dueSoon++;
    }
    if (c.labels?.length) withLabels++;
  });

  return { totalCards: cards.length, overdue, dueSoon, withDue, withLabels };
};

const getDashboard = async (boardId) => {
  const config = getConfig();
  const boards = await getBoards();
  const targetBoardId = boardId || config.defaultBoardId || boards[0]?.id;

  let boardDetail = null;
  if (targetBoardId) {
    boardDetail = await getBoardDetail(targetBoardId);
  }

  const recentCards = boardDetail
    ? boardDetail.lists
        .flatMap((l) => l.cards.map((c) => ({ ...c, listName: l.name })))
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity))
        .slice(0, 8)
    : [];

  return {
    connected: true,
    boards,
    activeBoardId: targetBoardId,
    boardDetail,
    recentCards,
    summary: { boardCount: boards.length, ...(boardDetail?.stats || {}) }
  };
};

const createCard = async ({ name, desc, idList, due }) => {
  const config = getConfig();
  const body = { name, idList };
  if (desc) body.desc = desc;
  if (due) body.due = due;
  const card = await trelloPost('/1/cards', body, config);
  return formatCard(card);
};

const updateCard = async (cardId, { name, desc, due }) => {
  const config = getConfig();
  const body = {};
  if (name) body.name = name;
  if (desc !== undefined) body.desc = desc;
  if (due) body.due = due;
  const card = await trelloPut(`/1/cards/${cardId}`, body, config);
  return formatCard(card);
};

const moveCard = async (cardId, idList) => {
  const config = getConfig();
  const card = await trelloPut(`/1/cards/${cardId}`, { idList }, config);
  return formatCard(card);
};

const getCardListId = async (cardId) => {
  const config = getConfig();
  const card = await trelloRequest(`/1/cards/${cardId}?fields=idList`, config);
  return card.idList;
};

const createWebhook = async ({ callbackUrl, idModel, description }) => {
  const config = getConfig();
  return trelloPost('/1/webhooks', {
    callbackURL: callbackUrl,
    idModel,
    description: description || 'Mertis Trello sync'
  }, config);
};

const deleteWebhook = async (webhookId) => {
  const config = getConfig();
  return trelloDelete(`/1/webhooks/${webhookId}`, config);
};

module.exports = {
  testConnection,
  getBoards,
  getBoardLists,
  getBoardDetail,
  getDashboard,
  createCard,
  updateCard,
  moveCard,
  getCardListId,
  createWebhook,
  deleteWebhook
};
