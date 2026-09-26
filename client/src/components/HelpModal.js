import React, { useState, useEffect } from 'react';
import { PulseHelpExplainer } from './PulseHelpExplainer';
import { PulseHelpWorkflows } from './PulseHelpWorkflows';

function HelpModal({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchTerm, setSearchTerm] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections = [
    { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
    { id: 'projects', title: 'Projects', icon: '📁' },
    { id: 'bugs', title: 'Bug Management', icon: '🐛' },
    { id: 'fields', title: 'Field Reference', icon: '📝' },
    { id: 'workflow', title: 'Workflow', icon: '🔄' },
    { id: 'pulse', title: 'Pulse', icon: '◎' },
    { id: 'commit-guidelines', title: 'Git Commits', icon: '📤' },
    { id: 'tips', title: 'Tips & Tricks', icon: '💡' },
    { id: 'faq', title: 'FAQ', icon: '❓' },
  ];

  // Styles
  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px',
    },
    modal: {
      background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: '20px',
      width: '100%',
      maxWidth: '1100px',
      height: '85vh',
      maxHeight: '800px',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    header: {
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
      padding: '24px 30px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerContent: {
      flex: 1,
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      color: 'white',
      margin: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    subtitle: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: '14px',
      marginTop: '6px',
    },
    closeButton: {
      background: 'rgba(255,255,255,0.2)',
      border: 'none',
      borderRadius: '10px',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: 'white',
      fontSize: '20px',
      transition: 'all 0.2s',
    },
    body: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
    },
    sidebar: {
      width: '220px',
      background: '#1e293b',
      borderRight: '1px solid #334155',
      padding: '16px 12px',
      overflowY: 'auto',
    },
    navItem: (isActive) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 14px',
      borderRadius: '10px',
      border: 'none',
      background: isActive ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : 'transparent',
      color: isActive ? 'white' : '#94a3b8',
      fontSize: '14px',
      fontWeight: isActive ? '600' : '500',
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
      marginBottom: '4px',
      transition: 'all 0.2s',
    }),
    navIcon: {
      fontSize: '18px',
    },
    content: {
      flex: 1,
      padding: '24px 30px',
      overflowY: 'auto',
      background: '#0f172a',
    },
    sectionTitle: {
      fontSize: '22px',
      fontWeight: '700',
      color: '#f1f5f9',
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    sectionSubtitle: {
      color: '#94a3b8',
      fontSize: '15px',
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '1px solid #334155',
    },
    card: {
      background: '#1e293b',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid #334155',
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#f1f5f9',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    cardText: {
      color: '#94a3b8',
      fontSize: '14px',
      lineHeight: '1.7',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '16px',
      marginBottom: '16px',
    },
    highlightCard: (color) => ({
      background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${color}40`,
      borderTop: `3px solid ${color}`,
    }),
    list: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
    },
    listItem: {
      color: '#94a3b8',
      fontSize: '14px',
      padding: '8px 0',
      paddingLeft: '24px',
      position: 'relative',
      lineHeight: '1.6',
    },
    bullet: {
      position: 'absolute',
      left: '8px',
      color: '#4f46e5',
    },
    badge: (color) => ({
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: color,
      color: 'white',
      marginRight: '8px',
    }),
    fieldRow: {
      display: 'flex',
      padding: '14px 16px',
      background: '#0f172a',
      borderRadius: '8px',
      marginBottom: '8px',
      alignItems: 'flex-start',
      gap: '16px',
    },
    fieldName: {
      minWidth: '140px',
      fontWeight: '600',
      color: '#f1f5f9',
      fontSize: '14px',
    },
    fieldDesc: {
      color: '#94a3b8',
      fontSize: '14px',
      flex: 1,
    },
    required: {
      color: '#ef4444',
      marginLeft: '2px',
    },
    statusFlow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
      marginTop: '16px',
    },
    statusItem: (color) => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 16px',
      background: '#1e293b',
      borderRadius: '10px',
      minWidth: '100px',
      border: `2px solid ${color}`,
    }),
    statusDot: (color) => ({
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: color,
      marginBottom: '6px',
    }),
    statusName: {
      fontWeight: '600',
      color: '#f1f5f9',
      fontSize: '13px',
    },
    arrow: {
      color: '#4f46e5',
      fontSize: '20px',
      fontWeight: 'bold',
    },
    tipCard: {
      background: 'linear-gradient(135deg, #4f46e520 0%, #4f46e508 100%)',
      borderRadius: '12px',
      padding: '16px 20px',
      border: '1px solid #4f46e540',
      display: 'flex',
      gap: '14px',
      marginBottom: '12px',
    },
    tipIcon: {
      fontSize: '24px',
      flexShrink: 0,
    },
    tipContent: {
      flex: 1,
    },
    tipTitle: {
      fontWeight: '600',
      color: '#a78bfa',
      fontSize: '14px',
      marginBottom: '4px',
    },
    tipText: {
      color: '#94a3b8',
      fontSize: '13px',
      lineHeight: '1.6',
    },
    faqItem: {
      background: '#1e293b',
      borderRadius: '10px',
      marginBottom: '10px',
      border: '1px solid #334155',
      overflow: 'hidden',
    },
    faqQuestion: {
      padding: '16px 20px',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontWeight: '600',
      color: '#f1f5f9',
      fontSize: '14px',
    },
    faqAnswer: {
      padding: '0 20px 16px',
      color: '#94a3b8',
      fontSize: '14px',
      lineHeight: '1.7',
      borderTop: '1px solid #334155',
      paddingTop: '16px',
    },
    kbd: {
      display: 'inline-block',
      padding: '3px 8px',
      background: '#0f172a',
      border: '1px solid #475569',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      marginRight: '4px',
      boxShadow: '0 2px 0 #334155',
    },
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'getting-started':
        return (
          <>
            <h2 style={styles.sectionTitle}>🚀 Getting Started</h2>
            <p style={styles.sectionSubtitle}>Welcome to Mertis! Let's get you up and running quickly.</p>
            
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>What is Mertis?</h3>
              <p style={styles.cardText}>
                Mertis is a powerful yet simple bug tracking system designed to help teams efficiently 
                track, manage, and resolve software issues. It supports multiple projects, customizable 
                workflows, and seamless team collaboration.
              </p>
            </div>

            <div style={styles.grid}>
              <div style={styles.highlightCard('#8b5cf6')}>
                <h4 style={{...styles.cardTitle, color: '#a78bfa'}}>👤 For Team Members</h4>
                <ul style={styles.list}>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>View and filter bugs assigned to you</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Create new bug reports</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Update bug status and add comments</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Attach files and screenshots</li>
                </ul>
              </div>
              
              <div style={styles.highlightCard('#10b981')}>
                <h4 style={{...styles.cardTitle, color: '#34d399'}}>👑 For Administrators</h4>
                <ul style={styles.list}>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Create and manage projects</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Add and remove team members</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Configure GitHub integration</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>View analytics and reports</li>
                </ul>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🧭 Quick Navigation</h3>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#4f46e5')}>Dashboard</span>
                <span style={styles.fieldDesc}>Your personal overview with assigned bugs and statistics</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#4f46e5')}>Projects</span>
                <span style={styles.fieldDesc}>Browse all projects you have access to</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#4f46e5')}>My Bugs</span>
                <span style={styles.fieldDesc}>Quick access to bugs assigned to or reported by you</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#4f46e5')}>Pulse</span>
                <span style={styles.fieldDesc}>Strike Board, The Pit, My Pulse, and Friday numbers — the bugs as the plan</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#ef4444')}>Users</span>
                <span style={styles.fieldDesc}>User management (Admin only)</span>
              </div>
            </div>
          </>
        );

      case 'projects':
        return (
          <>
            <h2 style={styles.sectionTitle}>📁 Projects</h2>
            <p style={styles.sectionSubtitle}>Organize your bugs by project for better management.</p>
            
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Creating a New Project</h3>
              <p style={styles.cardText}>Only administrators can create new projects. Follow these steps:</p>
              <div style={{marginTop: '16px'}}>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #4f46e5'}}>
                  <span style={styles.badge('#4f46e5')}>Step 1</span>
                  <span style={styles.fieldDesc}>Navigate to <strong>Projects</strong> in the navigation bar</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #4f46e5'}}>
                  <span style={styles.badge('#4f46e5')}>Step 2</span>
                  <span style={styles.fieldDesc}>Click the <strong>"New Project"</strong> button in the top-right</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #4f46e5'}}>
                  <span style={styles.badge('#4f46e5')}>Step 3</span>
                  <span style={styles.fieldDesc}>Fill in project details and select team members</span>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📋 Project Fields</h3>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Project Name<span style={styles.required}>*</span></span>
                <span style={styles.fieldDesc}>A descriptive name (e.g., "Mobile App v2.0")</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Project Key<span style={styles.required}>*</span></span>
                <span style={styles.fieldDesc}>2-5 letter unique identifier. Used as bug ID prefix (e.g., "MOB" → MOB-0001)</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Description</span>
                <span style={styles.fieldDesc}>Brief description of the project's purpose and scope</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Client</span>
                <span style={styles.fieldDesc}>The client or stakeholder this project is for</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Team Members</span>
                <span style={styles.fieldDesc}>Users who will have access to this project</span>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>💡</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Pro Tip: Project Key</div>
                <div style={styles.tipText}>
                  Choose a memorable, short project key (2-4 characters). It becomes part of every bug ID!
                  Examples: API, WEB, IOS, AND
                </div>
              </div>
            </div>
          </>
        );

      case 'bugs':
        return (
          <>
            <h2 style={styles.sectionTitle}>🐛 Bug Management</h2>
            <p style={styles.sectionSubtitle}>Learn how to create, update, and track bugs effectively.</p>
            
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Creating a Bug Report</h3>
              <div style={{marginTop: '12px'}}>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #f59e0b'}}>
                  <span style={styles.badge('#f59e0b')}>1</span>
                  <span style={styles.fieldDesc}><strong>Select a Project</strong> - Navigate to the target project</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #f59e0b'}}>
                  <span style={styles.badge('#f59e0b')}>2</span>
                  <span style={styles.fieldDesc}><strong>Click "New Bug"</strong> - Found in the project's bug list</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #f59e0b'}}>
                  <span style={styles.badge('#f59e0b')}>3</span>
                  <span style={styles.fieldDesc}><strong>Fill Details</strong> - Clear title, description, severity, priority</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #f59e0b'}}>
                  <span style={styles.badge('#f59e0b')}>4</span>
                  <span style={styles.fieldDesc}><strong>Attach Evidence</strong> - Screenshots, logs, relevant files</span>
                </div>
              </div>
            </div>

            <div style={{...styles.card, background: 'linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)', borderColor: '#f59e0b40'}}>
              <h3 style={{...styles.cardTitle, color: '#fbbf24'}}>⚠️ Writing Good Bug Reports</h3>
              <p style={styles.cardText}>A well-written bug report saves time. Always include:</p>
              <ul style={{...styles.list, marginTop: '12px'}}>
                <li style={styles.listItem}><span style={styles.bullet}>•</span><strong>Steps to reproduce</strong> - Exact steps to trigger the bug</li>
                <li style={styles.listItem}><span style={styles.bullet}>•</span><strong>Expected behavior</strong> - What should happen</li>
                <li style={styles.listItem}><span style={styles.bullet}>•</span><strong>Actual behavior</strong> - What actually happens</li>
                <li style={styles.listItem}><span style={styles.bullet}>•</span><strong>Environment</strong> - Browser, OS, device info</li>
              </ul>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📊 Bug Status Lifecycle</h3>
              <div style={styles.statusFlow}>
                <div style={styles.statusItem('#3b82f6')}>
                  <div style={styles.statusDot('#3b82f6')}></div>
                  <div style={styles.statusName}>Open</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={styles.statusItem('#f59e0b')}>
                  <div style={styles.statusDot('#f59e0b')}></div>
                  <div style={styles.statusName}>In Progress</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={styles.statusItem('#8b5cf6')}>
                  <div style={styles.statusDot('#8b5cf6')}></div>
                  <div style={styles.statusName}>Resolved</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={styles.statusItem('#10b981')}>
                  <div style={styles.statusDot('#10b981')}></div>
                  <div style={styles.statusName}>Closed</div>
                </div>
              </div>
              <p style={{...styles.cardText, marginTop: '16px', fontSize: '13px'}}>
                <span style={styles.badge('#ef4444')}>Reopened</span> - Bug reappeared or fix didn't work
              </p>
            </div>
          </>
        );

      case 'fields':
        return (
          <>
            <h2 style={styles.sectionTitle}>📝 Field Reference</h2>
            <p style={styles.sectionSubtitle}>Complete guide to all bug fields and their meanings.</p>
            
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🔴 Severity Levels</h3>
              <p style={{...styles.cardText, marginBottom: '12px'}}>How badly does the bug affect the system?</p>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#ef4444')}>Critical</span>
                <span style={styles.fieldDesc}>System crash, data loss, security breach</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#f97316')}>High</span>
                <span style={styles.fieldDesc}>Major feature broken, no workaround available</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#f59e0b')}>Medium</span>
                <span style={styles.fieldDesc}>Feature impaired, workaround exists</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#10b981')}>Low</span>
                <span style={styles.fieldDesc}>Minor issue, cosmetic problems</span>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🎯 Priority Levels</h3>
              <p style={{...styles.cardText, marginBottom: '12px'}}>How urgently does it need to be fixed?</p>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#ef4444')}>Critical</span>
                <span style={styles.fieldDesc}>Fix immediately, blocks release</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#f97316')}>High</span>
                <span style={styles.fieldDesc}>Fix in current sprint</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#f59e0b')}>Medium</span>
                <span style={styles.fieldDesc}>Fix in next sprint</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#10b981')}>Low</span>
                <span style={styles.fieldDesc}>Fix when time permits</span>
              </div>
            </div>

            <div style={styles.grid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>🌐 Environment</h3>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px'}}>
                  <span style={styles.badge('#3b82f6')}>Development</span>
                  <span style={styles.badge('#8b5cf6')}>Testing</span>
                  <span style={styles.badge('#f59e0b')}>Staging</span>
                  <span style={styles.badge('#ef4444')}>Production</span>
                </div>
              </div>
              
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>✅ QA Status</h3>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px'}}>
                  <span style={styles.badge('#64748b')}>Not Started</span>
                  <span style={styles.badge('#3b82f6')}>Testing</span>
                  <span style={styles.badge('#10b981')}>Passed</span>
                  <span style={styles.badge('#ef4444')}>Failed</span>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🏁 Closure Reasons</h3>
              <p style={{...styles.cardText, marginBottom: '12px'}}>When closing a bug, select the appropriate reason:</p>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#10b981')}>Fixed</span>
                <span style={styles.fieldDesc}>Bug was successfully fixed</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#64748b')}>Won't Fix</span>
                <span style={styles.fieldDesc}>Decided not to fix (out of scope, too costly)</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#8b5cf6')}>Duplicate</span>
                <span style={styles.fieldDesc}>Already reported in another bug</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#f59e0b')}>Cannot Reproduce</span>
                <span style={styles.fieldDesc}>Unable to recreate the issue</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#3b82f6')}>By Design</span>
                <span style={styles.fieldDesc}>The behavior is intentional</span>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>📋 Other Fields</h3>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Assignee</span>
                <span style={styles.fieldDesc}>Developer responsible for fixing the bug</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>QA Owner</span>
                <span style={styles.fieldDesc}>QA engineer responsible for verification</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Target Version</span>
                <span style={styles.fieldDesc}>Release version for the fix (e.g., "v2.1.0")</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Due SLA</span>
                <span style={styles.fieldDesc}>Deadline based on service level agreement</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldName}>Module</span>
                <span style={styles.fieldDesc}>Specific component affected (e.g., "Authentication")</span>
              </div>
            </div>
          </>
        );

      case 'workflow':
        return (
          <>
            <h2 style={styles.sectionTitle}>🔄 Workflow</h2>
            <p style={styles.sectionSubtitle}>Recommended workflows for different team roles.</p>
            
            <div style={styles.highlightCard('#3b82f6')}>
              <h3 style={{...styles.cardTitle, color: '#60a5fa'}}>📝 Reporter Workflow</h3>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', alignItems: 'center'}}>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>🔍</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Discover</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>📝</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Report</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>📎</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Attach</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>👀</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Monitor</div>
                </div>
              </div>
            </div>

            <div style={{...styles.highlightCard('#f59e0b'), marginTop: '16px'}}>
              <h3 style={{...styles.cardTitle, color: '#fbbf24'}}>💻 Developer Workflow</h3>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', alignItems: 'center'}}>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>📋</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Review</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>🔧</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>In Progress</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>💻</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Implement</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>✅</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Resolve</div>
                </div>
              </div>
            </div>

            <div style={{...styles.highlightCard('#10b981'), marginTop: '16px'}}>
              <h3 style={{...styles.cardTitle, color: '#34d399'}}>🧪 QA Workflow</h3>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', alignItems: 'center'}}>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>📥</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Pick Up</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>🧪</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Test</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>📊</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Record</div>
                </div>
                <span style={styles.arrow}>→</span>
                <div style={{textAlign: 'center', padding: '12px', background: '#1e293b', borderRadius: '10px', minWidth: '90px'}}>
                  <div style={{fontSize: '24px', marginBottom: '4px'}}>🏁</div>
                  <div style={{fontSize: '12px', color: '#94a3b8'}}>Close/Reopen</div>
                </div>
              </div>
            </div>
            <p style={{...styles.cardText, marginTop: '16px'}}>
              Pulse activity (Pit → Strike → Closed) is in the Pulse chapter.
            </p>
          </>
        );


      case 'commit-guidelines':
        return (
          <>
            <h2 style={styles.sectionTitle}>📤 Git Commit Guidelines</h2>
            <p style={styles.sectionSubtitle}>Required commit message format for Mertis integration.</p>
            
            {/* Download PDF Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #4f46e520 0%, #4f46e508 100%)',
              borderRadius: '12px',
              border: '1px solid #4f46e540',
              marginBottom: '16px'
            }}>
              <span style={{fontSize: '28px'}}>📄</span>
              <div style={{flex: 1}}>
                <div style={{fontWeight: '600', color: '#f1f5f9', fontSize: '14px'}}>Official Documentation</div>
                <div style={{color: '#94a3b8', fontSize: '13px'}}>Download the complete commit message guidelines PDF</div>
              </div>
              <a 
                href="/mertis/docs/Turneratech_Commit_Message_Guidelines.pdf" 
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
                }}
              >
                📥 Download PDF
              </a>
            </div>

            <div style={{...styles.card, background: 'linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)', borderColor: '#f59e0b40'}}>
              <h3 style={{...styles.cardTitle, color: '#fbbf24'}}>⚠️ Required Format</h3>
              <p style={styles.cardText}>Every non-merge commit must satisfy <strong>both</strong> rules:</p>
              <ul style={{...styles.list, marginTop: '12px'}}>
                <li style={styles.listItem}><span style={styles.bullet}>•</span><strong>Rule A (First Line):</strong> Must start with a valid Bug ID followed by a colon, then a short description</li>
                <li style={styles.listItem}><span style={styles.bullet}>•</span><strong>Rule B (Author Line):</strong> Must contain "- Author: name" anywhere in the message</li>
              </ul>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🔤 Bug ID Pattern</h3>
              <p style={styles.cardText}>Bug IDs must use <strong>uppercase</strong> project keys and digits:</p>
              <div style={{...styles.fieldRow, marginTop: '12px', fontFamily: 'monospace', background: '#0f172a'}}>
                <code style={{color: '#a78bfa'}}>&lt;PROJECT&gt;-&lt;NUMBER&gt;</code>
              </div>
              <p style={{...styles.cardText, marginTop: '12px', fontSize: '13px'}}>
                Where PROJECT is 2-10 letters (A-Z) and NUMBER is 1-6 digits.
              </p>
              <div style={{marginTop: '12px'}}>
                <span style={{...styles.badge('#10b981'), marginRight: '8px'}}>WD-2</span>
                <span style={{...styles.badge('#10b981'), marginRight: '8px'}}>WD-0002</span>
                <span style={{...styles.badge('#10b981'), marginRight: '8px'}}>GRN-0005</span>
                <span style={{...styles.badge('#10b981'), marginRight: '8px'}}>SM-42</span>
                <span style={{...styles.badge('#10b981')}}>BH-0015</span>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>👤 Author Line Pattern</h3>
              <p style={styles.cardText}>Include an author line anywhere in the commit message:</p>
              <div style={{...styles.fieldRow, marginTop: '12px', fontFamily: 'monospace', background: '#0f172a'}}>
                <code style={{color: '#a78bfa'}}>- Author: &lt;name&gt;</code>
              </div>
              <p style={{...styles.cardText, marginTop: '8px', fontSize: '13px'}}>
                Case-insensitive, whitespace tolerant
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>✅ Valid Examples</h3>
              
              <p style={{...styles.cardText, fontWeight: '600', marginBottom: '8px'}}>Multi-line example (author on separate line):</p>
              <div style={{background: '#0f172a', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '16px', border: '1px solid #334155'}}>
                <div style={{color: '#10b981'}}>WD-0003: fix legend size and emission labeling</div>
                <div style={{color: '#94a3b8', marginTop: '8px'}}>- Updated legend sizing to avoid truncation</div>
                <div style={{color: '#94a3b8'}}>- Converted estimated values to calculated values</div>
                <div style={{color: '#a78bfa'}}>- Author: abhishek.m</div>
              </div>

              <p style={{...styles.cardText, fontWeight: '600', marginBottom: '8px'}}>Single-line example:</p>
              <div style={{background: '#0f172a', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '13px', border: '1px solid #334155'}}>
                <div style={{color: '#10b981'}}>GRN-0005: improve light theme palette <span style={{color: '#a78bfa'}}>- Author: abhishek.m</span></div>
              </div>
            </div>

            <div style={styles.grid}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>📝 Best Practices</h3>
                <ul style={styles.list}>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Keep first line short (50-72 chars)</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Use imperative mood ("Fix", "Add", "Update")</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Explain "what" and "why" in the body</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>One logical change per commit</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Wrap body lines at ~72 characters</li>
                </ul>
              </div>

              <div style={styles.card}>
                <h3 style={styles.cardTitle}>🚫 Avoid</h3>
                <ul style={styles.list}>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>"WIP" or "temp" commits on shared branches</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Secrets, credentials, or private keys</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Customer data or internal URLs</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Copying large logs (link to issues instead)</li>
                  <li style={styles.listItem}><span style={styles.bullet}>•</span>Lowercase project keys (use BT-0001, not bt-0001)</li>
                </ul>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>🔧 Fixing Rejected Commits</h3>
              <p style={styles.cardText}>If validation fails, update your commit message locally:</p>
              
              <div style={{marginTop: '16px'}}>
                <p style={{...styles.cardText, fontWeight: '600', fontSize: '13px', marginBottom: '4px'}}>Amend the most recent commit:</p>
                <div style={{background: '#0f172a', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '12px'}}>
                  <code style={{color: '#a78bfa'}}>git commit --amend</code>
                </div>

                <p style={{...styles.cardText, fontWeight: '600', fontSize: '13px', marginBottom: '4px'}}>Reword older commits (interactive rebase):</p>
                <div style={{background: '#0f172a', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '12px'}}>
                  <code style={{color: '#a78bfa'}}>git rebase -i &lt;base-commit&gt;</code>
                  <div style={{color: '#64748b', marginTop: '4px'}}># mark commits as 'reword'</div>
                </div>

                <p style={{...styles.cardText, fontWeight: '600', fontSize: '13px', marginBottom: '4px'}}>Push after rewriting history:</p>
                <div style={{background: '#0f172a', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '13px'}}>
                  <code style={{color: '#a78bfa'}}>git push --force-with-lease</code>
                </div>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>💡</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Pull Request Note</div>
                <div style={styles.tipText}>
                  If your repository uses squash merges, ensure the final squash commit message also follows 
                  the required format. Merge commits may be skipped by the validator, but individual commits 
                  in PR branches are still validated.
                </div>
              </div>
            </div>
          </>
        );

      case 'pulse':
        return (
          <>
            <h2 style={styles.sectionTitle}>◎ Pulse</h2>
            <p style={styles.sectionSubtitle}>
              Quality-native planning on the same bugs you already track. A Pulse card is the bug — there is no second ticket.
            </p>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>How to open Pulse</h3>
              <p style={styles.cardText}>
                Click <strong>Pulse</strong> in the navbar, or go to <code>/pulse</code> directly — you do not need the bug list first.
                One project opens Strike; two or more open Command Deck.
                Project tabs: Strike (operations), Pit (intake), Wait (decision latency), Missions (outcomes you fund), Horizon (those outcomes on a calendar). Header: My Pulse, Friday brief.
                You need the project-management license flag;
                an administrator can hide Pulse entirely with <code>PULSE_ENABLED=false</code>.
              </p>
            </div>

            <div style={styles.card}>
              <PulseHelpExplainer />
            </div>

            <div style={styles.card}>
              <PulseHelpWorkflows />
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Daily loop</h3>
              <div style={{marginTop: '8px'}}>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #4f46e5'}}>
                  <span style={styles.badge('#4f46e5')}>1</span>
                  <span style={styles.fieldDesc}><strong>My Pulse</strong> — what is waiting on you today</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #4f46e5'}}>
                  <span style={styles.badge('#4f46e5')}>2</span>
                  <span style={styles.fieldDesc}><strong>The Pit</strong> — accept unplanned work before it pretends to be the plan</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #4f46e5'}}>
                  <span style={styles.badge('#4f46e5')}>3</span>
                  <span style={styles.fieldDesc}><strong>Strike</strong> — drag cards; read The Line, tax, interrupt, and bounce</span>
                </div>
                <div style={{...styles.fieldRow, borderLeft: '3px solid #4f46e5'}}>
                  <span style={styles.badge('#4f46e5')}>4</span>
                  <span style={styles.fieldDesc}><strong>Friday brief</strong> — copy the numbers into Slack. No typing a status deck.</span>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Strike Board</h3>
              <p style={styles.cardText}>
                Columns are the bug statuses: Open, In Progress, Resolved, Closed, Reopened.
                Drag a card to another column — that writes the bug. Click the ID to open the usual editor.
                Only triaged bugs sit here; new bugs wait in The Pit.
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>The Pit</h3>
              <p style={styles.cardText}>
                Unplanned / untriaged work. <strong>Accept</strong> stamps triage time and moves the card onto Strike.
                Closing a duplicate still happens on the bug form, not in The Pit.
              </p>
              <div style={{marginTop: '12px'}}>
                <div style={styles.fieldRow}>
                  <span><kbd style={styles.kbd}>j</kbd> / <kbd style={styles.kbd}>k</kbd></span>
                  <span style={styles.fieldDesc}>Move down / up the list (arrows work too)</span>
                </div>
                <div style={styles.fieldRow}>
                  <span><kbd style={styles.kbd}>a</kbd></span>
                  <span style={styles.fieldDesc}>Accept the selected item onto Strike</span>
                </div>
                <div style={styles.fieldRow}>
                  <span><kbd style={styles.kbd}>x</kbd></span>
                  <span style={styles.fieldDesc}>Defer — skip to the next item</span>
                </div>
                <div style={styles.fieldRow}>
                  <span><kbd style={styles.kbd}>?</kbd></span>
                  <span style={styles.fieldDesc}>Toggle Pit key help</span>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>My Pulse</h3>
              <p style={styles.cardText}>
                Your call sheet across projects: next-move is you, Criticals, SLA due today, and blocked ARB items.
                Open it from Pulse → <strong>My Pulse</strong>.
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>What each pip and clock means</h3>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#4f46e5')}>Next-move</span>
                <span style={styles.fieldDesc}>Exactly one next human: assignee (dev), QA owner, or ARB (Action Required By). Never two, never none — unowned work shows triage.</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#4f46e5')}>Truth clock</span>
                <span style={styles.fieldDesc}>Age of the last real mutation (status, comment, commit) — not the last theatrical drag.</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.badge('#f59e0b')}>Bounce pip</span>
                <span style={styles.fieldDesc}>How many times this bug was status-changed to Reopened. Shown when the count is at least 1.</span>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>The Line (dwell)</h3>
              <p style={styles.cardText}>
                Median time bugs sit in Dev queue, Dev, QA, and QA testing. The bottleneck banner names the fattest
                station (median × how many sit there). Chips on Strike columns match those stations.
                Bugs with fewer than two structured status changes are excluded — they are not counted as zero.
                ARB is a flag on the card, not a Line station.
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Quality tax</h3>
              <p style={styles.cardText}>
                The sentence on Strike: how much of the triaged board is firefighting, from <strong>bug type</strong>
                (Bug vs Enhancement / Task / Feature). Set type on each bug. Missing types degrade the sentence;
                they never print 0%.
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Interrupt ring</h3>
              <p style={styles.cardText}>
                Last 7 days: Pit accepts versus work already committed In Progress. Default reserve is 35% for arrivals.
                Overflow is a sentence, not a silent bar — the plan is over-committed when the ring says so.
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Reopen gravity</h3>
              <p style={styles.cardText}>
                Bounce counted from structured Closed → Reopened transitions, ranked by <strong>module</strong> (top 3 on Strike).
                It is never a person score. Empty boards say “No reopen gravity yet.”
              </p>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Friday numbers</h3>
              <p style={styles.cardText}>
                From a project, click <strong>Friday brief</strong>. Clauses cover mix, bottleneck, interrupt, and the oldest Pit item.
                Each claim lists evidence bug IDs. <strong>Copy brief</strong> pastes arithmetic into Slack — not AI prose.
                Missing dwell degrades that clause instead of inventing a number.
              </p>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>ℹ️</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Greyed sentences</div>
                <div style={styles.tipText}>
                  Pulse tells you when it cannot compute. Fill bug type, move status at least twice, and keep accepting Pit items
                  so interrupt has a window. Do not parse English comments — only status-change activity counts.
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Not in this version</h3>
              <p style={styles.cardText}>
                Cycles as a Linear clone, and Pulse-over-Jira are not shipped.
                Pulse also does not run on top of Jira.
              </p>
            </div>
          </>
        );

      case 'tips':
        return (
          <>
            <h2 style={styles.sectionTitle}>💡 Tips & Tricks</h2>
            <p style={styles.sectionSubtitle}>Get the most out of Mertis with these pro tips.</p>
            
            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>◎</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Standup on Pulse, not the bug list</div>
                <div style={styles.tipText}>Open Strike for the project. The Line names the queue, quality tax names the mix, the interrupt ring names chaos, gravity names bounce. Copy the Friday brief instead of writing a status deck.</div>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>📝</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Use Descriptive Titles</div>
                <div style={styles.tipText}>Include the what and where: "Login button unresponsive on Safari mobile" beats "Button broken"</div>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>📸</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Always Attach Screenshots</div>
                <div style={styles.tipText}>A picture is worth a thousand words. Visual evidence helps developers understand issues instantly.</div>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>🔍</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Search Before Creating</div>
                <div style={styles.tipText}>Check if the bug already exists to avoid duplicates. Use filters and search functions.</div>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>⏱️</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Update Status Promptly</div>
                <div style={styles.tipText}>Keep bug status current so the team always knows the true state of affairs.</div>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>💬</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Use Comments for Updates</div>
                <div style={styles.tipText}>Add comments to track progress, ask questions, and document decisions for future reference.</div>
              </div>
            </div>

            <div style={styles.tipCard}>
              <span style={styles.tipIcon}>🔔</span>
              <div style={styles.tipContent}>
                <div style={styles.tipTitle}>Reference Related Bugs</div>
                <div style={styles.tipText}>Mention related bug IDs in comments (e.g., "Related to BT-0042") to create connections.</div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}>⌨️ Quick Keyboard Tips</h3>
              <div style={styles.fieldRow}>
                <span><span style={styles.kbd}>Tab</span></span>
                <span style={styles.fieldDesc}>Navigate between form fields</span>
              </div>
              <div style={styles.fieldRow}>
                <span><span style={styles.kbd}>Ctrl</span> + <span style={styles.kbd}>Enter</span></span>
                <span style={styles.fieldDesc}>Submit forms quickly</span>
              </div>
              <div style={styles.fieldRow}>
                <span><span style={styles.kbd}>Esc</span></span>
                <span style={styles.fieldDesc}>Close dialogs and modals</span>
              </div>
            </div>
          </>
        );

      case 'faq':
        return (
          <>
            <h2 style={styles.sectionTitle}>❓ FAQ</h2>
            <p style={styles.sectionSubtitle}>Quick answers to commonly asked questions.</p>
            
            <FAQ question="How do I reset my password?">
              Click the 🔙 icon next to your username in the navigation bar. Enter your current password 
              and new password to update it.
            </FAQ>

            <FAQ question="Can I delete a bug?">
              Bug deletion is restricted to administrators to maintain audit trails. If you created a bug 
              by mistake, mark it as "Closed" with the reason "Duplicate" or contact an admin.
            </FAQ>

            <FAQ question="How do I attach files to a bug?">
              When creating or editing a bug, use the file upload section at the bottom of the form. 
              You can drag and drop files or click to browse. Supported formats include images, PDFs, and text files.
            </FAQ>

            <FAQ question="What does ARB mean?">
              ARB is Action Required By — the person who must act next when work is blocked on a decision,
              not a second assignee. Pulse shows ARB as the next-move pip when that field is set.
            </FAQ>

            <FAQ question="How do I filter bugs by multiple criteria?">
              Use the filter panel on the bug list page. You can combine multiple filters 
              (status, severity, priority, assignee). Filters are applied together with AND logic.
            </FAQ>

            <FAQ question="How does GitHub integration work?">
              Administrators can link a project to a GitHub repository. When you make commits with bug IDs 
              in the message (e.g., "BT-0001: Fixed issue - Author: john"), the commit info automatically 
              appears in the bug's activity log.
            </FAQ>

            <FAQ question="Can I export bug data?">
              Currently, bug data can be exported through the API. A CSV export feature is planned for 
              a future release. Contact your administrator for bulk data exports.
            </FAQ>

            <FAQ question="Where did Pulse go?">
              Pulse needs the project-management license capability and PULSE_ENABLED must not be false.
              If the navbar has no Pulse link, ask an administrator — Mertis-only installs hide it on purpose.
            </FAQ>

            <FAQ question="Why does The Line say it has no bottleneck?">
              Dwell needs at least two structured status changes on a bug (for example Open → In Progress).
              English comments do not count. Move a few cards through columns, then refresh Strike.
            </FAQ>

            <FAQ question="Is dragging on Strike the same as editing the bug?">
              Yes. A Pulse card is the bug. Drag writes status through the same save path as the bug form.
              There is no second board to keep in sync.
            </FAQ>

            <FAQ question="I know Jira / Trello — where are sprints, lists, and epics?">
              Strike is the board (cards are Mertis bugs). The Pit is the inbox / triage queue, not a Trello list you invent.
              There is no sprint or Linear Cycle table yet — interrupt is a rolling 7-day window. Missions group bugs to an outcome, not a Jira epic tree.
              Pulse does not run on top of Jira.
            </FAQ>

            <FAQ question="Why does Resolved keep growing?">
              Resolved is waiting for QA, not finished. There is no per-column card limit. Drag to Closed after QA passes.
              The whole Strike board only stops listing extras after 500 bugs (narrow the lens).
            </FAQ>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.title}>
              <span>📖</span>
              Mertis User Manual
            </h1>
            <p style={styles.subtitle}>Everything you need to know to track and manage bugs effectively</p>
          </div>
          <button 
            style={styles.closeButton} 
            onClick={onClose}
            onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.3)'}
            onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
          >
            ✅
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Sidebar */}
          <nav style={styles.sidebar}>
            {sections.map(section => (
              <button
                key={section.id}
                style={styles.navItem(activeSection === section.id)}
                onClick={() => setActiveSection(section.id)}
                onMouseOver={e => {
                  if (activeSection !== section.id) {
                    e.target.style.background = '#334155';
                    e.target.style.color = '#f1f5f9';
                  }
                }}
                onMouseOut={e => {
                  if (activeSection !== section.id) {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#94a3b8';
                  }
                }}
              >
                <span style={styles.navIcon}>{section.icon}</span>
                {section.title}
              </button>
            ))}
          </nav>

          {/* Content */}
          <main style={styles.content}>
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}

// FAQ Component
function FAQ({ question, children }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '10px',
      marginBottom: '10px',
      border: '1px solid #334155',
      overflow: 'hidden',
    }}>
      <div 
        style={{
          padding: '16px 20px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: '600',
          color: '#f1f5f9',
          fontSize: '14px',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {question}
        <span style={{
          color: '#4f46e5',
          fontSize: '18px',
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>+</span>
      </div>
      {isOpen && (
        <div style={{
          padding: '0 20px 16px',
          color: '#94a3b8',
          fontSize: '14px',
          lineHeight: '1.7',
          borderTop: '1px solid #334155',
          paddingTop: '16px',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default HelpModal;
