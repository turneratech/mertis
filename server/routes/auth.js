/**
 * Authentication Routes
 * Uses storage abstraction layer for data access
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const storage = require('../storage');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { checkLimit } = require('../middleware/licenseValidator');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await storage.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Register new user (admin only)
// godmode > admin > user. Used for every create/delete/promote decision.
const ROLE_RANK = { godmode: 3, admin: 2, user: 1 };

router.post('/register', authMiddleware, checkLimit('users'), async (req, res) => {
  try {
    if (req.user.role !== 'godmode' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create users' });
    }

    const { username, password, email, role } = req.body;

    // Never let a caller mint a role above their own. Without this an admin
    // could create a godmode account and log into it -- a one-step escalation
    // that made the whole hierarchy decorative. Creating a peer is allowed;
    // admins routinely need to appoint other admins.
    const requestedRole = role || 'user';
    if (!ROLE_RANK[requestedRole]) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (ROLE_RANK[requestedRole] > (ROLE_RANK[req.user.role] || 0)) {
      return res.status(403).json({
        error: `You do not have permission to create a ${requestedRole} user`
      });
    }
    // An instance has exactly one owner. Ownership moves by transfer, never by
    // minting a second godmode -- otherwise "who owns this install" has no answer.
    if (requestedRole === 'godmode') {
      return res.status(403).json({
        error: 'God Mode cannot be granted here. Transfer ownership from User Management instead.'
      });
    }

    // Check if username exists
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await storage.createUser({
      id: uuidv4(),
      username,
      password: hashedPassword,
      email: email || '',
      role: requestedRole
    });

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    const actorRole = req.user.role;
    if (actorRole !== 'godmode' && actorRole !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to delete users' });
    }
    const user = await storage.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    if ((ROLE_RANK[actorRole] || 0) <= (ROLE_RANK[user.role] || 0)) {
      return res.status(403).json({ error: 'You do not have permission to delete this user' });
    }

    const deleted = await storage.deleteUser(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await storage.getUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUserPassword(req.user.id, hashedPassword);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password (God Mode only)
router.put('/users/:id/reset-password', authMiddleware, async (req, res) => {
  try {
    // Only godmode users can reset passwords
    if (req.user.role !== 'godmode') {
      return res.status(403).json({ error: 'Only god mode users can reset passwords' });
    }

    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const targetUser = await storage.getUserById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent resetting own password (they should use change-password for that)
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'Use change password to update your own password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await storage.updateUserPassword(req.params.id, hashedPassword);

    console.log(`[God Mode] Password reset for user ${targetUser.username} by ${req.user.username}`);
    res.json({ message: `Password reset successfully for ${targetUser.username}` });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Switch user role (godmode only). Promoting to godmode transfers ownership.
router.put('/users/:id/role', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'godmode') {
      return res.status(403).json({ error: 'Only God Mode users can change roles' });
    }
    const { role } = req.body;
    if (!['user', 'admin', 'godmode'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const targetUser = await storage.getUserById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    // Promoting someone to God Mode TRANSFERS ownership: the current owner steps
    // down to admin in the same operation. Nobody can change their own role, so
    // this is the only way ownership can ever move -- and it keeps the invariant
    // that exactly one God Mode account exists.
    let transferredFrom = null;
    if (role === 'godmode') {
      await storage.updateUserRole(req.user.id, 'admin');
      transferredFrom = req.user.username;
    }

    const updatedUser = await storage.updateUserRole(req.params.id, role);
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      ...(transferredFrom ? {
        ownershipTransferred: true,
        previousOwner: transferredFrom,
        message: `Ownership transferred to ${updatedUser.username}. You are now an admin.`
      } : {})
    });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
