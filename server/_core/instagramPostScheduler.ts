import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { publishInstagramSocialPost } from "./instagramSocialPostPublisher";
import { getPostSchedulerTimeZone } from "./postScheduling";

const DEFAULT_POLL_INTERVAL_MS = 60_000;

function getPollIntervalMs() {
  const configured = Number(process.env.INSTAGRAM_SCHEDULER_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 5_000 ? configured : DEFAULT_POLL_INTERVAL_MS;
}

async function publishDueInstagramPosts() {
  const posts = await db.getDueScheduledInstagramPosts(new Date(), 10);

  for (const post of posts) {
    try {
      const { result, publicImageUrl } = await publishInstagramSocialPost(post);
      await db.updateSocialPost(post.id, post.userId, {
        status: "published",
        publishedAt: new Date(),
        imageUrl: publicImageUrl,
      });
      console.log(`[InstagramScheduler] Published scheduled post ${post.id}: ${result.mediaId}`);
    } catch (error) {
      const message =
        error instanceof TRPCError
          ? error.message
          : error instanceof Error
            ? error.message
            : "falha desconhecida";
      await db.updateSocialPost(post.id, post.userId, {
        status: "failed",
      });
      console.warn(`[InstagramScheduler] Failed to publish scheduled post ${post.id}: ${message}`);
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
