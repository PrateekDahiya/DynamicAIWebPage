"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AppCard =
  | { kind: "link"; id: string; title: string; url: string; version: string; label?: string }
  | { kind: "pending"; id: string; jobId: string; title: string }
  | { kind: "error"; id: string; title: string; message: string };

type ResolvedCard = Extract<AppCard, { kind: "link" | "error" }>;

function ResolvedCardView({ card }: { card: ResolvedCard }) {
  if (card.kind === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Couldn&apos;t build &quot;{card.title}&quot;: {card.message}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
      <div className="text-sm">
        <p className="font-medium">{card.title}</p>
        {card.label && (
          <p className="font-mono text-xs text-muted-foreground">
            {card.version} · {card.label}
          </p>
        )}
      </div>
      <Button size="sm" render={<Link href={card.url} target="_blank" rel="noopener" />} className="gap-1.5">
        Play
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
}

function PendingCardView({ jobId, title }: { jobId: string; title: string }) {
  const [resolved, setResolved] = useState<ResolvedCard | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/artifacts/jobs/${jobId}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "done") {
          setResolved({ kind: "link", id: jobId, title: data.title ?? title, url: data.url, version: "v0" });
          return;
        }
        if (data.status === "failed") {
          setResolved({ kind: "error", id: jobId, title: data.title ?? title, message: data.message });
          return;
        }
      } catch {
        // keep polling — a transient fetch failure shouldn't give up on a multi-minute job
      }
      timeout = setTimeout(poll, 3000);
    }

    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [jobId, title]);

  if (resolved) return <ResolvedCardView card={resolved} />;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 shrink-0 animate-spin" />
      <span>
        Building &quot;{title}&quot;… this can take a couple of minutes on a local model.
      </span>
    </div>
  );
}

export function AppActionCard({ card }: { card: AppCard }) {
  if (card.kind === "pending") return <PendingCardView jobId={card.jobId} title={card.title} />;
  return <ResolvedCardView card={card} />;
}
