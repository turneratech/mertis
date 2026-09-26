export function resolveClientNextMove(bug) {
  const status = bug.status;
  const qaStatus = bug.qaStatus || 'Not Started';
  const arb = Array.isArray(bug.arb) ? bug.arb : [];
  if (status === 'Closed') return { user: null, role: null, extraCount: 0, unresolvedText: null };
  if (status === 'Resolved' && (qaStatus === 'Not Started' || qaStatus === 'Testing')) {
    return { user: bug.qaOwner || bug.assignee || null, role: bug.qaOwner ? 'qa' : 'qa?', extraCount: 0, unresolvedText: null };
  }
  if (qaStatus === 'Failed') return { user: bug.assignee || null, role: 'dev', extraCount: 0, unresolvedText: null };
  if (arb.length > 0) {
    return { user: arb[0], role: 'arb', extraCount: Math.max(0, arb.length - 1), unresolvedText: null };
  }
  if (bug.assignee) return { user: bug.assignee, role: 'dev', extraCount: 0, unresolvedText: null };
  return { user: null, role: 'triage', extraCount: 0, unresolvedText: null };
}
