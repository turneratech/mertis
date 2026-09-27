const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  addressIsBlocked,
  normalizeFeedUrl,
  parseIcs,
  findConflicts,
  assembleCalendar
} = require('../../pulse/calendar');
const { fetchIcs } = require('../../pulse/calendarFetch');

const WINDOW = {
  from: '2026-09-21T00:00:00.000Z',
  to: '2026-10-10T00:00:00.000Z'
};

const outlookFeed = `BEGIN:VCALENDAR
BEGIN:VTIMEZONE
TZID:India Standard Time
BEGIN:STANDARD
TZOFFSETTO:+0530
TZOFFSETFROM:+0530
DTSTART:19700101T000000
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETTO:+0530
TZOFFSETFROM:+0530
DTSTART:19700101T000000
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=India Standard Time:20260925T090000
DTEND;TZID=India Standard Time:20260925T100000
SUMMARY:Standup
RRULE:FREQ=WEEKLY;BYDAY=FR
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260928
DTEND;VALUE=DATE:20260929
SUMMARY:Leave
END:VEVENT
BEGIN:VEVENT
DTSTART:20260925T120000Z
DTEND:20260925T130000Z
SUMMARY:Focus
TRANSP:TRANSPARENT
END:VEVENT
BEGIN:VEVENT
DTSTART:20260925T150000Z
DTEND:20260925T160000Z
SUMMARY:Cancelled sync
STATUS:CANCELLED
END:VEVENT
BEGIN:VEVENT
DTSTART:20260926T040000Z
DTEND:20260926T050000Z
SUMMARY:Free in Outlook
X-MICROSOFT-CDO-BUSYSTATUS:FREE
END:VEVENT
BEGIN:VEVENT
DTSTART:20260924T090000Z
DTEND:20260924T100000Z
RRULE:FREQ=WEEKLY;BYDAY=TH
EXDATE:20260924T090000Z
SUMMARY:Review
END:VEVENT
END:VCALENDAR`;

describe('Pulse calendar [VER-PULSE-CAL]', () => {
  it('VER-PULSE-CAL: an Outlook weekly feed becomes busy blocks in the window', () => {
    const parsed = parseIcs(outlookFeed, WINDOW);
    const standup = parsed.blocks.filter((block) => block.summary === 'Standup');
    assert.deepEqual(standup.map((block) => block.start), [
      '2026-09-25T03:30:00.000Z',
      '2026-10-02T03:30:00.000Z',
      '2026-10-09T03:30:00.000Z'
    ]);
    const leave = parsed.blocks.find((block) => block.summary === 'Leave');
    assert.equal(leave.allDay, true);
    assert.equal(leave.start, '2026-09-28');
    assert.equal(leave.end, '2026-09-29');
    assert.equal(parsed.blocks.some((block) => block.summary === 'Focus'), false);
    assert.equal(parsed.blocks.some((block) => block.summary === 'Cancelled sync'), false);
    assert.equal(parsed.blocks.some((block) => block.summary === 'Free in Outlook'), false);
    assert.equal(parsed.blocks.some((block) => block.summary === 'Review' && block.start.startsWith('2026-09-24')), false);
    assert.equal(parsed.blocks.some((block) => block.summary === 'Review' && block.start.startsWith('2026-10-01')), true);
    assert.equal(parsed.degraded.some((note) => note.includes('Daylight-saving')), true);
  });

  it('VER-PULSE-CAL: folded lines keep the space that was not the fold marker', () => {
    const parsed = parseIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260925T090000Z
DTEND:20260925T100000Z
SUMMARY:Weekly planning 
 session
END:VEVENT
END:VCALENDAR`, WINDOW);
    assert.equal(parsed.blocks[0].summary, 'Weekly planning session');
  });

  it('VER-PULSE-CAL: a due date on a busy day is a scheduling conflict', () => {
    const blocks = [{
      allDay: false,
      start: '2026-09-25T03:30:00.000Z',
      end: '2026-09-25T04:30:00.000Z',
      summary: 'Standup'
    }];
    const conflicts = findConflicts([
      { bugId: 'SM-1', title: 'Fix the gate', projectKey: 'SM', dueSla: '2026-09-25' },
      { bugId: 'SM-2', title: 'Later', projectKey: 'SM', dueSla: '2026-10-20' }
    ], blocks, 'Asia/Kolkata');
    assert.deepEqual(conflicts.map((row) => row.bugId), ['SM-1']);
  });

  it('VER-PULSE-CAL: another person sees busy time without titles or links', async () => {
    const payload = await assembleCalendar({
      username: 'priya',
      viewer: 'alex',
      from: WINDOW.from,
      to: WINDOW.to,
      timeZone: 'Asia/Kolkata',
      sources: [{ id: 'src-1', label: 'Outlook', url: 'https://outlook.office365.com/owa/calendar/secret/calendar.ics' }],
      workItems: [{ bugId: 'SM-1', title: 'Private', projectKey: 'SM', dueSla: '2026-09-25' }],
      fetchFeed: async () => outlookFeed,
      now: new Date('2026-09-25T08:00:00.000Z')
    });
    assert.equal(payload.data.self, false);
    assert.deepEqual(payload.data.sources, []);
    assert.equal(payload.data.conflicts.length, 0);
    assert.equal(payload.data.blocks.some((block) => block.summary), false);
    assert.equal(payload.data.blocks.length > 0, true);
    assert.equal(JSON.stringify(payload).includes('secret'), false);
  });

  it('VER-PULSE-CAL: the owner keeps titles, links, and conflicts', async () => {
    const payload = await assembleCalendar({
      username: 'priya',
      viewer: 'priya',
      from: WINDOW.from,
      to: WINDOW.to,
      timeZone: 'Asia/Kolkata',
      sources: [{ id: 'src-1', label: 'Outlook', url: 'https://outlook.office365.com/owa/calendar/secret/calendar.ics' }],
      workItems: [{ bugId: 'SM-1', title: 'Fix the gate', projectKey: 'SM', dueSla: '2026-09-25' }],
      fetchFeed: async () => outlookFeed,
      now: new Date('2026-09-25T08:00:00.000Z')
    });
    assert.equal(payload.data.self, true);
    assert.equal(payload.data.sources[0].url.includes('secret'), true);
    assert.equal(payload.data.blocks.some((block) => block.summary === 'Standup'), true);
    assert.deepEqual(payload.data.conflicts.map((row) => row.bugId), ['SM-1']);
  });

  it('VER-PULSE-CAL: only public https calendar links are accepted', () => {
    assert.equal(
      normalizeFeedUrl('webcal://outlook.office365.com/owa/calendar/abc/calendar.ics'),
      'https://outlook.office365.com/owa/calendar/abc/calendar.ics'
    );
    assert.throws(() => normalizeFeedUrl('http://outlook.office365.com/calendar.ics'), /https/);
    for (const blocked of [
      'https://127.0.0.1/calendar.ics',
      'https://10.1.2.3/calendar.ics',
      'https://192.168.0.8/calendar.ics',
      'https://169.254.169.254/latest',
      'https://localhost/calendar.ics',
      'https://calendar.local/feed.ics'
    ]) {
      assert.throws(() => normalizeFeedUrl(blocked), /public address/);
    }
    assert.equal(addressIsBlocked('8.8.8.8'), false);
    assert.equal(addressIsBlocked('::1'), true);
  });

  it('VER-PULSE-CAL: a connected link is stored for that person only', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-cal-'));
    const previous = process.env.MERTIS_DATA_DIR;
    process.env.MERTIS_DATA_DIR = dir;
    try {
      const csv = require('../../storage/csv');
      await csv.createCalendarSource({
        username: 'priya',
        label: 'Outlook',
        url: 'https://example.com/a.ics'
      });
      const mine = await csv.listCalendarSources('priya');
      assert.equal(mine.length, 1);
      assert.equal(mine[0].label, 'Outlook');
      assert.equal(await csv.deleteCalendarSource(mine[0].id, 'alex'), false);
      assert.equal((await csv.listCalendarSources('priya')).length, 1);
      assert.equal(await csv.deleteCalendarSource(mine[0].id, 'priya'), true);
      assert.equal((await csv.listCalendarSources('priya')).length, 0);
    } finally {
      if (previous === undefined) delete process.env.MERTIS_DATA_DIR;
      else process.env.MERTIS_DATA_DIR = previous;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it('VER-PULSE-CAL: a feed that resolves to a private address is refused', async () => {
    await assert.rejects(
      () => fetchIcs('https://outlook.office365.com/owa/calendar/abc/calendar.ics', {
        lookup: async () => [{ address: '127.0.0.1', family: 4 }]
      }),
      /public address/
    );
  });
});
