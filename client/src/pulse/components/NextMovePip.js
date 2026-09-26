import React from 'react';

export function NextMovePip({ nextMove }) {
  if (!nextMove || nextMove.role === null) {
    return <span className="pulse-pip muted">closed</span>;
  }
  if (nextMove.role === 'triage') {
    return <span className="pulse-pip triage">triage</span>;
  }
  const label = nextMove.user || nextMove.unresolvedText || nextMove.role;
  return (
    <span className={`pulse-pip role-${nextMove.role.replace('?', '')}`}>
      <span className="pulse-pip-role">{nextMove.role}</span>
      {label ? <span className="pulse-pip-who">{label}</span> : null}
      {nextMove.extraCount > 0 ? <span className="pulse-pip-extra">+{nextMove.extraCount}</span> : null}
    </span>
  );
}
