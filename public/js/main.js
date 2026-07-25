import { appendBubble } from "./chat.js";
import { executeActions } from "./actionExecutor.js";

const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const resetBtn = document.getElementById("chat-reset");

async function restoreSession() {
  try {
    const res = await fetch("/api/state");
    const data = await res.json();
    const turns = Array.isArray(data.turns) ? data.turns : [];

    if (!turns.length) {
      appendBubble("system", "Try: \"make the background red\", \"tell me about space\", \"let's play tic tac toe\", \"open a calculator\"");
      return;
    }

    for (const turn of turns) {
      appendBubble("user", turn.userMessage);
      appendBubble("assistant", turn.reply);
      executeActions(turn.actions);
    }
  } catch (err) {
    console.error("Failed to restore session:", err);
    appendBubble("system", "Try: \"make the background red\", \"tell me about space\", \"let's play tic tac toe\", \"open a calculator\"");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  appendBubble("user", message);
  input.value = "";
  input.disabled = true;

  const pending = appendBubble("assistant", "…");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await res.json();

    if (!res.ok) {
      pending.textContent = data.error || "Something went wrong.";
      return;
    }

    pending.textContent = data.reply;
    executeActions(data.actions);
  } catch (err) {
    pending.textContent = "Could not reach the server.";
    console.error(err);
  } finally {
    input.disabled = false;
    input.focus();
  }
});

resetBtn.addEventListener("click", async () => {
  await fetch("/api/reset", { method: "POST" });
  window.location.reload();
});

restoreSession();
