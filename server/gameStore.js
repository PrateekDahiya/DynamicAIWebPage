const fs = require("fs");
const path = require("path");
const { getGameDef } = require("./games/registry");
const { isSafeCssValue } = require("./actionSchema");

const STORE_FILE = path.join(__dirname, "data", "games.json");
const MAX_VERSIONS_PER_GAME = 20;

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

let store = load();

function save() {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function ensureGame(gameId) {
  if (!store[gameId]) store[gameId] = { versions: [] };
  return store[gameId];
}

// Seeds a brand new game's theme from the chat's current theme (if any), via the game's
// themeMap. Only touches the keys the chat theme actually knows about (bg/fg/accent) —
// game-specific piece colors (x/o, bot, food, ...) keep their sensible registry defaults.
function seedThemeFromChat(defaultTheme, themeMap, currentTheme) {
  if (!themeMap || !currentTheme) return defaultTheme;
  const seeded = { ...defaultTheme };
  for (const [chatKey, themeKey] of Object.entries(themeMap)) {
    if (currentTheme[chatKey]) seeded[themeKey] = currentTheme[chatKey];
  }
  return seeded;
}

// Lazily creates v0 (the untouched original) the first time a game is requested.
function getLatestVersion(gameId, currentTheme) {
  const game = ensureGame(gameId);
  if (!game.versions.length) {
    const def = getGameDef(gameId);
    const theme = seedThemeFromChat(def.defaultConfig.theme, def.themeMap, currentTheme);
    game.versions.push({
      version: "v0",
      config: { ...def.defaultConfig, theme },
      label: "original",
      createdAt: new Date().toISOString()
    });
    save();
  }
  return game.versions[game.versions.length - 1];
}

function getVersion(gameId, version) {
  return ensureGame(gameId).versions.find((v) => v.version === version);
}

function mergeConfig(baseConfig, changes, schema) {
  const merged = JSON.parse(JSON.stringify(baseConfig));
  const changedKeys = [];

  for (const [key, spec] of Object.entries(schema)) {
    if (!changes || !(key in changes)) continue;
    const value = changes[key];

    if (spec.type === "int") {
      const n = Number(value);
      if (Number.isFinite(n)) {
        merged[key] = Math.min(spec.max, Math.max(spec.min, Math.round(n)));
        changedKeys.push(key);
      }
    } else if (spec.type === "enum") {
      if (spec.values.includes(value)) {
        merged[key] = value;
        changedKeys.push(key);
      }
    } else if (spec.type === "colorMap" && value && typeof value === "object") {
      merged[key] = { ...merged[key] };
      let touched = false;
      for (const k of spec.keys) {
        if (typeof value[k] === "string" && isSafeCssValue(value[k])) {
          merged[key][k] = value[k].trim();
          touched = true;
        }
      }
      if (touched) changedKeys.push(key);
    }
  }

  return { merged, changedKeys };
}

function resolveStart(gameId, currentTheme) {
  const latest = getLatestVersion(gameId, currentTheme);
  return { gameId, version: latest.version, url: `/games/${gameId}/${latest.version}` };
}

// Always forks a new version on top of the latest one; v0 (and every prior version) is never mutated.
function resolveUpdate(gameId, changes) {
  const game = ensureGame(gameId);
  const latest = getLatestVersion(gameId);
  const def = getGameDef(gameId);
  const { merged, changedKeys } = mergeConfig(latest.config, changes, def.configSchema);

  const entry = {
    version: `v${game.versions.length}`,
    config: merged,
    label: changedKeys.length ? `updated: ${changedKeys.join(", ")}` : "updated",
    parentVersion: latest.version,
    createdAt: new Date().toISOString()
  };

  game.versions.push(entry);
  if (game.versions.length > MAX_VERSIONS_PER_GAME) {
    game.versions.splice(1, 1); // never drop v0; drop the oldest fork instead
  }
  save();

  return { gameId, version: entry.version, url: `/games/${gameId}/${entry.version}`, label: entry.label };
}

module.exports = { resolveStart, resolveUpdate, getLatestVersion, getVersion };
