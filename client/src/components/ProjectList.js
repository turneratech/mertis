import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { useLicense } from '../hooks/useLicense';

function ProjectList() {
  const { user } = useAuth();
  const { getLimitInfo, isAtLimit, promptLimitUpgrade, getLimitWarning } = useLicense();
  const projectLimit = getLimitInfo('projects');
  const atProjectLimit = isAtLimit('projects');
  const projectsWarning = getLimitWarning('projects');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectStats, setProjectStats] = useState({});

  // Check if user has elevated privileges (can create/edit projects)
  const hasElevatedPrivileges = user?.role === 'godmode' || user?.role === 'admin';

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      setProjects(res.data);
      
      // Fetch stats for each project
      const stats = {};
      for (const project of res.data) {
        try {
          const statsRes = await axios.get(`/api/bugs/stats/${project.key}`);
          stats[project.key] = statsRes.data;
        } catch (e) {
          stats[project.key] = { total: 0, open: 0, critical: 0 };
        }
      }
      setProjectStats(stats);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects ({projects.length})</h1>
          {projectLimit.max !== null && (
            <p style={{
              margin: '0.25rem 0 0',
              fontSize: '0.85rem',
              /* Amber once the limit is in sight, not only once it is hit. */
              color: atProjectLimit || projectsWarning ? '#e67e22' : '#666'
            }}>
              {projectLimit.current ?? projects.length}/{projectLimit.max} projects on Community plan
              {projectsWarning && !atProjectLimit ? ` — ${projectsWarning.message}` : ''}
            </p>
          )}
        </div>
        {hasElevatedPrivileges && !atProjectLimit && (
          <Link to="/projects/new" className="btn btn-primary">+ New Project</Link>
        )}
        {hasElevatedPrivileges && atProjectLimit && (
          <button type="button" className="btn btn-secondary" onClick={() => promptLimitUpgrade('projects')}>
            + New Project (limit reached)
          </button>
        )}
      </div>

      {atProjectLimit && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          Project limit reached. Upgrade to Team for more projects.{' '}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => promptLimitUpgrade('projects')}>
            View plans
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <h3>No projects found</h3>
          <p>
            {hasElevatedPrivileges 
              ? 'Create your first project to get started.'
              : 'You haven\'t been assigned to any projects yet.'}
          </p>
          {hasElevatedPrivileges && !atProjectLimit && (
            <Link to="/projects/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Create Project
            </Link>
          )}
        </div>
      ) : (
        <div className="project-grid">
          {projects.map(project => {
            const stats = projectStats[project.key] || { total: 0, open: 0, critical: 0 };
            return (
              <div key={project.id} className="project-card">
                <div className="project-card-top">
                  <div className="project-card-header">
                    <span className="project-key-large">{project.key}</span>
                    <span className={`badge ${project.status === 'active' ? 'badge-open' : 'badge-closed'}`}>
                      {project.status}
                    </span>
                  </div>
                  <h3 className="project-name">{project.name}</h3>
                  {project.description && (
                    <p className="project-description">{project.description}</p>
                  )}
                  {project.client && (
                    <p className="project-client">Client: {project.client}</p>
                  )}
                </div>

                <div className="project-card-stats">
                  <div className="project-stat">
                    <span className="project-stat-value">{stats.total}</span>
                    <span className="project-stat-label">Total</span>
                  </div>
                  <div className="project-stat">
                    <span className="project-stat-value text-warning">{stats.open}</span>
                    <span className="project-stat-label">Open</span>
                  </div>
                  <div className="project-stat">
                    <span className="project-stat-value text-purple">{stats.inProgress || 0}</span>
                    <span className="project-stat-label">In Progress</span>
                  </div>
                  <div className="project-stat">
                    <span className="project-stat-value text-danger">{stats.critical}</span>
                    <span className="project-stat-label">Critical</span>
                  </div>
                </div>

                <div className="project-card-footer">
                  <div className="project-members">
                    {project.members?.slice(0, 3).map((member, idx) => (
                      <span key={idx} className="member-avatar" title={member}>
                        {member.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {project.members?.length > 3 && (
                      <span className="member-more">+{project.members.length - 3}</span>
                    )}
                  </div>
                  <div className="project-card-actions">
                    <Link 
                      to={`/projects/${project.key}/bugs`} 
                      className="btn btn-primary btn-sm"
                    >
                      View Bugs
                    </Link>
                    {hasElevatedPrivileges && (
                      <Link 
                        to={`/projects/${project.id}/edit`} 
                        className="btn btn-secondary btn-sm"
                      >
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProjectList;
