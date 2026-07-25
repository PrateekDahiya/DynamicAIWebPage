const CSS_VAR_NAME_RE = /^--[a-zA-Z0-9-]+$/;
const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)$/;
const LENGTH_RE = /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw)$/;
// Any app name is allowed for CREATE_APP/OPEN_APP — an unknown slug either resolves to a
// built-in or (step 5) triggers on-the-fly generation, rather than being rejected here. Just
// constrain it to a short, filesystem-and-URL-safe slug.
const SLUG_RE = /^[a-z][a-z0-9-]{0,29}$/;

export const ANIMATION_EFFECTS = ["particles", "snow", "stars", "rain", "gradient-shift", "none"] as const;
export type AnimationEffect = (typeof ANIMATION_EFFECTS)[number];

export const ARTIFACT_CATEGORIES = ["GAME", "TOOL", "UTILITY", "DASHBOARD", "EDITOR"] as const;
export type ArtifactCategoryValue = (typeof ARTIFACT_CATEGORIES)[number];

export type ThemeVars = Record<string, string>;
export type ThemeBackground = { type: "solid" | "gradient"; value: string };
export type ThemeAnimation = { target: string; effect: AnimationEffect; intensity: number };

export type Action =
  | { type: "SET_THEME"; vars?: ThemeVars; background?: ThemeBackground; animation?: ThemeAnimation }
  | { type: "UPDATE_THEME"; vars?: ThemeVars; background?: ThemeBackground; animation?: ThemeAnimation }
  | { type: "RESET_THEME" }
  | { type: "CREATE_APP" | "OPEN_APP"; slug: string; category: ArtifactCategoryValue; title?: string }
  | { type: "UPDATE_APP"; slug: string; category: ArtifactCategoryValue; changes: Record<string, unknown> };

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

function sanitizeCategory(category: unknown): ArtifactCategoryValue {
  return ARTIFACT_CATEGORIES.includes(category as ArtifactCategoryValue)
    ? (category as ArtifactCategoryValue)
    : "GAME";
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
    case "CREATE_APP":
    case "OPEN_APP": {
      if (typeof action.slug !== "string" || !SLUG_RE.test(action.slug)) return null;
      const title = typeof action.title === "string" ? action.title.trim().slice(0, 60) : undefined;
      return { type: action.type, slug: action.slug, category: sanitizeCategory(action.category), title };
    }
    case "UPDATE_APP": {
      if (typeof action.slug !== "string" || !SLUG_RE.test(action.slug)) return null;
      const changes = action.changes && typeof action.changes === "object" ? (action.changes as Record<string, unknown>) : {};
      return { type: "UPDATE_APP", slug: action.slug, category: sanitizeCategory(action.category), changes };
    }
    default:
      return null;
  }
}

export function sanitizeActions(actions: unknown): Action[] {
  if (!Array.isArray(actions)) return [];
  return actions.map(sanitizeAction).filter((a): a is Action => a !== null).slice(0, 20);
}
