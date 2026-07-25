const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { generateText } = require("./ollama");
const logger = require("./logger");

const GENERATED_DIR = path.join(__dirname, "..", "public", "games", "generated");

// Best-effort static defense-in-depth, not a real sandbox: generated code runs in the same
// page/origin as the rest of the app. This only blocks the most obviously risky APIs; it does
// not guarantee the generated game is safe, only that it avoids these specific footguns.
const BANNED_PATTERNS = [
  [/\bfetch\s*\(/, "fetch("],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
  [/\beval\s*\(/, "eval("],
  [/\bnew\s+Function\s*\(/, "new Function("],
  [/document\.cookie/, "document.cookie"],
  [/\blocalStorage\b/, "localStorage"],
  [/\bsessionStorage\b/, "sessionStorage"],
  [/\bimport\s*\(/, "dynamic import("],
  [/<\s*script/i, "<script"],
  [/window\.location\s*=/, "window.location ="],
  [/\bwindow\.top\b/, "window.top"],
  [/\bwindow\.parent\b/, "window.parent"]
];

function buildCodeGenPrompt(gameId, gameName) {
  return `You are generating a small, self-contained browser game as a single JavaScript ES module.

Write a complete, working implementation of the game "${gameName}" (internal id: "${gameId}") for a
chat app that opens games in a browser tab. Output ONLY raw JavaScript source code — no markdown
code fences, no explanation before or after, no comments describing what you're about to do.

Hard requirements:
- The module MUST export exactly one function with this exact signature:
  export function mount(container, { mode, config }) { ... }
- "container" is an empty DOM element already attached to the page — create and append all of your
  game's elements into it. Do not touch anything outside "container".
- "mode" is either "bot" (single player vs a simple computer opponent) or "multiplayer" (two people
  taking turns on the same device — e.g. click-to-take-turns, or two separate key sets). Support
  BOTH modes reasonably. The bot does not need to be optimal, just functional and non-cheating.
- "config" is a plain object. You may read config.theme (an object of CSS color strings, may be
  absent) and config.botDifficulty ("easy"|"medium"|"hard", may be absent) if relevant, but the game
  must still work fine if config is empty.
- Use ONLY vanilla DOM APIs (document.createElement, canvas 2D context, addEventListener, etc) and
  plain JavaScript. No external files, images, fonts, network requests, or libraries — draw with
  canvas or DOM elements, and unicode characters/emoji are fine for icons/pieces.
- Show a visible status line (whose turn / score / result) and a "Restart" button.
- Keep the entire game (rules, rendering, input handling) inside this one file.
- Do NOT use fetch, XMLHttpRequest, eval, new Function, document.cookie, localStorage,
  sessionStorage, dynamic import(), or reassign window.location.

Output nothing but the JavaScript module source code.`;
}

function stripCodeFences(text) {
  const match = text.match(/```(?:javascript|js)?\n([\s\S]*?)```/i);
  return (match ? match[1] : text).trim();
}

function findBannedPattern(code) {
  const hit = BANNED_PATTERNS.find(([re]) => re.test(code));
  return hit ? hit[1] : null;
}

// Generates a game module for a gameId the registry doesn't know about yet, validates it
// (must export mount(), must avoid banned APIs, must be syntactically valid JS), writes it to
// public/games/generated/<gameId>.js, and returns {title, description} for the caller to
// register in the game registry. Throws if generation/validation fails after retries.
async function generateGameModule(gameId, gameName) {
  const prompt = buildCodeGenPrompt(gameId, gameName);
  logger.info(`Generating game module for "${gameId}" (${gameName})`);

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await generateText(prompt);
      const code = stripCodeFences(raw);

      if (!/export\s+function\s+mount\s*\(/.test(code)) {
        throw new Error("generated code did not export a mount(container, options) function");
      }
      const banned = findBannedPattern(code);
      if (banned) {
        throw new Error(`generated code used a disallowed pattern: ${banned}`);
      }

      fs.mkdirSync(GENERATED_DIR, { recursive: true });
      const filePath = path.join(GENERATED_DIR, `${gameId}.js`);
      fs.writeFileSync(filePath, code, "utf-8");

      execFileSync(process.execPath, ["--check", filePath]);

      logger.info(`Generated and validated game module for "${gameId}"`, { attempt, bytes: code.length });
      return { title: gameName, description: `An AI-generated game: ${gameName}.` };
    } catch (err) {
      lastError = err;
      logger.warn(`Game generation attempt ${attempt} failed for "${gameId}"`, { message: err.message });
    }
  }

  throw new Error(`Could not generate a working game for "${gameId}": ${lastError.message}`);
}

module.exports = { generateGameModule };
