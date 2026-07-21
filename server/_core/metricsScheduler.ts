import {
  getPublishedPostsWithIgMedia,
  savePostMetric,
  upsertTemplatePerformance,
  getUserNicheForPerformance,
  getLatestMetricForPost,
} from "../db";

const TZ = "America/Fortaleza";
const RUN_HOUR = 3;
const ranToday = new Set<string>();

const SCORE_WEIGHTS = { saves: 4, shares: 3, comments: 2, likes: 1 } as const;

function calcRawScore(metrics: { reach: number; saves: number; shares: number; comments: number; likes: number }): number {
  const reach = Math.max(metrics.reach, 1);
  const weighted = metrics.saves * SCORE_WEIGHTS.saves + metrics.shares * SCORE_WEIGHTS.shares +
    metrics.comments * SCORE_WEIGHTS.comments + metrics.likes * SCORE_WEIGHTS.likes;
  return weighted / reach;
}

function normalizeScores(rawScores: number[]): number[] {
  if (rawScores.length === 0) return [];
  const sorted = [...rawScores].sort((a, b) => a - b);
  const medianIdx = Math.floor(sorted.length / 2);
  const median = sorted[medianIdx] ?? 0;
  if (median === 0) return rawScores.map(() => 50);
  return rawScores.map((s) => Math.min(100, Math.round((s / median) * 50)));
}

async function fetchIgMediaInsights(
  igMediaId: string,
  accessToken: string
): Promise<{ reach: number; saves: number; shares: number; comments: number; likes: number } | null> {
  try {
    const graphBase = "https://graph.facebook.com/v19.0";
    const [insightsResp, mediaResp] = await Promise.all([
      fetch(`${graphBase}/${igMediaId}/insights?metric=reach,saved,shares&period=lifetime&access_token=${accessToken}`).then((r) => r.json() as Promise<unknown>),
      fetch(`${graphBase}/${igMediaId}?fields=like_count,comments_count&access_token=${accessToken}`).then((r) => r.json() as Promise<unknown>),
    ]);

    const insights = insightsResp as { data?: Array<{ name: string; values: Array<{ value: number }> }> };
    const media = mediaResp as { like_count?: number; comments_count?: number };

    const getMetric = (name: string) => {
      const item = insights.data?.find((d) => d.name === name);
      return Number(item?.values?.[0]?.value ?? 0);
    };

    return {
      reach: getMetric("reach"),
      saves: getMetric("saved"),
      shares: getMetric("shares"),
      comments: Number(media.comments_count ?? 0),
      likes: Number(media.like_count ?? 0),
    };
  } catch {
    return null;
  }
}

async function collectMetrics(): Promise<void> {
  const { getInstagramConnection } = await import("../db");
  const posts = await getPublishedPostsWithIgMedia();
  if (posts.length === 0) return;

  const connectionCache = new Map<number, { accessToken: string } | null>();
  const getToken = async (userId: number) => {
    if (!connectionCache.has(userId)) {
      const conn = await getInstagramConnection(userId);
      connectionCache.set(userId, conn ? { accessToken: conn.accessToken } : null);
    }
    return connectionCache.get(userId) ?? null;
  };

  const rawScoresByNicheUser = new Map<string, number[]>();
  const postDataForAggregation: Array<{
    socialPostId: number;
    userId: number;
    niche: string;
    templateStyle: string;
    hookType: string;
    contentFormat: string;
    sourceKind: string;
    rawScore: number;
    normalizedScore: number;
  }> = [];

  // Collect metrics with limited concurrency (3 at a time)
  const CONCURRENCY = 3;
  const chunks: typeof posts[] = [];
  for (let i = 0; i < posts.length; i += CONCURRENCY) {
    chunks.push(posts.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (post) => {
        try {
          const conn = await getToken(post.userId);
          if (!conn) return;

          const metrics = await fetchIgMediaInsights(post.igMediaId, conn.accessToken);
          if (!metrics) return;

          const rawScore = calcRawScore(metrics);
          const niche = await getUserNicheForPerformance(post.userId);
          const templateStyle = post.style ?? "unknown";
          const hookType = post.hookType ?? "unknown";
          const contentFormat = post.contentFormat ?? "carousel";
          const sourceKind = post.sourceTopicAngleId != null ? "radar" : "manual";

          const nicheUserKey = `${post.userId}:${niche}`;
          if (!rawScoresByNicheUser.has(nicheUserKey)) rawScoresByNicheUser.set(nicheUserKey, []);
          rawScoresByNicheUser.get(nicheUserKey)!.push(rawScore);

          postDataForAggregation.push({
            socialPostId: post.id,
            userId: post.userId,
            niche,
            templateStyle,
            hookType,
            contentFormat,
            sourceKind,
            rawScore: Math.round(rawScore * 1000),
            normalizedScore: 0,
          });

          await savePostMetric({
            socialPostId: post.id,
            reach: metrics.reach,
            saves: metrics.saves,
            shares: metrics.shares,
            comments: metrics.comments,
            likes: metrics.likes,
            followsDelta: 0,
            rawScore: Math.round(rawScore * 1000),
            normalizedScore: 0,
          });
        } catch (e) {
          console.warn(`[MetricsScheduler] Failed for post ${post.id}:`, e);
        }
      })
    );
  }

  // Normalize scores within niche+user groups and update saved metrics
  for (const item of postDataForAggregation) {
    const nicheUserKey = `${item.userId}:${item.niche}`;
    const group = rawScoresByNicheUser.get(nicheUserKey) ?? [];
    const rawValues = group;
    const normalized = normalizeScores(rawValues);
    const idxInGroup = rawValues.indexOf(item.rawScore / 1000);
    item.normalizedScore = normalized[idxInGroup] ?? 50;
  }

  // Aggregate into template_performance
  const aggMap = new Map<string, { totalScore: number; count: number }>();
  for (const item of postDataForAggregation) {
    const key = `${item.userId}|${item.niche}|${item.templateStyle}|${item.hookType}|${item.contentFormat}|${item.sourceKind}`;
    const existing = aggMap.get(key) ?? { totalScore: 0, count: 0 };
    existing.totalScore += item.normalizedScore;
    existing.count += 1;
    aggMap.set(key, existing);
  }

  for (const [key, agg] of aggMap) {
    if (agg.count < 1) continue;
    const [userId, niche, templateStyle, hookType, contentFormat, sourceKind] = key.split("|");
    await upsertTemplatePerformance({
      userId: Number(userId),
      niche,
      templateStyle,
      hookType,
      contentFormat,
      sourceKind,
      avgScore: Math.round(agg.totalScore / agg.count),
      postCount: agg.count,
    });
  }

  console.log(`[MetricsScheduler] Collected metrics for ${postDataForAggregation.length} posts, updated ${aggMap.size} performance records.`);
}

export function startMetricsScheduler(): void {
  setInterval(async () => {
    const now = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());

    const hour = Number(now.find((p) => p.type === "hour")?.value ?? -1);
    const minute = Number(now.find((p) => p.type === "minute")?.value ?? -1);
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
    const runKey = `${dateKey}:${RUN_HOUR}`;

    if (hour === RUN_HOUR && minute < 2 && !ranToday.has(runKey)) {
      ranToday.add(runKey);
      ranToday.forEach((k) => { if (!k.startsWith(dateKey)) ranToday.delete(k); });
      console.log(`[MetricsScheduler] Collecting Instagram metrics at ${dateKey} ${hour}:${String(minute).padStart(2, "0")}...`);
      collectMetrics().catch((e) => console.error("[MetricsScheduler] Pipeline error:", e));
    }
  }, 60_000).unref();
}

export { collectMetrics as runMetricsPipeline };
