import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { BugCard } from './components/BugCard';
import { DraggableCard, DroppableColumn } from './components/DraggableCard';
import { ShortcutSheet } from './components/ShortcutSheet';
import { LensBar } from './components/LensBar';
import { ReplayBar } from './components/ReplayBar';
import { useFeature } from '../hooks/useFeature';
import { usePulseKeys } from './useKeyboard';
import { InterruptRing } from './components/InterruptRing';
import { TheLine, columnIsBottleneck, dwellForColumn } from './TheLine';
import { formatDwell } from './components/StationBand';
import { Instrument, Degraded, withDegraded } from './components/Instrument';
import { SkeletonBoard } from './components/Skeleton';
import { fetchBoard, fetchLine, moveBugStatus, fetchReplay } from './pulseApi';
import { STATUSES } from './constants';

function QualityTax({ tax, degraded }) {
  const taxDegraded = withDegraded(degraded, 'qualityTax');
  if (taxDegraded || tax?.percent == null || !tax?.sentence) {
    return (
      <Degraded reason={taxDegraded?.reason || tax?.degraded?.reason || 'Quality tax unavailable'} />
    );
  }
  const split = tax.split || {};
  // Rank 1: this is the one sentence the board exists to tell you.
  return (
    <Instrument rank="headline">
      {tax.sentence}
      <span>
        Bug {split.Bug || 0} · Enhancement {split.Enhancement || 0} · Task {split.Task || 0} · Feature {split.Feature || 0}
      </span>
    </Instrument>
  );
}

function ReopenGravity({ gravity, degraded }) {
  const row = withDegraded(degraded, 'gravity');
  if (row) return <Degraded reason={row.reason} />;
  if (!gravity?.sentence) return null;
  const hasBounce = Boolean(gravity.ranking && gravity.ranking.length);
  return (
    <Instrument rank="instrument" label="Reopen gravity" tone={hasBounce ? 'warn' : 'neutral'} title="How often this project's modules bounce back to Reopened. Not a person score. Open What is this? for a plain-language version.">
      {gravity.sentence}
    </Instrument>
  );
}

function EscapedAndon({ escaped, degraded }) {
  const row = withDegraded(degraded, 'escaped');
  if (row || escaped?.count == null) {
    return <Degraded reason={row?.reason || escaped?.reason || 'Escaped Production not computable yet'} />;
  }
  const evidence = escaped.evidence || [];
  return (
    <Instrument
      rank="instrument"
      label="Escaped to Production"
      tone={escaped.count > 0 ? 'danger' : 'ok'}
      evidence={evidence.map((id) => <span key={id} className="pulse-evidence-chip">{id}</span>)}
    >
      {escaped.sentence}
    </Instrument>
  );
}

export function StrikeBoard({ projectKey }) {
  const { search } = useLocation();
  // Replay is a paid surface; without it the scrubber is simply absent rather
  // than present-and-broken.
  const { isAvailable: replayAllowed } = useFeature('advanced_reporting');
  const [payload, setPayload] = useState(null);
  const [line, setLine] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [landed, setLanded] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [help, setHelp] = useState(false);
  // Replay: `replayAt` null means live. When set, the board shows the past and
  // becomes read-only.
  const [replayAt, setReplayAt] = useState(null);
  const [replay, setReplay] = useState(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const toastTimer = useRef(null);

  // Pointer covers mouse and pen; Touch adds phones and tablets, which native
  // HTML5 drag never supported at all. Keyboard is the accessible path: the
  // board had no keyboard alternative to dragging before.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  /**
   * `background` refreshes the metrics underneath an optimistic move without
   * unmounting the board. The old code awaited a full reload after every drop,
   * which flipped `loading` and replaced the whole board with a spinner —
   * destroying the optimistic update it had just made.
   */
  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      const [board, linePayload] = await Promise.all([
        fetchBoard(projectKey, search),
        fetchLine(projectKey, search).catch(() => null)
      ]);
      setPayload(board);
      setLine(linePayload);
      setError('');
      return board;
    } catch (err) {
      if (!background) setError(err.response?.data?.error || 'Could not load Strike Board');
    } finally {
      if (!background) setLoading(false);
    }
  }, [projectKey, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // One request per scrub position. The engine cache on the server makes this
  // cheap; the board only re-renders when a frame actually arrives.
  useEffect(() => {
    if (!replayAllowed) return undefined;
    let live = true;
    setReplayBusy(true);
    fetchReplay(projectKey, replayAt ? new Date(replayAt).toISOString() : null, search)
      .then((data) => { if (live) setReplay(data); })
      .catch(() => { if (live) setReplay(null); })
      .finally(() => { if (live) setReplayBusy(false); });
    return () => { live = false; };
  }, [projectKey, replayAt, search, replayAllowed]);

  usePulseKeys(
    {
      '?': () => setHelp((h) => !h),
      Escape: () => setHelp(false),
      r: () => load({ background: true })
    },
    [load]
  );

  // tone 'error' is a failure the user must notice; 'info' explains something
  // that worked but had a non-obvious consequence.
  const showToast = (message, tone = 'error') => {
    clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const liveColumns = payload?.data?.columns || {};
  const rewound = Boolean(replayAt);
  // While rewound the board renders the replayed frame instead of the live one.
  const columns = rewound ? (replay?.data?.columns || {}) : liveColumns;

  const findCard = (bugId) => {
    for (const status of STATUSES) {
      const hit = (columns[status] || []).find((c) => c.bugId === bugId);
      if (hit) return { card: hit, status };
    }
    return null;
  };

  const onDragEnd = async (event) => {
    setActiveId(null);
    if (rewound) {
      // Writing a status from a rewound board would compute the change from a
      // state that is no longer true.
      showToast('The board is rewound — return to now before moving cards.', 'info');
      return;
    }
    const bugId = event.active?.id;
    const target = event.over?.id;
    if (!bugId || !target) return;

    const found = findCard(bugId);
    if (!found || found.status === target) return;
    const fromStatus = found.status;

    const snapshot = payload;
    setPayload((prev) => {
      if (!prev?.data?.columns) return prev;
      const next = { ...prev.data.columns };
      const moving = (next[fromStatus] || []).find((c) => c.bugId === bugId);
      if (!moving) return prev;
      next[fromStatus] = (next[fromStatus] || []).filter((c) => c.bugId !== bugId);
      next[target] = [...(next[target] || []), { ...moving, status: target }];
      return { ...prev, data: { ...prev.data, columns: next } };
    });
    setLanded(bugId);
    setTimeout(() => setLanded((id) => (id === bugId ? null : id)), 500);

    try {
      await moveBugStatus(projectKey, bugId, target);
      // Metrics move when work moves, so refresh them — but in the background,
      // keeping the card exactly where the user just put it.
      const refreshed = await load({ background: true });

      // Moving a card can change whether it still matches the active lens — e.g.
      // closing a bug resets its truth clock, so it is no longer "stale". The
      // filtering is correct, but a card that silently vanishes reads as data
      // loss. Say what happened instead.
      const lens = refreshed?.data?.lens;
      if (lens) {
        const present = Object.values(refreshed.data?.columns || {})
          .flat()
          .some((c) => c.bugId === bugId);
        if (!present) {
          showToast(`${bugId} moved to ${target} — it no longer matches the lens ${lens.label}.`, 'info');
        }
      }
    } catch (err) {
      setPayload(snapshot);
      showToast(err.response?.data?.error || 'Move failed — card restored');
    }
  };

  if (loading) return <SkeletonBoard label="Loading Strike Board" />;
  if (error) return <div className="empty-state"><h3>{error}</h3></div>;

  const truncated = payload?.data?.truncated;
  const degraded = payload?.meta?.degraded || [];
  const modules = Array.from(
    new Set(Object.values(columns).flat().map((c) => c.module).filter(Boolean))
  ).sort();
  const bottleneckStation = line?.data?.bottleneck?.station;
  const activeCard = activeId ? findCard(activeId)?.card : null;

  // Anything the server degraded that no instrument above has already spoken for.
  const CLAIMED = ['qualityTax', 'interrupt', 'board', 'gravity', 'fixVerifyGap', 'escaped'];
  const unclaimed = degraded.filter((entry) => !CLAIMED.includes(entry.metric));

  return (
    <div>
      {toast ? (
        <div className={`pulse-toast pulse-toast-${toast.tone}`} role="alert">
          <span>{toast.message}</span>
          <button
            type="button"
            className="pulse-toast-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            data-tip="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      <ShortcutSheet
        open={help}
        onClose={() => setHelp(false)}
        title="Strike Board"
        rows={[
          { keys: 'Tab', what: 'Move focus to a card' },
          { keys: 'Space', what: 'Pick the card up, then arrow keys to choose a column' },
          { keys: 'Space', what: 'Drop it — this saves the new status' },
          { keys: 'Esc', what: 'Cancel a pick-up, or close this panel' },
          { keys: 'r', what: 'Refresh the numbers' },
          { keys: '?', what: 'Show or hide this panel' }
        ]}
      />

      <p className="pulse-lede">
        Resolved is waiting for QA, not finished — drag to Closed when verified.
        That column has no card cap; the board only stops listing extras after 500 bugs (narrow the lens).
      </p>
      <LensBar lens={payload?.data?.lens} modules={modules} />

      <ReplayBar
        earliest={replayAllowed ? replay?.data?.earliest : null}
        at={rewound ? new Date(replayAt).toISOString() : replay?.data?.now}
        now={replay?.data?.now || new Date().toISOString()}
        busy={replayBusy}
        change={replay?.data?.change}
        degraded={(replay?.meta?.degraded || []).find((e) => e.metric === 'replay')}
        onChange={(ms) => setReplayAt(ms >= new Date(replay?.data?.now || Date.now()).getTime() - 60000 ? null : ms)}
        onReset={() => setReplayAt(null)}
      />

      {rewound ? null : truncated ? (
        <Degraded reason="More than 500 bugs here — narrow the lens above to see the board." />
      ) : (
        <>
          <QualityTax tax={payload?.data?.qualityTax} degraded={degraded} />
          <div className="pulse-inst-row">
            <InterruptRing interrupt={payload?.data?.interrupt} degraded={degraded} />
            <ReopenGravity gravity={payload?.data?.gravity} degraded={degraded} />
            <EscapedAndon escaped={payload?.data?.escaped} degraded={degraded} />
          </div>
        </>
      )}
      {unclaimed.map((entry) => (
        <Degraded key={entry.metric} reason={entry.reason} />
      ))}
      {!rewound && line ? <TheLine line={line} /> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(e.active.id)}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="pulse-board">
          {STATUSES.map((status) => {
            const dwell = dwellForColumn(status, line?.data?.stations);
            const chip = formatDwell(dwell?.medianMs);
            const bottleneck = columnIsBottleneck(status, bottleneckStation);
            const items = columns[status] || [];
            return (
              <DroppableColumn
                key={status}
                status={status}
                className={`pulse-column${bottleneck ? ' bottleneck' : ''}`}
              >
                <header className="pulse-column-head">
                  <h3 title={status === 'Resolved' ? 'Waiting for QA — not finished. No card cap. Drag to Closed when verified.' : undefined}>{status}</h3>
                  <span>{items.length}</span>
                  {status !== 'Closed' ? (
                    <span
                      className="pulse-dwell-chip"
                      title={chip
                        ? `Median dwell at this station${dwell?.p85MedianRatio >= 2 ? ' — p85/median is noisy' : ''}`
                        : 'No dwell yet'}
                    >
                      {chip || 'no dwell'}
                    </span>
                  ) : null}
                </header>
                <div className="pulse-column-body">
                  {items.map((item) => (
                    rewound ? (
                      <BugCard key={item.bugId} item={item} historical />
                    ) : (
                      <DraggableCard key={item.bugId} item={item} landed={landed === item.bugId} />
                    )
                  ))}
                </div>
              </DroppableColumn>
            );
          })}
        </div>

        {/* The card follows the pointer instead of the browser's ghost image. */}
        <DragOverlay dropAnimation={null}>
          {activeCard ? <BugCard item={activeCard} className="dragging-overlay" /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
