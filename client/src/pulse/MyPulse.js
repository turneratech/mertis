import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BugCard } from './components/BugCard';
import { fetchMyPulse } from './pulseApi';
import { PersonCalendar } from './PersonCalendar';

const Section = ({ title, items }) => (
  <section className="pulse-me-section">
    <h3>{title} <span>{items.length}</span></h3>
    {items.length === 0 ? (
      <p className="pulse-muted">None.</p>
    ) : (
      <div className="pulse-me-grid">
        {items.map((item) => (
          <div key={item.bugId}>
            <BugCard item={item} />
            {item.projectKey ? (
              <Link className="pulse-mini-link" to={`/pulse/${item.projectKey}`}>
                Strike {item.projectKey}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    )}
  </section>
);

export function MyPulse() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyPulse()
      .then((data) => {
        setPayload(data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.error || 'Could not load My Pulse'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading My Pulse…</div>;
  if (error) return <div className="empty-state"><h3>{error}</h3></div>;

  const data = payload?.data || {};
  return (
    <div className="pulse-me">
      <p className="pulse-lede">Call sheet — next moves that belong to you, plus Criticals, SLA today, and blocked ARB.</p>
      <PersonCalendar />
      <Section title="Next move is you" items={data.nextMoves || []} />
      <Section title="Critical" items={data.criticals || []} />
      <Section title="SLA today" items={data.slaToday || []} />
      <Section title="Blocked (ARB)" items={data.blocked || []} />
    </div>
  );
}
