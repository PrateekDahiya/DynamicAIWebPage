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

The model never generates raw HTML/CSS/JS — it only *invokes* a fixed catalog of pre-built,
sandboxed widgets and games by name (and, for games, a whitelisted set of tunable config fields).
This keeps the "AI redesigns the page" experience safe and reliable instead of relying on brittle,
arbitrary generated code.

## Try prompts like

- "make the background red"
- "dark mode" / "cyberpunk colors" / "use pastel colors"
- "tell me about space" → starfield theme kicks in automatically
- "talk to me about halloween" → dark/orange mood theme
- "let's play tic tac toe" / "I want to play snake" → a launch card appears; click it to open the
  game's own landing page in a new tab, choose **vs Bot** or **Multiplayer (same device)**, and play
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
  index.js            Express app entrypoint, serves the frontend + API routes
  ollama.js            Wrapper around the Ollama chat completion API
  actionSchema.js       Whitelist/validator for UI actions returned by the model
  systemPrompt.js        Builds the system prompt (action vocabulary + config schemas + examples)
  gameStore.js           Versioned game instance store (server/data/games.json): create v0, reuse
                         latest, fork new versions on updateGame, never mutates earlier versions
  games/registry.js      Per-game definition: title, description, modes, default config, config schema
  routes/chat.js         POST /api/chat, GET /api/state, POST /api/reset
  routes/games.js        GET /games/:gameId (redirect to latest), GET /games/:gameId/:version (page),
                         GET /api/games/:gameId/:version (config/meta JSON)

public/
  index.html            Page shell (#app, #chat, #widgets containers)
  css/base.css           Default theme as CSS custom properties
  js/
    main.js               Boot: wires chat input, replays saved session on load
    chat.js                Chat bubble rendering
    actionExecutor.js       Dispatches each action to its handler
    actions/               setTheme/animateElement, updateLayout/removeWidget, createWidget,
                           startGame/updateGame (renders a "▶ Play in new tab" launch card)
    widgets/                calculator, timer, todo, chart, notes

  games/                  Standalone per-game pages, opened in a new tab
    index.html             Landing page + mode menu shell
    shell.js                Reads gameId/version from the URL, fetches its config, wires up the menu
    tictactoe.js             Config-driven board (size, win length), minimax/heuristic bot, hotseat 2P
    snake.js                  Config-driven board/speed, greedy bot snake, hotseat 2P (arrows vs WASD)
```

## Extending it

To add a new **widget**:

1. Add a module under `public/js/widgets/` exporting `{ title, mount(container, props) }`.
2. Register it in `public/js/actions/widgets.js`.
3. Add its id to `WIDGET_IDS` in `server/actionSchema.js` so the model is allowed to invoke it (the
   catalog is also surfaced to the model automatically via `systemPrompt.js`).

To add a new **game**:

1. Add its definition (title, description, modes, `defaultConfig`, `configSchema`) to
   `server/games/registry.js` — this is the single source of truth for what config fields the AI is
   allowed to change via `updateGame`, and it's automatically included in the system prompt.
2. Add a module under `public/games/` exporting `mount(container, { mode, config })`, and register it
   in the `GAME_MODULES` map in `public/games/shell.js`.

## Known limitations

- `llama3.2:latest` is a small 3B model — very novel phrasing can occasionally produce a chat-only
  reply instead of the expected UI action. Growing the few-shot examples in `systemPrompt.js` is the
  easiest way to improve reliability further.
- Everything runs as a single, local, unauthenticated session — this is meant for personal/local use,
  not multi-user deployment.
