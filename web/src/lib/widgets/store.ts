import { prisma } from "@/lib/db";
import { WIDGET_TITLES, type WidgetId } from "./registry";

export async function listActiveWidgets(chatId: string) {
  const widgets = await prisma.widget.findMany({
    where: { chatId, removedAt: null },
    orderBy: { order: "asc" },
  });
  return widgets.map((w) => ({
    id: w.id,
    widgetId: w.widgetId,
    title: WIDGET_TITLES[w.widgetId as WidgetId] ?? w.widgetId,
    props: w.props ? JSON.parse(w.props) : {},
    order: w.order,
    size: w.size,
  }));
}

export async function createWidget(chatId: string, widgetId: WidgetId, props: Record<string, unknown>) {
  const maxOrder = await prisma.widget.aggregate({
    where: { chatId, removedAt: null },
    _max: { order: true },
  });

  const widget = await prisma.widget.create({
    data: {
      chatId,
      widgetId,
      props: Object.keys(props).length ? JSON.stringify(props) : null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return { id: widget.id, widgetId, title: WIDGET_TITLES[widgetId], props, order: widget.order, size: widget.size };
}

// Updates the most recently created active widget of this type in the chat (there's normally at
// most one of each kind visible at a time, matching the original app's single-instance widgets).
export async function updateWidget(chatId: string, widgetId: WidgetId, props: Record<string, unknown>) {
  const existing = await prisma.widget.findFirst({
    where: { chatId, widgetId, removedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) return createWidget(chatId, widgetId, props);

  const prevProps = existing.props ? JSON.parse(existing.props) : {};
  const mergedProps = { ...prevProps, ...props };

  const updated = await prisma.widget.update({
    where: { id: existing.id },
    data: { props: JSON.stringify(mergedProps) },
  });

  return {
    id: updated.id,
    widgetId,
    title: WIDGET_TITLES[widgetId],
    props: mergedProps,
    order: updated.order,
    size: updated.size,
  };
}

export async function removeWidget(chatId: string, widgetId: string) {
  await prisma.widget.updateMany({
    where: { chatId, widgetId, removedAt: null },
    data: { removedAt: new Date() },
  });
  return { widgetId };
}

export async function reorderWidgets(chatId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.widget.update({ where: { id }, data: { order: index } })
    )
  );
}
