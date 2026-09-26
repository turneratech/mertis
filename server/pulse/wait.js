// M20 — The Wait.
//
// Mertis has a column no competitor has: `arb` (Action Required By) — the next
// *human*, distinct from the assignee. `nextMove.js` already resolves it one
// card at a time. Nothing has ever aggregated it, so the question every standup
// actually asks — "who is this waiting on?" — has never been answerable.
//
// The model is a graph of parked work:
//
//   For each open bug, the assignee is waiting on each person named in `arb`.
//
//   queue    — everything parked on one person.
//   sink     — someone holding work who is waiting on nobody. Work enters and
//              does not leave: the bottleneck is a human, not a column.
//   standoff — A waits on B on one bug while B waits on A on another.
//
// Never a ranking. The Wait names people to unblock them; the moment it sorts
// people by badness it becomes a performance report and adoption dies.

const { parseArb } = require('./nextMove');
const { truthClock } = require('./truthClock');

const DAY_MS = 86400000;

const isOpen = (bug) => bug && bug.status !== 'Closed';

/**
 * Split a bug's ARB entries into ones that match a real user and ones that do
 * not. Unresolved names are counted, never dropped — silently discarding them
 * would under-report exactly the teams with the messiest process, who need this
 * most.
 */
const splitArb = (bug, knownUsers) => {
  const entries = parseArb(bug.arb);
  const resolved = [];
  const unresolved = [];
  for (const raw of entries) {
    const name = String(raw || '').trim();
    if (!name) continue;
    if (!knownUsers || knownUsers.has(name)) resolved.push(name);
    else unresolved.push(name);
  }
  return { resolved, unresolved };
};

const ageDays = (bug, nowMs, botUsers) => {
  const clock = truthClock(bug, botUsers);
  const stamp = clock.lastRealActivityAt || bug.created || bug.created_at;
  const ms = stamp ? new Date(stamp).getTime() : NaN;
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((nowMs - ms) / DAY_MS));
};

const computeWait = (bugs, opts = {}) => {
  const nowMs = opts.nowMs != null ? opts.nowMs : Date.now();
  const knownUsers = opts.knownUsers || null;
  const botUsers = opts.botUsers || [];

  const open = (bugs || []).filter(isOpen);

  const queues = new Map();      // person -> { bugIds, oldestDays }
  const waitsOn = new Map();     // person -> Set(people they are waiting on)
  const pairBugs = new Map();    // "a>b" -> [bugIds]
  let unresolvedArbCount = 0;
  let bugsWithArb = 0;

  for (const bug of open) {
    const { resolved, unresolved } = splitArb(bug, knownUsers);
    unresolvedArbCount += unresolved.length;
    if (!resolved.length && !unresolved.length) continue;
    bugsWithArb += 1;

    const age = ageDays(bug, nowMs, botUsers);
    const assignee = String(bug.assignee || '').trim() || null;

    for (const person of resolved) {
      if (!queues.has(person)) queues.set(person, { bugIds: [], oldestDays: null });
      const q = queues.get(person);
      q.bugIds.push(bug.bugId);
      if (age != null && (q.oldestDays == null || age > q.oldestDays)) q.oldestDays = age;

      // The assignee is the one blocked by this parked work. Self-parking (you
      // are both assignee and ARB) is not a wait on anyone else.
      if (assignee && assignee !== person) {
        if (!waitsOn.has(assignee)) waitsOn.set(assignee, new Set());
        waitsOn.get(assignee).add(person);
        const key = `${assignee}>${person}`;
        if (!pairBugs.has(key)) pairBugs.set(key, []);
        pairBugs.get(key).push(bug.bugId);
      }
    }
  }

  if (!bugsWithArb) {
    return {
      queues: [],
      sinks: [],
      standoffs: [],
      unresolvedArbCount,
      degraded: {
        metric: 'wait',
        reason: 'no Action Required By values on this project'
      }
    };
  }

  const queueList = [...queues.entries()]
    .map(([user, q]) => ({
      user,
      count: q.bugIds.length,
      oldestDays: q.oldestDays,
      bugIds: q.bugIds.slice(0, 8)
    }))
    // Oldest wait first: the point is what has been parked longest, not who has
    // the most. Ties break alphabetically so the order is stable, not a league.
    .sort((a, b) => (b.oldestDays || 0) - (a.oldestDays || 0) || a.user.localeCompare(b.user));

  // A sink holds work and is waiting on nobody.
  const sinks = queueList
    .filter((row) => !(waitsOn.get(row.user) && waitsOn.get(row.user).size))
    .map((row) => ({ user: row.user, count: row.count, oldestDays: row.oldestDays }));

  // A standoff is a real two-cycle, not two people who merely happen to be busy.
  const standoffs = [];
  const seen = new Set();
  for (const [a, targets] of waitsOn.entries()) {
    for (const b of targets) {
      if (!(waitsOn.get(b) && waitsOn.get(b).has(a))) continue;
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      standoffs.push({
        a,
        b,
        bugIds: [...(pairBugs.get(`${a}>${b}`) || []), ...(pairBugs.get(`${b}>${a}`) || [])].slice(0, 8)
      });
    }
  }
  standoffs.sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

  const totalParked = queueList.reduce((sum, row) => sum + row.count, 0);
  const sentence = totalParked
    ? `${totalParked} item${totalParked === 1 ? '' : 's'} parked on ${queueList.length} ${queueList.length === 1 ? 'person' : 'people'}.`
    : 'Nothing is parked on anyone.';

  return {
    queues: queueList,
    sinks,
    standoffs,
    unresolvedArbCount,
    sentence,
    degraded: null
  };
};

module.exports = { computeWait, splitArb };
