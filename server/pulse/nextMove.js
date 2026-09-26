const parseArb = (arb) => {
  if (!arb) return [];
  if (Array.isArray(arb)) return arb.map((s) => String(s).trim()).filter(Boolean);
  if (typeof arb === 'string') {
    try {
      const parsed = JSON.parse(arb);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch (_) {
      // comma-separated fallback
    }
    return arb.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

/**
 * Spec §12.7 — first matching rule wins. ARB is a set: one face, or +N, never a silent pick.
 */
const resolveNextMove = (bug, knownUsers = null) => {
  const status = bug.status;
  const qaStatus = bug.qaStatus || bug.qa_status || 'Not Started';
  const qaOwner = bug.qaOwner || bug.qa_owner || null;
  const assignee = bug.assignee || null;
  const arbList = parseArb(bug.arb);

  if (status === 'Closed') {
    return { user: null, role: null, extraCount: 0, unresolvedText: null };
  }

  if (status === 'Resolved' && (qaStatus === 'Not Started' || qaStatus === 'Testing')) {
    if (qaOwner) {
      return { user: qaOwner, role: 'qa', extraCount: 0, unresolvedText: null };
    }
    return {
      user: assignee || null,
      role: 'qa?',
      extraCount: 0,
      unresolvedText: null
    };
  }

  if (qaStatus === 'Failed') {
    return { user: assignee || null, role: 'dev', extraCount: 0, unresolvedText: null };
  }

  if (arbList.length > 0) {
    const known = knownUsers instanceof Set ? knownUsers : null;
    const resolved = known ? arbList.filter((name) => known.has(name)) : arbList;
    const unresolved = known ? arbList.filter((name) => !known.has(name)) : [];
    const extraCount = Math.max(0, arbList.length - 1);
    const unresolvedText = unresolved.length ? unresolved.join(', ') : null;

    if (resolved.length === 1 && extraCount === 0 && !unresolvedText) {
      return { user: resolved[0], role: 'arb', extraCount: 0, unresolvedText: null };
    }

    return {
      user: resolved[0] || null,
      role: 'arb',
      extraCount,
      unresolvedText
    };
  }

  if (assignee) {
    return { user: assignee, role: 'dev', extraCount: 0, unresolvedText: null };
  }

  return { user: null, role: 'triage', extraCount: 0, unresolvedText: null };
};

module.exports = { parseArb, resolveNextMove };
