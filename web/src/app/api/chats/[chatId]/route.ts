import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

async function loadOwnedChat(chatId: string, userId: string) {
  return prisma.chat.findFirst({ where: { id: chatId, userId, deletedAt: null } });
}

export async function GET(_req: Request, context: { params: Promise<{ chatId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await context.params;
  const chat = await loadOwnedChat(chatId, session.user.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latestTheme = await prisma.theme.findFirst({
    where: { chatId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    theme: latestTheme
      ? {
          vars: latestTheme.vars ? JSON.parse(latestTheme.vars) : null,
          background: latestTheme.background ? JSON.parse(latestTheme.background) : null,
          animation: latestTheme.animation ? JSON.parse(latestTheme.animation) : null,
        }
      : null,
  });
}

export async function PATCH(req: Request, context: { params: Promise<{ chatId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await context.params;
  const chat = await loadOwnedChat(chatId, session.user.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 100) : null;
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const updated = await prisma.chat.update({ where: { id: chatId }, data: { title } });
  return NextResponse.json({ id: updated.id, title: updated.title });
}

export async function DELETE(_req: Request, context: { params: Promise<{ chatId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await context.params;
  const chat = await loadOwnedChat(chatId, session.user.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.chat.update({ where: { id: chatId }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
