import React, { useEffect, useState } from 'react';
import { claimMissionBug, createMission, deleteMission, fetchMissions, fetchLanding } from './pulseApi';
import { Instrument, Degraded } from './components/Instrument';
import { SkeletonList } from './components/Skeleton';
import { BugChips } from './components/BugChips';
import { Landing } from './components/Landing';
import { PaidSurface } from './components/PaidSurface';

export function MissionMap({ projectKey }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [intent, setIntent] = useState('');
  const [claim, setClaim] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [landing, setLanding] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchMissions(projectKey);
      setPayload(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load Mission Map');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectKey]);

  // Landing is additive: if the forecast fails or has no history, the Mission
  // Map must still render exactly as before.
  useEffect(() => {
    let live = true;
    fetchLanding(projectKey)
      .then((data) => { if (live) setLanding(data.data || null); })
      .catch(() => { if (live) setLanding(null); });
    return () => { live = false; };
  }, [projectKey]);

  const onCreate = async (event) => {
    event.preventDefault();
    try {
      await createMission(projectKey, { title, intent });
      setTitle('');
      setIntent('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create mission');
    }
  };

  const onClaim = async (missionId) => {
    const bugId = claim[missionId];
    if (!bugId) return;
    try {
      await claimMissionBug(projectKey, missionId, bugId);
      setClaim((prev) => ({ ...prev, [missionId]: '' }));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not claim bug');
    }
  };

  // Delete used to fire on the first click with no confirmation and no undo.
  // Two-step inline confirm keeps it reversible without a blocking dialog.
  const onDelete = async (missionId) => {
    if (confirmDelete !== missionId) {
      setConfirmDelete(missionId);
      return;
    }
    try {
      await deleteMission(projectKey, missionId);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete mission');
    }
  };

  if (loading) return <SkeletonList rows={4} label="Loading Mission Map" />;
  if (error && !payload) return <div className="empty-state"><h3>{error}</h3></div>;

  const missions = payload?.data?.missions || [];
  const unclaimed = payload?.data?.unclaimed || { bugIds: [], count: 0 };

  return (
    <div className="pulse-missions">
      <p className="pulse-lede">
        A mission is an outcome you will own in a review — not a bucket of tickets. Claim the bugs that serve it.
        Gravity is bounce of that set, never a person. Unclaimed work is effort with no result attached.
        Deleting a mission unlinks bugs; it does not delete them.
      </p>
      {error ? <Degraded reason={error} /> : null}

      <form className="pulse-mission-form" onSubmit={onCreate}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mission title"
          required
        />
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Intent (required)"
          required
        />
        <button type="submit" className="btn btn-primary" data-tip="Create an outcome that a set of bugs serves">Create mission</button>
      </form>

      <section className="pulse-unclaimed">
        <h3>Unclaimed ({unclaimed.count})</h3>
        {unclaimed.bugIds.length ? (
          <BugChips projectKey={projectKey} bugIds={unclaimed.bugIds} />
        ) : (
          <p className="pulse-lede">Every bug in this project sits on a mission.</p>
        )}
      </section>

      {landing?.assumes ? (
        <p className="pulse-inst pulse-inst-footnote">{landing.assumes}</p>
      ) : null}

      {!landing ? (
        <PaidSurface
          title="Landing forecast"
          what="A landing date with honest error bars, computed from this project's own measured dwell and QA bounce — not from a date someone typed."
          why="It also names which module is responsible for the uncertainty."
        >
          {null}
        </PaidSurface>
      ) : null}

      <div className="pulse-mission-grid">
        {missions.map((mission) => {
          const tax = mission.qualityTax;
          const taxLine = tax?.percent == null
            ? (tax?.degraded?.reason || 'quality tax unavailable')
            : tax.sentence;
          return (
            <article key={mission.id} className="pulse-mission-card">
              <header>
                <strong>{mission.title}</strong>
                <span>{mission.status}</span>
              </header>
              <p>{mission.intent}</p>
              {tax?.percent == null ? (
                <Degraded reason={taxLine} />
              ) : (
                <Instrument rank="instrument" label="Quality tax">{taxLine}</Instrument>
              )}
              <Instrument rank="instrument" label="Reopen gravity">{mission.gravity.sentence}</Instrument>
              {landing ? (
                <Landing row={(landing.missions || []).find((m) => m.missionId === mission.id)} />
              ) : null}
              {mission.bugIds.length ? (
                <BugChips projectKey={projectKey} bugIds={mission.bugIds} />
              ) : (
                <p className="pulse-inst pulse-inst-footnote">No bugs claimed</p>
              )}
              <div className="pulse-mission-actions">
                <select
                  value={claim[mission.id] || ''}
                  onChange={(e) => setClaim((prev) => ({ ...prev, [mission.id]: e.target.value }))}
                >
                  <option value="">Claim unclaimed bug…</option>
                  {unclaimed.bugIds.map((bugId) => (
                    <option key={bugId} value={bugId}>{bugId}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onClaim(mission.id)} data-tip="Attach the selected bug to this mission">
                  Claim
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${confirmDelete === mission.id ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => onDelete(mission.id)}
                  onBlur={() => setConfirmDelete((id) => (id === mission.id ? null : id))}
                  data-tip="Removes the mission only. The bugs stay, unlinked."
                >
                  {confirmDelete === mission.id ? 'Confirm — unlinks bugs' : 'Delete mission'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
