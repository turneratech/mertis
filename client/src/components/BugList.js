import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';

/**
 * Export needs the Authorization header, so it cannot be a plain link. Fetch the
 * file as a blob and hand it to the browser through a throwaway object URL.
 */
async function downloadExport(url, filename, setError) {
  try {
    const res = await axios.get(url, { responseType: 'blob' });
    const href = window.URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(href);
  } catch (err) {
    setError('Export failed. Try again, or ask an admin to run it.');
  }
}

function BugList({ showMyBugs = false }) {
  const { projectKey } = useParams();
  const { user: currentUser } = useAuth();
  const isElevated = currentUser?.role === 'admin' || currentUser?.role === 'godmode';
  const [bugs, setBugs] = useState([]);
  const [project, setProject] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    priority: '',
    search: '',
    bugType: '',
    projectKey: ''
  });

  useEffect(() => {
    fetchBugs();
    if (projectKey) {
      fetchProject();
    }
    if (showMyBugs) {
      fetchProjects();
    }
  }, [projectKey, showMyBugs]);

  const fetchProject = async () => {
    try {
      const res = await axios.get('/api/projects');
      const proj = res.data.find(p => p.key.toLowerCase() === projectKey.toLowerCase());
      setProject(proj);
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      setAllProjects(res.data.filter(p => p.status !== 'Archived' && p.status !== 'Closed'));
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchBugs = async () => {
    try {
      let res;
      if (showMyBugs) {
        res = await axios.get('/api/bugs/my-bugs');
      } else if (projectKey) {
        res = await axios.get(`/api/bugs/project/${projectKey}`);
      } else {
        res = await axios.get('/api/bugs/all');
      }
      setBugs(res.data);
    } catch (error) {
      console.error('Error fetching bugs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const filteredBugs = bugs.filter(bug => {
    if (filters.status && bug.status !== filters.status) return false;
    if (filters.severity && bug.severity !== filters.severity) return false;
    if (filters.priority && bug.priority !== filters.priority) return false;
    if (filters.bugType && bug.bugType !== filters.bugType) return false;
    if (filters.projectKey && (bug.projectKey || '').toUpperCase() !== filters.projectKey.toUpperCase()) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!bug.title?.toLowerCase().includes(search) &&
          !bug.bugId?.toLowerCase().includes(search) &&
          !bug.client?.toLowerCase().includes(search) &&
          !bug.module?.toLowerCase().includes(search) &&
          !bug.projectName?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading">Loading bugs...</div>;
  }

  const pageTitle = showMyBugs 
    ? 'My Bugs' 
    : project 
      ? `${project.name} - Bugs` 
      : 'All Bugs';

  return (
    <div>
      <div className="page-header">
        <div>
          {projectKey && (
            <Link to="/projects" className="btn btn-secondary btn-sm" style={{ marginBottom: '0.5rem' }}>
              &#8592; Back to Projects
            </Link>
          )}
          <h1 className="page-title">{pageTitle} ({filteredBugs.length})</h1>
        </div>
        {projectKey && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              title="Download every bug in this project as CSV"
              onClick={() => downloadExport(
                `/api/export?format=csv&project=${projectKey}`,
                `mertis-${projectKey}-${new Date().toISOString().slice(0, 10)}.csv`,
                setError
              )}
            >
              Export CSV
            </button>
            <Link to={`/projects/${projectKey}/bugs/new`} className="btn btn-primary">+ New Bug</Link>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: '8px',
            background: '#7f1d1d', color: '#fca5a5', fontSize: '0.9rem'
          }}
        >
          {error}
        </div>
      )}

      <div className="filters">
        <input
          type="text"
          name="search"
          className="form-control"
          placeholder="Search bugs..."
          value={filters.search}
          onChange={handleFilterChange}
        />
        {showMyBugs && allProjects.length > 0 && (
          <select
            name="projectKey"
            className="form-control"
            value={filters.projectKey}
            onChange={handleFilterChange}
          >
            <option value="">All Projects</option>
            {allProjects.map(p => (
              <option key={p.id} value={p.key}>{p.key} – {p.name}</option>
            ))}
          </select>
        )}
        <select
          name="status"
          className="form-control"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">All Status</option>
          <option value="Open">Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
          <option value="Reopened">Reopened</option>
        </select>
        <select
          name="severity"
          className="form-control"
          value={filters.severity}
          onChange={handleFilterChange}
        >
          <option value="">All Severity</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          name="priority"
          className="form-control"
          value={filters.priority}
          onChange={handleFilterChange}
        >
          <option value="">All Priority</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          name="bugType"
          className="form-control"
          value={filters.bugType}
          onChange={handleFilterChange}
        >
          <option value="">All Types</option>
          <option value="Bug">🐛 Bug</option>
          <option value="Enhancement">✨ Enhancement</option>
          <option value="Task">📋 Task</option>
          <option value="Feature">🚀 Feature</option>
        </select>
      </div>

      <div className="card">
        {filteredBugs.length === 0 ? (
          <div className="empty-state">
            <h3>No bugs found</h3>
            <p>
              {projectKey 
                ? 'Create your first bug for this project.'
                : 'Try adjusting your filters or create a new bug.'}
            </p>
          </div>
        ) : showMyBugs && isElevated ? (
          // Admin / Godmode My Bugs: grouped by project
          (() => {
            const grouped = {};
            filteredBugs.forEach(bug => {
              const key = bug.projectKey || 'Unknown';
              if (!grouped[key]) grouped[key] = { name: bug.projectName || key, bugs: [] };
              grouped[key].bugs.push(bug);
            });
            return Object.keys(grouped).sort().map(key => {
              const group = grouped[key];
              const openCount     = group.bugs.filter(b => b.status === 'Open' || b.status === 'Reopened').length;
              const inProgCount   = group.bugs.filter(b => b.status === 'In Progress').length;
              const resolvedCount = group.bugs.filter(b => b.status === 'Resolved').length;
              return (
                <div key={key} style={{ marginBottom: '1.5rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.65rem 1rem', background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Link to={`/projects/${key}/bugs`} className="project-badge">{key}</Link>
                      <strong style={{ fontSize: '0.9rem' }}>{group.name}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {group.bugs.length} bug{group.bugs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem' }}>
                      {openCount     > 0 && <span style={{ color: '#ef4444' }}>● {openCount} open</span>}
                      {inProgCount   > 0 && <span style={{ color: '#f97316' }}>● {inProgCount} in progress</span>}
                      {resolvedCount > 0 && <span style={{ color: '#22c55e' }}>● {resolvedCount} resolved</span>}
                    </div>
                  </div>
                  <table className="bug-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Severity</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                        <th>Created</th>
                        <th>Due/SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.bugs.map(bug => (
                        <tr key={bug.bugId}>
                          <td>
                            <Link to={`/projects/${bug.projectKey}/bugs/${bug.bugId}`} className="bug-id">
                              {bug.bugId}
                            </Link>
                          </td>
                          <td>
                            <span className={`bug-type-badge type-${(bug.bugType || 'Bug').toLowerCase()}`}>
                              {bug.bugType === 'Enhancement' && '✨'}
                              {bug.bugType === 'Task' && '📋'}
                              {bug.bugType === 'Feature' && '🚀'}
                              {(!bug.bugType || bug.bugType === 'Bug') && '🐛'}
                              {' '}{bug.bugType || 'Bug'}
                            </span>
                          </td>
                          <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bug.title}
                          </td>
                          <td>
                            <span className={`badge badge-${bug.status?.toLowerCase().replace(' ', '-')}`}>
                              {bug.status}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${bug.severity?.toLowerCase()}`}>
                              {bug.severity}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-${bug.priority?.toLowerCase()}`}>
                              {bug.priority}
                            </span>
                          </td>
                          <td>{bug.assignee || '-'}</td>
                          <td>{formatDate(bug.created)}</td>
                          <td>{bug.dueSLA || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            });
          })()
        ) : (
          // Standard flat table — unchanged
          <table className="bug-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Title</th>
                {!projectKey && <th>Project</th>}
                <th>Status</th>
                <th>Severity</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Created</th>
                <th>Due/SLA</th>
              </tr>
            </thead>
            <tbody>
              {filteredBugs.map(bug => (
                <tr key={bug.bugId}>
                  <td>
                    <Link 
                      to={`/projects/${bug.projectKey || projectKey}/bugs/${bug.bugId}`} 
                      className="bug-id"
                    >
                      {bug.bugId}
                    </Link>
                  </td>
                  <td>
                    <span className={`bug-type-badge type-${(bug.bugType || 'Bug').toLowerCase()}`}>
                      {bug.bugType === 'Enhancement' && '✨'}
                      {bug.bugType === 'Task' && '📋'}
                      {bug.bugType === 'Feature' && '🚀'}
                      {(!bug.bugType || bug.bugType === 'Bug') && '🐛'}
                      {' '}{bug.bugType || 'Bug'}
                    </span>
                  </td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bug.title}
                  </td>
                  {!projectKey && (
                    <td>
                      <Link 
                        to={`/projects/${bug.projectKey}/bugs`}
                        className="project-badge"
                      >
                        {bug.projectKey}
                      </Link>
                    </td>
                  )}
                  <td>
                    <span className={`badge badge-${bug.status?.toLowerCase().replace(' ', '-')}`}>
                      {bug.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${bug.severity?.toLowerCase()}`}>
                      {bug.severity}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${bug.priority?.toLowerCase()}`}>
                      {bug.priority}
                    </span>
                  </td>
                  <td>{bug.assignee || '-'}</td>
                  <td>{formatDate(bug.created)}</td>
                  <td>{bug.dueSLA || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default BugList;