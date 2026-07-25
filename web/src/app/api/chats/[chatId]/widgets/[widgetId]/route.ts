import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { removeWidget } from "@/lib/widgets/store";

export const runtime = "nodejs";

export async function DELETE(_req: Request, context: { params: Promise<{ chatId: string; widgetId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId, widgetId } = await context.params;
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId: session.user.id, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await removeWidget(chatId, widgetId);
  return NextResponse.json({ ok: true });
}
