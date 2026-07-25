export type ConfigFieldSpec =
  | { type: "int"; min: number; max: number }
  | { type: "enum"; values: string[] }
  | { type: "colorMap"; keys: string[] };

export type ArtifactDef = {
  title: string;
  description: string;
  category: "GAME" | "TOOL" | "UTILITY" | "DASHBOARD" | "EDITOR";
  modes: string[];
  defaultConfig: Record<string, unknown>;
  configSchema: Record<string, ConfigFieldSpec>;
  // maps a chat theme field (--background/--foreground/--accent) to this artifact's own theme
  // key, used only to seed a brand new artifact's v0 so it starts looking like the chat's theme
  themeMap?: Record<string, string>;
  // short "how do I play this" hint per mode, shown in the in-game topbar
  controls?: Partial<Record<"bot" | "multiplayer", string>>;
};

// Ported from the original vanilla app's server/games/registry.js — same shape, generalized
// with a `category` field. tictactoe/snake/chess are re-hosted verbatim (see public/games/) via
// GameHost; only the config schema/versioning metadata lives here.
export const BUILTIN_ARTIFACTS: Record<string, ArtifactDef> = {
  tictactoe: {
    title: "Tic Tac Toe",
    description: "Classic N-in-a-row grid game. Play against the bot or a friend on the same device.",
    category: "GAME",
    modes: ["bot", "multiplayer"],
    defaultConfig: {
      boardSize: 3,
      winLength: 3,
      botDifficulty: "hard",
      theme: { bg: "#12141c", fg: "#e6e6f0", accent: "#6d8dff", x: "#6d8dff", o: "#ff6d6d" },
    },
    configSchema: {
      boardSize: { type: "int", min: 3, max: 6 },
      winLength: { type: "int", min: 3, max: 5 },
      botDifficulty: { type: "enum", values: ["easy", "medium", "hard"] },
      theme: { type: "colorMap", keys: ["bg", "fg", "accent", "x", "o"] },
    },
    themeMap: { "--background": "bg", "--foreground": "fg", "--accent": "accent" },
    controls: { bot: "Click a cell to place your mark.", multiplayer: "Click a cell to place your mark — take turns." },
  },
  snake: {
    title: "Snake",
    description: "Guide your snake to eat food and grow. Race the bot snake or play head-to-head with a friend.",
    category: "GAME",
    modes: ["bot", "multiplayer"],
    defaultConfig: {
      boardSize: 15,
      speedMs: 150,
      botDifficulty: "medium",
      theme: { bg: "#0d0f16", fg: "#e6e6f0", snake: "#39ff14", bot: "#ff9f40", food: "#ff5050" },
    },
    configSchema: {
      boardSize: { type: "int", min: 10, max: 25 },
      speedMs: { type: "int", min: 60, max: 400 },
      botDifficulty: { type: "enum", values: ["easy", "medium", "hard"] },
      theme: { type: "colorMap", keys: ["bg", "fg", "snake", "bot", "food"] },
    },
    themeMap: { "--background": "bg", "--foreground": "fg", "--accent": "snake" },
    controls: { bot: "Arrow keys to move.", multiplayer: "P1: Arrow keys · P2: WASD." },
  },
  chess: {
    title: "Chess",
    description: "The classic game of strategy. Play against the bot or a friend on the same device.",
    category: "GAME",
    modes: ["bot", "multiplayer"],
    defaultConfig: {
      botDifficulty: "medium",
      theme: { light: "#eeeed2", dark: "#769656", whitePiece: "#ffffff", blackPiece: "#202020", highlight: "#6d8dff" },
    },
    configSchema: {
      botDifficulty: { type: "enum", values: ["easy", "medium", "hard"] },
      theme: { type: "colorMap", keys: ["light", "dark", "whitePiece", "blackPiece", "highlight"] },
    },
    themeMap: { "--accent": "highlight" },
    controls: {
      bot: "Click a piece, then click a highlighted square to move.",
      multiplayer: "Click a piece, then click a highlighted square to move — take turns.",
    },
  },
};

// Every AI-generated artifact (anything not in BUILTIN_ARTIFACTS) shares this generic config
// shape until step 5's generation pipeline registers it with real metadata.
export const GENERATED_ARTIFACT_TEMPLATE = {
  modes: ["bot", "multiplayer"],
  defaultConfig: {
    botDifficulty: "medium",
    theme: { bg: "#12141c", fg: "#e6e6f0", accent: "#6d8dff" },
  },
  configSchema: {
    botDifficulty: { type: "enum" as const, values: ["easy", "medium", "hard"] },
    theme: { type: "colorMap" as const, keys: ["bg", "fg", "accent"] },
  },
  themeMap: { "--background": "bg", "--foreground": "fg", "--accent": "accent" },
};

const GENERIC_CONTROLS_HINT = "Use mouse clicks or keyboard controls as shown in the game.";

export function getControlsHint(slug: string, mode: string): string {
  const def = getBuiltinDef(slug);
  return def?.controls?.[mode as "bot" | "multiplayer"] ?? GENERIC_CONTROLS_HINT;
}

export function getBuiltinIds(): string[] {
  return Object.keys(BUILTIN_ARTIFACTS);
}

export function getBuiltinDef(slug: string): ArtifactDef | undefined {
  return BUILTIN_ARTIFACTS[slug];
}

export function describeConfigSchemas(): string {
  return Object.entries(BUILTIN_ARTIFACTS)
    .map(([slug, def]) => {
      const fields = Object.entries(def.configSchema)
        .map(([key, spec]) => {
          if (spec.type === "int") return `${key}: integer ${spec.min}-${spec.max}`;
          if (spec.type === "enum") return `${key}: one of "${spec.values.join('", "')}"`;
          if (spec.type === "colorMap") return `${key}: object of CSS colors for keys ${spec.keys.join(", ")}`;
          return key;
        })
        .join("; ");
      return `- ${slug} (${def.title}): ${fields}`;
    })
    .join("\n");
}
