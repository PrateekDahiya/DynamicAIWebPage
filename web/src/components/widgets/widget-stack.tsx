"use client";

import { GripVertical, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { useWidgetStore, type WidgetItem } from "@/stores/widget-store";
import { WidgetHost } from "./widget-host";

function SortableWidgetCard({ widget, onRemove }: { widget: WidgetItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-lg border bg-card p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
          <span className="text-sm font-medium">{widget.title}</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onRemove}>
          <X className="size-3.5" />
        </Button>
      </div>
      <WidgetHost widgetId={widget.widgetId} props={widget.props} />
    </div>
  );
}

export function WidgetStack({ chatId }: { chatId: string }) {
  const widgets = useWidgetStore((s) => s.widgets);
  const reorder = useWidgetStore((s) => s.reorder);
  const removeWidgetFromStore = useWidgetStore((s) => s.removeWidget);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (widgets.length === 0) return null;

  async function persistOrder(next: WidgetItem[]) {
    await fetch(`/api/chats/${chatId}/widgets/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((w) => w.id) }),
    });
  }

  async function handleRemove(widget: WidgetItem) {
    removeWidgetFromStore(widget.widgetId);
    await fetch(`/api/chats/${chatId}/widgets/${widget.widgetId}`, { method: "DELETE" });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    const next = arrayMove(widgets, oldIndex, newIndex);
    reorder(next);
    void persistOrder(next);
  }

  return (
    <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-l p-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
          {widgets.map((widget) => (
            <SortableWidgetCard key={widget.id} widget={widget} onRemove={() => handleRemove(widget)} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
