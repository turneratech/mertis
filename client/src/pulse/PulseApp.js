import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { StrikeBoard } from './StrikeBoard';
import { ThePit } from './ThePit';
import { MyPulse } from './MyPulse';
import { PulseBrief } from './PulseBrief';
import { MissionMap } from './MissionMap';
import { TheWait } from './TheWait';
import { Horizon } from './Horizon';
import { fetchCommand, fetchProjectName } from './pulseApi';
import { CommandDeck } from './CommandDeck';
import { usePulseEnabled } from './usePulseEnabled';
import { usePulseBrand } from './usePulseBrand';
import { SkeletonList } from './components/Skeleton';
import { Tooltip } from './components/Tooltip';
import { PulseHelpPanel } from './components/PulseHelpPanel';
import pulseLogo from './assets/logo.svg';
import './pulse.css';

function PulseMark() {
  return <img className="pulse-mark" src={pulseLogo} alt="" width={28} height={28} />;
}

function PulseProjectTitle({ projectKey }) {
  const [name, setName] = useState('');
  useEffect(() => {
    let live = true;
    fetchProjectName(projectKey)
      .then((full) => { if (live) setName(full); })
      .catch(() => { if (live) setName(''); });
    return () => { live = false; };
  }, [projectKey]);

  return (
    <>
      {projectKey}
      {name ? <span className="pulse-project-aka"> ({name})</span> : null}
    </>
  );
}

function PulseOff() {
  return (
    <div className="empty-state">
      <h3>Pulse is turned off</h3>
      <p>Ask an administrator to enable Pulse for this instance.</p>
    </div>
  );
}

/**
 * pulse-scope carries the design tokens (tokens.css). Every Pulse surface must
 * render inside it or it falls back to the tracker's indigo defaults.
 */
function PulseGate({ children }) {
  usePulseBrand();
  const enabled = usePulseEnabled();
  if (enabled === null) {
    return (
      <div className="pulse-scope">
        <SkeletonList rows={3} label="Loading Pulse" />
      </div>
    );
  }
  if (!enabled) return <div className="pulse-scope"><PulseOff /></div>;
  return (
    <div className="pulse-scope">
      {children}
      <Tooltip />
    </div>
  );
}

export function PulseHome() {
  return (
    <PulseGate>
      <PulseHomeInner />
    </PulseGate>
  );
}

function PulseHomeInner() {
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCommand()
      .then((payload) => {
        const skip = payload.data?.skipToStrike;
        if (skip) {
          navigate(`/pulse/${skip}`, { replace: true });
          return;
        }
        setDeck(payload);
        setError('');
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Could not load Command Deck');
        setDeck({ data: { rows: [] } });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="pulse-home">
        <div className="page-header">
          <h1 className="page-title"><PulseMark /> Command Deck</h1>
        </div>
        <SkeletonList rows={3} label="Loading Command Deck" />
      </div>
    );
  }
  if (error && !deck?.data?.rows?.length) return <div className="empty-state"><h3>{error}</h3></div>;

  return (
    <div className="pulse-home">
      <div className="page-header">
        <div>
          <h1 className="page-title"><PulseMark /> Command Deck</h1>
          <p className="pulse-subtitle">Every project you can see, in one glance</p>
        </div>
        <div className="pulse-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setHelpOpen(true)}
            data-tip="What Pit, Strike, The Line and the rest actually mean"
          >
            What is this?
          </button>
          <Link to="/pulse/me" className="btn btn-secondary" data-tip="Everything waiting on you today">My Pulse</Link>
        </div>
      </div>
      <CommandDeck
        rows={deck?.data?.rows || []}
        degraded={deck?.meta?.degraded || []}
        gated={deck?.data?.gated}
        projects={deck?.data?.projects}
      />
      <PulseHelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export function PulseProject() {
  return (
    <PulseGate>
      <PulseProjectInner />
    </PulseGate>
  );
}

/**
 * Every surface name carries a permanent plain-language subtitle. "Pit",
 * "Strike" and "The Line" are Pulse's vocabulary, and the vocabulary is a real
 * onboarding cost if it is never translated.
 */
const TABS = [
  { id: 'strike', label: 'Strike Board', subtitle: 'Today’s operations: mix, queues, next human' },
  { id: 'pit', label: 'The Pit', subtitle: 'Intake gate — nothing is a commitment until you accept it' },
  { id: 'wait', label: 'The Wait', subtitle: 'Decision latency — who is blocking the next move' },
  { id: 'missions', label: 'Missions', subtitle: 'Outcomes you are funding, not an epic tree' },
  { id: 'horizon', label: 'Horizon', subtitle: 'Which outcomes occupy the calendar — longest strip is still open' }
];

function PulseProjectInner() {
  const { projectKey } = useParams();
  const [helpOpen, setHelpOpen] = useState(false);
  // Tab lives in the URL: these views are worth linking to, and browser-back
  // used to leave the project entirely rather than returning to the last tab.
  const [params, setParams] = useSearchParams();
  const requested = params.get('view');
  const active = TABS.some((t) => t.id === requested) ? requested : 'strike';
  const activeTab = TABS.find((t) => t.id === active);

  const selectTab = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'strike') next.delete('view');
    else next.set('view', id);
    setParams(next, { replace: false });
  };

  const onTabKeyDown = (event) => {
    const idx = TABS.findIndex((t) => t.id === active);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      selectTab(TABS[(idx + 1) % TABS.length].id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      selectTab(TABS[(idx - 1 + TABS.length) % TABS.length].id);
    }
  };

  return (
    <div className="pulse-shell">
      <div className="page-header">
        <div>
          <Link to="/pulse" className="btn btn-secondary btn-sm pulse-back">
            ← Pulse
          </Link>
          <h1 className="page-title"><PulseMark /> Pulse · <PulseProjectTitle projectKey={projectKey} /></h1>
          <p className="pulse-subtitle">{activeTab.subtitle}</p>
        </div>
        <div className="pulse-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setHelpOpen(true)}
            data-tip="What Pit, Strike, The Line and the rest actually mean"
          >
            What is this?
          </button>
          <NavLink to={`/pulse/${projectKey}/brief`} className="btn btn-secondary" data-tip="This week in numbers, ready to paste into Slack">Friday brief</NavLink>
          <NavLink to="/pulse/me" className="btn btn-secondary" data-tip="Everything waiting on you today">My Pulse</NavLink>
        </div>
      </div>
      <div className="pulse-tabs" role="tablist" aria-label="Pulse views" onKeyDown={onTabKeyDown}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`pulse-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`pulse-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            className={active === tab.id ? 'on' : ''}
            onClick={() => selectTab(tab.id)}
            data-tip={tab.subtitle}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`pulse-panel-${active}`}
        aria-labelledby={`pulse-tab-${active}`}
      >
        {active === 'strike' ? <StrikeBoard projectKey={projectKey} /> : null}
        {active === 'pit' ? <ThePit projectKey={projectKey} /> : null}
        {active === 'wait' ? <TheWait projectKey={projectKey} /> : null}
        {active === 'missions' ? <MissionMap projectKey={projectKey} /> : null}
        {active === 'horizon' ? <Horizon projectKey={projectKey} /> : null}
      </div>
      <PulseHelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export function PulseBriefPage() {
  return (
    <PulseGate>
      <PulseBriefInner />
    </PulseGate>
  );
}

function PulseBriefInner() {
  const { projectKey } = useParams();
  return (
    <div className="pulse-shell">
      <div className="page-header">
        <div>
          <Link to={`/pulse/${projectKey}`} className="btn btn-secondary btn-sm pulse-back">
            ← Strike
          </Link>
          <h1 className="page-title"><PulseMark /> Friday brief · <PulseProjectTitle projectKey={projectKey} /></h1>
          <p className="pulse-subtitle">This week in numbers, with the bugs that prove them</p>
        </div>
      </div>
      <PulseBrief projectKey={projectKey} />
    </div>
  );
}

export function PulseMePage() {
  return (
    <PulseGate>
      <PulseMeInner />
    </PulseGate>
  );
}

function PulseMeInner() {
  return (
    <div className="pulse-shell">
      <div className="page-header">
        <div>
          <Link to="/pulse" className="btn btn-secondary btn-sm pulse-back">
            ← Pulse
          </Link>
          <h1 className="page-title"><PulseMark /> My Pulse</h1>
          <p className="pulse-subtitle">What is waiting on you today</p>
        </div>
      </div>
      <MyPulse />
    </div>
  );
}
