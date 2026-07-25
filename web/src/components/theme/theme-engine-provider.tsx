"use client";

import { useEffect, useRef } from "react";
import { useThemeStore } from "@/stores/theme-store";

// Applies the AI-driven theme store to the live page as CSS custom properties + background,
// with a smooth transition — the same "AI changes drive CSS vars" mechanism as the original
// vanilla app's applySetTheme, just sourced from React state instead of being the source of truth.
export function ThemeEngineProvider({ children }: { children: React.ReactNode }) {
  const vars = useThemeStore((s) => s.vars);
  const background = useThemeStore((s) => s.background);
  const appliedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const root = document.documentElement;
    const nextKeys = new Set(Object.keys(vars));

    for (const key of appliedKeys.current) {
      if (!nextKeys.has(key)) root.style.removeProperty(key);
    }
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    appliedKeys.current = nextKeys;
  }, [vars]);

  useEffect(() => {
    document.body.style.background = background?.value ?? "";
  }, [background]);

  return <>{children}</>;
}
