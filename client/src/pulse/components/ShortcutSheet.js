import React from 'react';

/**
 * The "?" sheet. Previously only The Pit had one, and it was two lines of prose
 * rendered inline. Every keyboard surface now shows the same panel.
 */
export function ShortcutSheet({ open, onClose, title = 'Keyboard', rows = [] }) {
  if (!open) return null;
  return (
    <div className="pulse-sheet" role="dialog" aria-modal="false" aria-label={`${title} shortcuts`}>
      <header className="pulse-sheet-head">
        <h4>{title}</h4>
        <button type="button" onClick={onClose} aria-label="Close shortcuts" data-tip="Close (Esc)">×</button>
      </header>
      <dl className="pulse-sheet-rows">
        {rows.map((row) => (
          <div className="pulse-sheet-row" key={row.keys}>
            <dt>
              {row.keys.split(' ').map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </dt>
            <dd>{row.what}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
