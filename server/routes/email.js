/**
 * EMAIL ROUTES
 * API endpoints for email configuration, scheduling, and management
 * 
 * Location: server/routes/email.js
 */

const express = require('express');
const router = express.Router();

const storage = require('../storage');
const getSqlDb = require('../storage/sqlDb');
const emailService = require('../services/emailService');
const { authMiddleware } = require('../middleware/auth');
const { requireFeature } = require('../middleware/licenseValidator');
const { FEATURES } = require('../config/features');
const { getOrganizationDisplayName } = require('../config/organization');

const query = (...args) => getSqlDb().query(...args);

const requireSqlStorage = (req, res, next) => {
  if (!storage.isSqlStorage()) {
    return res.status(503).json({
      error: 'Email features require MySQL or PostgreSQL. CSV mode does not support email configuration.'
    });
  }
  next();
};

router.use(requireSqlStorage);
router.use(requireFeature(FEATURES.EMAIL_REPORTS));

// Helper to check admin/godmode
const hasElevatedPrivileges = (user) => {
  return user && (user.role === 'admin' || user.role === 'godmode');
};

// ==================== SMTP CONFIGURATION ====================

// Get current SMTP configuration (masked password)
router.get('/config', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Use SELECT * to be backward compatible with databases that don't have logo columns yet
    const configs = await query(`
      SELECT * FROM email_config 
      ORDER BY is_active DESC, updated_at DESC
    `);

    // Mask passwords and ensure logo fields have defaults
    const maskedConfigs = (configs || []).map(c => ({
      ...c,
      smtp_password: '********',
      logo_url: c.logo_url || null,
      company_name: c.company_name || getOrganizationDisplayName()
    }));

    res.json(maskedConfigs);

  } catch (error) {
    console.error('Error fetching email config:', error);
    res.status(500).json({ error: 'Failed to fetch email configuration' });
  }
});

// Update logo settings only (requires migration to be run first)
router.patch('/config/logo', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { logo_url, company_name } = req.body;

    try {
      await query(`
        UPDATE email_config 
        SET logo_url = ?, company_name = ?
        WHERE is_active = TRUE
      `, [logo_url || null, company_name || getOrganizationDisplayName()]);

      res.json({ success: true, message: 'Logo settings updated' });
    } catch (updateErr) {
      // Columns don't exist yet
      if (updateErr.message.includes('Unknown column')) {
        res.status(400).json({ 
          error: 'Logo columns not found. Please run the database migration first.',
          migration: "ALTER TABLE email_config ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL, ADD COLUMN company_name VARCHAR(100) DEFAULT 'Mertis';"
        });
      } else {
        throw updateErr;
      }
    }

  } catch (error) {
    console.error('Error updating logo settings:', error);
    res.status(500).json({ error: 'Failed to update logo settings' });
  }
});

// Save/Update SMTP configuration
router.post('/config', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { 
      id, config_name, smtp_host, smtp_port, smtp_secure, 
      smtp_user, smtp_password, from_email, from_name, is_active,
      logo_url, company_name
    } = req.body;

    // Validate required fields
    if (!smtp_host || !smtp_port || !smtp_user || !from_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (id) {
      // Update existing - basic fields only (backward compatible)
      let updateQuery = `
        UPDATE email_config SET 
          config_name = ?, smtp_host = ?, smtp_port = ?, smtp_secure = ?,
          smtp_user = ?, from_email = ?, from_name = ?, is_active = ?
      `;
      let params = [config_name, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_active];

      // Only update password if provided (not masked)
      if (smtp_password && smtp_password !== '********') {
        updateQuery += ', smtp_password = ?';
        params.push(smtp_password);
      }

      updateQuery += ' WHERE id = ?';
      params.push(id);

      await query(updateQuery, params);

      // Try to update logo fields if they exist (ignore error if columns don't exist)
      if (logo_url !== undefined || company_name !== undefined) {
        try {
          await query(`UPDATE email_config SET logo_url = ?, company_name = ? WHERE id = ?`, 
            [logo_url || null, company_name || getOrganizationDisplayName(), id]);
        } catch (logoErr) {
          console.log('[Email Config] Logo columns not yet added to database - skipping logo update');
        }
      }

      // If setting as active, deactivate others
      if (is_active) {
        await query('UPDATE email_config SET is_active = FALSE WHERE id != ?', [id]);
      }

    } else {
      // Insert new
      if (!smtp_password) {
        return res.status(400).json({ error: 'Password is required for new configuration' });
      }

      // Deactivate others if this is active
      if (is_active) {
        await query('UPDATE email_config SET is_active = FALSE');
      }

      // Try insert with logo columns first, fall back to basic insert
      try {
        await query(`
          INSERT INTO email_config 
          (config_name, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, is_active, created_by, logo_url, company_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [config_name, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, is_active, req.user.id, logo_url || null, company_name || getOrganizationDisplayName()]);
      } catch (insertErr) {
        // Fall back to basic insert without logo columns
        await query(`
          INSERT INTO email_config 
          (config_name, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, is_active, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [config_name, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, is_active, req.user.id]);
      }
    }

    // Reinitialize email service
    await emailService.initializeTransporter();

    res.json({ success: true, message: 'Email configuration saved' });

  } catch (error) {
    console.error('Error saving email config:', error);
    res.status(500).json({ error: 'Failed to save email configuration' });
  }
});

// Test SMTP connection
router.post('/config/test', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, config_id } = req.body;

    let testConfig;

    if (config_id) {
      // Test existing config
      const configs = await query('SELECT * FROM email_config WHERE id = ?', [config_id]);
      if (!configs || configs.length === 0) {
        return res.status(404).json({ error: 'Configuration not found' });
      }
      testConfig = configs[0];
    } else {
      // Test provided config
      testConfig = { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password };
    }

    const result = await emailService.testConnection(testConfig);
    res.json(result);

  } catch (error) {
    console.error('Error testing email config:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send test email
router.post('/config/send-test', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    await emailService.sendTestEmail(email);
    res.json({ success: true, message: 'Test email sent successfully' });

  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete SMTP configuration
router.delete('/config/:id', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await query('DELETE FROM email_config WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Configuration deleted' });

  } catch (error) {
    console.error('Error deleting email config:', error);
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
});

// ==================== SCHEDULED REPORTS ====================

// Get all scheduled reports
router.get('/schedules', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const reports = await query(`
      SELECT sr.*, 
             u.username as created_by_name
      FROM scheduled_reports sr
      LEFT JOIN users u ON sr.created_by = u.id
      ORDER BY sr.created_at DESC
    `);

    // Safe JSON parser helper
    const safeParseJSON = (str) => {
      if (!str) return [];
      try { return JSON.parse(str); } catch(e) { return []; }
    };

    // Fetch recipients for each report
    const parsedReports = await Promise.all((reports || []).map(async (r) => {
      const recipients = await query(
        'SELECT id, email, name, is_active FROM report_recipients WHERE scheduled_report_id = ? ORDER BY created_at',
        [r.id]
      );
      return {
        ...r,
        projects: safeParseJSON(r.projects),
        recipients: recipients || [],
        recipient_count: (recipients || []).filter(rec => rec.is_active).length
      };
    }));

    res.json(parsedReports);

  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled reports' });
  }
});

// Get single scheduled report with recipients
router.get('/schedules/:id', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const reports = await query('SELECT * FROM scheduled_reports WHERE id = ?', [req.params.id]);
    
    if (!reports || reports.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const recipients = await query(
      'SELECT id, email, name, is_active FROM report_recipients WHERE scheduled_report_id = ? ORDER BY created_at',
      [req.params.id]
    );

    // Safe JSON parser
    const safeParseJSON = (str) => {
      if (!str) return [];
      try { return JSON.parse(str); } catch(e) { return []; }
    };

    const report = {
      ...reports[0],
      projects: safeParseJSON(reports[0].projects),
      recipients: recipients || []
    };

    res.json(report);

  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Create/Update scheduled report
router.post('/schedules', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      id, report_name, report_type, frequency, day_of_week, day_of_month,
      send_time, timezone, projects, include_ai_insights, is_active, recipients
    } = req.body;

    // Validate
    if (!report_name || !report_type || !frequency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let reportId = id;

    if (id) {
      // Update existing
      await query(`
        UPDATE scheduled_reports SET
          report_name = ?, report_type = ?, frequency = ?, day_of_week = ?,
          day_of_month = ?, send_time = ?, timezone = ?, projects = ?,
          include_ai_insights = ?, is_active = ?
        WHERE id = ?
      `, [
        report_name, report_type, frequency, day_of_week || 1, day_of_month || 1,
        send_time || '09:00:00', timezone || 'UTC', JSON.stringify(projects || []),
        include_ai_insights !== false, is_active !== false, id
      ]);

    } else {
      // Create new
      const result = await query(`
        INSERT INTO scheduled_reports 
        (report_name, report_type, frequency, day_of_week, day_of_month, send_time, timezone, projects, include_ai_insights, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        report_name, report_type, frequency, day_of_week || 1, day_of_month || 1,
        send_time || '09:00:00', timezone || 'UTC', JSON.stringify(projects || []),
        include_ai_insights !== false, is_active !== false, req.user.id
      ]);
      reportId = result.insertId;
    }

    // Update recipients if provided
    if (recipients && Array.isArray(recipients)) {
      // Remove existing
      await query('DELETE FROM report_recipients WHERE scheduled_report_id = ?', [reportId]);
      
      // Add new
      for (const recipient of recipients) {
        if (recipient.email) {
          await query(
            'INSERT INTO report_recipients (scheduled_report_id, email, name, is_active) VALUES (?, ?, ?, ?)',
            [reportId, recipient.email, recipient.name || '', recipient.is_active !== false]
          );
        }
      }
    }

    // Refresh schedule
    await emailService.refreshSchedule(reportId);

    res.json({ success: true, id: reportId, message: 'Schedule saved' });

  } catch (error) {
    console.error('Error saving schedule:', error);
    res.status(500).json({ error: 'Failed to save schedule' });
  }
});

// Delete scheduled report
router.delete('/schedules/:id', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await emailService.stopSchedule(parseInt(req.params.id));
    await query('DELETE FROM scheduled_reports WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Schedule deleted' });

  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Toggle schedule active status
router.patch('/schedules/:id/toggle', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const reports = await query('SELECT is_active FROM scheduled_reports WHERE id = ?', [req.params.id]);
    
    if (!reports || reports.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const newStatus = !reports[0].is_active;
    await query('UPDATE scheduled_reports SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);

    if (newStatus) {
      await emailService.refreshSchedule(parseInt(req.params.id));
    } else {
      await emailService.stopSchedule(parseInt(req.params.id));
    }

    res.json({ success: true, is_active: newStatus });

  } catch (error) {
    console.error('Error toggling schedule:', error);
    res.status(500).json({ error: 'Failed to toggle schedule' });
  }
});

// Send report now (manual trigger)
router.post('/schedules/:id/send-now', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await emailService.executeScheduledReport(parseInt(req.params.id));
    res.json({ success: true, message: 'Report sent' });

  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).json({ error: 'Failed to send report: ' + error.message });
  }
});

// ==================== RECIPIENTS ====================

// Add recipient to schedule
router.post('/schedules/:id/recipients', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { email, name } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    await query(
      'INSERT INTO report_recipients (scheduled_report_id, email, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, is_active = TRUE',
      [req.params.id, email, name || '', name || '']
    );

    await emailService.refreshSchedule(parseInt(req.params.id));
    res.json({ success: true, message: 'Recipient added' });

  } catch (error) {
    console.error('Error adding recipient:', error);
    res.status(500).json({ error: 'Failed to add recipient' });
  }
});

// Remove recipient
router.delete('/recipients/:id', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const recipients = await query('SELECT scheduled_report_id FROM report_recipients WHERE id = ?', [req.params.id]);
    
    await query('DELETE FROM report_recipients WHERE id = ?', [req.params.id]);

    if (recipients && recipients.length > 0) {
      await emailService.refreshSchedule(recipients[0].scheduled_report_id);
    }

    res.json({ success: true, message: 'Recipient removed' });

  } catch (error) {
    console.error('Error removing recipient:', error);
    res.status(500).json({ error: 'Failed to remove recipient' });
  }
});

// ==================== EMAIL LOG ====================

// Get email log
router.get('/log', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const logs = await query(`
      SELECT el.*, sr.report_name
      FROM email_log el
      LEFT JOIN scheduled_reports sr ON el.scheduled_report_id = sr.id
      ORDER BY el.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    const countResult = await query('SELECT COUNT(*) as total FROM email_log');

    res.json({
      logs: logs || [],
      total: countResult?.[0]?.total || 0,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error fetching email log:', error);
    res.status(500).json({ error: 'Failed to fetch email log' });
  }
});

// ==================== STATUS ====================

// Get email service status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const configs = await query('SELECT id, config_name, is_active FROM email_config WHERE is_active = TRUE LIMIT 1');
    const activeJobs = emailService.getScheduledJobs();

    res.json({
      smtp_configured: configs && configs.length > 0,
      smtp_config: configs?.[0] || null,
      service_initialized: emailService.isInitialized,
      active_schedules: activeJobs.length,
      scheduled_job_ids: activeJobs
    });

  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Initialize service on startup
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    if (!hasElevatedPrivileges(req.user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const smtpResult = await emailService.initializeTransporter();
    await emailService.loadScheduledReports();

    res.json({ 
      success: true, 
      smtp_initialized: smtpResult,
      message: 'Email service initialized' 
    });

  } catch (error) {
    console.error('Error initializing email service:', error);
    res.status(500).json({ error: 'Failed to initialize email service' });
  }
});

module.exports = router;
