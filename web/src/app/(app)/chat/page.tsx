import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function ChatIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const existing = await prisma.chat.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  const chat =
    existing ?? (await prisma.chat.create({ data: { userId: session.user.id, title: "New chat" } }));

  redirect(`/chat/${chat.id}`);
}
