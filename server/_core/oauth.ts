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

// Permissions that work with Standard Access (no App Review needed in Live mode).
// business_management and instagram_manage_insights require Advanced Access (App Review)
// and will cause "app unavailable" if requested without approval.
const SCOPES = [
  "email",
  "public_profile",
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
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
  // Always prefer explicit REDIRECT_URI when configured — required for Meta's allow-list
  // and also fixes local dev where Meta blocks localhost in Live mode.
  if (ENV.instagramOAuthRedirectUri) {
    return ENV.instagramOAuthRedirectUri;
  }
  if (ENV.appBaseUrl) {
    return `${ENV.appBaseUrl.replace(/\/+$/, "")}/auth/instagram/callback`;
  }
  // Fallback: derive from request (local dev without any URI configured)
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host || "localhost:3000";
  return `${proto}://${host}/auth/instagram/callback`;
}

export function registerOAuthRoutes(app: Express) {
  // ── Instagram Direct Login (no Facebook account needed) ─────────────────────
  // Uses api.instagram.com + graph.instagram.com — the user logs in with
  // their Instagram credentials directly.

  // Instagram Business Login scopes — used with www.instagram.com/oauth/authorize
  const IG_LOGIN_SCOPES = [
    "instagram_business_basic",
    "instagram_business_content_publish",
  ].join(",");

  // userId = 0 means "not logged in yet" — a new session will be created in the callback
  const pendingIgLoginStates = new Map<string, { userId: number; ts: number }>();

  function buildIgLoginCallbackUrl(req: Express["request"]) {
    if (ENV.isProduction) {
      if (ENV.instagramLoginCallbackUri) return ENV.instagramLoginCallbackUri;
      if (ENV.appBaseUrl) return `${ENV.appBaseUrl.replace(/\/+$/, "")}/api/oauth/instagram/login/callback`;
    }
    const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "http";
    const host = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host || "localhost:3000";
    return `${proto}://${host}/api/oauth/instagram/login/callback`;
  }

  app.get("/api/oauth/instagram/login", async (req, res) => {
    const igAppId = ENV.instagramBusinessAppId || ENV.metaAppId;
    if (!igAppId || !ENV.metaAppSecret) {
      res.status(503).send("INSTAGRAM_BUSINESS_APP_ID (ou META_APP_ID) e META_APP_SECRET não configurados.");
      return;
    }

    // Optionally detect existing session — if logged in, we link to that user;
    // if not logged in (userId = 0), callback will create a new user + session.
    let userId = 0;
    try {
      const cookieHeader = req.headers.cookie ?? "";
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
      const token = match?.[1];
      if (token) {
        const payload = await sdk.verifySession(token);
        if (payload?.openId) {
          const user = await db.getUserByOpenId(payload.openId);
          userId = user?.id ?? 0;
        }
      }
    } catch { /* ignore */ }

    // Prune old states
    const cutoff = Date.now() - STATE_TTL_MS;
    Array.from(pendingIgLoginStates.entries()).forEach(([k, v]) => {
      if (v.ts < cutoff) pendingIgLoginStates.delete(k);
    });

    const state = nanoid(32);
    pendingIgLoginStates.set(state, { userId, ts: Date.now() });

    const callbackUrl = buildIgLoginCallbackUrl(req);
    // Instagram Business Login endpoint (shows Instagram popup, no Facebook account needed)
    const authUrl = new URL("https://www.instagram.com/oauth/authorize");
    authUrl.searchParams.set("client_id", igAppId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", IG_LOGIN_SCOPES);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("force_reauth", "true");

    res.redirect(authUrl.toString());
  });

  app.get("/api/oauth/instagram/login/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    // Determine where to redirect on error — if user had a session, send to analytics; otherwise to login
    const pending = state ? pendingIgLoginStates.get(state) : undefined;
    const errorRedirect = pending?.userId ? "/dashboard/analytics" : "/";

    if (oauthError) {
      console.warn("[OAuth/IGLogin] User denied:", oauthError);
      res.redirect(`${errorRedirect}?ig_connect=denied`);
      return;
    }

    if (!pending) {
      res.redirect(`${errorRedirect}?ig_connect=invalid_state`);
      return;
    }
    pendingIgLoginStates.delete(state);

    if (!code) {
      res.redirect(`${errorRedirect}?ig_connect=no_code`);
      return;
    }

    try {
      const callbackUrl = buildIgLoginCallbackUrl(req);
      const igAppId = ENV.instagramBusinessAppId || ENV.metaAppId;

      // 1. Exchange code for short-lived token (Instagram Business Login)
      const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: igAppId,
          client_secret: ENV.metaAppSecret,
          grant_type: "authorization_code",
          redirect_uri: callbackUrl,
          code,
        }),
      });
      const shortData = await shortRes.json() as { access_token?: string; user_id?: number; error_message?: string };
      if (!shortData.access_token) throw new Error(`Token não retornado: ${shortData.error_message ?? "erro desconhecido"}`);

      // 2. Exchange for long-lived token (~60 days) via graph.instagram.com
      const longRes = await fetch(
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_id=${igAppId}&client_secret=${ENV.metaAppSecret}&access_token=${encodeURIComponent(shortData.access_token)}`
      );
      const longData = await longRes.json() as { access_token?: string; expires_in?: number; error?: { message?: string } };
      if (!longData.access_token) throw new Error(`Token longa duração não retornado: ${longData.error?.message ?? ""}`);

      const accessToken = longData.access_token;
      const expiresIn = longData.expires_in ?? 5184000;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // 3. Get user info
      const userRes = await fetch(`https://graph.instagram.com/me?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`);
      const userData = await userRes.json() as { id?: string; username?: string; name?: string; error?: { message?: string } };
      if (!userData.id) throw new Error(`ID do usuário IG não retornado: ${userData.error?.message ?? ""}`);

      // 4. Resolve target userId
      // If pending.userId === 0, user came from Login page (no session) → create/upsert user
      let targetUserId = pending.userId;
      if (targetUserId === 0) {
        const openId = `ig_${userData.id}`;
        const displayName = userData.name || userData.username || "Usuário Instagram";
        await db.upsertUser({
          openId,
          name: displayName,
          loginMethod: "instagram",
          lastSignedIn: new Date(),
        });
        const newUser = await db.getUserByOpenId(openId);
        if (!newUser) throw new Error("Falha ao criar usuário Instagram.");
        targetUserId = newUser.id;

        // Create session cookie
        const sessionToken = await sdk.createSessionToken(openId, {
          name: displayName,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        console.log(`[OAuth/IGLogin] Novo usuário criado: @${userData.username} (userId=${targetUserId})`);
      }

      // 5. Save Instagram connection
      await db.upsertInstagramConnection({
        userId: targetUserId,
        instagramAccountId: userData.id,
        username: userData.username,
        accessToken,
        tokenExpiresAt,
        tokenSource: "instagram",
        connectedAt: new Date(),
      });

      // 6. Subscribe to comment webhooks for this account
      try {
        const subRes = await fetch(
          `https://graph.facebook.com/v25.0/${userData.id}/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(accessToken)}`,
          { method: "POST" }
        );
        const subData = await subRes.json() as { success?: boolean; error?: { message?: string } };
        if (subData.success) {
          console.log(`[OAuth/IGLogin] Webhook comments subscrito para @${userData.username}`);
        } else {
          console.warn(`[OAuth/IGLogin] Falha ao subscrever webhook:`, subData.error?.message);
        }
      } catch (e) {
        console.warn(`[OAuth/IGLogin] Erro ao subscrever webhook de comments:`, e);
      }

      console.log(`[OAuth/IGLogin] @${userData.username} conectado ao userId=${targetUserId}`);
      res.redirect("/dashboard/analytics?ig_connect=success");
    } catch (err) {
      console.error("[OAuth/IGLogin] Erro:", err);
      const msg = encodeURIComponent(err instanceof Error ? err.message : String(err));
      // If it was a new login (no prior session), redirect back to login page with error
      const fallback = pending.userId === 0 ? "/" : "/dashboard/analytics";
      res.redirect(`${fallback}?ig_connect=error&detail=${msg}`);
    }
  });

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
          // Subscribe to comment webhooks
          try {
            const subRes = await fetch(
              `https://graph.facebook.com/v25.0/${resolvedIg.id}/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(resolvedToken)}`,
              { method: "POST" }
            );
            const subData = await subRes.json() as { success?: boolean; error?: { message?: string } };
            if (subData.success) {
              console.log(`[OAuth/Instagram] Webhook comments subscrito para @${resolvedIg.username}`);
            } else {
              console.warn(`[OAuth/Instagram] Falha ao subscrever webhook:`, subData.error?.message);
            }
          } catch (e) {
            console.warn(`[OAuth/Instagram] Erro ao subscrever webhook de comments:`, e);
          }
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

  // ── Instagram Connect (for already-logged-in users) ──────────────────────
  // Similar to Canva: requires an active session, links the IG account to the
  // current user without creating a new session.

  const pendingConnectStates = new Map<string, { userId: number; ts: number }>();

  function buildConnectCallbackUrl(req: Express["request"]) {
    if (ENV.isProduction) {
      if (ENV.instagramConnectRedirectUri) return ENV.instagramConnectRedirectUri;
      if (ENV.appBaseUrl) return `${ENV.appBaseUrl.replace(/\/+$/, "")}/api/oauth/instagram/connect/callback`;
    }
    const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol || "http";
    const host = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host || "localhost:3000";
    return `${proto}://${host}/api/oauth/instagram/connect/callback`;
  }

  app.get("/api/oauth/instagram/connect", async (req, res) => {
    if (!ENV.metaAppId || !ENV.metaAppSecret) {
      res.status(503).send("META_APP_ID e META_APP_SECRET não configurados.");
      return;
    }

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
    } catch { /* ignore */ }

    if (!userId) {
      res.redirect("/dashboard/settings?ig_connect=requires_login");
      return;
    }

    // Prune old states
    const cutoff = Date.now() - STATE_TTL_MS;
    Array.from(pendingConnectStates.entries()).forEach(([k, v]) => {
      if (v.ts < cutoff) pendingConnectStates.delete(k);
    });

    const state = nanoid(32);
    pendingConnectStates.set(state, { userId, ts: Date.now() });

    const callbackUrl = buildConnectCallbackUrl(req);
    const authUrl = new URL(`${OAUTH_DIALOG_BASE}/dialog/oauth`);
    authUrl.searchParams.set("client_id", ENV.metaAppId);
    authUrl.searchParams.set("redirect_uri", callbackUrl);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");

    res.redirect(authUrl.toString());
  });

  app.get("/api/oauth/instagram/connect/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query as Record<string, string>;

    if (oauthError) {
      console.warn("[OAuth/Instagram/Connect] User denied authorization:", oauthError);
      res.redirect("/dashboard/analytics?ig_connect=denied");
      return;
    }

    const pending = state ? pendingConnectStates.get(state) : undefined;
    if (!pending) {
      res.redirect("/dashboard/analytics?ig_connect=invalid_state");
      return;
    }
    pendingConnectStates.delete(state);

    if (!code) {
      res.redirect("/dashboard/analytics?ig_connect=no_code");
      return;
    }

    try {
      const callbackUrl = buildConnectCallbackUrl(req);

      const shortTokenData = await graphGet<FbTokenResponse>(
        `${GRAPH}/oauth/access_token?client_id=${ENV.metaAppId}&client_secret=${ENV.metaAppSecret}&redirect_uri=${encodeURIComponent(callbackUrl)}&code=${encodeURIComponent(code)}`
      );
      if (!shortTokenData.access_token) throw new Error("Token não retornado pelo Facebook.");

      const longTokenData = await graphGet<FbTokenResponse>(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${ENV.metaAppId}&client_secret=${ENV.metaAppSecret}&fb_exchange_token=${encodeURIComponent(shortTokenData.access_token)}`
      );
      const accessToken = longTokenData.access_token || shortTokenData.access_token;
      const expiresIn = longTokenData.expires_in ?? 5184000;
      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // Find Instagram Business Account via Pages
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
        console.warn("[OAuth/Instagram/Connect] Falha ao buscar páginas:", e);
      }

      if (!resolvedIg?.id) {
        console.warn(`[OAuth/Instagram/Connect] Nenhuma conta IG encontrada para userId=${pending.userId}`);
        res.redirect("/dashboard/analytics?ig_connect=no_account");
        return;
      }

      await db.upsertInstagramConnection({
        userId: pending.userId,
        instagramAccountId: resolvedIg.id,
        facebookPageId: resolvedPageId,
        username: resolvedIg.username,
        name: resolvedIg.name,
        profilePictureUrl: resolvedIg.profile_picture_url,
        accessToken: resolvedToken,
        tokenExpiresAt,
        connectedAt: new Date(),
      });

      console.log(`[OAuth/Instagram/Connect] Conta IG @${resolvedIg.username} conectada ao userId=${pending.userId}`);
      // Subscribe to comment webhooks
      try {
        const subRes = await fetch(
          `https://graph.facebook.com/v25.0/${resolvedIg.id}/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(resolvedToken)}`,
          { method: "POST" }
        );
        const subData = await subRes.json() as { success?: boolean; error?: { message?: string } };
        if (subData.success) {
          console.log(`[OAuth/Instagram/Connect] Webhook comments subscrito para @${resolvedIg.username}`);
        } else {
          console.warn(`[OAuth/Instagram/Connect] Falha ao subscrever webhook:`, subData.error?.message);
        }
      } catch (e) {
        console.warn(`[OAuth/Instagram/Connect] Erro ao subscrever webhook de comments:`, e);
      }
      res.redirect("/dashboard/analytics?ig_connect=success");
    } catch (err) {
      console.error("[OAuth/Instagram/Connect] Erro:", err);
      const msg = encodeURIComponent(err instanceof Error ? err.message : String(err));
      res.redirect(`/dashboard/analytics?ig_connect=error&detail=${msg}`);
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
