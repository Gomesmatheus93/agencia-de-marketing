import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { publishInstagramSocialPost } from "./instagramSocialPostPublisher";
import { getPostSchedulerTimeZone } from "./postScheduling";
import { acquireSchedulerLock } from "./redis";

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MINUTES = [5, 15, 45]; // by retry attempt (0-indexed)

function getPollIntervalMs() {
  const configured = Number(process.env.INSTAGRAM_SCHEDULER_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 5_000 ? configured : DEFAULT_POLL_INTERVAL_MS;
}

// Token/permission errors need a manual reconnect (see instagramPostingAgent's
// TOKEN_EXPIRED_MSG) — retrying those automatically would just fail the same
// way every time, so only transient errors (rate limits, upload hiccups,
// container-not-ready) get retried.
function isAuthError(message: string): boolean {
  return message.includes("Token do Instagram expirado ou inválido");
}

async function publishDueInstagramPosts() {
  const posts = await db.getDueScheduledInstagramPosts(new Date(), 10);

  if (posts.length > 0) {
    console.log(`[InstagramScheduler] ${posts.length} post(s) due for publishing.`);
  }

  for (const post of posts) {
    const tag = `[InstagramScheduler] post=${post.id} user=${post.userId}`;
    console.log(`${tag} Starting publish. scheduledAt=${post.scheduledAt?.toISOString()}`);

    try {
      const { result, publicImageUrl } = await publishInstagramSocialPost(post);
      await db.updateSocialPost(post.id, post.userId, {
        status: "published",
        publishedAt: new Date(),
        imageUrl: publicImageUrl,
        errorMessage: null,
      });
      console.log(`${tag} Published successfully. mediaId=${result.mediaId} slides=${result.slideUrls.length}`);
    } catch (error) {
      const isTrpc = error instanceof TRPCError;
      const message = isTrpc
        ? error.message
        : error instanceof Error
          ? error.message
          : "falha desconhecida";
      const errorType = isTrpc ? `TRPCError(${error.code})` : (error instanceof Error ? error.constructor.name : "unknown");
      const stack = error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : "";

      const logMessage = `${errorType}: ${message}`;
      console.error(`${tag} FAILED. ${logMessage}`);
      if (stack) console.error(`${tag} stack: ${stack}`);

      const retryCount = post.retryCount ?? 0;
      const canRetry = !isAuthError(message) && retryCount < MAX_RETRIES;

      try {
        if (canRetry) {
          const backoffMinutes = RETRY_BACKOFF_MINUTES[retryCount] ?? RETRY_BACKOFF_MINUTES[RETRY_BACKOFF_MINUTES.length - 1];
          const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60_000);
          console.warn(`${tag} Will retry (attempt ${retryCount + 1}/${MAX_RETRIES}) at ${nextAttemptAt.toISOString()}.`);
          await db.updateSocialPost(post.id, post.userId, {
            status: "scheduled",
            scheduledAt: nextAttemptAt,
            retryCount: retryCount + 1,
            errorMessage: logMessage.slice(0, 1000),
          });
        } else {
          await db.updateSocialPost(post.id, post.userId, {
            status: "failed",
            errorMessage: logMessage.slice(0, 1000),
          });
        }
      } catch (dbErr) {
        console.error(`${tag} Also failed to save error to DB:`, dbErr);
      }
    }
  }
}

export function startInstagramPostScheduler() {
  const pollIntervalMs = getPollIntervalMs();
  console.log(
    `[InstagramScheduler] Running every ${pollIntervalMs}ms in ${getPostSchedulerTimeZone()} time.`
  );
  let isRunning = false;

  const tick = async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      if (!(await acquireSchedulerLock("instagram-post", Math.floor(pollIntervalMs * 0.9)))) return;
      await publishDueInstagramPosts();
    } catch (error) {
      console.warn("[InstagramScheduler] Scheduler tick failed:", error);
    } finally {
      isRunning = false;
    }
  };

  void tick();
  const interval = setInterval(() => {
    void tick();
  }, pollIntervalMs);

  return () => clearInterval(interval);
}
