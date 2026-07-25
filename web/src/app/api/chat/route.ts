import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { streamChat, type ChatMessage } from "@/lib/ollama";
import { buildSystemPrompt } from "@/lib/system-prompt";

export const runtime = "nodejs";

const MAX_HISTORY_MESSAGES = 20;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function autoTitle(message: string) {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
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
    // Drop the stale assistant reply (if the chat currently ends with one) and replay history
    // as-is — the last user turn is already persisted, so we don't append another one.
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
  let fullReply = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(ollamaMessages, req.signal)) {
          fullReply += chunk;
          controller.enqueue(encoder.encode(sseEvent("token", { text: chunk })));
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

      if (fullReply.trim()) {
        await prisma.message.create({ data: { chatId, role: "assistant", content: fullReply } });
        await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
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
