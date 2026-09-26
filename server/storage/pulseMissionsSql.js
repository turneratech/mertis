const { v4: uuidv4 } = require('uuid');

const CREATE_MISSIONS = `
CREATE TABLE IF NOT EXISTS pulse_missions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  intent TEXT NOT NULL,
  owner VARCHAR(50) NULL,
  target_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'hunting',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
)`;

const CREATE_LINKS = `
CREATE TABLE IF NOT EXISTS pulse_mission_bugs (
  mission_id VARCHAR(36) NOT NULL,
  bug_id VARCHAR(20) NOT NULL,
  added_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  added_by VARCHAR(50) NULL,
  PRIMARY KEY (bug_id)
)`;

const mapMission = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id || row.projectId,
    title: row.title,
    intent: row.intent,
    owner: row.owner || null,
    targetDate: row.target_date || row.targetDate || null,
    status: row.status || 'hunting',
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
};

const mapLink = (row) => ({
  missionId: row.mission_id || row.missionId,
  bugId: row.bug_id || row.bugId,
  addedAt: row.added_at || row.addedAt || null,
  addedBy: row.added_by || row.addedBy || null
});

const isUniqueViolation = (error) => {
  const code = error && (error.code || error.errno);
  return code === 'ER_DUP_ENTRY' || code === '23505' || Number(code) === 1062;
};

function pulseMissionsSql({ query, queryOne }) {
  const ensurePulseMissionTables = async () => {
    await query(CREATE_MISSIONS);
    await query(CREATE_LINKS);
  };

  const listMissionsByProject = async (projectId) => {
    const rows = await query(
      'SELECT * FROM pulse_missions WHERE project_id = ? ORDER BY created_at ASC',
      [projectId]
    );
    return (rows || []).map(mapMission);
  };

  const listMissionLinksByProject = async (projectId) => {
    const rows = await query(
      `SELECT l.mission_id, l.bug_id, l.added_at, l.added_by
       FROM pulse_mission_bugs l
       INNER JOIN pulse_missions m ON m.id = l.mission_id
       WHERE m.project_id = ?`,
      [projectId]
    );
    return (rows || []).map(mapLink);
  };

  const getMissionById = async (id) => {
    const row = await queryOne('SELECT * FROM pulse_missions WHERE id = ?', [id]);
    return mapMission(row);
  };

  const createMission = async (data) => {
    const id = data.id || uuidv4();
    const now = new Date();
    await query(
      `INSERT INTO pulse_missions (id, project_id, title, intent, owner, target_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.projectId,
        data.title,
        data.intent,
        data.owner || null,
        data.targetDate || null,
        data.status || 'hunting',
        now,
        now
      ]
    );
    return getMissionById(id);
  };

  const claimMissionBug = async ({ missionId, bugId, addedBy }) => {
    try {
      await query(
        'INSERT INTO pulse_mission_bugs (mission_id, bug_id, added_at, added_by) VALUES (?, ?, ?, ?)',
        [missionId, bugId, new Date(), addedBy || null]
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        const err = new Error('already claimed');
        err.code = 'BUG_ALREADY_CLAIMED';
        throw err;
      }
      throw error;
    }
    return { missionId, bugId };
  };

  const deleteMission = async (id) => {
    const links = await query('SELECT bug_id FROM pulse_mission_bugs WHERE mission_id = ?', [id]);
    const bugIds = (links || []).map((row) => row.bug_id || row.bugId);
    await query('DELETE FROM pulse_mission_bugs WHERE mission_id = ?', [id]);
    await query('DELETE FROM pulse_missions WHERE id = ?', [id]);
    return { bugIds };
  };

  return {
    ensurePulseMissionTables,
    listMissionsByProject,
    listMissionLinksByProject,
    getMissionById,
    createMission,
    claimMissionBug,
    deleteMission
  };
}

module.exports = { pulseMissionsSql };
