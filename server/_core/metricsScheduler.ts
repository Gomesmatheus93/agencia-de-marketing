import {
  getPublishedPostsWithIgMedia,
  savePostMetric,
  upsertTemplatePerformance,
  getUserNicheForPerformance,
  getLatestMetricForPost,
  getAllInstagramConnections,
  saveInstagramAccountInsightsSnapshot,
} from "../db";
import { ENV } from "./env";
import type { InstagramDemographicsBreakdown } from "../../drizzle/schema";

function graphBaseUrl(): string {
  const base = (ENV.metaGraphApiBaseUrl || "https://graph.facebook.com").replace(/\/+$/, "");
  const version = (ENV.metaGraphApiVersion || "v25.0").replace(/^\/+/, "");
  return `${base}/${version}`;
}

async function fetchGraphMetric(path: string, params: Record<string, string>, accessToken: string): Promise<{ name: string; value: number }[]> {
  try {
    const qs = new URLSearchParams({ ...params, access_token: accessToken }).toString();
    const res = await fetch(`${graphBaseUrl()}/${path}?${qs}`);
    const data = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value?: number; breakdowns?: Array<{ results?: Array<{ dimension_values: string[]; value: number }> }> } }>;
      error?: { message?: string };
    };
    if (!res.ok || data.error) return [];
    return (data.data ?? []).map((d) => ({
      name: d.name,
      value: d.total_value?.value ?? d.values?.[0]?.value ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchGraphBreakdown(path: string, metric: string, breakdown: string, accessToken: string): Promise<Array<{ dimension: string; value: number }>> {
  try {
    const qs = new URLSearchParams({
      metric,
      period: "lifetime",
      metric_type: "total_value",
      breakdown,
      access_token: accessToken,
    }).toString();
    const res = await fetch(`${graphBaseUrl()}/${path}?${qs}`);
    const data = (await res.json()) as {
      data?: Array<{ total_value?: { breakdowns?: Array<{ results?: Array<{ dimension_values: string[]; value: number }> }> } }>;
      error?: { message?: string };
    };
    if (!res.ok || data.error) return [];
    const results = data.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    return results.map((r) => ({ dimension: r.dimension_values.join(" / "), value: r.value }));
  } catch {
    return [];
  }
}

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

// One request per metric — a single unsupported metric (e.g. "impressions" on a Reel) makes the
// Graph API reject the *entire* comma-joined call, so per-metric isolation is what keeps the rest
// of the numbers flowing when one doesn't apply to this media type.
async function fetchSingleMediaMetric(igMediaId: string, metric: string, accessToken: string): Promise<number> {
  try {
    const res = await fetch(
      `${graphBaseUrl()}/${igMediaId}/insights?metric=${metric}&period=lifetime&access_token=${accessToken}`
    );
    const data = (await res.json()) as {
      data?: Array<{ values?: Array<{ value: number }> }>;
      error?: { message?: string };
    };
    if (!res.ok || data.error) return 0;
    return Number(data.data?.[0]?.values?.[0]?.value ?? 0);
  } catch {
    return 0;
  }
}

async function fetchIgMediaInsights(
  igMediaId: string,
  accessToken: string,
  isReel: boolean
): Promise<{ reach: number; saves: number; shares: number; comments: number; likes: number; impressions: number; videoViews: number; avgWatchTimeMs: number } | null> {
  try {
    const baseMetrics = ["reach", "saved", "shares"];
    const extraMetrics = isReel ? ["views", "ig_reels_avg_watch_time"] : ["impressions"];

    const [mediaResp, ...metricResults] = await Promise.all([
      fetch(`${graphBaseUrl()}/${igMediaId}?fields=like_count,comments_count&access_token=${accessToken}`).then((r) => r.json() as Promise<unknown>),
      ...[...baseMetrics, ...extraMetrics].map((m) => fetchSingleMediaMetric(igMediaId, m, accessToken)),
    ]);

    const media = mediaResp as { like_count?: number; comments_count?: number };
    const values = new Map(([...baseMetrics, ...extraMetrics] as string[]).map((m, i) => [m, metricResults[i] as number]));

    return {
      reach: values.get("reach") ?? 0,
      saves: values.get("saved") ?? 0,
      shares: values.get("shares") ?? 0,
      comments: Number(media.comments_count ?? 0),
      likes: Number(media.like_count ?? 0),
      impressions: values.get("impressions") ?? 0,
      videoViews: values.get("views") ?? 0,
      avgWatchTimeMs: values.get("ig_reels_avg_watch_time") ?? 0,
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

          const isReel = post.contentType === "reels";
          const metrics = await fetchIgMediaInsights(post.igMediaId, conn.accessToken, isReel);
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
            impressions: metrics.impressions,
            videoViews: metrics.videoViews,
            avgWatchTimeMs: metrics.avgWatchTimeMs,
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

const PROFILE_ACTION_METRICS = [
  "website_clicks",
  "phone_call_clicks",
  "email_contacts",
  "text_message_clicks",
  "get_directions_clicks",
  "total_interactions",
  "accounts_engaged",
] as const;

async function collectAccountInsights(): Promise<void> {
  const connections = await getAllInstagramConnections();
  if (connections.length === 0) return;

  let collected = 0;
  for (const conn of connections) {
    try {
      const [genderAge, city, country, ...actionResults] = await Promise.all([
        fetchGraphBreakdown(`${conn.instagramAccountId}/insights`, "follower_demographics", "age,gender", conn.accessToken),
        fetchGraphBreakdown(`${conn.instagramAccountId}/insights`, "follower_demographics", "city", conn.accessToken),
        fetchGraphBreakdown(`${conn.instagramAccountId}/insights`, "follower_demographics", "country", conn.accessToken),
        ...PROFILE_ACTION_METRICS.map((metric) =>
          fetchGraphMetric(`${conn.instagramAccountId}/insights`, { metric, period: "day" }, conn.accessToken)
        ),
      ]);

      const actionValues = new Map<string, number>();
      PROFILE_ACTION_METRICS.forEach((metric, i) => {
        const found = (actionResults[i] as Array<{ name: string; value: number }>).find((d) => d.name === metric);
        actionValues.set(metric, found?.value ?? 0);
      });

      const demographics: InstagramDemographicsBreakdown = {};
      if (genderAge.length) demographics.genderAge = genderAge;
      if (city.length) demographics.city = city;
      if (country.length) demographics.country = country;

      await saveInstagramAccountInsightsSnapshot({
        userId: conn.userId,
        demographics: Object.keys(demographics).length ? demographics : undefined,
        websiteClicks: actionValues.get("website_clicks") ?? 0,
        phoneCallClicks: actionValues.get("phone_call_clicks") ?? 0,
        emailContacts: actionValues.get("email_contacts") ?? 0,
        textMessageClicks: actionValues.get("text_message_clicks") ?? 0,
        getDirectionsClicks: actionValues.get("get_directions_clicks") ?? 0,
        totalInteractions: actionValues.get("total_interactions") ?? 0,
        accountsEngaged: actionValues.get("accounts_engaged") ?? 0,
      });
      collected += 1;
    } catch (e) {
      console.warn(`[MetricsScheduler] Account insights failed for user ${conn.userId}:`, e);
    }
  }

  console.log(`[MetricsScheduler] Collected account insights snapshot for ${collected}/${connections.length} connected accounts.`);
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
      collectAccountInsights().catch((e) => console.error("[MetricsScheduler] Account insights pipeline error:", e));
    }
  }, 60_000).unref();
}

export { collectMetrics as runMetricsPipeline, collectAccountInsights as runAccountInsightsPipeline };
