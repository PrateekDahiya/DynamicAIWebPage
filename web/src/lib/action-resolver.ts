import { prisma } from "@/lib/db";
import type { Action } from "@/lib/action-schema";
import { resolveThemeAction } from "@/lib/theme-resolver";
import { resolveArtifactStart, resolveArtifactUpdate, ArtifactGenerationUnavailableError } from "@/lib/artifacts/store";
import { enqueueGenerationJob } from "@/lib/artifacts/generation-jobs";

// Resolves the model's abstract action intents (theme changes, app open/create/update) into
// concrete results, in order — theme actions resolved earlier in the same turn feed into
// CREATE_APP's "seed from the current chat theme" step, mirroring the original app's
// trackThemeUpdates-then-resolveGameActions sequencing.
export async function resolveActions(userId: string, chatId: string, actions: Action[]) {
  const resolved: unknown[] = [];

  const latestThemeRow = await prisma.theme.findFirst({ where: { chatId }, orderBy: { createdAt: "desc" } });
  let currentTheme: Record<string, string> | undefined = latestThemeRow?.vars
    ? JSON.parse(latestThemeRow.vars)
    : undefined;

  for (const action of actions) {
    if (action.type === "SET_THEME" || action.type === "UPDATE_THEME" || action.type === "RESET_THEME") {
      const result = await resolveThemeAction(chatId, action);
      resolved.push(result);
      currentTheme = "vars" in result ? result.vars : undefined;
      continue;
    }

    if (action.type === "CREATE_APP" || action.type === "OPEN_APP") {
      try {
        const result = await resolveArtifactStart(
          userId,
          chatId,
          action.slug,
          action.category,
          currentTheme,
          action.title
        );
        resolved.push({ type: action.type, ...result });
      } catch (err) {
        if (err instanceof ArtifactGenerationUnavailableError) {
          // Not a built-in — kick off live generation in the background and return a
          // "pending" marker immediately rather than blocking this whole chat turn for the
          // minutes generation can take. The client polls the job and swaps in the real
          // launch link once it resolves.
          const jobId = enqueueGenerationJob(
            userId,
            chatId,
            action.slug,
            action.category,
            action.title ?? action.slug,
            currentTheme
          );
          resolved.push({ type: "APP_GENERATION_PENDING", jobId, slug: action.slug, title: action.title ?? action.slug });
        } else {
          resolved.push({ type: "APP_ACTION_FAILED", slug: action.slug, message: "Failed to open app." });
        }
      }
      continue;
    }

    if (action.type === "UPDATE_APP") {
      try {
        const result = await resolveArtifactUpdate(userId, chatId, action.slug, action.category, action.changes, undefined);
        resolved.push({ type: action.type, ...result });
      } catch (err) {
        resolved.push({
          type: "APP_ACTION_FAILED",
          slug: action.slug,
          message: err instanceof ArtifactGenerationUnavailableError ? err.message : "Failed to update app.",
        });
      }
    }
  }

  return resolved;
}
