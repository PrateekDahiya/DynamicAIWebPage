import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getArtifactWithVersions } from "@/lib/artifacts/store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string; version: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, version } = await context.params;
  const artifact = await getArtifactWithVersions(session.user.id, slug);
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entry = artifact.versions.find((v) => v.version === version);
  if (!entry) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  return NextResponse.json({
    slug: artifact.slug,
    category: artifact.category,
    title: artifact.title,
    description: artifact.description,
    modes: artifact.modes ? JSON.parse(artifact.modes) : [],
    version: entry.version,
    label: entry.label,
    config: JSON.parse(entry.config),
    versions: artifact.versions.map((v) => ({ version: v.version, label: v.label, createdAt: v.createdAt })),
  });
}
