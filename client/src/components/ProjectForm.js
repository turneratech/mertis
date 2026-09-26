import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { useLicense } from '../hooks/useLicense';

function ProjectForm() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getLimitInfo, isAtLimit, promptLimitUpgrade } = useLicense();
  const isEditing = Boolean(projectId);
  const projectLimit = getLimitInfo('projects');
  const atProjectLimit = !isEditing && isAtLimit('projects');
  
  // Check if user has elevated privileges
  const hasElevatedPrivileges = user?.role === 'godmode' || user?.role === 'admin';
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    client: '',
    status: 'active',
    members: [],
    githubRepoUrl: '',
    webhookSecret: '',
    trelloBoardId: '',
    trelloDefaultListId: '',
    trelloListMapping: {},
    trelloSyncEnabled: false,
    trelloAutoSync: true
  });

  const [trelloBoards, setTrelloBoards] = useState([]);
  const [trelloLists, setTrelloLists] = useState([]);
  const [trelloConfigured, setTrelloConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  const MERTIS_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

  const parseTrelloFromProject = (data) => {
    let extra = {};
    try { extra = JSON.parse(data.trelloConfigJson || '{}'); } catch { /* ignore */ }
    return {
      trelloBoardId: data.trelloBoardId || '',
      trelloDefaultListId: extra.defaultListId || '',
      trelloListMapping: extra.listMapping || {},
      trelloSyncEnabled: extra.syncEnabled === true || !!data.trelloBoardId,
      trelloAutoSync: extra.autoSync !== false
    };
  };

  useEffect(() => {
    fetchUsers();
    if (isEditing) {
      fetchProject();
      fetchTrelloMeta();
    }
  }, [projectId]);

  const fetchTrelloMeta = async () => {
    try {
      const [statusRes, urlRes] = await Promise.all([
        axios.get('/api/trello/status'),
        axios.get('/api/trello/webhook-url').catch(() => ({ data: {} }))
      ]);
      setTrelloConfigured(statusRes.data.configured);
      setWebhookUrl(urlRes.data.callbackUrl || '');
      if (statusRes.data.configured) {
        const boardsRes = await axios.get('/api/trello/boards');
        setTrelloBoards(boardsRes.data);
      }
    } catch { /* Trello optional */ }
  };

  const loadTrelloLists = async (boardId) => {
    if (!boardId) { setTrelloLists([]); return; }
    try {
      const res = await axios.get(`/api/trello/boards/${boardId}/lists`);
      setTrelloLists(res.data);
    } catch { setTrelloLists([]); }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users');
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchProject = async () => {
    try {
      const res = await axios.get(`/api/projects/${projectId}`);
      setFormData({
        name: res.data.name || '',
        key: res.data.key || '',
        description: res.data.description || '',
        client: res.data.client || '',
        status: res.data.status || 'active',
        members: res.data.members || [],
        githubRepoUrl: res.data.githubRepoUrl || '',
        webhookSecret: res.data.webhookSecret || '',
        ...parseTrelloFromProject(res.data)
      });
      if (res.data.trelloBoardId) {
        loadTrelloLists(res.data.trelloBoardId);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Auto-generate key from name if not editing and key field not touched
      ...(name === 'name' && !isEditing ? {
        key: value.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5)
      } : {})
    }));
  };

  const handleMemberToggle = (username) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.includes(username)
        ? prev.members.filter(m => m !== username)
        : [...prev.members, username]
    }));
  };

  const handleTrelloBoardChange = (e) => {
    const boardId = e.target.value;
    setFormData(prev => ({
      ...prev,
      trelloBoardId: boardId,
      trelloDefaultListId: '',
      trelloListMapping: {}
    }));
    loadTrelloLists(boardId);
  };

  const handleListMappingChange = (status, listId) => {
    setFormData(prev => ({
      ...prev,
      trelloListMapping: { ...prev.trelloListMapping, [status]: listId }
    }));
  };

  const generateWebhookSecret = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const secret = 'whsec_' + Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    setFormData(prev => ({ ...prev, webhookSecret: secret }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isEditing) {
        await axios.put(`/api/projects/${projectId}`, formData);
        navigate(`/projects/${projectId}`);
      } else {
        const res = await axios.post('/api/projects', formData);
        navigate(`/projects/${res.data.key}/bugs`);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save project');
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete project "${formData.name}"? This action cannot be undone and will also delete all bugs associated with this project.`)) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await axios.delete(`/api/projects/${projectId}`);
      navigate('/projects');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete project');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Edit Project' : 'Create New Project'}</h1>
      </div>

      {!isEditing && atProjectLimit && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          Project limit reached ({projectLimit.current}/{projectLimit.max}). Upgrade to Team for more projects.{' '}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => promptLimitUpgrade('projects')}>
            View plans
          </button>
        </div>
      )}

      <div className="card">
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                name="name"
                className="form-control"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Mertis Mobile App"
                required
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Project Key *</label>
              <input
                type="text"
                name="key"
                className="form-control"
                value={formData.key}
                onChange={handleChange}
                placeholder="e.g., BTS"
                maxLength="5"
                required
                disabled={isEditing}
                style={{ textTransform: 'uppercase' }}
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                Used as prefix for bug IDs (e.g., BTS-0001)
              </small>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              name="description"
              className="form-control"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of the project..."
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client</label>
              <input
                type="text"
                name="client"
                className="form-control"
                value={formData.client}
                onChange={handleChange}
                placeholder="Client name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                name="status"
                className="form-control"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="on-hold">On Hold</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Team Members</label>
            <div className="member-selector">
              {users.map(user => (
                <label key={user.id} className="member-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.members.includes(user.username)}
                    onChange={() => handleMemberToggle(user.username)}
                  />
                  <span className="member-avatar small">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                  <span>{user.username}</span>
                  <span className="member-role">({user.role})</span>
                </label>
              ))}
            </div>
          </div>

          {/* GitHub Integration Section - Only show when editing */}
          {isEditing && (
            <div className="github-integration-section" style={{ 
              marginTop: '2rem', 
              paddingTop: '1.5rem', 
              borderTop: '1px solid var(--border)' 
            }}>
              <h3 style={{ 
                fontSize: '1rem', 
                marginBottom: '1rem', 
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>ðŸ”—</span> GitHub Integration
              </h3>
              
              <div className="form-group">
                <label className="form-label">GitHub Repository URL</label>
                <input
                  type="url"
                  name="githubRepoUrl"
                  className="form-control"
                  value={formData.githubRepoUrl}
                  onChange={handleChange}
                  placeholder="https://github.com/username/repository.git"
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Link this project to a GitHub repository for automatic commit tracking
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Webhook Secret</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    name="webhookSecret"
                    className="form-control"
                    value={formData.webhookSecret}
                    onChange={handleChange}
                    placeholder="Enter a secure secret key"
                    style={{ fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={generateWebhookSecret}
                    title="Generate random secret"
                  >
                    Generate
                  </button>
                </div>
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Use this secret when configuring the webhook in GitHub
                </small>
              </div>

              {formData.githubRepoUrl && formData.webhookSecret && (
                <div style={{ 
                  background: 'var(--bg-input)', 
                  borderRadius: '8px', 
                  padding: '1rem',
                  marginTop: '1rem'
                }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    ðŸ“‹ GitHub Webhook Setup Instructions
                  </h4>
                  <ol style={{ 
                    fontSize: '0.85rem', 
                    color: 'var(--text-secondary)', 
                    paddingLeft: '1.25rem',
                    margin: 0,
                    lineHeight: '1.8'
                  }}>
                    <li>Go to your repository: <a href={formData.githubRepoUrl.replace('.git', '')} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>{formData.githubRepoUrl.replace('.git', '')}</a></li>
                    <li>Navigate to <strong>Settings â†’ Webhooks â†’ Add webhook</strong></li>
                    <li>Payload URL: <code style={{ background: 'var(--bg-dark)', padding: '0.2rem 0.4rem', borderRadius: '4px', userSelect: 'all' }}>{window.location.origin}/api/webhooks/github</code></li>
                    <li>Content type: <code style={{ background: 'var(--bg-dark)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>application/json</code></li>
                    <li>Secret: <code style={{ background: 'var(--bg-dark)', padding: '0.2rem 0.4rem', borderRadius: '4px', userSelect: 'all' }}>{formData.webhookSecret}</code></li>
                    <li>Select events: <strong>Just the push event</strong></li>
                    <li>Check <strong>Active</strong> and save</li>
                  </ol>
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    background: 'rgba(79, 70, 229, 0.1)', 
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}>
                    <strong>Commit Message Format:</strong><br/>
                    <code style={{ color: 'var(--primary)' }}>{formData.key}-0001: Your message - Author: username</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trello Integration Section */}
          {isEditing && trelloConfigured && (
            <div className="github-integration-section" style={{
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--border)'
            }}>
              <h3 style={{
                fontSize: '1rem',
                marginBottom: '1rem',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>📋</span> Trello Integration
              </h3>

              <div className="form-group">
                <label className="form-label">
                  <input
                    type="checkbox"
                    checked={formData.trelloSyncEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, trelloSyncEnabled: e.target.checked }))}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Enable Trello sync for this project
                </label>
              </div>

              {formData.trelloSyncEnabled && (
                <>
                  <div className="form-group">
                    <label className="form-label">Trello Board</label>
                    <select
                      className="form-control"
                      value={formData.trelloBoardId}
                      onChange={handleTrelloBoardChange}
                    >
                      <option value="">— Select board —</option>
                      {trelloBoards.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {formData.trelloBoardId && trelloLists.length > 0 && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Default List (new cards)</label>
                        <select
                          className="form-control"
                          value={formData.trelloDefaultListId}
                          onChange={(e) => setFormData(prev => ({ ...prev, trelloDefaultListId: e.target.value }))}
                        >
                          <option value="">— Auto-detect —</option>
                          {trelloLists.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Status → List Mapping</label>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {MERTIS_STATUSES.map((status) => (
                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ minWidth: '110px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{status}</span>
                              <select
                                className="form-control"
                                value={formData.trelloListMapping[status] || ''}
                                onChange={(e) => handleListMappingChange(status, e.target.value)}
                                style={{ flex: 1 }}
                              >
                                <option value="">— Auto —</option>
                                {trelloLists.map((l) => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          <input
                            type="checkbox"
                            checked={formData.trelloAutoSync}
                            onChange={(e) => setFormData(prev => ({ ...prev, trelloAutoSync: e.target.checked }))}
                            style={{ marginRight: '0.5rem' }}
                          />
                          Auto-sync bugs to Trello on create/update
                        </label>
                      </div>

                      {webhookUrl && (
                        <div style={{
                          background: 'var(--bg-input)',
                          borderRadius: '8px',
                          padding: '1rem',
                          marginTop: '0.5rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)'
                        }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Two-way sync webhook</strong>
                          <p style={{ margin: '0.5rem 0' }}>
                            Saving this project registers a Trello webhook automatically. Callback URL:
                          </p>
                          <code style={{ background: 'var(--bg-dark)', padding: '0.2rem 0.4rem', borderRadius: '4px', userSelect: 'all', wordBreak: 'break-all' }}>
                            {webhookUrl}
                          </code>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting || deleting || atProjectLimit}>
                {submitting ? 'Saving...' : (isEditing ? 'Update Project' : 'Create Project')}
              </button>
              <Link to="/projects" className="btn btn-secondary">
                Cancel
              </Link>
            </div>
            {isEditing && hasElevatedPrivileges && (
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleDelete}
                disabled={submitting || deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Project'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProjectForm;

