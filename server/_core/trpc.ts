import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { redisIncrWithTtl } from "./redis";
import { recordAudit } from "../db";

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

// Conta de unidade (academia parceira) só usa o portal da unidade, o login e o próprio perfil.
// A regra fica no servidor: esconder o menu não basta (ninguém chama agentes de IA, analytics etc.).
const UNIT_ALLOWED_PATHS = [/^auth\./, /^unitPortal\./, /^unitSupport\./, /^profile\./];
export function isUnitPathAllowed(path: string) {
  return UNIT_ALLOWED_PATHS.some((re) => re.test(path));
}

// Conta "restrita" (funcionário de uma conta principal, pedido de 23/11/2026):
// só Dashboard, Planejamento e Calendário, e só ver e editar. Nada de criar,
// gerar com IA, excluir, publicar ou enviar. Lista fechada: rota nova fica
// bloqueada até alguém liberar aqui de propósito.
const LIMITED_ALLOWED_PATHS = new Set([
  // Própria conta e sessão.
  "auth.me", "auth.logout", "auth.logoutAllDevices", "auth.trialStatus",
  "artStudio.myAccess",
  // Dashboard (OperationalDashboard): resumo do período, números do Instagram e do Direct, só leitura.
  "dashboard.period", "agents.recent", "inbox.conversations",
  "analytics.getInsights", "analytics.getInstagramConnectionStatus", "analytics.getMedia", "analytics.getProfile",
  // Planejamento: ver o plano e as artes, editar pauta (inclui mover de dia).
  "agents.tasks", "agents.task", "agents.planOutputs", "agents.updatePlanItem",
  // Ver todas as artes de um conteúdo (carrossel completo) e editar arte e legenda.
  "agents.artSource", "agents.saveArt", "agents.undoArtEdit", "agents.editCaption",
  // Calendário: ver posts e pautas, editar pauta (status e dia).
  "posts.getAll", "editorialPlan.getByMonth", "editorialPlan.updateItem",
]);
export function isLimitedPathAllowed(path: string) {
  return LIMITED_ALLOWED_PATHS.has(path) || path.startsWith("profile.") || path.startsWith("auth.twoFactor.");
}

const requireUser = t.middleware(async opts => {
  const { ctx, next, path } = opts;

  if (!ctx.user || !ctx.actualUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.actualUser.accountType === "unit" && !isUnitPathAllowed(path)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta conta de unidade só tem acesso ao portal da unidade." });
  }
  if (ctx.actualUser.accountType === "limited" && !isLimitedPathAllowed(path)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Este acesso permite só ver e editar o Dashboard, o Planejamento e o Calendário." });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      actualUser: ctx.actualUser,
    },
  });
});

// ─── Registro de alterações (pedido de 23/11/2026) ───────────────────────────────
// Toda mutation que dá certo vira uma linha em audit_log (action "change"): quem
// fez (actorUserId = quem logou), em nome de qual conta (targetUserId), a rota e
// um resumo do que foi enviado. Senhas, códigos, desenhos (svg) e arquivos em
// base64 nunca entram. O login já é registrado à parte (login.*, sso.login).
const AUDIT_SKIP = [/^auth\./, /^system\./];
const SECRET_KEY = /password|senha|token|secret|base64|dataurl|^(code|otp|svg|file|audio|blob|imageData)$/i;
function summarize(v: unknown, depth = 0): unknown {
  if (v == null || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  if (v instanceof Date) return v.toISOString();
  if (depth >= 4) return "…";
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => summarize(x, depth + 1));
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, 30)) {
      out[k] = SECRET_KEY.test(k) ? "(omitido)" : summarize(x, depth + 1);
    }
    return out;
  }
  return String(v);
}
const auditChanges = t.middleware(async ({ ctx, next, path, type, getRawInput }) => {
  const result = await next();
  if (type === "mutation" && result.ok && ctx.actualUser && !AUDIT_SKIP.some((re) => re.test(path))) {
    const input = await getRawInput().catch(() => undefined);
    const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    const ref = obj.threadId ?? obj.id ?? obj.postId ?? obj.memberId ?? null;
    void recordAudit({
      action: "change",
      actorUserId: ctx.actualUser.id,
      targetUserId: ctx.user?.id ?? null,
      targetType: path.split(".")[0].slice(0, 32),
      targetId: ref == null ? null : String(ref).slice(0, 64),
      ip: ctx.req.ip ?? null,
      userAgent: String(ctx.req.headers?.["user-agent"] ?? "").slice(0, 255) || null,
      metadata: { path, input: summarize(input) as Record<string, unknown> },
    });
  }
  return result;
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
export const authedProcedure = t.procedure.use(requireUser).use(standardRateLimit).use(auditChanges);

export const protectedProcedure = authedProcedure;
export const aiProcedure = t.procedure.use(requireUser).use(aiRateLimit).use(auditChanges);
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
).use(auditChanges);

// ownerProcedure is now identical to adminProcedure — any user with role "admin" qualifies.
export const ownerProcedure = adminProcedure;
