/**
 * Storage Interface Definition
 * 
 * This file documents the interface that both MySQL and CSV storage implementations must follow.
 * It serves as a contract for the data access layer.
 * 
 * All methods are async and return Promises.
 */

const StorageInterface = {
  // ==================== USERS ====================
  
  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  getUserById: async (id) => {},
  
  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Promise<Object|null>} User object or null
   */
  getUserByUsername: async (username) => {},
  
  /**
   * Get all users
   * @returns {Promise<Array>} Array of user objects
   */
  getAllUsers: async () => {},
  
  /**
   * Create a new user
   * @param {Object} userData - { id, username, password, email, role }
   * @returns {Promise<Object>} Created user object
   */
  createUser: async (userData) => {},
  
  /**
   * Delete a user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success status
   */
  deleteUser: async (id) => {},
  
  // ==================== PROJECTS ====================
  
  /**
   * Get all projects (optionally filtered by user access)
   * @param {string|null} username - If provided, filter by user access (null for admin = all)
   * @param {boolean} isAdmin - Whether the requesting user is admin
   * @returns {Promise<Array>} Array of project objects with members
   */
  getAllProjects: async (username, isAdmin) => {},
  
  /**
   * Get project by ID
   * @param {string} id - Project ID
   * @returns {Promise<Object|null>} Project object with members or null
   */
  getProjectById: async (id) => {},
  
  /**
   * Get project by key
   * @param {string} key - Project key (e.g., 'SM', 'RM')
   * @returns {Promise<Object|null>} Project object or null
   */
  getProjectByKey: async (key) => {},
  
  /**
   * Create a new project
   * @param {Object} projectData - { id, name, key, description, client, status, createdBy, members }
   * @returns {Promise<Object>} Created project object
   */
  createProject: async (projectData) => {},
  
  /**
   * Update a project
   * @param {string} id - Project ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated project object
   */
  updateProject: async (id, updates) => {},
  
  /**
   * Delete a project
   * @param {string} id - Project ID
   * @returns {Promise<boolean>} Success status
   */
  deleteProject: async (id) => {},
  
  /**
   * Add member to project
   * @param {string} projectId - Project ID
   * @param {string} username - Username to add
   * @returns {Promise<Array>} Updated members array
   */
  addProjectMember: async (projectId, username) => {},
  
  /**
   * Remove member from project
   * @param {string} projectId - Project ID
   * @param {string} username - Username to remove
   * @returns {Promise<Array>} Updated members array
   */
  removeProjectMember: async (projectId, username) => {},
  
  // ==================== BUGS ====================
  
  /**
   * Get all bugs across all projects
   * @param {number} limit - Maximum number of bugs to return
   * @returns {Promise<Array>} Array of bug objects with activity logs
   */
  getAllBugs: async (limit) => {},
  
  /**
   * Get bugs for a specific project
   * @param {string} projectKey - Project key
   * @returns {Promise<Array>} Array of bug objects
   */
  getBugsByProject: async (projectKey) => {},
  
  /**
   * Get bugs assigned to, reported by, or QA'd by a user
   * @param {string} username - Username
   * @returns {Promise<Array>} Array of bug objects
   */
  getBugsByUser: async (username) => {},
  
  /**
   * Get a single bug by ID
   * @param {string} bugId - Bug ID (e.g., 'SM-0001')
   * @returns {Promise<Object|null>} Bug object with activity log or null
   */
  getBugById: async (bugId) => {},
  
  /**
   * Generate next bug ID for a project
   * @param {string} projectKey - Project key
   * @returns {Promise<string>} New bug ID (e.g., 'SM-0001')
   */
  generateBugId: async (projectKey) => {},
  
  /**
   * Create a new bug
   * @param {Object} bugData - Bug data including projectId, projectKey, title, etc.
   * @param {string} reporter - Username of reporter
   * @returns {Promise<Object>} Created bug object
   */
  createBug: async (bugData, reporter) => {},
  
  /**
   * Update a bug
   * @param {string} bugId - Bug ID
   * @param {Object} updates - Fields to update
   * @param {string} updatedBy - Username making the update
   * @returns {Promise<Object>} Updated bug object
   */
  updateBug: async (bugId, updates, updatedBy) => {},
  
  /**
   * Delete a bug
   * @param {string} bugId - Bug ID
   * @returns {Promise<boolean>} Success status
   */
  deleteBug: async (bugId) => {},
  
  /**
   * Add comment to a bug
   * @param {string} bugId - Bug ID
   * @param {string} username - Commenter username
   * @param {string} comment - Comment text
   * @returns {Promise<Object>} Updated bug object
   */
  addBugComment: async (bugId, username, comment) => {},

  /**
   * Mark a bug as triaged (Pulse Pit → Strike). Only writes triaged_at.
   * @param {string} bugId
   * @param {string} timestampIso
   * @returns {Promise<Object|null>}
   */
  setTriagedAt: async (bugId, timestampIso) => {},

  listMissionsByProject: async (projectId) => {},
  listMissionLinksByProject: async (projectId) => {},
  getMissionById: async (id) => {},
  createMission: async (data) => {},
  claimMissionBug: async ({ missionId, bugId, addedBy }) => {},
  deleteMission: async (id) => {},
  listCalendarSources: async (username) => {},
  createCalendarSource: async (data) => {},
  deleteCalendarSource: async (id, username) => {},
  
  /**
   * Get bug statistics for a project
   * @param {string} projectKey - Project key
   * @returns {Promise<Object>} Stats object { total, open, inProgress, resolved, closed, critical, high }
   */
  getBugStats: async (projectKey) => {},
  
  // ==================== ANALYTICS ====================
  
  /**
   * Get comprehensive analytics for admin dashboard
   * @returns {Promise<Object>} Analytics data including stats, distributions, trends
   */
  getAdminAnalytics: async () => {},
  
  /**
   * Get user-specific dashboard data
   * @param {string} username - Username
   * @param {boolean} isAdmin - Whether user is admin
   * @returns {Promise<Object>} User dashboard data
   */
  getUserDashboard: async (username, isAdmin) => {},
  
  // ==================== SYSTEM ====================
  
  /**
   * Get storage type
   * @returns {string} 'mysql' or 'csv'
   */
  getStorageType: () => {},
  
  /**
   * Check if storage is connected/available
   * @returns {Promise<boolean>} Connection status
   */
  isConnected: async () => {},
  
  /**
   * Initialize storage (create tables/files if needed)
   * @returns {Promise<void>}
   */
  initialize: async () => {}
};

module.exports = StorageInterface;
