import fs from "node:fs";
import { auth } from "@/lib/auth";
import { getArtifactVersionCodePath } from "@/lib/artifacts/store";

export const runtime = "nodejs";

// Serves an AI-generated artifact's JS module from the private data/ directory (never Next's
// public/ folder — see generator.ts) after checking the requesting user actually owns it.
export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string; version: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { slug, version } = await context.params;
  const codeFilePath = await getArtifactVersionCodePath(session.user.id, slug, version);
  if (!codeFilePath || !fs.existsSync(codeFilePath)) {
    return new Response("Not found", { status: 404 });
  }

  const code = fs.readFileSync(codeFilePath, "utf-8");
  return new Response(code, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}
