import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const chats = session?.user
    ? await prisma.chat.findMany({
        where: { userId: session.user.id, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true },
      })
    : [];

  return (
    <div className="flex flex-1">
      <ChatSidebar initialChats={chats} />
      {children}
    </div>
  );
}
