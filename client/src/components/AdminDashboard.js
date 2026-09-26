import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get('/api/analytics/overview');
      console.log('Analytics API response:', res.data);
      console.log('overallStats:', res.data?.overallStats);
      console.log('totalBugs type:', typeof res.data?.overallStats?.totalBugs);
      console.log('totalBugs value:', res.data?.overallStats?.totalBugs);
      
      // Validate response structure
      if (res.data && typeof res.data === 'object') {
        setData(res.data);
      } else {
        console.error('Invalid analytics response format:', res.data);
        setData(null);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      console.error('Error details:', error.response?.data || error.message);
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

  const COLORS = {
    status: ['#3b82f6', '#8b5cf6', '#10b981', '#6b7280'],
    severity: ['#dc2626', '#f97316', '#eab308', '#22c55e'],
    priority: ['#dc2626', '#f97316', '#eab308', '#22c55e']
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  if (!data) {
    return <div className="empty-state"><h3>Unable to load analytics</h3></div>;
  }

  // Safely get overallStats with defaults
  const stats = data.overallStats || {};
  
  // FIX: Handle both numbers and string numbers (from BigInt conversion)
  const safeNum = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof val === 'bigint') return Number(val);
    return 0;
  };

  // Map API property names (may vary between implementations)
  // API may return either "totalBugs" or "total", "openBugs" or "open", etc.
  const totalBugs = safeNum(stats.totalBugs ?? stats.total);
  const openBugs = safeNum(stats.openBugs ?? stats.open);
  const inProgressBugs = safeNum(stats.inProgressBugs ?? stats.inProgress);
  const resolvedBugs = safeNum(stats.resolvedBugs ?? stats.resolved);
  const closedBugs = safeNum(stats.closedBugs ?? stats.closed);
  const criticalBugs = safeNum(stats.criticalBugs ?? stats.critical);
  // Projects and Users might be in overallStats or we count from arrays
  const totalProjects = safeNum(stats.totalProjects ?? stats.projects ?? data.projectStats?.length);
  const totalUsers = safeNum(stats.totalUsers ?? stats.users ?? data.userStats?.length);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>System-wide analytics and bug tracking overview</p>
      </div>

      {/* Key Metrics */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-value">{totalBugs}</div>
          <div className="stat-label">Total Bugs</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{openBugs}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-card" style={{ background: 'var(--bg-input)' }}>
          <div className="stat-value" style={{ color: '#8b5cf6' }}>
            {inProgressBugs}
          </div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{resolvedBugs + closedBugs}</div>
          <div className="stat-label">Resolved/Closed</div>
        </div>
        <div className="stat-card critical">
          <div className="stat-value">{criticalBugs}</div>
          <div className="stat-label">Critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalProjects}</div>
          <div className="stat-label">Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-label">Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{safeNum(data.avgResolutionTime)}d</div>
          <div className="stat-label">Avg Resolution</div>
        </div>
      </div>

      <Link to="/integrations/trello" className="integration-strip trello-strip">
        <span className="integration-strip-icon">📋</span>
        <div className="integration-strip-text">
          <strong>Trello Integration</strong>
          <span>Connect boards, view kanban columns, and track card activity</span>
        </div>
        <span className="integration-strip-arrow">→</span>
      </Link>

      {/* Charts Row 1 */}
      <div className="charts-grid">
        {/* Bug Trend - Last 30 Days */}
        <div className="card chart-card">
          <h3>Bug Trend (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.bugTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => value ? value.slice(5) : ''}
              />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="created" 
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.3}
                name="Created"
              />
              <Area 
                type="monotone" 
                dataKey="closed" 
                stroke="#10b981" 
                fill="#10b981" 
                fillOpacity={0.3}
                name="Closed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Trend */}
        <div className="card chart-card">
          <h3>Weekly Trend (Last 12 Weeks)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.weeklyTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Legend />
              <Bar dataKey="created" fill="#3b82f6" name="Created" />
              <Bar dataKey="closed" fill="#10b981" name="Closed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 - Pie Charts */}
      <div className="charts-grid three-col">
        {/* Status Distribution */}
        <div className="card chart-card">
          <h3>Status Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={(data.statusDistribution || []).filter(d => d && typeof d.value === 'number')}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={{ stroke: '#94a3b8' }}
              >
                {(data.statusDistribution || []).filter(d => d && typeof d.value === 'number').map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS.status[index % COLORS.status.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Distribution */}
        <div className="card chart-card">
          <h3>Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={(data.severityDistribution || []).filter(d => d && typeof d.value === 'number')}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={{ stroke: '#94a3b8' }}
              >
                {(data.severityDistribution || []).filter(d => d && typeof d.value === 'number').map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS.severity[index % COLORS.severity.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Distribution */}
        <div className="card chart-card">
          <h3>Priority Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={(data.priorityDistribution || []).filter(d => d && typeof d.value === 'number')}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={{ stroke: '#94a3b8' }}
              >
                {(data.priorityDistribution || []).filter(d => d && typeof d.value === 'number').map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS.priority[index % COLORS.priority.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Project Stats */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Bugs by Project</h3>
          <Link to="/projects" className="btn btn-secondary btn-sm">Manage Projects</Link>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.projectStats || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#94a3b8" />
            <YAxis 
              type="category" 
              dataKey="projectName" 
              stroke="#94a3b8" 
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            <Legend />
            <Bar dataKey="open" stackId="a" fill="#3b82f6" name="Open" />
            <Bar dataKey="inProgress" stackId="a" fill="#8b5cf6" name="In Progress" />
            <Bar dataKey="resolved" stackId="a" fill="#10b981" name="Resolved" />
            <Bar dataKey="closed" stackId="a" fill="#6b7280" name="Closed" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* User Stats */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Bugs by User</h3>
          <Link to="/users" className="btn btn-secondary btn-sm">Manage Users</Link>
        </div>
        <table className="bug-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Assigned</th>
              <th>Open/In Progress</th>
              <th>Resolved</th>
              <th>Reported</th>
            </tr>
          </thead>
          <tbody>
            {(data.userStats || []).map(user => (
              <tr key={user.userId}>
                <td><strong>{user.username}</strong></td>
                <td>
                  <span className={`badge ${user.role === 'admin' ? 'badge-critical' : 'badge-medium'}`}>
                    {user.role}
                  </span>
                </td>
                <td>{safeNum(user.assigned)}</td>
                <td>
                  <span className={user.assignedOpen > 0 ? 'text-warning' : ''}>
                    {safeNum(user.assignedOpen)}
                  </span>
                </td>
                <td className="text-success">{safeNum(user.resolved)}</td>
                <td>{safeNum(user.reported)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Most Active Bugs */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">Most Active Bugs</h3>
        </div>
        <table className="bug-table">
          <thead>
            <tr>
              <th>Bug ID</th>
              <th>Title</th>
              <th>Project</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Assignee</th>
              <th>Activity</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {(data.mostActiveBugs || []).map(bug => (
              <tr key={bug.bugId}>
                <td>
                  <Link 
                    to={`/projects/${bug.projectKey}/bugs/${bug.bugId}`} 
                    className="bug-id"
                  >
                    {bug.bugId}
                  </Link>
                </td>
                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {bug.title}
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
                <td>{bug.assignee || '-'}</td>
                <td>
                  <span className="activity-count">{safeNum(bug.activityCount)} actions</span>
                </td>
                <td>{formatDate(bug.lastUpdated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDashboard;
