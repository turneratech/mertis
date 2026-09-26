import React from 'react';
import { Link } from 'react-router-dom';
import { Degraded } from './components/Instrument';
import { Constellation } from './components/Constellation';
import { Andon } from './components/Andon';
import { PulseLocked } from './components/PaidSurface';

// The headline clause is the mix sentence; the rest are supporting numbers.
const HEADLINE_ID = 'mix';
const SUPPORTING_IDS = ['interrupt', 'bottleneck', 'pit'];

export function CommandDeck({ rows, degraded, gated, projects }) {
  // The server withholds the briefs rather than refusing the route, so a
  // Community user with one project still gets redirected to their board.
  if (gated) {
    return (
      <div className="pulse-deck">
        <PulseLocked
          title="Command Deck"
          what="Every project you can see, in one picture: open volume, quality tax, what has escaped to Production, and the Friday numbers per project."
          why="This is the half-day a month someone spends collating status by hand."
          feature={gated.feature}
        />
        {(projects || []).length ? (
          <div className="pulse-deck-grid">
            {projects.map((p) => (
              <Link key={p.projectKey} className="pulse-deck-card" to={`/pulse/${p.projectKey}`}>
                <span className="project-key-large">{p.projectKey}</span>
                <strong>{p.projectName}</strong>
                <p className="pulse-deck-line">Open the board</p>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  // Deck-level degradation (project cap, or a project too large to reconstruct)
  // belongs above the grid, not hidden inside a card.
  const deckNotes = (degraded || []).filter((entry) => entry && entry.metric === 'deck');
  const list = rows || [];

  // Andon roll-up: the one thing a director must not have to hunt for.
  const escaped = list.filter((row) => (row.metrics?.escapedCount || 0) > 0);
  const overBudget = list.filter((row) => row.metrics?.interruptOverflow);

  return (
    <div className="pulse-deck">
      <p className="pulse-lede">
        Every project you can see. Arithmetic only — no AI, no typed status.
      </p>
      {deckNotes.map((note, i) => (
        <Degraded key={`${note.reason}-${i}`} reason={note.reason} />
      ))}

      {escaped.length ? (
        <Andon
          level="stop"
          label="Escaped to Production"
          evidence={escaped.map((row) => (
            <Link key={row.projectKey} to={`/pulse/${row.projectKey}`}>{row.projectKey}</Link>
          ))}
        >
          {escaped.length === 1
            ? `${escaped[0].projectKey} has ${escaped[0].metrics.escapedCount} defect(s) that reached Production since its last close.`
            : `${escaped.length} projects have defects that reached Production since their last close.`}
        </Andon>
      ) : null}

      {overBudget.length ? (
        <Andon
          level="watch"
          label="Over interrupt budget"
          evidence={overBudget.map((row) => (
            <Link key={row.projectKey} to={`/pulse/${row.projectKey}`}>{row.projectKey}</Link>
          ))}
        >
          {overBudget.length === 1
            ? `${overBudget[0].projectKey} is spending more on unplanned work than its budget allows.`
            : `${overBudget.length} projects are spending more on unplanned work than their budget allows.`}
        </Andon>
      ) : null}

      <Constellation rows={list} />

      <div className="pulse-deck-grid">
        {list.map((row) => {
          const byId = Object.fromEntries((row.clauses || []).map((clause) => [clause.id, clause]));
          const headline = byId[HEADLINE_ID];
          return (
            <Link key={row.projectKey} className="pulse-deck-card" to={`/pulse/${row.projectKey}`}>
              <span className="project-key-large">{row.projectKey}</span>
              <strong>{row.projectName}</strong>
              {headline ? (
                headline.degraded ? (
                  <Degraded reason={headline.text} />
                ) : (
                  <p className="pulse-deck-headline">{headline.text}</p>
                )
              ) : null}
              {SUPPORTING_IDS.map((id) => {
                const clause = byId[id];
                if (!clause) return null;
                return clause.degraded ? (
                  <Degraded key={id} reason={clause.text} />
                ) : (
                  <p key={id} className="pulse-deck-line">{clause.text}</p>
                );
              })}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
