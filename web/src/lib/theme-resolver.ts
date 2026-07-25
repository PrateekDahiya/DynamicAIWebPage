import { prisma } from "@/lib/db";
import type { Action, ThemeVars, ThemeBackground, ThemeAnimation } from "@/lib/action-schema";

type ThemeAction = Extract<Action, { type: "SET_THEME" | "UPDATE_THEME" | "RESET_THEME" }>;

// Resolves a sanitized theme action into its fully-merged CSS state (UPDATE_THEME layers onto
// the chat's previous latest Theme row; SET_THEME replaces wholesale) and persists a new
// append-only Theme row — mirrors the config-merge/versioning pattern from the original app's
// gameStore.js, generalized to the page-wide theme instead of per-game config.
export async function resolveThemeAction(chatId: string, action: ThemeAction) {
  if (action.type === "RESET_THEME") {
    await prisma.theme.create({
      data: { chatId, vars: null, background: null, animation: null, action: "RESET_THEME" },
    });
    return { type: "RESET_THEME" as const };
  }

  let vars: ThemeVars = action.vars ?? {};
  let background: ThemeBackground | undefined = action.background;
  let animation: ThemeAnimation | undefined = action.animation;

  if (action.type === "UPDATE_THEME") {
    const latest = await prisma.theme.findFirst({ where: { chatId }, orderBy: { createdAt: "desc" } });
    const prevVars: ThemeVars = latest?.vars ? JSON.parse(latest.vars) : {};
    vars = { ...prevVars, ...vars };
    background = action.background ?? (latest?.background ? JSON.parse(latest.background) : undefined);
    animation = action.animation ?? (latest?.animation ? JSON.parse(latest.animation) : undefined);
  }

  await prisma.theme.create({
    data: {
      chatId,
      vars: Object.keys(vars).length ? JSON.stringify(vars) : null,
      background: background ? JSON.stringify(background) : null,
      animation: animation ? JSON.stringify(animation) : null,
      action: action.type,
    },
  });

  return { type: action.type, vars, background, animation };
}

function isThemeAction(action: Action): action is ThemeAction {
  return action.type === "SET_THEME" || action.type === "UPDATE_THEME" || action.type === "RESET_THEME";
}

export async function resolveThemeActions(chatId: string, actions: Action[]) {
  const resolved = [];
  for (const action of actions.filter(isThemeAction)) {
    resolved.push(await resolveThemeAction(chatId, action));
  }
  return resolved;
}
