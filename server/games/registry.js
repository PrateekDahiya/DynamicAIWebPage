const fs = require("fs");
const path = require("path");

const BUILTIN_GAMES = {
  tictactoe: {
    title: "Tic Tac Toe",
    description: "Classic N-in-a-row grid game. Play against the bot or a friend on the same device.",
    modes: ["bot", "multiplayer"],
    defaultConfig: {
      boardSize: 3,
      winLength: 3,
      botDifficulty: "hard",
      theme: { bg: "#12141c", fg: "#e6e6f0", accent: "#6d8dff", x: "#6d8dff", o: "#ff6d6d" }
    },
    configSchema: {
      boardSize: { type: "int", min: 3, max: 6 },
      winLength: { type: "int", min: 3, max: 5 },
      botDifficulty: { type: "enum", values: ["easy", "medium", "hard"] },
      theme: { type: "colorMap", keys: ["bg", "fg", "accent", "x", "o"] }
    },
    // maps a chat theme field (setTheme's --bg/--fg/--accent) to this game's own theme key,
    // used only to seed a brand new game's v0 so it starts looking like the current chat theme
    themeMap: { bg: "bg", fg: "fg", accent: "accent" }
  },
  snake: {
    title: "Snake",
    description: "Guide your snake to eat food and grow. Race the bot snake or play head-to-head with a friend.",
    modes: ["bot", "multiplayer"],
    defaultConfig: {
      boardSize: 15,
      speedMs: 150,
      botDifficulty: "medium",
      theme: { bg: "#0d0f16", fg: "#e6e6f0", snake: "#39ff14", bot: "#ff9f40", food: "#ff5050" }
    },
    configSchema: {
      boardSize: { type: "int", min: 10, max: 25 },
      speedMs: { type: "int", min: 60, max: 400 },
      botDifficulty: { type: "enum", values: ["easy", "medium", "hard"] },
      theme: { type: "colorMap", keys: ["bg", "fg", "snake", "bot", "food"] }
    },
    themeMap: { bg: "bg", fg: "fg", accent: "snake" }
  },
  chess: {
    title: "Chess",
    description: "The classic game of strategy. Play against the bot or a friend on the same device.",
    modes: ["bot", "multiplayer"],
    defaultConfig: {
      botDifficulty: "medium",
      theme: { light: "#eeeed2", dark: "#769656", whitePiece: "#ffffff", blackPiece: "#202020", highlight: "#6d8dff" }
    },
    configSchema: {
      botDifficulty: { type: "enum", values: ["easy", "medium", "hard"] },
      theme: { type: "colorMap", keys: ["light", "dark", "whitePiece", "blackPiece", "highlight"] }
    },
    // chess's board colors are its own visual identity — only the highlight accent inherits
    // from the chat's current theme, not the light/dark squares themselves
    themeMap: { accent: "highlight" }
  }
};

// Every AI-generated game (anything not in BUILTIN_GAMES above) shares this same generic
// config shape — a simple bg/fg/accent theme plus bot difficulty — so updateGame works the
// same way for them as it does for built-in games, without needing a bespoke schema per game.
const GENERATED_GAME_TEMPLATE = {
  modes: ["bot", "multiplayer"],
  defaultConfig: {
    botDifficulty: "medium",
    theme: { bg: "#12141c", fg: "#e6e6f0", accent: "#6d8dff" }
  },
  configSchema: {
    botDifficulty: { type: "enum", values: ["easy", "medium", "hard"] },
    theme: { type: "colorMap", keys: ["bg", "fg", "accent"] }
  },
  themeMap: { bg: "bg", fg: "fg", accent: "accent" }
};

const GENERATED_FILE = path.join(__dirname, "..", "data", "generatedGames.json");

function loadGeneratedGames() {
  try {
    return JSON.parse(fs.readFileSync(GENERATED_FILE, "utf-8"));
  } catch {
    return {};
  }
}

let generatedGames = loadGeneratedGames();

function saveGeneratedGames() {
  fs.mkdirSync(path.dirname(GENERATED_FILE), { recursive: true });
  fs.writeFileSync(GENERATED_FILE, JSON.stringify(generatedGames, null, 2), "utf-8");
}

function getGameIds() {
  return [...Object.keys(BUILTIN_GAMES), ...Object.keys(generatedGames)];
}

function getGameDef(gameId) {
  return BUILTIN_GAMES[gameId] || generatedGames[gameId];
}

function isKnownGame(gameId) {
  return !!getGameDef(gameId);
}

function isGeneratedGame(gameId) {
  return !BUILTIN_GAMES[gameId] && !!generatedGames[gameId];
}

// Registers a brand new AI-generated game so it behaves identically to a built-in one from
// here on (versioning, theme inheritance, config updates) — persisted so it survives restarts.
function registerGeneratedGame(gameId, { title, description }) {
  generatedGames[gameId] = {
    ...GENERATED_GAME_TEMPLATE,
    title: title || gameId,
    description: description || `An AI-generated game: ${title || gameId}.`,
    generated: true
  };
  saveGeneratedGames();
}

function describeConfigSchemas() {
  return Object.entries(BUILTIN_GAMES)
    .map(([id, def]) => {
      const fields = Object.entries(def.configSchema)
        .map(([key, spec]) => {
          if (spec.type === "int") return `${key}: integer ${spec.min}-${spec.max}`;
          if (spec.type === "enum") return `${key}: one of "${spec.values.join('", "')}"`;
          if (spec.type === "colorMap") return `${key}: object of CSS colors for keys ${spec.keys.join(", ")}`;
          return key;
        })
        .join("; ");
      return `- ${id} (${def.title}): ${fields}`;
    })
    .join("\n");
}

module.exports = {
  getGameIds,
  getGameDef,
  isKnownGame,
  isGeneratedGame,
  registerGeneratedGame,
  describeConfigSchemas,
  GENERATED_GAME_TEMPLATE
};
