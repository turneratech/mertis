import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import MultiSelect from './MultiSelect';
import './EmailConfig.css';
import { FeatureGuard } from './common/FeatureGuard';
import { useLicense } from '../hooks/useLicense';

function EmailConfig() {
  const { promptUpgrade } = useLicense();
  // Tab state
  const [activeTab, setActiveTab] = useState('smtp');
  
  // SMTP Config state
  const [smtpConfigs, setSmtpConfigs] = useState([]);
  const [editingSmtp, setEditingSmtp] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  
  // Scheduled Reports state
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [projects, setProjects] = useState([]);
  
  // Email Log state
  const [emailLogs, setEmailLogs] = useState([]);
  const [logPagination, setLogPagination] = useState({ total: 0, limit: 20, offset: 0 });
  
  // Status
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initial data load
  useEffect(() => {
    fetchStatus();
    fetchSmtpConfigs();
    fetchSchedules();
    fetchProjects();
    fetchEmailLogs();
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // ==================== API CALLS ====================

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/email/status');
      setStatus(res.data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const fetchSmtpConfigs = async () => {
    try {
      const res = await axios.get('/api/email/config');
      setSmtpConfigs(res.data);
    } catch (err) {
      console.error('Error fetching SMTP configs:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await axios.get('/api/email/schedules');
      setSchedules(res.data);
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      setProjects(res.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchEmailLogs = async (offset = 0) => {
    try {
      const res = await axios.get(`/api/email/log?limit=20&offset=${offset}`);
      setEmailLogs(res.data.logs);
      setLogPagination({ total: res.data.total, limit: res.data.limit, offset });
    } catch (err) {
      console.error('Error fetching email logs:', err);
    }
  };

  // ==================== SMTP HANDLERS ====================

  const handleSmtpSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/email/config', editingSmtp);
      setSuccess('SMTP configuration saved successfully!');
      setEditingSmtp(null);
      fetchSmtpConfigs();
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setError('');

    try {
      const res = await axios.post('/api/email/config/test', editingSmtp);
      if (res.data.success) {
        setSuccess('✅ SMTP connection successful!');
      } else {
        setError('❌ Connection failed: ' + res.data.message);
      }
    } catch (err) {
      setError('❌ Connection failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      setError('Please enter an email address');
      return;
    }

    setSendingTestEmail(true);
    setError('');

    try {
      await axios.post('/api/email/config/send-test', { email: testEmailAddress });
      setSuccess('✅ Test email sent to ' + testEmailAddress);
      setTestEmailAddress('');
    } catch (err) {
      setError('❌ Failed to send test email: ' + (err.response?.data?.message || err.message));
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleDeleteSmtp = async (id) => {
    if (!window.confirm('Are you sure you want to delete this SMTP configuration?')) return;

    try {
      await axios.delete(`/api/email/config/${id}`);
      setSuccess('Configuration deleted');
      fetchSmtpConfigs();
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete configuration');
    }
  };

  // ==================== SCHEDULE HANDLERS ====================

  const initNewSchedule = () => {
    setEditingSchedule({
      report_name: '',
      report_type: 'weekly',
      frequency: 'weekly',
      day_of_week: 1,
      day_of_month: 1,
      send_time: '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      projects: [],
      include_ai_insights: true,
      is_active: true,
      recipients: []
    });
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/email/schedules', editingSchedule);
      setSuccess('Schedule saved successfully!');
      setEditingSchedule(null);
      fetchSchedules();
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSchedule = async (id) => {
    try {
      const res = await axios.patch(`/api/email/schedules/${id}/toggle`);
      setSuccess(res.data.is_active ? 'Schedule activated' : 'Schedule deactivated');
      fetchSchedules();
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle schedule');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await axios.delete(`/api/email/schedules/${id}`);
      setSuccess('Schedule deleted');
      fetchSchedules();
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete schedule');
    }
  };

  const handleSendNow = async (id) => {
    if (!window.confirm('Send this report now?')) return;

    setLoading(true);
    try {
      await axios.post(`/api/email/schedules/${id}/send-now`);
      setSuccess('Report sent successfully!');
      fetchEmailLogs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send report');
    } finally {
      setLoading(false);
    }
  };

  // ==================== RECIPIENT HANDLERS ====================

  const addRecipient = () => {
    if (!editingSchedule) return;
    setEditingSchedule({
      ...editingSchedule,
      recipients: [...(editingSchedule.recipients || []), { email: '', name: '', is_active: true }]
    });
  };

  const updateRecipient = (index, field, value) => {
    const updated = [...editingSchedule.recipients];
    updated[index] = { ...updated[index], [field]: value };
    setEditingSchedule({ ...editingSchedule, recipients: updated });
  };

  const removeRecipient = (index) => {
    const updated = editingSchedule.recipients.filter((_, i) => i !== index);
    setEditingSchedule({ ...editingSchedule, recipients: updated });
  };

  // ==================== HELPER FUNCTIONS ====================

  const getFrequencyDisplay = (schedule) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    switch (schedule.frequency) {
      case 'daily':
        return `Daily at ${schedule.send_time?.slice(0, 5) || '09:00'}`;
      case 'weekly':
        return `Weekly on ${days[schedule.day_of_week || 0]} at ${schedule.send_time?.slice(0, 5) || '09:00'}`;
      case 'biweekly':
        return `Biweekly on ${days[schedule.day_of_week || 0]} at ${schedule.send_time?.slice(0, 5) || '09:00'}`;
      case 'monthly':
        return `Monthly on day ${schedule.day_of_month || 1} at ${schedule.send_time?.slice(0, 5) || '09:00'}`;
      default:
        return schedule.frequency;
    }
  };

  const projectOptions = projects.map(p => `${p.projectKey || p.key} - ${p.name}`);

  const getSelectedProjectDisplay = () => {
    if (!editingSchedule?.projects) return [];
    return editingSchedule.projects.map(key => {
      const project = projects.find(p => (p.projectKey || p.key) === key);
      return project ? `${key} - ${project.name}` : key;
    });
  };

  const handleProjectChange = (selected) => {
    const keys = selected.map(s => s.split(' - ')[0]);
    setEditingSchedule({ ...editingSchedule, projects: keys });
  };

  // ==================== RENDER ====================

  return (
    <FeatureGuard
      feature="email_reports"
      fallback={
        <div className="card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '520px', margin: '2rem auto' }}>
          <h2>Email Reports — Professional Plan</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            SMTP configuration and scheduled email reports require a Professional license.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => promptUpgrade('email_reports')}>
            Upgrade to unlock
          </button>
        </div>
      }
    >
    <div className="email-config">
      <div className="config-header">
        <h1>📧 Email Configuration</h1>
        <p>Configure automated email reports and SMTP settings</p>
      </div>

      {/* Status Bar */}
      {status && (
        <div className={`status-bar ${status.smtp_configured && status.service_initialized ? 'success' : 'warning'}`}>
          <div className="status-item">
            <span className={`status-dot ${status.smtp_configured ? 'active' : 'inactive'}`}></span>
            SMTP: {status.smtp_configured ? 'Configured' : 'Not Configured'}
          </div>
          <div className="status-item">
            <span className={`status-dot ${status.service_initialized ? 'active' : 'inactive'}`}></span>
            Service: {status.service_initialized ? 'Running' : 'Stopped'}
          </div>
          <div className="status-item">
            <span className="status-dot active"></span>
            Active Schedules: {status.active_schedules || 0}
          </div>
        </div>
      )}

      {/* Messages */}
      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'smtp' ? 'active' : ''}`} onClick={() => setActiveTab('smtp')}>
          🔧 SMTP Settings
        </button>
        <button className={`tab ${activeTab === 'schedules' ? 'active' : ''}`} onClick={() => setActiveTab('schedules')}>
          📅 Scheduled Reports
        </button>
        <button className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
          📋 Email Log
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* ==================== SMTP TAB ==================== */}
        {activeTab === 'smtp' && (
          <div className="smtp-tab">
            {!editingSmtp ? (
              <>
                <div className="section-header">
                  <h2>SMTP Server Configuration</h2>
                  <button className="btn btn-primary" onClick={() => setEditingSmtp({
                    config_name: 'Default',
                    smtp_host: '',
                    smtp_port: 587,
                    smtp_secure: false,
                    smtp_user: '',
                    smtp_password: '',
                    from_email: '',
                    from_name: 'Mertis Reports',
                    is_active: true
                  })}>
                    ➕ Add SMTP Configuration
                  </button>
                </div>

                {smtpConfigs.length === 0 ? (
                  <div className="empty-state">
                    <p>No SMTP configuration found. Add one to enable email functionality.</p>
                  </div>
                ) : (
                  <div className="config-list">
                    {smtpConfigs.map(config => (
                      <div key={config.id} className={`config-card ${config.is_active ? 'active' : ''}`}>
                        <div className="config-header-row">
                          <h3>{config.config_name}</h3>
                          {config.is_active && <span className="active-badge">Active</span>}
                        </div>
                        <div className="config-details">
                          <p><strong>Host:</strong> {config.smtp_host}:{config.smtp_port}</p>
                          <p><strong>User:</strong> {config.smtp_user}</p>
                          <p><strong>From:</strong> {config.from_name} &lt;{config.from_email}&gt;</p>
                          <p><strong>Secure:</strong> {config.smtp_secure ? 'Yes (TLS)' : 'No (STARTTLS)'}</p>
                        </div>
                        <div className="config-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingSmtp(config)}>
                            ✏️ Edit
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSmtp(config.id)}>
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Test Email Section */}
                {status?.smtp_configured && (
                  <div className="test-email-section">
                    <h3>📨 Send Test Email</h3>
                    <div className="test-email-form">
                      <input
                        type="email"
                        placeholder="Enter email address..."
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        className="form-control"
                      />
                      <button 
                        className="btn btn-primary" 
                        onClick={handleSendTestEmail}
                        disabled={sendingTestEmail || !testEmailAddress}
                      >
                        {sendingTestEmail ? '⏳ Sending...' : '📤 Send Test'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Common SMTP Presets */}
                <div className="smtp-presets">
                  <h3>📋 Common SMTP Settings</h3>
                  <div className="presets-grid">
                    <div className="preset-card" onClick={() => setEditingSmtp({
                      config_name: 'Gmail',
                      smtp_host: 'smtp.gmail.com',
                      smtp_port: 587,
                      smtp_secure: false,
                      smtp_user: '',
                      smtp_password: '',
                      from_email: '',
                      from_name: 'Mertis Reports',
                      is_active: true
                    })}>
                      <span className="preset-icon">📧</span>
                      <span className="preset-name">Gmail</span>
                      <span className="preset-note">Use App Password</span>
                    </div>
                    <div className="preset-card" onClick={() => setEditingSmtp({
                      config_name: 'Outlook/Office 365',
                      smtp_host: 'smtp.office365.com',
                      smtp_port: 587,
                      smtp_secure: false,
                      smtp_user: '',
                      smtp_password: '',
                      from_email: '',
                      from_name: 'Mertis Reports',
                      is_active: true
                    })}>
                      <span className="preset-icon">📬</span>
                      <span className="preset-name">Outlook</span>
                      <span className="preset-note">Office 365</span>
                    </div>
                    <div className="preset-card" onClick={() => setEditingSmtp({
                      config_name: 'AWS SES',
                      smtp_host: 'email-smtp.us-east-1.amazonaws.com',
                      smtp_port: 587,
                      smtp_secure: false,
                      smtp_user: '',
                      smtp_password: '',
                      from_email: '',
                      from_name: 'Mertis Reports',
                      is_active: true
                    })}>
                      <span className="preset-icon">☁️</span>
                      <span className="preset-name">AWS SES</span>
                      <span className="preset-note">Update region</span>
                    </div>
                    <div className="preset-card" onClick={() => setEditingSmtp({
                      config_name: 'SendGrid',
                      smtp_host: 'smtp.sendgrid.net',
                      smtp_port: 587,
                      smtp_secure: false,
                      smtp_user: 'apikey',
                      smtp_password: '',
                      from_email: '',
                      from_name: 'Mertis Reports',
                      is_active: true
                    })}>
                      <span className="preset-icon">🚀</span>
                      <span className="preset-name">SendGrid</span>
                      <span className="preset-note">Use API key</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* SMTP Edit Form */
              <div className="edit-form">
                <h2>{editingSmtp.id ? 'Edit' : 'Add'} SMTP Configuration</h2>
                <form onSubmit={handleSmtpSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Configuration Name</label>
                      <input
                        type="text"
                        value={editingSmtp.config_name || ''}
                        onChange={(e) => setEditingSmtp({ ...editingSmtp, config_name: e.target.value })}
                        className="form-control"
                        placeholder="e.g., Gmail, Office 365"
                      />
                    </div>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editingSmtp.is_active}
                          onChange={(e) => setEditingSmtp({ ...editingSmtp, is_active: e.target.checked })}
                        />
                        Set as Active Configuration
                      </label>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>SMTP Host *</label>
                      <input
                        type="text"
                        value={editingSmtp.smtp_host || ''}
                        onChange={(e) => setEditingSmtp({ ...editingSmtp, smtp_host: e.target.value })}
                        className="form-control"
                        placeholder="smtp.gmail.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>SMTP Port *</label>
                      <input
                        type="number"
                        value={editingSmtp.smtp_port || 587}
                        onChange={(e) => setEditingSmtp({ ...editingSmtp, smtp_port: parseInt(e.target.value) })}
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editingSmtp.smtp_secure}
                          onChange={(e) => setEditingSmtp({ ...editingSmtp, smtp_secure: e.target.checked })}
                        />
                        Use SSL/TLS (port 465)
                      </label>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>SMTP Username *</label>
                      <input
                        type="text"
                        value={editingSmtp.smtp_user || ''}
                        onChange={(e) => setEditingSmtp({ ...editingSmtp, smtp_user: e.target.value })}
                        className="form-control"
                        placeholder="your-email@gmail.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>SMTP Password *</label>
                      <input
                        type="password"
                        value={editingSmtp.smtp_password || ''}
                        onChange={(e) => setEditingSmtp({ ...editingSmtp, smtp_password: e.target.value })}
                        className="form-control"
                        placeholder={editingSmtp.id ? '(unchanged)' : 'App password or API key'}
                        required={!editingSmtp.id}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>From Email *</label>
                      <input
                        type="email"
                        value={editingSmtp.from_email || ''}
                        onChange={(e) => setEditingSmtp({ ...editingSmtp, from_email: e.target.value })}
                        className="form-control"
                        placeholder="reports@yourcompany.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>From Name</label>
                      <input
                        type="text"
                        value={editingSmtp.from_name || ''}
                        onChange={(e) => setEditingSmtp({ ...editingSmtp, from_name: e.target.value })}
                        className="form-control"
                        placeholder="Mertis Reports"
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingSmtp(null)}>
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-info" 
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                    >
                      {testingConnection ? '⏳ Testing...' : '🔌 Test Connection'}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? '⏳ Saving...' : '💾 Save Configuration'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ==================== SCHEDULES TAB ==================== */}
        {activeTab === 'schedules' && (
          <div className="schedules-tab">
            {!editingSchedule ? (
              <>
                <div className="section-header">
                  <h2>Scheduled Reports</h2>
                  <button className="btn btn-primary" onClick={initNewSchedule} disabled={!status?.smtp_configured}>
                    ➕ Create Schedule
                  </button>
                </div>

                {!status?.smtp_configured && (
                  <div className="warning-banner">
                    ⚠️ Configure SMTP settings first to enable scheduled reports
                  </div>
                )}

                {schedules.length === 0 ? (
                  <div className="empty-state">
                    <p>No scheduled reports. Create one to automate your bug reports.</p>
                  </div>
                ) : (
                  <div className="schedules-list">
                    {schedules.map(schedule => (
                      <div key={schedule.id} className={`schedule-card ${schedule.is_active ? 'active' : 'inactive'}`}>
                        <div className="schedule-header">
                          <h3>{schedule.report_name}</h3>
                          <div className="schedule-badges">
                            <span className={`badge ${schedule.report_type}`}>{schedule.report_type}</span>
                            <span className={`badge ${schedule.is_active ? 'active' : 'inactive'}`}>
                              {schedule.is_active ? '✅ Active' : '⏸️ Paused'}
                            </span>
                          </div>
                        </div>
                        <div className="schedule-details">
                          <p><strong>📅 Frequency:</strong> {getFrequencyDisplay(schedule)}</p>
                          <p><strong>🌍 Timezone:</strong> {schedule.timezone || 'UTC'}</p>
                          <p><strong>📁 Projects:</strong> {schedule.projects?.length || 'All'}</p>
                          <p><strong>📧 Recipients:</strong> {schedule.recipient_count || 0}</p>
                          {schedule.last_sent_at && (
                            <p><strong>📤 Last Sent:</strong> {new Date(schedule.last_sent_at).toLocaleString()}</p>
                          )}
                        </div>
                        <div className="schedule-actions">
                          <button className="btn btn-sm btn-secondary" onClick={() => {
                            setEditingSchedule({
                              ...schedule,
                              send_time: schedule.send_time?.slice(0, 5) || '09:00'
                            });
                          }}>
                            ✏️ Edit
                          </button>
                          <button 
                            className={`btn btn-sm ${schedule.is_active ? 'btn-warning' : 'btn-success'}`}
                            onClick={() => handleToggleSchedule(schedule.id)}
                          >
                            {schedule.is_active ? '⏸️ Pause' : '▶️ Activate'}
                          </button>
                          <button 
                            className="btn btn-sm btn-info"
                            onClick={() => handleSendNow(schedule.id)}
                            disabled={loading}
                          >
                            📤 Send Now
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSchedule(schedule.id)}>
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Schedule Edit Form */
              <div className="edit-form">
                <h2>{editingSchedule.id ? 'Edit' : 'Create'} Scheduled Report</h2>
                <form onSubmit={handleScheduleSubmit}>
                  <div className="form-row">
                    <div className="form-group flex-2">
                      <label>Report Name *</label>
                      <input
                        type="text"
                        value={editingSchedule.report_name || ''}
                        onChange={(e) => setEditingSchedule({ ...editingSchedule, report_name: e.target.value })}
                        className="form-control"
                        placeholder="e.g., Weekly Engineering Report"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Report Type</label>
                      <select
                        value={editingSchedule.report_type || 'weekly'}
                        onChange={(e) => setEditingSchedule({ ...editingSchedule, report_type: e.target.value })}
                        className="form-control"
                      >
                        <option value="weekly">Weekly Report</option>
                        <option value="monthly">Monthly Report</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Frequency</label>
                      <select
                        value={editingSchedule.frequency || 'weekly'}
                        onChange={(e) => setEditingSchedule({ ...editingSchedule, frequency: e.target.value })}
                        className="form-control"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    {(editingSchedule.frequency === 'weekly' || editingSchedule.frequency === 'biweekly') && (
                      <div className="form-group">
                        <label>Day of Week</label>
                        <select
                          value={editingSchedule.day_of_week || 1}
                          onChange={(e) => setEditingSchedule({ ...editingSchedule, day_of_week: parseInt(e.target.value) })}
                          className="form-control"
                        >
                          <option value={0}>Sunday</option>
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                        </select>
                      </div>
                    )}

                    {editingSchedule.frequency === 'monthly' && (
                      <div className="form-group">
                        <label>Day of Month</label>
                        <select
                          value={editingSchedule.day_of_month || 1}
                          onChange={(e) => setEditingSchedule({ ...editingSchedule, day_of_month: parseInt(e.target.value) })}
                          className="form-control"
                        >
                          {[...Array(28)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Send Time</label>
                      <input
                        type="time"
                        value={editingSchedule.send_time || '09:00'}
                        onChange={(e) => setEditingSchedule({ ...editingSchedule, send_time: e.target.value })}
                        className="form-control"
                      />
                    </div>

                    <div className="form-group">
                      <label>Timezone</label>
                      <select
                        value={editingSchedule.timezone || 'UTC'}
                        onChange={(e) => setEditingSchedule({ ...editingSchedule, timezone: e.target.value })}
                        className="form-control"
                      >
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="Europe/London">London</option>
                        <option value="Europe/Paris">Paris</option>
                        <option value="Asia/Kolkata">India (IST)</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                        <option value="Australia/Sydney">Sydney</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Projects to Include (leave empty for all)</label>
                    <MultiSelect
                      options={projectOptions}
                      selected={getSelectedProjectDisplay()}
                      onChange={handleProjectChange}
                      placeholder="Select projects..."
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editingSchedule.include_ai_insights !== false}
                          onChange={(e) => setEditingSchedule({ ...editingSchedule, include_ai_insights: e.target.checked })}
                        />
                        Include AI-Generated Insights
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editingSchedule.is_active !== false}
                          onChange={(e) => setEditingSchedule({ ...editingSchedule, is_active: e.target.checked })}
                        />
                        Active (Schedule will run)
                      </label>
                    </div>
                  </div>

                  {/* Recipients Section */}
                  <div className="recipients-section">
                    <div className="section-header">
                      <h3>📧 Recipients</h3>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addRecipient}>
                        ➕ Add Recipient
                      </button>
                    </div>

                    {(!editingSchedule.recipients || editingSchedule.recipients.length === 0) ? (
                      <p className="hint">Add at least one recipient to receive the report emails.</p>
                    ) : (
                      <div className="recipients-list">
                        {editingSchedule.recipients.map((recipient, index) => (
                          <div key={index} className="recipient-row">
                            <input
                              type="email"
                              value={recipient.email || ''}
                              onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                              className="form-control"
                              placeholder="email@example.com"
                              required
                            />
                            <input
                              type="text"
                              value={recipient.name || ''}
                              onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                              className="form-control"
                              placeholder="Name (optional)"
                            />
                            <button 
                              type="button" 
                              className="btn btn-sm btn-danger"
                              onClick={() => removeRecipient(index)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingSchedule(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? '⏳ Saving...' : '💾 Save Schedule'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ==================== LOG TAB ==================== */}
        {activeTab === 'log' && (
          <div className="log-tab">
            <div className="section-header">
              <h2>Email Log</h2>
              <button className="btn btn-secondary" onClick={() => fetchEmailLogs(0)}>
                🔄 Refresh
              </button>
            </div>

            {emailLogs.length === 0 ? (
              <div className="empty-state">
                <p>No emails sent yet.</p>
              </div>
            ) : (
              <>
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Report</th>
                      <th>Subject</th>
                      <th>Recipients</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map(log => (
                      <tr key={log.id} className={`status-${log.status}`}>
                        <td>{new Date(log.created_at).toLocaleString()}</td>
                        <td>{log.report_name || '-'}</td>
                        <td className="subject-cell">{log.subject}</td>
                        <td>
                          {log.recipients ? JSON.parse(log.recipients).length : 0} recipient(s)
                        </td>
                        <td>
                          <span className={`status-badge ${log.status}`}>
                            {log.status === 'sent' ? '✅ Sent' : log.status === 'failed' ? '❌ Failed' : '⏳ Pending'}
                          </span>
                          {log.error_message && (
                            <span className="error-tooltip" title={log.error_message}>ℹ️</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                <div className="pagination">
                  <button 
                    className="btn btn-sm btn-secondary"
                    disabled={logPagination.offset === 0}
                    onClick={() => fetchEmailLogs(Math.max(0, logPagination.offset - logPagination.limit))}
                  >
                    ← Previous
                  </button>
                  <span className="page-info">
                    Showing {logPagination.offset + 1} - {Math.min(logPagination.offset + logPagination.limit, logPagination.total)} of {logPagination.total}
                  </span>
                  <button 
                    className="btn btn-sm btn-secondary"
                    disabled={logPagination.offset + logPagination.limit >= logPagination.total}
                    onClick={() => fetchEmailLogs(logPagination.offset + logPagination.limit)}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
    </FeatureGuard>
  );
}

export default EmailConfig;
