import React from 'react';
import './PulseHelpExplainer.css';

const FLOWS = [
  {
    title: 'A new bug arrives',
    steps: [
      'File the bug as usual (or it comes in from email / GitHub). Status is usually Open. It is not on Strike yet.',
      'Open Pulse → the project → The Pit. The card waits here until a human decides it is real work.',
      'Press a (Accept). That only stamps triage time. Status does not change. The card leaves The Pit and appears on Strike in Open.',
      'Assign someone (and a QA owner if you know who verifies). The next-move pip should show a name, not “triage”.'
    ]
  },
  {
    title: 'Morning standup (15 minutes)',
    steps: [
      'Open My Pulse. That is your personal queue: next move is you, Criticals, SLA today, blocked ARB.',
      'Open The Pit. Accept what belongs on the plan; leave noise in the Pit. Do not drag untriaged work onto In Progress.',
      'Open Strike. Read quality tax (firefighting mix), interrupt (surprises vs committed work), The Line (who is waiting in which station).',
      'Drag cards that actually moved. Resolved is waiting for QA — not done. Closed is done.'
    ]
  },
  {
    title: 'Developer on a card',
    steps: [
      'Find the card on My Pulse or Strike. Next-move should say you (dev).',
      'Drag Open → In Progress when you start. Comment or commit so the truth clock is real activity, not an empty drag.',
      'When the fix is in, drag to Resolved. Set QA owner on the bug form if it is empty. You are not finished — QA is.',
      'If QA fails, the card comes back as Reopened (↻). Fix again; do not hide it in Closed.'
    ]
  },
  {
    title: 'QA on a card',
    steps: [
      'Strike’s Resolved column is your inbox. Next-move should say qa and your name if you are QA owner.',
      'Open the bug (click the ID). Set QA status to Testing, then Passed or Failed. Pulse has no second editor.',
      'Passed: drag Resolved → Closed. If you never Close, Resolved grows forever — there is no column cap.',
      'Failed: drag to Reopened (or set status Reopened). That is reopen gravity, not a blame score.'
    ]
  },
  {
    title: 'Someone is blocked (ARB)',
    steps: [
      'On the bug form, set Action Required By to the person who must decide (customer, lead, another team).',
      'The next-move pip switches to arb. It shows on My Pulse under Blocked (ARB) for that person.',
      'When they act, clear ARB and put the card back on Dev or QA. ARB is not a Strike column.'
    ]
  },
  {
    title: 'Friday for leads',
    steps: [
      'From the project, click Friday brief. Copy the sentences and bug IDs into Slack or email. Do not rewrite them.',
      'If a clause is grey, the data is missing (no bug type, no dwell yet, empty Pit). Fix the fields — do not invent a number.',
      'If you have more than one project, Pulse home is Command Deck (mix, interrupt, oldest Pit per project). One project skips straight to Strike.'
    ]
  },
  {
    title: 'Missions and Horizon (outcomes, then time)',
    steps: [
      'Missions: name an outcome you will own in a review (title + intent), then claim the bugs that serve it. Unclaimed work is effort with no result.',
      'Horizon: look at those outcomes on a calendar against today. The longest open bar is capital still in play — not a Gantt of every ticket.',
      'If a bar has no dates, the mission has no window yet. If Horizon is empty, you have not committed to any outcome on this project.'
    ]
  }
];

export function PulseHelpWorkflows() {
  return (
    <div className="pulse-explainer">
      <h3>How you actually work in Pulse</h3>
      <p>
        Same bugs as the rest of Mertis. Pulse is the factory view: Pit (inbox) → Strike (plan) → Closed (verified).
        Drag writes the bug. There is no second ticket.
      </p>
      {FLOWS.map((flow) => (
        <div key={flow.title} className="pulse-explainer-flow">
          <h4>{flow.title}</h4>
          <ol>
            {flow.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
