"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GameHost } from "./game-host";

type VersionSummary = { version: string; label: string };

type ArtifactConfig = {
  theme?: Record<string, string>;
  [key: string]: unknown;
};

const MODE_META: Record<string, { label: string; icon: typeof Bot }> = {
  bot: { label: "Play vs Bot", icon: Bot },
  multiplayer: { label: "Multiplayer (same device)", icon: Users },
};

function themeToCssVars(theme: Record<string, string> | undefined): React.CSSProperties {
  if (!theme) return {};
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) {
    vars[`--game-${key}`] = value;
  }
  return vars as React.CSSProperties;
}

export function ArtifactPlayer({
  slug,
  title,
  description,
  modes,
  version,
  label,
  config,
  versions,
  isBuiltIn,
}: {
  slug: string;
  category: string;
  title: string;
  description: string | null;
  modes: string[];
  version: string;
  label: string;
  config: ArtifactConfig;
  versions: VersionSummary[];
  isBuiltIn: boolean;
}) {
  const [mode, setMode] = useState<string | null>(modes.length === 1 ? modes[0] : null);
  const themeStyle = useMemo(() => themeToCssVars(config.theme), [config.theme]);
  const moduleUrl = isBuiltIn ? `/games/${slug}.js` : `/api/artifacts/${slug}/versions/${version}/code`;

  if (mode) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 p-6" style={themeStyle}>
        <div className="mb-5 flex items-center justify-between border-b pb-4">
          <Button variant="ghost" size="sm" onClick={() => setMode(null)} className="gap-1.5">
            <ArrowLeft className="size-4" />
            Menu
          </Button>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {MODE_META[mode]?.label ?? mode}
          </span>
        </div>
        <GameHost moduleUrl={moduleUrl} mode={mode} config={config} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">
          {version} · {label}
        </span>
        {versions.length > 1 && (
          <Select
            value={version}
            onValueChange={(v) => {
              window.location.href = `/apps/${slug}/${v}`;
            }}
          >
            <SelectTrigger size="sm" className="h-6 w-auto text-xs">
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              {versions
                .slice()
                .reverse()
                .map((v) => (
                  <SelectItem key={v.version} value={v.version}>
                    {v.version} — {v.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        {modes.map((m) => {
          const meta = MODE_META[m] ?? { label: m, icon: Bot };
          const Icon = meta.icon;
          return (
            <Button key={m} size="lg" className="flex-1 gap-2" onClick={() => setMode(m)}>
              <Icon className="size-4" />
              {meta.label}
            </Button>
          );
        })}
      </div>

      <Button variant="link" size="sm" className="mt-6" render={<Link href="/chat" />}>
        Continue editing in chat
      </Button>

      {versions.length > 1 && (
        <div className="mt-8 w-full text-left">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Changelog
          </h2>
          <ul className="mt-2 space-y-1">
            {versions
              .slice()
              .reverse()
              .map((v) => (
                <li key={v.version} className="text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{v.version}</span> — {v.label}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
