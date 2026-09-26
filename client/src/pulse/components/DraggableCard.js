import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { BugCard } from './BugCard';

/**
 * Cards and columns for the Strike Board.
 *
 * Native HTML5 drag-and-drop does not fire on touch at all, so the board was
 * read-only on every phone and tablet. dnd-kit uses pointer events, and its
 * KeyboardSensor gives the board a real keyboard path for the first time.
 */
export function DraggableCard({ item, landed }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.bugId,
    data: { status: item.status }
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="pulse-card-handle">
      <BugCard
        item={item}
        className={`${isDragging ? 'dragging' : ''} ${landed ? 'landed' : ''}`.trim()}
      />
    </div>
  );
}

export function DroppableColumn({ status, children, className }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`${className}${isOver ? ' drop-target' : ''}`}>
      {children}
    </section>
  );
}
