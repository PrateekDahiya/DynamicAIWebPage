"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Composer({
  onSend,
  onStop,
  isStreaming,
}: {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t bg-background p-4">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Send a message…"
        rows={1}
        className="max-h-40 min-h-10 flex-1 resize-none"
      />
      {isStreaming ? (
        <Button variant="secondary" size="icon" onClick={onStop} title="Stop generating">
          <Square className="size-4" />
        </Button>
      ) : (
        <Button size="icon" onClick={handleSend} disabled={!value.trim()} title="Send">
          <Send className="size-4" />
        </Button>
      )}
    </div>
  );
}
