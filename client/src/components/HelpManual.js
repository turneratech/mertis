import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PulseHelpExplainer } from './PulseHelpExplainer';
import { PulseHelpWorkflows } from './PulseHelpWorkflows';

function HelpManual() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [searchTerm, setSearchTerm] = useState('');

  const sections = [
    { id: 'getting-started', title: 'ðŸš€ Getting Started', icon: 'ðŸš€' },
    { id: 'projects', title: 'ðŸ“ Projects', icon: 'ðŸ“' },
    { id: 'bugs', title: 'ðŸ› Bug Management', icon: 'ðŸ›' },
    { id: 'fields', title: 'ðŸ“ Field Reference', icon: 'ðŸ“' },
    { id: 'workflow', title: 'ðŸ”„ Workflow', icon: 'ðŸ”„' },
    { id: 'pulse', title: 'Pulse', icon: '◎' },
    { id: 'tips', title: 'ðŸ’¡ Tips & Best Practices', icon: 'ðŸ’¡' },
    { id: 'shortcuts', title: 'âŒ¨ï¸ Keyboard Shortcuts', icon: 'âŒ¨ï¸' },
    { id: 'faq', title: 'â“ FAQ', icon: 'â“' },
  ];

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="help-manual">
      {/* Header */}
      <div className="help-header">
        <div className="help-header-content">
          <h1>
            <span className="help-logo">ðŸ“–</span>
            Mertis User Manual
          </h1>
          <p>Everything you need to know to track and manage bugs effectively</p>
          
          {/* Search */}
          <div className="help-search">
            <input
              type="text"
              placeholder="ðŸ” Search the manual..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="help-search-input"
            />
          </div>
        </div>
      </div>

      <div className="help-container">
        {/* Sidebar Navigation */}
        <nav className="help-sidebar">
          <div className="help-sidebar-title">Contents</div>
          {sections.map(section => (
            <button
              key={section.id}
              className={`help-nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => scrollToSection(section.id)}
            >
              <span className="help-nav-icon">{section.icon}</span>
              {section.title.replace(section.icon + ' ', '')}
            </button>
          ))}
          
          <div className="help-sidebar-footer">
            <Link to="/" className="btn btn-secondary btn-sm">
              &#8592; Back to Dashboard
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="help-content">
          
          {/* Getting Started */}
          <section id="getting-started" className="help-section">
            <div className="section-header gradient-blue">
              <h2>ðŸš€ Getting Started</h2>
              <p>Welcome to Mertis! Let's get you up and running.</p>
            </div>
            
            <div className="help-card">
              <h3>What is Mertis?</h3>
              <p>Mertis is a powerful yet simple bug tracking system designed to help teams efficiently track, manage, and resolve software issues. It supports multiple projects, customizable workflows, and team collaboration.</p>
            </div>

            <div className="help-grid">
              <div className="help-card highlight-card purple">
                <div className="card-icon">ðŸ‘¤</div>
                <h4>For Team Members</h4>
                <ul>
                  <li>View and filter bugs assigned to you</li>
                  <li>Create new bug reports</li>
                  <li>Update bug status and add comments</li>
                  <li>Attach files and screenshots</li>
                </ul>
              </div>
              
              <div className="help-card highlight-card green">
                <div className="card-icon">ðŸ‘‘</div>
                <h4>For Administrators</h4>
                <ul>
                  <li>Create and manage projects</li>
                  <li>Add and remove team members</li>
                  <li>Configure GitHub integration</li>
                  <li>View analytics and reports</li>
                </ul>
              </div>
            </div>

            <div className="help-card">
              <h3>Quick Navigation</h3>
              <div className="navigation-guide">
                <div className="nav-item-guide">
                  <span className="nav-badge">Dashboard</span>
                  <span>Your personal overview with assigned bugs and statistics</span>
                </div>
                <div className="nav-item-guide">
                  <span className="nav-badge">Projects</span>
                  <span>Browse all projects you have access to</span>
                </div>
                <div className="nav-item-guide">
                  <span className="nav-badge">My Bugs</span>
                  <span>Quick access to bugs assigned to you or reported by you</span>
                </div>
                <div className="nav-item-guide">
                  <span className="nav-badge admin">Users</span>
                  <span>User management (Admin only)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Projects */}
          <section id="projects" className="help-section">
            <div className="section-header gradient-purple">
              <h2>ðŸ“ Projects</h2>
              <p>Organize your bugs by project for better management.</p>
            </div>

            <div className="help-card">
              <h3>Creating a New Project</h3>
              <p>Only administrators can create new projects. To create a project:</p>
              <ol className="help-steps">
                <li>
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <strong>Navigate to Projects</strong>
                    <p>Click "Projects" in the navigation bar</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <strong>Click "New Project"</strong>
                    <p>Find the button in the top-right corner</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <strong>Fill in Project Details</strong>
                    <p>Enter name, key, description, and select team members</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="help-card">
              <h3>Project Fields Explained</h3>
              <div className="field-table">
                <div className="field-row">
                  <div className="field-name required">Project Name</div>
                  <div className="field-desc">A descriptive name for your project (e.g., "Mobile App v2.0")</div>
                </div>
                <div className="field-row">
                  <div className="field-name required">Project Key</div>
                  <div className="field-desc">A short unique identifier (2-5 letters). Used as prefix for bug IDs. Example: "MOB" creates bugs like MOB-0001</div>
                </div>
                <div className="field-row">
                  <div className="field-name">Description</div>
                  <div className="field-desc">Brief description of the project's purpose and scope</div>
                </div>
                <div className="field-row">
                  <div className="field-name">Client</div>
                  <div className="field-desc">The client or stakeholder this project is for</div>
                </div>
                <div className="field-row">
                  <div className="field-name">Team Members</div>
                  <div className="field-desc">Users who will have access to this project</div>
                </div>
              </div>
            </div>

            <div className="help-card tip-card">
              <div className="tip-icon">ðŸ’¡</div>
              <div className="tip-content">
                <h4>Pro Tip: Project Key</h4>
                <p>Choose a memorable project key! It will be part of every bug ID. Keep it short (2-4 characters) and meaningful. Examples: "API", "WEB", "IOS", "AND"</p>
              </div>
            </div>
          </section>

          {/* Bug Management */}
          <section id="bugs" className="help-section">
            <div className="section-header gradient-orange">
              <h2>ðŸ› Bug Management</h2>
              <p>Learn how to create, update, and track bugs effectively.</p>
            </div>

            <div className="help-card">
              <h3>Creating a New Bug</h3>
              <ol className="help-steps">
                <li>
                  <span className="step-number">1</span>
                  <div className="step-content">
                    <strong>Select a Project</strong>
                    <p>Navigate to the project where you want to report the bug</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">2</span>
                  <div className="step-content">
                    <strong>Click "New Bug"</strong>
                    <p>Find the button in the project's bug list</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">3</span>
                  <div className="step-content">
                    <strong>Fill in Bug Details</strong>
                    <p>Provide a clear title, detailed description, and set appropriate severity/priority</p>
                  </div>
                </li>
                <li>
                  <span className="step-number">4</span>
                  <div className="step-content">
                    <strong>Attach Evidence</strong>
                    <p>Upload screenshots, logs, or any relevant files</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="help-card warning-card">
              <div className="warning-icon">âš ï¸</div>
              <div className="warning-content">
                <h4>Writing Good Bug Reports</h4>
                <p>A well-written bug report saves time for everyone. Always include:</p>
                <ul>
                  <li><strong>Steps to reproduce</strong> - Exact steps to trigger the bug</li>
                  <li><strong>Expected behavior</strong> - What should happen</li>
                  <li><strong>Actual behavior</strong> - What actually happens</li>
                  <li><strong>Environment</strong> - Browser, OS, device info</li>
                </ul>
              </div>
            </div>

            <div className="help-card">
              <h3>Bug Status Lifecycle</h3>
              <div className="status-flow">
                <div className="status-item open">
                  <span className="status-dot"></span>
                  <span className="status-name">Open</span>
                  <span className="status-desc">Newly created, awaiting assignment</span>
                </div>
                <div className="status-arrow">&#8594;</div>
                <div className="status-item in-progress">
                  <span className="status-dot"></span>
                  <span className="status-name">In Progress</span>
                  <span className="status-desc">Being actively worked on</span>
                </div>
                <div className="status-arrow">&#8594;</div>
                <div className="status-item resolved">
                  <span className="status-dot"></span>
                  <span className="status-name">Resolved</span>
                  <span className="status-desc">Fix completed, awaiting verification</span>
                </div>
                <div className="status-arrow">&#8594;</div>
                <div className="status-item closed">
                  <span className="status-dot"></span>
                  <span className="status-name">Closed</span>
                  <span className="status-desc">Verified and closed</span>
                </div>
              </div>
              <div className="status-note">
                <span className="status-item reopened">
                  <span className="status-dot"></span>
                  <span className="status-name">Reopened</span>
                </span>
                - Bug reappeared or fix didn't work
              </div>
            </div>
          </section>

          {/* Field Reference */}
          <section id="fields" className="help-section">
            <div className="section-header gradient-green">
              <h2>ðŸ“ Field Reference</h2>
              <p>Detailed explanation of every bug field.</p>
            </div>

            <div className="help-card">
              <h3>Required Fields</h3>
              <div className="field-table detailed">
                <div className="field-row">
                  <div className="field-name required">Title</div>
                  <div className="field-desc">
                    <p>A clear, concise summary of the bug (max 255 characters)</p>
                    <div className="field-example">
                      <span className="example-label">Good:</span> "Login button unresponsive on Safari mobile"
                    </div>
                    <div className="field-example bad">
                      <span className="example-label">Bad:</span> "Button doesn't work"
                    </div>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field-name required">Description</div>
                  <div className="field-desc">
                    <p>Detailed information about the bug. Include:</p>
                    <ul>
                      <li>Steps to reproduce</li>
                      <li>Expected vs actual behavior</li>
                      <li>Error messages (if any)</li>
                      <li>Frequency (always, sometimes, once)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>Classification Fields</h3>
              <div className="classification-grid">
                <div className="classification-item">
                  <h4>ðŸ”´ Severity</h4>
                  <p>How badly the bug affects the system</p>
                  <div className="severity-levels">
                    <div className="level critical">
                      <span className="level-badge">Critical</span>
                      <span>System crash, data loss, security breach</span>
                    </div>
                    <div className="level high">
                      <span className="level-badge">High</span>
                      <span>Major feature broken, no workaround</span>
                    </div>
                    <div className="level medium">
                      <span className="level-badge">Medium</span>
                      <span>Feature impaired, workaround exists</span>
                    </div>
                    <div className="level low">
                      <span className="level-badge">Low</span>
                      <span>Minor issue, cosmetic problems</span>
                    </div>
                  </div>
                </div>

                <div className="classification-item">
                  <h4>ðŸŽ¯ Priority</h4>
                  <p>How urgently the bug needs to be fixed</p>
                  <div className="severity-levels">
                    <div className="level critical">
                      <span className="level-badge">Critical</span>
                      <span>Fix immediately, blocks release</span>
                    </div>
                    <div className="level high">
                      <span className="level-badge">High</span>
                      <span>Fix in current sprint</span>
                    </div>
                    <div className="level medium">
                      <span className="level-badge">Medium</span>
                      <span>Fix in next sprint</span>
                    </div>
                    <div className="level low">
                      <span className="level-badge">Low</span>
                      <span>Fix when time permits</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>Environment Options</h3>
              <div className="env-grid">
                <div className="env-item">
                  <span className="env-badge dev">Development</span>
                  <p>Local development environment</p>
                </div>
                <div className="env-item">
                  <span className="env-badge test">Testing</span>
                  <p>QA testing environment</p>
                </div>
                <div className="env-item">
                  <span className="env-badge staging">Staging</span>
                  <p>Pre-production environment</p>
                </div>
                <div className="env-item">
                  <span className="env-badge prod">Production</span>
                  <p>Live production environment</p>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>Assignment & Tracking Fields</h3>
              <div className="field-table detailed">
                <div className="field-row">
                  <div className="field-name">Assignee</div>
                  <div className="field-desc">The developer responsible for fixing this bug</div>
                </div>
                <div className="field-row">
                  <div className="field-name">QA Owner</div>
                  <div className="field-desc">The QA engineer responsible for verifying the fix</div>
                </div>
                <div className="field-row">
                  <div className="field-name">Target Fix Version</div>
                  <div className="field-desc">The release version where this fix should be included (e.g., "v2.1.0")</div>
                </div>
                <div className="field-row">
                  <div className="field-name">Due SLA</div>
                  <div className="field-desc">The deadline for resolving this bug based on service level agreement</div>
                </div>
                <div className="field-row">
                  <div className="field-name">Module</div>
                  <div className="field-desc">The specific component or module affected (e.g., "Authentication", "Dashboard")</div>
                </div>
                <div className="field-row">
                  <div className="field-name">Client</div>
                  <div className="field-desc">The customer or client who reported the issue (if applicable)</div>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>QA Status Options</h3>
              <div className="qa-grid">
                <div className="qa-item not-started">
                  <span className="qa-badge">Not Started</span>
                  <p>QA testing has not begun</p>
                </div>
                <div className="qa-item testing">
                  <span className="qa-badge">Testing</span>
                  <p>Currently being tested by QA</p>
                </div>
                <div className="qa-item passed">
                  <span className="qa-badge">Passed</span>
                  <p>Fix verified and approved</p>
                </div>
                <div className="qa-item failed">
                  <span className="qa-badge">Failed</span>
                  <p>Fix didn't work or caused new issues</p>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>Closure Reasons</h3>
              <p>When closing a bug, select the appropriate reason:</p>
              <div className="closure-grid">
                <div className="closure-item">
                  <span className="closure-badge fixed">Fixed</span>
                  <p>The bug was successfully fixed</p>
                </div>
                <div className="closure-item">
                  <span className="closure-badge wontfix">Won't Fix</span>
                  <p>Decided not to fix (out of scope, too costly)</p>
                </div>
                <div className="closure-item">
                  <span className="closure-badge duplicate">Duplicate</span>
                  <p>Already reported in another bug</p>
                </div>
                <div className="closure-item">
                  <span className="closure-badge cannot">Cannot Reproduce</span>
                  <p>Unable to recreate the issue</p>
                </div>
                <div className="closure-item">
                  <span className="closure-badge design">By Design</span>
                  <p>The behavior is intentional</p>
                </div>
              </div>
            </div>
          </section>

          {/* Workflow */}
          <section id="workflow" className="help-section">
            <div className="section-header gradient-teal">
              <h2>ðŸ”„ Workflow</h2>
              <p>Recommended workflows for different roles.</p>
            </div>

            <div className="help-card">
              <h3>Reporter Workflow</h3>
              <div className="workflow-diagram">
                <div className="workflow-step">
                  <div className="step-icon">ðŸ”</div>
                  <div className="step-title">1. Discover Bug</div>
                  <div className="step-desc">Find and verify the issue</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ“</div>
                  <div className="step-title">2. Create Report</div>
                  <div className="step-desc">File detailed bug report</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ“Ž</div>
                  <div className="step-title">3. Attach Evidence</div>
                  <div className="step-desc">Add screenshots, logs</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ‘€</div>
                  <div className="step-title">4. Monitor</div>
                  <div className="step-desc">Track progress, answer questions</div>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>Developer Workflow</h3>
              <div className="workflow-diagram">
                <div className="workflow-step">
                  <div className="step-icon">ðŸ“‹</div>
                  <div className="step-title">1. Review Bug</div>
                  <div className="step-desc">Understand the issue</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ”§</div>
                  <div className="step-title">2. Set In Progress</div>
                  <div className="step-desc">Start working on fix</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ’»</div>
                  <div className="step-title">3. Implement Fix</div>
                  <div className="step-desc">Code and test locally</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">âœ…</div>
                  <div className="step-title">4. Mark Resolved</div>
                  <div className="step-desc">Ready for QA verification</div>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>QA Workflow</h3>
              <div className="workflow-diagram">
                <div className="workflow-step">
                  <div className="step-icon">ðŸ“¥</div>
                  <div className="step-title">1. Pick Up Bug</div>
                  <div className="step-desc">Select resolved bug to verify</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ§ª</div>
                  <div className="step-title">2. Test Fix</div>
                  <div className="step-desc">Set QA Status: Testing</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ“Š</div>
                  <div className="step-title">3. Record Result</div>
                  <div className="step-desc">Passed or Failed</div>
                </div>
                <div className="workflow-arrow">&#8594;</div>
                <div className="workflow-step">
                  <div className="step-icon">ðŸ</div>
                  <div className="step-title">4. Close or Reopen</div>
                  <div className="step-desc">Based on test result</div>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>Pulse activity</h3>
              <p>When the team runs standup on Pulse: Pit (accept) → Strike (drag) → Closed after QA. Step-by-step flows are in the <strong>Pulse</strong> chapter of this manual.</p>
            </div>
          </section>

          <section id="pulse" className="help-section">
            <div className="section-header gradient-blue">
              <h2>Pulse</h2>
              <p>The same bugs as the plan. A Pulse card is the bug — there is no second ticket.</p>
            </div>

            <div className="help-card">
              <h3>How to open Pulse</h3>
              <p>Click <strong>Pulse</strong> in the navbar, or go to <code>/pulse</code> directly — you do not need the bug list first. One project opens Strike; two or more open Command Deck. Pulse hides when the project-management license is off or <code>PULSE_ENABLED=false</code>.</p>
              <p>On a project the tabs are <strong>Strike Board</strong> (today’s operations), <strong>The Pit</strong> (intake / not yet committed), <strong>The Wait</strong> (decision latency), <strong>Missions</strong> (outcomes you fund), and <strong>Horizon</strong> (those outcomes on a calendar — longest strip still open). <strong>My Pulse</strong> and <strong>Friday brief</strong> sit in the header.</p>
            </div>

            <div className="help-card">
              <PulseHelpExplainer />
            </div>

            <div className="help-card">
              <PulseHelpWorkflows />
            </div>

            <div className="help-card">
              <h3>Pips and clocks</h3>
              <p><strong>Next-move</strong> is exactly one human: assignee (dev), QA owner, or ARB (Action Required By). Unowned work shows triage.</p>
              <p><strong>Truth clock</strong> is the last real mutation (status, comment, commit), not the last drag.</p>
              <p><strong>Bounce pip</strong> counts structured transitions to Reopened. Strike ranks bounce by module, never by person.</p>
            </div>

            <div className="help-card">
              <h3>The Line, tax, interrupt</h3>
              <p><strong>The Line</strong> is median dwell in Dev queue, Dev, QA, and QA testing. The bottleneck is the fattest station. Bugs with fewer than two status changes are excluded, not zero. ARB is not a station.</p>
              <p><strong>Quality tax</strong> is the firefighting share from bug type. Untyped boards degrade; they never print 0%.</p>
              <p><strong>Interrupt</strong> is Pit accepts versus committed In Progress. Default window is 7 days. The 35% reserve stays on the ring — planned WIP cannot paint over it. Overflow is a sentence. A named window with no Pit accepts greys out.</p>
              <p><strong>Fix–verify gap</strong> is a GitHub commit still sitting on QA Not Started. No commits in 30 days shows “no commit data”, never 0.</p>
              <p><strong>Escaped Production</strong> is a Bug filed in Production after the last close. Testing env is not escaped. Blank environment greys out; it never prints 0.</p>
            </div>

            <div className="help-card tip-card">
              <p>Greyed copy means Pulse cannot compute yet. Fill bug type, move status at least twice, keep accepting Pit items. English comments do not count.</p>
              <p>Not shipped: a Cycles table, Pulse-over-Jira.</p>
            </div>
          </section>

          {/* Tips */}
          <section id="tips" className="help-section">
            <div className="section-header gradient-pink">
              <h2>ðŸ’¡ Tips & Best Practices</h2>
              <p>Get the most out of Mertis.</p>
            </div>

            <div className="tips-grid">
              <div className="help-card tip-card-standalone">
                <div className="tip-number">01</div>
                <h4>Use Descriptive Titles</h4>
                <p>Include the what and where: "Login button unresponsive on Safari mobile" is better than "Button broken"</p>
              </div>

              <div className="help-card tip-card-standalone">
                <div className="tip-number">02</div>
                <h4>Attach Screenshots</h4>
                <p>A picture is worth a thousand words. Always attach visual evidence when possible.</p>
              </div>

              <div className="help-card tip-card-standalone">
                <div className="tip-number">03</div>
                <h4>Search Before Creating</h4>
                <p>Check if the bug already exists to avoid duplicates. Use the filter and search functions.</p>
              </div>

              <div className="help-card tip-card-standalone">
                <div className="tip-number">04</div>
                <h4>Update Status Promptly</h4>
                <p>Keep the bug status current so the team always knows the true state of affairs.</p>
              </div>

              <div className="help-card tip-card-standalone">
                <div className="tip-number">05</div>
                <h4>Use Comments for Updates</h4>
                <p>Add comments to track progress, ask questions, and document decisions.</p>
              </div>

              <div className="help-card tip-card-standalone">
                <div className="tip-number">06</div>
                <h4>Link Related Bugs</h4>
                <p>Reference related bug IDs in comments to create connections (e.g., "Related to BT-0042")</p>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section id="shortcuts" className="help-section">
            <div className="section-header gradient-indigo">
              <h2>âŒ¨ï¸ Keyboard Shortcuts</h2>
              <p>Work faster with keyboard shortcuts.</p>
            </div>

            <div className="help-card">
              <h3>Global Shortcuts</h3>
              <div className="shortcuts-table">
                <div className="shortcut-row">
                  <div className="shortcut-keys">
                    <kbd>G</kbd> <kbd>D</kbd>
                  </div>
                  <div className="shortcut-desc">Go to Dashboard</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-keys">
                    <kbd>G</kbd> <kbd>P</kbd>
                  </div>
                  <div className="shortcut-desc">Go to Projects</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-keys">
                    <kbd>G</kbd> <kbd>M</kbd>
                  </div>
                  <div className="shortcut-desc">Go to My Bugs</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-keys">
                    <kbd>?</kbd>
                  </div>
                  <div className="shortcut-desc">Open this Help Manual</div>
                </div>
              </div>
            </div>

            <div className="help-card">
              <h3>Bug List Shortcuts</h3>
              <div className="shortcuts-table">
                <div className="shortcut-row">
                  <div className="shortcut-keys">
                    <kbd>N</kbd>
                  </div>
                  <div className="shortcut-desc">Create New Bug</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-keys">
                    <kbd>/</kbd>
                  </div>
                  <div className="shortcut-desc">Focus Search</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-keys">
                    <kbd>F</kbd>
                  </div>
                  <div className="shortcut-desc">Open Filters</div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="help-section">
            <div className="section-header gradient-amber">
              <h2>â“ Frequently Asked Questions</h2>
              <p>Quick answers to common questions.</p>
            </div>

            <div className="faq-list">
              <details className="faq-item">
                <summary>How do I reset my password?</summary>
                <div className="faq-answer">
                  Click the ðŸ”’ icon next to your username in the navigation bar to access the Change Password page. Enter your current password and your new password to update it.
                </div>
              </details>

              <details className="faq-item">
                <summary>What does ARB mean?</summary>
                <div className="faq-answer">
                  ARB is Action Required By — the person who must act next when work is blocked on a decision. Pulse shows it as the next-move pip.
                </div>
              </details>

              <details className="faq-item">
                <summary>Can I delete a bug?</summary>
                <div className="faq-answer">
                  Bug deletion is restricted to administrators to maintain audit trails. If you created a bug by mistake, mark it as "Closed" with the reason "Duplicate" or contact an admin.
                </div>
              </details>

              <details className="faq-item">
                <summary>How do I attach files to a bug?</summary>
                <div className="faq-answer">
                  When creating or editing a bug, use the file upload section at the bottom of the form. You can drag and drop files or click to browse. Supported formats include images, PDFs, and text files.
                </div>
              </details>

              <details className="faq-item">
                <summary>How do I filter bugs by multiple criteria?</summary>
                <div className="faq-answer">
                  Use the filter panel on the bug list page. You can combine multiple filters (status, severity, priority, assignee) to narrow down results. Filters are applied together with AND logic.
                </div>
              </details>

              <details className="faq-item">
                <summary>Can I export bug data?</summary>
                <div className="faq-answer">
                  Currently, bug data can be exported through the API. A CSV export feature is planned for a future release. Contact your administrator for bulk data exports.
                </div>
              </details>

              <details className="faq-item">
                <summary>How does GitHub integration work?</summary>
                <div className="faq-answer">
                  Administrators can link a project to a GitHub repository. When you make commits with bug IDs in the message (e.g., "BT-0001: Fixed issue - Author: john"), the commit information automatically appears in the bug's activity log.
                </div>
              </details>

              <details className="faq-item">
                <summary>Where did Pulse go?</summary>
                <div className="faq-answer">
                  Pulse needs the project-management license capability and must not be turned off by an administrator. If the navbar has no Pulse link, this install is tracker-only on purpose.
                </div>
              </details>

              <details className="faq-item">
                <summary>Is dragging on Strike the same as editing the bug?</summary>
                <div className="faq-answer">
                  Yes. A Pulse card is the bug. Drag writes status through the same save path as the bug form. There is no second board to keep in sync.
                </div>
              </details>

              <details className="faq-item">
                <summary>Why does Resolved keep growing?</summary>
                <div className="faq-answer">
                  Resolved means waiting for QA, not finished. There is no per-column card limit. Drag to Closed after QA passes. The whole Strike board only stops listing extras after 500 bugs (narrow the lens).
                </div>
              </details>
            </div>
          </section>

          {/* Footer */}
          <div className="help-footer">
            <p>ðŸ“§ Need more help? Contact your system administrator.</p>
            <p className="version-info">Mertis v2.0 â€¢ Manual v1.0</p>
          </div>

        </main>
      </div>
    </div>
  );
}

export default HelpManual;
