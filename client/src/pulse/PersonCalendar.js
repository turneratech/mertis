import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addCalendarSource, fetchCalendar, removeCalendarSource } from './pulseApi';
import { Degraded } from './components/Instrument';

const formatSpan = (block) => {
  if (block.allDay) return 'All day';
  const fmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${fmt.format(new Date(block.start))}–${fmt.format(new Date(block.end))}`;
};

export function PersonCalendar() {
  const [user, setUser] = useState('');
  const [lookup, setLookup] = useState('');
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback((name) => {
    setLoading(true);
    fetchCalendar(name)
      .then((data) => {
        setPayload(data);
        setError('');
      })
      .catch((err) => {
        setPayload(null);
        setError(err.response?.data?.error || 'Could not load the calendar');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(user); }, [load, user]);

  const onAdd = (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    addCalendarSource({ label, url })
      .then(() => {
        setLabel('');
        setUrl('');
        load('');
        setUser('');
      })
      .catch((err) => setFormError(err.response?.data?.error || 'Could not connect that calendar'))
      .finally(() => setSaving(false));
  };

  const onRemove = (id) => {
    removeCalendarSource(id)
      .then(() => load(user))
      .catch((err) => setFormError(err.response?.data?.error || 'Could not remove that link'));
  };

  const onLookup = (event) => {
    event.preventDefault();
    setUser(lookup.trim());
  };

  const data = payload?.data;
  const self = !data || data.self;

  return (
    <section className="pulse-me-section pulse-cal">
      <h3>Calendar</h3>
      <p className="pulse-lede">
        Busy time from an Outlook, Google, or other iCal link, so a due date can be seen against a real day.
        Meeting names stay on your own My Pulse. Someone else only sees that you are busy.
      </p>

      <form className="pulse-mission-form" onSubmit={onLookup}>
        <input
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="Someone's username"
          aria-label="Someone's username"
          data-tip="Free/busy for scheduling. Titles stay on their calendar."
        />
        <button type="submit" className="btn btn-secondary" data-tip="Show when this person is busy">
          Show availability
        </button>
        {user ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setUser(''); setLookup(''); }}
          >
            My calendar
          </button>
        ) : null}
      </form>

      {loading ? <p className="pulse-muted">Loading calendar…</p> : null}
      {error ? <Degraded reason={error} /> : null}

      {data && !loading ? (
        <>
          <p className="pulse-muted">
            {self ? 'Your next 7 days.' : `${data.username} — busy times only.`}
          </p>
          {(payload.meta?.degraded || []).filter((entry) => entry.metric === 'calendar').map((entry) => (
            <Degraded key={entry.reason} reason={entry.reason} />
          ))}
          <div className="pulse-cal-week">
            {(data.days || []).map((day) => {
              const blocks = (data.blocks || []).filter((block) => (block.days || []).includes(day.key));
              return (
                <div key={day.key} className={day.key === data.todayKey ? 'pulse-cal-day today' : 'pulse-cal-day'}>
                  <div className="pulse-cal-day-label">{day.label}</div>
                  {blocks.length === 0 ? <p className="pulse-muted">Free</p> : blocks.map((block) => (
                    <div key={`${block.start}-${block.end}-${block.summary || 'busy'}`} className="pulse-cal-block" data-tip={self ? block.summary : 'Busy'}>
                      <span>{formatSpan(block)}</span>
                      {self && block.summary ? <strong>{block.summary}</strong> : <strong>Busy</strong>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {self && data.conflicts?.length ? (
            <ul className="pulse-cal-conflicts">
              {data.conflicts.map((item) => (
                <li key={`${item.bugId}-${item.day}`}>
                  {item.projectKey ? (
                    <Link to={`/pulse/${item.projectKey}`}>{item.bugId}</Link>
                  ) : item.bugId}
                  {' '}is due {item.day}, and you are busy that day.
                </li>
              ))}
            </ul>
          ) : null}

          {self ? (
            <>
              <form className="pulse-mission-form" onSubmit={onAdd}>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Label (Outlook)"
                  aria-label="Calendar label"
                />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…/calendar.ics"
                  aria-label="Calendar link"
                  spellCheck={false}
                  required
                  data-tip="Outlook: publish the calendar. Google: secret iCal address."
                />
                <button type="submit" className="btn btn-primary" disabled={saving} data-tip="Read busy time from this link">
                  {saving ? 'Connecting…' : 'Connect calendar'}
                </button>
              </form>
              {formError ? <Degraded reason={formError} /> : null}
              {(data.sources || []).length ? (
                <ul className="pulse-cal-sources">
                  {data.sources.map((source) => (
                    <li key={source.id}>
                      <span>{source.label}</span>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRemove(source.id)}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pulse-muted">
                  No calendar connected. Paste a published Outlook or Google iCal link.
                </p>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
