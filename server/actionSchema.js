const { getGameIds } = require("./games/registry");

const CSS_VAR_NAME_RE = /^--[a-zA-Z0-9-]+$/;
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)$/;
const LENGTH_RE = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw)$/;

const WIDGET_IDS = ["calculator", "timer", "todo", "chart", "notes"];
const GAME_IDS = getGameIds();
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
      if (!WIDGET_IDS.includes(action.widgetId)) return null;
      return {
        type: "createWidget",
        widgetId: action.widgetId,
        mountPoint: typeof action.mountPoint === "string" ? action.mountPoint : "#widgets",
        props: action.props && typeof action.props === "object" ? action.props : {}
      };
    }
    case "startGame": {
      if (!GAME_IDS.includes(action.gameId)) return null;
      return { type: "startGame", gameId: action.gameId };
    }
    case "updateGame": {
      if (!GAME_IDS.includes(action.gameId)) return null;
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
  GAME_IDS,
  ANIMATION_EFFECTS
};
