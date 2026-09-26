const express = require('express');
const storage = require('../storage');
const { authMiddleware } = require('../middleware/auth');
const { requireFeature } = require('../middleware/licenseValidator');
const { FEATURES } = require('../config/features');
const featureService = require('../services/featureService');
const { botUsers, isPulseEnabled } = require('../config/pulse.config');
const {
  hasElevatedPrivileges,
  getAccessibleProjectKeys,
  canUserAccessProject,
  canUserViewBug,
  filterBugsForUser
} = require('../utils/bugVisibility');
const {
  BOARD_CAP,
  isTriaged,
  isPitItem,
  projectItem,
  groupByStatus,
  isSlaToday,
  isBlocked
} = require('../pulse/projections');
const { computeProjectLine, reconstructBug } = require('../pulse/line');
const {
  createReconstructor,
  projectCacheKey,
  deckCache
} = require('../pulse/engine');
const { computeQualityTax } = require('../pulse/qualityTax');
const {
  parseLens,
  applyLens,
  lensSummary,
  needsMissions
} = require('../pulse/lenses');
const { computeInterrupt, interruptOptsFromQuery } = require('../pulse/interrupt');
const { computeGravity } = require('../pulse/gravity');
const { computeEscaped } = require('../pulse/escaped');
const { computeWait } = require('../pulse/wait');
const { computeLanding, collectSamples, reopenRates } = require('../pulse/forecast');
const { replayBoard, changeSummary, historyBoundary } = require('../pulse/replay');
const { computeBrief } = require('../pulse/brief');
const { computeDeck } = require('../pulse/deck');
const { computeMissionMap, normalizeStatus } = require('../pulse/missions');
const { computeHorizon } = require('../pulse/horizon');
const { composeAiFridayProse } = require('../pulse/aiFriday');
const {
  MAX_SOURCES,
  normalizeFeedUrl,
  parseWindow,
  parseIcs,
  assembleCalendar,
  schedulingWork
} = require('../pulse/calendar');
const { fetchIcs } = require('../pulse/calendarFetch');

const router = express.Router();

// How many projects the Command Deck will reconstruct in one request, and how
// many bugs My Pulse will scan. Both were previously unbounded or silent.
const DECK_PROJECT_CAP = 25;
const ME_CAP = 500;

router.get('/status', (_req, res) => {
  res.json({ enabled: isPulseEnabled() });
});

router.use((req, res, next) => {
  if (!isPulseEnabled()) {
    return res.status(404).json({ error: 'Pulse is disabled' });
  }
  next();
});

const envelope = (data, degraded = []) => ({
  data,
  meta: {
    computedAt: new Date().toISOString(),
    storage: storage.getStorageType(),
    degraded
  }
});

const knownUserSet = async () => {
  const users = await storage.getAllUsers();
  return new Set(users.map((u) => u.username));
};

const loadVisibleProjectBugs = async (req, projectKey) => {
  const project = await storage.getProjectByKey(projectKey);
  if (!project) return { error: 404, message: 'Project not found' };

  const isPrivileged = hasElevatedPrivileges(req.user);
  const accessible = await getAccessibleProjectKeys(req.user, isPrivileged);
  if (!canUserAccessProject(projectKey, isPrivileged, accessible)) {
    return { error: 403, message: 'You do not have permission to view this project' };
  }

  let bugs = await storage.getBugsByProject(projectKey);
  bugs = filterBugsForUser(bugs, req.user.username, isPrivileged, accessible);
  return { project, bugs };
};

/**
 * Resolve ?lens= / ?q= and apply it to a bug set.
 *
 * The lens filters BEFORE any metric is computed, so quality tax, interrupt,
 * gravity and The Line all describe exactly what is on screen. `lens.of` carries
 * the unfiltered total so the client can say so — without it the user cannot
 * tell a small project from a narrow lens.
 *
 * Returns { error } for an unknown lens: failing open would hand back everything
 * while the user believes they are looking at a subset.
 */
const resolveLens = async (req, project, bugs) => {
  const parsed = parseLens(req.query);
  if (!parsed.ok) return { error: 400, message: parsed.error };
  if (!parsed.lens) return { bugs, all: bugs, lens: null, summary: null };

  const ctx = {
    username: req.user.username,
    knownUsers: await knownUserSet(),
    botUsers: botUsers(),
    nowMs: Date.now(),
    missionByBugId: {}
  };

  // Only pay for the mission link lookup when the lens actually needs it.
  if (needsMissions(parsed.lens) && project) {
    const links = await storage.listMissionLinksByProject(project.id);
    for (const link of links || []) {
      if (link && link.bugId && link.missionId && !ctx.missionByBugId[link.bugId]) {
        ctx.missionByBugId[link.bugId] = link.missionId;
      }
    }
  }

  const filtered = applyLens(bugs, parsed.lens, ctx);
  return {
    bugs: filtered,
    all: bugs,
    lens: parsed.lens,
    // Default denominator: every visible bug. Surfaces that render a subset
    // (the board shows only triaged work, the Pit only untriaged) override this
    // via summaryFor, so "N of M" always compares like with like.
    summary: lensSummary(parsed.lens, filtered.length, bugs.length)
  };
};

/**
 * Build the lens summary against the population a given surface actually
 * renders. `countFor` is the surface's own filter, e.g. isTriaged on the board.
 */
const summaryFor = (lensed, countFor) => {
  if (!lensed.lens) return null;
  const matched = lensed.bugs.filter(countFor).length;
  const of = lensed.all.filter(countFor).length;
  return lensSummary(lensed.lens, matched, of);
};

router.use(authMiddleware);
router.use(requireFeature(FEATURES.PROJECT_MANAGEMENT));

router.get('/board/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const project = await storage.getProjectByKey(projectKey);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessible = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserAccessProject(projectKey, isPrivileged, accessible)) {
      return res.status(403).json({ error: 'You do not have permission to view this project' });
    }

    let bugs = await storage.getBugsByProject(projectKey);
    bugs = filterBugsForUser(bugs, req.user.username, isPrivileged, accessible);

    // Applied before the cap check on purpose: narrowing the lens is exactly how
    // a user gets a large project back under BOARD_CAP.
    const lensed = await resolveLens(req, project, bugs);
    if (lensed.error) return res.status(lensed.error).json({ error: lensed.message });
    bugs = lensed.bugs;
    const lens = summaryFor(lensed, isTriaged);

    const degraded = [];
    if (bugs.length > BOARD_CAP) {
      return res.json(envelope(
        { columns: {}, truncated: true, count: bugs.length, lens, qualityTax: null, interrupt: null, gravity: null, escaped: null },
        [
          { metric: 'board', reason: 'narrow your lens — more than 500 bugs' },
          { metric: 'qualityTax', reason: 'narrow your lens — more than 500 bugs' },
          { metric: 'interrupt', reason: 'narrow your lens — more than 500 bugs' },
          { metric: 'gravity', reason: 'narrow your lens — more than 500 bugs' },
          { metric: 'escaped', reason: 'narrow your lens — more than 500 bugs' }
        ]
      ));
    }

    const known = await knownUserSet();
    const bots = botUsers();
    const triaged = bugs.filter(isTriaged);
    const qualityTax = computeQualityTax(triaged);
    if (qualityTax.degraded) degraded.push(qualityTax.degraded);
    const interrupt = computeInterrupt(bugs, interruptOptsFromQuery(req.query));
    if (interrupt.degraded) degraded.push(interrupt.degraded);
    const reconstruct = createReconstructor(Date.now());
    const gravity = computeGravity(bugs, { reconstruct });
    const escaped = computeEscaped(bugs);
    if (escaped.degraded) degraded.push(escaped.degraded);
    const items = triaged.map((bug) => ({
      ...projectItem(bug, known, bots),
      reopenGravity: gravity.byBugId[bug.bugId] || 0
    }));

    res.json(envelope({
      projectKey,
      projectName: project.name,
      columns: groupByStatus(items),
      truncated: false,
      count: items.length,
      lens,
      qualityTax,
      interrupt,
      gravity: { sentence: gravity.sentence, ranking: gravity.ranking },
      escaped
    }, degraded));
  } catch (error) {
    console.error('[Pulse] board error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/pit/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const project = await storage.getProjectByKey(projectKey);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessible = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserAccessProject(projectKey, isPrivileged, accessible)) {
      return res.status(403).json({ error: 'You do not have permission to view this project' });
    }

    let bugs = await storage.getBugsByProject(projectKey);
    bugs = filterBugsForUser(bugs, req.user.username, isPrivileged, accessible);

    const lensed = await resolveLens(req, project, bugs);
    if (lensed.error) return res.status(lensed.error).json({ error: lensed.message });
    bugs = lensed.bugs;

    const known = await knownUserSet();
    const bots = botUsers();
    const items = bugs
      .filter(isPitItem)
      .map((bug) => projectItem(bug, known, bots))
      .sort((a, b) => {
        const aTime = new Date(a.truthClock.lastRealActivityAt || 0).getTime();
        const bTime = new Date(b.truthClock.lastRealActivityAt || 0).getTime();
        return aTime - bTime;
      });

    const interrupt = computeInterrupt(bugs, interruptOptsFromQuery(req.query));
    const degraded = interrupt.degraded ? [interrupt.degraded] : [];

    res.json(envelope(
      { projectKey, projectName: project.name, items, interrupt, lens: summaryFor(lensed, isPitItem) },
      degraded
    ));
  } catch (error) {
    console.error('[Pulse] pit error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/triage/:bugId', async (req, res) => {
  try {
    const bug = await storage.getBugById(req.params.bugId);
    if (!bug) return res.status(404).json({ error: 'Bug not found' });

    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessible = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserViewBug(bug, req.user.username, isPrivileged, accessible)) {
      return res.status(403).json({ error: 'You do not have permission to triage this bug' });
    }

    const updated = await storage.setTriagedAt(bug.bugId, new Date().toISOString());
    const known = await knownUserSet();
    res.json(envelope({ item: projectItem(updated, known, botUsers()) }));
  } catch (error) {
    console.error('[Pulse] triage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/missions/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const missions = await storage.listMissionsByProject(loaded.project.id);
    const links = await storage.listMissionLinksByProject(loaded.project.id);
    const map = computeMissionMap({
      bugs: loaded.bugs,
      missions,
      links,
      reconstruct: createReconstructor(Date.now())
    });
    const degraded = map.missions.flatMap((mission) => mission.degraded || []);
    res.json(envelope({
      projectKey,
      projectName: loaded.project.name,
      missions: map.missions,
      unclaimed: map.unclaimed
    }, degraded));
  } catch (error) {
    console.error('[Pulse] missions list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/missions/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const title = String((req.body && req.body.title) || '').trim();
    const intent = String((req.body && req.body.intent) || '').trim();
    if (!title || !intent) {
      return res.status(400).json({ error: 'title and intent are required' });
    }
    const status = normalizeStatus(req.body && req.body.status);
    if ((req.body && req.body.status) && !status) {
      return res.status(400).json({ error: 'invalid mission status' });
    }

    const mission = await storage.createMission({
      projectId: loaded.project.id,
      title,
      intent,
      owner: (req.body && req.body.owner) || req.user.username,
      targetDate: (req.body && req.body.targetDate) || null,
      status: status || 'hunting'
    });
    res.status(201).json(envelope({ mission }));
  } catch (error) {
    console.error('[Pulse] mission create error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/missions/:projectKey/:missionId/bugs', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const mission = await storage.getMissionById(req.params.missionId);
    if (!mission || mission.projectId !== loaded.project.id) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const bugId = String((req.body && req.body.bugId) || '').trim();
    const bug = loaded.bugs.find((item) => item.bugId === bugId);
    if (!bug) return res.status(404).json({ error: 'Bug not found' });

    try {
      await storage.claimMissionBug({
        missionId: mission.id,
        bugId,
        addedBy: req.user.username
      });
    } catch (error) {
      if (error.code === 'BUG_ALREADY_CLAIMED') {
        return res.status(409).json({ error: 'Bug already belongs to a mission' });
      }
      throw error;
    }

    res.status(201).json(envelope({ missionId: mission.id, bugId }));
  } catch (error) {
    console.error('[Pulse] mission claim error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/missions/:projectKey/:missionId', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const mission = await storage.getMissionById(req.params.missionId);
    if (!mission || mission.projectId !== loaded.project.id) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const result = await storage.deleteMission(mission.id);
    res.json(envelope({
      deletedMissionId: mission.id,
      unlinkedBugIds: result.bugIds || []
    }));
  } catch (error) {
    console.error('[Pulse] mission delete error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/horizon/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const missions = await storage.listMissionsByProject(loaded.project.id);
    const links = await storage.listMissionLinksByProject(loaded.project.id);
    const map = computeMissionMap({ bugs: loaded.bugs, missions, links });
    const horizon = computeHorizon({
      missions: map.missions,
      bugs: loaded.bugs,
      unclaimed: map.unclaimed
    });
    res.json(envelope({
      projectKey,
      projectName: loaded.project.name,
      bars: horizon.bars,
      range: horizon.range,
      criticalPath: horizon.criticalPath,
      unclaimedCount: horizon.unclaimedCount
    }, horizon.degraded || []));
  } catch (error) {
    console.error('[Pulse] horizon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/brief/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const brief = computeBrief(loaded.bugs);
    const hasAiInsights = await featureService.isFeatureAvailable(FEATURES.AI_INSIGHTS);
    const ai = await composeAiFridayProse({
      clauses: brief.clauses,
      hasAiInsights,
      apiKey: require('../config/deployment.config').getAiConfig().apiKey
    });
    res.json(envelope({
      projectKey,
      projectName: loaded.project.name,
      clauses: ai.clauses,
      oldestPit: brief.oldestPit,
      aiProse: ai.prose,
      aiHiddenReason: ai.hiddenReason
    }, brief.degraded));
  } catch (error) {
    console.error('[Pulse] brief error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/line/bug/:bugId', async (req, res) => {
  try {
    const bug = await storage.getBugById(req.params.bugId);
    if (!bug) return res.status(404).json({ error: 'Bug not found' });

    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessible = await getAccessibleProjectKeys(req.user, isPrivileged);
    if (!canUserViewBug(bug, req.user.username, isPrivileged, accessible)) {
      return res.status(403).json({ error: 'You do not have permission to view this bug' });
    }

    const timeline = reconstructBug(bug, Date.now());
    const degraded = timeline.reason === 'insufficient history'
      ? [{ metric: 'line', reason: 'insufficient history' }]
      : [];
    res.json(envelope({ timeline }, degraded));
  } catch (error) {
    console.error('[Pulse] line bug error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/line/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const lensed = await resolveLens(req, loaded.project, loaded.bugs);
    if (lensed.error) return res.status(lensed.error).json({ error: lensed.message });

    const line = computeProjectLine(lensed.bugs, {
      botUsers: botUsers(),
      reconstruct: createReconstructor(Date.now())
    });
    res.json(envelope({
      projectKey,
      projectName: loaded.project.name,
      lens: lensed.summary,
      stations: line.stations,
      bottleneck: line.bottleneck,
      fixVerifyGap: line.fixVerifyGap,
      insufficientHistoryCount: line.insufficientHistoryCount,
      includedBugCount: line.includedBugCount
    }, line.degraded));
  } catch (error) {
    console.error('[Pulse] line error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get(
  '/replay/:projectKey',
  requireFeature(FEATURES.ADVANCED_REPORTING),
  async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const lensed = await resolveLens(req, loaded.project, loaded.bugs);
    if (lensed.error) return res.status(lensed.error).json({ error: lensed.message });
    const bugs = lensed.bugs;

    const nowMs = Date.now();
    const atRaw = req.query.at ? new Date(String(req.query.at)).getTime() : nowMs;
    if (Number.isNaN(atRaw)) {
      return res.status(400).json({ error: 'at must be an ISO date-time' });
    }
    // The future is not history. Clamp rather than pretend.
    const atMs = Math.min(atRaw, nowMs);

    const boundary = historyBoundary(bugs);
    const board = replayBoard(bugs, atMs, { boundary });

    // The change summary compares the scrub point with now, which is the
    // question people actually ask: "what has happened since then?"
    let change = null;
    if (!board.degraded || board.total > 0) {
      const from = Number.isNaN(boundary) ? atMs : Math.max(atMs, boundary);
      change = changeSummary(bugs, from, nowMs, {
        before: board,
        after: replayBoard(bugs, nowMs, { boundary })
      });
    }

    res.json(envelope({
      projectKey,
      projectName: loaded.project.name,
      lens: summaryFor(lensed, (bug) => bug.status !== 'Closed'),
      at: board.at,
      now: new Date(nowMs).toISOString(),
      earliest: board.boundary,
      columns: board.columns,
      counts: board.counts,
      total: board.total,
      notYetCreated: board.notYetCreated,
      withoutHistory: board.withoutHistory,
      change
    }, board.degraded ? [board.degraded] : []));
  } catch (error) {
    console.error('[Pulse] replay error:', error);
    res.status(500).json({ error: 'Server error' });
  }
  }
);

router.get(
  '/landing/:projectKey',
  requireFeature(FEATURES.ADVANCED_REPORTING),
  async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const missions = await storage.listMissionsByProject(loaded.project.id);
    const links = await storage.listMissionLinksByProject(loaded.project.id);

    // One reconstruction pass feeds the dwell samples, each bug's current
    // station, and the reopen rates. Landing invents no new measurement.
    const reconstruct = createReconstructor(Date.now());
    const line = computeProjectLine(loaded.bugs, { botUsers: botUsers(), reconstruct });
    const gravity = computeGravity(loaded.bugs, { reconstruct });
    const interrupt = computeInterrupt(loaded.bugs, interruptOptsFromQuery(req.query));

    const stationByBugId = {};
    for (const row of line.reconstructed || []) {
      if (row && row.bugId) stationByBugId[row.bugId] = row.currentStation;
    }

    const missionOf = {};
    for (const link of links || []) {
      if (link && link.bugId && link.missionId && !missionOf[link.bugId]) {
        missionOf[link.bugId] = link.missionId;
      }
    }

    const grouped = (missions || []).map((mission) => ({
      id: mission.id,
      title: mission.title,
      targetDate: mission.targetDate || null,
      status: mission.status || 'hunting',
      bugs: loaded.bugs.filter((bug) => missionOf[bug.bugId] === mission.id)
    }));

    const landing = computeLanding(grouped, {
      samples: collectSamples(line.reconstructed),
      reopenRates: reopenRates(loaded.bugs, gravity.byBugId),
      stationOf: (bug) => stationByBugId[bug.bugId],
      interruptPct: interrupt.loadPct != null ? interrupt.loadPct : null
    });

    res.json(envelope({
      projectKey,
      projectName: loaded.project.name,
      missions: landing.missions,
      assumes: landing.assumes,
      unclaimedCount: loaded.bugs.filter((b) => !missionOf[b.bugId]).length
    }, landing.degraded));
  } catch (error) {
    console.error('[Pulse] landing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
  }
);

router.get('/wait/:projectKey', async (req, res) => {
  try {
    const projectKey = req.params.projectKey.toUpperCase();
    const loaded = await loadVisibleProjectBugs(req, projectKey);
    if (loaded.error) return res.status(loaded.error).json({ error: loaded.message });

    const lensed = await resolveLens(req, loaded.project, loaded.bugs);
    if (lensed.error) return res.status(lensed.error).json({ error: lensed.message });

    const wait = computeWait(lensed.bugs, {
      knownUsers: await knownUserSet(),
      botUsers: botUsers()
    });

    res.json(envelope({
      projectKey,
      projectName: loaded.project.name,
      lens: summaryFor(lensed, (bug) => bug.status !== 'Closed'),
      sentence: wait.sentence || null,
      queues: wait.queues,
      sinks: wait.sinks,
      standoffs: wait.standoffs,
      unresolvedArbCount: wait.unresolvedArbCount
    }, wait.degraded ? [wait.degraded] : []));
  } catch (error) {
    console.error('[Pulse] wait error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/command', async (req, res) => {
  try {
    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessible = await getAccessibleProjectKeys(req.user, isPrivileged);
    const projects = await storage.getAllProjects(
      isPrivileged ? null : req.user.username,
      isPrivileged
    );
    const visible = (projects || []).filter((project) =>
      canUserAccessProject(project.key, isPrivileged, accessible)
    );

    // Navigation stays open to everyone: a Community user with one project must
    // still be redirected to their board. What is gated is the manager content —
    // the per-project briefs and the constellation metrics behind them.
    const deckAllowed = await featureService.isFeatureAvailable(
      FEATURES.ADVANCED_REPORTING,
      req.user ? req.user.id : null
    );

    if (!deckAllowed) {
      return res.json(envelope({
        skipToStrike: visible.length === 1 ? visible[0].key : null,
        rows: [],
        projects: visible.map((p) => ({ projectKey: p.key, projectName: p.name })),
        gated: {
          feature: FEATURES.ADVANCED_REPORTING,
          surface: 'Command Deck'
        }
      }));
    }

    const payloads = [];
    const degraded = [];

    // This loop used to be an unbounded N+1: one full brief per project, each of
    // which replays every bug's activity log. Two guards now: a project cap, and
    // the engine cache keyed by storage type + a content fingerprint.
    const shown = visible.slice(0, DECK_PROJECT_CAP);
    if (visible.length > shown.length) {
      degraded.push({
        metric: 'deck',
        reason: `showing the first ${DECK_PROJECT_CAP} projects of ${visible.length}`,
        count: visible.length
      });
    }

    const storageType = storage.getStorageType();
    const reconstruct = createReconstructor(Date.now());
    for (const project of shown) {
      let bugs = await storage.getBugsByProject(project.key);
      bugs = filterBugsForUser(bugs, req.user.username, isPrivileged, accessible);

      if (bugs.length > BOARD_CAP) {
        // Same rule as /board: refuse rather than spend a minute reconstructing.
        degraded.push({
          metric: 'deck',
          reason: `${project.key}: narrow your lens — more than ${BOARD_CAP} bugs`,
          projectKey: project.key
        });
        payloads.push({
          projectKey: project.key,
          projectName: project.name,
          bugs: [],
          brief: {
            clauses: [],
            oldestPit: null,
            degraded: [{ metric: 'board', reason: `narrow your lens — more than ${BOARD_CAP} bugs` }]
          }
        });
        continue;
      }

      const opts = { botUsers: botUsers(), reconstruct };
      const brief = deckCache.wrap(
        projectCacheKey(storageType, project.key, bugs),
        () => computeBrief(bugs, opts)
      );
      payloads.push({
        projectKey: project.key,
        projectName: project.name,
        bugs,
        opts,
        brief
      });
    }

    const deck = computeDeck(payloads);
    for (const row of deck.rows) {
      for (const entry of row.degraded || []) degraded.push(entry);
    }
    res.json(envelope({
      skipToStrike: deck.skipToStrike,
      rows: deck.rows
    }, degraded));
  } catch (error) {
    console.error('[Pulse] command deck error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const isPrivileged = hasElevatedPrivileges(req.user);
    const accessible = await getAccessibleProjectKeys(req.user, isPrivileged);
    // getAllBugs is capped, so say so rather than quietly showing a partial queue.
    let bugs = await storage.getAllBugs(ME_CAP + 1);
    const truncated = bugs.length > ME_CAP;
    if (truncated) bugs = bugs.slice(0, ME_CAP);
    bugs = filterBugsForUser(bugs, req.user.username, isPrivileged, accessible);

    const lensed = await resolveLens(req, null, bugs);
    if (lensed.error) return res.status(lensed.error).json({ error: lensed.message });
    bugs = lensed.bugs;

    const known = await knownUserSet();
    const bots = botUsers();
    const username = req.user.username;
    const items = bugs
      .filter((bug) => bug.status !== 'Closed')
      .map((bug) => projectItem(bug, known, bots));

    const nextMoves = items.filter((item) => item.nextMove.user === username);
    const criticals = items.filter((item) => item.severity === 'Critical');
    const slaToday = items.filter((item) => isSlaToday(item.dueSla));
    const blocked = items.filter((item) => isBlocked(item));

    const degraded = truncated
      ? [{ metric: 'me', reason: `showing the most recent ${ME_CAP} bugs`, count: ME_CAP }]
      : [];

    res.json(envelope({
      nextMoves,
      criticals,
      slaToday,
      blocked,
      truncated,
      lens: summaryFor(lensed, (bug) => bug.status !== 'Closed')
    }, degraded));
  } catch (error) {
    console.error('[Pulse] me error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

const calendarPerson = async (req) => {
  const viewer = req.user.username;
  const requested = String(req.query.user || viewer).trim();
  if (!requested) return { error: 400, message: 'Name a person' };
  const users = await storage.getAllUsers();
  const person = users.find((user) => user.username.toLowerCase() === requested.toLowerCase());
  if (!person) return { error: 404, message: 'No such person' };
  const self = person.username.toLowerCase() === String(viewer).toLowerCase();
  return { viewer, username: self ? viewer : person.username };
};

router.get('/calendar', async (req, res) => {
  try {
    const person = await calendarPerson(req);
    if (person.error) return res.status(person.error).json({ error: person.message });
    const window = parseWindow(req.query);
    if (window.error) return res.status(400).json({ error: window.error });

    const sources = await storage.listCalendarSources(person.username);
    let workItems = [];
    if (person.username === person.viewer) {
      const bugs = await storage.getBugsByUser(person.username);
      workItems = schedulingWork(bugs, person.username);
    }
    const payload = await assembleCalendar({
      username: person.username,
      viewer: person.viewer,
      from: window.from,
      to: window.to,
      timeZone: window.timeZone,
      sources,
      workItems,
      fetchFeed: fetchIcs
    });
    res.json(envelope(payload.data, payload.degraded));
  } catch (error) {
    console.error('[Pulse] calendar error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/calendar/sources', async (req, res) => {
  try {
    const username = req.user.username;
    let url;
    try {
      url = normalizeFeedUrl(req.body && req.body.url);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
    let host = 'Calendar';
    try { host = new URL(url).hostname; } catch { host = 'Calendar'; }
    const label = String((req.body && req.body.label) || '').trim().slice(0, 80) || host;
    const existing = await storage.listCalendarSources(username);
    if (existing.length >= MAX_SOURCES) {
      return res.status(400).json({ error: 'Five calendar links is the limit' });
    }
    if (existing.some((source) => source.url === url)) {
      return res.status(400).json({ error: 'That calendar link is already connected' });
    }
    try {
      const now = new Date();
      const text = await fetchIcs(url);
      const parsed = parseIcs(text, { from: now, to: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) });
      if (!parsed.calendar) return res.status(400).json({ error: 'That link is not a calendar feed' });
    } catch (err) {
      const status = err.status === 504 ? 504 : (err.status && err.status < 500 ? err.status : 400);
      return res.status(status).json({ error: err.message || 'Could not read that calendar link' });
    }
    const source = await storage.createCalendarSource({ username, label, url });
    res.status(201).json(envelope({ source: { id: source.id, label: source.label, url: source.url } }));
  } catch (error) {
    console.error('[Pulse] calendar source error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/calendar/sources/:id', async (req, res) => {
  try {
    const deleted = await storage.deleteCalendarSource(req.params.id, req.user.username);
    if (!deleted) return res.status(404).json({ error: 'Calendar link not found' });
    res.json(envelope({ deleted: true }));
  } catch (error) {
    console.error('[Pulse] calendar source delete error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
