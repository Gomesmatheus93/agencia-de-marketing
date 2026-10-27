import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { redisIncrWithTtl } from "./redis";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Janela fixa por chave. Usa Redis quando REDIS_URL está configurado (contagem
// compartilhada entre réplicas); sem isso, cai pro Map em memória do processo
// (comportamento de instância única, igual antes).

const rateLimitWindows = new Map<string, { count: number; resetAt: number }>();

function checkRateLimitInMemory(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const entry = rateLimitWindows.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitWindows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count += 1;
  if (entry.count > limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas requisições. Tente novamente em alguns instantes.",
    });
  }
}

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const redisCount = await redisIncrWithTtl(`ratelimit:${key}`, windowMs);
  if (redisCount !== null) {
    if (redisCount > limit) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Muitas requisições. Tente novamente em alguns instantes.",
      });
    }
    return;
  }
  checkRateLimitInMemory(key, limit, windowMs);
}

// Cleans up expired entries every 5 minutes to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitWindows.entries()).forEach(([key, entry]) => {
    if (now > entry.resetAt) rateLimitWindows.delete(key);
  });
}, 5 * 60 * 1000).unref();

// IP-based limiter — only for unauthenticated routes (login/register)
const withIpRateLimit = (limit: number, windowMs: number) =>
  t.middleware(async ({ ctx, next }) => {
    const ip = ctx.req.ip ?? ctx.req.socket?.remoteAddress ?? "unknown";
    await checkRateLimit(`ip:${ip}`, limit, windowMs);
    return next();
  });

// ─── Middlewares ──────────────────────────────────────────────────────────────

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || !ctx.actualUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      actualUser: ctx.actualUser,
    },
  });
});

// Per-user rate limits — uses userId so users behind the same proxy/NAT
// (Traefik, load balancers) each get their own independent bucket.
// 200 requests per minute for standard authenticated routes
const standardRateLimit = t.middleware(async ({ ctx, next }) => {
  const key = `std:${ctx.user?.id ?? ctx.req.ip ?? "unknown"}`;
  await checkRateLimit(key, 200, 60_000);
  return next();
});

// 40 AI-generation requests per minute per user
// A single carousel (5 slides + images) triggers ~1 tRPC call, so 40/min
// gives comfortable room for testing and iterating on individual slides.
const aiRateLimit = t.middleware(async ({ ctx, next }) => {
  const key = `ai:${ctx.user?.id ?? ctx.req.ip ?? "unknown"}`;
  await checkRateLimit(key, 40, 60_000);
  return next();
});

// Sem confirmação de e-mail: a plataforma é interna e as contas da equipe são
// criadas pela conta principal (Equipe), então login com senha já basta.
export const authedProcedure = t.procedure.use(requireUser).use(standardRateLimit);

export const protectedProcedure = authedProcedure;
export const aiProcedure = t.procedure.use(requireUser).use(aiRateLimit);
// 10 requests per 15 minutes per IP — para login/registro/verificação/reset/2FA.
// O brute-force de senha em si tem proteção dedicada (server/_core/loginGuard.ts:
// 5 falhas por e-mail+IP), então este limite de IP pode ser um pouco mais folgado
// para não travar um fluxo legítimo de login + código 2FA.
export const publicRateLimitedProcedure = t.procedure.use(withIpRateLimit(10, 15 * 60_000));
// 30 requests per 15 minutes per IP — for the client-facing approval page
// (view + respond). Much more lenient than login: a real client opening the
// link, reading the content and clicking approve/comment easily needs more
// than 5 requests, and several clients can share an office IP.
export const publicContentProcedure = t.procedure.use(withIpRateLimit(30, 15 * 60_000));

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    // Admin authority must come from the identity that actually logged in,
    // never from ctx.user (which resolves to the company owner for an
    // employee sub-account) — otherwise any employee added under an admin
    // account would silently inherit full platform-admin rights.
    if (!ctx.user || !ctx.actualUser || ctx.actualUser.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ownerProcedure is now identical to adminProcedure — any user with role "admin" qualifies.
export const ownerProcedure = adminProcedure;
