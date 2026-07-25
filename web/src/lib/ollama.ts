const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:latest";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// Streams raw text chunks from Ollama's chat endpoint as they arrive. Ollama's streaming
// response is newline-delimited JSON objects, each with a `message.content` fragment and a
// final `{ done: true }` object.
export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      options: { temperature: 0.7 },
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status}): ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line);
      if (parsed.message?.content) yield parsed.message.content as string;
      if (parsed.done) return;
    }
  }

  if (buffer.trim()) {
    const parsed = JSON.parse(buffer);
    if (parsed.message?.content) yield parsed.message.content as string;
  }
}

export { MODEL };
