/**
 * Project Routes
 * Uses storage abstraction layer for data access
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const storage = require('../storage');
const { authMiddleware } = require('../middleware/auth');
const { checkLimit } = require('../middleware/licenseValidator');
const webhookService = require('../services/webhookService');
const { parseTrelloConfig, serializeTrelloConfig } = require('../utils/trelloProject');
const trelloSyncService = require('../services/trelloSyncService');

const router = express.Router();

// Get all projects (filtered by user access for non-admins)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin' || req.user.role === 'godmode';
    const projects = await storage.getAllProjects(req.user.username, isAdmin);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single project
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const project = await storage.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new project (admin only)
router.post('/', authMiddleware, checkLimit('projects'), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'godmode') {
      return res.status(403).json({ error: 'Only admins can create projects' });
    }

    const { name, key, description, client, members } = req.body;
    
    if (!name || !key) {
      return res.status(400).json({ error: 'Name and key are required' });
    }

    const projectKey = key.toUpperCase();
    
    // Check for duplicate key
    const existing = await storage.getProjectByKey(projectKey);
    if (existing) {
      return res.status(400).json({ error: 'Project key already exists' });
    }

    const project = await storage.createProject({
      id: uuidv4(),
      name,
      key: projectKey,
      description: description || '',
      client: client || '',
      status: 'active',
      createdBy: req.user.username,
      members: members || [req.user.username]
    });

    webhookService.dispatch('project.created', { project, user: req.user.username }).catch(() => {});

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update project (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'godmode') {
      return res.status(403).json({ error: 'Only admins can update projects' });
    }

    const project = await storage.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const {
      name, description, client, status, members,
      githubRepoUrl, webhookSecret,
      trelloBoardId, trelloDefaultListId, trelloListMapping,
      trelloSyncEnabled, trelloAutoSync
    } = req.body;

    const existingTrello = parseTrelloConfig(project);
    const trelloFields = serializeTrelloConfig({
      boardId: trelloBoardId !== undefined ? trelloBoardId : existingTrello.boardId,
      defaultListId: trelloDefaultListId !== undefined ? trelloDefaultListId : existingTrello.defaultListId,
      listMapping: trelloListMapping !== undefined ? trelloListMapping : existingTrello.listMapping,
      syncEnabled: trelloSyncEnabled !== undefined ? trelloSyncEnabled : existingTrello.syncEnabled,
      webhookId: existingTrello.webhookId,
      autoSync: trelloAutoSync !== undefined ? trelloAutoSync : existingTrello.autoSync
    });

    let updated = await storage.updateProject(req.params.id, {
      name,
      description,
      client,
      status,
      members,
      githubRepoUrl,
      webhookSecret,
      ...trelloFields
    });

    const trelloCfg = parseTrelloConfig(updated);
    if (trelloCfg.syncEnabled && trelloCfg.boardId) {
      try {
        const reg = await trelloSyncService.registerProjectWebhook(updated);
        if (reg.webhookId && reg.webhookId !== trelloCfg.webhookId) {
          const withWebhook = serializeTrelloConfig({ ...trelloCfg, webhookId: reg.webhookId });
          updated = await storage.updateProject(req.params.id, withWebhook);
        }
      } catch (err) {
        console.warn('[Trello] Webhook registration failed:', err.message);
      }
    } else if (trelloSyncEnabled === false) {
      await trelloSyncService.unregisterProjectWebhook(updated).catch(() => {});
    }

    webhookService.dispatch('project.updated', { project: updated, user: req.user.username }).catch(() => {});

    res.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete project (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'godmode') {
      return res.status(403).json({ error: 'Only admins can delete projects' });
    }

    const project = await storage.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const deleted = await storage.deleteProject(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }

    webhookService.dispatch('project.deleted', { projectId: req.params.id, user: req.user.username }).catch(() => {});

    res.json({ message: 'Project deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add member to project (admin only)
router.post('/:id/members', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'godmode') {
      return res.status(403).json({ error: 'Only admins can manage project members' });
    }

    const { username } = req.body;
    const members = await storage.addProjectMember(req.params.id, username);
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member from project (admin only)
router.delete('/:id/members/:username', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'godmode') {
      return res.status(403).json({ error: 'Only admins can manage project members' });
    }

    const members = await storage.removeProjectMember(req.params.id, req.params.username);
    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
