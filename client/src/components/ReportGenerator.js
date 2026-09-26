import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import MultiSelect from './MultiSelect';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import './ReportGenerator.css';
import { FeatureGuard } from './common/FeatureGuard';
import { useLicense } from '../hooks/useLicense';
import { useBranding } from '../hooks/useBranding';

function ReportGenerator() {
  const { promptUpgrade } = useLicense();
  const { organizationName, configured } = useBranding();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState('weekly');
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: getDefaultStartDate('weekly'),
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [aiCommentary, setAiCommentary] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [emailMode, setEmailMode] = useState(true);
  const [aiCacheInfo, setAiCacheInfo] = useState(null);

  function getDefaultStartDate(type) {
    const today = new Date();
    if (type === 'weekly') {
      today.setDate(today.getDate() - 7);
    } else {
      today.setMonth(today.getMonth() - 1);
    }
    return today.toISOString().split('T')[0];
  }

  // Generate cache key based on report parameters
  const getCacheKey = useCallback(() => {
    const projectsKey = selectedProjects.sort().join(',');
    return `ai_commentary_${reportType}_${dateRange.startDate}_${dateRange.endDate}_${projectsKey}`;
  }, [reportType, dateRange, selectedProjects]);

  // Check if cached commentary exists and is still valid (same day)
  const getCachedCommentary = useCallback(() => {
    try {
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { commentary, timestamp, date } = JSON.parse(cached);
        const today = new Date().toISOString().split('T')[0];
        if (date === today) {
          return { commentary, timestamp };
        }
      }
    } catch (e) {
      console.error('Error reading cache:', e);
    }
    return null;
  }, [getCacheKey]);

  // Save commentary to cache
  const cacheCommentary = useCallback((commentary) => {
    try {
      const cacheKey = getCacheKey();
      const cacheData = {
        commentary,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      setAiCacheInfo({ timestamp: cacheData.timestamp, fromCache: false });
    } catch (e) {
      console.error('Error saving to cache:', e);
    }
  }, [getCacheKey]);

  // Load cached commentary when report data changes
  useEffect(() => {
    if (reportData && previewMode) {
      const cached = getCachedCommentary();
      if (cached) {
        setAiCommentary(cached.commentary);
        setAiCacheInfo({ timestamp: cached.timestamp, fromCache: true });
      } else {
        setAiCommentary(generateLocalFallback(reportData));
        setAiCacheInfo(null);
      }
    }
  }, [reportData, previewMode, getCachedCommentary]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    setDateRange({
      startDate: getDefaultStartDate(reportType),
      endDate: new Date().toISOString().split('T')[0]
    });
    setAiCommentary(null);
    setAiCacheInfo(null);
  }, [reportType]);

  const fetchProjects = async () => {
    try {
      const res = await axios.get('/api/projects');
      const projectList = res.data || [];
      setProjects(projectList);
      const keys = projectList.map(p => p.projectKey || p.key);
      setSelectedProjects(keys);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    }
  };

  // Generate local fallback commentary (no API call)
  const generateLocalFallback = (data) => {
    const summary = data?.summary || {};
    const currentSnapshot = data?.currentSnapshot || {};
    const criticalBugs = data?.criticalBugs || [];
    const projectHealth = data?.projectHealth || [];
    const assigneePerformance = data?.assigneePerformance || [];

    const resolutionRate = summary.resolutionRate || 0;
    const netChange = summary.netChange || 0;
    const criticalCount = currentSnapshot.critical || 0;
    const agingBugs = criticalBugs.filter(b => (b.age || 0) > 7).length;

    let executiveSummary = `This period: ${summary.totalBugsCreated || 0} bugs filed, ${summary.totalBugsResolved || 0} resolved (${resolutionRate.toFixed(0)}% rate). `;
    if (netChange > 0) executiveSummary += `Backlog grew by ${netChange}. `;
    else if (netChange < 0) executiveSummary += `Backlog reduced by ${Math.abs(netChange)}. `;
    if (criticalCount > 0) executiveSummary += `${criticalCount} critical bugs need attention.`;

    const topPerformer = assigneePerformance.filter(u => (u.resolved || 0) > 0).sort((a, b) => (b.resolved || 0) - (a.resolved || 0))[0];
    const totalResolved = assigneePerformance.reduce((sum, u) => sum + (u.resolved || 0), 0);
    const teamAnalysis = topPerformer 
      ? `Team resolved ${totalResolved} bugs. Top: ${topPerformer.assignee} (${topPerformer.resolved}).`
      : `${assigneePerformance.length} contributors this period.`;

    const healthyProjects = projectHealth.filter(p => (p.healthScore || 0) >= 70).length;
    const projectAnalysis = `${healthyProjects}/${projectHealth.length} projects healthy.`;

    let riskLevel = 'LOW';
    if (agingBugs > 5 || criticalCount > 10) riskLevel = 'HIGH';
    else if (agingBugs > 0 || criticalCount > 5) riskLevel = 'MEDIUM';
    const riskAssessment = `${riskLevel} RISK: ${criticalCount} critical bugs, ${agingBugs} aging >7 days.`;

    return {
      executiveSummary,
      teamAnalysis,
      projectAnalysis,
      riskAssessment,
      recommendations: ['Click "Generate AI Insights" for detailed recommendations'],
      closingNote: 'Generate AI insights for personalized commentary.',
      isBasic: true
    };
  };

  // On-demand AI insight generation
  const generateAIInsights = async () => {
    if (!reportData) return;

    // Check cache first
    const cached = getCachedCommentary();
    if (cached) {
      setAiCommentary(cached.commentary);
      setAiCacheInfo({ timestamp: cached.timestamp, fromCache: true });
      return;
    }

    setLoadingAI(true);
    try {
      const res = await axios.post('/api/analytics/ai-commentary', {
        reportData,
        reportType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      const commentary = res.data;
      setAiCommentary(commentary);
      cacheCommentary(commentary);
    } catch (err) {
      console.error('Error fetching AI commentary:', err);
      const fallback = generateEnhancedFallback(reportData);
      setAiCommentary(fallback);
    } finally {
      setLoadingAI(false);
    }
  };

  // Enhanced fallback for when AI fails
  const generateEnhancedFallback = (data) => {
    const summary = data?.summary || {};
    const currentSnapshot = data?.currentSnapshot || {};
    const criticalBugs = data?.criticalBugs || [];
    const projectHealth = data?.projectHealth || [];
    const assigneePerformance = data?.assigneePerformance || [];

    const resolutionRate = summary.resolutionRate || 0;
    const netChange = summary.netChange || 0;
    const criticalCount = currentSnapshot.critical || 0;
    const agingBugs = criticalBugs.filter(b => (b.age || 0) > 7).length;

    let executiveSummary = '';
    if (resolutionRate >= 100) {
      executiveSummary = `Excellent performance! Resolved more bugs than filed, reducing backlog by ${Math.abs(netChange)}. `;
    } else if (resolutionRate >= 70) {
      executiveSummary = `Strong progress with ${resolutionRate.toFixed(0)}% resolution rate. ${summary.totalBugsResolved || 0} bugs closed. `;
    } else if (resolutionRate >= 40) {
      executiveSummary = `Moderate progress. ${resolutionRate.toFixed(0)}% resolution rate - backlog needs attention. `;
    } else {
      executiveSummary = `Resolution rate of ${resolutionRate.toFixed(0)}% requires immediate focus. Backlog grew by ${netChange}. `;
    }
    executiveSummary += criticalCount > 0 ? `${criticalCount} critical bugs pending.` : 'No critical bugs open.';

    const topPerformer = assigneePerformance.filter(u => (u.resolved || 0) > 0).sort((a, b) => (b.resolved || 0) - (a.resolved || 0))[0];
    const totalResolved = assigneePerformance.reduce((sum, u) => sum + (u.resolved || 0), 0);
    const teamAnalysis = topPerformer 
      ? `Team resolved ${totalResolved} bugs. ${topPerformer.assignee} led with ${topPerformer.resolved} (${(topPerformer.resolutionRate || 0).toFixed(0)}% rate).`
      : `${assigneePerformance.length} team members contributed this period.`;

    const healthyProjects = projectHealth.filter(p => (p.healthScore || 0) >= 70).length;
    const criticalProjects = projectHealth.filter(p => (p.healthScore || 0) < 40);
    let projectAnalysis = `${healthyProjects}/${projectHealth.length} projects healthy. `;
    if (criticalProjects.length > 0) projectAnalysis += `At-risk: ${criticalProjects.map(p => p.projectKey).join(', ')}.`;

    let riskAssessment = '';
    if (agingBugs > 5 || criticalCount > 10) riskAssessment = `HIGH RISK: ${agingBugs} critical bugs >7 days old. Immediate action needed.`;
    else if (agingBugs > 0 || criticalCount > 5) riskAssessment = `MEDIUM RISK: ${agingBugs} aging issues require focused attention.`;
    else riskAssessment = `LOW RISK: Critical issues being addressed promptly.`;

    const recommendations = [];
    if (criticalCount > 0) recommendations.push(`Prioritize ${criticalCount} critical bugs`);
    if (resolutionRate < 50) recommendations.push('Review sprint capacity for bug focus');
    if (agingBugs > 0) recommendations.push(`Address ${agingBugs} bugs open >7 days`);
    if (criticalProjects.length > 0) recommendations.push('Health check at-risk projects');
    if (netChange > 5) recommendations.push('Schedule backlog grooming');
    if (recommendations.length === 0) recommendations.push('Maintain velocity', 'Share best practices');
    if (recommendations.length < 3) recommendations.push('Invest in test automation');

    const closingNote = resolutionRate >= 80 ? "Outstanding work! Maintain this momentum."
      : resolutionRate >= 60 ? "Good progress. Continue the focus." : "Let's regroup on improvement strategies.";

    return { executiveSummary, teamAnalysis, projectAnalysis, riskAssessment, recommendations, closingNote };
  };

  // Clear cache for current report
  const clearAICache = () => {
    try {
      const cacheKey = getCacheKey();
      localStorage.removeItem(cacheKey);
      setAiCacheInfo(null);
      setAiCommentary(generateLocalFallback(reportData));
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  };

  const fetchReportData = async () => {
    if (selectedProjects.length === 0) {
      setError('Please select at least one project');
      return;
    }
    
    setLoading(true);
    setError('');
    setAiCommentary(null);
    setAiCacheInfo(null);
    
    try {
      const res = await axios.post('/api/analytics/report-data', {
        reportType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        projects: selectedProjects
      });
      
      if (res.data) {
        setReportData(res.data);
        setPreviewMode(true);
      } else {
        setError('No data received from server');
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err.response?.data?.error || 'Failed to generate report preview');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const res = await axios.post('/api/analytics/generate-report', {
        reportType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        projects: selectedProjects,
        reportData,
        aiCommentary
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Mertis_${reportType.charAt(0).toUpperCase() + reportType.slice(1)}_Report_${dateRange.startDate}_to_${dateRange.endDate}.pdf`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Failed to generate PDF report');
    } finally {
      setGenerating(false);
    }
  };

  const copyEmailToClipboard = () => {
    const emailContent = document.querySelector('.email-preview-content');
    if (emailContent) {
      navigator.clipboard.writeText(emailContent.innerText);
      alert('Email content copied to clipboard!');
    }
  };

  const COLORS = {
    status: ['#3b82f6', '#8b5cf6', '#10b981', '#6b7280', '#f59e0b'],
    severity: ['#dc2626', '#f97316', '#eab308', '#22c55e'],
    priority: ['#dc2626', '#f97316', '#eab308', '#22c55e'],
    projects: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateFull = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const safeNum = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val, 10) || 0;
    return 0;
  };

  const projectOptions = projects.map(p => `${p.projectKey || p.key} - ${p.name}`);
  const selectedDisplay = selectedProjects.map(key => {
    const project = projects.find(p => (p.projectKey || p.key) === key);
    return project ? `${key} - ${project.name}` : key;
  });

  const handleProjectChange = (newSelected) => setSelectedProjects(newSelected.map(item => item.split(' - ')[0]));
  const selectAllProjects = () => setSelectedProjects(projects.map(p => p.projectKey || p.key));
  const clearAllProjects = () => setSelectedProjects([]);

  // Safe data accessors
  const summary = reportData?.summary || {};
  const currentSnapshot = reportData?.currentSnapshot || {};
  const statusDist = Array.isArray(reportData?.statusDistribution) ? reportData.statusDistribution : [];
  const severityDist = Array.isArray(reportData?.currentSeverityDistribution) ? reportData.currentSeverityDistribution : 
                       Array.isArray(reportData?.severityDistribution) ? reportData.severityDistribution : [];
  const priorityDist = Array.isArray(reportData?.currentPriorityDistribution) ? reportData.currentPriorityDistribution :
                       Array.isArray(reportData?.priorityDistribution) ? reportData.priorityDistribution : [];
  const dailyActivity = Array.isArray(reportData?.dailyActivity) ? reportData.dailyActivity : [];
  const projectHealth = Array.isArray(reportData?.projectHealth) ? reportData.projectHealth : [];
  const assigneePerformance = Array.isArray(reportData?.assigneePerformance) ? reportData.assigneePerformance : [];
  const criticalBugs = Array.isArray(reportData?.criticalBugs) ? reportData.criticalBugs : [];
  const activitySummary = reportData?.activitySummary || {};
  const weekOverWeek = reportData?.weekOverWeek || null;
  const arbTrend = Array.isArray(reportData?.arbTrend) ? reportData.arbTrend : [];

  const getHealthIndicator = (score) => {
    if (score >= 70) return { class: 'good', icon: '🟢' };
    if (score >= 40) return { class: 'medium', icon: '🟡' };
    return { class: 'low', icon: '🔴' };
  };

  return (
    <FeatureGuard
      feature="advanced_reporting"
      fallback={
        <div className="card" style={{ padding: '2rem', textAlign: 'center', maxWidth: '520px', margin: '2rem auto' }}>
          <h2>Advanced Reporting — Professional Plan</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            PDF reports, AI commentary, and stakeholder dashboards require a Professional license.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => promptUpgrade('advanced_reporting')}>
            Upgrade to unlock
          </button>
        </div>
      }
    >
    <div className="report-generator">
      <div className="dashboard-header">
        <h1>📊 PM Report Generator</h1>
        <p>Generate professional weekly or monthly status reports for stakeholders</p>
      </div>

      {error && <div className="error-message" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Configuration Card */}
      <div className="card">
        <h3 className="card-title">Report Configuration</h3>
        
        <div className="report-config-grid">
          <div className="form-group">
            <label className="form-label">Report Type</label>
            <div className="report-type-buttons">
              <button type="button" className={`report-type-btn ${reportType === 'weekly' ? 'active' : ''}`} onClick={() => setReportType('weekly')}>
                📅 Weekly Report
              </button>
              <button type="button" className={`report-type-btn ${reportType === 'monthly' ? 'active' : ''}`} onClick={() => setReportType('monthly')}>
                🗓️ Monthly Report
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Date Range</label>
            <div className="date-range-inputs">
              <div className="date-field">
                <span className="date-label">From</span>
                <input type="date" className="form-control" value={dateRange.startDate} onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})} />
              </div>
              <div className="date-field">
                <span className="date-label">To</span>
                <input type="date" className="form-control" value={dateRange.endDate} onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})} />
              </div>
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label className="form-label">
            Projects to Include
            <span className="project-count-badge">{selectedProjects.length === projects.length ? 'All Selected' : `${selectedProjects.length} of ${projects.length}`}</span>
          </label>
          <div className="project-selection-actions">
            <button type="button" className="btn btn-sm btn-secondary" onClick={selectAllProjects}>✓ Select All</button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={clearAllProjects}>✕ Clear All</button>
          </div>
          <MultiSelect options={projectOptions} selected={selectedDisplay} onChange={handleProjectChange} placeholder="Search and select projects..." />
        </div>

        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label className="form-label">Output Format</label>
          <div className="format-toggle">
            <button type="button" className={`format-btn ${emailMode ? 'active' : ''}`} onClick={() => setEmailMode(true)}>✉️ Email Format</button>
            <button type="button" className={`format-btn ${!emailMode ? 'active' : ''}`} onClick={() => setEmailMode(false)}>📊 Dashboard Format</button>
          </div>
        </div>

        <div className="report-actions">
          <button className="btn btn-primary btn-lg" onClick={fetchReportData} disabled={loading || selectedProjects.length === 0}>
            {loading ? '⏳ Generating...' : '👁️ Generate Preview'}
          </button>
          {reportData && (
            <>
              <button className="btn btn-success btn-lg" onClick={generatePDF} disabled={generating}>
                {generating ? '⏳ Creating PDF...' : '📥 Download PDF Report'}
              </button>
              {emailMode && <button className="btn btn-secondary btn-lg" onClick={copyEmailToClipboard}>📋 Copy Email</button>}
            </>
          )}
        </div>
      </div>

      {/* Report Preview */}
      {previewMode && reportData && (
        <div className="report-preview">
          <div className="preview-header">
            <h2>{emailMode ? '✉️ Email Preview' : '📋 Report Preview'}</h2>
            <span className="preview-badge">{reportType === 'weekly' ? 'Weekly' : 'Monthly'} Report: {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}</span>
          </div>

          {emailMode ? (
            /* ==================== EMAIL FORMAT ==================== */
            <div className="email-container">
              <div className="email-preview-content">
                {/* Email Header */}
                <div className="email-header">
                  <div className="email-logo-section">
                    <div className="email-logo">🐛</div>
                    <div className="email-branding">
                      <h1>Mertis</h1>
                      <span className="email-subtitle">Engineering Status Report</span>
                    </div>
                  </div>
                  <div className="email-meta">
                    <div className="email-date">{formatDateFull(new Date().toISOString())}</div>
                    <div className="email-period">Reporting Period: {formatDate(dateRange.startDate)} — {formatDate(dateRange.endDate)}</div>
                  </div>
                </div>

                {/* Subject Line */}
                <div className="email-subject">
                  <span className="subject-label">Subject:</span>
                  <span className="subject-text">[{reportType === 'weekly' ? 'Weekly' : 'Monthly'}] Engineering Bug Status Report — {formatDate(dateRange.startDate)} to {formatDate(dateRange.endDate)}</span>
                </div>

                {/* Greeting */}
                <div className="email-greeting">
                  <p>Hi Team,</p>
                  <p>Please find below the {reportType} bug status report for our engineering projects.</p>
                </div>

                {/* AI Insights Control Panel */}
                <div className="email-section ai-control-section">
                  <div className="ai-control-panel">
                    <div className="ai-control-header">
                      <h3>🤖 AI-Powered Insights</h3>
                      {aiCacheInfo && (
                        <span className="cache-badge">{aiCacheInfo.fromCache ? '📦 Cached' : '✨ Fresh'} • {formatTime(aiCacheInfo.timestamp)}</span>
                      )}
                    </div>
                    <div className="ai-control-actions">
                      <button className={`btn ${aiCommentary?.isBasic ? 'btn-primary' : 'btn-secondary'} btn-ai`} onClick={generateAIInsights} disabled={loadingAI}>
                        {loadingAI ? (<><span className="loading-spinner-small"></span> Generating...</>) 
                          : aiCacheInfo?.fromCache ? '🔄 Use Cached Insights' 
                          : aiCommentary?.isBasic ? '✨ Generate AI Insights' : '🔄 Regenerate'}
                      </button>
                      {aiCacheInfo && (
                        <button className="btn btn-sm btn-outline" onClick={clearAICache} title="Clear cached insights">🗑️ Clear Cache</button>
                      )}
                    </div>
                    {aiCommentary?.isBasic && <p className="ai-hint">💡 Click "Generate AI Insights" for detailed analysis (uses ~200 tokens)</p>}
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="email-section executive-summary">
                  <h2>📌 Executive Summary</h2>
                  <div className="summary-card-email">
                    <p className="executive-text">{aiCommentary?.executiveSummary || 'Loading...'}</p>
                  </div>
                </div>

                {/* Key Metrics Banner */}
                <div className="email-section">
                  <h2>📊 Key Metrics at a Glance</h2>
                  <div className="metrics-banner">
                    <div className="metric-item"><div className="metric-icon">📝</div><div className="metric-value">{safeNum(summary.totalBugsCreated)}</div><div className="metric-label">Bugs Filed</div></div>
                    <div className="metric-item success"><div className="metric-icon">✅</div><div className="metric-value">{safeNum(summary.totalBugsResolved)}</div><div className="metric-label">Resolved</div></div>
                    <div className="metric-item"><div className="metric-icon">📈</div><div className="metric-value">{typeof summary.resolutionRate === 'number' ? summary.resolutionRate.toFixed(0) : '0'}%</div><div className="metric-label">Resolution Rate</div></div>
                    <div className="metric-item warning"><div className="metric-icon">⏱️</div><div className="metric-value">{safeNum(summary.avgResolutionTime)}d</div><div className="metric-label">Avg Resolution</div></div>
                    <div className="metric-item danger"><div className="metric-icon">🚨</div><div className="metric-value">{safeNum(currentSnapshot.critical)}</div><div className="metric-label">Critical</div></div>
                  </div>
                </div>

                {/* Current Status Table */}
                <div className="email-section">
                  <h2>📈 Current Bug Status</h2>
                  <p className="section-intro">Real-time snapshot across {selectedProjects.length} project(s):</p>
                  <table className="email-table status-table">
                    <thead><tr><th>Status</th><th>Count</th><th>Percentage</th><th>Visual</th></tr></thead>
                    <tbody>
                      <tr><td><span className="status-dot open"></span> Open</td><td className="count-cell">{safeNum(currentSnapshot.open)}</td><td>{currentSnapshot.totalBugs ? ((safeNum(currentSnapshot.open) / currentSnapshot.totalBugs) * 100).toFixed(1) : 0}%</td><td><div className="progress-bar"><div className="progress-fill open" style={{ width: `${currentSnapshot.totalBugs ? (safeNum(currentSnapshot.open) / currentSnapshot.totalBugs) * 100 : 0}%` }}></div></div></td></tr>
                      <tr><td><span className="status-dot in-progress"></span> In Progress</td><td className="count-cell">{safeNum(currentSnapshot.inProgress)}</td><td>{currentSnapshot.totalBugs ? ((safeNum(currentSnapshot.inProgress) / currentSnapshot.totalBugs) * 100).toFixed(1) : 0}%</td><td><div className="progress-bar"><div className="progress-fill in-progress" style={{ width: `${currentSnapshot.totalBugs ? (safeNum(currentSnapshot.inProgress) / currentSnapshot.totalBugs) * 100 : 0}%` }}></div></div></td></tr>
                      <tr><td><span className="status-dot resolved"></span> Resolved</td><td className="count-cell">{safeNum(currentSnapshot.resolved)}</td><td>{currentSnapshot.totalBugs ? ((safeNum(currentSnapshot.resolved) / currentSnapshot.totalBugs) * 100).toFixed(1) : 0}%</td><td><div className="progress-bar"><div className="progress-fill resolved" style={{ width: `${currentSnapshot.totalBugs ? (safeNum(currentSnapshot.resolved) / currentSnapshot.totalBugs) * 100 : 0}%` }}></div></div></td></tr>
                      <tr><td><span className="status-dot closed"></span> Closed</td><td className="count-cell">{safeNum(currentSnapshot.closed)}</td><td>{currentSnapshot.totalBugs ? ((safeNum(currentSnapshot.closed) / currentSnapshot.totalBugs) * 100).toFixed(1) : 0}%</td><td><div className="progress-bar"><div className="progress-fill closed" style={{ width: `${currentSnapshot.totalBugs ? (safeNum(currentSnapshot.closed) / currentSnapshot.totalBugs) * 100 : 0}%` }}></div></div></td></tr>
                      <tr className="total-row"><td><strong>Total</strong></td><td className="count-cell"><strong>{safeNum(currentSnapshot.totalBugs)}</strong></td><td><strong>100%</strong></td><td></td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Daily Activity Chart */}
                {dailyActivity.length > 0 && (
                  <div className="email-section">
                    <h2>📆 Daily Bug Activity</h2>
                    <div className="email-chart-container">
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={dailyActivity}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(v) => v ? v.slice(5) : ''} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                          <Legend />
                          <Area type="monotone" dataKey="created" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Created" strokeWidth={2} />
                          <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Resolved" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Week over Week */}
                {reportType === 'weekly' && weekOverWeek && (
                  <div className="email-section">
                    <h2>📊 Week over Week Comparison</h2>
                    <div className="wow-grid">
                      <div className="wow-card">
                        <div className="wow-header">Bugs Filed</div>
                        <div className="wow-values"><span className="wow-current">{safeNum(weekOverWeek.currentWeek?.created)}</span><span className="wow-vs">vs</span><span className="wow-prev">{safeNum(weekOverWeek.previousWeek?.created)}</span></div>
                        <div className={`wow-change ${(weekOverWeek.createdChange || 0) <= 0 ? 'positive' : 'negative'}`}>{(weekOverWeek.createdChange || 0) >= 0 ? '↑' : '↓'} {Math.abs(weekOverWeek.createdChange || 0).toFixed(1)}%</div>
                      </div>
                      <div className="wow-card">
                        <div className="wow-header">Resolved</div>
                        <div className="wow-values"><span className="wow-current">{safeNum(weekOverWeek.currentWeek?.resolved)}</span><span className="wow-vs">vs</span><span className="wow-prev">{safeNum(weekOverWeek.previousWeek?.resolved)}</span></div>
                        <div className={`wow-change ${(weekOverWeek.resolvedChange || 0) >= 0 ? 'positive' : 'negative'}`}>{(weekOverWeek.resolvedChange || 0) >= 0 ? '↑' : '↓'} {Math.abs(weekOverWeek.resolvedChange || 0).toFixed(1)}%</div>
                      </div>
                      <div className="wow-card">
                        <div className="wow-header">Resolution Rate</div>
                        <div className="wow-values"><span className="wow-current">{typeof weekOverWeek.currentWeek?.rate === 'number' ? weekOverWeek.currentWeek.rate.toFixed(0) : '0'}%</span><span className="wow-vs">vs</span><span className="wow-prev">{typeof weekOverWeek.previousWeek?.rate === 'number' ? weekOverWeek.previousWeek.rate.toFixed(0) : '0'}%</span></div>
                        <div className={`wow-change ${(weekOverWeek.rateChange || 0) >= 0 ? 'positive' : 'negative'}`}>{(weekOverWeek.rateChange || 0) >= 0 ? '↑' : '↓'} {Math.abs(weekOverWeek.rateChange || 0).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Health */}
                {projectHealth.length > 0 && (
                  <div className="email-section">
                    <h2>🏥 Project Health Summary</h2>
                    <p className="section-intro">{aiCommentary?.projectAnalysis || ''}</p>
                    <table className="email-table">
                      <thead><tr><th>Project</th><th>Total</th><th>Open</th><th>In Progress</th><th>Resolved</th><th>Critical</th><th>Health</th></tr></thead>
                      <tbody>
                        {projectHealth.map((p, idx) => {
                          const h = getHealthIndicator(p.healthScore || 0);
                          return (<tr key={idx}><td><strong>{p.projectKey}</strong> <span className="project-name-email">{p.projectName}</span></td><td className="count-cell">{safeNum(p.total)}</td><td className="count-cell warning">{safeNum(p.open)}</td><td className="count-cell purple">{safeNum(p.inProgress)}</td><td className="count-cell success">{safeNum(p.resolved)}</td><td className="count-cell danger">{safeNum(p.critical)}</td><td><span className={`health-badge ${h.class}`}>{h.icon} {(p.healthScore || 0).toFixed(0)}/100</span></td></tr>);
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Team Performance */}
                {assigneePerformance.length > 0 && (
                  <div className="email-section">
                    <h2>👥 Team Performance</h2>
                    <p className="section-intro">{aiCommentary?.teamAnalysis || ''}</p>
                    <div className="top-performers">
                      <h3>🏆 Top Contributors</h3>
                      <div className="performers-grid">
                        {assigneePerformance.filter(u => safeNum(u.resolved) > 0).sort((a, b) => safeNum(b.resolved) - safeNum(a.resolved)).slice(0, 3).map((u, i) => (
                          <div key={i} className={`performer-card rank-${i + 1}`}>
                            <div className="performer-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                            <div className="performer-name">{u.assignee || 'Unknown'}</div>
                            <div className="performer-stats"><span className="stat">{safeNum(u.resolved)} resolved</span><span className="stat">{typeof u.resolutionRate === 'number' ? u.resolutionRate.toFixed(0) : '0'}% rate</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <table className="email-table" style={{ marginTop: '1.5rem' }}>
                      <thead><tr><th>Team Member</th><th>Assigned</th><th>Open/In Progress</th><th>Resolved</th><th>Resolution Rate</th><th>Avg Time</th></tr></thead>
                      <tbody>
                        {assigneePerformance.slice(0, 10).map((u, i) => (
                          <tr key={i}><td><strong>{u.assignee || 'Unassigned'}</strong></td><td className="count-cell">{safeNum(u.assigned)}</td><td className="count-cell warning">{safeNum(u.openInProgress)}</td><td className="count-cell success">{safeNum(u.resolved)}</td><td><span className={`rate-badge ${(u.resolutionRate || 0) >= 70 ? 'good' : (u.resolutionRate || 0) >= 40 ? 'medium' : 'low'}`}>{typeof u.resolutionRate === 'number' ? u.resolutionRate.toFixed(0) : '0'}%</span></td><td>{typeof u.avgResolutionTime === 'number' ? u.avgResolutionTime.toFixed(1) : '-'}d</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Critical Bugs */}
                {criticalBugs.length > 0 && (
                  <div className="email-section attention-section">
                    <h2>🚨 Critical & High Priority Bugs</h2>
                    <p className="section-intro">{aiCommentary?.riskAssessment || ''}</p>
                    <table className="email-table critical-table">
                      <thead><tr><th>Bug ID</th><th>Title</th><th>Project</th><th>Severity</th><th>Assignee</th><th>Age</th><th>Status</th></tr></thead>
                      <tbody>
                        {criticalBugs.slice(0, 10).map((b, i) => (
                          <tr key={i} className={safeNum(b.age) > 7 ? 'row-warning' : ''}>
                            <td><span className="bug-id-badge">{b.bugId || '-'}</span></td>
                            <td className="title-cell">{b.title || '-'}</td>
                            <td><span className="project-badge-small">{b.projectKey || '-'}</span></td>
                            <td><span className={`severity-badge ${(b.severity || '').toLowerCase()}`}>{b.severity || '-'}</span></td>
                            <td>{b.assignee || 'Unassigned'}</td>
                            <td className={safeNum(b.age) > 7 ? 'age-warning' : safeNum(b.age) > 3 ? 'age-caution' : ''}>{safeNum(b.age)}d {safeNum(b.age) > 7 && '⚠️'}</td>
                            <td><span className={`status-badge ${(b.status || '').toLowerCase().replace(' ', '-')}`}>{b.status || '-'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {criticalBugs.length > 10 && <p className="more-items-note">... and {criticalBugs.length - 10} more items</p>}
                  </div>
                )}

                {/* Activity Summary */}
                <div className="email-section">
                  <h2>📝 Activity Summary</h2>
                  <div className="activity-grid">
                    <div className="activity-item"><span className="activity-icon">💬</span><span className="activity-value">{safeNum(activitySummary.comments)}</span><span className="activity-label">Comments Added</span></div>
                    <div className="activity-item"><span className="activity-icon">🔄</span><span className="activity-value">{safeNum(activitySummary.statusChanges)}</span><span className="activity-label">Status Changes</span></div>
                    <div className="activity-item"><span className="activity-icon">👤</span><span className="activity-value">{safeNum(activitySummary.reassignments)}</span><span className="activity-label">Reassignments</span></div>
                    <div className="activity-item"><span className="activity-icon">🔗</span><span className="activity-value">{safeNum(activitySummary.commits)}</span><span className="activity-label">Commits Linked</span></div>
                  </div>
                </div>

                {/* Recommendations */}
                {aiCommentary?.recommendations && !aiCommentary.isBasic && (
                  <div className="email-section recommendations-section">
                    <h2>💡 Recommendations</h2>
                    <ul className="recommendations-list">{aiCommentary.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}

                {/* Closing */}
                <div className="email-closing">
                  <p>{!aiCommentary?.isBasic ? aiCommentary?.closingNote : 'Thank you for your continued effort in maintaining product quality.'}</p>
                  <p>Best regards,<br /><strong>Mertis System</strong></p>
                </div>

                <div className="email-footer">
                  <p className="footer-text">This is an automated report generated by Mertis.</p>
                  <p className="footer-confidential">CONFIDENTIAL — proprietary information{configured ? ` of ${organizationName}` : ''}</p>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== FULL DASHBOARD FORMAT ==================== */
            <>
              {/* AI Insights Control Panel for Dashboard */}
              <div className="card ai-control-section">
                <div className="ai-control-panel">
                  <div className="ai-control-header">
                    <h3>🤖 AI-Powered Insights</h3>
                    {aiCacheInfo && (
                      <span className="cache-badge">{aiCacheInfo.fromCache ? '📦 Cached' : '✨ Fresh'} • {formatTime(aiCacheInfo.timestamp)}</span>
                    )}
                  </div>
                  <div className="ai-control-actions">
                    <button className={`btn ${aiCommentary?.isBasic ? 'btn-primary' : 'btn-secondary'} btn-ai`} onClick={generateAIInsights} disabled={loadingAI}>
                      {loadingAI ? (<><span className="loading-spinner-small"></span> Generating...</>) 
                        : aiCacheInfo?.fromCache ? '🔄 Use Cached Insights' 
                        : aiCommentary?.isBasic ? '✨ Generate AI Insights' : '🔄 Regenerate'}
                    </button>
                    {aiCacheInfo && (
                      <button className="btn btn-sm btn-outline" onClick={clearAICache} title="Clear cached insights">🗑️ Clear Cache</button>
                    )}
                  </div>
                  {aiCommentary && !aiCommentary.isBasic && (
                    <div className="ai-summary-preview">
                      <p><strong>Summary:</strong> {aiCommentary.executiveSummary}</p>
                    </div>
                  )}
                  {aiCommentary?.isBasic && <p className="ai-hint">💡 Click "Generate AI Insights" for detailed analysis (uses ~200 tokens)</p>}
                </div>
              </div>

              {/* SECTION 1: Current Snapshot */}
              <div className="card">
                <h3>📈 Current Bug Status (Selected Projects)</h3>
                <p className="section-subtitle">Real-time snapshot of all bugs in selected projects</p>
                <div className="stats-grid">
                  <div className="stat-card primary">
                    <div className="stat-value">{safeNum(currentSnapshot.totalBugs)}</div>
                    <div className="stat-label">Total Bugs</div>
                  </div>
                  <div className="stat-card warning">
                    <div className="stat-value">{safeNum(currentSnapshot.open)}</div>
                    <div className="stat-label">Open</div>
                  </div>
                  <div className="stat-card" style={{ background: 'rgba(139, 92, 246, 0.15)', borderColor: '#8b5cf6' }}>
                    <div className="stat-value" style={{ color: '#8b5cf6' }}>{safeNum(currentSnapshot.inProgress)}</div>
                    <div className="stat-label">In Progress</div>
                  </div>
                  <div className="stat-card success">
                    <div className="stat-value">{safeNum(currentSnapshot.resolved) + safeNum(currentSnapshot.closed)}</div>
                    <div className="stat-label">Resolved/Closed</div>
                  </div>
                  <div className="stat-card critical">
                    <div className="stat-value">{safeNum(currentSnapshot.critical)}</div>
                    <div className="stat-label">Critical</div>
                  </div>
                  <div className="stat-card" style={{ background: 'rgba(249, 115, 22, 0.15)', borderColor: '#f97316' }}>
                    <div className="stat-value" style={{ color: '#f97316' }}>{safeNum(currentSnapshot.high)}</div>
                    <div className="stat-label">High Severity</div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Period Activity */}
              <div className="card summary-card">
                <h3>📊 Period Activity Summary</h3>
                <p className="section-subtitle">Bugs created and resolved during {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}</p>
                <div className="summary-metrics">
                  <div className="summary-metric">
                    <span className="metric-value">{safeNum(summary.totalBugsCreated)}</span>
                    <span className="metric-label">Bugs Filed</span>
                  </div>
                  <div className="summary-metric success">
                    <span className="metric-value">{safeNum(summary.totalBugsResolved)}</span>
                    <span className="metric-label">Bugs Resolved</span>
                  </div>
                  <div className="summary-metric warning">
                    <span className="metric-value">{safeNum(summary.netChange)}</span>
                    <span className="metric-label">Net Change</span>
                  </div>
                  <div className="summary-metric">
                    <span className="metric-value">{safeNum(summary.avgResolutionTime)}d</span>
                    <span className="metric-label">Avg Resolution</span>
                  </div>
                  <div className="summary-metric">
                    <span className="metric-value">{typeof summary.resolutionRate === 'number' ? summary.resolutionRate.toFixed(1) : '0'}%</span>
                    <span className="metric-label">Resolution Rate</span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Distribution Charts */}
              <div className="charts-grid three-col">
                <div className="card chart-card">
                  <h3>📊 Status Distribution</h3>
                  <div style={{ width: '100%', height: 220 }}>
                    {statusDist.length > 0 ? (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={statusDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" 
                               label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={{ stroke: '#94a3b8' }}>
                            {statusDist.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS.status[index % COLORS.status.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="no-data">No data available</div>}
                  </div>
                </div>

                <div className="card chart-card">
                  <h3>🎯 Severity Distribution</h3>
                  <div style={{ width: '100%', height: 220 }}>
                    {severityDist.length > 0 ? (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={severityDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                               label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={{ stroke: '#94a3b8' }}>
                            {severityDist.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS.severity[index % COLORS.severity.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="no-data">No data available</div>}
                  </div>
                </div>

                <div className="card chart-card">
                  <h3>⚡ Priority Distribution</h3>
                  <div style={{ width: '100%', height: 220 }}>
                    {priorityDist.length > 0 ? (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={priorityDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                               label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={{ stroke: '#94a3b8' }}>
                            {priorityDist.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS.priority[index % COLORS.priority.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="no-data">No data available</div>}
                  </div>
                </div>
              </div>

              {/* SECTION 4: Trend Charts */}
              <div className="charts-grid two-col">
                <div className="card chart-card">
                  <h3>📆 Daily Bug Activity</h3>
                  <div style={{ width: '100%', height: 280 }}>
                    {dailyActivity.length > 0 ? (
                      <ResponsiveContainer>
                        <AreaChart data={dailyActivity}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={(v) => v ? v.slice(5) : ''} />
                          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                          <Legend />
                          <Area type="monotone" dataKey="created" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Created" />
                          <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Resolved" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <div className="no-data">No activity data available</div>}
                  </div>
                </div>

                <div className="card chart-card">
                  <h3>📈 Resolution Trend</h3>
                  <div style={{ width: '100%', height: 280 }}>
                    {arbTrend.length > 0 ? (
                      <ResponsiveContainer>
                        <LineChart data={arbTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={(v) => v ? v.slice(5) : ''} />
                          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} formatter={(val) => `${val}%`} />
                          <Legend />
                          <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} name="Resolution Rate %" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : <div className="no-data">No trend data available</div>}
                  </div>
                </div>
              </div>

              {/* SECTION 5: Bugs by Project */}
              {projectHealth.length > 0 && (
                <div className="card chart-card">
                  <h3>📁 Bugs by Project</h3>
                  <div style={{ width: '100%', height: Math.max(300, projectHealth.length * 45) }}>
                    <ResponsiveContainer>
                      <BarChart data={projectHealth} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis type="category" dataKey="projectKey" stroke="#94a3b8" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        <Legend />
                        <Bar dataKey="open" stackId="a" fill="#3b82f6" name="Open" />
                        <Bar dataKey="inProgress" stackId="a" fill="#8b5cf6" name="In Progress" />
                        <Bar dataKey="resolved" stackId="a" fill="#10b981" name="Resolved" />
                        <Bar dataKey="closed" stackId="a" fill="#6b7280" name="Closed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* SECTION 6: Project Health Table */}
              {projectHealth.length > 0 && (
                <div className="card">
                  <h3>🏥 Project Health Summary</h3>
                  <table className="bug-table report-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Total</th>
                        <th>Open</th>
                        <th>In Progress</th>
                        <th>Resolved</th>
                        <th>Critical</th>
                        <th>Health</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectHealth.map((project, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className="project-badge">{project.projectKey || '-'}</span>
                            <span className="project-name-small">{project.projectName || ''}</span>
                          </td>
                          <td>{safeNum(project.total)}</td>
                          <td className="text-warning">{safeNum(project.open)}</td>
                          <td style={{ color: '#8b5cf6' }}>{safeNum(project.inProgress)}</td>
                          <td className="text-success">{safeNum(project.resolved)}</td>
                          <td className="text-danger">{safeNum(project.critical)}</td>
                          <td>
                            <span className={`health-score ${(project.healthScore || 0) >= 70 ? 'good' : (project.healthScore || 0) >= 40 ? 'medium' : 'low'}`}>
                              {typeof project.healthScore === 'number' ? project.healthScore.toFixed(0) : '0'}/100
                            </span>
                          </td>
                          <td>
                            <span className={`status-indicator ${(project.healthScore || 0) >= 70 ? 'healthy' : (project.healthScore || 0) >= 40 ? 'warning' : 'critical'}`}>
                              {(project.healthScore || 0) >= 70 ? '✅ Healthy' : (project.healthScore || 0) >= 40 ? '⚠️ Attention' : '🔴 Critical'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SECTION 7: Team Performance */}
              {assigneePerformance.length > 0 && (
                <div className="card">
                  <h3>👥 Team Performance</h3>
                  <table className="bug-table report-table">
                    <thead>
                      <tr>
                        <th>Assignee</th>
                        <th>Assigned</th>
                        <th>Open/In Progress</th>
                        <th>Resolved</th>
                        <th>Resolution Rate</th>
                        <th>Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigneePerformance.slice(0, 10).map((user, idx) => (
                        <tr key={idx}>
                          <td><strong>{user.assignee || 'Unassigned'}</strong></td>
                          <td>{safeNum(user.assigned)}</td>
                          <td className="text-warning">{safeNum(user.openInProgress)}</td>
                          <td className="text-success">{safeNum(user.resolved)}</td>
                          <td>
                            <span className={`rate-badge ${(user.resolutionRate || 0) >= 70 ? 'good' : (user.resolutionRate || 0) >= 40 ? 'medium' : 'low'}`}>
                              {typeof user.resolutionRate === 'number' ? user.resolutionRate.toFixed(0) : '0'}%
                            </span>
                          </td>
                          <td>{typeof user.avgResolutionTime === 'number' ? user.avgResolutionTime.toFixed(1) : '0'}d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SECTION 7b: User Performance Chart */}
              {assigneePerformance.length > 0 && (
                <div className="card chart-card">
                  <h3>📊 User Performance Overview</h3>
                  <div style={{ width: '100%', height: Math.max(300, assigneePerformance.slice(0, 10).length * 40) }}>
                    <ResponsiveContainer>
                      <BarChart data={assigneePerformance.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis type="category" dataKey="assignee" stroke="#94a3b8" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        <Legend />
                        <Bar dataKey="assigned" fill="#3b82f6" name="Assigned" />
                        <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
                        <Bar dataKey="openInProgress" fill="#f59e0b" name="Open/In Progress" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* SECTION 7c: Bug Aging Analysis & Top Contributors */}
              {criticalBugs.length > 0 && (
                <div className="charts-grid two-col">
                  <div className="card chart-card">
                    <h3>⏱️ Bug Aging Analysis</h3>
                    <div style={{ width: '100%', height: 250 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie 
                            data={[
                              { name: '< 3 days', value: criticalBugs.filter(b => safeNum(b.age) < 3).length, color: '#10b981' },
                              { name: '3-7 days', value: criticalBugs.filter(b => safeNum(b.age) >= 3 && safeNum(b.age) < 7).length, color: '#f59e0b' },
                              { name: '7-14 days', value: criticalBugs.filter(b => safeNum(b.age) >= 7 && safeNum(b.age) < 14).length, color: '#f97316' },
                              { name: '> 14 days', value: criticalBugs.filter(b => safeNum(b.age) >= 14).length, color: '#dc2626' }
                            ].filter(d => d.value > 0)} 
                            cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {[
                              { name: '< 3 days', color: '#10b981' },
                              { name: '3-7 days', color: '#f59e0b' },
                              { name: '7-14 days', color: '#f97316' },
                              { name: '> 14 days', color: '#dc2626' }
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="card">
                    <h3>🏆 Top Contributors</h3>
                    <div className="top-contributors">
                      {assigneePerformance
                        .filter(u => safeNum(u.resolved) > 0)
                        .sort((a, b) => safeNum(b.resolved) - safeNum(a.resolved))
                        .slice(0, 5)
                        .map((user, idx) => (
                          <div key={idx} className="contributor-item">
                            <div className="contributor-rank">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</div>
                            <div className="contributor-info">
                              <div className="contributor-name">{user.assignee || 'Unknown'}</div>
                              <div className="contributor-stats">
                                <span className="stat-resolved">{safeNum(user.resolved)} resolved</span>
                                <span className="stat-rate">{typeof user.resolutionRate === 'number' ? user.resolutionRate.toFixed(0) : '0'}% rate</span>
                              </div>
                            </div>
                            <div className="contributor-bar">
                              <div 
                                className="contributor-bar-fill" 
                                style={{ 
                                  width: `${Math.min(100, (safeNum(user.resolved) / Math.max(1, safeNum(assigneePerformance[0]?.resolved))) * 100)}%` 
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      {assigneePerformance.filter(u => safeNum(u.resolved) > 0).length === 0 && (
                        <div className="no-data">No resolved bugs in this period</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 8: Critical Bugs */}
              {criticalBugs.length > 0 && (
                <div className="card">
                  <h3>🚨 Critical & High Priority Bugs (Requires Attention)</h3>
                  <table className="bug-table report-table">
                    <thead>
                      <tr>
                        <th>Bug ID</th>
                        <th>Title</th>
                        <th>Project</th>
                        <th>Severity</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                        <th>Age</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criticalBugs.slice(0, 15).map((bug, idx) => (
                        <tr key={idx}>
                          <td><span className="bug-id">{bug.bugId || '-'}</span></td>
                          <td className="bug-title">{bug.title || '-'}</td>
                          <td><span className="project-badge">{bug.projectKey || '-'}</span></td>
                          <td><span className={`badge badge-${(bug.severity || '').toLowerCase()}`}>{bug.severity || '-'}</span></td>
                          <td><span className={`badge badge-${(bug.priority || '').toLowerCase()}`}>{bug.priority || '-'}</span></td>
                          <td>{bug.assignee || '-'}</td>
                          <td className={safeNum(bug.age) > 7 ? 'text-danger' : safeNum(bug.age) > 3 ? 'text-warning' : ''}>{safeNum(bug.age)}d</td>
                          <td><span className={`badge badge-${(bug.status || '').toLowerCase().replace(' ', '-')}`}>{bug.status || '-'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {criticalBugs.length > 15 && (
                    <p className="more-items">... and {criticalBugs.length - 15} more critical/high priority bugs</p>
                  )}
                </div>
              )}

              {/* SECTION 9: Week over Week */}
              {reportType === 'weekly' && weekOverWeek && (
                <div className="card">
                  <h3>📊 Week over Week Comparison</h3>
                  <div className="wow-comparison">
                    <div className="wow-metric">
                      <span className="wow-label">Bugs Filed</span>
                      <span className="wow-current">{safeNum(weekOverWeek.currentWeek?.created)}</span>
                      <span className={`wow-change ${(weekOverWeek.createdChange || 0) >= 0 ? 'up' : 'down'}`}>
                        {(weekOverWeek.createdChange || 0) >= 0 ? '▲' : '▼'} {Math.abs(weekOverWeek.createdChange || 0).toFixed(1)}%
                      </span>
                      <span className="wow-prev">vs {safeNum(weekOverWeek.previousWeek?.created)} last week</span>
                    </div>
                    <div className="wow-metric">
                      <span className="wow-label">Bugs Resolved</span>
                      <span className="wow-current">{safeNum(weekOverWeek.currentWeek?.resolved)}</span>
                      <span className={`wow-change ${(weekOverWeek.resolvedChange || 0) >= 0 ? 'up good' : 'down'}`}>
                        {(weekOverWeek.resolvedChange || 0) >= 0 ? '▲' : '▼'} {Math.abs(weekOverWeek.resolvedChange || 0).toFixed(1)}%
                      </span>
                      <span className="wow-prev">vs {safeNum(weekOverWeek.previousWeek?.resolved)} last week</span>
                    </div>
                    <div className="wow-metric">
                      <span className="wow-label">Resolution Rate</span>
                      <span className="wow-current">{typeof weekOverWeek.currentWeek?.rate === 'number' ? weekOverWeek.currentWeek.rate.toFixed(1) : '0'}%</span>
                      <span className={`wow-change ${(weekOverWeek.rateChange || 0) >= 0 ? 'up good' : 'down'}`}>
                        {(weekOverWeek.rateChange || 0) >= 0 ? '▲' : '▼'} {Math.abs(weekOverWeek.rateChange || 0).toFixed(1)}%
                      </span>
                      <span className="wow-prev">vs {typeof weekOverWeek.previousWeek?.rate === 'number' ? weekOverWeek.previousWeek.rate.toFixed(1) : '0'}% last week</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 10: Activity Summary */}
              <div className="card">
                <h3>📝 Activity Summary</h3>
                <div className="activity-summary">
                  <div className="activity-stat">
                    <span className="activity-icon">📝</span>
                    <span className="activity-count">{safeNum(activitySummary.comments)}</span>
                    <span className="activity-label">Comments Added</span>
                  </div>
                  <div className="activity-stat">
                    <span className="activity-icon">🔄</span>
                    <span className="activity-count">{safeNum(activitySummary.statusChanges)}</span>
                    <span className="activity-label">Status Changes</span>
                  </div>
                  <div className="activity-stat">
                    <span className="activity-icon">👤</span>
                    <span className="activity-count">{safeNum(activitySummary.reassignments)}</span>
                    <span className="activity-label">Reassignments</span>
                  </div>
                  <div className="activity-stat">
                    <span className="activity-icon">🔗</span>
                    <span className="activity-count">{safeNum(activitySummary.commits)}</span>
                    <span className="activity-label">Commits Linked</span>
                  </div>
                </div>
              </div>

              {/* AI Recommendations Section */}
              {aiCommentary?.recommendations && !aiCommentary.isBasic && (
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)', borderColor: '#10b981' }}>
                  <h3 style={{ color: '#059669' }}>💡 AI Recommendations</h3>
                  <ul className="recommendations-list" style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {aiCommentary.recommendations.map((r, i) => <li key={i} style={{ padding: '0.5rem 0', color: '#1e293b' }}>{r}</li>)}
                  </ul>
                  <p style={{ marginTop: '1rem', color: '#059669', fontStyle: 'italic' }}>{aiCommentary.closingNote}</p>
                </div>
              )}
            </>
          )}

          {/* Download Section */}
          <div className="download-section">
            <button className="btn btn-success btn-xl" onClick={generatePDF} disabled={generating}>
              {generating ? '⏳ Generating...' : '📥 Download Professional PDF Report'}
            </button>
            <p className="download-note">
              The PDF includes all charts, tables, and metrics shown above with professional formatting and branding.
            </p>
          </div>
        </div>
      )}
    </div>
    </FeatureGuard>
  );
}

export default ReportGenerator;
