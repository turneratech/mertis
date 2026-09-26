import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../App';
import './TrelloDashboard.css';

const LABEL_COLORS = new Set(['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'black']);

function TrelloDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'godmode' || user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');

  const [configForm, setConfigForm] = useState({
    apiKey: '',
    token: '',
    defaultBoardId: ''
  });
  const [configMsg, setConfigMsg] = useState({ type: '', text: '' });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDashboard = useCallback(async (boardId) => {
    setLoading(true);
    setError('');
    try {
      const params = boardId ? { boardId } : {};
      const [statusRes, dashRes] = await Promise.all([
        axios.get('/api/trello/status'),
        axios.get('/api/trello/dashboard', { params })
      ]);
      setConfigured(statusRes.data.configured);
      setDashboard(dashRes.data);
      if (dashRes.data.activeBoardId) {
        setSelectedBoardId(dashRes.data.activeBoardId);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load Trello dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get('/api/trello/config');
      setConfigForm({
        apiKey: res.data.apiKey || '',
        token: res.data.token || '',
        defaultBoardId: res.data.defaultBoardId || ''
      });
    } catch { /* ignore */ }
  }, [isAdmin]);

  useEffect(() => {
    fetchDashboard();
    fetchConfig();
  }, [fetchDashboard, fetchConfig]);

  const handleBoardChange = (e) => {
    const boardId = e.target.value;
    setSelectedBoardId(boardId);
    fetchDashboard(boardId);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setConfigMsg({ type: '', text: '' });
    try {
      const body = {};
      if (configForm.apiKey && configForm.apiKey !== '••••••••') body.apiKey = configForm.apiKey;
      if (configForm.token && configForm.token !== '••••••••') body.token = configForm.token;
      const res = await axios.post('/api/trello/test', body);
      setConfigMsg({
        type: 'success',
        text: `Connected as ${res.data.member?.fullName || res.data.member?.username}`
      });
    } catch (err) {
      setConfigMsg({
        type: 'error',
        text: err.response?.data?.error || 'Connection failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setConfigMsg({ type: '', text: '' });
    try {
      await axios.post('/api/trello/config', configForm);
      setConfigMsg({ type: 'success', text: 'Settings saved successfully' });
      setShowSettings(false);
      fetchDashboard(selectedBoardId);
    } catch (err) {
      setConfigMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDue = (due, dueComplete) => {
    if (!due || dueComplete) return null;
    const d = new Date(due);
    const now = new Date();
    const diff = d - now;
    const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (diff < 0) return { text: formatted, className: 'overdue' };
    if (diff < 3 * 86400000) return { text: formatted, className: 'soon' };
    return { text: formatted, className: 'ok' };
  };

  const getLabelClass = (color) => (LABEL_COLORS.has(color) ? color : 'blue');

  if (loading && !dashboard) {
    return <div className="loading">Loading Trello integration...</div>;
  }

  if (!configured) {
    return (
      <div className="trello-dashboard">
        <div className="trello-setup">
          <div className="trello-hero" style={{ marginBottom: '2rem' }}>
            <div className="trello-hero-content">
              <div className="trello-hero-badge">Integration</div>
              <h1>
                <span className="trello-icon">📋</span>
                Trello
              </h1>
              <p>Connect your Trello boards to view kanban workflows alongside Mertis bug tracking.</p>
            </div>
            <span className="trello-status-pill disconnected">
              <span className="trello-status-dot" />
              Not connected
            </span>
          </div>

          <div className="trello-setup-card">
            <h2>Connect Trello</h2>
            <p>
              Link your Trello account to sync boards, lists, and cards into Mertis.
              You'll need a Trello API key and a personal access token.
            </p>

            <div className="trello-setup-steps">
              <ol>
                <li>
                  Get your API key from{' '}
                  <a href="https://trello.com/power-ups/admin" target="_blank" rel="noopener noreferrer">
                    Trello Power-Ups Admin
                  </a>
                </li>
                <li>
                  Generate a token via the{' '}
                  <a
                    href="https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Mertis"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Trello authorization page
                  </a>{' '}
                  (replace YOUR_KEY in the URL after saving your API key)
                </li>
                <li>Paste both values below and test the connection</li>
              </ol>
            </div>

            {configMsg.text && (
              <div className={`trello-alert ${configMsg.type}`}>{configMsg.text}</div>
            )}

            {isAdmin ? (
              <div className="trello-form-grid">
                <label>
                  API Key
                  <input
                    type="text"
                    value={configForm.apiKey}
                    onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                    placeholder="Your Trello API key"
                  />
                </label>
                <label>
                  Token
                  <input
                    type="password"
                    value={configForm.token}
                    onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                    placeholder="Your Trello access token"
                  />
                </label>
                <div className="trello-form-actions">
                  <button
                    type="button"
                    className="trello-btn-trello"
                    onClick={handleTestConnection}
                    disabled={testing}
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveConfig}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save & Connect'}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>
                Ask an administrator to configure the Trello integration.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const summary = dashboard?.summary || {};
  const boardDetail = dashboard?.boardDetail;
  const boards = dashboard?.boards || [];
  const recentCards = dashboard?.recentCards || [];

  return (
    <div className="trello-dashboard">
      {/* Hero Header */}
      <div className="trello-hero">
        <div className="trello-hero-content">
          <div className="trello-hero-badge">Integration</div>
          <h1>
            <span className="trello-icon">📋</span>
            Trello Boards
          </h1>
          <p>
            {boardDetail
              ? `Viewing "${boardDetail.board.name}" — ${summary.totalCards || 0} open cards across ${boardDetail.lists.length} lists`
              : 'Your connected Trello boards and kanban workflows'}
          </p>
        </div>
        <div className="trello-hero-actions">
          <span className="trello-status-pill connected">
            <span className="trello-status-dot" />
            Connected
          </span>
          {isAdmin && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setShowSettings(true); fetchConfig(); }}
            >
              ⚙ Settings
            </button>
          )}
        </div>
      </div>

      {error && <div className="trello-alert error">{error}</div>}

      {/* Stats */}
      <div className="trello-stats-grid">
        <div className="trello-stat-card blue">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{summary.boardCount || 0}</div>
          <div className="stat-label">Boards</div>
        </div>
        <div className="trello-stat-card green">
          <div className="stat-icon">🃏</div>
          <div className="stat-value">{summary.totalCards || 0}</div>
          <div className="stat-label">Open Cards</div>
        </div>
        <div className="trello-stat-card orange">
          <div className="stat-icon">⏰</div>
          <div className="stat-value">{summary.dueSoon || 0}</div>
          <div className="stat-label">Due Soon</div>
        </div>
        <div className="trello-stat-card red">
          <div className="stat-icon">🔴</div>
          <div className="stat-value">{summary.overdue || 0}</div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="trello-stat-card purple">
          <div className="stat-icon">🏷️</div>
          <div className="stat-value">{summary.withLabels || 0}</div>
          <div className="stat-label">Labeled</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="trello-toolbar">
        <div className="trello-board-select">
          <label htmlFor="trello-board">Board</label>
          <select
            id="trello-board"
            value={selectedBoardId}
            onChange={handleBoardChange}
            disabled={loading}
          >
            {boards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        {boardDetail?.board?.url && (
          <div className="trello-toolbar-links">
            <a href={boardDetail.board.url} target="_blank" rel="noopener noreferrer">
              Open in Trello ↗
            </a>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="loading">Refreshing board...</div>
      ) : boardDetail?.lists?.length ? (
        <div className="trello-kanban">
          {boardDetail.lists.map((list) => (
            <div key={list.id} className="trello-list-column">
              <div className="trello-list-header">
                <h3 title={list.name}>{list.name}</h3>
                <span className="trello-list-count">{list.cards.length}</span>
              </div>
              <div className="trello-list-cards">
                {list.cards.length === 0 ? (
                  <div className="trello-list-empty">No cards</div>
                ) : (
                  list.cards.map((card) => {
                    const due = formatDue(card.due, card.dueComplete);
                    return (
                      <a
                        key={card.id}
                        href={card.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="trello-card"
                      >
                        {card.labels?.length > 0 && (
                          <div className="trello-card-labels">
                            {card.labels.map((lbl, i) => (
                              <span
                                key={i}
                                className={`trello-label ${getLabelClass(lbl.color)}`}
                                title={lbl.name}
                              />
                            ))}
                          </div>
                        )}
                        <div className="trello-card-title">{card.name}</div>
                        <div className="trello-card-meta">
                          {due && (
                            <span className={`trello-due ${due.className}`}>{due.text}</span>
                          )}
                          {card.comments > 0 && (
                            <span className="trello-card-badge">💬 {card.comments}</span>
                          )}
                          {card.attachments > 0 && (
                            <span className="trello-card-badge">📎 {card.attachments}</span>
                          )}
                          {card.checkItems > 0 && (
                            <span className="trello-card-badge">
                              ☑ {card.checkItemsChecked}/{card.checkItems}
                            </span>
                          )}
                        </div>
                      </a>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="trello-empty-kanban">
          <h3>No board selected</h3>
          <p>Select a board above or configure a default board in settings.</p>
        </div>
      )}

      {/* Bottom panels */}
      <div className="trello-bottom-grid">
        <div className="trello-panel">
          <h3>🕐 Recent Activity</h3>
          {recentCards.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No recent card activity</p>
          ) : (
            <ul className="trello-recent-list">
              {recentCards.map((card) => (
                <li key={card.id} className="trello-recent-item">
                  <a href={card.shortUrl} target="_blank" rel="noopener noreferrer">
                    {card.name}
                  </a>
                  <span className="trello-recent-list-name">{card.listName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="trello-panel">
          <h3>👥 Board Members</h3>
          {boardDetail?.members?.length ? (
            <div className="trello-members-grid">
              {boardDetail.members.map((m) => (
                <div key={m.id} className="trello-member">
                  <span className="trello-member-avatar">
                    {m.avatarUrl ? (
                      <img src={`${m.avatarUrl}/30.png`} alt="" />
                    ) : (
                      (m.fullName || m.username || '?')[0].toUpperCase()
                    )}
                  </span>
                  {m.fullName || m.username}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No members loaded</p>
          )}
        </div>
      </div>

      {/* Settings drawer */}
      {showSettings && (
        <div className="trello-settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="trello-settings-panel" onClick={(e) => e.stopPropagation()}>
            <h2>
              Trello Settings
              <button type="button" className="trello-settings-close" onClick={() => setShowSettings(false)}>
                ×
              </button>
            </h2>

            {configMsg.text && (
              <div className={`trello-alert ${configMsg.type}`}>{configMsg.text}</div>
            )}

            <div className="trello-form-grid">
              <label>
                API Key
                <input
                  type="text"
                  value={configForm.apiKey}
                  onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                  placeholder="Trello API key"
                />
              </label>
              <label>
                Token
                <input
                  type="password"
                  value={configForm.token}
                  onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                  placeholder="Trello access token"
                />
              </label>
              <label>
                Default Board
                <select
                  value={configForm.defaultBoardId}
                  onChange={(e) => setConfigForm({ ...configForm, defaultBoardId: e.target.value })}
                  style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="">— First board —</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="trello-form-actions">
              <button
                type="button"
                className="trello-btn-trello"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveConfig}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TrelloDashboard;
