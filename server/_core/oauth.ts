import type { Express } from "express";
import { nanoid } from "nanoid";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";

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
  "instagram_business_management",
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
  if (ENV.instagramOAuthRedirectUri) {
    return ENV.instagramOAuthRedirectUri;
  }
  if (ENV.appBaseUrl) {
    return `${ENV.appBaseUrl.replace(/\/+$/, "")}/auth/instagram/callback`;
  }
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
    authUrl.searchParams.set("auth_type", "reauthorize");

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

      // 4a. Get Facebook Pages + linked Instagram Business Accounts
      let resolvedIg: IgBusinessAccount | undefined;
      let resolvedPageId: string | undefined;
      let resolvedToken: string = accessToken;

      try {
        const pagesData = await graphGet<FbPagesResponse>(
          `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`
        );
        const pageWithIg = (pagesData.data ?? []).find((p) => p.instagram_business_account?.id);
        if (pageWithIg?.instagram_business_account?.id) {
          resolvedIg = pageWithIg.instagram_business_account;
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

      // 4c. Fallback: try /me/instagram_accounts (broader search)
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

      // 6. Save Instagram connection if found
      let igConnectStatus = "no_account";
      if (resolvedIg?.id) {
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
      } else {
        console.warn(`[OAuth/Instagram] Nenhuma conta Instagram encontrada para userId=${user.id} (fbUserId=${fbUserId}). Verifique se a conta Business/Creator está vinculada a uma Página do Facebook.`);
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
        // Redirect with debug info about what was found
        const debugInfo = encodeURIComponent(
          `fbUserId=${fbUserId} | pages_found=${resolvedPageId ? "yes("+resolvedPageId+")" : "no"} | ig_found=no`
        );
        res.redirect(`/dashboard/analytics?ig_connect=no_account&debug=${debugInfo}`);
      }
    } catch (err) {
      console.error("[OAuth/Instagram] Erro no callback:", err);
      const message = encodeURIComponent(err instanceof Error ? err.message : "Erro desconhecido");
      res.redirect(`/?error=oauth_failed&detail=${message}`);
    }
  });
}
