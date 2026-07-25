const logger = require("./logger");

const CSS_VAR_NAME_RE = /^--[a-zA-Z0-9-]+$/;
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)$/;
const LENGTH_RE = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw)$/;
// Any game name is allowed — an unknown gameId triggers on-the-fly generation rather than
// being rejected (see server/gameStore.js's ensureGameExists). Just constrain it to a short,
// filesystem-and-URL-safe slug.
const GAME_ID_RE = /^[a-z][a-z0-9-]{0,29}$/;

const WIDGET_IDS = ["calculator", "timer", "todo", "chart", "notes"];
const ANIMATION_EFFECTS = ["particles", "snow", "stars", "rain", "gradient-shift", "none"];
const ANIMATION_TARGETS = ["background", "#chat", "#app"];
const LAYOUT_TARGETS = ["#chat", "#app", "#widgets"];

function isSafeCssValue(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return false;
  return COLOR_RE.test(value.trim()) || LENGTH_RE.test(value.trim()) || /^[a-zA-Z0-9\s,#().%-]+$/.test(value.trim());
}

function sanitizeVars(vars) {
  if (!vars || typeof vars !== "object") return undefined;
  const out = {};
  for (const [key, value] of Object.entries(vars)) {
    if (!CSS_VAR_NAME_RE.test(key)) continue;
    if (!isSafeCssValue(value)) continue;
    out[key] = value.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeAction(action) {
  if (!action || typeof action !== "object" || typeof action.type !== "string") return null;

  switch (action.type) {
    case "setTheme": {
      const vars = sanitizeVars(action.vars);
      let background;
      if (action.background && typeof action.background === "object") {
        const { type, value } = action.background;
        if (["solid", "gradient"].includes(type) && isSafeCssValue(value)) {
          background = { type, value: value.trim() };
        }
      }
      if (!vars && !background) return null;
      return { type: "setTheme", vars, background };
    }
    case "animateElement": {
      const target = ANIMATION_TARGETS.includes(action.target) ? action.target : "background";
      const effect = ANIMATION_EFFECTS.includes(action.effect) ? action.effect : "none";
      let intensity = Number(action.intensity);
      if (!Number.isFinite(intensity)) intensity = 1;
      intensity = Math.min(3, Math.max(0.1, intensity));
      return { type: "animateElement", target, effect, intensity };
    }
    case "updateLayout": {
      const target = LAYOUT_TARGETS.includes(action.target) ? action.target : null;
      const style = sanitizeVars(action.style) || sanitizeStyleObject(action.style);
      if (!target || !style) return null;
      return { type: "updateLayout", target, style };
    }
    case "createWidget": {
      if (!WIDGET_IDS.includes(action.widgetId)) {
        logger.warn(`Dropped createWidget: unknown widgetId "${action.widgetId}"`, { knownWidgetIds: WIDGET_IDS });
        return null;
      }
      return {
        type: "createWidget",
        widgetId: action.widgetId,
        mountPoint: typeof action.mountPoint === "string" ? action.mountPoint : "#widgets",
        props: action.props && typeof action.props === "object" ? action.props : {}
      };
    }
    case "startGame": {
      if (typeof action.gameId !== "string" || !GAME_ID_RE.test(action.gameId)) {
        logger.warn(`Dropped startGame: invalid gameId "${action.gameId}"`);
        return null;
      }
      const title = typeof action.title === "string" ? action.title.trim().slice(0, 60) : undefined;
      return { type: "startGame", gameId: action.gameId, title };
    }
    case "updateGame": {
      if (typeof action.gameId !== "string" || !GAME_ID_RE.test(action.gameId)) {
        logger.warn(`Dropped updateGame: invalid gameId "${action.gameId}"`);
        return null;
      }
      const changes = action.changes && typeof action.changes === "object" ? action.changes : {};
      return { type: "updateGame", gameId: action.gameId, changes };
    }
    case "removeWidget": {
      if (typeof action.mountPoint !== "string" && typeof action.widgetId !== "string") return null;
      return {
        type: "removeWidget",
        mountPoint: action.mountPoint,
        widgetId: action.widgetId
      };
    }
    default:
      logger.warn(`Dropped action: unknown type "${action.type}"`);
      return null;
  }
}

function sanitizeStyleObject(style) {
  if (!style || typeof style !== "object") return undefined;
  const allowedProps = ["flexDirection", "justifyContent", "alignItems", "width", "height", "position", "top", "left", "right", "bottom", "order"];
  const out = {};
  for (const [key, value] of Object.entries(style)) {
    if (!allowedProps.includes(key)) continue;
    if (typeof value !== "string" || !isSafeCssValue(value)) continue;
    out[key] = value.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map(sanitizeAction).filter(Boolean).slice(0, 20);
}

module.exports = {
  sanitizeActions,
  isSafeCssValue,
  WIDGET_IDS,
  ANIMATION_EFFECTS
};
