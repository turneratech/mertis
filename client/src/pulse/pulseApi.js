import axios from 'axios';

/**
 * Turn the current URL's lens params into a query string. A lens lives in the
 * URL so it is shareable, which means every fetch has to carry it.
 */
export const lensQuery = (search) => {
  const from = new URLSearchParams(search || '');
  const out = new URLSearchParams();
  const lens = from.get('lens');
  const q = from.get('q');
  if (lens) out.set('lens', lens);
  if (q) out.set('q', q);
  const str = out.toString();
  return str ? `?${str}` : '';
};

export const fetchPulseStatus = () => axios.get('/api/pulse/status').then((r) => r.data);

/** Full name for a Pulse header. Command Deck already shows names; /pulse/:key only had the key. */
export const fetchProjectName = (projectKey) =>
  axios.get('/api/projects').then((res) => {
    const want = String(projectKey || '').toUpperCase();
    const hit = (res.data || []).find((p) => String(p.key || '').toUpperCase() === want);
    const name = hit && hit.name ? String(hit.name).trim() : '';
    if (!name || name.toUpperCase() === want) return '';
    return name;
  });

export const fetchBoard = (projectKey, search) =>
  axios.get(`/api/pulse/board/${projectKey}${lensQuery(search)}`).then((r) => r.data);

export const fetchPit = (projectKey, search) =>
  axios.get(`/api/pulse/pit/${projectKey}${lensQuery(search)}`).then((r) => r.data);

export const fetchMyPulse = (search) =>
  axios.get(`/api/pulse/me${lensQuery(search)}`).then((r) => r.data);

export const triageBug = (bugId) =>
  axios.post(`/api/pulse/triage/${bugId}`).then((r) => r.data);

export const fetchLine = (projectKey, search) =>
  axios.get(`/api/pulse/line/${projectKey}${lensQuery(search)}`).then((r) => r.data);

export const fetchWait = (projectKey, search) =>
  axios.get(`/api/pulse/wait/${projectKey}${lensQuery(search)}`).then((r) => r.data);

export const fetchLanding = (projectKey) =>
  axios.get(`/api/pulse/landing/${projectKey}`).then((r) => r.data);

export const fetchReplay = (projectKey, atIso, search) => {
  const q = lensQuery(search);
  const sep = q ? '&' : '?';
  const at = atIso ? `${sep}at=${encodeURIComponent(atIso)}` : '';
  return axios.get(`/api/pulse/replay/${projectKey}${q}${at}`).then((r) => r.data);
};

export const fetchBrief = (projectKey) =>
  axios.get(`/api/pulse/brief/${projectKey}`).then((r) => r.data);

export const fetchHorizon = (projectKey) =>
  axios.get(`/api/pulse/horizon/${projectKey}`).then((r) => r.data);

export const fetchCommand = () => axios.get('/api/pulse/command').then((r) => r.data);

export const fetchMissions = (projectKey) =>
  axios.get(`/api/pulse/missions/${projectKey}`).then((r) => r.data);

export const createMission = (projectKey, body) =>
  axios.post(`/api/pulse/missions/${projectKey}`, body).then((r) => r.data);

export const claimMissionBug = (projectKey, missionId, bugId) =>
  axios.post(`/api/pulse/missions/${projectKey}/${missionId}/bugs`, { bugId }).then((r) => r.data);

export const deleteMission = (projectKey, missionId) =>
  axios.delete(`/api/pulse/missions/${projectKey}/${missionId}`).then((r) => r.data);

export const moveBugStatus = (projectKey, bugId, status) =>
  axios.put(`/api/bugs/${projectKey}/${bugId}`, { status }).then((r) => r.data);

export const calendarQuery = (user) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const params = new URLSearchParams({
    from: start.toISOString(),
    to: end.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });
  if (user) params.set('user', user);
  return params.toString();
};

export const fetchCalendar = (user) =>
  axios.get(`/api/pulse/calendar?${calendarQuery(user)}`).then((r) => r.data);

export const addCalendarSource = (body) =>
  axios.post('/api/pulse/calendar/sources', body).then((r) => r.data);

export const removeCalendarSource = (id) =>
  axios.delete(`/api/pulse/calendar/sources/${id}`).then((r) => r.data);
