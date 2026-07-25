import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getArtifactWithVersions } from "@/lib/artifacts/store";

export const runtime = "nodejs";

function summarizeConfig(config: Record<string, unknown>): string {
  return Object.entries(config)
    .filter(([key]) => key !== "theme")
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(", ");
}

// Creates a fresh chat pre-seeded with a message naming the artifact being edited, so a
// follow-up like "make it bigger" has an unambiguous, nearby signal for which slug to target —
// instead of landing on whatever chat happened to be most recently updated with no context.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const version = typeof body?.version === "string" ? body.version : null;
  if (!slug || !version) {
    return NextResponse.json({ error: "slug and version are required" }, { status: 400 });
  }

  const artifact = await getArtifactWithVersions(session.user.id, slug);
  const entry = artifact?.versions.find((v) => v.version === version);
  if (!artifact || !entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chat = await prisma.chat.create({
    data: { userId: session.user.id, title: `Editing ${artifact.title}` },
  });

  const config = JSON.parse(entry.config);
  const seedMessage = `You're now editing **${artifact.title}** (${artifact.category.toLowerCase()}). Current version: \`${entry.version}\` (${entry.label}). Config: ${summarizeConfig(config)}. Tell me what you'd like to change — e.g. "make the board bigger" or "give it a neon theme" — and I'll create a new version.`;

  await prisma.message.create({
    data: { chatId: chat.id, role: "assistant", content: seedMessage },
  });

  return NextResponse.json({ chatId: chat.id });
}
