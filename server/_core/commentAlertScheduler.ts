import {
  getAllInstagramConnections,
  getCommentPollCount,
  upsertCommentPollState,
  insertCommentAlert,
  markAlertWhatsappSent,
  getUserDigestSettings,
} from "../db";
import { sendWhatsAppText } from "./whatsapp";
import { ENV } from "./env";
import { acquireSchedulerLock } from "./redis";

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const RECENT_POSTS_DAYS = 7;
const GRAPH_BASE = "https://graph.facebook.com/v20.0";

type MediaItem = {
  id: string;
  caption?: string;
  permalink: string;
  comments_count: number;
  timestamp: string;
};

async function fetchRecentMedia(igAccountId: string, accessToken: string): Promise<MediaItem[]> {
  try {
    const since = Math.floor((Date.now() - RECENT_POSTS_DAYS * 86400 * 1000) / 1000);
    const qs = new URLSearchParams({
      fields: "id,caption,permalink,comments_count,timestamp",
      limit: "20",
      since: String(since),
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH_BASE}/${igAccountId}/media?${qs}`);
    if (!res.ok) return [];
    const data = await res.json() as { data?: MediaItem[]; error?: unknown };
    if (data.error) return [];
    return data.data ?? [];
  } catch {
    return [];
  }
}

function buildWhatsAppAlert(caption: string | null, permalink: string, newCount: number, previousCount: number): string {
  const increase = newCount - previousCount;
  const short = caption ? `"${caption.slice(0, 60)}${caption.length > 60 ? "…" : ""}"` : "(sem legenda)";
  return [
    `💬 *Novo${increase > 1 ? `s ${increase}` : ""} comentário${increase > 1 ? "s" : ""} detectado${increase > 1 ? "s" : ""}!*`,
    "",
    `📌 Post: ${short}`,
    `💬 Total: ${previousCount} → ${newCount}`,
    "",
    `⏰ *Você tem aproximadamente 60 minutos para responder e maximizar o alcance!*`,
    "",
    `🔗 ${permalink}`,
  ].join("\n");
}

async function checkCommentsForUser(
  userId: number,
  igAccountId: string,
  accessToken: string
): Promise<void> {
  const posts = await fetchRecentMedia(igAccountId, accessToken);
  if (!posts.length) return;

  const digestSettings = await getUserDigestSettings(userId).catch(() => null);
  const whatsappNumber = digestSettings?.whatsappNumber ?? null;

  for (const post of posts) {
    try {
      const storedCount = await getCommentPollCount(userId, post.id);
      const currentCount = post.comments_count ?? 0;

      if (storedCount === -1) {
        // First time seeing this post — just record the baseline, no alert
        await upsertCommentPollState(userId, post.id, currentCount);
        continue;
      }

      if (currentCount > storedCount) {
        // New comment(s) detected
        const alertId = await insertCommentAlert(userId, {
          mediaId: post.id,
          mediaCaption: post.caption ?? null,
          mediaPermalink: post.permalink,
          previousCount: storedCount,
          newCount: currentCount,
        });

        // Send WhatsApp if user has a number configured
        if (whatsappNumber && ENV.whatsappPhoneNumberId && ENV.whatsappAccessToken) {
          try {
            const message = buildWhatsAppAlert(post.caption ?? null, post.permalink, currentCount, storedCount);
            await sendWhatsAppText(whatsappNumber, message);
            await markAlertWhatsappSent(alertId);
            console.log(`[CommentAlert] WhatsApp sent to ${whatsappNumber} for media ${post.id} (userId=${userId})`);
          } catch (err) {
            console.warn(`[CommentAlert] WhatsApp send failed (userId=${userId}):`, err);
          }
        }

        await upsertCommentPollState(userId, post.id, currentCount);
        console.log(`[CommentAlert] New comment(s) on post ${post.id} for user ${userId}: ${storedCount} → ${currentCount}`);
      } else {
        // No change — just refresh timestamp
        await upsertCommentPollState(userId, post.id, storedCount);
      }
    } catch (err) {
      console.warn(`[CommentAlert] Error checking post ${post.id}:`, err);
    }
  }
}

export function startCommentAlertScheduler(): void {
  if (!ENV.metaAccessToken && !ENV.whatsappAccessToken) {
    console.log("[CommentAlert] No Meta credentials configured — comment alert scheduler disabled.");
    return;
  }

  console.log(`[CommentAlert] Scheduler started (interval: ${POLL_INTERVAL_MS / 1000}s)`);

  setInterval(async () => {
    try {
      if (!(await acquireSchedulerLock("comment-alert", Math.floor(POLL_INTERVAL_MS * 0.9)))) return;
      const connections = await getAllInstagramConnections();
      if (!connections.length) return;

      console.log(`[CommentAlert] Checking ${connections.length} Instagram account(s) for new comments...`);

      for (const conn of connections) {
        await checkCommentsForUser(conn.userId, conn.instagramAccountId, conn.accessToken).catch((err) => {
          console.warn(`[CommentAlert] Error for userId=${conn.userId}:`, err);
        });
      }
    } catch (err) {
      console.warn("[CommentAlert] Scheduler tick error:", err);
    }
  }, POLL_INTERVAL_MS);
}