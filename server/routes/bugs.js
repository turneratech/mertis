/**
 * Bug Routes
 * Uses storage abstraction layer for data access
 * 
 * ROLES:
 * - godmode: Full access to all bugs, can delete bugs
 * - admin: Full access to all bugs, can delete bugs
 * - user: Can see/edit bugs in projects they are assigned to, or where they
 *   are assignee, reporter, QA owner, or in ARB
 * 
 * Visibility Rules:
 * - Godmode/Admin: Can see all bugs
 * - Regular User: Can see bugs in assigned projects, or where they are assignee,
 *   reporter, QA owner, or in ARB
 */

const express = require('express');
const storage = require('../storage');
const { query } = require('../storage/sqlDb')();
const { authMiddleware } = require('../middleware/auth');
const { checkLimit } = require('../middleware/licenseValidator');
const { sanitizeDescription } = require('../utils/sanitizeDescription');
const webhookService = require('../services/webhookService');
const trelloSyncService = require('../services/trelloSyncService');

const {
  hasElevatedPrivileges,
  getAccessibleProjectKeys,
  canUserAccessProject,
  canUserViewBug,
  filterBugsForUser
} = require('../utils/bugVisibility');

const maybeSyncBugToTrello = async (bug, projectKey) => {
  try {
    const project = await trelloSyncService.getProjectForBug(storage, projectKey);
    if (!project?.trello?.syncEnabled || !project.trello.autoSync) return bug;
    const result = await trelloSyncService.syncBugToTrello(bug, project);
    if (result.synced && result.created) {
      return await storage.getBugById(bug.bugId);
    }
  } catch (err) {
    console.warn('[Trello sync]', err.message);
  }
  return bug;
};

const router = express.Router();

// Helper function to get activity log with IDs (for deletion support)
const getActivityLogWithIds = async (bugId) => {
  return await query(
    `SELECT id, user, action, message, created_at as timestamp 
     FROM bug_activity 
     WHERE bug_id = ? 
     ORDER BY created_at ASC`,
    [bugId]
  );
};

// Get all bugs across all projects (for admin dashboard)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const isPrivileged = hasElevatedPrivileges(req.user);
    let bugs;
    
    try {
      bugs = await storage.getAllBugs();
    } catch (e) {
      console.error('getAllBugs error:', e.message);
      // Return empty array on error
      bugs = [];
    }
    
    // Filter for non-privileged users
    const accessibleProjectKeys = await getAccessibleProjectKeys(req.user, isPrivileged);
    bugs = filterBugsForUser(bugs, req.user.username, isPrivileged, accessibleProjectKeys);
    
    res.json(bugs);
  } catch (error) {
    console.error('Error fetching all bugs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bugs for a specific project
router.get('/project/:projectKey', authMiddleware, async (req, res) => {
  try {
    const isPrivileged = hasElevatedPrivileges(req.user);
    let bugs = await storage.getBugsByProject(req.params.projectKey);
    
    // Filter for non-privileged users
    const accessibleProjectKeys = await getAccessibleProjectKeys(req.user, isPrivileged);
    bugs = filterBugsForUser(bugs, req.user.username, isPrivileged, accessibleProjectKeys);
    
    res.json(bugs);
  } catch (error) {
    console.error('Error fetching bugs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bugs assigned to current user (includes ARB)
router.get('/my-bugs', authMiddleware, async (req, res) => {
  try {
    const username = req.user.username;
    const isPrivileged = hasElevatedPrivileges(req.user);
    
    if (isPrivileged) {
      try {
        const bugs = await storage.getAllBugs();
        return res.json(bugs);
      } catch (e) {
        console.error('getAllBugs failed, using getBugsByUser fallback:', e.message);
        const bugs = await storage.getBugsByUser(username);
        return res.json(bugs);
      }
    }
      
    // Regular user
    const assignedBugs = await storage.getBugsByUser(username);
    const bugMap = new Map();
    assignedBugs.forEach(bug => {
      if (bug.status !== 'Resolved' && bug.status !== 'Closed') { // ← and here
        bugMap.set(bug.bugId, bug);
      }
    });
    res.json(Array.from(bugMap.values()));
  } catch (error) {
    console.error('Error fetching user bugs:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Get stats for a project
router.get('/stats/:projectKey', authMiddleware, async (req, res) => {
  try {
    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessibleProjectKeys = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserAccessProject(req.params.projectKey, isPrivileged, accessibleProjectKeys)) {
      return res.status(403).json({ error: 'You do not have permission to view stats for this project' });
    }

    const stats = await storage.getBugStats(req.params.projectKey);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single bug
router.get('/:projectKey/:bugId', authMiddleware, async (req, res) => {
  try {
    const bug = await storage.getBugById(req.params.bugId);
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }
    
    // Check visibility
    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessibleProjectKeys = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserViewBug(bug, req.user.username, isPrivileged, accessibleProjectKeys)) {
      return res.status(403).json({ error: 'You do not have permission to view this bug' });
    }
    
    // Privileged users get activity row ids so a comment can be deleted. That
    // lookup is a raw SQL query, so it only exists on a SQL backend: on CSV the
    // log the storage layer already returned is the whole truth, and asking the
    // MySQL pool for it threw, which turned every bug detail page into a 500 for
    // exactly the accounts most likely to open one.
    if (isPrivileged && storage.isSqlStorage()) {
      bug.activityLog = await getActivityLogWithIds(req.params.bugId);
    }
    
    // Include user role in response for frontend permission checks
    bug.userRole = req.user.role;
    
    res.json(bug);
  } catch (error) {
    console.error('Error fetching bug:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new bug
router.post('/:projectKey', authMiddleware, checkLimit('bugs'), async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    
    // Verify project exists
    const project = await storage.getProjectByKey(projectKey);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessibleProjectKeys = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserAccessProject(projectKey, isPrivileged, accessibleProjectKeys)) {
      return res.status(403).json({ error: 'You do not have permission to create bugs in this project' });
    }

    // Generate bug ID
    const bugId = await storage.generateBugId(projectKey);
    
    const {
      title, description, client, module, environment,
      severity, priority, assignee, targetFixVersion,
      dueSLA, attachmentLinks, qaOwner, arb, bugType
    } = req.body;

    const bug = await storage.createBug({
      bugId,
      projectId: project.id,
      projectKey,
      title: title || '',
      description: sanitizeDescription(description || ''),
      client: client || project.client || '',
      module: module || '',
      environment: environment || 'Development',
      severity: severity || 'Medium',
      priority: priority || 'Medium',
      assignee: assignee || '',
      qaOwner: qaOwner || '',
      targetFixVersion: targetFixVersion || '',
      dueSLA: dueSLA || '',
      attachmentLinks: attachmentLinks || '',
      arb: arb || [],
      bugType: bugType || 'Bug'
    }, req.user.username);

    webhookService.dispatch('bug.created', { bug, projectKey, user: req.user.username }).catch(() => {});

    const syncedBug = await maybeSyncBugToTrello(bug, projectKey);
    res.status(201).json(syncedBug);
  } catch (error) {
    console.error('Error creating bug:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update bug
router.put('/:projectKey/:bugId', authMiddleware, async (req, res) => {
  try {
    const bug = await storage.getBugById(req.params.bugId);
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }
    
    // Check if user can edit (project members, privileged users, assignee, reporter, or in ARB)
    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessibleProjectKeys = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserViewBug(bug, req.user.username, isPrivileged, accessibleProjectKeys)) {
      return res.status(403).json({ error: 'You do not have permission to edit this bug' });
    }

    const {
      title, description, client, module, environment,
      severity, priority, status, assignee, qaOwner, qaStatus,
      targetFixVersion, dueSLA, attachmentLinks, closureReason, arb, bugType
    } = req.body;

    // Only allow bugType changes by admin, godmode, or the original reporter
    const canEditType = isPrivileged || req.user.username === bug.reporter;
    
    // Helper to convert undefined to null (MySQL2 doesn't accept undefined)
    const nullIfUndefined = (val) => val === undefined ? null : val;
    
    const updated = await storage.updateBug(req.params.bugId, {
      title: nullIfUndefined(title),
      description: description !== undefined ? sanitizeDescription(description) : null,
      client: nullIfUndefined(client),
      module: nullIfUndefined(module),
      environment: nullIfUndefined(environment),
      severity: nullIfUndefined(severity),
      priority: nullIfUndefined(priority),
      status: nullIfUndefined(status),
      assignee: nullIfUndefined(assignee),
      qaOwner: nullIfUndefined(qaOwner),
      qaStatus: nullIfUndefined(qaStatus),
      targetFixVersion: nullIfUndefined(targetFixVersion),
      dueSLA: nullIfUndefined(dueSLA),
      attachmentLinks: nullIfUndefined(attachmentLinks),
      closureReason: nullIfUndefined(closureReason),
      arb: nullIfUndefined(arb),
      // Only update bugType if user has permission (null will preserve existing via COALESCE)
      bugType: canEditType ? nullIfUndefined(bugType) : null
    }, req.user.username);

    webhookService.dispatch('bug.updated', { bug: updated, bugId: req.params.bugId, user: req.user.username }).catch(() => {});

    const syncedBug = await maybeSyncBugToTrello(updated, req.params.projectKey);
    res.json(syncedBug);
  } catch (error) {
    console.error('Error updating bug:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment to bug
router.post('/:projectKey/:bugId/comment', authMiddleware, async (req, res) => {
  try {
    const bug = await storage.getBugById(req.params.bugId);
    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }
    
    // Check visibility before allowing comment
    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessibleProjectKeys = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserViewBug(bug, req.user.username, isPrivileged, accessibleProjectKeys)) {
      return res.status(403).json({ error: 'You do not have permission to comment on this bug' });
    }

    const updated = await storage.addBugComment(
      req.params.bugId,
      req.user.username,
      req.body.comment
    );

    webhookService.dispatch('bug.commented', {
      bugId: req.params.bugId,
      comment: req.body.comment,
      user: req.user.username
    }).catch(() => {});

    res.json(updated);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete bug (admin and godmode only)
router.delete('/:projectKey/:bugId', authMiddleware, async (req, res) => {
  try {
    // Only privileged users can delete bugs
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Only admins and super users can delete bugs' });
    }
    
    const deleted = await storage.deleteBug(req.params.bugId);
    if (!deleted) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    webhookService.dispatch('bug.deleted', {
      bugId: req.params.bugId,
      user: req.user.username
    }).catch(() => {});

    res.json({ message: 'Bug deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete comment (admin and godmode only)
router.delete('/:projectKey/:bugId/comment/:commentId', authMiddleware, async (req, res) => {
  try {
    // Only privileged users can delete comments
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Only admins and super users can delete comments' });
    }
    
    // Comment rows carry an id only on a SQL backend; the CSV log is an array
    // inside the bug row with nothing to address. Say so plainly instead of
    // letting the MySQL pool throw a 500 at a CSV install.
    if (!storage.isSqlStorage()) {
      return res.status(501).json({
        error: 'Deleting a comment needs a database. This install stores its activity log in CSV, where comments have no id to address.'
      });
    }

    // Delete comment from bug_activity table
    const result = await query(
      'DELETE FROM bug_activity WHERE id = ? AND bug_id = ?',
      [req.params.commentId, req.params.bugId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    // Return updated bug with activity log
    const updatedBug = await storage.getBugById(req.params.bugId);
    res.json(updatedBug);
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

