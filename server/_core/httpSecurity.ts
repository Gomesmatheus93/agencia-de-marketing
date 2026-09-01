// Hardening HTTP: helmet (headers + CSP + HSTS) e proteção CSRF double-submit.

import { randomBytes } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import helmet from "helmet";
import { parse as parseCookieHeader } from "cookie";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

export const CSRF_COOKIE_NAME = "app_csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ─── helmet ──────────────────────────────────────────────────────────────────
// Em desenvolvimento a CSP é desligada (o Vite injeta scripts inline + HMR).
// Em produção ela entra em **report-only** primeiro (não quebra nada, só loga
// em /api/csp-report). Depois de validar, trocar `reportOnly` para false.
const CSP_REPORT_ONLY = process.env.CSP_ENFORCE !== "true";

export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: ENV.isProduction
      ? {
          reportOnly: CSP_REPORT_ONLY,
          useDefaults: true,
          directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "blob:", "https:"],
            "media-src": ["'self'", "blob:", "https:"],
            "font-src": ["'self'", "data:"],
            "connect-src": ["'self'", "https:"],
            "frame-ancestors": ["'self'"],
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "report-uri": ["/api/csp-report"],
            "upgrade-insecure-requests": [],
          },
        }
      : false,
    hsts: ENV.isProduction
      ? { maxAge: 15552000, includeSubDomains: true, preload: false }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
}

// ─── CSRF double-submit ──────────────────────────────────────────────────────

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  return parseCookieHeader(header)[name];
}

/** Garante que todo cliente tenha um cookie CSRF legível (não-httpOnly). */
export function csrfCookieSetter(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!readCookie(req, CSRF_COOKIE_NAME)) {
      const opts = getSessionCookieOptions(req);
      res.cookie(CSRF_COOKIE_NAME, randomBytes(24).toString("base64url"), {
        ...opts,
        httpOnly: false, // o JS do app precisa ler para reenviar no header
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });
    }
    next();
  };
}

/**
 * Exige header `x-csrf-token` igual ao cookie em métodos que alteram estado.
 * Aplicar só em rotas autenticadas por cookie de sessão (ex: /api/trpc).
 * Webhooks (X-Api-Key / HMAC) e callbacks OAuth (GET) não passam por aqui.
 */
export function csrfGuard(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const cookie = readCookie(req, CSRF_COOKIE_NAME);
    const header = req.headers[CSRF_HEADER];
    const headerValue = Array.isArray(header) ? header[0] : header;
    if (!cookie || !headerValue || cookie !== headerValue) {
      res.status(403).json({ error: "CSRF token inválido ou ausente." });
      return;
    }
    next();
  };
}
