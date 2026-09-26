import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import { useLicense } from '../hooks/useLicense';

function UserManagement() {
  const { user: currentUser } = useAuth();
  const { getLimitInfo, isAtLimit, promptLimitUpgrade, getLimitWarning } = useLicense();
  const userLimit = getLimitInfo('users');
  const atUserLimit = isAtLimit('users');
  const usersWarning = getLimitWarning('users');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState('');
  const [resetPasswordData, setResetPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user'
  });

  // Check if current user is godmode
  const isGodMode = currentUser?.role === 'godmode';
  
  // Check if current user has elevated privileges
  const hasElevatedPrivileges = currentUser?.role === 'godmode' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, projectsRes] = await Promise.all([
        axios.get('/api/auth/users'),
        axios.get('/api/projects')
      ]);
      setUsers(usersRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation: Only godmode can create godmode/admin users
    if (isAdmin && formData.role !== 'user') {
      setError('Admins can only create regular user accounts');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Your session expired. Please log in again and retry.');
        return;
      }
      await axios.post('/api/auth/register', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      setFormData({ username: '', password: '', role: 'user' });
      fetchData();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleDelete = async (userId, userRole, username) => {
    // Prevent deletion of godmode users by non-godmode users
    if (userRole === 'godmode' && !isGodMode) {
      alert('Only super users can delete other super user accounts');
      return;
    }
    
    // Prevent deletion of the default admin by regular admins
    if (username === 'admin' && !isGodMode) {
      alert('The default admin account cannot be deleted');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await axios.delete(`/api/auth/users/${userId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const openProjectModal = (user) => {
    setSelectedUser(user);
    setShowProjectModal(true);
  };

  const handleProjectAssignment = async (projectId, isAssigned) => {
    if (!selectedUser) return;

    try {
      if (isAssigned) {
        await axios.delete(`/api/projects/${projectId}/members/${selectedUser.username}`);
      } else {
        await axios.post(`/api/projects/${projectId}/members`, {
          username: selectedUser.username
        });
      }
      fetchData();
    } catch (error) {
      console.error('Error updating project assignment:', error);
    }
  };

  const getUserProjects = (username) => {
    return projects.filter(p => p.members?.includes(username));
  };

  // Open reset password modal
  const openResetPasswordModal = (user) => {
    setSelectedUser(user);
    setResetPasswordData({ newPassword: '', confirmPassword: '' });
    setError('');
    setShowResetPasswordModal(true);
  };

  // Handle reset password form change
  const handleResetPasswordChange = (e) => {
    setResetPasswordData({
      ...resetPasswordData,
      [e.target.name]: e.target.value
    });
  };

  // Handle password reset submission
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (resetPasswordData.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await axios.put(`/api/auth/users/${selectedUser.id}/reset-password`, {
        newPassword: resetPasswordData.newPassword
      });
      
      alert(`Password reset successfully for ${selectedUser.username}`);
      setShowResetPasswordModal(false);
      setSelectedUser(null);
      setResetPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to reset password');
    }
  };

  // Get badge class for role
  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'godmode':
        return 'badge-godmode';
      case 'admin':
        return 'badge-critical';
      default:
        return 'badge-medium';
    }
  };

  // Get display name for role
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'godmode':
        return 'âš¡ GOD MODE';
      case 'admin':
        return 'Admin';
      default:
        return 'User';
    }
  };

  // Check if user can be deleted
  const canDeleteUser = (targetUser) => {
    // Godmode users can delete anyone except themselves
    if (isGodMode) {
      return targetUser.id !== currentUser.id;
    }
    // Admins can only delete regular users
    if (currentUser?.role === 'admin') {
      return targetUser.role === 'user' && targetUser.username !== 'admin';
    }
    return false;
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  const isAdmin = currentUser?.role === 'admin';

  const handleRoleSwitch = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const label = newRole === 'admin' ? 'promote to Admin' : 'demote to User';
    if (!window.confirm(`Are you sure you want to ${label} "${targetUser.username}"?`)) return;
    try {
      await axios.put(`/api/auth/users/${targetUser.id}/role`, { role: newRole });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to change role');
    }
  };

  // Promoting to God Mode is a TRANSFER: the current owner steps down to admin
  // in the same request. Say so plainly -- the person clicking is the one who
  // loses the role, which is not what "promote" usually implies.
  const handleTransferOwnership = async (targetUser) => {
    const confirmed = window.confirm(
      `Transfer ownership of this instance to "${targetUser.username}"?

`
      + `They become the God Mode owner. You become an admin and will no longer `
      + `be able to reset passwords or change roles.

`
      + `There is exactly one owner, and you cannot undo this yourself — only `
      + `the new owner can transfer it back.`
    );
    if (!confirmed) return;
    try {
      const res = await axios.put(`/api/auth/users/${targetUser.id}/role`, { role: 'godmode' });
      alert(res.data?.message || `Ownership transferred to ${targetUser.username}.`);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to transfer ownership');
    }
  };

  const canTransferOwnership = (targetUser) =>
    isGodMode && targetUser.id !== currentUser?.id && targetUser.role === 'admin';

  const canSwitchRole = (targetUser) => {
    if (!isGodMode) return false;
    if (targetUser.id === currentUser?.id) return false;
    return targetUser.role === 'user' || targetUser.role === 'admin';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management ({users.length})</h1>
          {userLimit.max !== null && (
            <p style={{
              margin: '0.25rem 0 0',
              fontSize: '0.85rem',
              /* Amber once the limit is in sight, not only once it is hit. */
              color: atUserLimit || usersWarning ? '#e67e22' : '#666'
            }}>
              {userLimit.current ?? users.length}/{userLimit.max} users on Community plan
              {usersWarning && !atUserLimit ? ` — ${usersWarning.message}` : ''}
            </p>
          )}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => (atUserLimit ? promptLimitUpgrade('users') : setShowModal(true))}
          disabled={atUserLimit}
          title={atUserLimit ? 'User limit reached — upgrade for unlimited users' : undefined}
        >
          + Add User
        </button>
      </div>

      {atUserLimit && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          User limit reached. Upgrade to Team for more users.{' '}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => promptLimitUpgrade('users')}>
            View plans
          </button>
        </div>
      )}

      <div className="card">
        <table className="user-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Projects</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const userProjects = getUserProjects(user.username);
              return (
                <tr key={user.id}>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>
                    <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {userProjects.length > 0 ? (
                        userProjects.map(p => (
                          <span key={p.id} className="project-badge">{p.key}</span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>No projects</span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openProjectModal(user)}
                      >
                        Assign Projects
                      </button>
                      {canSwitchRole(user) && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRoleSwitch(user)}
                          title={user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                          style={{ color: user.role === 'admin' ? 'var(--warning, #f59e0b)' : 'var(--success, #22c55e)' }}
                        >
                          {user.role === 'admin' ? '↓ Demote' : '↑ Promote'}
                        </button>
                      )}
                      {canTransferOwnership(user) && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTransferOwnership(user)}
                          title="Make this admin the God Mode owner. You become an admin."
                          style={{ color: 'var(--warning, #f59e0b)' }}
                        >
                          ⇄ Transfer ownership
                        </button>
                      )}

                      {isGodMode && user.id !== currentUser.id && (
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => openResetPasswordModal(user)}
                          title="Reset user password"
                        >
                          🔑 Reset Password
                        </button>
                      )}
                      {canDeleteUser(user) && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(user.id, user.role, user.username)}
                          title="Delete user"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add New User</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  name="username"
                  className="form-control"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  name="password"
                  className="form-control"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  name="role"
                  className="form-control"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="user">User</option>
                  {/* Only godmode users can create admin/godmode users */}
                  {isGodMode && (
                    <>
                      <option value="admin">Admin</option>
                      <option value="godmode">âš¡ God Mode (Super User)</option>
                    </>
                  )}
                </select>
                {!isGodMode && (
                  <small style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    Only super users can create admin accounts
                  </small>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Assignment Modal */}
      {showProjectModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Assign Projects to {selectedUser.username}</h2>
            <div className="project-assignment-list">
              {projects.map(project => {
                const isAssigned = project.members?.includes(selectedUser.username);
                return (
                  <label key={project.id} className="member-checkbox">
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={() => handleProjectAssignment(project.id, isAssigned)}
                    />
                    <span className="project-badge">{project.key}</span>
                    <span>{project.name}</span>
                  </label>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowProjectModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowResetPasswordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>🔑 Reset Password for {selectedUser.username}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              As a God Mode user, you can reset this user's password without knowing their current password.
            </p>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="form-group">
                <label className="form-label">New Password *</label>
                <input
                  type="password"
                  name="newPassword"
                  className="form-control"
                  value={resetPasswordData.newPassword}
                  onChange={handleResetPasswordChange}
                  placeholder="Enter new password (min 6 characters)"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="form-control"
                  value={resetPasswordData.confirmPassword}
                  onChange={handleResetPasswordChange}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetPasswordModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-warning">
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
