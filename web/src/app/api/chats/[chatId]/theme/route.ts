import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeActions } from "@/lib/action-schema";
import { resolveThemeActions } from "@/lib/theme-resolver";

export const runtime = "nodejs";

// Manual theme editing (e.g. from /settings/appearance) goes through the exact same
// sanitize+resolve pipeline as an AI-driven SET_THEME/UPDATE_THEME/RESET_THEME action, so both
// entry points share one source of truth for what's valid and how versions are recorded.
export async function POST(req: Request, context: { params: Promise<{ chatId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await context.params;
  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id, deletedAt: null },
  });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = { type: body?.type, vars: body?.vars, background: body?.background, animation: body?.animation };
  const [sanitized] = sanitizeActions([action]);
  if (!sanitized) return NextResponse.json({ error: "Invalid theme action" }, { status: 400 });

  const [resolved] = await resolveThemeActions(chatId, [sanitized]);
  return NextResponse.json({ action: resolved });
}
