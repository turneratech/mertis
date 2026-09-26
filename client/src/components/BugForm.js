import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import MultiSelect from './MultiSelect';
import FileUpload from './FileUpload';
import AttachmentList from './AttachmentList';
import DescriptionEditor from './DescriptionEditor';
import { useAuth } from '../App';
import { useLicense } from '../hooks/useLicense';
import { PulseStrip } from '../pulse/PulseStrip';
import { clearPendingFiles } from '../utils/pendingAttachments';

function BugForm() {
  const { projectKey, bugId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(bugId);
  const { license, getLimitInfo, isAtLimit, promptLimitUpgrade, getLimitWarning } = useLicense();
  const bugLimit = getLimitInfo('bugs');
  const atBugLimit = !isEditing && isAtLimit('bugs');
  // Only warn while creating; editing an existing bug does not consume a slot.
  const bugWarning = !isEditing ? getLimitWarning('bugs') : null;
  const maxMB = license?.limits?.maxAttachmentSizeMB;
  const maxAttachmentBytes = maxMB != null ? maxMB * 1024 * 1024 : 25 * 1024 * 1024;
  const maxAttachmentLabel = maxMB != null ? `${maxMB}MB` : '25MB';
  const [bugReporter, setBugReporter] = useState(''); 
  // Check if user can delete bugs/comments (admin/godmode only)
  const canDelete = user && (user.role === 'admin' || user.role === 'godmode');
  
  // Check if user can edit bug type (admin, godmode, reporter, or when creating new bug)
  const canEditType = !isEditing || (user && (user.role === 'admin' || user.role === 'godmode' || user.username === bugReporter));
  
  const [users, setUsers] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const fileUploadRef = useRef(null);
  const descriptionEditorRef = useRef(null);

  // Activity log and comments state
  const [activityLog, setActivityLog] = useState([]);
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const commentsPerPage = 10;
  const [trelloCardUrl, setTrelloCardUrl] = useState('');
  const [trelloSyncing, setTrelloSyncing] = useState(false);
  const [trelloMsg, setTrelloMsg] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client: '',
    module: '',
    environment: 'Development',
    severity: 'Medium',
    priority: 'Medium',
    status: 'Open',
    assignee: '',
    targetFixVersion: '',
    dueSLA: '',
    attachmentLinks: '',
    qaOwner: '',
    qaStatus: 'Not Started',
    closureReason: '',
    arb: [],
    bugType: 'Bug'
  });

  useEffect(() => {
    fetchInitialData();
  }, [projectKey, bugId]);

  useEffect(() => () => {
    if (!isEditing) clearPendingFiles();
  }, [isEditing]);

  const fetchInitialData = async () => {
    try {
      const usersRes = await axios.get('/api/auth/users');
      setUsers(usersRes.data);

      const projectsRes = await axios.get('/api/projects');
      const proj = projectsRes.data.find(p => p.key.toLowerCase() === projectKey.toLowerCase());
      setProject(proj);

      if (isEditing) {
        const bugRes = await axios.get(`/api/bugs/${projectKey}/${bugId}`);
        const bugData = bugRes.data;
        
        setFormData({
          title: bugData.title || '',
          description: bugData.description || '',
          client: bugData.client || '',
          module: bugData.module || '',
          environment: bugData.environment || 'Development',
          severity: bugData.severity || 'Medium',
          priority: bugData.priority || 'Medium',
          status: bugData.status || 'Open',
          assignee: bugData.assignee || '',
          targetFixVersion: bugData.targetFixVersion || '',
          dueSLA: bugData.dueSLA || '',
          attachmentLinks: bugData.attachmentLinks || '',
          qaOwner: bugData.qaOwner || '',
          qaStatus: bugData.qaStatus || 'Not Started',
          closureReason: bugData.closureReason || '',
          arb: bugData.arb || [],
          bugType: bugData.bugType || 'Bug'
        });
        
        setBugReporter(bugData.reporter || '');
        setTrelloCardUrl(bugData.trelloCardUrl || '');
        
        // Set activity log
        setActivityLog(bugData.activityLog || []);
        
        // Try to get attachments from bug data first
        let existingAttachments = bugData.attachments ? 
          (typeof bugData.attachments === 'string' ? JSON.parse(bugData.attachments) : bugData.attachments) : [];
        
        // If no attachments in bug data, fetch from attachments API
        if (existingAttachments.length === 0) {
          try {
            const attachRes = await axios.get(`/api/attachments/${bugId}`);
            if (attachRes.data && attachRes.data.attachments) {
              existingAttachments = attachRes.data.attachments;
            }
          } catch (attachErr) {
            console.log('Could not fetch attachments:', attachErr.message);
          }
        }
        
        setAttachments(existingAttachments);
        
      } else if (proj) {
        setFormData(prev => ({
          ...prev,
          client: proj.client || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      setError('Failed to load data');
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

  const projectTrelloEnabled = (() => {
    if (!project?.trelloBoardId) return false;
    try {
      const cfg = JSON.parse(project.trelloConfigJson || '{}');
      return cfg.syncEnabled !== false;
    } catch {
      return true;
    }
  })();

  const handleTrelloSync = async () => {
    if (!isEditing) return;
    setTrelloSyncing(true);
    setTrelloMsg('');
    try {
      const res = await axios.post(`/api/trello/sync/${projectKey}/${bugId}`);
      if (res.data.bug?.trelloCardUrl) {
        setTrelloCardUrl(res.data.bug.trelloCardUrl);
      }
      setTrelloMsg(res.data.created ? 'Card created in Trello' : 'Synced to Trello');
    } catch (err) {
      setTrelloMsg(err.response?.data?.error || 'Sync failed');
    } finally {
      setTrelloSyncing(false);
    }
  };

  const handleUploadComplete = (uploadedFiles) => {
    const list = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];
    setAttachments(prev => [...prev, ...list]);
  };

  const handleInsertDescriptionLink = (attachment) => {
    descriptionEditorRef.current?.insertAttachmentLink(attachment);
  };

  const handleDescriptionChange = (html) => {
    setFormData(prev => ({ ...prev, description: html }));
  };

  // Called when attachment is deleted
  const handleDeleteAttachment = (deletedAttachment) => {
    setAttachments(prev => prev.filter(a => a.id !== deletedAttachment.id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const finalDescription = descriptionEditorRef.current?.getDescription?.() ?? formData.description;
      const payload = { ...formData, description: finalDescription };

      if (isEditing) {
        await axios.put(`/api/bugs/${projectKey}/${bugId}`, payload);
        navigate(`/projects/${projectKey}/bugs/${bugId}`);
      } else {
        const res = await axios.post(`/api/bugs/${projectKey}`, payload);
        const newBugId = res.data.bugId;

        await fileUploadRef.current?.flushPending(newBugId);

        if (descriptionEditorRef.current?.hasPendingImages?.()) {
          await descriptionEditorRef.current.flushPendingImages(newBugId);
        }

        const descriptionAfterFlush = descriptionEditorRef.current?.getDescription?.() ?? finalDescription;
        if (descriptionAfterFlush !== finalDescription) {
          await axios.put(`/api/bugs/${projectKey}/${newBugId}`, {
            ...payload,
            description: descriptionAfterFlush
          });
        }

        navigate(`/projects/${projectKey}/bugs/${newBugId}/edit`);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to save bug');
      setSubmitting(false);
    }
  };

  // Handle adding a comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await axios.post(`/api/bugs/${projectKey}/${bugId}/comment`, { comment });
      // Update activity log with the response
      setActivityLog(res.data.activityLog || []);
      setComment('');
      setCurrentPage(1); // Reset to first page after adding comment
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const res = await axios.delete(`/api/bugs/${projectKey}/${bugId}/comment/${commentId}`);
      setActivityLog(res.data.activityLog || []);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setError('Failed to delete comment');
    }
  };

  const handleDeleteBug = async () => {
    if (!window.confirm('Are you sure you want to delete this bug? This action cannot be undone.')) return;

    try {
      await axios.delete(`/api/bugs/${projectKey}/${bugId}`);
      navigate(`/projects/${projectKey}/bugs`);
    } catch (error) {
      console.error('Error deleting bug:', error);
      setError('Failed to delete bug');
    }
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get initials for avatar
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Check if user can delete attachments
  const canDeleteAttachments = user?.role === 'admin' || user?.role === 'godmode' || user?.username === bugReporter;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link 
            to={`/projects/${projectKey}/bugs`} 
            className="btn btn-secondary btn-sm" 
            style={{ marginBottom: '0.5rem' }}
          >
            &#8592; Back
          </Link>
          <h1 className="page-title">
            {isEditing ? `Edit ${bugId}` : `New Bug in ${project?.name || projectKey}`}
          </h1>
          {isEditing ? (
            <PulseStrip
              projectKey={projectKey}
              bug={{
                status: formData.status,
                qaStatus: formData.qaStatus,
                qaOwner: formData.qaOwner,
                assignee: formData.assignee,
                arb: formData.arb
              }}
            />
          ) : null}
          {isEditing && projectTrelloEnabled && (
            <div style={{
              marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              {trelloCardUrl ? (
                <a
                  href={trelloCardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ background: 'rgba(0, 121, 191, 0.15)', borderColor: 'rgba(0, 121, 191, 0.4)' }}
                >
                  📋 Open in Trello
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTrelloSync}
                  disabled={trelloSyncing}
                >
                  {trelloSyncing ? 'Syncing...' : '📋 Sync to Trello'}
                </button>
              )}
              {trelloCardUrl && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTrelloSync}
                  disabled={trelloSyncing}
                >
                  {trelloSyncing ? 'Syncing...' : '↻ Re-sync'}
                </button>
              )}
              {trelloMsg && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{trelloMsg}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {atBugLimit ? (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          Bug limit reached ({bugLimit.current}/{bugLimit.max}). Upgrade to Team for more bugs.{' '}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => promptLimitUpgrade('bugs')}>
            View plans
          </button>
        </div>
      ) : bugWarning && (
        /* Bugs had no counter at all before this: the first signal a user got
           was the hard stop at 250/250. */
        <div
          className="warning-message"
          style={{
            marginBottom: '1rem',
            padding: '0.6rem 0.9rem',
            borderRadius: '6px',
            border: `1px solid ${bugWarning.level === 'critical' ? '#e67e22' : '#d9a441'}`,
            color: bugWarning.level === 'critical' ? '#e67e22' : '#8a6d3b'
          }}
        >
          {bugWarning.message} ({bugWarning.current}/{bugWarning.max}).{' '}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => promptLimitUpgrade('bugs')}>
            View plans
          </button>
        </div>
      )}

      <div className="card">
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Bug Type Selector - Professional header section */}
          <div className="bug-type-header">
            <div className="bug-type-selector">
              <label className="form-label" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>Type</label>
              <div className="type-toggle-group">
                {['Bug', 'Enhancement', 'Task', 'Feature'].map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`type-toggle-btn ${formData.bugType === type ? 'active' : ''} type-${type.toLowerCase()}`}
                    onClick={() => canEditType && setFormData({ ...formData, bugType: type })}
                    disabled={!canEditType && isEditing}
                    title={!canEditType && isEditing ? 'Only the reporter or admins can change the type' : `Mark as ${type}`}
                  >
                    <span className="type-icon">
                      {type === 'Bug' && '🐛'}
                      {type === 'Enhancement' && '✨'}
                      {type === 'Task' && '📋'}
                      {type === 'Feature' && '🚀'}
                    </span>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Owner Field - Only visible when editing */}
            {isEditing && bugReporter && (
              <div className="owner-display">
                <label className="form-label" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>Owner (Reporter)</label>
                <div className="owner-info">
                  <span className="owner-avatar">{bugReporter.charAt(0).toUpperCase()}</span>
                  <span className="owner-name">{bugReporter}</span>
                  <span className="owner-badge">Filed this {formData.bugType?.toLowerCase() || 'item'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              name="title"
              className="form-control"
              value={formData.title}
              onChange={handleChange}
              placeholder="Brief description of the bug"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <DescriptionEditor
              ref={descriptionEditorRef}
              value={formData.description}
              onChange={handleDescriptionChange}
              bugId={isEditing ? bugId : null}
              onAttachmentUploaded={handleUploadComplete}
              maxImageBytes={maxAttachmentBytes}
              maxImageLabel={maxAttachmentLabel}
              placeholder="Detailed description, steps to reproduce, expected vs actual behavior… Paste screenshots directly from clipboard."
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
              <label className="form-label">Module</label>
              <input
                type="text"
                name="module"
                className="form-control"
                value={formData.module}
                onChange={handleChange}
                placeholder="Application module"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Environment</label>
              <select
                name="environment"
                className="form-control"
                value={formData.environment}
                onChange={handleChange}
              >
                <option value="Development">Development</option>
                <option value="Staging">Staging</option>
                <option value="Production">Production</option>
                <option value="Testing">Testing</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Severity</label>
              <select
                name="severity"
                className="form-control"
                value={formData.severity}
                onChange={handleChange}
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                name="priority"
                className="form-control"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {isEditing && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  className="form-control"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                  <option value="Reopened">Reopened</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Assignee</label>
              <select
                name="assignee"
                className="form-control"
                value={formData.assignee}
                onChange={handleChange}
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.username}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">QA Owner</label>
              <select
                name="qaOwner"
                className="form-control"
                value={formData.qaOwner}
                onChange={handleChange}
              >
                <option value="">None</option>
                {users.map(u => (
                  <option key={u.id} value={u.username}>
                    {u.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">QA Status</label>
              <select
                name="qaStatus"
                className="form-control"
                value={formData.qaStatus}
                onChange={handleChange}
              >
                <option value="Not Started">Not Started</option>
                <option value="Testing">Testing</option>
                <option value="Passed">Passed</option>
                <option value="Failed">Failed</option>
              </select>
            </div>
          </div>

          {/* ARB Multi-Select */}
          <div className="form-group">
            <label className="form-label">Action Required By (ARB)</label>
            <MultiSelect
              options={users.map(u => u.username)}
              selected={formData.arb}
              onChange={(newArb) => setFormData({ ...formData, arb: newArb })}
              placeholder="Search and select users..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Target Fix Version</label>
              <input
                type="text"
                name="targetFixVersion"
                className="form-control"
                value={formData.targetFixVersion}
                onChange={handleChange}
                placeholder="e.g., v1.2.0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Due/SLA Date</label>
              <input
                type="date"
                name="dueSLA"
                className="form-control"
                value={formData.dueSLA}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">External Links</label>
            <textarea
              name="attachmentLinks"
              className="form-control"
              value={formData.attachmentLinks}
              onChange={handleChange}
              placeholder="Paste URLs or references to related documents"
              rows="2"
            />
          </div>

          {/* ATTACHMENTS SECTION */}
          <div className="attachments-section">
            <label className="form-label">
              Attachments
              {attachments.length > 0 && (
                <span className="attachment-count">{attachments.length}</span>
              )}
            </label>
            
            {/* Show existing attachments */}
            <AttachmentList
              bugId={bugId}
              attachments={attachments}
              onDelete={handleDeleteAttachment}
              canDelete={canDeleteAttachments}
            />
            
            {/* Upload button */}
            <FileUpload
              ref={fileUploadRef}
              bugId={isEditing ? bugId : null}
              onUploadComplete={handleUploadComplete}
              onInsertDescriptionLink={handleInsertDescriptionLink}
            />
          </div>

          {isEditing && formData.status === 'Closed' && (
            <div className="form-group">
              <label className="form-label">Closure Reason</label>
              <select
                name="closureReason"
                className="form-control"
                value={formData.closureReason}
                onChange={handleChange}
              >
                <option value="">Select reason</option>
                <option value="Fixed">Fixed</option>
                <option value="Won't Fix">Won't Fix</option>
                <option value="Duplicate">Duplicate</option>
                <option value="Cannot Reproduce">Cannot Reproduce</option>
                <option value="By Design">By Design</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting || atBugLimit}>
                {submitting ? 'Saving...' : (isEditing ? 'Update Bug' : 'Create Bug')}
              </button>
              <Link 
                to={`/projects/${projectKey}/bugs`} 
                className="btn btn-secondary"
              >
                Cancel
              </Link>
            </div>
            {isEditing && canDelete && (
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleDeleteBug}
              >
                Delete Bug
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ACTIVITY LOG & COMMENTS SECTION - Only show when editing */}
      {isEditing && (
        <div className="activity-section" style={{ marginTop: '2rem' }}>
          <h2>Activity Log & Comments</h2>
          <div className="card">
            {/* Comment Form - at the top */}
            <form className="comment-form" onSubmit={handleAddComment} style={{ marginBottom: '1.5rem' }}>
              <textarea
                className="form-control comment-textarea"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submittingComment || !comment.trim()}
              >
                {submittingComment ? 'Posting...' : 'Post'}
              </button>
            </form>

            {/* Previous Comments/Activity - Latest to Oldest with Pagination */}
            <div className="activity-list">
              {activityLog.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p>No activity yet. Add a comment above to start the conversation.</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const reversedLog = [...activityLog].reverse(); // Latest to oldest
                    const totalPages = Math.ceil(reversedLog.length / commentsPerPage);
                    const startIdx = (currentPage - 1) * commentsPerPage;
                    const endIdx = startIdx + commentsPerPage;
                    const paginatedLog = reversedLog.slice(startIdx, endIdx);
                    
                    return (
                      <>
                        {paginatedLog.map((activity, idx) => (
                          <div key={activity.id || idx} className="activity-item">
                            <div className="activity-avatar">
                              {getInitials(activity.user)}
                            </div>
                            <div className="activity-content">
                              <div className="activity-header">
                                <span className="activity-user">{activity.user}</span>
                                <span className="activity-time">{formatDate(activity.timestamp)}</span>
                                {/* Delete button for comments - admin/godmode only */}
                                {canDelete && activity.action === 'comment' && activity.id && (
                                  <button
                                    type="button"
                                    className="btn-delete-comment"
                                    onClick={() => handleDeleteComment(activity.id)}
                                    title="Delete comment"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                              <div className={`activity-message ${activity.action === 'comment' ? 'comment' : ''} ${activity.action === 'commit' ? 'commit' : ''}`}>
                                {activity.action === 'comment' ? (
                                  <span style={{ whiteSpace: 'pre-wrap' }}>{activity.message}</span>
                                ) : activity.action === 'commit' ? (
                                  <span dangerouslySetInnerHTML={{ 
                                    __html: activity.message.replace(
                                      /(https?:\/\/[^\s]+)/g, 
                                      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
                                    )
                                  }} />
                                ) : (
                                  <em>{activity.message}</em>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="pagination-controls" style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            gap: '1rem', 
                            marginTop: '1rem',
                            padding: '1rem 0',
                            borderTop: '1px solid var(--border-color, #e0e0e0)'
                          }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                            >
                              ← Previous
                            </button>
                            <span style={{ 
                              display: 'flex', 
                              alignItems: 'center',
                              color: 'var(--text-secondary, #666)',
                              fontSize: '0.9rem'
                            }}>
                              Page {currentPage} of {totalPages}
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BugForm;
