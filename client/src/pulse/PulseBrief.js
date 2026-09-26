import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Instrument, Degraded } from './components/Instrument';
import { SkeletonList } from './components/Skeleton';
import { fetchBrief } from './pulseApi';

const LABELS = {
  headline: 'The week in one line',
  mix: 'Quality tax',
  bottleneck: 'Bottleneck',
  interrupt: 'Interrupt budget',
  pit: 'Oldest untriaged'
};

function Evidence({ projectKey, ids }) {
  if (!ids || !ids.length) return null;
  return (
    <p className="pulse-evidence">
      {ids.map((id) => (
        <Link key={id} to={`/projects/${projectKey}/bugs/${id}`}>{id}</Link>
      ))}
    </p>
  );
}

export function PulseBrief({ projectKey }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchBrief(projectKey)
      .then((data) => { setPayload(data); setError(''); })
      .catch((err) => setError(err.response?.data?.error || 'Could not load brief'));
  }, [projectKey]);

  if (error) return <div className="empty-state"><h3>{error}</h3></div>;
  if (!payload) return <SkeletonList rows={5} label="Loading brief" />;

  const clauses = payload.data?.clauses || [];
  const paste = clauses
    .map((clause) => `${clause.text}${clause.evidence?.length ? ` (${clause.evidence.join(', ')})` : ''}`)
    .join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(paste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // The headline clause is a concatenation of the others, so it is the one
  // sentence — and the rest are its supporting numbers, not its equals.
  const headline = clauses.find((clause) => clause.id === 'headline');
  const rest = clauses.filter((clause) => clause.id !== 'headline');

  return (
    <div className="pulse-brief">
      <p className="pulse-lede">
        Arithmetic only — paste into Slack. Every claim names its bugs. Optional AI sits under the numbers and is not copied.
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={copy} data-tip="Copy the numbers to your clipboard. AI prose is never copied.">
        {copied ? 'Copied' : 'Copy brief'}
      </button>

      {headline ? (
        headline.degraded ? (
          <Degraded reason={headline.text} />
        ) : (
          <div className="pulse-brief-headline">
            <Instrument rank="headline">{headline.text}</Instrument>
            <Evidence projectKey={projectKey} ids={headline.evidence} />
          </div>
        )
      ) : null}

      <div className="pulse-brief-list">
        {rest.map((clause) => (
          clause.degraded ? (
            <Degraded key={clause.id} reason={clause.text} />
          ) : (
            <Instrument key={clause.id} rank="instrument" label={LABELS[clause.id] || clause.id}>
              {clause.text}
              <Evidence projectKey={projectKey} ids={clause.evidence} />
            </Instrument>
          )
        ))}
      </div>

      {payload.data?.aiProse ? (
        <p className="pulse-ai-prose">{payload.data.aiProse}</p>
      ) : null}
    </div>
  );
}
