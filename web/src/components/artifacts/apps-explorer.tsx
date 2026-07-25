"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ArtifactSummary = {
  slug: string;
  title: string;
  description: string | null;
  category: string;
  version: string;
  label: string;
  updatedAt: string;
  url: string;
};

const CATEGORIES = ["ALL", "GAME", "TOOL", "UTILITY", "DASHBOARD", "EDITOR"];

export function AppsExplorer({ artifacts }: { artifacts: ArtifactSummary[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");

  const filtered = useMemo(() => {
    return artifacts
      .filter((a) => category === "ALL" || a.category === category)
      .filter((a) => a.title.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [artifacts, query, category]);

  return (
    <div className="flex-1 p-6">
      <h1 className="text-2xl font-semibold">My Apps</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Games and tools you've created or opened from chat.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search apps…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList>
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c}>
                {c === "ALL" ? "All" : c.charAt(0) + c.slice(1).toLowerCase()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {artifacts.length === 0
            ? "No apps yet — ask the chat to open a game to get started."
            : "No apps match your search."}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.slug} href={a.url}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <Badge variant="secondary">{a.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p className="line-clamp-2">{a.description}</p>
                  <p className="font-mono text-xs opacity-60">
                    {a.version} · {a.label}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
