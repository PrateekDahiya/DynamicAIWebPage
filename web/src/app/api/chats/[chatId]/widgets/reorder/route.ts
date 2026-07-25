import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reorderWidgets } from "@/lib/widgets/store";

export const runtime = "nodejs";

export async function PATCH(req: Request, context: { params: Promise<{ chatId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await context.params;
  const chat = await prisma.chat.findFirst({ where: { id: chatId, userId: session.user.id, deletedAt: null } });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.filter((id: unknown) => typeof id === "string") : [];
  if (!orderedIds.length) return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });

  // Only reorder widgets that actually belong to this chat — defense against a tampered payload.
  const owned = await prisma.widget.findMany({ where: { chatId, id: { in: orderedIds } }, select: { id: true } });
  const ownedIds = new Set(owned.map((w) => w.id));
  const safeOrderedIds = orderedIds.filter((id: string) => ownedIds.has(id));

  await reorderWidgets(chatId, safeOrderedIds);
  return NextResponse.json({ ok: true });
}
