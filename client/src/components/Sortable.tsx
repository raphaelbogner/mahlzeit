import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  // Called with the new array order. The parent owns the state and is
  // responsible for committing the order.
  onReorder: (next: T[]) => void;
  children: ReactNode;
}

// Wraps a list of items with a DndContext + SortableContext. The children
// must contain SortableItem entries with matching ids. The parent owns the
// items array and updates it via onReorder.
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  children,
}: SortableListProps<T>) {
  const sensors = useSensors(
    // Tiny activation distance so a click on the handle isn't immediately
    // picked up as a drag — important on macOS trackpads.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent): void {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export interface SortableItemRenderProps {
  // Spread these on the drag handle (button or div) — they bind pointer/
  // keyboard handlers. Putting them only on the handle (not the whole row)
  // keeps inputs in the row clickable / typable.
  dragHandleProps: Record<string, unknown>;
  isDragging: boolean;
}

export interface SortableItemProps {
  id: string;
  children: (render: SortableItemRenderProps) => ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged item visually so it overlaps siblings.
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </div>
  );
}

// Standard grip-handle button used as the drag handle in editor rows.
// Pass the dragHandleProps from SortableItem onto this.
export function DragHandle({
  handleProps,
  label = 'Verschieben',
  className = '',
}: {
  handleProps: Record<string, unknown>;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      {...handleProps}
      className={
        'grid h-7 w-5 shrink-0 cursor-grab touch-none place-items-center rounded text-stone-400 transition hover:text-stone-700 active:cursor-grabbing ' +
        className
      }
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true" className="leading-none select-none">
        ⠿
      </span>
    </button>
  );
}
