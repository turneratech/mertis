import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';

function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await axios.get('/api/analytics/user-dashboard');
      setData(res.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!data) {
    return <div className="empty-state"><h3>Unable to load dashboard</h3></div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.username}!</h1>
        <p>Here's an overview of your bugs and projects</p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-value">{data.stats.assignedTotal}</div>
          <div className="stat-label">Assigned to Me</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{data.stats.assignedOpen}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-card" style={{ background: 'var(--bg-input)' }}>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>{data.stats.assignedInProgress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{data.stats.assignedResolved}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.stats.reportedTotal}</div>
          <div className="stat-label">Reported by Me</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.projectCount}</div>
          <div className="stat-label">My Projects</div>
        </div>
      </div>

      <Link to="/integrations/trello" className="integration-strip trello-strip">
        <span className="integration-strip-icon">📋</span>
        <div className="integration-strip-text">
          <strong>Trello Boards</strong>
          <span>View kanban workflows synced with your projects</span>
        </div>
        <span className="integration-strip-arrow">→</span>
      </Link>

      <div className="dashboard-grid">
        {/* My Projects */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">My Projects</h2>
            <Link to="/projects" className="btn btn-secondary btn-sm">View All</Link>
          </div>

          {data.projectSummaries.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <h3>No projects yet</h3>
              <p>You haven't been assigned to any projects.</p>
            </div>
          ) : (
            <div className="project-cards">
              {data.projectSummaries.slice(0, 6).map(project => (
                <Link 
                  key={project.projectId} 
                  to={`/projects/${project.projectKey}/bugs`}
                  className="project-card-mini"
                >
                  <div className="project-card-header">
                    <span className="project-key">{project.projectKey}</span>
                    <span className="project-name">{project.projectName}</span>
                  </div>
                  <div className="project-card-stats">
                    <span className="mini-stat">
                      <strong>{project.totalBugs}</strong> total
                    </span>
                    <span className="mini-stat open">
                      <strong>{project.openBugs}</strong> open
                    </span>
                    {project.criticalBugs > 0 && (
                      <span className="mini-stat critical">
                        <strong>{project.criticalBugs}</strong> critical
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Bug Activity */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Activity</h2>
            <Link to="/my-bugs" className="btn btn-secondary btn-sm">View All Bugs</Link>
          </div>

          {data.recentBugs.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <h3>No bugs yet</h3>
              <p>You don't have any bugs assigned or reported.</p>
            </div>
          ) : (
            <table className="bug-table compact">
              <thead>
                <tr>
                  <th>Bug</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBugs.map(bug => (
                  <tr key={bug.bugId}>
                    <td>
                      <Link 
                        to={`/projects/${bug.projectKey}/bugs/${bug.bugId}`} 
                        className="bug-id"
                      >
                        {bug.bugId}
                      </Link>
                      <div className="bug-title-small">{bug.title}</div>
                    </td>
                    <td>
                      <span className="project-badge">{bug.projectKey}</span>
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
                    <td className="date-cell">{formatDate(bug.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* My Status Distribution */}
      {data.myStatusDistribution.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>My Bug Status Distribution</h2>
          <div className="status-bars">
            {data.myStatusDistribution.map(status => (
              <div key={status.name} className="status-bar-item">
                <div className="status-bar-label">
                  <span>{status.name}</span>
                  <span>{status.value}</span>
                </div>
                <div className="status-bar-track">
                  <div 
                    className={`status-bar-fill status-${status.name.toLowerCase().replace(' ', '-')}`}
                    style={{ 
                      width: `${(status.value / data.stats.assignedTotal) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
