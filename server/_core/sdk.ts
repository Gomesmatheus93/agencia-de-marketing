import {
  ACCESS_TOKEN_TTL_MS,
  COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
} from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

type TokenType = "access" | "refresh";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  type: TokenType;
  tokenVersion: number;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) return new Map<string, string>();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  private async sign(
    payload: { openId: string; name: string; type: TokenType; tokenVersion: number },
    expiresInMs: number
  ): Promise<string> {
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    return new SignJWT({
      openId: payload.openId,
      appId: ENV.appId || "ai-marketing-agency",
      name: payload.name,
      type: payload.type,
      tokenVersion: payload.tokenVersion,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  /** Cria um access token curto para um usuário. */
  async createAccessToken(user: Pick<User, "openId" | "name" | "tokenVersion">): Promise<string> {
    return this.sign(
      { openId: user.openId, name: user.name ?? "", type: "access", tokenVersion: user.tokenVersion ?? 0 },
      ACCESS_TOKEN_TTL_MS
    );
  }

  async createRefreshToken(user: Pick<User, "openId" | "name" | "tokenVersion">): Promise<string> {
    return this.sign(
      { openId: user.openId, name: user.name ?? "", type: "refresh", tokenVersion: user.tokenVersion ?? 0 },
      REFRESH_TOKEN_TTL_MS
    );
  }

  /**
   * Compat: cria um access token só pelo openId (busca tokenVersion no banco).
   * Prefira issueSessionCookies quando tiver o objeto User completo.
   */
  async createSessionToken(
    openId: string,
    options: { name?: string } = {}
  ): Promise<string> {
    const user = await db.getUserByOpenId(openId);
    return this.sign(
      {
        openId,
        name: options.name ?? user?.name ?? "",
        type: "access",
        tokenVersion: user?.tokenVersion ?? 0,
      },
      ACCESS_TOKEN_TTL_MS
    );
  }

  /** Seta os cookies de access + refresh na resposta. */
  async issueSessionCookies(req: Request, res: Response, user: User): Promise<void> {
    const opts = getSessionCookieOptions(req);
    const [access, refresh] = await Promise.all([
      this.createAccessToken(user),
      this.createRefreshToken(user),
    ]);
    res.cookie(COOKIE_NAME, access, { ...opts, maxAge: ACCESS_TOKEN_TTL_MS });
    res.cookie(REFRESH_COOKIE_NAME, refresh, { ...opts, maxAge: REFRESH_TOKEN_TTL_MS });
  }

  clearSessionCookies(req: Request, res: Response): void {
    const opts = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...opts, maxAge: -1 });
    res.clearCookie(REFRESH_COOKIE_NAME, { ...opts, maxAge: -1 });
  }

  async verifySession(
    cookieValue: string | undefined | null,
    expectedType: TokenType = "access"
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;

    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, type, tokenVersion } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || typeof name !== "string") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      // Tokens antigos (sem `type`) são tratados como access — transição suave.
      const tokenType: TokenType = type === "refresh" ? "refresh" : "access";
      if (tokenType !== expectedType) {
        console.warn(`[Auth] Token type mismatch: esperado ${expectedType}, recebido ${tokenType}`);
        return null;
      }

      return {
        openId,
        appId,
        name,
        type: tokenType,
        tokenVersion: typeof tokenVersion === "number" ? tokenVersion : 0,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const session = await this.verifySession(cookies.get(COOKIE_NAME), "access");

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const user = await db.getUserByOpenIdWithActiveCheck(session.openId);

    if (user === null) {
      throw ForbiddenError("Account deactivated");
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }

    // Sessão revogada (troca de senha / "sair de todos os dispositivos" / role).
    // Tokens legados sem tokenVersion (payload = 0) continuam válidos até expirar
    // se o usuário nunca revogou (tokenVersion do user também 0).
    if ((session.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      throw ForbiddenError("Session expired");
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

    return user;
  }

  /** Valida um refresh token e devolve o User atual (ou null). */
  async userFromRefreshToken(req: Request): Promise<User | null> {
    const cookies = this.parseCookies(req.headers.cookie);
    const session = await this.verifySession(cookies.get(REFRESH_COOKIE_NAME), "refresh");
    if (!session) return null;
    const user = await db.getUserByOpenIdWithActiveCheck(session.openId);
    if (!user) return null;
    if ((session.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) return null;
    return user;
  }
}

export const sdk = new SDKServer();
