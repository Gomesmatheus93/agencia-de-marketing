import { ENV } from "./env";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";

export const GSC_SCOPES = "https://www.googleapis.com/auth/webmasters.readonly";

export function getGscRedirectUri(): string {
  return (
    ENV.googleGscRedirectUri ||
    `${ENV.appBaseUrl.replace(/\/+$/, "")}/api/oauth/gsc/connect/callback`
  );
}

export function buildGscAuthUrl(state: string): string {
  const url = new URL(GOOGLE_AUTH_BASE);
  url.searchParams.set("client_id", ENV.googleGscClientId);
  url.searchParams.set("redirect_uri", getGscRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GSC_SCOPES);
  url.searchParams.set("state", state);
  // access_type=offline + prompt=consent guarantee a refresh_token is returned,
  // even if this Google account already granted consent before.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export type GscTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export async function exchangeGscCode(code: string): Promise<GscTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getGscRedirectUri(),
      client_id: ENV.googleGscClientId,
      client_secret: ENV.googleGscClientSecret,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<GscTokenResponse>;
}

export async function refreshGscAccessToken(refreshToken: string): Promise<GscTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ENV.googleGscClientId,
      client_secret: ENV.googleGscClientSecret,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<GscTokenResponse>;
}

/**
 * Returns a valid access token for this connection, transparently refreshing
 * (and persisting the refreshed token) when the stored one has expired.
 */
export async function getValidGscAccessToken(connection: {
  userId: number;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  const isExpired =
    !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

  if (!isExpired) return connection.accessToken;

  if (!connection.refreshToken) {
    throw new Error("Conexão com o Google Search Console expirou. Reconecte em SEO.");
  }

  const refreshed = await refreshGscAccessToken(connection.refreshToken);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  const db = await import("../db");
  await db.updateSearchConsoleTokens(connection.userId, {
    accessToken: refreshed.access_token,
    tokenExpiresAt,
  });

  return refreshed.access_token;
}

type GscSite = {
  siteUrl: string;
  permissionLevel: string;
};

export async function listGscSites(accessToken: string): Promise<string[]> {
  const res = await fetch(`${GSC_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao listar propriedades do Search Console (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { siteEntry?: GscSite[] };
  return (data.siteEntry ?? [])
    .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
    .map((s) => s.siteUrl);
}

export type GscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function fetchGscTopQueries(params: {
  accessToken: string;
  siteUrl: string;
  days?: number;
  rowLimit?: number;
}): Promise<GscQueryRow[]> {
  const days = params.days ?? 28;
  const rowLimit = params.rowLimit ?? 20;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await fetch(
    `${GSC_API_BASE}/sites/${encodeURIComponent(params.siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: fmt(start),
        endDate: fmt(end),
        dimensions: ["query"],
        rowLimit,
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao consultar Search Console (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
  };

  return (data.rows ?? []).map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}
