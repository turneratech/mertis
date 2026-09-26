import React from 'react';

/**
 * Loading states were four copies of the string "Loading X…". A skeleton keeps
 * the layout stable so the page does not jump when data lands.
 */
export function Skeleton({ width = '100%', height = '1rem', radius = 'var(--p-r-sm)' }) {
  return <span className="pulse-skel" style={{ width, height, borderRadius: radius }} />;
}

export function SkeletonInstrument() {
  return (
    <div className="pulse-inst pulse-inst-instrument pulse-skel-inst">
      <Skeleton width="7rem" height="0.7rem" />
      <Skeleton width="60%" height="1.1rem" />
    </div>
  );
}

/**
 * A stand-in for the Strike Board: five columns of cards, so the real board
 * lands in roughly the same place rather than shifting the page.
 */
export function SkeletonBoard({ columns = 5, cards = 3, label = 'Loading' }) {
  return (
    <div className="pulse-skel-board" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: columns }).map((_, col) => (
        <div className="pulse-skel-col" key={col} aria-hidden="true">
          <Skeleton width="55%" height="0.8rem" />
          {Array.from({ length: cards }).map((__, card) => (
            <Skeleton key={card} height="3.4rem" radius="var(--p-r-md)" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4, label = 'Loading' }) {
  return (
    <div className="pulse-skel-list" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="2.6rem" radius="var(--p-r-md)" />
      ))}
    </div>
  );
}
