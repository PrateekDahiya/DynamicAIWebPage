const path = require("path");
const express = require("express");
const chatRouter = require("./routes/chat");
const gamesRouter = require("./routes/games");
const logger = require("./logger");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode}`, { ms: Date.now() - start });
  });
  next();
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api", chatRouter);
app.use(gamesRouter);

app.listen(PORT, () => {
  logger.info(`Dynamic AI Chat running at http://localhost:${PORT}`);
});
