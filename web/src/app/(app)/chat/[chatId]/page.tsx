import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChatWindow } from "@/components/chat/chat-window";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const session = await auth();
  const { chatId } = await params;
  if (!session?.user) notFound();

  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id, deletedAt: null },
  });
  if (!chat) notFound();

  const [messages, latestTheme] = await Promise.all([
    prisma.message.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } }),
    prisma.theme.findFirst({ where: { chatId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <ChatWindow
      chatId={chatId}
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        actions: m.actionsJson ? JSON.parse(m.actionsJson) : [],
      }))}
      initialTheme={
        latestTheme
          ? {
              vars: latestTheme.vars ? JSON.parse(latestTheme.vars) : null,
              background: latestTheme.background ? JSON.parse(latestTheme.background) : null,
              animation: latestTheme.animation ? JSON.parse(latestTheme.animation) : null,
            }
          : null
      }
    />
  );
}
