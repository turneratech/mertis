import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The lens control, shared by every Pulse surface.
 *
 * State lives in the URL, so a lens is a link: "here is the payments firefight"
 * becomes something you paste into chat rather than describe. That is also why
 * there is no "apply" button for the named lenses — picking one navigates.
 */

const NAMED = [
  { value: '', label: 'Everything' },
  { value: 'mine', label: 'Next move is me' },
  { value: 'stale', label: 'Stale (14d+)' },
  { value: 'unclaimed', label: 'No mission' }
];

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const ENVIRONMENTS = ['Development', 'Staging', 'Production', 'Testing'];

export function LensBar({ lens, modules = [] }) {
  const [params, setParams] = useSearchParams();
  const active = params.get('lens') || '';
  const activeQ = params.get('q') || '';
  const [draft, setDraft] = useState(activeQ);

  // Keep the box in step when the URL changes underneath us (back button, or a
  // pasted link).
  useEffect(() => setDraft(activeQ), [activeQ]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  const submitQ = (event) => {
    event.preventDefault();
    setParam('q', draft.trim());
  };

  const clearAll = () => {
    const next = new URLSearchParams(params);
    next.delete('lens');
    next.delete('q');
    setParams(next);
  };

  const hasLens = Boolean(active || activeQ);

  return (
    <div className="pulse-lensbar">
      <div className="pulse-lensbar-controls">
        <label className="sr-only" htmlFor="pulse-lens-select">Lens</label>
        <select
          id="pulse-lens-select"
          value={active}
          onChange={(e) => setParam('lens', e.target.value)}
          data-tip="Filter the board. Every number below is recomputed for the slice you pick."
        >
          {NAMED.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
          {modules.length ? (
            <optgroup label="Module">
              {modules.map((m) => (
                <option key={m} value={`module:${m}`}>{m}</option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Severity">
            {SEVERITIES.map((s) => (
              <option key={s} value={`severity:${s}`}>{s}</option>
            ))}
          </optgroup>
          <optgroup label="Environment">
            {ENVIRONMENTS.map((e) => (
              <option key={e} value={`environment:${e}`}>{e}</option>
            ))}
          </optgroup>
        </select>

        <form onSubmit={submitQ} className="pulse-lensbar-search">
          <label className="sr-only" htmlFor="pulse-lens-q">Search titles</label>
          <input
            id="pulse-lens-q"
            type="search"
            placeholder="Search title or ID…"
            data-tip="Type, then press Enter"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm" data-tip="Search titles and bug IDs">Search</button>
        </form>

        {hasLens ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearAll} data-tip="Show everything again">
            Clear lens
          </button>
        ) : null}
      </div>

      {/*
        Always show the unfiltered total. Without it a user cannot tell a small
        project from a narrow lens — and every metric on the page is computed
        over the filtered set.
      */}
      {lens ? (
        <p className="pulse-lensbar-count">
          <strong>{lens.matched}</strong> of {lens.of} · lens <code>{lens.label}</code>
          {lens.matched === 0 ? ' — nothing matches this lens' : ' · all numbers below describe this slice'}
        </p>
      ) : null}
    </div>
  );
}
