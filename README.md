# Dynamic AI Chat

A chat app where your prompts don't just get replies — they reshape the page itself. Ask for a
theme, a mood, a widget, or a game, and a local LLM (via [Ollama](https://ollama.com)) drives live
changes to colors, backgrounds, animations, layout, and mountable interactive widgets/games.

No cloud API keys. Runs fully offline against a locally hosted model (`llama3.2:latest` by default).

## How it works

1. You type a message in the chat box.
2. The server sends it to your local Ollama model along with a system prompt describing a fixed
   **UI Action API** (`setTheme`, `animateElement`, `updateLayout`, `createWidget`, `startGame`,
   `updateGame`, `removeWidget`).
3. The model replies with `{ "reply": "...", "actions": [...] }` — a chat message plus a list of UI
   actions to apply.
4. The server validates every action against a strict whitelist (known action types, known
   widget/game IDs, sanity-checked CSS/config values) before it ever reaches the browser.
5. The frontend is a small action executor that applies the actions to the live page: updating CSS
   variables, starting canvas animations, mounting a pre-built widget, or dropping a "▶ Play in new
   tab" launch card for a game.

For widgets and theme/layout changes, the model never generates raw HTML/CSS/JS — it only *invokes*
a fixed catalog of pre-built widgets by name, and games by a whitelisted set of tunable config fields
(see "Live game generation" below for the one place actual AI-written code does run).

## Try prompts like

- "make the background red"
- "dark mode" / "cyberpunk colors" / "use pastel colors"
- "tell me about space" → starfield theme kicks in automatically
- "talk to me about halloween" → dark/orange mood theme
- "let's play tic tac toe" / "I want to play snake" / "let's play chess" → a launch card appears;
  click it to open the game's own landing page in a new tab, choose **vs Bot** or **Multiplayer
  (same device)**, and play
- "create a connect four game" / "let's play checkers" / literally any other game → if it isn't one
  of the built-in games, the model writes it from scratch on the spot (see below)
- "make the tic tac toe board bigger and the bot harder" / "give snake a neon theme and slow it down"
  → forks a new, separately-linked version of that game without touching the one you already had open
- "open a calculator" / "help me track my tasks for today"
- Plain questions with no visual intent just get a normal chat reply — nothing changes on the page.

## Games: landing pages, bot/multiplayer, and versioning

Games don't render inline in the chat — each one opens in its own browser tab at `/games/<gameId>/<version>`,
with a proper landing page (title, description, version label) and a menu to choose **🤖 Play vs Bot**
or **🧑‍🤝‍🧑 Multiplayer (same device, e.g. arrow keys vs WASD)**.

Every game is versioned:

- The first time you ask for a game, the server creates `v0` from its default config and remembers it.
- Asking for the *same* game again reuses that same version/URL — it doesn't recreate it.
- Asking for a *change* (bigger board, harder bot, different colors, different speed) forks a brand
  new version (`v1`, `v2`, …) with its own URL, built by merging your requested changes into the
  latest version's config. **Earlier versions, including `v0`, are never modified** — old links keep
  working exactly as they were.

Game state (which versions exist, and their config) is stored server-side in `server/data/games.json`.
Only whitelisted config fields per game (see `server/games/registry.js`) can be changed — bot
difficulty, board size, speed, colors, etc. — not arbitrary code.

## Live game generation

Only three games ship built into the app (Tic Tac Toe, Snake, Chess). Everything else is generated
on demand — there's no fixed catalog to run out of and nothing to add by hand:

1. When `startGame`/`updateGame` names a `gameId` the registry doesn't recognize, the server (via
   `server/gameGenerator.js`) sends a dedicated code-generation prompt to your local Ollama model
   asking for a complete, self-contained JS module exporting `mount(container, { mode, config })`.
2. The response is checked before anything runs: it must actually export `mount(...)`, it must avoid
   a blocklist of risky browser APIs (`fetch`, `eval`, `document.cookie`, `localStorage`, dynamic
   `import()`, reassigning `window.location`, etc — see `BANNED_PATTERNS` in `gameGenerator.js`), and
   it must pass a real JS syntax check (`node --check`) — one retry happens automatically on failure.
3. On success it's saved to `public/games/generated/<gameId>.js`, registered (persisted in
   `server/data/generatedGames.json`) with a generic theme/bot-difficulty config so it can be
   versioned/re-themed exactly like a built-in game, and served like any other game from then on.
4. If generation fails after retrying, or the generated code throws at runtime, you get a clear
   error instead of a silently missing button or a blank crashed tab.

**This is a real tradeoff, not a guarantee.** `llama3.2:latest` is a small 3B model — it reliably
produces code that *parses* and avoids the banned APIs, but the actual game logic can still have real
bugs (an undeclared variable, incorrect win-checking, etc). Some generated games will just work, some
will be playable but rough, and some will be broken. There's no automatic "fix the bug" loop yet —
config-based `updateGame` (theme/difficulty) still works on generated games, but re-generating the
underlying code isn't wired up. If you want guaranteed-correct games, ask for one of the three
built-in ones, or add a hand-written module the same way Tic Tac Toe/Snake/Chess were built (see
"Extending it" below).

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Ollama](https://ollama.com) installed and running locally, with a model pulled:
  ```
  ollama pull llama3.2:latest
  ollama serve
  ```

## Setup

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

Environment variables (optional):

| Variable       | Default                   | Description                          |
|----------------|----------------------------|--------------------------------------|
| `PORT`         | `3000`                     | Port the Express server listens on   |
| `OLLAMA_URL`   | `http://localhost:11434`   | Base URL of your Ollama instance     |
| `OLLAMA_MODEL` | `llama3.2:latest`          | Model used for chat completions      |

## Session persistence

Conversation history and every applied UI action are saved to `server/data/session.json`. Refreshing
the page (or restarting the server) replays the saved turns so your theme, chat log, and any game
launch cards / mounted widgets come back automatically. Use the **Reset** button in the chat header
to clear the session and start over. (Game *versions* themselves live independently in
`server/data/games.json` and are unaffected by resetting the chat session.)

Note: widgets are remounted fresh on replay — their own internal state (typed todo items, notes text)
isn't currently captured, only the fact that they were opened.

## Project structure

```
server/
  index.js            Express app entrypoint, serves the frontend + API routes, logs every request
  logger.js             Console + server/data/app.log logger used across the server
  ollama.js             Wrapper around Ollama's chat (JSON actions) and generate (game code) APIs
  actionSchema.js       Whitelist/validator for UI actions returned by the model
  systemPrompt.js        Builds the system prompt (action vocabulary + config schemas + examples)
  gameGenerator.js        Generates+validates a brand new game's JS module via Ollama (see above)
  gameStore.js             Versioned game instance store (server/data/games.json): create v0 (auto-
                          generating the game first if it's unknown), reuse latest, fork new
                          versions on updateGame, never mutates earlier versions
  games/registry.js        Built-in game defs (title, modes, default config, config schema) plus the
                          persisted registry of AI-generated games (server/data/generatedGames.json)
  routes/chat.js         POST /api/chat, GET /api/state, POST /api/reset
  routes/games.js        GET /games/:gameId (redirect to latest), GET /games/:gameId/:version (page),
                         GET /api/games/:gameId/:version (config/meta JSON), GET /api/games (all games)

public/
  index.html            Page shell (#app, #chat, #widgets containers)
  css/base.css           Default theme as CSS custom properties
  js/
    main.js               Boot: wires chat input, replays saved session, loads persistent games list
    chat.js                Chat bubble rendering
    actionExecutor.js       Dispatches each action to its handler (incl. gameGenerationFailed)
    actions/               setTheme/animateElement, updateLayout/removeWidget, createWidget,
                           startGame/updateGame (renders a "▶ Play in new tab" launch card)
    widgets/                calculator, timer, todo, chart, notes

  games/                  Standalone per-game pages, opened in a new tab
    index.html             Landing page + mode menu shell
    shell.js                Reads gameId/version from the URL, fetches its config, wires up the menu,
                            loads the built-in module or falls back to generated/<gameId>.js
    tictactoe.js             Config-driven board (size, win length), minimax/heuristic bot, hotseat 2P
    snake.js                  Config-driven board/speed, greedy bot snake, hotseat 2P (arrows vs WASD)
    chess.js                   Full legal move gen incl. castling/en passant, minimax bot, hotseat 2P
    generated/<gameId>.js       AI-generated games — gitignored, recreated on demand, not hand-edited
```

## Extending it

To add a new **widget**:

1. Add a module under `public/js/widgets/` exporting `{ title, mount(container, props) }`.
2. Register it in `public/js/actions/widgets.js`.
3. Add its id to `WIDGET_IDS` in `server/actionSchema.js` so the model is allowed to invoke it (the
   catalog is also surfaced to the model automatically via `systemPrompt.js`).

To add a new **built-in game** (guaranteed-working, vs. letting the AI generate one on request):

1. Add its definition (title, description, modes, `defaultConfig`, `configSchema`) to
   `BUILTIN_GAMES` in `server/games/registry.js` — this is the single source of truth for what
   config fields the AI is allowed to change via `updateGame`, and it's automatically included in
   the system prompt.
2. Add a module under `public/games/` exporting `mount(container, { mode, config })`, and register it
   in the `BUILTIN_MODULES` map in `public/games/shell.js`.

## Logging

Every HTTP request, chat turn (user message, raw model output, sanitized actions), dropped/unknown
action, and game-generation attempt is logged to the console and appended to `server/data/app.log`
(`server/logger.js`). This is the first place to look when something the model said it did doesn't
show up on the page — e.g. an unknown widget/game id being silently dropped shows up there as a
`WARN` line.

## Known limitations

- `llama3.2:latest` is a small 3B model — very novel phrasing can occasionally produce a chat-only
  reply instead of the expected UI action, or route a request to the wrong action type. Growing the
  few-shot examples in `systemPrompt.js` is the easiest way to improve reliability further.
- AI-generated games (anything beyond Tic Tac Toe/Snake/Chess) are a real quality tradeoff — see
  "Live game generation" above. There's no automatic bug-fixing loop for generated game code yet.
- Everything runs as a single, local, unauthenticated session — this is meant for personal/local use,
  not multi-user deployment.
