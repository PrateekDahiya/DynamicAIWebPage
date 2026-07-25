const fs = require("fs");
const path = require("path");
const express = require("express");
const { chatCompletion } = require("../ollama");
const { buildSystemPrompt } = require("../systemPrompt");
const { sanitizeActions } = require("../actionSchema");
const { resolveStart, resolveUpdate } = require("../gameStore");
const { getGameDef } = require("../games/registry");

const router = express.Router();
const systemPrompt = buildSystemPrompt();

// Single-user local app: persist state to disk so both a page refresh and a
// server restart resume the same session instead of losing it.
const STATE_FILE = path.join(__dirname, "..", "data", "session.json");
const MAX_HISTORY_MESSAGES = 20;
const MAX_TURNS = 100;
const THEME_KEYS = { "--bg": "bg", "--fg": "fg", "--accent": "accent" };

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      theme: parsed.theme && typeof parsed.theme === "object" ? parsed.theme : null
    };
  } catch {
    return { history: [], turns: [], theme: null };
  }
}

let { history, turns, theme } = loadState();

function saveState() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ history, turns, theme }), "utf-8");
}

function parseModelOutput(raw) {
  try {
    const parsed = JSON.parse(raw);
    const reply = typeof parsed.reply === "string" ? parsed.reply : raw;
    const actions = sanitizeActions(parsed.actions);
    return { reply, actions };
  } catch {
    return { reply: raw, actions: [] };
  }
}

// Remembers the chat's current look (bg/fg/accent) so a brand new game can be seeded to
// match it — this is what lets "let's play tic tac toe" open in whatever theme is active.
function trackThemeUpdates(actions) {
  const setThemeAction = actions.find((a) => a.type === "setTheme" && a.vars);
  if (!setThemeAction) return;
  const update = {};
  for (const [cssVar, key] of Object.entries(THEME_KEYS)) {
    if (setThemeAction.vars[cssVar]) update[key] = setThemeAction.vars[cssVar];
  }
  if (Object.keys(update).length) {
    theme = { ...theme, ...update };
  }
}

// Turns the model's abstract startGame/updateGame intents into a concrete, versioned
// game URL — reusing the latest existing version, or forking a new one for updateGame.
function resolveGameActions(actions) {
  return actions.map((action) => {
    if (action.type === "startGame") {
      const resolved = resolveStart(action.gameId, theme);
      return { ...resolved, type: "startGame", title: getGameDef(action.gameId).title };
    }
    if (action.type === "updateGame") {
      const resolved = resolveUpdate(action.gameId, action.changes);
      return { ...resolved, type: "updateGame", title: getGameDef(action.gameId).title };
    }
    return action;
  });
}

router.get("/state", (_req, res) => {
  res.json({ turns });
});

router.post("/chat", async (req, res) => {
  const userMessage = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!userMessage) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const raw = await chatCompletion({ systemPrompt, history, userMessage });
    const { reply, actions: sanitized } = parseModelOutput(raw);
    trackThemeUpdates(sanitized);
    const actions = resolveGameActions(sanitized);

    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: reply });
    if (history.length > MAX_HISTORY_MESSAGES) {
      history = history.slice(-MAX_HISTORY_MESSAGES);
    }

    turns.push({ userMessage, reply, actions });
    if (turns.length > MAX_TURNS) {
      turns = turns.slice(-MAX_TURNS);
    }

    saveState();
    res.json({ reply, actions });
  } catch (err) {
    console.error("[chat] error:", err.message);
    res.status(502).json({ error: "Failed to reach local Ollama model. Is `ollama serve` running?" });
  }
});

router.post("/reset", (_req, res) => {
  history = [];
  turns = [];
  theme = null;
  saveState();
  res.json({ ok: true });
});

module.exports = router;
