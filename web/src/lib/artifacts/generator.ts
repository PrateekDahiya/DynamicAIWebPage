import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { generateText } from "@/lib/ollama";

const GENERATED_DIR = path.join(process.cwd(), "data", "artifacts", "generated");

// Best-effort static defense-in-depth, not a real sandbox: generated code runs in the same
// page/origin as the rest of the app. This only blocks the most obviously risky APIs; it does
// not guarantee the generated artifact is safe, only that it avoids these specific footguns.
const BANNED_PATTERNS: [RegExp, string][] = [
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
  [/\bwindow\.parent\b/, "window.parent"],
  [/\bWebSocket\b/, "WebSocket"],
  [/\bnew\s+Worker\s*\(/, "new Worker("],
  [/navigator\.sendBeacon/, "navigator.sendBeacon"],
  [/navigator\.clipboard/, "navigator.clipboard"],
];

function buildGamePrompt(slug: string, title: string) {
  return `You are generating a small, self-contained browser game as a single JavaScript ES module.

Write a complete, working implementation of the game "${title}" (internal id: "${slug}") for a chat
app that opens games in a browser tab. Output ONLY raw JavaScript source code — no markdown code
fences, no explanation before or after, no comments describing what you're about to do.

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
  sessionStorage, dynamic import(), WebSocket, Worker, navigator.sendBeacon, navigator.clipboard, or
  reassign window.location.

Output nothing but the JavaScript module source code.`;
}

function stripCodeFences(text: string) {
  const match = text.match(/```(?:javascript|js)?\n([\s\S]*?)```/i);
  return (match ? match[1] : text).trim();
}

function findBannedPattern(code: string): string | null {
  const hit = BANNED_PATTERNS.find(([re]) => re.test(code));
  return hit ? hit[1] : null;
}

export type GeneratedArtifact = {
  title: string;
  description: string;
  codeFilePath: string;
  codeHash: string;
};

// Generates an artifact module for a slug the registry doesn't know about yet, validates it
// (must export mount(), must avoid banned APIs, must pass a real JS syntax check), writes it to
// data/artifacts/generated/<slug>.js (a writable app-data directory, NOT Next's public/ folder —
// writing to public/ at runtime is fragile/non-portable), and returns metadata for the caller to
// register in the artifact store. Throws if generation/validation fails after retries.
export async function generateArtifactModule(slug: string, title: string): Promise<GeneratedArtifact> {
  const prompt = buildGamePrompt(slug, title);

  let lastError: Error | undefined;
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
      const filePath = path.join(GENERATED_DIR, `${slug}.js`);
      fs.writeFileSync(filePath, code, "utf-8");

      execFileSync(process.execPath, ["--check", filePath]);

      const crypto = await import("node:crypto");
      const codeHash = crypto.createHash("sha256").update(code).digest("hex");

      return { title, description: `An AI-generated game: ${title}.`, codeFilePath: filePath, codeHash };
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw new Error(`Could not generate a working game for "${slug}": ${lastError?.message}`);
}
