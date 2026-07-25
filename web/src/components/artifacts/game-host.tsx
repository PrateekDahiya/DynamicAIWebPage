"use client";

import { useEffect, useRef, useState } from "react";

type MountFn = (container: HTMLElement, ctx: { mode: string; config: unknown }) => void;

// Bridges the ported vanilla game engines (public/games/*.js — a plain
// `export function mount(container, { mode, config })` contract) into a React page. A dynamic,
// fully-runtime import() of an absolute /games/ URL is never bundled/traced by webpack/Turbopack
// (it isn't part of the src module graph), so this works identically for both built-in games
// shipped in public/ and, later, AI-generated ones served from their own route.
export function GameHost({
  slug,
  mode,
  config,
}: {
  slug: string;
  mode: string;
  config: unknown;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    setError(null);

    async function load() {
      try {
        const mod = (await import(/* webpackIgnore: true */ `/games/${slug}.js`)) as {
          mount: MountFn;
        };
        if (cancelled || !container) return;
        container.innerHTML = "";
        mod.mount(container, { mode, config });
      } catch (err) {
        console.error("Failed to load game module:", err);
        if (!cancelled) setError("Couldn't load this game's code — it may have failed to generate correctly.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, mode, config]);

  if (error) {
    return <p className="ttt-status text-destructive">{error}</p>;
  }

  return <div ref={containerRef} className="game-mount-row" />;
}
