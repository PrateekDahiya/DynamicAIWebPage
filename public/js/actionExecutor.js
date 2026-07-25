import { applySetTheme, applyAnimateElement } from "./actions/theme.js";
import { applyUpdateLayout, applyRemoveWidget } from "./actions/layout.js";
import { applyCreateWidget } from "./actions/widgets.js";
import { applyStartGame, applyUpdateGame } from "./actions/games.js";
import { appendBubble } from "./chat.js";

function applyGameGenerationFailed(action) {
  appendBubble("system", `⚠️ Couldn't build "${action.gameId}": ${action.message || "unknown error"}`);
}

const handlers = {
  setTheme: applySetTheme,
  animateElement: applyAnimateElement,
  updateLayout: applyUpdateLayout,
  removeWidget: applyRemoveWidget,
  createWidget: applyCreateWidget,
  startGame: applyStartGame,
  updateGame: applyUpdateGame,
  gameGenerationFailed: applyGameGenerationFailed
};

export function executeActions(actions) {
  if (!Array.isArray(actions)) return;
  for (const action of actions) {
    const handler = handlers[action?.type];
    if (!handler) continue;
    try {
      handler(action);
    } catch (err) {
      console.error(`Failed to apply action ${action.type}:`, err);
    }
  }
}
