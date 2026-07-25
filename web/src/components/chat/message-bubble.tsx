"use client";

import { useState } from "react";
import { Copy, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { AppActionCard, type AppCard } from "./app-action-card";
import { cn } from "@/lib/utils";

export type ChatRole = "user" | "assistant" | "system";

export function MessageBubble({
  role,
  content,
  onRegenerate,
  isLast,
  isStreaming,
  appCards,
}: {
  role: ChatRole;
  content: string;
  onRegenerate?: () => void;
  isLast?: boolean;
  isStreaming?: boolean;
  appCards?: AppCard[];
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isUser = role === "user";

  return (
    <div className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-2.5 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <Markdown content={content || "…"} />
        )}
      </div>

      {!isUser && appCards && appCards.length > 0 && (
        <div className="flex w-full max-w-[85%] flex-col gap-2">
          {appCards.map((card) => (
            <AppActionCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {!isUser && content && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={handleCopy} title="Copy">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
          {isLast && onRegenerate && !isStreaming && (
            <Button variant="ghost" size="icon-sm" onClick={onRegenerate} title="Regenerate">
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
