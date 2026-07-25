const pathParts = window.location.pathname.split("/").filter(Boolean); // ["games", gameId, version]
const gameId = pathParts[1];
const version = pathParts[2];

const titleEl = document.getElementById("game-title");
const descEl = document.getElementById("game-description");
const versionEl = document.getElementById("game-version-label");
const landing = document.getElementById("landing");
const gameArea = document.getElementById("game-area");
const mount = document.getElementById("game-mount");
const modeLabel = document.getElementById("game-mode-label");

// Built-in games ship in this file's own directory; anything else was generated on the fly
// by the server and lives under /games/generated/<gameId>.js.
const BUILTIN_MODULES = {
  tictactoe: () => import("./tictactoe.js"),
  snake: () => import("./snake.js"),
  chess: () => import("./chess.js")
};

function loadGameModule(id) {
  return BUILTIN_MODULES[id] ? BUILTIN_MODULES[id]() : import(`/games/generated/${id}.js`);
}

let meta = null;

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    root.style.setProperty(`--game-${key}`, value);
  }
}

async function startGame(mode) {
  modeLabel.textContent = mode === "bot" ? "vs Bot" : "Multiplayer";
  mount.innerHTML = "";
  try {
    const mod = await loadGameModule(gameId);
    landing.hidden = true;
    gameArea.hidden = false;
    mod.mount(mount, { mode, config: meta.config });
  } catch (err) {
    console.error("Failed to load game module:", err);
    mount.innerHTML = `<div class="ttt-status">Couldn't load this game's code — it may have failed to generate correctly.</div>`;
    landing.hidden = true;
    gameArea.hidden = false;
  }
}

function backToMenu() {
  gameArea.hidden = true;
  landing.hidden = false;
  mount.innerHTML = "";
}

async function init() {
  if (!gameId || !version) {
    titleEl.textContent = "Unknown game";
    document.getElementById("mode-buttons").hidden = true;
    return;
  }

  const res = await fetch(`/api/games/${gameId}/${version}`);
  if (!res.ok) {
    titleEl.textContent = "Game version not found";
    document.getElementById("mode-buttons").hidden = true;
    return;
  }

  meta = await res.json();
  document.title = `${meta.title} · ${meta.version}`;
  titleEl.textContent = meta.title;
  descEl.textContent = meta.description;
  versionEl.textContent = `${meta.version}${meta.label ? " · " + meta.label : ""}`;

  applyTheme(meta.config.theme);

  document.getElementById("btn-bot").addEventListener("click", () => startGame("bot"));
  document.getElementById("btn-multiplayer").addEventListener("click", () => startGame("multiplayer"));
  document.getElementById("btn-back").addEventListener("click", backToMenu);
}

init();
