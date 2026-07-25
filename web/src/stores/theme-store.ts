import { create } from "zustand";

export type ThemeBackground = { type: "solid" | "gradient"; value: string };
export type ThemeAnimation = { target: string; effect: string; intensity: number };

type ThemeState = {
  vars: Record<string, string>;
  background: ThemeBackground | null;
  animation: ThemeAnimation | null;
  activeChatId: string | null;
  setTheme: (theme: {
    vars?: Record<string, string> | null;
    background?: ThemeBackground | null;
    animation?: ThemeAnimation | null;
  }) => void;
  reset: () => void;
  setActiveChatId: (id: string | null) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  vars: {},
  background: null,
  animation: null,
  activeChatId: null,
  setTheme: (theme) =>
    set({
      vars: theme.vars ?? {},
      background: theme.background ?? null,
      animation: theme.animation ?? null,
    }),
  reset: () => set({ vars: {}, background: null, animation: null }),
  setActiveChatId: (id) => set({ activeChatId: id }),
}));
