const path = require("path");
const express = require("express");
const chatRouter = require("./routes/chat");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api", chatRouter);

app.listen(PORT, () => {
  console.log(`Dynamic AI Chat running at http://localhost:${PORT}`);
});
