import crypto from "crypto";
import { ENV } from "./env";

const CANVA_API_BASE = "https://api.canva.com/rest/v1";
const CANVA_AUTH_BASE = "https://www.canva.com/api/oauth";
const CANVA_TOKEN_URL = `${CANVA_API_BASE}/oauth/token`;

export const CANVA_SCOPES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "asset:write",
  "profile:read",
].join(" ");

export const CANVA_REDIRECT_URI =
  process.env.CANVA_REDIRECT_URI ??
  `${ENV.appBaseUrl.replace(/\/+$/, "")}/api/oauth/canva/callback`;

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export function buildCanvaAuthUrl(state: string, codeChallenge: string): string {
  const url = new URL(`${CANVA_AUTH_BASE}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", ENV.canvaClientId);
  url.searchParams.set("redirect_uri", CANVA_REDIRECT_URI);
  url.searchParams.set("scope", CANVA_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ─── Token exchange / refresh ─────────────────────────────────────────────────

export type CanvaTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

function canvaAuthHeaders(): HeadersInit {
  if (ENV.canvaClientSecret) {
    const creds = Buffer.from(`${ENV.canvaClientId}:${ENV.canvaClientSecret}`).toString("base64");
    return { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${creds}` };
  }
  return { "Content-Type": "application/x-www-form-urlencoded" };
}

export async function exchangeCanvaCode(code: string, codeVerifier: string): Promise<CanvaTokenResponse> {
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: CANVA_REDIRECT_URI,
    code_verifier: codeVerifier,
  };
  if (!ENV.canvaClientSecret) params.client_id = ENV.canvaClientId;

  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: canvaAuthHeaders(),
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<CanvaTokenResponse>;
}

export async function refreshCanvaToken(refreshToken: string): Promise<CanvaTokenResponse> {
  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  };
  if (!ENV.canvaClientSecret) params.client_id = ENV.canvaClientId;

  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: canvaAuthHeaders(),
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<CanvaTokenResponse>;
}

// ─── API client ───────────────────────────────────────────────────────────────

async function canvaGet<T>(path: string, accessToken: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${CANVA_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function canvaPost<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const url = path.startsWith("http") ? path : `${CANVA_API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CanvaDesign = {
  id: string;
  title: string;
  thumbnail?: { url: string };
  urls?: { view_url?: string; edit_url?: string };
  created_at?: number;
  updated_at?: number;
};

export type CanvaDesignsResponse = {
  items: CanvaDesign[];
  continuation?: string;
};

export type CanvaUserProfile = {
  user_id: string;
  display_name?: string;
  email?: string;
  profile_picture_url?: string;
};

export type CanvaExportJob = {
  job: {
    id: string;
    status: "queued" | "in_progress" | "success" | "failed";
    error?: { code?: string; message?: string };
    urls?: string[];
  };
};

// ─── Methods ──────────────────────────────────────────────────────────────────

export async function getCanvaUserProfile(accessToken: string): Promise<CanvaUserProfile> {
  const data = await canvaGet<{ user: CanvaUserProfile }>("/users/me", accessToken);
  return data.user;
}

export async function listCanvaDesigns(
  accessToken: string,
  options: { query?: string; continuation?: string; limit?: number } = {}
): Promise<CanvaDesignsResponse> {
  const params = new URLSearchParams();
  if (options.query) params.set("query", options.query);
  if (options.continuation) params.set("continuation", options.continuation);
  if (options.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  return canvaGet<CanvaDesignsResponse>(`/designs${qs ? `?${qs}` : ""}`, accessToken);
}

export async function createCanvaDesign(
  accessToken: string,
  options: { title?: string; width?: number; height?: number } = {}
): Promise<CanvaDesign> {
  const body: Record<string, unknown> = {};
  if (options.title) body.title = options.title;
  if (options.width && options.height) {
    body.design_type = {
      type: "custom",
      width: options.width,
      height: options.height,
      unit: "px",
    };
  }
  const data = await canvaPost<{ design: CanvaDesign }>("/designs", accessToken, body);
  return data.design;
}

export async function exportCanvaDesign(
  accessToken: string,
  designId: string,
  format: "jpg" | "png" = "jpg"
): Promise<string[]> {
  // Step 1 — start export job
  const formatBody =
    format === "jpg"
      ? { type: "jpg", quality: 85 }
      : { type: "png" };

  const exportData = await canvaPost<CanvaExportJob>(
    `/exports`,
    accessToken,
    { design_id: designId, format: formatBody }
  );

  const jobId = exportData.job.id;

  // Step 2 — poll until done (max ~30 s)
  for (let i = 0; i < 30; i++) {
    const jobData = await canvaGet<CanvaExportJob>(
      `/exports/${encodeURIComponent(jobId)}`,
      accessToken
    );
    const { status, urls, error } = jobData.job;
    if (status === "success" && urls?.length) return urls;
    if (status === "failed") throw new Error(`Canva export failed: ${error?.message ?? "unknown error"}`);
    await new Promise((r) => setTimeout(r, 1_000));
  }

  throw new Error("Canva export timed out");
}
