const express = require("express");
const path = require("path");
const { getGameDef, getGameIds } = require("../games/registry");
const { getLatestVersion, getVersion, listGames } = require("../gameStore");

const router = express.Router();
const GAME_PAGE = path.join(__dirname, "..", "..", "public", "games", "index.html");

// All games ever opened, at their latest version — independent of chat session/reset.
router.get("/api/games", (_req, res) => {
  res.json({ games: listGames() });
});

// No version given: send the user to the latest version (creating v0 the first time).
router.get("/games/:gameId", (req, res) => {
  const { gameId } = req.params;
  if (!getGameIds().includes(gameId)) return res.status(404).send("Unknown game");
  const latest = getLatestVersion(gameId);
  res.redirect(`/games/${gameId}/${latest.version}`);
});

router.get("/games/:gameId/:version", (req, res) => {
  const { gameId } = req.params;
  if (!getGameIds().includes(gameId)) return res.status(404).send("Unknown game");
  res.sendFile(GAME_PAGE);
});

router.get("/api/games/:gameId/:version", (req, res) => {
  const { gameId, version } = req.params;
  const def = getGameDef(gameId);
  if (!def) return res.status(404).json({ error: "Unknown game" });

  const entry = getVersion(gameId, version);
  if (!entry) return res.status(404).json({ error: "Unknown version" });

  res.json({
    gameId,
    version: entry.version,
    label: entry.label,
    title: def.title,
    description: def.description,
    modes: def.modes,
    config: entry.config
  });
});

module.exports = router;
