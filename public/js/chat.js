const log = document.getElementById("chat-log");

export function appendBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}
