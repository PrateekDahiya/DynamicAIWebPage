export const WIDGET_IDS = ["calculator", "timer", "todo", "chart", "notes"] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];

export const WIDGET_TITLES: Record<WidgetId, string> = {
  calculator: "Calculator",
  timer: "Timer",
  todo: "To-Do List",
  chart: "Chart",
  notes: "Notes",
};

export function isKnownWidget(id: string): id is WidgetId {
  return (WIDGET_IDS as readonly string[]).includes(id);
}
