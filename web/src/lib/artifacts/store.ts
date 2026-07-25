import { prisma } from "@/lib/db";
import { isSafeCssValue } from "@/lib/action-schema";
import {
  getBuiltinDef,
  GENERATED_ARTIFACT_TEMPLATE,
  type ArtifactDef,
  type ConfigFieldSpec,
} from "./registry";
import { findSimilarArtifact } from "./fuzzy-match";
import type { ArtifactCategory } from "@/generated/prisma/client";

const MAX_VERSIONS_PER_ARTIFACT = 20;

export class ArtifactGenerationUnavailableError extends Error {
  constructor(slug: string) {
    super(
      `"${slug}" isn't a built-in app yet, and live generation isn't available in this build. Try tic tac toe, snake, or chess.`
    );
  }
}

function titleizeSlug(slug: string) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function defFromArtifact(row: { configSchema: string; modes: string | null }): {
  configSchema: Record<string, ConfigFieldSpec>;
  modes: string[];
} {
  return {
    configSchema: JSON.parse(row.configSchema),
    modes: row.modes ? JSON.parse(row.modes) : [],
  };
}

// Find-or-create: reuses an existing artifact by (userId, slug) if one exists, otherwise
// creates it from the built-in registry. Generalizes the original app's ensureGameExists —
// live AI generation for non-built-in slugs lands in step 5; until then this throws a clear,
// user-visible error instead of silently failing.
async function ensureArtifactExists(
  userId: string,
  chatId: string,
  slug: string,
  category: ArtifactCategory,
  titleHint?: string
) {
  const existing = await prisma.artifact.findUnique({ where: { userId_slug: { userId, slug } } });
  if (existing) return existing;

  const def: ArtifactDef | undefined = getBuiltinDef(slug);
  if (def) {
    return prisma.artifact.create({
      data: {
        userId,
        originChatId: chatId,
        slug,
        category: def.category as ArtifactCategory,
        title: def.title,
        description: def.description,
        modes: JSON.stringify(def.modes),
        configSchema: JSON.stringify(def.configSchema),
        themeMap: def.themeMap ? JSON.stringify(def.themeMap) : null,
        sourceType: "CONFIG_ONLY",
        isBuiltIn: true,
      },
    });
  }

  // Not a known built-in — step 5 will hook live generation in here. For now, be explicit
  // rather than silently registering a generic artifact with no runnable code behind it.
  void titleHint;
  void category;
  void GENERATED_ARTIFACT_TEMPLATE;
  throw new ArtifactGenerationUnavailableError(slug);
}

function seedThemeFromChat(
  defaultTheme: Record<string, unknown>,
  themeMap: Record<string, string> | undefined,
  currentTheme: Record<string, string> | undefined
) {
  if (!themeMap || !currentTheme) return defaultTheme;
  const seeded = { ...defaultTheme };
  for (const [chatKey, themeKey] of Object.entries(themeMap)) {
    if (currentTheme[chatKey]) (seeded as Record<string, unknown>)[themeKey] = currentTheme[chatKey];
  }
  return seeded;
}

async function getLatestVersion(artifactId: string, currentTheme?: Record<string, string>) {
  const latest = await prisma.artifactVersion.findFirst({
    where: { artifactId },
    orderBy: { createdAt: "desc" },
  });
  if (latest) return latest;

  const artifact = await prisma.artifact.findUniqueOrThrow({ where: { id: artifactId } });
  const def = getBuiltinDef(artifact.slug) ?? GENERATED_ARTIFACT_TEMPLATE;
  const themeMap = artifact.themeMap ? JSON.parse(artifact.themeMap) : def.themeMap;
  const theme = seedThemeFromChat(
    (def.defaultConfig as Record<string, unknown>).theme as Record<string, unknown>,
    themeMap,
    currentTheme
  );

  return prisma.artifactVersion.create({
    data: {
      artifactId,
      version: "v0",
      config: JSON.stringify({ ...def.defaultConfig, theme }),
      label: "original",
    },
  });
}

function mergeConfig(
  baseConfig: Record<string, unknown>,
  changes: Record<string, unknown> | undefined,
  schema: Record<string, ConfigFieldSpec>
) {
  const merged: Record<string, unknown> = JSON.parse(JSON.stringify(baseConfig));
  const changedKeys: string[] = [];

  for (const [key, spec] of Object.entries(schema)) {
    if (!changes || !(key in changes)) continue;
    const value = changes[key];

    if (spec.type === "int") {
      const n = Number(value);
      if (Number.isFinite(n)) {
        merged[key] = Math.min(spec.max, Math.max(spec.min, Math.round(n)));
        changedKeys.push(key);
      }
    } else if (spec.type === "enum") {
      if (spec.values.includes(value as string)) {
        merged[key] = value;
        changedKeys.push(key);
      }
    } else if (spec.type === "colorMap" && value && typeof value === "object") {
      const prevColorMap = (merged[key] as Record<string, string>) ?? {};
      const nextColorMap = { ...prevColorMap };
      let touched = false;
      for (const k of spec.keys) {
        const v = (value as Record<string, unknown>)[k];
        if (typeof v === "string" && isSafeCssValue(v)) {
          nextColorMap[k] = v.trim();
          touched = true;
        }
      }
      merged[key] = nextColorMap;
      if (touched) changedKeys.push(key);
    }
  }

  return { merged, changedKeys };
}

export async function resolveArtifactStart(
  userId: string,
  chatId: string,
  slug: string,
  category: ArtifactCategory,
  currentTheme: Record<string, string> | undefined,
  titleHint: string | undefined
) {
  const alreadyExists = await prisma.artifact.findUnique({ where: { userId_slug: { userId, slug } } });

  let suggestedReuse: { slug: string; title: string; url: string } | undefined;
  if (!alreadyExists) {
    const others = await prisma.artifact.findMany({
      where: { userId, category },
      select: { slug: true, title: true },
    });
    const match = findSimilarArtifact(slug, titleHint ?? slug, others);
    if (match) {
      const matchArtifact = await prisma.artifact.findUnique({ where: { userId_slug: { userId, slug: match.slug } } });
      if (matchArtifact) {
        const matchLatest = await getLatestVersion(matchArtifact.id);
        suggestedReuse = { slug: match.slug, title: match.title, url: `/apps/${match.slug}/${matchLatest.version}` };
      }
    }
  }

  const artifact = await ensureArtifactExists(userId, chatId, slug, category, titleHint);
  const latest = await getLatestVersion(artifact.id, currentTheme);
  return {
    slug,
    category: artifact.category,
    title: artifact.title,
    version: latest.version,
    url: `/apps/${slug}/${latest.version}`,
    suggestedReuse,
  };
}

export async function resolveArtifactUpdate(
  userId: string,
  chatId: string,
  slug: string,
  category: ArtifactCategory,
  changes: Record<string, unknown>,
  titleHint: string | undefined
) {
  const artifact = await ensureArtifactExists(userId, chatId, slug, category, titleHint);
  const latest = await getLatestVersion(artifact.id);
  const { configSchema } = defFromArtifact(artifact);

  const baseConfig = JSON.parse(latest.config);
  const { merged, changedKeys } = mergeConfig(baseConfig, changes, configSchema);

  const versionCount = await prisma.artifactVersion.count({ where: { artifactId: artifact.id } });

  const entry = await prisma.artifactVersion.create({
    data: {
      artifactId: artifact.id,
      version: `v${versionCount}`,
      parentVersionId: latest.id,
      config: JSON.stringify(merged),
      label: changedKeys.length ? `updated: ${changedKeys.join(", ")}` : "updated",
    },
  });

  if (versionCount + 1 > MAX_VERSIONS_PER_ARTIFACT) {
    const versions = await prisma.artifactVersion.findMany({
      where: { artifactId: artifact.id },
      orderBy: { createdAt: "asc" },
      take: 2,
    });
    // never drop v0 (versions[0]); drop the oldest fork instead
    if (versions[1]) await prisma.artifactVersion.delete({ where: { id: versions[1].id } });
  }

  return {
    slug,
    category: artifact.category,
    title: artifact.title,
    version: entry.version,
    label: entry.label,
    url: `/apps/${slug}/${entry.version}`,
  };
}

export async function listArtifactInventory(userId: string) {
  return prisma.artifact.findMany({ where: { userId }, select: { slug: true, title: true, category: true } });
}

export async function listArtifacts(userId: string) {
  const artifacts = await prisma.artifact.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return artifacts
    .filter((a) => a.versions.length > 0)
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      description: a.description,
      category: a.category,
      version: a.versions[0].version,
      label: a.versions[0].label,
      updatedAt: a.updatedAt,
      url: `/apps/${a.slug}/${a.versions[0].version}`,
    }));
}

export async function getArtifactWithVersions(userId: string, slug: string) {
  return prisma.artifact.findUnique({
    where: { userId_slug: { userId, slug } },
    include: { versions: { orderBy: { createdAt: "asc" } } },
  });
}

// Registers a freshly AI-generated artifact and its v0 (seeded from the chat's current theme,
// same as built-ins) — called once code generation has already succeeded (see generator.ts /
// generation-jobs.ts). titleHint is used as the display title.
export async function registerGeneratedArtifact(
  userId: string,
  chatId: string,
  slug: string,
  category: ArtifactCategory,
  title: string,
  description: string,
  codeFilePath: string,
  codeHash: string,
  currentTheme: Record<string, string> | undefined
) {
  const existing = await prisma.artifact.findUnique({ where: { userId_slug: { userId, slug } } });
  if (existing) return existing;

  const artifact = await prisma.artifact.create({
    data: {
      userId,
      originChatId: chatId,
      slug,
      category,
      title,
      description,
      modes: JSON.stringify(GENERATED_ARTIFACT_TEMPLATE.modes),
      configSchema: JSON.stringify(GENERATED_ARTIFACT_TEMPLATE.configSchema),
      themeMap: JSON.stringify(GENERATED_ARTIFACT_TEMPLATE.themeMap),
      sourceType: "GENERATED_CODE",
      isBuiltIn: false,
    },
  });

  const theme = seedThemeFromChat(
    GENERATED_ARTIFACT_TEMPLATE.defaultConfig.theme,
    GENERATED_ARTIFACT_TEMPLATE.themeMap,
    currentTheme
  );

  await prisma.artifactVersion.create({
    data: {
      artifactId: artifact.id,
      version: "v0",
      config: JSON.stringify({ ...GENERATED_ARTIFACT_TEMPLATE.defaultConfig, theme }),
      codeFilePath,
      codeHash,
      label: "original",
    },
  });

  return artifact;
}

export async function getLatestVersionUrl(artifactId: string, slug: string) {
  const latest = await getLatestVersion(artifactId);
  return `/apps/${slug}/${latest.version}`;
}

export async function getArtifactVersionCodePath(userId: string, slug: string, version: string) {
  const artifact = await prisma.artifact.findUnique({ where: { userId_slug: { userId, slug } } });
  if (!artifact) return null;

  const entry = await prisma.artifactVersion.findUnique({
    where: { artifactId_version: { artifactId: artifact.id, version } },
  });
  return entry?.codeFilePath ?? null;
}
