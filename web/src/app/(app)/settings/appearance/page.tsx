"use client";

import { useEffect, useState } from "react";
import { useThemeStore } from "@/stores/theme-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const FIELDS: { key: string; label: string }[] = [
  { key: "--background", label: "Background" },
  { key: "--foreground", label: "Text" },
  { key: "--card", label: "Card background" },
  { key: "--primary", label: "Primary (buttons)" },
  { key: "--accent", label: "Accent (hover/highlight)" },
];

function toColorInputValue(v: string | undefined) {
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#888888";
}

export default function AppearancePage() {
  const vars = useThemeStore((s) => s.vars);
  const setTheme = useThemeStore((s) => s.setTheme);
  const reset = useThemeStore((s) => s.reset);
  const activeChatId = useThemeStore((s) => s.activeChatId);

  const [localVars, setLocalVars] = useState<Record<string, string>>({});
  const [chatId, setChatId] = useState<string | null>(activeChatId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalVars(vars);
  }, [vars]);

  useEffect(() => {
    if (activeChatId) {
      setChatId(activeChatId);
      return;
    }
    // No chat visited yet this session — fall back to the most recently updated one.
    fetch("/api/chats")
      .then((r) => r.json())
      .then((data) => setChatId(data.chats?.[0]?.id ?? null));
  }, [activeChatId]);

  async function persist(type: "SET_THEME" | "RESET_THEME", payload?: Record<string, unknown>) {
    if (!chatId) return;
    setSaving(true);
    try {
      await fetch(`/api/chats/${chatId}/theme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...payload }),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleApply() {
    setTheme({ vars: localVars, background: null, animation: null });
    void persist("SET_THEME", { vars: localVars });
  }

  function handleReset() {
    reset();
    void persist("RESET_THEME");
  }

  return (
    <div className="mx-auto max-w-xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">Appearance</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manually adjust the theme — the same one the AI can change from chat.
        {!chatId && " Open or start a chat first to save changes."}
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Theme colors</CardTitle>
          <CardDescription>Changes preview instantly and apply to the whole app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-4">
              <Label htmlFor={field.key}>{field.label}</Label>
              <input
                id={field.key}
                type="color"
                className="h-8 w-16 cursor-pointer rounded border"
                value={toColorInputValue(localVars[field.key])}
                onChange={(e) =>
                  setLocalVars((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleApply} disabled={saving || !chatId}>
              Apply
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={saving || !chatId}>
              Reset to default
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
