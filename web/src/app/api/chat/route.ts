import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { streamChat, type ChatMessage } from "@/lib/ollama";
import { buildSystemPrompt, ACTIONS_DELIMITER } from "@/lib/system-prompt";
import { sanitizeActions } from "@/lib/action-schema";
import { resolveActions } from "@/lib/action-resolver";
import { listArtifactInventory } from "@/lib/artifacts/store";

export const runtime = "nodejs";

const MAX_HISTORY_MESSAGES = 20;

// The model doesn't always write the literal ACTIONS_DELIMITER line before its JSON action
// block (a real, observed failure mode) — but the JSON always starts with `{"intent":`, so we
// treat that as an *implicit* second delimiter. Whichever pattern appears first in the growing
// buffer is where reply text ends; this is what actually stops the JSON from streaming live to
// the client, not just cleaning it up after the fact.
const JSON_TAIL_RE = /\{\s*"intent"\s*:/;
const SAFETY_WINDOW = Math.max(ACTIONS_DELIMITER.length, 12) - 1;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function autoTitle(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
}

// Finds where the reply text ends: either the literal delimiter or the JSON tail's own
// `{"intent":` prefix, whichever comes first. Returns the reply/tail split point, and where the
// actual JSON text begins (skipping past the delimiter marker text, if that's what matched).
function findTailStart(buffer: string): { replyEnd: number; jsonStart: number } | null {
  const delimiterIdx = buffer.indexOf(ACTIONS_DELIMITER);
  const jsonMatch = buffer.match(JSON_TAIL_RE);
  const jsonIdx = jsonMatch?.index ?? -1;

  if (delimiterIdx === -1 && jsonIdx === -1) return null;
  if (delimiterIdx !== -1 && (jsonIdx === -1 || delimiterIdx <= jsonIdx)) {
    return { replyEnd: delimiterIdx, jsonStart: delimiterIdx + ACTIONS_DELIMITER.length };
  }
  return { replyEnd: jsonIdx, jsonStart: jsonIdx };
}

// Finds the exact end of the JSON object starting at `start` (brace-matching, respecting string
// literals/escapes) instead of assuming it runs to the end of the buffer — a model that rambles
// past its own JSON into more text no longer breaks extraction, since JSON.parse only ever sees
// a complete, standalone object.
function extractJsonObjectAt(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // unterminated — the model got cut off mid-JSON, not recoverable
}

function parseActionsJson(jsonText: string | null): { intent: string; actions: unknown[] } {
  if (!jsonText) return { intent: "conversation", actions: [] };
  try {
    const parsed = JSON.parse(jsonText);
    return {
      intent: typeof parsed.intent === "string" ? parsed.intent : "conversation",
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch {
    return { intent: "conversation", actions: [] };
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId : null;
  const userMessage = typeof body?.message === "string" ? body.message.trim() : "";
  const regenerate = body?.regenerate === true;

  if (!chatId || (!regenerate && !userMessage)) {
    return new Response(JSON.stringify({ error: "chatId and message are required" }), {
      status: 400,
    });
  }

  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id, deletedAt: null },
  });
  if (!chat) {
    return new Response(JSON.stringify({ error: "Chat not found" }), { status: 404 });
  }

  const inventory = await listArtifactInventory(session.user.id);
  const systemPrompt = buildSystemPrompt(inventory);

  let ollamaMessages: ChatMessage[];

  if (regenerate) {
    const last = await prisma.message.findFirst({ where: { chatId }, orderBy: { createdAt: "desc" } });
    if (last?.role === "assistant") {
      await prisma.message.delete({ where: { id: last.id } });
    }
    const history = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
    });
    history.reverse();
    ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
    ];
  } else {
    const priorMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY_MESSAGES,
    });
    priorMessages.reverse();

    await prisma.message.create({ data: { chatId, role: "user", content: userMessage } });

    if (priorMessages.length === 0) {
      await prisma.chat.update({ where: { id: chatId }, data: { title: autoTitle(userMessage) } });
    }

    ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...priorMessages.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
      { role: "user", content: userMessage },
    ];
  }

  const encoder = new TextEncoder();
  let buffer = "";
  let tailFound = false;
  let replyEnd = -1;
  let jsonStart = -1;
  let sentUpTo = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(ollamaMessages, req.signal)) {
          buffer += chunk;

          if (!tailFound) {
            const found = findTailStart(buffer);

            if (!found) {
              // Hold back a small trailing window in case the delimiter/JSON prefix is split
              // across chunks.
              const safeEnd = Math.max(sentUpTo, buffer.length - SAFETY_WINDOW);
              if (safeEnd > sentUpTo) {
                controller.enqueue(
                  encoder.encode(sseEvent("token", { text: buffer.slice(sentUpTo, safeEnd) }))
                );
                sentUpTo = safeEnd;
              }
            } else {
              tailFound = true;
              replyEnd = found.replyEnd;
              jsonStart = found.jsonStart;
              const toSend = buffer.slice(sentUpTo, replyEnd);
              if (toSend) controller.enqueue(encoder.encode(sseEvent("token", { text: toSend })));
              sentUpTo = replyEnd;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          controller.enqueue(
            encoder.encode(
              sseEvent("error", {
                message: "Failed to reach the local Ollama model. Is `ollama serve` running?",
              })
            )
          );
        }
      }

      if (!tailFound && sentUpTo < buffer.length) {
        controller.enqueue(encoder.encode(sseEvent("token", { text: buffer.slice(sentUpTo) })));
      }

      const replyText = (tailFound ? buffer.slice(0, replyEnd) : buffer).trim();
      const jsonText = tailFound ? extractJsonObjectAt(buffer, jsonStart) : null;
      const { actions: rawActions } = parseActionsJson(jsonText);
      const sanitized = sanitizeActions(rawActions);

      let resolvedActions: unknown[] = [];
      if (replyText) {
        try {
          resolvedActions = await resolveActions(session.user.id, chatId, sanitized);
        } catch {
          resolvedActions = [];
        }

        await prisma.message.create({
          data: {
            chatId,
            role: "assistant",
            content: replyText,
            actionsJson: resolvedActions.length ? JSON.stringify(resolvedActions) : null,
          },
        });
        await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
      }

      if (resolvedActions.length) {
        controller.enqueue(encoder.encode(sseEvent("actions", { actions: resolvedActions })));
      }

      controller.enqueue(encoder.encode(sseEvent("done", {})));
      controller.close();
    },
    cancel() {
      // client aborted (stop button / navigation) — streamChat's fetch already carries
      // req.signal, so the upstream Ollama request is cancelled too.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
