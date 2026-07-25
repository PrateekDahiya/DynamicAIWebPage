import crypto from "node:crypto";
import type { ArtifactCategoryValue } from "@/lib/action-schema";
import { generateArtifactModule } from "./generator";
import { registerGeneratedArtifact, getLatestVersionUrl } from "./store";

type Job = {
  userId: string;
  slug: string;
  title: string;
  status: "pending" | "done" | "failed";
  url?: string;
  message?: string;
};

// In-memory job map — fine for a single-process local app (matches the plan's explicit call:
// this only needs to survive one Node process, not a restart or multi-instance deployment).
const jobs = new Map<string, Job>();

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

// Enqueues generation and returns a jobId immediately — the caller (the chat route) must not
// await the actual generation, since it can take anywhere from tens of seconds to several
// minutes on a local model. The chat turn completes right away with a "pending" action; the
// client polls this job until it resolves.
export function enqueueGenerationJob(
  userId: string,
  chatId: string,
  slug: string,
  category: ArtifactCategoryValue,
  title: string,
  currentTheme: Record<string, string> | undefined
): string {
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { userId, slug, title, status: "pending" });

  void (async () => {
    try {
      const generated = await generateArtifactModule(slug, title);
      const artifact = await registerGeneratedArtifact(
        userId,
        chatId,
        slug,
        category,
        generated.title,
        generated.description,
        generated.codeFilePath,
        generated.codeHash,
        currentTheme
      );
      const url = await getLatestVersionUrl(artifact.id, slug);
      jobs.set(jobId, { userId, slug, title, status: "done", url });
    } catch (err) {
      jobs.set(jobId, {
        userId,
        slug,
        title,
        status: "failed",
        message: err instanceof Error ? err.message : "Generation failed.",
      });
    }
  })();

  return jobId;
}
