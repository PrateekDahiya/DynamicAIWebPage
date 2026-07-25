import { create } from "zustand";

export type WidgetItem = {
  id: string;
  widgetId: string;
  title: string;
  props: Record<string, unknown>;
  order: number;
  size?: string;
};

type WidgetState = {
  widgets: WidgetItem[];
  setWidgets: (widgets: WidgetItem[]) => void;
  upsertWidget: (widget: WidgetItem) => void;
  removeWidget: (widgetId: string) => void;
  reorder: (widgets: WidgetItem[]) => void;
};

export const useWidgetStore = create<WidgetState>((set) => ({
  widgets: [],
  setWidgets: (widgets) => set({ widgets: [...widgets].sort((a, b) => a.order - b.order) }),
  upsertWidget: (widget) =>
    set((state) => {
      const others = state.widgets.filter((w) => w.widgetId !== widget.widgetId);
      return { widgets: [...others, widget].sort((a, b) => a.order - b.order) };
    }),
  removeWidget: (widgetId) =>
    set((state) => ({ widgets: state.widgets.filter((w) => w.widgetId !== widgetId) })),
  reorder: (widgets) => set({ widgets }),
}));
