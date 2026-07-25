import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { streamChat, type ChatMessage } from "@/lib/ollama";
import { buildSystemPrompt, ACTIONS_DELIMITER } from "@/lib/system-prompt";
import { sanitizeActions } from "@/lib/action-schema";
import { resolveThemeActions } from "@/lib/theme-resolver";

export const runtime = "nodejs";

const MAX_HISTORY_MESSAGES = 20;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function autoTitle(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
}

function parseTrailingActions(raw: string): { intent: string; actions: unknown[] } {
  try {
    const parsed = JSON.parse(raw.trim());
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
      { role: "system", content: buildSystemPrompt() },
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
      { role: "system", content: buildSystemPrompt() },
      ...priorMessages.map((m) => ({ role: m.role as ChatMessage["role"], content: m.content })),
      { role: "user", content: userMessage },
    ];
  }

  const encoder = new TextEncoder();
  let buffer = "";
  let delimiterIndex = -1;
  let sentUpTo = 0;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(ollamaMessages, req.signal)) {
          buffer += chunk;

          if (delimiterIndex === -1) {
            delimiterIndex = buffer.indexOf(ACTIONS_DELIMITER);

            if (delimiterIndex === -1) {
              // Hold back a small trailing window in case the delimiter is split across chunks.
              const safeEnd = Math.max(sentUpTo, buffer.length - ACTIONS_DELIMITER.length + 1);
              if (safeEnd > sentUpTo) {
                controller.enqueue(
                  encoder.encode(sseEvent("token", { text: buffer.slice(sentUpTo, safeEnd) }))
                );
                sentUpTo = safeEnd;
              }
            } else {
              const toSend = buffer.slice(sentUpTo, delimiterIndex);
              if (toSend) controller.enqueue(encoder.encode(sseEvent("token", { text: toSend })));
              sentUpTo = delimiterIndex + ACTIONS_DELIMITER.length;
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

      if (delimiterIndex === -1 && sentUpTo < buffer.length) {
        controller.enqueue(encoder.encode(sseEvent("token", { text: buffer.slice(sentUpTo) })));
      }

      const replyText = (delimiterIndex === -1 ? buffer : buffer.slice(0, delimiterIndex)).trim();
      const actionsRaw = delimiterIndex === -1 ? "" : buffer.slice(delimiterIndex + ACTIONS_DELIMITER.length);
      const { actions: rawActions } = parseTrailingActions(actionsRaw);
      const sanitized = sanitizeActions(rawActions);

      let resolvedActions: unknown[] = [];
      if (replyText) {
        try {
          resolvedActions = await resolveThemeActions(chatId, sanitized);
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
