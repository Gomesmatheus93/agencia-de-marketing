import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// Simple in-process sliding-window rate limiter per IP.
// For multi-instance deploys, replace with a Redis-backed store.

const rateLimitWindows = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const entry = rateLimitWindows.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitWindows.set(ip, { count: 1, resetAt: now + windowMs });
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

// Cleans up expired entries every 5 minutes to prevent memory leaks.
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitWindows.entries()).forEach(([key, entry]) => {
    if (now > entry.resetAt) rateLimitWindows.delete(key);
  });
}, 5 * 60 * 1000).unref();

const withRateLimit = (limit: number, windowMs: number) =>
  t.middleware(({ ctx, next }) => {
    const ip = ctx.req.ip ?? ctx.req.socket?.remoteAddress ?? "unknown";
    checkRateLimit(ip, limit, windowMs);
    return next();
  });

// ─── Middlewares ──────────────────────────────────────────────────────────────

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// 120 requests per minute for standard authenticated routes
const standardRateLimit = withRateLimit(120, 60_000);
// 10 AI-generation requests per minute (expensive operations)
const aiRateLimit = withRateLimit(10, 60_000);

export const protectedProcedure = t.procedure.use(requireUser).use(standardRateLimit);
export const aiProcedure = t.procedure.use(requireUser).use(aiRateLimit);
// 5 attempts per 15 minutes — for login/register
export const publicRateLimitedProcedure = t.procedure.use(withRateLimit(5, 15 * 60_000));

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
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
