import * as db from "../db";
import { ENV } from "./env";
import { acquireSchedulerLock } from "./redis";

// Long-lived Instagram/Facebook tokens last ~60 days and are never refreshed
// proactively otherwise — once one expires, every scheduled post and metrics
// collection for that account silently fails until the user manually
// reconnects. Refreshing a few days ahead of expiry keeps accounts alive
// indefinitely without user intervention.
const REFRESH_WINDOW_DAYS = 10;
const TZ = "America/Fortaleza";
const RUN_HOUR = 4;
const ranToday = new Set<string>();

function graphVersion() {
  return (ENV.metaGraphApiVersion || "v25.0").replace(/^\/+/, "");
}

async function refreshInstagramLoginToken(accessToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`
    );
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!res.ok || !data.access_token) {
      console.warn(`[TokenRefresh] Instagram Login refresh failed: ${data.error?.message ?? res.statusText}`);
      return null;
    }
    return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5_184_000 };
  } catch (e) {
    console.warn("[TokenRefresh] Instagram Login refresh error:", e);
    return null;
  }
}

async function refreshFacebookToken(accessToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  if (!ENV.metaAppId || !ENV.metaAppSecret) return null;
  try {
    const url =
      `https://graph.facebook.com/${graphVersion()}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${ENV.metaAppId}&client_secret=${ENV.metaAppSecret}` +
      `&fb_exchange_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
    if (!res.ok || !data.access_token) {
      console.warn(`[TokenRefresh] Facebook exchange failed: ${data.error?.message ?? res.statusText}`);
      return null;
    }
    return { accessToken: data.access_token, expiresIn: data.expires_in ?? 5_184_000 };
  } catch (e) {
    console.warn("[TokenRefresh] Facebook exchange error:", e);
    return null;
  }
}

async function refreshExpiringTokens(): Promise<void> {
  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const connections = await db.getInstagramConnectionsExpiringBefore(cutoff);
  if (connections.length === 0) return;

  console.log(`[TokenRefresh] ${connections.length} Instagram connection(s) expiring within ${REFRESH_WINDOW_DAYS} days.`);

  let refreshed = 0;
  for (const conn of connections) {
    const label = conn.username ? `@${conn.username}` : `user ${conn.userId}`;
    const result =
      conn.tokenSource === "instagram"
        ? await refreshInstagramLoginToken(conn.accessToken)
        : await refreshFacebookToken(conn.accessToken);

    if (!result) {
      console.warn(`[TokenRefresh] Could not refresh token for ${label} — will keep failing until manually reconnected.`);
      continue;
    }

    await db.updateInstagramConnectionToken(
      conn.userId,
      result.accessToken,
      new Date(Date.now() + result.expiresIn * 1000)
    );
    refreshed += 1;
    console.log(`[TokenRefresh] Refreshed token for ${label}, valid for another ${Math.round(result.expiresIn / 86400)} days.`);
  }

  console.log(`[TokenRefresh] Refreshed ${refreshed}/${connections.length} connection(s).`);
}

export function startInstagramTokenRefreshScheduler(): void {
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
      if (await acquireSchedulerLock(`instagram-token-refresh:${runKey}`, 30 * 60_000)) {
        console.log(`[TokenRefresh] Checking for expiring Instagram tokens at ${dateKey} ${hour}:${String(minute).padStart(2, "0")}...`);
        refreshExpiringTokens().catch((e) => console.error("[TokenRefresh] Pipeline error:", e));
      }
    }
  }, 60_000).unref();
}

export { refreshExpiringTokens as runTokenRefreshPipeline };
