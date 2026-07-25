const GAMES = {
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
  }
};

function getGameIds() {
  return Object.keys(GAMES);
}

function getGameDef(gameId) {
  return GAMES[gameId];
}

function describeConfigSchemas() {
  return Object.entries(GAMES)
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

module.exports = { GAMES, getGameIds, getGameDef, describeConfigSchemas };
