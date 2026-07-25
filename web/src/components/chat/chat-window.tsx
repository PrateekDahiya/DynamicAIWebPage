"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageBubble, type ChatRole } from "./message-bubble";
import { Composer } from "./composer";
import type { AppCard } from "./app-action-card";
import { useThemeStore, type ThemeBackground, type ThemeAnimation } from "@/stores/theme-store";

type ChatMessage = { id: string; role: ChatRole; content: string; appCards?: AppCard[] };
type ThemeState = {
  vars: Record<string, string> | null;
  background: ThemeBackground | null;
  animation: ThemeAnimation | null;
};
type ResolvedAction =
  | { type: "RESET_THEME" }
  | { type: "SET_THEME" | "UPDATE_THEME"; vars?: Record<string, string>; background?: ThemeBackground; animation?: ThemeAnimation }
  | { type: "CREATE_APP" | "OPEN_APP" | "UPDATE_APP"; title: string; url: string; version: string; label?: string }
  | { type: "APP_GENERATION_PENDING"; jobId: string; slug: string; title: string }
  | { type: "APP_ACTION_FAILED"; slug: string; message: string };

function parseSSEChunk(raw: string): { event: string; data: unknown }[] {
  return raw
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
      const event = eventLine?.slice("event:".length).trim() ?? "message";
      const data = dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : {};
      return { event, data };
    });
}

// Converts persisted/streamed resolved actions into renderable app-launch cards; theme actions
// are handled separately (they drive the theme store, not the message UI).
function toAppCards(actions: ResolvedAction[], keyPrefix: string): AppCard[] {
  const cards: AppCard[] = [];
  actions.forEach((action, i) => {
    const id = `${keyPrefix}-${i}`;
    if (action.type === "CREATE_APP" || action.type === "OPEN_APP" || action.type === "UPDATE_APP") {
      cards.push({ kind: "link", id, title: action.title, url: action.url, version: action.version, label: action.label });
    } else if (action.type === "APP_GENERATION_PENDING") {
      cards.push({ kind: "pending", id, jobId: action.jobId, title: action.title });
    } else if (action.type === "APP_ACTION_FAILED") {
      cards.push({ kind: "error", id, title: action.slug, message: action.message });
    }
  });
  return cards;
}

export function ChatWindow({
  chatId,
  initialMessages,
  initialTheme,
}: {
  chatId: string;
  initialMessages: { id: string; role: ChatRole; content: string; actions: ResolvedAction[] }[];
  initialTheme: ThemeState | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      appCards: toAppCards(m.actions, m.id),
    }))
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const setActiveChatId = useThemeStore((s) => s.setActiveChatId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const resetTheme = useThemeStore((s) => s.reset);

  // Each chat has its own living theme (Theme rows are chatId-scoped) — hydrate the shared
  // theme store whenever the active chat changes, so switching conversations switches the look.
  useEffect(() => {
    setActiveChatId(chatId);
    if (initialTheme) setTheme(initialTheme);
    else resetTheme();
  }, [chatId, initialTheme, setActiveChatId, setTheme, resetTheme]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function applyResolvedActions(assistantId: string, actions: ResolvedAction[]) {
    const themeActions = actions.filter(
      (a): a is Extract<ResolvedAction, { type: "SET_THEME" | "UPDATE_THEME" | "RESET_THEME" }> =>
        a.type === "SET_THEME" || a.type === "UPDATE_THEME" || a.type === "RESET_THEME"
    );
    for (const action of themeActions) {
      if (action.type === "RESET_THEME") resetTheme();
      else setTheme({ vars: action.vars, background: action.background, animation: action.animation });
    }

    const appCards = toAppCards(actions, assistantId);
    if (appCards.length) {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, appCards: [...(m.appCards ?? []), ...appCards] } : m))
      );
    }
  }

  async function runStream(body: Record<string, unknown>) {
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, ...body }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: data.error || "Something went wrong." } : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parseSSEChunk(parts.join("\n\n"))) {
          if (part.event === "token") {
            const text = (part.data as { text: string }).text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m))
            );
          } else if (part.event === "error") {
            const message = (part.data as { message: string }).message;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: message } : m))
            );
          } else if (part.event === "actions") {
            const actions = (part.data as { actions: ResolvedAction[] }).actions;
            applyResolvedActions(assistantId, actions);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Could not reach the server." } : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      router.refresh();
    }
  }

  function handleSend(message: string) {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: message }]);
    void runStream({ message });
  }

  function handleRegenerate() {
    setMessages((prev) => {
      const withoutLastAssistant = [...prev];
      if (withoutLastAssistant[withoutLastAssistant.length - 1]?.role === "assistant") {
        withoutLastAssistant.pop();
      }
      return withoutLastAssistant;
    });
    void runStream({ regenerate: true });
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Send a message to get started.
            </p>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              appCards={m.appCards}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming}
              onRegenerate={m.role === "assistant" ? handleRegenerate : undefined}
            />
          ))}
          <div ref={scrollRef} />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <Composer onSend={handleSend} onStop={handleStop} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
