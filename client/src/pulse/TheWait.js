import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchWait } from './pulseApi';
import { Instrument, Degraded } from './components/Instrument';
import { Andon } from './components/Andon';
import { SkeletonList } from './components/Skeleton';
import { BugChips } from './components/BugChips';
import { LensBar } from './components/LensBar';

const days = (n) => (n == null ? 'unknown' : n === 0 ? 'today' : `${n}d`);

/**
 * The Wait — who is waiting on whom.
 *
 * Deliberately not a leaderboard. Queues are ordered by how long work has been
 * parked, never by who has the most, and nothing here scores a person. The
 * feature exists to unblock people; the moment it ranks them, adoption dies.
 */
export function TheWait({ projectKey }) {
  const { search } = useLocation();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchWait(projectKey, search)
      .then((data) => { if (live) { setPayload(data); setError(''); } })
      .catch((err) => { if (live) setError(err.response?.data?.error || 'Could not load The Wait'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [projectKey, search]);

  if (loading) return <SkeletonList rows={4} label="Loading The Wait" />;
  if (error) return <div className="empty-state"><h3>{error}</h3></div>;

  const data = payload?.data || {};
  const degraded = (payload?.meta?.degraded || []).find((e) => e.metric === 'wait');
  const { queues = [], sinks = [], standoffs = [], unresolvedArbCount = 0 } = data;
  const sinkUsers = new Set(sinks.map((s) => s.user));

  return (
    <div className="pulse-wait">
      <p className="pulse-lede">
        Manager question: where is a decision parked, and for how long? Queues are Action Required By,
        ordered by wait — never a leaderboard of who holds the most.
      </p>

      <LensBar lens={data.lens} />

      {degraded ? (
        <Degraded reason={`${degraded.reason} — set ARB on a bug to name who owes the next move.`} />
      ) : null}

      {!degraded && data.sentence ? (
        <Instrument rank="headline">{data.sentence}</Instrument>
      ) : null}

      {standoffs.length ? (
        <Andon level="stop" label="Standoff">
          {standoffs.map((s) => (
            <span key={`${s.a}|${s.b}`} className="pulse-standoff">
              <strong>{s.a}</strong> is waiting on <strong>{s.b}</strong>, who is waiting on{' '}
              <strong>{s.a}</strong>.{' '}
              <BugChips projectKey={projectKey} bugIds={s.bugIds} cap={6} />
            </span>
          ))}
        </Andon>
      ) : null}

      {unresolvedArbCount > 0 ? (
        <Degraded
          reason={`${unresolvedArbCount} ARB ${unresolvedArbCount === 1 ? 'value does' : 'values do'} not match a user — those items are not counted in any queue below.`}
        />
      ) : null}

      {queues.length ? (
        <div className="pulse-wait-grid">
          {queues.map((q) => (
            <Instrument
              key={q.user}
              rank="instrument"
              label={sinkUsers.has(q.user) ? 'Waiting on nobody' : 'Queue'}
              tone={sinkUsers.has(q.user) ? 'warn' : 'neutral'}
            >
              <span className="pulse-wait-user">{q.user}</span>
              <span className="pulse-wait-meta">
                {q.count} item{q.count === 1 ? '' : 's'} · oldest {days(q.oldestDays)}
              </span>
              <BugChips projectKey={projectKey} bugIds={q.bugIds} cap={8} />
            </Instrument>
          ))}
        </div>
      ) : null}

      {!degraded && !queues.length ? (
        <div className="empty-state">
          <h3>Nothing is parked on anyone</h3>
          <p>Every open bug in this project has an empty Action Required By.</p>
        </div>
      ) : null}

      {sinks.length ? (
        <p className="pulse-inst pulse-inst-footnote">
          <strong>Waiting on nobody</strong> means work enters this person and does not leave —
          usually the real bottleneck, and usually not a column. Open their queue above, or
          see <Link to={`/pulse/${projectKey}`}>the board</Link>.
        </p>
      ) : null}
    </div>
  );
}
