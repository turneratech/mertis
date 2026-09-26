/**
 * Trello integration API — boards, kanban view, config, sync.
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const trelloConfig = require('../config/trello.config');
const trelloService = require('../services/trelloService');
const trelloSyncService = require('../services/trelloSyncService');
const storage = require('../storage');

const isPrivileged = (user) => user && (user.role === 'godmode' || user.role === 'admin');

router.get('/status', authMiddleware, (req, res) => {
  res.json(trelloConfig.getTrelloSummary());
});

router.get('/config', authMiddleware, (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  res.json(trelloConfig.getTrelloConfigForClient());
});

router.post('/config', authMiddleware, (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { enabled, apiKey, token, defaultBoardId, projectMappings } = req.body;
    const partial = {};
    if (enabled !== undefined) partial.enabled = enabled;
    if (apiKey !== undefined) partial.apiKey = apiKey;
    if (token !== undefined) partial.token = token;
    if (defaultBoardId !== undefined) partial.defaultBoardId = defaultBoardId;
    if (projectMappings !== undefined) partial.projectMappings = projectMappings;

    trelloConfig.saveTrelloConfig(partial);
    res.json({ success: true, config: trelloConfig.getTrelloConfigForClient() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/test', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    if (req.body.apiKey && req.body.token) {
      trelloConfig.saveTrelloConfig({
        apiKey: req.body.apiKey,
        token: req.body.token
      });
    }
    const result = await trelloService.testConnection();
    res.json(result);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get('/boards', authMiddleware, async (req, res) => {
  try {
    const boards = await trelloService.getBoards();
    res.json(boards);
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

router.get('/boards/:boardId', authMiddleware, async (req, res) => {
  try {
    const detail = await trelloService.getBoardDetail(req.params.boardId);
    res.json(detail);
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const summary = trelloConfig.getTrelloSummary();
    if (!summary.configured) {
      return res.json({
        connected: false,
        configured: false,
        boards: [],
        summary: { boardCount: 0 }
      });
    }
    const data = await trelloService.getDashboard(req.query.boardId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/boards/:boardId/lists', authMiddleware, async (req, res) => {
  try {
    const lists = await trelloService.getBoardLists(req.params.boardId);
    res.json(lists);
  } catch (err) {
    res.status(err.message.includes('not configured') ? 503 : 500).json({ error: err.message });
  }
});

router.post('/sync/:projectKey/:bugId', authMiddleware, async (req, res) => {
  try {
    const bug = await storage.getBugById(req.params.bugId);
    if (!bug) return res.status(404).json({ error: 'Bug not found' });

    const project = await trelloSyncService.getProjectForBug(storage, req.params.projectKey);
    if (!project?.trello?.boardId) {
      return res.status(400).json({ error: 'Trello is not configured for this project' });
    }

    const result = await trelloSyncService.syncBugToTrello(bug, project);
    const refreshed = await storage.getBugById(req.params.bugId);
    res.json({ ...result, bug: refreshed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/webhook-url', authMiddleware, (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  res.json({ callbackUrl: trelloSyncService.getWebhookCallbackUrl() });
});

router.post('/cards', authMiddleware, async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, desc, idList, due } = req.body;
  if (!name || !idList) {
    return res.status(400).json({ error: 'name and idList are required' });
  }

  try {
    const card = await trelloService.createCard({ name, desc, idList, due });
    res.status(201).json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
