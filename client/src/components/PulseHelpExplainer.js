import React from 'react';
import './PulseHelpExplainer.css';

const PURPOSE = [
  ['Strike Board', 'Where is today’s WIP, quality mix, and queue? Operations review — not a ticket dump.'],
  ['The Pit', 'What is not yet a commitment? Intake gate. Accepting is a resource decision.'],
  ['The Wait', 'Where is decision latency? ARB queues. Unblock, do not rank people.'],
  ['Missions', 'Which outcomes are we funding? Strategy translated into a set of bugs.'],
  ['Horizon', 'Over what calendar do those outcomes sit, and which strip is still open? Time and capital still in play — not a Gantt of tasks.'],
  ['Command Deck', 'Which projects are firefighting or over interrupt? Portfolio glance.'],
  ['Friday brief', 'What can leadership paste without a narrative? Arithmetic plus evidence IDs.'],
  ['My Pulse', 'What is waiting on me as a named next human? Personal call sheet, not a filter.']
];

const WORDS = [
  ['The Pit', 'The incoming tray. A new bug sits here until someone says “yes, this is real work.” Same idea as a hospital triage desk — it is not on the ward yet.'],
  ['Strike Board', 'The factory floor. Columns are statuses of the same Mertis bugs. Dragging a card saves that bug. There is no second Trello.'],
  ['Horizon', 'The calendar of outcomes you would defend in a review. Ask: which results occupy the next weeks, and which has been open longest (effort still not landed)? The “today” line is the decision date. Work with no mission is off the chart — it is not a commitment. Not a task Gantt; Pulse does not store dependency edges.'],
  ['Interrupt', 'Unplanned work that arrived this week (accepted from The Pit) compared with work you had already committed (In Progress from earlier). 35% of the mix is reserved for surprises. If the ring is high, the team is firefighting instead of finishing the plan. Not a sprint name.'],
  ['Reopen gravity', 'How often work bounces back after it was thought done (status Reopened). The ↻ on a card is that bug’s bounce count. The sentence above Strike names the modules that bounce most — never a person. High gravity means the area keeps coming back, not that someone is slow.'],
  ['Resolved vs Closed', 'Resolved = developer thinks the fix is in; QA still has to check. Closed = verified done. Resolved has no per-column card limit, so it grows forever if you never Close. Drag to Closed after QA passes. The whole Strike board only stops listing extra cards after 500 bugs (it asks you to narrow the lens) — that is not a Resolved WIP cap.']
];

const CONTROLS = [
  ['Pulse (navbar)', 'Opens the Pulse workspace. Same bugs as the rest of Mertis — a new view, not a new ticket system.'],
  ['Project tile', 'Choose which project’s bugs you are looking at. One project skips this and goes straight to Strike.'],
  ['My Pulse', 'Your personal list: work whose next move is you, plus Criticals, SLA due today, and blocked ARB items.'],
  ['Strike Board', 'The plan board. Columns are bug statuses. Only bugs someone accepted from The Pit appear here.'],
  ['The Pit', 'The inbox. New bugs wait here until someone accepts them onto Strike. Nothing here is “in the plan” yet.'],
  ['The Wait', 'Who owes the next move, and for how long — not a status column. Open it from the project tabs.'],
  ['Missions', 'An outcome a set of bugs serves. Create a title + intent, then claim bugs. Not a Jira epic tree.'],
  ['Horizon', 'See Horizon above. Longest bar is the outcome still open — not a critical path of tickets.'],
  ['Command Deck', 'Pulse home when you can see two or more projects. One project skips this and opens Strike.'],
  ['Friday brief', 'A copy-paste status update: mix, bottleneck, interrupt, oldest Pit item. Numbers only — not an AI paragraph.'],
  ['← Pulse / ← Strike', 'Go back to the project picker or to Strike. You never have to open the classic bug list first.'],
  ['Accept (key a)', '“This is real work.” Stamps triage time. The bug leaves The Pit and shows up on Strike. Status does not change.'],
  ['Defer (key x)', 'Skip this Pit item and look at the next one. The bug stays untriaged.'],
  ['Drag a card', 'Change that bug’s status (Open, In Progress, Resolved, Closed, Reopened). Same save as the bug form.'],
  ['Click the bug ID', 'Open the normal bug editor (title, QA, environment, comments). Pulse does not have a second editor.'],
  ['Open Strike / Open on Pulse', 'Jump here from a bug or project. Hidden when Pulse is turned off.'],
  ['Copy brief', 'Copies the Friday sentences and their bug IDs onto the clipboard for Slack.'],
  ['Next-move pip', 'Whose turn it is — assignee, QA owner, or ARB (Action Required By). Exactly one person, never a crowd.'],
  ['Truth clock', 'How long since a real change (status, comment, or commit). Empty drags do not reset it.'],
  ['Bounce pip (↻)', 'Same idea as reopen gravity on one card: how many times this bug moved to Reopened. Hidden until the count is at least 1.'],
  ['Dwell chips / The Line', 'How long work sits in Dev queue, Dev, QA, and QA testing. The banner names the slowest crowded station.'],
  ['Quality tax', 'What share of the Strike board is firefighting (bug type = Bug) versus building.'],
  ['Interrupt (the ring)', 'See Interrupt above. The gauge is last-7-day Pit accepts vs older In Progress. Grey means not enough of both to measure.'],
  ['Reopen gravity (the sentence)', 'See Reopen gravity above. Ranked by module. The ↻ on cards is the per-bug count.'],
  ['Fix–verify gap', 'Code was committed, but QA has not started. Grey “no commit data” means GitHub is not feeding commits — not that the gap is zero.'],
  ['Escaped Production', 'A Production bug filed after the last close. Testing-environment bugs do not count.'],
  ['Greyed sentence', 'Pulse does not have enough data yet. It will not invent a zero. Fill bug type, move status twice, or accept Pit items.']
];

const ELSEWHERE = [
  ['Strike Board', 'Jira board, Trello board, Linear project, Azure Boards kanban', 'The card is the Mertis bug. Drag writes that bug. There is no second Trello to keep in sync.'],
  ['The Pit', 'Linear Triage, a Jira incoming queue, a Trello inbox list', 'Accept only stamps triage time. It does not create a new issue or change status.'],
  ['My Pulse', 'Jira “assigned to me”, Linear My Issues', 'Includes QA owner and ARB, not only the assignee.'],
  ['Next-move pip', 'Jira assignee', 'One next human. Can be QA or ARB instead of the developer.'],
  ['Truth clock', 'Jira Updated, Trello last activity', 'Ignores empty moves and bulk “updated” rows. Status, comment, and commit count.'],
  ['The Line', 'Jira Control Chart / cycle time, Plane QA time', 'Sits on the board and names the bottleneck station. Mean is never used.'],
  ['Quality tax', 'Jira issue-type mix (no Trello equivalent)', 'One sentence: percent firefighting from bug type. Untyped boards grey out; they never print 0%.'],
  ['Interrupt ring', 'Linear Cycles, Jira sprints — only as a contrast', 'Not a sprint. Rolling 7-day unplanned vs committed In Progress. Planned work cannot eat the 35% reserve.'],
  ['Friday brief', 'Linear Updates / Loops, a handwritten standup', 'Computed arithmetic plus evidence IDs. No AI prose in this version.'],
  ['Bounce / gravity', 'Jira reopen, DORA rework', 'Ranked by module, never by person.'],
  ['Fix–verify gap', 'No standard Jira/Trello widget', 'GitHub commit on the bug, QA still Not Started.'],
  ['Escaped Production', 'Escaped defects / prod bugs after a release', 'Cut is the last close until named Drops exist. Testing env is not escaped.'],
  ['Open Strike', '“Open in Jira”', 'Bundle-only. Hidden when Pulse is off.']
];

export function PulseHelpExplainer() {
  return (
    <div className="pulse-explainer">
      <h3>Why a manager opens each view</h3>
      <p>Pulse is for the person who owns the plan, not a second ticket list. Each view answers one question. If it does not change a decision, skip it.</p>
      <div className="pulse-explainer-scroll">
        <table>
          <thead>
            <tr>
              <th>View</th>
              <th>Question it answers</th>
            </tr>
          </thead>
          <tbody>
            {PURPOSE.map(([name, meaning]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Words on the board</h3>
      <p>Pulse is a planning view over the same bugs. You are not creating a second ticket. Start here if someone said “Pit” or “Interrupt” and you have no idea.</p>
      <div className="pulse-explainer-scroll">
        <table>
          <thead>
            <tr>
              <th>Word</th>
              <th>In the real world</th>
            </tr>
          </thead>
          <tbody>
            {WORDS.map(([name, meaning]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>If you are new — what each control does</h3>
      <p>What you click, then what happens.</p>
      <div className="pulse-explainer-scroll">
        <table>
          <thead>
            <tr>
              <th>What you click</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map(([name, meaning]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>If you already used Jira, Trello, or Linear</h3>
      <p>Closest neighbour, then the catch. Pulse is not a Jira clone and does not sync to Jira.</p>
      <div className="pulse-explainer-scroll">
        <table>
          <thead>
            <tr>
              <th>Pulse</th>
              <th>Closest elsewhere</th>
              <th>How it differs</th>
            </tr>
          </thead>
          <tbody>
            {ELSEWHERE.map(([name, elsew, diff]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{elsew}</td>
                <td>{diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pulse-explainer-note">
        Not in this version: a Cycles table (not Linear Cycles / Jira sprints), or Pulse running on top of Jira.
      </p>
    </div>
  );
}
