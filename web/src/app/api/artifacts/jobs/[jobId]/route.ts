import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJob } from "@/lib/artifacts/generation-jobs";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await context.params;
  const job = getJob(jobId);
  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    slug: job.slug,
    title: job.title,
    url: job.url,
    message: job.message,
  });
}
