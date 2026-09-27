const { v4: uuidv4 } = require('uuid');

const CREATE_SOURCES = `
CREATE TABLE IF NOT EXISTS pulse_calendar_sources (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  label VARCHAR(80) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
)`;

const mapSource = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    label: row.label,
    url: row.url,
    createdAt: row.created_at || row.createdAt || null
  };
};

function pulseCalendarSql({ query, queryOne }) {
  const ensurePulseCalendarTables = async () => {
    await query(CREATE_SOURCES);
  };

  const listCalendarSources = async (username) => {
    const rows = await query(
      'SELECT * FROM pulse_calendar_sources WHERE username = ? ORDER BY created_at ASC',
      [username]
    );
    return (rows || []).map(mapSource);
  };

  const createCalendarSource = async (data) => {
    const id = data.id || uuidv4();
    const now = new Date();
    await query(
      `INSERT INTO pulse_calendar_sources (id, username, label, url, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.username, data.label, data.url, now]
    );
    const row = await queryOne('SELECT * FROM pulse_calendar_sources WHERE id = ?', [id]);
    return mapSource(row);
  };

  const deleteCalendarSource = async (id, username) => {
    const existing = await queryOne(
      'SELECT id FROM pulse_calendar_sources WHERE id = ? AND username = ?',
      [id, username]
    );
    if (!existing) return false;
    await query('DELETE FROM pulse_calendar_sources WHERE id = ? AND username = ?', [id, username]);
    return true;
  };

  return {
    ensurePulseCalendarTables,
    listCalendarSources,
    createCalendarSource,
    deleteCalendarSource
  };
}

module.exports = { pulseCalendarSql };
