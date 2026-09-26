import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BugCard } from './components/BugCard';
import { InterruptRing } from './components/InterruptRing';
import { fetchPit, triageBug } from './pulseApi';
import { usePulseKeys } from './useKeyboard';
import { ShortcutSheet } from './components/ShortcutSheet';
import { SkeletonList } from './components/Skeleton';
import { Degraded } from './components/Instrument';
import { LensBar } from './components/LensBar';

export function ThePit({ projectKey }) {
  const { search } = useLocation();
  const [items, setItems] = useState([]);
  const [interrupt, setInterrupt] = useState(null);
  const [degraded, setDegraded] = useState([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const [help, setHelp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPit(projectKey, search);
      setItems(data.data?.items || []);
      setLens(data.data?.lens || null);
      setInterrupt(data.data?.interrupt || null);
      setDegraded(data.meta?.degraded || []);
      setSelected(0);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load The Pit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectKey, search]);

  const accept = async (bugId) => {
    try {
      await triageBug(bugId);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Triage failed');
    }
  };

  const down = () => setSelected((i) => Math.min(items.length - 1, i + 1));
  const up = () => setSelected((i) => Math.max(0, i - 1));

  // usePulseKeys ignores anything with ctrl/meta/alt held, so Ctrl+A is a
  // select-all again rather than a triage POST, and it also ignores
  // contentEditable targets (the rich description editor).
  usePulseKeys(
    {
      '?': () => setHelp((h) => !h),
      Escape: () => setHelp(false),
      j: () => items.length && down(),
      ArrowDown: () => items.length && down(),
      k: () => items.length && up(),
      ArrowUp: () => items.length && up(),
      a: () => items.length && accept(items[selected].bugId),
      x: () => items.length && down()
    },
    [items, selected]
  );

  if (loading) return <SkeletonList rows={5} label="Loading The Pit" />;
  if (error) return <div className="empty-state"><h3>{error}</h3></div>;

  return (
    <div className="pulse-pit">
      <p className="pulse-lede">
        Unplanned work lands here until someone accepts it onto Strike.
        Keys: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>a</kbd> accept · <kbd>x</kbd> skip · <kbd>?</kbd> help.
      </p>
      <LensBar lens={lens} />
      <InterruptRing interrupt={interrupt} degraded={degraded} />
      <ShortcutSheet
        open={help}
        onClose={() => setHelp(false)}
        title="The Pit"
        rows={[
          { keys: 'j k', what: 'Move between items (arrow keys work too)' },
          { keys: 'a', what: 'Accept — sets triaged_at, the card leaves The Pit' },
          { keys: 'x', what: 'Defer — skip to the next item (not saved)' },
          { keys: '?', what: 'Show or hide this panel' }
        ]}
      />
      {items.length === 0 ? (
        <div className="empty-state">
          <h3>The Pit is empty</h3>
          <p>New bugs will appear here until they are triaged.</p>
        </div>
      ) : (
        <ol className="pulse-pit-list">
          {items.map((item, index) => (
            <li
              key={item.bugId}
              className={index === selected ? 'selected' : ''}
              onClick={() => setSelected(index)}
            >
              <BugCard item={item} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => accept(item.bugId)} data-tip="Accept onto the Strike Board (sets triaged)">
                Accept
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
