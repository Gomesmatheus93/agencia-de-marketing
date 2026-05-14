import type { Express } from "express";
import { nanoid } from "nanoid";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import {
  buildCanvaAuthUrl,
  exchangeCanvaCode,
  generateCodeChallenge,
  generateCodeVerifier,
  getCanvaUserProfile,
} from "./canvaClient";

const GRAPH_BASE = "https://graph.facebook.com";
const GRAPH_VERSION = (ENV.metaGraphApiVersion || "v25.0").replace(/^\/+/, "");
const GRAPH = `${GRAPH_BASE}/${GRAPH_VERSION}`;
const OAUTH_DIALOG_BASE = `https://www.facebook.com/${GRAPH_VERSION}`;

const SCOPES = [
  "email",
  "public_profile",
  "instagram_basic",
  "instagram_manage_insights",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

// In-memory CSRF state store (nonce → timestamp)
const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function purgeExpiredStates() {
  const now = Date.now();
  Array.from(pendingStates.entries()).forEach(([key, ts]) => {
    if (now - ts > STATE_TTL_MS) pendingStates.delete(key);
  });
}

type FbTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: { message?: string };
};

type FbUserResponse = {
  id?: string;
  name?: string;
  email?: string;
  picture?: { data?: { url?: string } };
  error?: { message?: string };
};

type IgBusinessAccount = {
  id?: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

type FbPage = {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: IgBusinessAccount;
  connected_instagram_account?: IgBusinessAccount;
};

type FbPagesResponse = {
  data?: FbPage[];
  error?: { message?: string };
};

async function graphGet<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const res = await fetch(url);
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || (data as { error?: { message?: string } }).error) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? res.statusText;
    throw new Error(`Meta API error: ${msg}`);
  }
  return data;
}

function buildCallbackUrl(req: Express["request"]) {
  // In production, respect explicit redirect URI configuration (required for Meta app allow-list)
  if (ENV.isProduction) {
    if (ENV.instagramOAuthRedirectUri) {
      return ENV.instagramOAuthRedirectUri;
    }
    if (ENV.appBaseUrl) {
      return `${ENV.appBaseUrl.replace(/\/+$/, "")}/auth/instagram/callback`;
    }
  }
  // In development (or production without explicit config), derive from the incoming request so
  // that local testing works without needing REDIRECT_URI set.
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host || "localhost:3000";
  return `${proto}://${host}/auth/instagram/callback`;
}

export function registerOAuthRoutes(app: Express) {
  // ── Step 1: redirect to Facebook OAuth ─────────────────────────────────────
  app.get("/auth/instagram", (req, res) => {
    if (!ENV.metaAppId || !ENV.metaAppSecret) {
      res.status(503).send("Instagram OAuth não configurado. Defina META_APP_ID e META_APP_SECRET no .env.");
      return;
    }

    purgeExpiredStates();
    const state = nanoid(32);
    pendingStates.set(state, Date.now());

    const callbackUrl = buildCallbackUrl(req);
    const authUrl = new URL(`${OAUTH_DIALOG_BASE}/dialog/oauth`);
    authUrl.searchParams.set("client_id", ENV.metaAppId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    res.redirect(authUrl.toString());
  });

  // ── Step 2: Facebook OAuth callback ─────────────────────────────────────────
  app.get("/auth/instagram/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      console.warn("[OAuth/Instagram] User denied authorization:", oauthError);
      res.redirect("/?error=oauth_denied");
      return;
    }

    if (!state || !pendingStates.has(state)) {
      res.redirect("/?error=oauth_invalid_state");
      return;
    }
    pendingStates.delete(state);

    if (!code) {
      res.redirect("/?error=oauth_no_code");
      return;
    }

    try {
      const callbackUrl = buildCallbackUrl(req);

      // 1. Exchange code for short-lived token
      const shortTokenData = await graphGet<FbTokenResponse>(
        `${GRAPH}/oauth/access_token?client_id=${ENV.metaAppId}&client_secret=${ENV.metaAppSecret}&redirect_uri=${encodeURIComponent(callbackUrl)}&code=${encodeURIComponent(code)}`
      );
      if (!shortTokenData.access_token) throw new Error("Token não retornado pelo Facebook.");

      // 2. Exchange for long-lived token (~60 days)
      const longTokenData = await graphGet<FbTokenResponse>(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${ENV.metaAppId}&client_secret=${ENV.metaAppSecret}&fb_exchange_token=${encodeURIComponent(shortTokenData.access_token)}`
      );
      const accessToken = longTokenData.access_token || shortTokenData.access_token;
      const expiresIn = longTokenData.expires_in ?? 5184000; // 60 days default
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // 3. Get Facebook user info
      const userInfo = await graphGet<FbUserResponse>(
        `${GRAPH}/me?fields=id,name,email,picture{url}&access_token=${encodeURIComponent(accessToken)}`
      );
      if (!userInfo.id) throw new Error("ID do usuário não retornado pelo Facebook.");

      const fbUserId = userInfo.id;
      const userName = userInfo.name || "Usuário Instagram";
      const userEmail = userInfo.email;
      const openId = `meta_${fbUserId}`;

      // 4a. Get Facebook Pages + linked Instagram Business/Connected Accounts
      let resolvedIg: IgBusinessAccount | undefined;
      let resolvedPageId: string | undefined;
      let resolvedToken: string = accessToken;

      try {
        const pagesData = await graphGet<FbPagesResponse>(
          `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url},connected_instagram_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`
        );
        const pageWithIg = (pagesData.data ?? []).find(
          (p) => p.instagram_business_account?.id || p.connected_instagram_account?.id
        );
        if (pageWithIg) {
          resolvedIg = pageWithIg.instagram_business_account || pageWithIg.connected_instagram_account;
          resolvedPageId = pageWithIg.id;
          resolvedToken = pageWithIg.access_token || accessToken;
        }
      } catch (e) {
        console.warn("[OAuth/Instagram] Falha ao buscar páginas Facebook:", e);
      }

      // 4b. Fallback: try instagram_business_account directly on the FB user
      if (!resolvedIg) {
        try {
          const userIg = await graphGet<{ instagram_business_account?: IgBusinessAccount; error?: { message?: string } }>(
            `${GRAPH}/${fbUserId}?fields=instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`
          );
          if (userIg.instagram_business_account?.id) {
            resolvedIg = userIg.instagram_business_account;
          }
        } catch (e) {
          console.warn("[OAuth/Instagram] Falha ao buscar instagram_business_account do usuário:", e);
        }
      }

      // 4c. Fallback: try /me/instagram_accounts
      if (!resolvedIg) {
        try {
          const igAccounts = await graphGet<{ data?: IgBusinessAccount[]; error?: { message?: string } }>(
            `${GRAPH}/me/instagram_accounts?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
          );
          const first = (igAccounts.data ?? []).find((a) => a.id);
          if (first?.id) {
            resolvedIg = first;
          }
        } catch (e) {
          console.warn("[OAuth/Instagram] Falha ao buscar /me/instagram_accounts:", e);
        }
      }

      // 4d. Fallback: try /me/businesses (via Business Manager portfolio)
      if (!resolvedIg) {
        try {
          const bizData = await graphGet<{
            data?: Array<{ instagram_business_accounts?: { data?: IgBusinessAccount[] } }>;
            error?: { message?: string };
          }>(
            `${GRAPH}/me/businesses?fields=instagram_business_accounts{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`
          );
          for (const biz of bizData.data ?? []) {
            const first = (biz.instagram_business_accounts?.data ?? []).find((a) => a.id);
            if (first?.id) { resolvedIg = first; break; }
          }
        } catch (e) {
          console.warn("[OAuth/Instagram] Falha ao buscar /me/businesses:", e);
        }
      }

      // 5. Create or update user
      await db.upsertUser({
        openId,
        name: userName,
        email: userEmail,
        loginMethod: "instagram",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("Falha ao criar usuário após OAuth.");

      // 6. Save Instagram connection if found (never crash the login if this fails)
      let igConnectStatus = "no_account";
      if (resolvedIg?.id) {
        try {
          await db.upsertInstagramConnection({
            userId: user.id,
            instagramAccountId: resolvedIg.id!,
            facebookPageId: resolvedPageId,
            username: resolvedIg.username,
            name: resolvedIg.name || userName,
            profilePictureUrl: resolvedIg.profile_picture_url,
            accessToken: resolvedToken,
            tokenExpiresAt,
            connectedAt: new Date(),
          });
          igConnectStatus = "success";
          console.log(`[OAuth/Instagram] Conta IG conectada: @${resolvedIg.username} (userId=${user.id})`);
        } catch (dbErr) {
          console.error("[OAuth/Instagram] Falha ao salvar instagram_connection (tabela pode não existir):", dbErr);
          igConnectStatus = "db_error";
        }
      } else {
        console.warn(`[OAuth/Instagram] Nenhuma conta Instagram encontrada para userId=${user.id} (fbUserId=${fbUserId}).`);
      }

      // 7. Create session cookie and redirect
      const sessionToken = await sdk.createSessionToken(openId, {
        name: userName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      if (igConnectStatus === "success") {
        res.redirect("/dashboard/analytics?ig_connect=success");
      } else {
        res.redirect(`/dashboard/analytics?ig_connect=no_account`);
      }
    } catch (err) {
      console.error("[OAuth/Instagram] Erro no callback:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      // If the failure is DB-related to instagram_connections, don't block login
      if (errMsg.includes("instagram_connections") || errMsg.includes("Failed query")) {
        console.warn("[OAuth/Instagram] DB error during connection save — redirecting to analytics anyway");
        res.redirect("/dashboard/analytics?ig_connect=no_account");
      } else {
        const message = encodeURIComponent(errMsg);
        res.redirect(`/?error=oauth_failed&detail=${message}`);
      }
    }
  });

  // ── Canva OAuth (PKCE) ────────────────────────────────────────────────────

  // In-memory store: state → { codeVerifier, userId, timestamp }
  const pendingCanvaStates = new Map<string, { codeVerifier: string; userId: number; ts: number }>();

  app.get("/api/oauth/canva/authorize", async (req, res) => {
    if (!ENV.canvaClientId) {
      res.status(503).send("CANVA_CLIENT_ID não configurado.");
      return;
    }

    // Require an authenticated session so we can link the connection to the user
    let userId: number | undefined;
    try {
      const cookieHeader = req.headers.cookie ?? "";
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
      const token = match?.[1];
      if (token) {
        const payload = await sdk.verifySession(token);
        if (payload?.openId) {
          const user = await db.getUserByOpenId(payload.openId);
          userId = user?.id;
        }
      }
    } catch {
      // session check failed — will redirect back with error
    }

    if (!userId) {
      res.redirect("/?error=canva_auth_requires_login");
      return;
    }

    const state = nanoid(32);
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    pendingCanvaStates.set(state, { codeVerifier, userId, ts: Date.now() });

    // Prune old entries
    const cutoff = Date.now() - 10 * 60 * 1000;
    Array.from(pendingCanvaStates.entries()).forEach(([k, v]) => {
      if (v.ts < cutoff) pendingCanvaStates.delete(k);
    });

    res.redirect(buildCanvaAuthUrl(state, codeChallenge));
  });

  app.get("/api/oauth/canva/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      console.warn("[OAuth/Canva] Usuário negou autorização:", oauthError);
      res.redirect("/dashboard/carousel?canva_connect=denied");
      return;
    }

    const pending = state ? pendingCanvaStates.get(state) : undefined;
    if (!pending) {
      res.redirect("/dashboard/carousel?canva_connect=invalid_state");
      return;
    }
    pendingCanvaStates.delete(state);

    if (!code) {
      res.redirect("/dashboard/carousel?canva_connect=no_code");
      return;
    }

    try {
      const tokens = await exchangeCanvaCode(code, pending.codeVerifier);
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1_000);

      let profile: { user_id: string; display_name?: string; email?: string; profile_picture_url?: string } | undefined;
      try {
        profile = await getCanvaUserProfile(tokens.access_token);
      } catch (e) {
        console.warn("[OAuth/Canva] Não foi possível buscar perfil:", e);
      }

      await db.upsertCanvaConnection({
        userId: pending.userId,
        canvaUserId: profile?.user_id ?? "unknown",
        displayName: profile?.display_name,
        email: profile?.email,
        profilePictureUrl: profile?.profile_picture_url,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        connectedAt: new Date(),
      });

      console.log(`[OAuth/Canva] Conectado: userId=${pending.userId} canvaUserId=${profile?.user_id}`);
      res.redirect("/dashboard/carousel?canva_connect=success");
    } catch (err) {
      console.error("[OAuth/Canva] Erro no callback:", err);
      const msg = encodeURIComponent(err instanceof Error ? err.message : String(err));
      res.redirect(`/dashboard/carousel?canva_connect=error&detail=${msg}`);
    }
  });
}
