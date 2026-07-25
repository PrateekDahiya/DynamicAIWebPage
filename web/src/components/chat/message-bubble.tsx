"use client";

import { useState } from "react";
import { Copy, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";

export type ChatRole = "user" | "assistant" | "system";

export function MessageBubble({
  role,
  content,
  onRegenerate,
  isLast,
  isStreaming,
}: {
  role: ChatRole;
  content: string;
  onRegenerate?: () => void;
  isLast?: boolean;
  isStreaming?: boolean;
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
