/**
 * EMAIL SERVICE - ENHANCED
 * Generates elaborate email reports matching the ReportGenerator dashboard format
 * Includes AI-generated insights via OpenAI API (using existing OPENAI_API_KEY)
 * 
 * Location: server/services/emailService.js
 * 
 * Required packages:
 * npm install nodemailer node-cron openai --save
 */

const nodemailer = require('nodemailer');
const cron = require('node-cron');
const storage = require('../storage');

const query = async (sql, params = []) => {
  if (!storage.isSqlStorage()) {
    const err = new Error('Email service requires MySQL or PostgreSQL');
    err.code = 'EMAIL_STORAGE_UNAVAILABLE';
    throw err;
  }
  return require('../storage/sqlDb')().query(sql, params);
};

class EmailService {
  constructor() {
    this.transporter = null;
    this.scheduledJobs = new Map();
    this.isInitialized = false;
  }

  // ==================== SMTP CONFIGURATION ====================

  async initializeTransporter() {
    try {
      const configs = await query(
        'SELECT * FROM email_config WHERE is_active = TRUE LIMIT 1'
      );

      if (!configs || configs.length === 0) {
        console.log('[EmailService] No active SMTP configuration found');
        this.transporter = null;
        return false;
      }

      const config = configs[0];
      
      this.transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure,
        auth: {
          user: config.smtp_user,
          pass: config.smtp_password
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await this.transporter.verify();
      console.log('[EmailService] SMTP connection verified successfully');
      this.isInitialized = true;
      return true;

    } catch (error) {
      if (error.code === 'EMAIL_STORAGE_UNAVAILABLE') {
        console.log(`[EmailService] ${error.message}`);
        return false;
      }
      console.error('[EmailService] SMTP initialization error:', error.message);
      this.transporter = null;
      this.isInitialized = false;
      return false;
    }
  }

  async testConnection(smtpConfig) {
    try {
      const testTransporter = nodemailer.createTransport({
        host: smtpConfig.smtp_host,
        port: smtpConfig.smtp_port,
        secure: smtpConfig.smtp_secure,
        auth: {
          user: smtpConfig.smtp_user,
          pass: smtpConfig.smtp_password
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      await testTransporter.verify();
      return { success: true, message: 'SMTP connection successful' };

    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ==================== SEND TEST EMAIL (Full Monthly Report) ====================

  async sendTestEmail(toEmail) {
    if (!this.transporter) {
      await this.initializeTransporter();
    }

    if (!this.transporter) {
      throw new Error('No active SMTP configuration');
    }

    const configs = await query(
      'SELECT from_email, from_name, logo_url, company_name FROM email_config WHERE is_active = TRUE LIMIT 1'
    );
    const config = configs[0];

    // Generate a full monthly report as test
    const testReport = {
      report_name: 'Test Monthly Report',
      report_type: 'monthly',
      projects: null,
      include_ai_insights: true
    };

    const reportData = await this.generateFullReportData(testReport);
    const aiInsights = await this.generateAIInsights(reportData, 'monthly');
    
    // Pass email config for logo and company name
    const emailConfig = { logo_url: config.logo_url, company_name: config.company_name };
    const htmlContent = this.generateFullReportEmailHTML(testReport, reportData, aiInsights, emailConfig);

    const subject = `[TEST] Monthly Bug Report - ${new Date().toLocaleDateString()}`;

    const info = await this.transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent
    });

    return info;
  }

  // ==================== EMAIL SENDING ====================

  async sendReportEmail(recipients, subject, htmlContent, attachments = []) {
    if (!this.transporter) {
      await this.initializeTransporter();
    }

    if (!this.transporter) {
      throw new Error('No active SMTP configuration');
    }

    const configs = await query(
      'SELECT from_email, from_name FROM email_config WHERE is_active = TRUE LIMIT 1'
    );
    const config = configs[0];

    const info = await this.transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: recipients.join(', '),
      subject: subject,
      html: htmlContent,
      attachments: attachments
    });

    return info;
  }

  // ==================== SCHEDULED REPORTS ====================

  async loadScheduledReports() {
    try {
      const reports = await query(`
        SELECT sr.*, GROUP_CONCAT(rr.email) as recipient_emails
        FROM scheduled_reports sr
        LEFT JOIN report_recipients rr ON sr.id = rr.scheduled_report_id AND rr.is_active = TRUE
        WHERE sr.is_active = TRUE
        GROUP BY sr.id
      `);

      this.scheduledJobs.forEach((job) => job.stop());
      this.scheduledJobs.clear();

      for (const report of reports) {
        if (report.recipient_emails) {
          this.scheduleReport(report);
        }
      }

      console.log(`[EmailService] Loaded ${reports.length} scheduled reports`);
      return reports;

    } catch (error) {
      if (error.code === 'EMAIL_STORAGE_UNAVAILABLE') {
        console.log(`[EmailService] ${error.message}`);
        return [];
      }
      console.error('[EmailService] Error loading scheduled reports:', error.message);
      return [];
    }
  }

  scheduleReport(report) {
    const cronExpression = this.getCronExpression(report);
    
    if (!cronExpression) {
      console.error(`[EmailService] Invalid schedule for report ${report.id}`);
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      console.log(`[EmailService] Running scheduled report: ${report.report_name}`);
      await this.executeScheduledReport(report.id);
    }, {
      timezone: report.timezone || 'UTC'
    });

    this.scheduledJobs.set(report.id, job);
    console.log(`[EmailService] Scheduled report ${report.id}: ${report.report_name} with cron: ${cronExpression}`);
  }

  getCronExpression(report) {
    const [hours, minutes] = (report.send_time || '09:00:00').split(':');
    
    switch (report.frequency) {
      case 'daily':
        return `${minutes} ${hours} * * *`;
      case 'weekly':
        return `${minutes} ${hours} * * ${report.day_of_week || 1}`;
      case 'biweekly':
        return `${minutes} ${hours} 1-7,15-21 * ${report.day_of_week || 1}`;
      case 'monthly':
        return `${minutes} ${hours} ${report.day_of_month || 1} * *`;
      default:
        return null;
    }
  }

  async executeScheduledReport(reportId) {
    let logId = null;
    
    try {
      const reports = await query(`
        SELECT sr.*, GROUP_CONCAT(rr.email) as recipient_emails
        FROM scheduled_reports sr
        LEFT JOIN report_recipients rr ON sr.id = rr.scheduled_report_id AND rr.is_active = TRUE
        WHERE sr.id = ? AND sr.is_active = TRUE
        GROUP BY sr.id
      `, [reportId]);

      if (reports.length === 0) {
        console.error(`[EmailService] Report ${reportId} not found or inactive`);
        return;
      }

      const report = reports[0];
      const recipients = report.recipient_emails ? report.recipient_emails.split(',') : [];

      if (recipients.length === 0) {
        console.log(`[EmailService] No recipients for report ${reportId}`);
        return;
      }

      // Create log entry
      const logResult = await query(
        'INSERT INTO email_log (scheduled_report_id, recipients, subject, status) VALUES (?, ?, ?, ?)',
        [reportId, JSON.stringify(recipients), `${report.report_name} - ${new Date().toLocaleDateString()}`, 'pending']
      );
      logId = logResult.insertId;

      // Generate comprehensive report data
      const reportData = await this.generateFullReportData(report);
      
      // Generate AI insights if enabled
      let aiInsights = null;
      if (report.include_ai_insights) {
        aiInsights = await this.generateAIInsights(reportData, report.report_type);
      }
      
      // Fetch email config for logo and company name
      const emailConfigs = await query('SELECT logo_url, company_name FROM email_config WHERE is_active = TRUE LIMIT 1');
      const emailConfig = emailConfigs?.[0] || {};
      
      // Generate full HTML email
      const htmlContent = this.generateFullReportEmailHTML(report, reportData, aiInsights, emailConfig);

      const subject = `[${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)}] ${report.report_name} - ${new Date().toLocaleDateString()}`;
      
      await this.sendReportEmail(recipients, subject, htmlContent);

      // Update log and report
      await query('UPDATE email_log SET status = ?, sent_at = NOW() WHERE id = ?', ['sent', logId]);
      await query('UPDATE scheduled_reports SET last_sent_at = NOW() WHERE id = ?', [reportId]);

      console.log(`[EmailService] Successfully sent report ${reportId} to ${recipients.length} recipients`);

    } catch (error) {
      console.error(`[EmailService] Error executing report ${reportId}:`, error);
      
      if (logId) {
        await query('UPDATE email_log SET status = ?, error_message = ? WHERE id = ?', ['failed', error.message, logId]);
      }
    }
  }

  // ==================== COMPREHENSIVE REPORT DATA ====================

  async generateFullReportData(report) {
	const safeParseJSON = (val, fallback = []) => {
	  if (val === null || val === undefined) return fallback;  
	  if (Array.isArray(val)) return val;  
	  if (typeof val !== 'string') return fallback;  
	  const trimmed = val.trim();  
	  if (!trimmed) return fallback;  
	    
	  try {  
	    const parsed = JSON.parse(trimmed);  
	    return Array.isArray(parsed) ? parsed : fallback;  
	  } catch (e) {  
	    console.warn(  
	  	`[EmailService] Invalid projects JSON for reportId=${report?.id}: len=${trimmed.length}. Falling back to [].`  
	    );  
	    return fallback;  
	  }
    };  
	  
    const projects = safeParseJSON(report.projects);
    const projectFilter = projects.length > 0 ? projects : null;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    if (report.report_type === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    // Previous period for comparison
    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(startDate);
    if (report.report_type === 'weekly') {
      prevStartDate.setDate(prevStartDate.getDate() - 7);
    } else {
      prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    }

    let projectClause = '';
    let projectParams = [];
    if (projectFilter && projectFilter.length > 0) {
      projectClause = 'AND p.project_key IN (?)';
      projectParams = [projectFilter];
    }

    // 1. Current Bug Status (snapshot)
    const currentStatus = await query(`
      SELECT 
        COUNT(*) as totalBugs,
        SUM(CASE WHEN b.status = 'Open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN b.status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN b.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN b.status = 'Closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN b.severity = 'Critical' AND b.status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN b.severity = 'High' AND b.status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as high
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE 1=1 ${projectClause}
    `, projectParams);

    // 2. Period Activity Summary
    const periodActivity = await query(`
      SELECT 
        COUNT(CASE WHEN b.created_at >= ? AND b.created_at <= ? THEN 1 END) as bugsCreated,
        COUNT(CASE WHEN b.closed_at >= ? AND b.closed_at <= ? THEN 1 END) as bugsResolved,
        AVG(CASE WHEN b.closed_at >= ? AND b.closed_at <= ? AND b.closed_at IS NOT NULL 
            THEN DATEDIFF(b.closed_at, b.created_at) END) as avgResolutionDays
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE 1=1 ${projectClause}
    `, [startDate, endDate, startDate, endDate, startDate, endDate, ...projectParams]);

    // Previous period for comparison
    const prevPeriodActivity = await query(`
      SELECT 
        COUNT(CASE WHEN b.created_at >= ? AND b.created_at <= ? THEN 1 END) as bugsCreated,
        COUNT(CASE WHEN b.closed_at >= ? AND b.closed_at <= ? THEN 1 END) as bugsResolved
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE 1=1 ${projectClause}
    `, [prevStartDate, prevEndDate, prevStartDate, prevEndDate, ...projectParams]);

    // 3. Severity Distribution
    const severityDist = await query(`
      SELECT severity, COUNT(*) as count
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE b.status NOT IN ('Resolved', 'Closed') ${projectClause}
      GROUP BY severity
      ORDER BY FIELD(severity, 'Critical', 'High', 'Medium', 'Low')
    `, projectParams);

    // 4. Priority Distribution
    const priorityDist = await query(`
      SELECT priority, COUNT(*) as count
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE b.status NOT IN ('Resolved', 'Closed') ${projectClause}
      GROUP BY priority
      ORDER BY FIELD(priority, 'Urgent', 'High', 'Medium', 'Low')
    `, projectParams);

    // 5. Project Health
    const projectHealth = await query(`
      SELECT 
        p.project_key as projectKey,
        p.name as projectName,
        COUNT(*) as totalBugs,
        SUM(CASE WHEN b.status = 'Open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN b.status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN b.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN b.status = 'Closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN b.severity = 'Critical' AND b.status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as critical
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE 1=1 ${projectClause}
      GROUP BY p.id
      ORDER BY critical DESC, open DESC
    `, projectParams);

    // 6. Team Performance
    const teamPerformance = await query(`
      SELECT 
        COALESCE(b.assignee, 'Unassigned') as assignee,
        COUNT(*) as assigned,
        SUM(CASE WHEN b.status IN ('Open', 'In Progress') THEN 1 ELSE 0 END) as openInProgress,
        SUM(CASE WHEN b.status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as resolved,
        AVG(CASE WHEN b.closed_at IS NOT NULL THEN DATEDIFF(b.closed_at, b.created_at) END) as avgResolutionDays
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      
      WHERE 1=1 ${projectClause}
      GROUP BY b.assignee
      ORDER BY resolved DESC
      LIMIT 10
    `, projectParams);

    // 7. Top Contributors (resolved bugs in period)
    const topContributors = await query(`
      SELECT 
        b.assignee as username,
        COUNT(*) as resolved
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      
      WHERE b.closed_at >= ? AND b.closed_at <= ? 
        AND b.assignee IS NOT NULL
        ${projectClause}
      GROUP BY b.assignee
      ORDER BY resolved DESC
      LIMIT 5
    `, [startDate, endDate, ...projectParams]);

    // 8. Bug Aging Analysis
    const bugAging = await query(`
      SELECT 
        CASE 
          WHEN DATEDIFF(NOW(), b.created_at) <= 3 THEN '< 3 days'
          WHEN DATEDIFF(NOW(), b.created_at) <= 7 THEN '3-7 days'
          WHEN DATEDIFF(NOW(), b.created_at) <= 14 THEN '7-14 days'
          ELSE '> 14 days'
        END as ageGroup,
        COUNT(*) as count
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE b.status NOT IN ('Resolved', 'Closed') ${projectClause}
      GROUP BY ageGroup
      ORDER BY FIELD(ageGroup, '< 3 days', '3-7 days', '7-14 days', '> 14 days')
    `, projectParams);

    // 9. Critical Bugs List
    const criticalBugs = await query(`
      SELECT 
        b.bug_id as bugId, b.title, p.project_key as projectKey, b.severity, b.priority,
        COALESCE(b.assignee, 'Unassigned') as assignee, b.status,
        DATEDIFF(NOW(), b.created_at) as age
      FROM bugs b
      JOIN projects p ON b.project_id = p.id
      WHERE b.severity IN ('Critical', 'High') 
        AND b.status NOT IN ('Resolved', 'Closed')
        ${projectClause}
      ORDER BY FIELD(b.severity, 'Critical', 'High'), b.created_at ASC
      LIMIT 15
    `, projectParams);

    // 10. Activity Summary (comments, status changes)
    const activitySummary = await query(`
      SELECT 
        SUM(CASE WHEN ba.action = 'comment' THEN 1 ELSE 0 END) as comments,
        SUM(CASE WHEN ba.action = 'status_change' THEN 1 ELSE 0 END) as statusChanges,
        SUM(CASE WHEN ba.action = 'assigned' THEN 1 ELSE 0 END) as reassignments,
        SUM(CASE WHEN ba.action = 'commit' THEN 1 ELSE 0 END) as commits
      FROM bug_activity ba
      JOIN bugs b ON ba.bug_id = b.bug_id
      JOIN projects p ON b.project_id = p.id
      WHERE ba.created_at >= ? AND ba.created_at <= ? ${projectClause}
    `, [startDate, endDate, ...projectParams]);

    // Calculate metrics
    const current = currentStatus[0] || {};
    const period = periodActivity[0] || {};
    const prevPeriod = prevPeriodActivity[0] || {};
    const activity = activitySummary[0] || {};

    const bugsCreated = Number(period.bugsCreated) || 0;
    const bugsResolved = Number(period.bugsResolved) || 0;
    const prevCreated = Number(prevPeriod.bugsCreated) || 0;
    const prevResolved = Number(prevPeriod.bugsResolved) || 0;

    const resolutionRate = bugsCreated > 0 ? (bugsResolved / bugsCreated) * 100 : 0;
    const prevResolutionRate = prevCreated > 0 ? (prevResolved / prevCreated) * 100 : 0;

    return {
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        reportType: report.report_type
      },
      currentStatus: {
        totalBugs: Number(current.totalBugs) || 0,
        open: Number(current.open) || 0,
        inProgress: Number(current.inProgress) || 0,
        resolved: Number(current.resolved) || 0,
        closed: Number(current.closed) || 0,
        critical: Number(current.critical) || 0,
        high: Number(current.high) || 0
      },
      periodSummary: {
        bugsCreated,
        bugsResolved,
        netChange: bugsCreated - bugsResolved,
        avgResolutionDays: Number(period.avgResolutionDays) || 0,
        resolutionRate
      },
      comparison: {
        prevBugsCreated: prevCreated,
        prevBugsResolved: prevResolved,
        prevResolutionRate,
        createdChange: prevCreated > 0 ? ((bugsCreated - prevCreated) / prevCreated) * 100 : 0,
        resolvedChange: prevResolved > 0 ? ((bugsResolved - prevResolved) / prevResolved) * 100 : 0,
        rateChange: prevResolutionRate > 0 ? resolutionRate - prevResolutionRate : 0
      },
      severityDistribution: severityDist,
      priorityDistribution: priorityDist,
      projectHealth: projectHealth.map(p => ({
        ...p,
        healthScore: this.calculateHealthScore(p)
      })),
      teamPerformance: teamPerformance.map(t => ({
        ...t,
        resolutionRate: t.assigned > 0 ? (t.resolved / t.assigned) * 100 : 0
      })),
      topContributors,
      bugAging,
      criticalBugs,
      activitySummary: {
        comments: Number(activity.comments) || 0,
        statusChanges: Number(activity.statusChanges) || 0,
        reassignments: Number(activity.reassignments) || 0,
        commits: Number(activity.commits) || 0
      }
    };
  }

  calculateHealthScore(project) {
    const total = Number(project.totalBugs) || 0;
    if (total === 0) return 100;

    const critical = Number(project.critical) || 0;
    const open = Number(project.open) || 0;
    const resolved = Number(project.resolved) || 0;
    const closed = Number(project.closed) || 0;

    const completionRate = ((resolved + closed) / total) * 100;
    const criticalPenalty = critical * 15;
    const openPenalty = (open / total) * 30;

    return Math.max(0, Math.min(100, Math.round(completionRate - criticalPenalty - openPenalty)));
  }

  // ==================== AI INSIGHTS GENERATION (OpenAI) ====================

  async generateAIInsights(reportData, reportType) {
    try {
      const openaiKey = require('../config/deployment.config').getAiConfig().apiKey;
      
      if (!openaiKey) {
        console.log('[EmailService] No OPENAI_API_KEY, using fallback insights');
        return this.generateFallbackInsights(reportData, reportType);
      }

      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: openaiKey });

      // Compress data for efficient token usage
      const miniData = this.compressReportData(reportData);

      // Optimized prompt matching your existing pattern
      const prompt = `Bug ${reportType} report: ${JSON.stringify(miniData)}
Write PM commentary as JSON:
{"exec":"2-3 sentence executive summary","team":"1 sentence about team performance","proj":"1 sentence about project health","risk":"HIGH/MED/LOW: reason","recs":["action1","action2","action3"],"close":"1 encouraging sentence"}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a PM writing concise bug report summaries. Respond with JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 400
      });

      const responseText = completion.choices[0]?.message?.content || '';
      
      console.log('[EmailService] AI tokens used:', completion.usage?.total_tokens || 'unknown');

      // Parse the JSON response
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            summary: parsed.exec || parsed.executiveSummary || '',
            teamAnalysis: parsed.team || parsed.teamAnalysis || '',
            projectAnalysis: parsed.proj || parsed.projectAnalysis || '',
            riskAssessment: parsed.risk || parsed.riskAssessment || '',
            recommendations: parsed.recs || parsed.recommendations || [],
            closingNote: parsed.close || parsed.closingNote || ''
          };
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('[EmailService] AI parse error:', parseError.message);
        return this.generateFallbackInsights(reportData, reportType);
      }

    } catch (error) {
      console.error('[EmailService] AI insights error:', error.message);
      return this.generateFallbackInsights(reportData, reportType);
    }
  }

  // Compress report data for minimal token usage
  compressReportData(data) {
    const s = data.periodSummary || {};
    const c = data.currentStatus || {};
    const ph = data.projectHealth || [];
    const tp = data.teamPerformance || [];
    const cb = data.criticalBugs || [];
    const tc = data.topContributors || [];

    return {
      filed: s.bugsCreated || 0,
      resolved: s.bugsResolved || 0,
      rate: Math.round(s.resolutionRate || 0),
      net: s.netChange || 0,
      crit: c.critical || 0,
      high: c.high || 0,
      open: c.open || 0,
      aging: cb.filter(b => (b.age || 0) > 7).length,
      healthy: ph.filter(p => (p.healthScore || 0) >= 70).length,
      total_proj: ph.length,
      atRisk: ph.filter(p => (p.healthScore || 0) < 40).map(p => p.projectKey).slice(0, 3),
      top: tc.slice(0, 2).map(u => ({ n: u.username, r: u.resolved }))
    };
  }

  generateFallbackInsights(data, reportType) {
    const { periodSummary, currentStatus, comparison, topContributors, projectHealth, teamPerformance, criticalBugs } = data;
    
    const rate = Number(periodSummary.resolutionRate) || 0;
    const net = Number(periodSummary.netChange) || 0;
    const crit = Number(currentStatus.critical) || 0;
    const aging = criticalBugs.filter(b => (Number(b.age) || 0) > 7).length;

    // Executive Summary
    let summary = '';
    if (rate >= 100) {
      summary = `Strong ${reportType}! Resolved more than filed, backlog down by ${Math.abs(net)}. `;
    } else if (rate >= 70) {
      summary = `Good progress: ${rate.toFixed(0)}% resolution rate, ${periodSummary.bugsResolved || 0} bugs closed. `;
    } else if (rate >= 40) {
      summary = `Moderate ${reportType}: ${rate.toFixed(0)}% rate. Backlog needs focus. `;
    } else {
      summary = `Challenging ${reportType}: ${rate.toFixed(0)}% rate, backlog grew by ${net}. `;
    }
    summary += crit > 0 ? `${crit} critical bugs pending.` : 'No critical bugs.';

    // Team Analysis
    const top = topContributors[0];
    const totalRes = teamPerformance.reduce((sum, u) => sum + (Number(u.resolved) || 0), 0);
    const teamAnalysis = top 
      ? `${totalRes} bugs resolved this period. ${top.username} led with ${top.resolved}.`
      : `${teamPerformance.length} team members contributed.`;

    // Project Analysis
    const healthy = projectHealth.filter(p => (p.healthScore || 0) >= 70).length;
    const atRisk = projectHealth.filter(p => (p.healthScore || 0) < 40).map(p => p.project_key);
    let projectAnalysis = `${healthy}/${projectHealth.length} projects healthy.`;
    if (atRisk.length > 0) projectAnalysis += ` At-risk: ${atRisk.join(', ')}.`;

    // Risk Assessment
    let riskAssessment = 'LOW RISK: Issues addressed promptly.';
    if (aging > 5 || crit > 10) riskAssessment = `HIGH RISK: ${aging} bugs aging >7 days, ${crit} critical.`;
    else if (aging > 0 || crit > 5) riskAssessment = `MEDIUM RISK: ${aging} aging bugs need attention.`;

    // Recommendations
    const recommendations = [];
    if (crit > 0) recommendations.push(`Prioritize ${crit} critical bugs`);
    if (rate < 50) recommendations.push('Review capacity for bug focus');
    if (aging > 0) recommendations.push(`Address ${aging} aging bugs`);
    if (atRisk.length > 0) recommendations.push('Health-check at-risk projects');
    if (net > 5) recommendations.push('Schedule backlog grooming');
    while (recommendations.length < 3) recommendations.push('Continue monitoring metrics');

    // Closing Note
    const closingNote = rate >= 80 ? "Excellent work! Keep it up." 
      : rate >= 60 ? "Good progress. Stay focused." 
      : "Let's discuss improvement strategies.";

    return {
      summary,
      teamAnalysis,
      projectAnalysis,
      riskAssessment,
      recommendations: recommendations.slice(0, 3),
      closingNote
    };
  }

  // ==================== QUICKCHART.IO HELPERS ====================
  
  // Generate chart image URL using QuickChart.io
  generateChartUrl(config) {
    const chartConfig = encodeURIComponent(JSON.stringify(config));
    return `https://quickchart.io/chart?c=${chartConfig}&w=400&h=250&bkg=white`;
  }

  // Generate pie chart for status distribution
  generateStatusPieChart(currentStatus) {
    const config = {
      type: 'doughnut',
      data: {
        labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
        datasets: [{
          data: [
            Number(currentStatus.open) || 0,
            Number(currentStatus.inProgress) || 0,
            Number(currentStatus.resolved) || 0,
            Number(currentStatus.closed) || 0
          ],
          backgroundColor: ['#3b82f6', '#8b5cf6', '#22c55e', '#6b7280']
        }]
      },
      options: {
        plugins: {
          legend: { position: 'right' },
          datalabels: { color: '#fff', font: { weight: 'bold' } }
        }
      }
    };
    return this.generateChartUrl(config);
  }

  // Generate bar chart for severity distribution
  generateSeverityBarChart(severityDistribution) {
    const config = {
      type: 'bar',
      data: {
        labels: severityDistribution.map(s => s.severity),
        datasets: [{
          label: 'Count',
          data: severityDistribution.map(s => Number(s.count) || 0),
          backgroundColor: severityDistribution.map(s => {
            const colors = { Critical: '#dc2626', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };
            return colors[s.severity] || '#6b7280';
          })
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    };
    return this.generateChartUrl(config);
  }

  // Generate bar chart for priority distribution
  generatePriorityBarChart(priorityDistribution) {
    const config = {
      type: 'bar',
      data: {
        labels: priorityDistribution.map(p => p.priority),
        datasets: [{
          label: 'Count',
          data: priorityDistribution.map(p => Number(p.count) || 0),
          backgroundColor: priorityDistribution.map(p => {
            const colors = { Critical: '#dc2626', High: '#f97316', Medium: '#eab308', Low: '#22c55e', Urgent: '#dc2626' };
            return colors[p.priority] || '#6b7280';
          })
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    };
    return this.generateChartUrl(config);
  }

  // Generate bar chart for team performance
  generateTeamBarChart(teamPerformance) {
    const topTeam = teamPerformance.slice(0, 8);
    const config = {
      type: 'bar',
      data: {
        labels: topTeam.map(t => t.assignee?.substring(0, 12) || 'Unknown'),
        datasets: [
          {
            label: 'Resolved',
            data: topTeam.map(t => Number(t.resolved) || 0),
            backgroundColor: '#22c55e'
          },
          {
            label: 'Open/In Progress',
            data: topTeam.map(t => Number(t.openInProgress) || 0),
            backgroundColor: '#f97316'
          }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { position: 'top' } },
        scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true } }
      }
    };
    return this.generateChartUrl(config);
  }

  // Generate pie chart for bug aging
  generateAgingPieChart(bugAging) {
    const config = {
      type: 'pie',
      data: {
        labels: bugAging.map(a => a.ageGroup),
        datasets: [{
          data: bugAging.map(a => Number(a.count) || 0),
          backgroundColor: ['#22c55e', '#eab308', '#f97316', '#dc2626']
        }]
      },
      options: {
        plugins: {
          legend: { position: 'right' },
          datalabels: { color: '#fff', font: { weight: 'bold' } }
        }
      }
    };
    return this.generateChartUrl(config);
  }

  // ==================== FULL REPORT EMAIL HTML ====================

  generateFullReportEmailHTML(report, data, aiInsights, emailConfig = {}) {
    const { dateRange, currentStatus, periodSummary, comparison, severityDistribution,
            priorityDistribution, projectHealth, teamPerformance, topContributors,
            bugAging, criticalBugs, activitySummary } = data;

    const reportTypeLabel = report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1);
    
    // Get logo and company name from config
    const { getOrganizationDisplayName, getOrganizationName } = require('../config/organization');
    const logoUrl = emailConfig.logo_url || null;
    const companyName = emailConfig.company_name || getOrganizationDisplayName();
    // Omit the clause when nobody has named the organisation, rather than
    // mailing a client "proprietary information of this organization".
    const confidentialityNotice = (emailConfig.company_name || getOrganizationName())
      ? `CONFIDENTIAL — proprietary information of ${companyName}`
      : 'CONFIDENTIAL — proprietary information';

    // Generate chart URLs
    const statusChartUrl = this.generateStatusPieChart(currentStatus);
    const severityChartUrl = this.generateSeverityBarChart(severityDistribution);
    const priorityChartUrl = this.generatePriorityBarChart(priorityDistribution);
    const teamChartUrl = this.generateTeamBarChart(teamPerformance);
    const agingChartUrl = this.generateAgingPieChart(bugAging);

    const changeIndicator = (value, inverse = false) => {
      const numValue = Number(value) || 0;
      if (numValue === 0) return '';
      const isPositive = inverse ? numValue < 0 : numValue > 0;
      const arrow = numValue > 0 ? '&#9650;' : '&#9660;';
      const color = isPositive ? '#10b981' : '#ef4444';
      return `<span style="color: ${color}; font-size: 12px; margin-left: 4px;">${arrow} ${Math.abs(numValue).toFixed(0)}%</span>`;
    };

    const healthStatus = (score) => {
      const numScore = Number(score) || 0;
      if (numScore >= 70) return { text: '&#10003; Healthy', color: '#10b981' };
      if (numScore >= 40) return { text: '&#9888; Attention', color: '#f59e0b' };
      return { text: '&#9679; Critical', color: '#ef4444' };
    };

    const severityColor = (sev) => {
      const colors = { Critical: '#dc2626', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };
      return colors[sev] || '#6b7280';
    };

    // Calculate total for percentage bars
    const totalOpenBugs = severityDistribution.reduce((sum, s) => sum + Number(s.count), 0) || 1;
    const totalPriorityBugs = priorityDistribution.reduce((sum, p) => sum + Number(p.count), 0) || 1;

    const severityHTML = severityDistribution.length > 0 ? severityDistribution.map(s => {
      const pct = Math.round((Number(s.count) / totalOpenBugs) * 100);
      return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; width: 90px;">
          <span style="display: inline-block; width: 12px; height: 12px; background: ${severityColor(s.severity)}; border-radius: 3px; margin-right: 6px; vertical-align: middle;"></span>
          ${s.severity}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 80%;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 4px;">
                  <tr>
                    <td style="width: ${pct}%; background: ${severityColor(s.severity)}; height: 18px; border-radius: 4px;"></td>
                    <td style="width: ${100-pct}%;"></td>
                  </tr>
                </table>
              </td>
              <td style="width: 20%; text-align: right; font-weight: 600; padding-left: 10px; white-space: nowrap;">${s.count} (${pct}%)</td>
            </tr>
          </table>
        </td>
      </tr>
    `}).join('') : '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #9ca3af;">No open bugs</td></tr>';

    const priorityColors = { Critical: '#dc2626', High: '#f97316', Medium: '#eab308', Low: '#22c55e', Urgent: '#dc2626' };
    const priorityHTML = priorityDistribution.length > 0 ? priorityDistribution.map(p => {
      const pct = Math.round((Number(p.count) / totalPriorityBugs) * 100);
      const color = priorityColors[p.priority] || '#6b7280';
      return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; width: 90px;">
          <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 3px; margin-right: 6px; vertical-align: middle;"></span>
          ${p.priority}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 80%;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 4px;">
                  <tr>
                    <td style="width: ${pct}%; background: ${color}; height: 18px; border-radius: 4px;"></td>
                    <td style="width: ${100-pct}%;"></td>
                  </tr>
                </table>
              </td>
              <td style="width: 20%; text-align: right; font-weight: 600; padding-left: 10px; white-space: nowrap;">${p.count} (${pct}%)</td>
            </tr>
          </table>
        </td>
      </tr>
    `}).join('') : '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #9ca3af;">No open bugs</td></tr>';

    const projectHealthHTML = projectHealth.length > 0 ? projectHealth.map(p => {
      const status = healthStatus(p.healthScore);
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;"><strong>${p.projectKey}</strong> - ${p.projectName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${Number(p.totalBugs) || 0}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${Number(p.open) || 0}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${Number(p.inProgress) || 0}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${(Number(p.resolved) || 0) + (Number(p.closed) || 0)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: ${Number(p.critical) > 0 ? '#dc2626' : '#6b7280'}; font-weight: ${Number(p.critical) > 0 ? 'bold' : 'normal'};">${Number(p.critical) || 0}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;"><span style="color: ${status.color}; font-weight: 600;">${Number(p.healthScore) || 0}</span></td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${status.text}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="8" style="padding: 12px; text-align: center; color: #9ca3af;">No projects</td></tr>';

    const teamHTML = teamPerformance.length > 0 ? teamPerformance.map(t => {
      const resRate = Number(t.resolutionRate || 0);
      const rateColor = resRate >= 70 ? '#10b981' : resRate >= 40 ? '#eab308' : '#ef4444';
      return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;"><strong>${t.assignee}</strong></td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${t.assigned}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${t.openInProgress}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #10b981;">${t.resolved}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 70%;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 4px;">
                  <tr>
                    <td style="width: ${resRate}%; background: ${rateColor}; height: 14px; border-radius: 4px;"></td>
                    <td style="width: ${100-resRate}%;"></td>
                  </tr>
                </table>
              </td>
              <td style="width: 30%; text-align: right; font-weight: 600; padding-left: 8px;">${resRate.toFixed(0)}%</td>
            </tr>
          </table>
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${t.avgResolutionDays ? Number(t.avgResolutionDays || 0).toFixed(1) + 'd' : '-'}</td>
      </tr>
    `}).join('') : '<tr><td colspan="6" style="padding: 12px; text-align: center; color: #9ca3af;">No data</td></tr>';

    const medals = ['1st', '2nd', '3rd', '4th', '5th'];
    const contributorsHTML = topContributors.length > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0">
        ${topContributors.map((c, i) => `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; width: 40px; font-size: 16px; font-weight: bold; color: ${i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : '#64748b'};">${medals[i] || ''}</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${c.username}</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
              <span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">${c.resolved} resolved</span>
            </td>
          </tr>
        `).join('')}
      </table>
    ` : '<p style="color: #9ca3af; text-align: center;">No contributions this period</p>';

    const agingColors = { '< 3 days': '#22c55e', '3-7 days': '#eab308', '7-14 days': '#f97316', '> 14 days': '#dc2626' };
    const totalAgingBugs = bugAging.reduce((sum, a) => sum + Number(a.count), 0) || 1;
    const agingHTML = bugAging.length > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0">
        ${bugAging.map(a => {
          const pct = Math.round((Number(a.count) / totalAgingBugs) * 100);
          return `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; width: 90px;">
              <span style="display: inline-block; width: 12px; height: 12px; background: ${agingColors[a.ageGroup] || '#6b7280'}; border-radius: 3px; margin-right: 8px; vertical-align: middle;"></span>
              ${a.ageGroup}
            </td>
            <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 70%;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 4px;">
                      <tr>
                        <td style="width: ${pct}%; background: ${agingColors[a.ageGroup] || '#6b7280'}; height: 14px; border-radius: 4px;"></td>
                        <td style="width: ${100-pct}%;"></td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 30%; text-align: right; font-weight: 600; padding-left: 8px;">${a.count}</td>
                </tr>
              </table>
            </td>
          </tr>
        `}).join('')}
      </table>
    ` : '<p style="color: #9ca3af; text-align: center;">No open bugs</p>';

    const criticalBugsHTML = criticalBugs.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #fee2e2;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #fecaca;">Bug ID</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #fecaca;">Title</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #fecaca;">Project</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #fecaca;">Severity</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #fecaca;">Assignee</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #fecaca;">Age</th>
          </tr>
        </thead>
        <tbody>
          ${criticalBugs.map(bug => `
            <tr style="background: ${bug.age > 7 ? '#fef2f2' : '#fff'};">
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>${bug.bugId}</strong></td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${bug.title}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${bug.projectKey}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
                <span style="background: ${severityColor(bug.severity)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${bug.severity}</span>
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${bug.assignee}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; ${bug.age > 7 ? 'color: #dc2626; font-weight: bold;' : ''}">${bug.age}d ${bug.age > 7 ? '!' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p style="color: #10b981; text-align: center; padding: 20px;">&#10003; No critical or high priority bugs!</p>';

    const aiSection = aiInsights ? `
      <tr>
        <td style="padding: 25px 30px;">
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 20px; border-left: 4px solid #10b981;">
            <h2 style="color: #166534; margin: 0 0 15px 0; font-size: 18px;">&#9632; Executive Summary</h2>
            <p style="color: #15803d; margin: 0 0 15px 0; font-size: 15px; line-height: 1.6;"><strong>Overview:</strong> ${aiInsights.summary}</p>
            ${aiInsights.teamAnalysis ? `<p style="color: #15803d; margin: 0 0 10px 0; font-size: 14px;"><strong>&#9654; Team:</strong> ${aiInsights.teamAnalysis}</p>` : ''}
            ${aiInsights.projectAnalysis ? `<p style="color: #15803d; margin: 0 0 10px 0; font-size: 14px;"><strong>&#9654; Projects:</strong> ${aiInsights.projectAnalysis}</p>` : ''}
            ${aiInsights.riskAssessment ? `<p style="color: ${aiInsights.riskAssessment.includes('HIGH') ? '#dc2626' : aiInsights.riskAssessment.includes('MEDIUM') ? '#f59e0b' : '#15803d'}; margin: 0 0 15px 0; font-size: 14px; font-weight: 600;"><strong>&#9888; Risk:</strong> ${aiInsights.riskAssessment}</p>` : ''}
            ${aiInsights.recommendations && aiInsights.recommendations.length > 0 ? `
              <h3 style="color: #166534; margin: 15px 0 10px 0; font-size: 14px;">&#9654; Recommendations:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #15803d;">
                ${aiInsights.recommendations.map(r => `<li style="margin-bottom: 8px;">${r}</li>`).join('')}
              </ul>
            ` : ''}
            ${aiInsights.closingNote ? `<p style="color: #166534; margin: 15px 0 0 0; font-size: 14px; font-style: italic;">${aiInsights.closingNote}</p>` : ''}
          </div>
        </td>
      </tr>
    ` : '';

    const comparisonSection = `
      <tr>
        <td style="padding: 0 30px 25px 30px;">
          <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">&#9650; ${reportTypeLabel} over ${reportTypeLabel} Comparison</h2>
          <table width="100%" cellpadding="0" cellspacing="10">
            <tr>
              <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 33%;">
                <div style="color: #64748b; font-size: 12px; margin-bottom: 5px;">Bugs Filed</div>
                <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${periodSummary.bugsCreated}</div>
                <div style="font-size: 12px; color: #94a3b8;">vs ${comparison.prevBugsCreated} prev</div>
                ${changeIndicator(comparison.createdChange, true)}
              </td>
              <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 33%;">
                <div style="color: #64748b; font-size: 12px; margin-bottom: 5px;">Bugs Resolved</div>
                <div style="font-size: 24px; font-weight: bold; color: #10b981;">${periodSummary.bugsResolved}</div>
                <div style="font-size: 12px; color: #94a3b8;">vs ${comparison.prevBugsResolved} prev</div>
                ${changeIndicator(comparison.resolvedChange)}
              </td>
              <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 33%;">
                <div style="color: #64748b; font-size: 12px; margin-bottom: 5px;">Resolution Rate</div>
                <div style="font-size: 24px; font-weight: bold; color: #6366f1;">${Number(periodSummary.resolutionRate || 0).toFixed(0)}%</div>
                <div style="font-size: 12px; color: #94a3b8;">vs ${Number(comparison.prevResolutionRate || 0).toFixed(0)}% prev</div>
                ${changeIndicator(comparison.rateChange)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${report.report_name}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; line-height: 1.5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 900px; margin: 0 auto; background: white;">
          
          <!-- Header with Dynamic Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 60px; margin-bottom: 15px;">` : ''}
              <h1 style="color: white; margin: 0; font-size: 28px;">${companyName}</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">${reportTypeLabel} Engineering Report</p>
            </td>
          </tr>
          
          <!-- Report Info Bar -->
          <tr>
            <td style="padding: 15px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <table width="100%">
                <tr>
                  <td><strong style="color: #1e293b; font-size: 16px;">${report.report_name}</strong></td>
                  <td style="text-align: right; color: #64748b; font-size: 14px;">
                    ${dateRange.startDate} &rarr; ${dateRange.endDate}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- AI Insights -->
          ${aiSection}

          <!-- Current Bug Status -->
          <tr>
            <td style="padding: 25px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">&#9632; Current Bug Status</h2>
              <table width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #1e293b;">${currentStatus.totalBugs}</div>
                    <div style="color: #64748b; font-size: 12px;">Total Bugs</div>
                  </td>
                  <td style="background: #dbeafe; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${currentStatus.open}</div>
                    <div style="color: #64748b; font-size: 12px;">Open</div>
                  </td>
                  <td style="background: #e0e7ff; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #7c3aed;">${currentStatus.inProgress}</div>
                    <div style="color: #64748b; font-size: 12px;">In Progress</div>
                  </td>
                  <td style="background: #dcfce7; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${currentStatus.resolved + currentStatus.closed}</div>
                    <div style="color: #64748b; font-size: 12px;">Resolved/Closed</div>
                  </td>
                  <td style="background: ${currentStatus.critical > 0 ? '#fee2e2' : '#f8fafc'}; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: ${currentStatus.critical > 0 ? '#dc2626' : '#64748b'};">${currentStatus.critical}</div>
                    <div style="color: #64748b; font-size: 12px;">Critical</div>
                  </td>
                  <td style="background: ${currentStatus.high > 0 ? '#ffedd5' : '#f8fafc'}; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: ${currentStatus.high > 0 ? '#ea580c' : '#64748b'};">${currentStatus.high}</div>
                    <div style="color: #64748b; font-size: 12px;">High</div>
                  </td>
                </tr>
              </table>
              <!-- Visual Status Bar Chart -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 14px; color: #64748b; margin-bottom: 8px; font-weight: 600;">Status Distribution</div>
                    <!-- Stacked Bar using table -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="height: 28px; border-radius: 6px; overflow: hidden;">
                      <tr>
                        ${currentStatus.totalBugs > 0 ? `
                          ${currentStatus.open > 0 ? `<td style="width: ${(currentStatus.open / currentStatus.totalBugs) * 100}%; background: #3b82f6;"></td>` : ''}
                          ${currentStatus.inProgress > 0 ? `<td style="width: ${(currentStatus.inProgress / currentStatus.totalBugs) * 100}%; background: #8b5cf6;"></td>` : ''}
                          ${currentStatus.resolved > 0 ? `<td style="width: ${(currentStatus.resolved / currentStatus.totalBugs) * 100}%; background: #22c55e;"></td>` : ''}
                          ${currentStatus.closed > 0 ? `<td style="width: ${(currentStatus.closed / currentStatus.totalBugs) * 100}%; background: #6b7280;"></td>` : ''}
                        ` : '<td style="width: 100%; background: #e5e7eb;"></td>'}
                      </tr>
                    </table>
                    <!-- Legend -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">
                      <tr>
                        <td style="font-size: 11px; color: #64748b;">
                          <span style="display: inline-block; width: 10px; height: 10px; background: #3b82f6; border-radius: 2px; margin-right: 4px;"></span>Open (${currentStatus.open})
                        </td>
                        <td style="font-size: 11px; color: #64748b;">
                          <span style="display: inline-block; width: 10px; height: 10px; background: #8b5cf6; border-radius: 2px; margin-right: 4px;"></span>In Progress (${currentStatus.inProgress})
                        </td>
                        <td style="font-size: 11px; color: #64748b;">
                          <span style="display: inline-block; width: 10px; height: 10px; background: #22c55e; border-radius: 2px; margin-right: 4px;"></span>Resolved (${currentStatus.resolved})
                        </td>
                        <td style="font-size: 11px; color: #64748b;">
                          <span style="display: inline-block; width: 10px; height: 10px; background: #6b7280; border-radius: 2px; margin-right: 4px;"></span>Closed (${currentStatus.closed})
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Period Activity Summary -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">&#9650; ${reportTypeLabel} Activity Summary</h2>
              <table width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  <td style="background: #dbeafe; padding: 15px; border-radius: 10px; text-align: center; width: 20%;">
                    <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${periodSummary.bugsCreated}</div>
                    <div style="color: #64748b; font-size: 12px;">Bugs Filed</div>
                  </td>
                  <td style="background: #dcfce7; padding: 15px; border-radius: 10px; text-align: center; width: 20%;">
                    <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${periodSummary.bugsResolved}</div>
                    <div style="color: #64748b; font-size: 12px;">Bugs Resolved</div>
                  </td>
                  <td style="background: ${periodSummary.netChange > 0 ? '#fee2e2' : '#dcfce7'}; padding: 15px; border-radius: 10px; text-align: center; width: 20%;">
                    <div style="font-size: 24px; font-weight: bold; color: ${periodSummary.netChange > 0 ? '#dc2626' : '#16a34a'};">${periodSummary.netChange > 0 ? '+' : ''}${periodSummary.netChange}</div>
                    <div style="color: #64748b; font-size: 12px;">Net Change</div>
                  </td>
                  <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 20%;">
                    <div style="font-size: 24px; font-weight: bold; color: #6366f1;">${Number(periodSummary.avgResolutionDays || 0).toFixed(1)}d</div>
                    <div style="color: #64748b; font-size: 12px;">Avg Resolution</div>
                  </td>
                  <td style="background: ${Number(periodSummary.resolutionRate || 0) >= 70 ? '#dcfce7' : Number(periodSummary.resolutionRate || 0) >= 40 ? '#fef3c7' : '#fee2e2'}; padding: 15px; border-radius: 10px; text-align: center; width: 20%;">
                    <div style="font-size: 24px; font-weight: bold; color: ${Number(periodSummary.resolutionRate || 0) >= 70 ? '#16a34a' : Number(periodSummary.resolutionRate || 0) >= 40 ? '#ca8a04' : '#dc2626'};">${Number(periodSummary.resolutionRate || 0).toFixed(0)}%</div>
                    <div style="color: #64748b; font-size: 12px;">Resolution Rate</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Comparison -->
          ${comparisonSection}

          <!-- Status Distribution Chart -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">&#9632; Bug Status Distribution</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center; padding: 10px;">
                    <img src="${statusChartUrl}" alt="Status Distribution Chart" style="max-width: 100%; height: auto; border-radius: 8px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Distributions Row with Charts -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <table width="100%" cellpadding="0" cellspacing="15">
                <tr>
                  <td style="width: 50%; vertical-align: top;">
                    <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 16px;">&#9632; Severity Distribution</h3>
                    <!-- Chart Image -->
                    <div style="text-align: center; margin-bottom: 15px;">
                      <img src="${severityChartUrl}" alt="Severity Chart" style="max-width: 100%; height: auto; border-radius: 8px;">
                    </div>
                    <!-- Data Table -->
                    <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px;">
                      <thead>
                        <tr style="background: #e2e8f0;">
                          <th style="padding: 10px 12px; text-align: left; border-radius: 8px 0 0 0;">Severity</th>
                          <th style="padding: 10px 12px; text-align: right; border-radius: 0 8px 0 0;">Count</th>
                        </tr>
                      </thead>
                      <tbody>${severityHTML}</tbody>
                    </table>
                  </td>
                  <td style="width: 50%; vertical-align: top;">
                    <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 16px;">&#9632; Priority Distribution</h3>
                    <!-- Chart Image -->
                    <div style="text-align: center; margin-bottom: 15px;">
                      <img src="${priorityChartUrl}" alt="Priority Chart" style="max-width: 100%; height: auto; border-radius: 8px;">
                    </div>
                    <!-- Data Table -->
                    <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px;">
                      <thead>
                        <tr style="background: #e2e8f0;">
                          <th style="padding: 10px 12px; text-align: left; border-radius: 8px 0 0 0;">Priority</th>
                          <th style="padding: 10px 12px; text-align: right; border-radius: 0 8px 0 0;">Count</th>
                        </tr>
                      </thead>
                      <tbody>${priorityHTML}</tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Project Health -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">&#9632; Project Health</h2>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background: #f1f5f9;">
                      <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Project</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Total</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Open</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">In Progress</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Done</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Critical</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Score</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Status</th>
                    </tr>
                  </thead>
                  <tbody>${projectHealthHTML}</tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Team Performance -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">&#9632; Team Performance</h2>
              <!-- Team Chart -->
              <div style="text-align: center; margin-bottom: 15px;">
                <img src="${teamChartUrl}" alt="Team Performance Chart" style="max-width: 100%; height: auto; border-radius: 8px;">
              </div>
              <!-- Team Table -->
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background: #f1f5f9;">
                      <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Assignee</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Assigned</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Open/In Progress</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Resolved</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Resolution %</th>
                      <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e2e8f0;">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>${teamHTML}</tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Contributors & Aging Row -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <table width="100%" cellpadding="0" cellspacing="15">
                <tr>
                  <td style="width: 50%; vertical-align: top;">
                    <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 16px;">&#9632; Top Contributors</h3>
                    <div style="background: #f8fafc; border-radius: 8px; padding: 15px;">
                      ${contributorsHTML}
                    </div>
                  </td>
                  <td style="width: 50%; vertical-align: top;">
                    <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 16px;">&#9632; Bug Aging (Open Bugs)</h3>
                    <!-- Aging Chart -->
                    <div style="text-align: center; margin-bottom: 15px;">
                      <img src="${agingChartUrl}" alt="Bug Aging Chart" style="max-width: 100%; height: auto; border-radius: 8px;">
                    </div>
                    <div style="background: #f8fafc; border-radius: 8px; padding: 15px;">
                      ${agingHTML}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Critical Bugs -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">&#9888; Critical & High Priority Bugs</h2>
              ${criticalBugsHTML}
            </td>
          </tr>

          <!-- Activity Summary -->
          <tr>
            <td style="padding: 0 30px 25px 30px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">&#9632; Activity Summary</h2>
              <table width="100%" cellpadding="0" cellspacing="8">
                <tr>
                  <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 25%;">
                    <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${activitySummary.comments}</div>
                    <div style="color: #64748b; font-size: 12px;">Comments</div>
                  </td>
                  <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 25%;">
                    <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${activitySummary.statusChanges}</div>
                    <div style="color: #64748b; font-size: 12px;">Status Changes</div>
                  </td>
                  <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 25%;">
                    <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${activitySummary.reassignments}</div>
                    <div style="color: #64748b; font-size: 12px;">Reassignments</div>
                  </td>
                  <td style="background: #f8fafc; padding: 15px; border-radius: 10px; text-align: center; width: 25%;">
                    <div style="font-size: 24px; font-weight: bold; color: #10b981;">${activitySummary.commits}</div>
                    <div style="color: #64748b; font-size: 12px;">Commits Linked</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 25px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; margin: 0 0 10px 0;">Thank you for your continued effort in maintaining product quality.</p>
              <p style="color: #1e293b; margin: 0;">Best regards,<br><strong>Mertis System</strong></p>
              <p style="color: #94a3b8; margin: 15px 0 0 0; font-size: 12px;">Generated: ${new Date().toLocaleString()}</p>
            </td>
          </tr>

          <!-- Footer Bar -->
          <tr>
            <td style="padding: 15px 30px; background: #1e293b; text-align: center;">
              <p style="color: #94a3b8; margin: 0; font-size: 12px;">This is an automated report from Mertis</p>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 11px;">${confidentialityNotice}</p>
            </td>
          </tr>

        </table>
      </body>
      </html>
    `;
  }

  // ==================== MANAGEMENT ====================

  async refreshSchedule(reportId = null) {
    if (reportId) {
      const existingJob = this.scheduledJobs.get(reportId);
      if (existingJob) {
        existingJob.stop();
        this.scheduledJobs.delete(reportId);
      }

      const reports = await query(`
        SELECT sr.*, GROUP_CONCAT(rr.email) as recipient_emails
        FROM scheduled_reports sr
        LEFT JOIN report_recipients rr ON sr.id = rr.scheduled_report_id AND rr.is_active = TRUE
        WHERE sr.id = ? AND sr.is_active = TRUE
        GROUP BY sr.id
      `, [reportId]);

      if (reports.length > 0 && reports[0].recipient_emails) {
        this.scheduleReport(reports[0]);
      }
    } else {
      await this.loadScheduledReports();
    }
  }

  async stopSchedule(reportId) {
    const job = this.scheduledJobs.get(reportId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(reportId);
      console.log(`[EmailService] Stopped schedule for report ${reportId}`);
    }
  }

  getScheduledJobs() {
    return Array.from(this.scheduledJobs.keys());
  }
}

const emailService = new EmailService();

module.exports = emailService;
