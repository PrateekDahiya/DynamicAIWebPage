const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "data", "app.log");

function safeStringify(meta) {
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

function write(level, message, meta) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${
    meta !== undefined ? " " + safeStringify(meta) : ""
  }`;
  (level === "error" ? console.error : console.log)(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // best-effort file logging only — never let logging itself break a request
  }
}

module.exports = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta)
};
