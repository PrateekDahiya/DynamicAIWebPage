"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageBubble, type ChatRole } from "./message-bubble";
import { Composer } from "./composer";

type ChatMessage = { id: string; role: ChatRole; content: string };

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

export function ChatWindow({
  chatId,
  initialMessages,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
