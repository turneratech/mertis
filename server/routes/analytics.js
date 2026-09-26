/**
 * Analytics Routes
 * Uses storage abstraction layer for data access
 * 
 * ROLES:
 * - godmode: Full access to all analytics and reports
 * - admin: Full access to all analytics and reports
 * - user: Limited to user dashboard
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const storage = require('../storage');
const { query, queryOne } = require('../storage/mysql/db');
const { authMiddleware } = require('../middleware/auth');
const { requireFeature } = require('../middleware/licenseValidator');
const { FEATURES } = require('../config/features');
const { getOrganizationDisplayName, getConfidentialityNotice } = require('../config/organization');

// Logo path configuration - adjust based on your project structure
const getLogoPath = () => {
  const possiblePaths = [
    path.join(__dirname, '../public/mertis/imgs/logo_small.png'),
    path.join(__dirname, '../public/imgs/logo_small.png'),
    path.join(__dirname, '../../public/mertis/imgs/logo_small.png'),
    path.join(__dirname, '../../client/public/mertis/imgs/logo_small.png'),
    path.join(__dirname, '../static/mertis/imgs/logo_small.png'),
    path.join(__dirname, '../assets/logo_small.png'),
    path.join(__dirname, '../imgs/logo_small.png')
  ];
  
  for (const logoPath of possiblePaths) {
    if (fs.existsSync(logoPath)) {
      return logoPath;
    }
  }
  return null;
};

const router = express.Router();

// Helper function to check if user has elevated privileges
const hasElevatedPrivileges = (user) => {
  return user && (user.role === 'godmode' || user.role === 'admin');
};

// Comprehensive analytics for admin dashboard (admin and godmode only)
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin or super user access required' });
    }

    const analytics = await storage.getAdminAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User-specific dashboard stats
router.get('/user-dashboard', authMiddleware, async (req, res) => {
  try {
    const isPrivileged = hasElevatedPrivileges(req.user);
    const dashboard = await storage.getUserDashboard(req.user.username, isPrivileged);
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching user dashboard:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REPORT GENERATION ENDPOINTS ====================

// Generate report data for preview
router.post('/report-data', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'God mode access required for report generation' });
    }

    const { reportType, startDate, endDate, projects } = req.body;
    
    console.log('[Report API] Request received:');
    console.log('  - reportType:', reportType);
    console.log('  - startDate:', startDate);
    console.log('  - endDate:', endDate);
    console.log('  - projects:', projects);
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const reportData = await generateReportData(reportType, startDate, endDate, projects);
    
    console.log('[Report API] Response summary:');
    console.log('  - currentSnapshot.totalBugs:', reportData.currentSnapshot?.totalBugs);
    console.log('  - statusDistribution length:', reportData.statusDistribution?.length);
    
    res.json(reportData);
  } catch (error) {
    console.error('Error generating report data:', error);
    res.status(500).json({ error: 'Failed to generate report data' });
  }
});

// Generate PDF report
router.post('/generate-report', authMiddleware, requireFeature(FEATURES.ADVANCED_REPORTING), async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'God mode access required for report generation' });
    }

    const { reportType, startDate, endDate, projects, reportData } = req.body;
    
    let data = reportData;
    if (!data) {
      data = await generateReportData(reportType, startDate, endDate, projects);
    }

    const pdfBuffer = await generatePDFReport(data, reportType, startDate, endDate, req.user.username);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Mertis_${reportType}_Report_${startDate}_to_${endDate}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF report:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});


/**
 * ANALYTICS.JS PATCH - AI Commentary Integration
 * 
 * Instructions:
 * 1. Add the OPENAI_API_KEY to your .env file:
 *    OPENAI_API_KEY=sk-your-api-key-here
 * 
 * 2. Install the OpenAI package:
 *    npm install openai --save
 * 
 * 3. Add this code block AFTER line 129 in your analytics.js file
 *    (after the generate-report endpoint, before the generateReportData function)
 */

// ==================== AI COMMENTARY ENDPOINT ====================
// Add this after the /generate-report endpoint


/**
 * OPTIMIZED AI Commentary Endpoint
 * Token-efficient: ~200-300 tokens per request
 * With server-side caching to prevent redundant API calls
 * 
 * Add to your analytics.js after line 129
 */

// In-memory cache for AI commentary (server-side)
const aiCommentaryCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Clean expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of aiCommentaryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      aiCommentaryCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

// ==================== AI COMMENTARY ENDPOINT ====================
router.post('/ai-commentary', authMiddleware, requireFeature(FEATURES.AI_INSIGHTS), async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { reportData, reportType, startDate, endDate } = req.body;

    // Generate cache key
    const cacheKey = `${reportType}_${startDate}_${endDate}_${JSON.stringify(reportData?.summary || {}).slice(0, 50)}`;
    
    // Check server-side cache first
    const cached = aiCommentaryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[AI Commentary] Returning cached response');
      return res.json(cached.data);
    }

    // Resolved from the admin UI or env -- see config/deployment.config.js.
    const openaiKey = require('../config/deployment.config').getAiConfig().apiKey;
    
    if (!openaiKey) {
      console.log('[AI Commentary] No API key, using fallback');
      const fallback = generateSmartFallback(reportData, reportType);
      return res.json(fallback);
    }

    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: openaiKey });

      // OPTIMIZED: Minimal data payload (~100 tokens input)
      const miniData = compressData(reportData);

      // OPTIMIZED: Concise prompt (~150 tokens)
      const prompt = `Bug report: ${JSON.stringify(miniData)}
Write PM commentary as JSON:
{"exec":"2 sentence summary","team":"1 sentence","proj":"1 sentence","risk":"HIGH/MED/LOW: reason","recs":["action1","action2","action3"],"close":"1 encouraging sentence"}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a PM writing concise bug reports. JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5, // Lower = more deterministic, fewer tokens
        max_tokens: 350   // Limit response size
      });

      const responseText = completion.choices[0]?.message?.content || '';
      
      let commentary;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // Map shortened keys to full keys
          commentary = {
            executiveSummary: parsed.exec || parsed.executiveSummary || '',
            teamAnalysis: parsed.team || parsed.teamAnalysis || '',
            projectAnalysis: parsed.proj || parsed.projectAnalysis || '',
            riskAssessment: parsed.risk || parsed.riskAssessment || '',
            recommendations: parsed.recs || parsed.recommendations || [],
            closingNote: parsed.close || parsed.closingNote || ''
          };
        } else {
          throw new Error('No JSON');
        }
      } catch (e) {
        console.error('[AI Commentary] Parse error:', e.message);
        commentary = generateSmartFallback(reportData, reportType);
      }

      // Cache the result
      aiCommentaryCache.set(cacheKey, { data: commentary, timestamp: Date.now() });
      
      // Log token usage
      console.log('[AI Commentary] Tokens used:', completion.usage?.total_tokens || 'unknown');

      res.json(commentary);

    } catch (apiError) {
      console.error('[AI Commentary] API error:', apiError.message);
      const fallback = generateSmartFallback(reportData, reportType);
      res.json(fallback);
    }

  } catch (error) {
    console.error('[AI Commentary] Error:', error);
    res.status(500).json({ error: 'Failed to generate commentary' });
  }
});

// Compress report data to minimal tokens
function compressData(reportData) {
  const s = reportData?.summary || {};
  const c = reportData?.currentSnapshot || {};
  const ph = reportData?.projectHealth || [];
  const ap = reportData?.assigneePerformance || [];
  const cb = reportData?.criticalBugs || [];

  return {
    filed: s.totalBugsCreated || 0,
    resolved: s.totalBugsResolved || 0,
    rate: Math.round(s.resolutionRate || 0),
    net: s.netChange || 0,
    crit: c.critical || 0,
    open: c.open || 0,
    aging: cb.filter(b => (b.age || 0) > 7).length,
    healthy: ph.filter(p => (p.healthScore || 0) >= 70).length,
    total_proj: ph.length,
    top: ap.filter(u => (u.resolved || 0) > 0)
           .sort((a, b) => (b.resolved || 0) - (a.resolved || 0))
           .slice(0, 2)
           .map(u => ({ n: u.assignee?.split(' ')[0], r: u.resolved }))
  };
}

// Smart fallback without AI
function generateSmartFallback(reportData, reportType) {
  const s = reportData?.summary || {};
  const c = reportData?.currentSnapshot || {};
  const cb = reportData?.criticalBugs || [];
  const ph = reportData?.projectHealth || [];
  const ap = reportData?.assigneePerformance || [];

  const rate = s.resolutionRate || 0;
  const net = s.netChange || 0;
  const crit = c.critical || 0;
  const aging = cb.filter(b => (b.age || 0) > 7).length;

  // Executive Summary
  let exec = '';
  if (rate >= 100) exec = `Strong ${reportType}! Resolved more than filed, backlog down by ${Math.abs(net)}. `;
  else if (rate >= 70) exec = `Good progress: ${rate.toFixed(0)}% resolution rate, ${s.totalBugsResolved || 0} bugs closed. `;
  else if (rate >= 40) exec = `Moderate ${reportType}: ${rate.toFixed(0)}% rate. Backlog needs focus. `;
  else exec = `Challenging ${reportType}: ${rate.toFixed(0)}% rate, backlog grew by ${net}. `;
  exec += crit > 0 ? `${crit} critical bugs pending.` : 'No critical bugs.';

  // Team
  const top = ap.filter(u => (u.resolved || 0) > 0).sort((a, b) => (b.resolved || 0) - (a.resolved || 0))[0];
  const totalRes = ap.reduce((sum, u) => sum + (u.resolved || 0), 0);
  const team = top 
    ? `${totalRes} bugs resolved. ${top.assignee} led with ${top.resolved}.`
    : `${ap.length} team members contributed.`;

  // Projects
  const healthy = ph.filter(p => (p.healthScore || 0) >= 70).length;
  const atRisk = ph.filter(p => (p.healthScore || 0) < 40).map(p => p.projectKey);
  let proj = `${healthy}/${ph.length} projects healthy.`;
  if (atRisk.length > 0) proj += ` At-risk: ${atRisk.join(', ')}.`;

  // Risk
  let risk = 'LOW RISK: Issues addressed promptly.';
  if (aging > 5 || crit > 10) risk = `HIGH RISK: ${aging} bugs aging >7 days, ${crit} critical.`;
  else if (aging > 0 || crit > 5) risk = `MEDIUM RISK: ${aging} aging bugs need attention.`;

  // Recommendations
  const recs = [];
  if (crit > 0) recs.push(`Prioritize ${crit} critical bugs`);
  if (rate < 50) recs.push('Review capacity for bug focus');
  if (aging > 0) recs.push(`Address ${aging} aging bugs`);
  if (atRisk.length > 0) recs.push('Health-check at-risk projects');
  if (net > 5) recs.push('Schedule backlog grooming');
  while (recs.length < 3) recs.push('Continue monitoring metrics');

  // Close
  const close = rate >= 80 ? "Excellent work! Keep it up." 
    : rate >= 60 ? "Good progress. Stay focused." 
    : "Let's discuss improvement strategies.";

  return {
    executiveSummary: exec,
    teamAnalysis: team,
    projectAnalysis: proj,
    riskAssessment: risk,
    recommendations: recs.slice(0, 3),
    closingNote: close
  };
}

// ==================== END AI COMMENTARY ====================



// ==================== END AI COMMENTARY ====================


// ==================== END AI COMMENTARY CODE ====================




// ==================== REPORT DATA GENERATION HELPERS ====================

async function generateReportData(reportType, startDate, endDate, projectKeys) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get all bugs - Direct SQL query for reliability
  let allBugs = [];
  try {
    const bugsQuery = `
      SELECT 
        b.bug_id as bugId,
        b.title,
        b.description,
        b.status,
        b.severity,
        b.priority,
        b.reporter,
        b.assignee,
        b.qa_owner as qaOwner,
        b.project_key as projectKey,
        b.project_id as projectId,
        b.created_at as createdAt,
        b.updated_at as updatedAt,
        b.closed_at as resolvedAt,
        p.name as projectName
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      ORDER BY b.updated_at DESC
    `;
    allBugs = await query(bugsQuery);
    console.log('[Report] Total bugs fetched:', allBugs.length);
    
    if (allBugs.length > 0) {
      console.log('[Report] First bug projectKey:', allBugs[0].projectKey);
    }
  } catch (e) {
    console.error('[Report] Error fetching bugs:', e.message);
    allBugs = [];
  }

  // Filter bugs by project if specified - CASE INSENSITIVE matching
  if (projectKeys && projectKeys.length > 0) {
    const normalizedKeys = projectKeys.map(k => (k || '').toUpperCase());
    
    console.log('[Report] Filtering by projects:', normalizedKeys.join(', '));
    
    const beforeFilter = allBugs.length;
    allBugs = allBugs.filter(bug => {
      const bugKey = (bug.projectKey || '').toUpperCase();
      return normalizedKeys.includes(bugKey);
    });
    
    console.log('[Report] Bugs after filter:', allBugs.length, '(was', beforeFilter, ')');
  }

  // Get bugs created/resolved in date range
  const bugsInRange = allBugs.filter(bug => {
    const created = new Date(bug.createdAt);
    return created >= start && created <= end;
  });

  const bugsResolvedInRange = allBugs.filter(bug => {
    if (!bug.resolvedAt && bug.status !== 'Resolved' && bug.status !== 'Closed') return false;
    const resolved = bug.resolvedAt ? new Date(bug.resolvedAt) : new Date(bug.updatedAt);
    return resolved >= start && resolved <= end && (bug.status === 'Resolved' || bug.status === 'Closed');
  });

  // Calculate summary metrics (for the period)
  const summary = {
    totalBugsCreated: bugsInRange.length,
    totalBugsResolved: bugsResolvedInRange.length,
    netChange: bugsInRange.length - bugsResolvedInRange.length,
    avgResolutionTime: calculateAvgResolutionTime(bugsResolvedInRange),
    criticalBugs: allBugs.filter(b => b.severity === 'Critical' && b.status !== 'Closed' && b.status !== 'Resolved').length,
    resolutionRate: bugsInRange.length > 0 ? (bugsResolvedInRange.length / bugsInRange.length) * 100 : 0,
    highlights: generateHighlights(bugsInRange, bugsResolvedInRange, allBugs)
  };

  // Current snapshot - overall stats for selected projects (like Admin Dashboard)
  const currentSnapshot = {
    totalBugs: allBugs.length,
    open: allBugs.filter(b => b.status === 'Open' || b.status === 'Reopened').length,
    inProgress: allBugs.filter(b => b.status === 'In Progress').length,
    resolved: allBugs.filter(b => b.status === 'Resolved').length,
    closed: allBugs.filter(b => b.status === 'Closed').length,
    critical: allBugs.filter(b => b.severity === 'Critical').length,
    high: allBugs.filter(b => b.severity === 'High').length
  };

  // Status distribution for current state (all bugs in selected projects)
  const statusDistribution = generateDistribution(allBugs, 'status', {
    'Open': '#3b82f6',
    'In Progress': '#8b5cf6',
    'Resolved': '#10b981',
    'Closed': '#6b7280',
    'Reopened': '#f59e0b'
  });

  // Severity distribution for current state (all bugs, not just in range)
  const currentSeverityDistribution = generateDistribution(allBugs, 'severity', {
    Critical: '#dc2626',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e'
  });

  // Priority distribution for current state
  const currentPriorityDistribution = generateDistribution(allBugs, 'priority', {
    Critical: '#dc2626',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e'
  });

  // ARB Trend (daily resolution rates)
  const arbTrend = generateARBTrend(allBugs, start, end);

  // Project comparison
  const projectComparison = await generateProjectComparison(allBugs, bugsInRange, bugsResolvedInRange, projectKeys);

  // Assignee performance
  const assigneePerformance = generateAssigneePerformance(allBugs, bugsResolvedInRange, start, end);

  // Severity distribution
  const severityDistribution = generateDistribution(bugsInRange, 'severity', {
    Critical: '#dc2626',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e'
  });

  // Priority distribution
  const priorityDistribution = generateDistribution(bugsInRange, 'priority', {
    Critical: '#dc2626',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e'
  });

  // Daily activity
  const dailyActivity = generateDailyActivity(allBugs, start, end);

  // Project health
  const projectHealth = await generateProjectHealth(allBugs, projectKeys);

  // Critical bugs requiring attention
  const criticalBugs = allBugs
    .filter(b => (b.severity === 'Critical' || b.severity === 'High' || b.priority === 'Critical' || b.priority === 'High') 
      && b.status !== 'Closed' && b.status !== 'Resolved')
    .map(b => ({
      ...b,
      age: Math.floor((new Date() - new Date(b.createdAt)) / (1000 * 60 * 60 * 24))
    }))
    .sort((a, b) => {
      const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });

  // Week over week comparison (for weekly reports)
  let weekOverWeek = null;
  if (reportType === 'weekly') {
    weekOverWeek = generateWeekOverWeek(allBugs, start, end);
  }

  // Activity summary
  const activitySummary = await generateActivitySummary(allBugs, start, end);

  // ==================== ADDITIONAL ANALYTICS ====================

  // Top Reporters
  const reporterStats = {};
  allBugs.forEach(bug => {
    if (!bug.reporter) return;
    if (!reporterStats[bug.reporter]) {
      reporterStats[bug.reporter] = { username: bug.reporter, reported: 0, critical: 0, high: 0 };
    }
    reporterStats[bug.reporter].reported++;
    if (bug.severity === 'Critical') reporterStats[bug.reporter].critical++;
    if (bug.severity === 'High') reporterStats[bug.reporter].high++;
  });
  const topReporters = Object.values(reporterStats)
    .sort((a, b) => b.reported - a.reported)
    .slice(0, 10);

  // Bug Aging Analysis (Open bugs by age)
  const openBugs = allBugs.filter(b => b.status === 'Open' || b.status === 'In Progress' || b.status === 'Reopened');
  const bugAging = {
    lessThan7Days: 0,
    between7And14Days: 0,
    between14And30Days: 0,
    moreThan30Days: 0
  };
  const now = new Date();
  openBugs.forEach(bug => {
    const age = Math.floor((now - new Date(bug.createdAt)) / (1000 * 60 * 60 * 24));
    if (age < 7) bugAging.lessThan7Days++;
    else if (age < 14) bugAging.between7And14Days++;
    else if (age < 30) bugAging.between14And30Days++;
    else bugAging.moreThan30Days++;
  });
  const bugAgingChart = [
    { name: '< 7 days', value: bugAging.lessThan7Days, color: '#22c55e' },
    { name: '7-14 days', value: bugAging.between7And14Days, color: '#eab308' },
    { name: '14-30 days', value: bugAging.between14And30Days, color: '#f97316' },
    { name: '> 30 days', value: bugAging.moreThan30Days, color: '#dc2626' }
  ].filter(d => d.value > 0);

  // Workload Distribution (for pie chart)
  const workloadDistribution = assigneePerformance
    .filter(a => a.assigned > 0)
    .slice(0, 8)
    .map((a, i) => ({
      name: a.username || a.assignee,
      value: a.assigned - a.resolved,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'][i % 8]
    }))
    .filter(d => d.value > 0);

  // Environment Distribution
  const envStats = {};
  allBugs.forEach(bug => {
    const env = bug.environment || 'Unknown';
    if (!envStats[env]) envStats[env] = 0;
    envStats[env]++;
  });
  const environmentDistribution = Object.entries(envStats)
    .map(([name, value], i) => ({
      name,
      value,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]
    }))
    .sort((a, b) => b.value - a.value);

  // Weekly Trend (last 12 weeks)
  const weeklyTrend = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const created = allBugs.filter(b => {
      const d = new Date(b.createdAt);
      return d >= weekStart && d <= weekEnd;
    }).length;

    const closed = allBugs.filter(b => {
      if (b.status !== 'Closed' && b.status !== 'Resolved') return false;
      const d = b.resolvedAt ? new Date(b.resolvedAt) : new Date(b.updatedAt);
      return d >= weekStart && d <= weekEnd;
    }).length;

    weeklyTrend.push({
      week: `W${12 - i}`,
      created,
      closed
    });
  }

  // Module/Component Distribution
  const moduleStats = {};
  allBugs.forEach(bug => {
    const mod = bug.module || 'Unspecified';
    if (!moduleStats[mod]) moduleStats[mod] = 0;
    moduleStats[mod]++;
  });
  const moduleDistribution = Object.entries(moduleStats)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    summary,
    currentSnapshot,
    statusDistribution,
    currentSeverityDistribution,
    currentPriorityDistribution,
    arbTrend,
    projectComparison,
    assigneePerformance,
    severityDistribution,
    priorityDistribution,
    dailyActivity,
    projectHealth,
    criticalBugs,
    weekOverWeek,
    activitySummary,
    // New analytics
    topReporters,
    bugAgingChart,
    workloadDistribution,
    environmentDistribution,
    weeklyTrend,
    moduleDistribution
  };
}

function calculateAvgResolutionTime(resolvedBugs) {
  if (resolvedBugs.length === 0) return 0;
  
  const times = resolvedBugs
    .filter(b => b.createdAt && (b.resolvedAt || b.updatedAt))
    .map(b => {
      const created = new Date(b.createdAt);
      const resolved = b.resolvedAt ? new Date(b.resolvedAt) : new Date(b.updatedAt);
      return (resolved - created) / (1000 * 60 * 60 * 24);
    })
    .filter(t => t >= 0 && t < 365);

  if (times.length === 0) return 0;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

function generateHighlights(bugsCreated, bugsResolved, allBugs) {
  const highlights = [];
  
  if (bugsResolved.length > bugsCreated.length) {
    highlights.push(`Bug backlog reduced by ${bugsResolved.length - bugsCreated.length} bugs.`);
  } else if (bugsCreated.length > bugsResolved.length) {
    highlights.push(`Bug backlog increased by ${bugsCreated.length - bugsResolved.length} bugs.`);
  }

  const criticalOpen = allBugs.filter(b => b.severity === 'Critical' && b.status !== 'Closed' && b.status !== 'Resolved').length;
  if (criticalOpen > 0) {
    highlights.push(`${criticalOpen} critical bugs require immediate attention.`);
  }

  const resolutionRate = bugsCreated.length > 0 ? (bugsResolved.length / bugsCreated.length) * 100 : 0;
  if (resolutionRate >= 100) {
    highlights.push('Excellent performance - resolution rate exceeds 100%!');
  } else if (resolutionRate >= 75) {
    highlights.push('Good resolution rate maintained above 75%.');
  } else if (resolutionRate < 50) {
    highlights.push('Resolution rate below 50% - needs improvement.');
  }

  return highlights.join(' ') || 'Standard performance period with no significant highlights.';
}

function generateARBTrend(bugs, start, end) {
  const trend = [];
  const current = new Date(start);
  
  while (current <= end) {
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    const created = bugs.filter(b => {
      const d = new Date(b.createdAt);
      return d >= dayStart && d <= dayEnd;
    }).length;

    const resolved = bugs.filter(b => {
      if (b.status !== 'Resolved' && b.status !== 'Closed') return false;
      const d = b.resolvedAt ? new Date(b.resolvedAt) : new Date(b.updatedAt);
      return d >= dayStart && d <= dayEnd;
    }).length;

    const resolutionRate = created > 0 ? (resolved / created) * 100 : (resolved > 0 ? 100 : 0);

    trend.push({
      date: current.toISOString().split('T')[0],
      created,
      resolved,
      resolutionRate: Math.round(resolutionRate * 10) / 10
    });

    current.setDate(current.getDate() + 1);
  }

  return trend;
}

async function generateProjectComparison(allBugs, bugsCreated, bugsResolved, projectKeys) {
  const projects = {};
  
  try {
    const allProjects = await storage.getAllProjects(null, true);
    allProjects.forEach(p => {
      const key = p.projectKey || p.key;
      if (!projectKeys || projectKeys.length === 0 || projectKeys.includes(key)) {
        projects[key] = { projectKey: key, projectName: p.name, created: 0, resolved: 0 };
      }
    });
  } catch (e) {
    console.error('Error fetching projects:', e);
  }

  bugsCreated.forEach(bug => {
    if (projects[bug.projectKey]) {
      projects[bug.projectKey].created++;
    }
  });

  bugsResolved.forEach(bug => {
    if (projects[bug.projectKey]) {
      projects[bug.projectKey].resolved++;
    }
  });

  return Object.values(projects).sort((a, b) => (b.created + b.resolved) - (a.created + a.resolved));
}

function generateAssigneePerformance(allBugs, resolvedBugs, start, end) {
  const assignees = {};

  allBugs.forEach(bug => {
    if (!bug.assignee) return;
    
    if (!assignees[bug.assignee]) {
      assignees[bug.assignee] = {
        username: bug.assignee,
        assigned: 0,
        resolved: 0,
        open: 0,
        inProgress: 0,
        resolutionTimes: []
      };
    }

    assignees[bug.assignee].assigned++;
    
    if (bug.status === 'Open') assignees[bug.assignee].open++;
    else if (bug.status === 'In Progress') assignees[bug.assignee].inProgress++;
    else if (bug.status === 'Resolved' || bug.status === 'Closed') {
      assignees[bug.assignee].resolved++;
      
      if (bug.createdAt) {
        const created = new Date(bug.createdAt);
        const resolved = bug.resolvedAt ? new Date(bug.resolvedAt) : new Date(bug.updatedAt);
        const days = (resolved - created) / (1000 * 60 * 60 * 24);
        if (days >= 0 && days < 365) {
          assignees[bug.assignee].resolutionTimes.push(days);
        }
      }
    }
  });

  return Object.values(assignees).map(a => ({
    ...a,
    resolutionRate: a.assigned > 0 ? (a.resolved / a.assigned) * 100 : 0,
    avgResolutionTime: a.resolutionTimes.length > 0 
      ? a.resolutionTimes.reduce((x, y) => x + y, 0) / a.resolutionTimes.length 
      : null
  })).sort((a, b) => b.resolved - a.resolved);
}

function generateDistribution(bugs, field, colors) {
  const counts = {};
  bugs.forEach(bug => {
    const value = bug[field] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  });

  return Object.entries(counts).map(([name, value]) => ({
    name,
    value,
    color: colors[name] || '#6b7280'
  }));
}

function generateDailyActivity(bugs, start, end) {
  const activity = [];
  const current = new Date(start);

  while (current <= end) {
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    const created = bugs.filter(b => {
      const d = new Date(b.createdAt);
      return d >= dayStart && d <= dayEnd;
    }).length;

    const resolved = bugs.filter(b => {
      if (b.status !== 'Resolved' && b.status !== 'Closed') return false;
      const d = b.resolvedAt ? new Date(b.resolvedAt) : new Date(b.updatedAt);
      return d >= dayStart && d <= dayEnd;
    }).length;

    activity.push({
      date: current.toISOString().split('T')[0],
      created,
      resolved
    });

    current.setDate(current.getDate() + 1);
  }

  return activity;
}

async function generateProjectHealth(allBugs, projectKeys) {
  const health = [];
  
  try {
    const projects = await storage.getAllProjects(null, true);
    
    for (const project of projects) {
      const key = project.projectKey || project.key;
      if (projectKeys && projectKeys.length > 0 && !projectKeys.includes(key)) continue;

      const projectBugs = allBugs.filter(b => b.projectKey === key);
      const total = projectBugs.length;
      const open = projectBugs.filter(b => b.status === 'Open').length;
      const inProgress = projectBugs.filter(b => b.status === 'In Progress').length;
      const resolved = projectBugs.filter(b => b.status === 'Resolved' || b.status === 'Closed').length;
      const critical = projectBugs.filter(b => b.severity === 'Critical' && b.status !== 'Closed' && b.status !== 'Resolved').length;

      let healthScore = 100;
      if (total > 0) {
        const openRate = (open + inProgress) / total;
        healthScore -= openRate * 30;
        healthScore -= critical * 10;
        healthScore += (resolved / total) * 20;
      }
      healthScore = Math.max(0, Math.min(100, healthScore));

      health.push({
        projectKey: key,
        projectName: project.name,
        total,
        open,
        inProgress,
        resolved,
        critical,
        healthScore
      });
    }
  } catch (e) {
    console.error('Error generating project health:', e);
  }

  return health.sort((a, b) => b.total - a.total);
}

function generateWeekOverWeek(bugs, currentStart, currentEnd) {
  const prevStart = new Date(currentStart);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);

  const currentCreated = bugs.filter(b => {
    const d = new Date(b.createdAt);
    return d >= currentStart && d <= currentEnd;
  }).length;

  const currentResolved = bugs.filter(b => {
    if (b.status !== 'Resolved' && b.status !== 'Closed') return false;
    const d = b.resolvedAt ? new Date(b.resolvedAt) : new Date(b.updatedAt);
    return d >= currentStart && d <= currentEnd;
  }).length;

  const prevCreated = bugs.filter(b => {
    const d = new Date(b.createdAt);
    return d >= prevStart && d <= prevEnd;
  }).length;

  const prevResolved = bugs.filter(b => {
    if (b.status !== 'Resolved' && b.status !== 'Closed') return false;
    const d = b.resolvedAt ? new Date(b.resolvedAt) : new Date(b.updatedAt);
    return d >= prevStart && d <= prevEnd;
  }).length;

  const currentRate = currentCreated > 0 ? (currentResolved / currentCreated) * 100 : (currentResolved > 0 ? 100 : 0);
  const prevRate = prevCreated > 0 ? (prevResolved / prevCreated) * 100 : (prevResolved > 0 ? 100 : 0);

  return {
    currentWeek: { created: currentCreated, resolved: currentResolved, rate: currentRate },
    previousWeek: { created: prevCreated, resolved: prevResolved, rate: prevRate },
    createdChange: prevCreated > 0 ? ((currentCreated - prevCreated) / prevCreated) * 100 : 0,
    resolvedChange: prevResolved > 0 ? ((currentResolved - prevResolved) / prevResolved) * 100 : 0,
    rateChange: prevRate > 0 ? currentRate - prevRate : 0
  };
}

async function generateActivitySummary(bugs, start, end) {
  let comments = 0;
  let statusChanges = 0;
  let reassignments = 0;
  let commits = 0;

  bugs.forEach(bug => {
    const activities = bug.activityLog || bug.activities || [];
    activities.forEach(activity => {
      const actDate = new Date(activity.timestamp || activity.date);
      if (actDate < start || actDate > end) return;

      const action = (activity.action || '').toLowerCase();
      if (action.includes('comment')) comments++;
      else if (action.includes('status')) statusChanges++;
      else if (action.includes('assign') || action.includes('reassign')) reassignments++;
      else if (action.includes('commit')) commits++;
    });
  });

  return { comments, statusChanges, reassignments, commits };
}

// ==================== PDF GENERATION ====================

async function generatePDFReport(data, reportType, startDate, endDate, generatedBy) {
  // Dynamic import for PDFKit
  let PDFDocument;
  try {
    PDFDocument = require('pdfkit');
  } catch (e) {
    console.error('PDFKit not installed. Installing...');
    throw new Error('PDFKit library not available. Please install with: npm install pdfkit');
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 50, bottom: 70, left: 50, right: 50 },
        info: {
          Title: `Mertis ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
          Author: 'Mertis System',
          Subject: `Mertis Report from ${startDate} to ${endDate}`,
          Creator: 'Mertis Report Generator'
        }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100;
      let pageNum = 0;

      // Colors
      const colors = {
        primary: '#4f46e5',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        dark: '#1e293b',
        gray: '#64748b',
        lightGray: '#94a3b8'
      };

      // Get logo path
      const logoPath = getLogoPath();

      // Helper function to add footer to current page (called manually, not via event)
      const addPageFooter = (pageNumber) => {
        const savedY = doc.y;
        doc.fontSize(8)
           .fillColor(colors.gray)
           .text(`${getConfidentialityNotice()} - Do Not Distribute`, 50, doc.page.height - 50, { align: 'center', width: pageWidth })
           .text(`Generated on ${new Date().toLocaleDateString()} by ${generatedBy} | Page ${pageNumber}`, 50, doc.page.height - 38, { align: 'center', width: pageWidth });
        doc.y = savedY;
      };

      // Helper function to add page header with logo (for pages after cover)
      const addPageHeader = () => {
        if (logoPath) {
          try {
            doc.image(logoPath, doc.page.width - 80, 15, { width: 24, height: 24 });
            doc.fontSize(8)
               .fillColor(colors.gray)
               .text('Mertis', doc.page.width - 80, 42, { width: 50, align: 'left' });
          } catch (e) {
            // Logo not available, skip
          }
        }
      };

      // ==================== COVER PAGE ====================
      pageNum = 1;
      doc.rect(0, 0, doc.page.width, 200).fill(colors.primary);
      
      // Add logo to cover page
      let titleStartX = 50;
      if (logoPath) {
        try {
          doc.image(logoPath, 50, 50, { width: 60, height: 60 });
          titleStartX = 120; // Move title to the right of logo
        } catch (e) {
          // Logo not available, continue without it
          console.log('Logo not found at expected path, generating PDF without logo');
        }
      }
      
      doc.fontSize(32)
         .fillColor('white')
         .text('Mertis', titleStartX, 55)
         .fontSize(24)
         .text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, titleStartX, 95);

      doc.fontSize(14)
         .text(`${formatDateRange(startDate, endDate)}`, titleStartX, 135);

      doc.fontSize(12)
         .fillColor(colors.dark)
         .text(`Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 230)
         .text(`Generated by: ${generatedBy}`, 50, 248);

      // Executive Summary Box
      doc.moveDown(2);
      drawSectionHeader(doc, 'Executive Summary', 50, doc.y, pageWidth, colors);

      const summary = data.summary || {};
      doc.moveDown(0.5);
      
      // Summary metrics in a grid
      const metricsY = doc.y;
      const metricWidth = pageWidth / 3;
      
      drawMetricBox(doc, 'Bugs Filed', summary.totalBugsCreated || 0, 50, metricsY, metricWidth - 10, colors.primary);
      drawMetricBox(doc, 'Bugs Resolved', summary.totalBugsResolved || 0, 50 + metricWidth, metricsY, metricWidth - 10, colors.success);
      drawMetricBox(doc, 'Net Change', summary.netChange || 0, 50 + metricWidth * 2, metricsY, metricWidth - 10, summary.netChange > 0 ? colors.warning : colors.success);

      doc.y = metricsY + 70;
      
      drawMetricBox(doc, 'Avg Resolution', `${(summary.avgResolutionTime || 0).toFixed(1)}d`, 50, doc.y, metricWidth - 10, colors.gray);
      drawMetricBox(doc, 'Critical Bugs', summary.criticalBugs || 0, 50 + metricWidth, doc.y, metricWidth - 10, colors.danger);
      drawMetricBox(doc, 'Resolution Rate', `${(summary.resolutionRate || 0).toFixed(1)}%`, 50 + metricWidth * 2, doc.y, metricWidth - 10, colors.primary);

      doc.y += 80;
      doc.fontSize(10)
         .fillColor(colors.dark)
         .text('Highlights:', 50, doc.y, { continued: true, underline: true })
         .text(' ' + (summary.highlights || 'No highlights'), { underline: false });

      addPageFooter(pageNum);

      // ==================== PAGE 2: PROJECT COMPARISON ====================
      doc.addPage();
      pageNum++;
      addPageHeader();
      
      drawSectionHeader(doc, 'Bug Filed vs Resolved per Project', 50, 50, pageWidth, colors);
      doc.y = 90;

      const projectData = data.projectComparison || [];
      if (projectData.length > 0) {
        drawTableSimple(doc, 50, doc.y, pageWidth, 
          ['Project', 'Name', 'Filed', 'Resolved', 'Net', 'Rate'],
          projectData.slice(0, 15).map(p => [
            String(p.projectKey || ''),
            truncateText(String(p.projectName || ''), 20),
            String(p.created || 0),
            String(p.resolved || 0),
            String((p.created || 0) - (p.resolved || 0)),
            p.created > 0 ? `${((p.resolved / p.created) * 100).toFixed(0)}%` : '0%'
          ]),
          colors
        );
      }

      doc.y += 30;
      drawSectionHeader(doc, 'Project Health Summary', 50, doc.y, pageWidth, colors);
      doc.y += 40;

      const healthData = data.projectHealth || [];
      if (healthData.length > 0) {
        drawTableSimple(doc, 50, doc.y, pageWidth,
          ['Project', 'Total', 'Open', 'In Progress', 'Resolved', 'Critical', 'Health'],
          healthData.slice(0, 10).map(p => [
            String(p.projectKey || ''),
            String(p.total || 0),
            String(p.open || 0),
            String(p.inProgress || 0),
            String(p.resolved || 0),
            String(p.critical || 0),
            `${(p.healthScore || 0).toFixed(0)}/100`
          ]),
          colors
        );
      }

      addPageFooter(pageNum);

      // ==================== PAGE 3: ASSIGNEE PERFORMANCE ====================
      doc.addPage();
      pageNum++;
      addPageHeader();
      
      drawSectionHeader(doc, 'Assignee Bug Resolution Status', 50, 50, pageWidth, colors);
      doc.y = 90;

      const assigneeData = data.assigneePerformance || [];
      if (assigneeData.length > 0) {
        drawTableSimple(doc, 50, doc.y, pageWidth,
          ['Assignee', 'Assigned', 'Resolved', 'Open', 'In Progress', 'Rate', 'Avg Time'],
          assigneeData.slice(0, 20).map(a => [
            truncateText(String(a.username || ''), 15),
            String(a.assigned || 0),
            String(a.resolved || 0),
            String(a.open || 0),
            String(a.inProgress || 0),
            `${(a.resolutionRate || 0).toFixed(1)}%`,
            a.avgResolutionTime ? `${a.avgResolutionTime.toFixed(1)}d` : '-'
          ]),
          colors
        );
      }

      addPageFooter(pageNum);

      // ==================== PAGE 4: CRITICAL BUGS ====================
      doc.addPage();
      pageNum++;
      addPageHeader();
      
      drawSectionHeader(doc, 'Critical & High Priority Bugs (Requires Attention)', 50, 50, pageWidth, colors);
      doc.y = 90;

      const criticalBugs = data.criticalBugs || [];
      if (criticalBugs.length > 0) {
        drawTableSimple(doc, 50, doc.y, pageWidth,
          ['Bug ID', 'Title', 'Severity', 'Priority', 'Assignee', 'Age', 'Status'],
          criticalBugs.slice(0, 20).map(b => [
            String(b.bugId || ''),
            truncateText(String(b.title || ''), 25),
            String(b.severity || ''),
            String(b.priority || ''),
            truncateText(String(b.assignee || '-'), 12),
            `${b.age || 0}d`,
            String(b.status || '')
          ]),
          colors
        );

        if (criticalBugs.length > 20) {
          doc.y += 10;
          doc.fontSize(9)
             .fillColor(colors.gray)
             .text(`... and ${criticalBugs.length - 20} more critical/high priority bugs`, 50, doc.y);
        }
      } else {
        doc.fontSize(11)
           .fillColor(colors.success)
           .text('No critical or high priority bugs requiring immediate attention!', 50, doc.y);
      }

      addPageFooter(pageNum);

      // ==================== PAGE 5: DISTRIBUTIONS ====================
      doc.addPage();
      pageNum++;
      addPageHeader();
      
      drawSectionHeader(doc, 'Bug Distribution Analysis', 50, 50, pageWidth, colors);
      doc.y = 90;

      // Severity Distribution
      doc.fontSize(12)
         .fillColor(colors.dark)
         .text('Severity Distribution:', 50, doc.y, { underline: true });
      doc.y += 20;

      const severityData = data.severityDistribution || [];
      const maxSeverity = Math.max(...severityData.map(s => s.value || 0), 1);
      severityData.forEach((item) => {
        const barWidth = Math.min(((item.value || 0) / maxSeverity) * 200, 200);
        doc.rect(50, doc.y, barWidth, 15).fill(item.color || colors.gray);
        doc.fontSize(9)
           .fillColor(colors.dark)
           .text(`${item.name || 'Unknown'}: ${item.value || 0}`, 260, doc.y + 3);
        doc.y += 22;
      });

      doc.y += 20;
      doc.fontSize(12)
         .fillColor(colors.dark)
         .text('Priority Distribution:', 50, doc.y, { underline: true });
      doc.y += 20;

      const priorityData = data.priorityDistribution || [];
      const maxPriority = Math.max(...priorityData.map(p => p.value || 0), 1);
      priorityData.forEach((item) => {
        const barWidth = Math.min(((item.value || 0) / maxPriority) * 200, 200);
        doc.rect(50, doc.y, barWidth, 15).fill(item.color || colors.gray);
        doc.fontSize(9)
           .fillColor(colors.dark)
           .text(`${item.name || 'Unknown'}: ${item.value || 0}`, 260, doc.y + 3);
        doc.y += 22;
      });

      // Activity Summary
      doc.y += 30;
      drawSectionHeader(doc, 'Activity Summary', 50, doc.y, pageWidth, colors);
      doc.y += 40;

      const activity = data.activitySummary || {};
      const activityMetrics = [
        ['Comments Added', activity.comments || 0],
        ['Status Changes', activity.statusChanges || 0],
        ['Reassignments', activity.reassignments || 0],
        ['Commits Linked', activity.commits || 0]
      ];

      activityMetrics.forEach((metric, i) => {
        doc.fontSize(10)
           .fillColor(colors.dark)
           .text(`${metric[0]}:`, 50 + (i % 2) * 250, doc.y + Math.floor(i / 2) * 25)
           .fontSize(12)
           .fillColor(colors.primary)
           .text(String(metric[1]), 180 + (i % 2) * 250, doc.y + Math.floor(i / 2) * 25 - 2);
      });

      addPageFooter(pageNum);

      // ==================== PAGE 6: DAILY TREND ====================
      doc.addPage();
      pageNum++;
      addPageHeader();
      
      drawSectionHeader(doc, 'Daily Bug Activity Trend', 50, 50, pageWidth, colors);
      doc.y = 90;

      const dailyData = data.dailyActivity || [];
      if (dailyData.length > 0) {
        const maxVal = Math.max(...dailyData.map(d => Math.max(d.created || 0, d.resolved || 0)), 1);
        
        drawTableSimple(doc, 50, doc.y, pageWidth,
          ['Date', 'Created', 'Resolved', 'Net', 'Trend'],
          dailyData.slice(-14).map(d => [
            String(d.date || ''),
            String(d.created || 0),
            String(d.resolved || 0),
            String((d.created || 0) - (d.resolved || 0)),
            '|'.repeat(Math.ceil(((d.created || 0) / maxVal) * 10)) + ' / ' + '|'.repeat(Math.ceil(((d.resolved || 0) / maxVal) * 10))
          ]),
          colors
        );
      }

      // Week over Week (if weekly report)
      if (data.weekOverWeek) {
        doc.y += 30;
        drawSectionHeader(doc, 'Week over Week Comparison', 50, doc.y, pageWidth, colors);
        doc.y += 40;

        const wow = data.weekOverWeek;
        doc.fontSize(10).fillColor(colors.dark);
        
        doc.text(`Current Week - Filed: ${wow.currentWeek?.created || 0}, Resolved: ${wow.currentWeek?.resolved || 0}, Rate: ${(wow.currentWeek?.rate || 0).toFixed(1)}%`, 50, doc.y);
        doc.y += 18;
        doc.text(`Previous Week - Filed: ${wow.previousWeek?.created || 0}, Resolved: ${wow.previousWeek?.resolved || 0}, Rate: ${(wow.previousWeek?.rate || 0).toFixed(1)}%`, 50, doc.y);
        doc.y += 18;
        
        const createdTrend = wow.createdChange >= 0 ? 'â–²' : 'â–¼';
        const resolvedTrend = wow.resolvedChange >= 0 ? 'â–²' : 'â–¼';
        
        doc.fillColor(wow.createdChange > 0 ? colors.warning : colors.success)
           .text(`Filed Change: ${createdTrend} ${Math.abs(wow.createdChange || 0).toFixed(1)}%`, 50, doc.y);
        doc.y += 18;
        doc.fillColor(wow.resolvedChange >= 0 ? colors.success : colors.danger)
           .text(`Resolved Change: ${resolvedTrend} ${Math.abs(wow.resolvedChange || 0).toFixed(1)}%`, 50, doc.y);
      }

      addPageFooter(pageNum);

      // ==================== FINAL PAGE: SUMMARY ====================
      doc.addPage();
      pageNum++;
      
      doc.rect(0, 0, doc.page.width, 120).fill(colors.primary);
      
      // Add logo to final page header
      let finalTitleX = 50;
      if (logoPath) {
        try {
          doc.image(logoPath, 50, 35, { width: 50, height: 50 });
          finalTitleX = 110;
        } catch (e) {
          // Logo not available
        }
      }
      
      doc.fontSize(24)
         .fillColor('white')
         .text('Report Summary', finalTitleX, 40)
         .fontSize(12)
         .text(`Period: ${formatDateRange(startDate, endDate)}`, finalTitleX, 75);

      doc.y = 150;
      doc.fontSize(11)
         .fillColor(colors.dark);

      const summaryPoints = [
        `â€¢ Total bugs filed during this period: ${data.summary?.totalBugsCreated || 0}`,
        `â€¢ Total bugs resolved during this period: ${data.summary?.totalBugsResolved || 0}`,
        `â€¢ Overall resolution rate: ${(data.summary?.resolutionRate || 0).toFixed(1)}%`,
        `â€¢ Average resolution time: ${(data.summary?.avgResolutionTime || 0).toFixed(1)} days`,
        `â€¢ Critical bugs requiring attention: ${data.summary?.criticalBugs || 0}`,
        `â€¢ Projects covered: ${(data.projectHealth || []).length}`,
        `â€¢ Team members with assignments: ${(data.assigneePerformance || []).length}`
      ];

      summaryPoints.forEach(point => {
        doc.text(point, 50, doc.y);
        doc.y += 22;
      });

      doc.y += 30;
      doc.fontSize(10)
         .fillColor(colors.gray)
         .text('This report was automatically generated by the Mertis system.', 50, doc.y)
         .text('For questions or concerns, please contact your project administrator.', 50, doc.y + 15);

      // Final footer with logo
      doc.y = doc.page.height - 120;
      
      // Centered logo above confidential notice
      if (logoPath) {
        try {
          const logoX = (doc.page.width - 40) / 2;
          doc.image(logoPath, logoX, doc.y, { width: 40, height: 40 });
          doc.y += 50;
        } catch (e) {
          // Logo not available
        }
      }
      
      doc.fontSize(9)
         .fillColor(colors.danger)
         .text(getConfidentialityNotice(), 50, doc.y, { align: 'center', width: pageWidth });

      // Add footer to final page
      addPageFooter(pageNum);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Helper functions for PDF generation
function formatDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

function drawSectionHeader(doc, title, x, y, width, colors) {
  doc.rect(x, y, width, 28).fill(colors.dark);
  doc.fontSize(14)
     .fillColor('white')
     .text(title, x + 10, y + 7);
}

function drawMetricBox(doc, label, value, x, y, width, color) {
  doc.rect(x, y, width, 55).fill('#f1f5f9');
  doc.rect(x, y, 4, 55).fill(color);
  
  doc.fontSize(20)
     .fillColor(color)
     .text(value.toString(), x + 15, y + 10, { width: width - 20 });
  
  doc.fontSize(9)
     .fillColor('#64748b')
     .text(label.toUpperCase(), x + 15, y + 38, { width: width - 20 });
}

// Simple table drawing function - no automatic page breaks (data should be pre-sliced)
function drawTableSimple(doc, x, y, width, headers, rows, colors) {
  const colWidths = headers.map(() => width / headers.length);
  const rowHeight = 20;
  const headerHeight = 25;

  // Header
  doc.rect(x, y, width, headerHeight).fill(colors.dark);
  doc.fontSize(8).fillColor('white');
  
  let currentX = x;
  headers.forEach((header, i) => {
    doc.text(String(header || ''), currentX + 5, y + 8, { width: colWidths[i] - 10 });
    currentX += colWidths[i];
  });

  // Rows
  let currentY = y + headerHeight;
  rows.forEach((row, rowIndex) => {
    // Safety check - don't draw beyond page
    if (currentY + rowHeight > doc.page.height - 80) {
      return; // Skip remaining rows rather than adding pages
    }

    const bgColor = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
    doc.rect(x, currentY, width, rowHeight).fill(bgColor);
    
    doc.fontSize(8).fillColor(colors.dark);
    currentX = x;
    row.forEach((cell, i) => {
      doc.text(String(cell || '-'), currentX + 5, currentY + 6, { width: colWidths[i] - 10 });
      currentX += colWidths[i];
    });
    
    currentY += rowHeight;
  });

  doc.y = currentY + 10;
}

// Legacy function name for compatibility
function drawTable(doc, x, y, width, headers, rows, colors) {
  return drawTableSimple(doc, x, y, width, headers, rows, colors);
}

module.exports = router;
