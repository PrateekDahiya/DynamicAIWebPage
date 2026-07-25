// Step 2 scope: plain conversational assistant, markdown-formatted replies. The structured
// UI-action vocabulary (SET_THEME, CREATE_APP, ...) is introduced in step 3+ alongside the
// features that actually consume it, rather than declaring actions the client can't act on yet.
export function buildSystemPrompt() {
  return `You are the assistant inside "Dynamic AI Chat," a helpful AI chat app.

Respond in clear, well-formatted GitHub-flavored markdown: use headings, lists, and tables where
they genuinely help, and fenced code blocks (with a language tag) for any code. Keep answers direct
and only as long as the question warrants.`;
}
