const CSS_VAR_NAME_RE = /^--[a-zA-Z0-9-]+$/;
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)$/;
const LENGTH_RE = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw)$/;

export const ANIMATION_EFFECTS = ["particles", "snow", "stars", "rain", "gradient-shift", "none"] as const;
export type AnimationEffect = (typeof ANIMATION_EFFECTS)[number];

export type ThemeVars = Record<string, string>;
export type ThemeBackground = { type: "solid" | "gradient"; value: string };
export type ThemeAnimation = { target: string; effect: AnimationEffect; intensity: number };

export type Action =
  | { type: "SET_THEME"; vars?: ThemeVars; background?: ThemeBackground; animation?: ThemeAnimation }
  | { type: "UPDATE_THEME"; vars?: ThemeVars; background?: ThemeBackground; animation?: ThemeAnimation }
  | { type: "RESET_THEME" };

export function isSafeCssValue(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return false;
  const trimmed = value.trim();
  return (
    COLOR_RE.test(trimmed) ||
    LENGTH_RE.test(trimmed) ||
    /^[a-zA-Z0-9\s,#().%'-]+$/.test(trimmed)
  );
}

function sanitizeVars(vars: unknown): ThemeVars | undefined {
  if (!vars || typeof vars !== "object") return undefined;
  const out: ThemeVars = {};
  for (const [key, value] of Object.entries(vars as Record<string, unknown>)) {
    if (!CSS_VAR_NAME_RE.test(key)) continue;
    if (!isSafeCssValue(value)) continue;
    out[key] = (value as string).trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeBackground(background: unknown): ThemeBackground | undefined {
  if (!background || typeof background !== "object") return undefined;
  const { type, value } = background as Record<string, unknown>;
  if ((type === "solid" || type === "gradient") && isSafeCssValue(value)) {
    return { type, value: (value as string).trim() };
  }
  return undefined;
}

function sanitizeAnimation(animation: unknown): ThemeAnimation | undefined {
  if (!animation || typeof animation !== "object") return undefined;
  const { target, effect, intensity } = animation as Record<string, unknown>;
  if (!ANIMATION_EFFECTS.includes(effect as AnimationEffect)) return undefined;
  const numIntensity = Number(intensity);
  return {
    target: typeof target === "string" ? target : "background",
    effect: effect as AnimationEffect,
    intensity: Number.isFinite(numIntensity) ? Math.min(3, Math.max(0.1, numIntensity)) : 1,
  };
}

function sanitizeAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== "object" || typeof (raw as Record<string, unknown>).type !== "string") {
    return null;
  }
  const action = raw as Record<string, unknown>;

  switch (action.type) {
    case "SET_THEME":
    case "UPDATE_THEME": {
      const vars = sanitizeVars(action.vars);
      const background = sanitizeBackground(action.background);
      const animation = sanitizeAnimation(action.animation);
      if (!vars && !background && !animation) return null;
      return { type: action.type, vars, background, animation };
    }
    case "RESET_THEME":
      return { type: "RESET_THEME" };
    default:
      return null;
  }
}

export function sanitizeActions(actions: unknown): Action[] {
  if (!Array.isArray(actions)) return [];
  return actions.map(sanitizeAction).filter((a): a is Action => a !== null).slice(0, 20);
}
