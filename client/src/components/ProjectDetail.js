import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { PulseProjectLink } from '../pulse/PulseStrip';

function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await axios.get(`/api/projects/${projectId}`);
      setProject(res.data);
      
      const statsRes = await axios.get(`/api/bugs/stats/${res.data.key}`);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/api/projects/${projectId}`);
      navigate('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (!project) {
    return (
      <div className="empty-state">
        <h3>Project not found</h3>
        <Link to="/projects" className="btn btn-primary">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/projects" className="btn btn-secondary btn-sm" style={{ marginBottom: '0.5rem' }}>
            ← Back to Projects
          </Link>
          <h1 className="page-title">{project.name}</h1>
          <PulseProjectLink projectKey={project.key} />
        </div>
        {user?.role === 'admin' && (
          <div className="header-actions">
            <Link to={`/projects/${projectId}/edit`} className="btn btn-secondary">Edit</Link>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        )}
      </div>

      <div className="detail-grid">
        <div className="detail-section">
          <h3>Project Info</h3>
          <div className="detail-item">
            <span className="detail-label">Key</span>
            <span className="detail-value project-key-large">{project.key}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <span className={`badge ${project.status === 'active' ? 'badge-open' : 'badge-closed'}`}>
              {project.status}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Client</span>
            <span className="detail-value">{project.client || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Created By</span>
            <span className="detail-value">{project.createdBy}</span>
          </div>
        </div>

        <div className="detail-section">
          <h3>Bug Statistics</h3>
          {stats ? (
            <>
              <div className="detail-item">
                <span className="detail-label">Total Bugs</span>
                <span className="detail-value">{stats.total}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Open</span>
                <span className="detail-value text-warning">{stats.open}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">In Progress</span>
                <span className="detail-value text-purple">{stats.inProgress}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Resolved</span>
                <span className="detail-value text-success">{stats.resolved}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Closed</span>
                <span className="detail-value">{stats.closed}</span>
              </div>
            </>
          ) : (
            <p>No bugs yet</p>
          )}
        </div>

        <div className="detail-section">
          <h3>Team Members</h3>
          <div className="member-list">
            {project.members?.map((member, idx) => (
              <div key={idx} className="member-item">
                <span className="member-avatar">{member.charAt(0).toUpperCase()}</span>
                <span className="member-name">{member}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section description-section">
          <h3>Description</h3>
          <p className="description-content">
            {project.description || 'No description provided.'}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Quick Actions</h3>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to={`/projects/${project.key}/bugs`} className="btn btn-primary">
            View All Bugs
          </Link>
          <Link to={`/projects/${project.key}/bugs/new`} className="btn btn-secondary">
            Create New Bug
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;
