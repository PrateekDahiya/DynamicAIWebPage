import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listArtifacts } from "@/lib/artifacts/store";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const artifacts = await listArtifacts(session.user.id);
  return NextResponse.json({ artifacts });
}
