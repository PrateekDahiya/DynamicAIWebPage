"use client";

import { useEffect, useRef, useState } from "react";

type MountFn = (container: HTMLElement, props: Record<string, unknown>) => void;

// Same bridge pattern as GameHost — ports the original app's public/js/widgets/*.js
// (calculator/timer/todo/chart/notes, each a plain `export function mount(container, props)`)
// into React via a dynamic runtime import of the static /widgets/<id>.js URL.
export function WidgetHost({ widgetId, props }: { widgetId: string; props: Record<string, unknown> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    setError(false);

    async function load() {
      try {
        const mod = (await import(/* webpackIgnore: true */ `/widgets/${widgetId}.js`)) as {
          mount: MountFn;
        };
        if (cancelled || !container) return;
        container.innerHTML = "";
        mod.mount(container, props);
      } catch (err) {
        console.error("Failed to load widget module:", err);
        if (!cancelled) setError(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // Remount (and re-mount the underlying vanilla widget) when props genuinely change content,
    // not on every re-render — e.g. UPDATE_WIDGET changing the timer's duration should restart
    // it with the new value, but unrelated parent re-renders shouldn't reset widget state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, JSON.stringify(props)]);

  if (error) return <p className="text-sm text-destructive">Couldn&apos;t load this widget.</p>;
  return <div ref={containerRef} />;
}
