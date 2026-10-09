/**
 * shared/SortableStatGrid.jsx — the admin dashboard's figure cards, which can be dragged
 * into a different order (small ⠿⠿ handle in each card's corner).
 * In its own file so the drag-and-drop library (@dnd-kit) is only downloaded by admins
 * when the dashboard is shown (App.jsx loads this with React.lazy).
 */
import React from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Only the small handle in the corner starts a drag — the rest of the card keeps its own
// onClick. Defined at module scope so useSortable is called once per rendered card.
function SortableStatCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : "auto",
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <span
        {...listeners}
        title="Drag to reorder"
        style={{ position: "absolute", top: 10, right: 10, zIndex: 5, cursor: "grab", fontSize: 13, color: "var(--zp-drag-handle, rgba(255,255,255,0.35))", userSelect: "none", touchAction: "none", padding: "4px 6px", lineHeight: 1 }}
      >⠿⠿</span>
      {children}
    </div>
  );
}

/** order: card ids in display order; nodeById: id → card element; onReorder(newOrder). */
export default function SortableStatGrid({ order, nodeById, onReorder, gridStyle }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(order, order.indexOf(active.id), order.indexOf(over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div style={gridStyle}>
          {order.map(id => <SortableStatCard key={id} id={id}>{nodeById[id]}</SortableStatCard>)}
        </div>
      </SortableContext>
    </DndContext>
  );
}
