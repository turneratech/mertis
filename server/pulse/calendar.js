/**
 * Person availability for scheduling.
 *
 * Feeds are iCal links (Outlook "publish", Google secret address, Apple).
 * Pulse keeps busy blocks beside the bug ledger. It never writes them onto bugs.
 */

const MAX_RANGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_BLOCKS = 200;
const MAX_CONFLICTS = 50;
const MAX_SOURCES = 5;
const MAX_URL_LENGTH = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

const calendarError = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const ipv4IsBlocked = (v4) => {
  const parts = String(v4).split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
};

const addressIsBlocked = (ip) => {
  if (!ip) return true;
  const raw = String(ip).toLowerCase().replace(/^\[|\]$/g, '');
  if (raw.includes(':')) {
    if (raw === '::1' || raw === '::') return true;
    if (raw.startsWith('fc') || raw.startsWith('fd') || raw.startsWith('fe80')) return true;
    const mapped = raw.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4IsBlocked(mapped[1]);
    return false;
  }
  if (!raw.includes('.')) return false;
  return ipv4IsBlocked(raw);
};

const hostIsBlocked = (hostname) => {
  const host = String(hostname || '').replace(/\.$/, '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === 'metadata.google.internal') return true;
  return addressIsBlocked(host);
};

const normalizeFeedUrl = (raw) => {
  let text = String(raw || '').trim();
  if (text.length > MAX_URL_LENGTH) throw calendarError('Calendar link is too long');
  if (/^webcals:\/\//i.test(text) || /^webcal:\/\//i.test(text)) {
    text = `https://${text.replace(/^webcals?:\/\//i, '')}`;
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    throw calendarError('Calendar link is not a valid URL');
  }
  if (url.protocol !== 'https:') throw calendarError('Calendar links must be https');
  if (url.username || url.password) throw calendarError('Calendar links cannot include a username or password');
  if (hostIsBlocked(url.hostname)) throw calendarError('That calendar link is not a public address');
  url.hash = '';
  return url.toString();
};

const isValidTimeZone = (timeZone) => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const parseWindow = (query = {}, now = new Date()) => {
  const timeZone = String(query.timeZone || 'UTC').trim() || 'UTC';
  if (timeZone.length > 80 || !isValidTimeZone(timeZone)) {
    return { error: 'Unknown time zone' };
  }
  const from = query.from ? new Date(query.from) : new Date(now);
  const to = query.to ? new Date(query.to) : new Date(from.getTime() + 7 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    return { error: 'Calendar window is invalid' };
  }
  const clipped = (to.getTime() - from.getTime() > MAX_RANGE_MS)
    ? new Date(from.getTime() + MAX_RANGE_MS)
    : to;
  return { from, to: clipped, timeZone };
};

const dayKey = (ms, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const dayLabel = (ms, timeZone) => new Intl.DateTimeFormat('en-GB', {
  timeZone,
  weekday: 'short',
  day: 'numeric',
  month: 'short'
}).format(new Date(ms));

const windowDays = (from, to, timeZone) => {
  const days = [];
  let ms = new Date(from).getTime();
  const end = new Date(to).getTime();
  let guard = 0;
  while (ms < end && guard < 14) {
    const key = dayKey(ms, timeZone);
    if (!days.length || days[days.length - 1].key !== key) {
      days.push({ key, label: dayLabel(ms, timeZone) });
    }
    ms += DAY_MS;
    guard += 1;
  }
  return days;
};

const addDateKey = (key, days) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const dueDayKey = (dueSla, timeZone) => {
  if (!dueSla) return null;
  if (dueSla instanceof Date) {
    if (Number.isNaN(dueSla.getTime())) return null;
    return dayKey(dueSla.getTime(), timeZone);
  }
  const raw = String(dueSla).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (dateOnly && (raw.length === 10 || /T00:00:00/.test(raw))) return dateOnly[1];
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return dayKey(parsed.getTime(), timeZone);
};

const unfoldIcs = (text) => String(text || '')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replace(/\n[ \t]/g, '');

const unescapeText = (value) => String(value || '')
  .replace(/\\n/gi, ' ')
  .replace(/\\,/g, ',')
  .replace(/\\;/g, ';')
  .replace(/\\\\/g, '\\')
  .trim();

const parseProperty = (line) => {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const value = unescapeText(line.slice(idx + 1));
  const [namePart, ...paramParts] = left.split(';');
  const params = {};
  for (const part of paramParts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toUpperCase();
    let paramValue = part.slice(eq + 1).trim();
    if (paramValue.startsWith('"') && paramValue.endsWith('"')) paramValue = paramValue.slice(1, -1);
    params[key] = paramValue;
  }
  return { name: namePart.trim().toUpperCase(), params, value };
};

const parseTree = (text) => {
  const root = { name: 'ROOT', props: {}, children: [], exdates: [] };
  const stack = [root];
  for (const line of unfoldIcs(text).split('\n')) {
    if (!line) continue;
    if (line.startsWith('BEGIN:')) {
      const node = { name: line.slice(6).trim().toUpperCase(), props: {}, children: [], exdates: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }
    if (line.startsWith('END:')) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const prop = parseProperty(line);
    if (!prop || stack.length < 2) continue;
    const node = stack[stack.length - 1];
    if (prop.name === 'EXDATE') node.exdates.push(prop);
    else if (!node.props[prop.name]) node.props[prop.name] = prop;
  }
  return root;
};

const collect = (node, name, out = []) => {
  for (const child of node.children || []) {
    if (child.name === name) out.push(child);
    collect(child, name, out);
  }
  return out;
};

const parseOffset = (value) => {
  const match = /^([+-])(\d{2})(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

const collectZones = (root) => {
  const zones = new Map();
  let sawDaylight = false;
  for (const zone of collect(root, 'VTIMEZONE')) {
    const tzid = zone.props.TZID && zone.props.TZID.value;
    if (zone.children.some((child) => child.name === 'DAYLIGHT')) sawDaylight = true;
    const standard = zone.children.find((child) => child.name === 'STANDARD');
    const offset = standard && standard.props.TZOFFSETTO && parseOffset(standard.props.TZOFFSETTO.value);
    if (tzid && offset !== null && offset !== undefined) zones.set(tzid, offset);
  }
  return { zones, sawDaylight };
};

const parseIcsInstant = (value, params, zones) => {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(String(value || '').trim());
  if (!match) return null;
  const allDay = params.VALUE === 'DATE' || !match[4];
  if (allDay) {
    const key = `${match[1]}-${match[2]}-${match[3]}`;
    return { allDay: true, utcMs: Date.parse(`${key}T00:00:00.000Z`), key };
  }
  const wall = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]);
  if (match[7] === 'Z') return { allDay: false, utcMs: wall };
  const tzid = params.TZID;
  if (tzid && zones.has(tzid)) {
    return { allDay: false, utcMs: wall - zones.get(tzid) * 60000 };
  }
  if (tzid) return { allDay: false, utcMs: wall, unknownZone: true };
  return { allDay: false, utcMs: wall, floating: true };
};

const parseDurationMs = (value) => {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(String(value || '').trim());
  if (!match) return null;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const mins = Number(match[3] || 0);
  const ms = ((days * 24 + hours) * 60 + mins) * 60000;
  return ms > 0 ? ms : null;
};

const addUtcDays = (ms, days) => {
  const date = new Date(ms);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + days,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
};

const parseRrule = (value) => {
  const rule = {};
  for (const part of String(value || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    rule[part.slice(0, eq).trim().toUpperCase()] = part.slice(eq + 1).trim().toUpperCase();
  }
  return rule;
};

const occurrenceStarts = (startMs, allDay, rule, untilMs, count, windowEnd) => {
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL) || 1);
  const limit = Number.isFinite(count) ? count : Infinity;
  const starts = [];
  const push = (ms) => {
    if (ms < startMs || ms > untilMs) return false;
    starts.push(ms);
    return starts.length >= limit;
  };

  if (freq === 'DAILY') {
    let cursor = startMs;
    if (!Number.isFinite(count) && cursor < windowEnd - (400 * interval * DAY_MS)) {
      const jump = Math.floor((windowEnd - 14 * DAY_MS - cursor) / (interval * DAY_MS));
      if (jump > 0) cursor = addUtcDays(cursor, jump * interval);
    }
    let guard = 0;
    while (cursor <= Math.max(untilMs, windowEnd) && guard < 500 && starts.length < limit) {
      if (push(cursor)) break;
      cursor = addUtcDays(cursor, interval);
      guard += 1;
      if (cursor > windowEnd && cursor > untilMs) break;
    }
    return { starts, supported: true };
  }

  if (freq === 'WEEKLY') {
    const wkst = WEEKDAYS[rule.WKST] !== undefined ? rule.WKST : 'MO';
    const byday = rule.BYDAY
      ? rule.BYDAY.split(',').filter((day) => WEEKDAYS[day] !== undefined).sort((a, b) => {
        const da = (WEEKDAYS[a] - WEEKDAYS[wkst] + 7) % 7;
        const db = (WEEKDAYS[b] - WEEKDAYS[wkst] + 7) % 7;
        return da - db;
      })
      : null;
    const template = new Date(startMs);
    const weekStartDow = WEEKDAYS[wkst];
    const startDow = template.getUTCDay();
    const weekOrigin = addUtcDays(startMs, -((startDow - weekStartDow + 7) % 7));
    let week = weekOrigin;
    let guard = 0;
    while (guard < 500 && starts.length < limit) {
      const days = byday || [Object.keys(WEEKDAYS).find((key) => WEEKDAYS[key] === startDow)];
      let stop = false;
      for (const day of days) {
        const delta = (WEEKDAYS[day] - weekStartDow + 7) % 7;
        const occ = Date.UTC(
          new Date(addUtcDays(week, delta)).getUTCFullYear(),
          new Date(addUtcDays(week, delta)).getUTCMonth(),
          new Date(addUtcDays(week, delta)).getUTCDate(),
          template.getUTCHours(),
          template.getUTCMinutes(),
          template.getUTCSeconds()
        );
        if (occ > untilMs && occ > windowEnd) {
          stop = true;
          break;
        }
        if (push(occ)) {
          stop = true;
          break;
        }
      }
      if (stop) break;
      week = addUtcDays(week, 7 * interval);
      guard += 1;
      if (week > windowEnd + 7 * DAY_MS && week > untilMs) break;
    }
    return { starts, supported: true };
  }

  if (freq === 'MONTHLY' && !rule.BYDAY) {
    const template = new Date(startMs);
    let guard = 0;
    while (guard < 240 && starts.length < limit) {
      const occ = Date.UTC(
        template.getUTCFullYear(),
        template.getUTCMonth() + guard * interval,
        template.getUTCDate(),
        template.getUTCHours(),
        template.getUTCMinutes(),
        template.getUTCSeconds()
      );
      const landed = new Date(occ);
      if (landed.getUTCDate() !== template.getUTCDate()) {
        guard += 1;
        continue;
      }
      if (occ > untilMs && occ > windowEnd) break;
      if (push(occ)) break;
      guard += 1;
      if (occ > windowEnd) break;
    }
    return { starts, supported: true };
  }

  return { starts: [startMs], supported: false, allDayIgnored: allDay };
};

const eventBlocks = (event, zones, fromMs, toMs, flags) => {
  const status = (event.props.STATUS && event.props.STATUS.value || '').toUpperCase();
  if (status === 'CANCELLED') return [];
  const transp = (event.props.TRANSP && event.props.TRANSP.value || '').toUpperCase();
  const outlook = (event.props['X-MICROSOFT-CDO-BUSYSTATUS'] && event.props['X-MICROSOFT-CDO-BUSYSTATUS'].value || '').toUpperCase();
  if (transp === 'TRANSPARENT' || outlook === 'FREE') return [];

  const startProp = event.props.DTSTART;
  if (!startProp) return [];
  const start = parseIcsInstant(startProp.value, startProp.params, zones);
  if (!start) return [];
  if (start.floating) flags.floating = true;
  if (start.unknownZone) flags.unknownZone = true;

  let duration = start.allDay ? DAY_MS : 60 * 60 * 1000;
  if (event.props.DTEND) {
    const end = parseIcsInstant(event.props.DTEND.value, event.props.DTEND.params, zones);
    if (end) {
      if (end.floating) flags.floating = true;
      if (end.unknownZone) flags.unknownZone = true;
      duration = Math.max(end.utcMs - start.utcMs, 60 * 1000);
    }
  } else if (event.props.DURATION) {
    const parsed = parseDurationMs(event.props.DURATION.value);
    if (parsed) duration = parsed;
  }

  const summary = (event.props.SUMMARY && event.props.SUMMARY.value) || 'Busy';
  const rule = event.props.RRULE ? parseRrule(event.props.RRULE.value) : null;
  const untilProp = rule && rule.UNTIL
    ? parseIcsInstant(rule.UNTIL, { VALUE: rule.UNTIL.length === 8 ? 'DATE' : undefined }, zones)
    : null;
  const untilMs = untilProp ? untilProp.utcMs : Infinity;
  const count = rule && rule.COUNT ? Number(rule.COUNT) : Infinity;
  const expanded = rule
    ? occurrenceStarts(start.utcMs, start.allDay, rule, untilMs, count, toMs)
    : { starts: [start.utcMs], supported: true };
  if (rule && !expanded.supported) flags.complexRule = true;

  const excluded = new Set();
  for (const ex of event.exdates || []) {
    for (const piece of ex.value.split(',')) {
      const instant = parseIcsInstant(piece.trim(), ex.params, zones);
      if (instant) excluded.add(instant.utcMs);
    }
  }

  const blocks = [];
  for (const occ of expanded.starts) {
    if (excluded.has(occ)) continue;
    const occEnd = occ + duration;
    if (occEnd <= fromMs || occ >= toMs) continue;
    if (start.allDay) {
      const startKey = new Date(occ).toISOString().slice(0, 10);
      const endKey = new Date(occEnd).toISOString().slice(0, 10);
      blocks.push({ allDay: true, start: startKey, end: endKey, summary: summary.slice(0, 120) });
    } else {
      blocks.push({
        allDay: false,
        start: new Date(occ).toISOString(),
        end: new Date(occEnd).toISOString(),
        summary: summary.slice(0, 120)
      });
    }
    if (blocks.length >= MAX_BLOCKS) break;
  }
  return blocks;
};

const parseIcs = (text, { from, to } = {}) => {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const root = parseTree(text);
  const calendar = collect(root, 'VCALENDAR').length > 0 || collect(root, 'VEVENT').length > 0;
  const { zones, sawDaylight } = collectZones(root);
  const flags = { floating: false, unknownZone: false, complexRule: false };
  const blocks = [];
  for (const event of collect(root, 'VEVENT')) {
    blocks.push(...eventBlocks(event, zones, fromMs, toMs, flags));
    if (blocks.length >= MAX_BLOCKS) break;
  }
  const degraded = [];
  if (sawDaylight) degraded.push('Daylight-saving changes in this feed were not applied');
  if (flags.floating) degraded.push('Times without a timezone were read as UTC');
  if (flags.unknownZone) degraded.push('Some events used a timezone this feed did not define');
  if (flags.complexRule) degraded.push('A repeating event used a rule Pulse does not expand');
  if (blocks.length >= MAX_BLOCKS) degraded.push('Showing the first 200 busy blocks');
  return { calendar, blocks: blocks.slice(0, MAX_BLOCKS), degraded };
};

const busyDayKeys = (blocks, timeZone) => {
  const keys = new Set();
  for (const block of blocks || []) {
    if (block.allDay) {
      let cursor = block.start;
      let guard = 0;
      while (cursor && block.end && cursor < block.end && guard < 16) {
        keys.add(cursor);
        cursor = addDateKey(cursor, 1);
        guard += 1;
      }
      continue;
    }
    const start = new Date(block.start).getTime();
    const end = new Date(block.end).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    let cursor = start;
    let guard = 0;
    while (cursor < end && guard < 32) {
      keys.add(dayKey(cursor, timeZone));
      cursor += 12 * 60 * 60 * 1000;
      guard += 1;
    }
    keys.add(dayKey(end - 1, timeZone));
  }
  return keys;
};

const findConflicts = (workItems, blocks, timeZone) => {
  const busyDays = busyDayKeys(blocks, timeZone);
  const conflicts = [];
  for (const item of workItems || []) {
    if (!item || !item.dueSla) continue;
    const day = dueDayKey(item.dueSla, timeZone);
    if (!day || !busyDays.has(day)) continue;
    conflicts.push({
      bugId: item.bugId,
      title: item.title,
      projectKey: item.projectKey || null,
      dueSla: item.dueSla instanceof Date ? item.dueSla.toISOString() : item.dueSla,
      day
    });
    if (conflicts.length >= MAX_CONFLICTS) break;
  }
  return conflicts;
};

const publicBlock = (block, timeZone, self) => {
  const row = {
    start: block.start,
    end: block.end,
    allDay: !!block.allDay,
    days: [...busyDayKeys([block], timeZone)]
  };
  if (self) row.summary = block.summary || 'Busy';
  return row;
};

const assembleCalendar = async ({
  username,
  viewer,
  from,
  to,
  timeZone,
  sources,
  workItems,
  fetchFeed,
  now = new Date()
}) => {
  const self = String(username).toLowerCase() === String(viewer).toLowerCase();
  const degraded = [];
  const blocks = [];
  for (const source of sources || []) {
    try {
      const text = await fetchFeed(source.url);
      const parsed = parseIcs(text, { from, to });
      if (!parsed.calendar) {
        degraded.push({
          metric: 'calendar',
          reason: self ? `${source.label}: that link is not a calendar feed` : 'A calendar link could not be read'
        });
        continue;
      }
      for (const note of parsed.degraded) {
        degraded.push({
          metric: 'calendar',
          reason: self ? `${source.label}: ${note}` : 'A calendar link could not be fully read'
        });
      }
      blocks.push(...parsed.blocks);
    } catch (err) {
      const reason = (err && err.message) || 'Could not read calendar link';
      degraded.push({
        metric: 'calendar',
        reason: self ? `${source.label}: ${reason}` : 'A calendar link could not be read'
      });
    }
  }
  const visible = blocks.slice(0, MAX_BLOCKS).map((block) => publicBlock(block, timeZone, self));
  return {
    data: {
      username,
      self,
      window: {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        timeZone
      },
      days: windowDays(from, to, timeZone),
      todayKey: dayKey(now.getTime(), timeZone),
      sources: self
        ? (sources || []).map((source) => ({ id: source.id, label: source.label, url: source.url }))
        : [],
      blocks: visible,
      conflicts: self ? findConflicts(workItems, blocks, timeZone) : []
    },
    degraded
  };
};

const schedulingWork = (bugs, username) => (bugs || []).filter((bug) => {
  if (!bug || bug.status === 'Closed') return false;
  return bug.assignee === username || bug.qaOwner === username;
}).map((bug) => ({
  bugId: bug.bugId,
  title: bug.title,
  projectKey: bug.projectKey || null,
  dueSla: bug.dueSLA || bug.due_sla || null
}));

module.exports = {
  MAX_SOURCES,
  calendarError,
  addressIsBlocked,
  hostIsBlocked,
  normalizeFeedUrl,
  parseWindow,
  dayKey,
  parseIcs,
  busyDayKeys,
  findConflicts,
  assembleCalendar,
  schedulingWork
};
