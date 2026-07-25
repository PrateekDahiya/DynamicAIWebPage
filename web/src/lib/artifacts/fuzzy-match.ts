// Deterministic, non-LLM safety net against the model inventing a near-duplicate slug (e.g.
// "connect4" when "connect-four" already exists) — normalized Levenshtein distance, not a model
// call, so it costs nothing extra per turn.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.6;

export function findSimilarArtifact<T extends { slug: string; title: string }>(
  candidateSlug: string,
  candidateTitle: string,
  existing: T[]
): T | null {
  let best: { item: T; score: number } | null = null;
  for (const item of existing) {
    if (item.slug === candidateSlug) continue; // exact match is handled elsewhere, not "similar"
    const score = Math.max(similarity(candidateSlug, item.slug), similarity(candidateTitle, item.title));
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { item, score };
    }
  }
  return best?.item ?? null;
}
