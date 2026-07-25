import { applySetTheme, applyAnimateElement } from "./actions/theme.js";
import { applyUpdateLayout, applyRemoveWidget } from "./actions/layout.js";
import { applyCreateWidget } from "./actions/widgets.js";
import { applyStartGame, applyUpdateGame } from "./actions/games.js";

const handlers = {
  setTheme: applySetTheme,
  animateElement: applyAnimateElement,
  updateLayout: applyUpdateLayout,
  removeWidget: applyRemoveWidget,
  createWidget: applyCreateWidget,
  startGame: applyStartGame,
  updateGame: applyUpdateGame
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
