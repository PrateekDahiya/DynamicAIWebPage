"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type ChatSummary = { id: string; title: string };

export function ChatSidebar({ initialChats }: { initialChats: ChatSummary[] }) {
  const router = useRouter();
  const params = useParams<{ chatId?: string }>();
  const [chats, setChats] = useState(initialChats);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatSummary | null>(null);

  async function handleNewChat() {
    const res = await fetch("/api/chats", { method: "POST" });
    const chat = await res.json();
    setChats((prev) => [{ id: chat.id, title: chat.title }, ...prev]);
    router.push(`/chat/${chat.id}`);
  }

  function startRename(chat: ChatSummary) {
    setEditingId(chat.id);
    setEditValue(chat.title);
  }

  async function commitRename(chatId: string) {
    const title = editValue.trim();
    setEditingId(null);
    if (!title) return;

    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title } : c)));
    await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setChats((prev) => prev.filter((c) => c.id !== target.id));

    await fetch(`/api/chats/${target.id}`, { method: "DELETE" });

    if (params.chatId === target.id) {
      router.push("/chat");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r">
      <div className="p-2">
        <Button variant="outline" className="w-full justify-start gap-2" onClick={handleNewChat}>
          <Plus className="size-4" />
          New chat
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {chats.map((chat) => {
          const isActive = params.chatId === chat.id;
          const isEditing = editingId === chat.id;

          return (
            <div
              key={chat.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                isActive ? "bg-muted" : "hover:bg-muted/50"
              )}
            >
              {isEditing ? (
                <>
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(chat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-7"
                  />
                  <Button variant="ghost" size="icon-xs" onClick={() => commitRename(chat.id)}>
                    <Check className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => setEditingId(null)}>
                    <X className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Link href={`/chat/${chat.id}`} className="flex-1 truncate">
                    {chat.title}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => startRename(chat)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => setDeleteTarget(chat)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.title}&quot; will be removed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
