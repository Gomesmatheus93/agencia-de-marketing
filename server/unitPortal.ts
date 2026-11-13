import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLog, unitMaterials, units, unitWeeklyPlans, users, type UnitPlanItem } from "../drizzle/schema";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import * as store from "./agents/store";
import * as db from "./db";

// Portal das unidades (academias parceiras) e painel de administração das unidades.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Segunda-feira da semana de uma data (horário de Brasília), YYYY-MM-DD. */
export function mondayOf(date = new Date()) {
  const br = new Date(date.getTime() - 3 * 3600_000);
  const d = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function conn() {
  const c = await db.getDb();
  if (!c) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  return c;
}

// Visualização do plano: no máximo 1 registro por pessoa, semana e dia (evita encher o log).
const viewSeen = new Set<string>();
function shouldLogView(key: string) {
  const k = `${key}|${new Date().toISOString().slice(0, 10)}`;
  if (viewSeen.has(k)) return false;
  if (viewSeen.size > 20_000) viewSeen.clear();
  viewSeen.add(k);
  return true;
}

// ─── Portal (contas de unidade; a equipe também consegue ver, como prévia) ────

export const unitPortalRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.actualUser;
    const c = await conn();
    const [unit] = me.unitId ? await c.select().from(units).where(eq(units.id, me.unitId)) : [];
    return { name: me.name, isUnit: me.accountType === "unit", unit: unit ? { id: unit.id, name: unit.name, code: unit.code, city: unit.city } : null };
  }),

  /** Planejamento publicado da semana (padrão: a semana atual) e as semanas disponíveis. */
  weekPlan: protectedProcedure
    .input(z.object({ weekStart: day.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const c = await conn();
      const published = await c.select({ weekStart: unitWeeklyPlans.weekStart, title: unitWeeklyPlans.title })
        .from(unitWeeklyPlans).where(eq(unitWeeklyPlans.status, "published")).orderBy(desc(unitWeeklyPlans.weekStart)).limit(12);
      const current = mondayOf();
      const wanted = input?.weekStart ?? (published.find((p) => p.weekStart <= current)?.weekStart ?? published[0]?.weekStart ?? current);
      const [plan] = await c.select().from(unitWeeklyPlans).where(and(eq(unitWeeklyPlans.weekStart, wanted), eq(unitWeeklyPlans.status, "published")));
      if (plan && ctx.actualUser.accountType === "unit" && shouldLogView(`${ctx.actualUser.id}:${wanted}`)) {
        await db.recordAudit({ action: "unit.plan.view", actorUserId: ctx.actualUser.id, targetType: "unit_plan", targetId: wanted, metadata: { unitId: ctx.actualUser.unitId } });
      }
      return {
        weeks: published,
        plan: plan ? { weekStart: plan.weekStart, weekEnd: addDays(plan.weekStart, 6), title: plan.title, notes: plan.notes, items: plan.items } : null,
        weekStart: wanted,
      };
    }),

  /** Biblioteca geral + materiais da unidade (ex.: mídia kit). */
  materials: protectedProcedure.query(async ({ ctx }) => {
    const c = await conn();
    const unitId = ctx.actualUser.unitId;
    const rows = await c.select().from(unitMaterials)
      .where(unitId ? or(isNull(unitMaterials.unitId), eq(unitMaterials.unitId, unitId)) : isNull(unitMaterials.unitId))
      .orderBy(desc(unitMaterials.createdAt));
    const strip = ({ fileUrl: _f, createdByUserId: _c, ...m }: typeof rows[number]) => m;
    return {
      general: rows.filter((r) => r.unitId === null).map(strip),
      mine: rows.filter((r) => r.unitId !== null).map(strip),
    };
  }),

  /** Libera o arquivo (confere se é desta unidade) e registra o download. */
  download: protectedProcedure
    .input(z.object({ materialId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      const [m] = await c.select().from(unitMaterials).where(eq(unitMaterials.id, input.materialId));
      const me = ctx.actualUser;
      const allowed = m && (m.unitId === null || m.unitId === me.unitId || me.accountType !== "unit");
      if (!allowed) throw new TRPCError({ code: "NOT_FOUND", message: "Material não encontrado." });
      if (me.accountType === "unit") {
        await db.recordAudit({ action: "unit.material.download", actorUserId: me.id, targetType: "unit_material", targetId: String(m.id), metadata: { unitId: me.unitId, title: m.title } });
      }
      return { url: m.fileUrl, fileName: m.fileName };
    }),

  /** Registra o download de uma arte ou legenda do planejamento. */
  trackPlanDownload: protectedProcedure
    .input(z.object({ weekStart: day, itemIndex: z.number().int().min(0).max(100), what: z.enum(["arte", "legenda"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.actualUser.accountType === "unit") {
        await db.recordAudit({ action: "unit.plan.download", actorUserId: ctx.actualUser.id, targetType: "unit_plan", targetId: input.weekStart, metadata: { unitId: ctx.actualUser.unitId, item: input.itemIndex, what: input.what } });
      }
      return { ok: true };
    }),
});

// ─── Administração das unidades (só administradores) ────────────────────────

const UNIT_ACTIONS = ["sso.login", "unit.plan.view", "unit.plan.download", "unit.material.download"];
const planItemSchema = z.object({
  date: day, time: z.string().max(10).nullable().optional(), format: z.string().max(30).nullable().optional(),
  title: z.string().trim().min(1).max(300), caption: z.string().max(5000).nullable().optional(),
  imageUrls: z.array(z.string().url().max(2000)).max(20),
});

export const unitAdminRouter = router({
  /** Visão geral: todas as unidades com contas, último acesso e atividade dos últimos 30 dias. */
  overview: adminProcedure.query(async () => {
    const c = await conn();
    const since = new Date(Date.now() - 30 * 86_400_000);
    const unitRows = await c.select().from(units).orderBy(units.name);
    const accounts = await c.select({ id: users.id, unitId: users.unitId, lastSignedIn: users.lastSignedIn, isActive: users.isActive })
      .from(users).where(eq(users.accountType, "unit"));
    const events = await c.select({ actor: auditLog.actorUserId, action: auditLog.action })
      .from(auditLog).where(and(inArray(auditLog.action, UNIT_ACTIONS), gte(auditLog.createdAt, since)));
    const unitOfUser = new Map(accounts.map((a) => [a.id, a.unitId]));
    const materials = await c.select({ unitId: unitMaterials.unitId, kind: unitMaterials.kind }).from(unitMaterials);
    const [planRow] = await c.select({ n: sql<number>`count(*)::int` }).from(unitWeeklyPlans).where(eq(unitWeeklyPlans.status, "published"));
    const [current] = await c.select({ status: unitWeeklyPlans.status }).from(unitWeeklyPlans).where(eq(unitWeeklyPlans.weekStart, mondayOf()));

    const list = unitRows.map((u) => {
      const accs = accounts.filter((a) => a.unitId === u.id);
      const ev = events.filter((e) => e.actor && unitOfUser.get(e.actor) === u.id);
      const last = accs.map((a) => a.lastSignedIn).filter(Boolean).sort((a, b) => +b! - +a!)[0] ?? null;
      return {
        id: u.id, code: u.code, name: u.name, city: u.city, active: u.active,
        accounts: accs.length,
        lastAccess: last,
        logins30d: ev.filter((e) => e.action === "sso.login").length,
        views30d: ev.filter((e) => e.action === "unit.plan.view").length,
        downloads30d: ev.filter((e) => e.action === "unit.material.download" || e.action === "unit.plan.download").length,
        hasMidiaKit: materials.some((m) => m.unitId === u.id && m.kind === "midia_kit"),
        ownMaterials: materials.filter((m) => m.unitId === u.id).length,
      };
    });
    return {
      units: list,
      totals: {
        units: list.length,
        activeUnits: list.filter((u) => u.active).length,
        accounts: accounts.length,
        accessed30d: list.filter((u) => u.logins30d > 0).length,
        neverAccessed: list.filter((u) => !u.lastAccess).length,
        withMidiaKit: list.filter((u) => u.hasMidiaKit).length,
        generalMaterials: materials.filter((m) => m.unitId === null).length,
        publishedPlans: planRow?.n ?? 0,
        currentWeekPublished: current?.status === "published",
      },
    };
  }),

  /** Últimos acessos e downloads das unidades. */
  activity: adminProcedure
    .input(z.object({ unitId: z.number().int().optional(), limit: z.number().int().min(10).max(500).default(100) }))
    .query(async ({ input }) => {
      const c = await conn();
      const rows = await c.select({ at: auditLog.createdAt, action: auditLog.action, actor: auditLog.actorUserId, targetId: auditLog.targetId, metadata: auditLog.metadata })
        .from(auditLog).where(inArray(auditLog.action, UNIT_ACTIONS)).orderBy(desc(auditLog.createdAt)).limit(input.unitId ? 2000 : input.limit);
      const ids = [...new Set(rows.map((r) => r.actor).filter((x): x is number => Boolean(x)))];
      const people = ids.length ? await Promise.all(ids.map((id) => db.getUserById(id))) : [];
      const byId = new Map(people.filter(Boolean).map((p) => [p!.id, p!]));
      const unitRows = await c.select({ id: units.id, name: units.name }).from(units);
      const unitName = new Map(unitRows.map((u) => [u.id, u.name]));
      return rows
        .map((r) => {
          const p = r.actor ? byId.get(r.actor) : undefined;
          const unitId = p?.unitId ?? null;
          return { at: r.at, action: r.action, userName: p?.name ?? "—", email: p?.email ?? null, unitId, unitName: unitId ? unitName.get(unitId) ?? "—" : "—", detail: (r.metadata as { title?: string } | null)?.title ?? r.targetId ?? null };
        })
        .filter((r) => !input.unitId || r.unitId === input.unitId)
        .slice(0, input.limit);
    }),

  /** Contas de uma unidade. */
  unitAccounts: adminProcedure.input(z.object({ unitId: z.number().int() })).query(async ({ input }) => {
    const c = await conn();
    const rows = await c.select({ id: users.id }).from(users).where(and(eq(users.accountType, "unit"), eq(users.unitId, input.unitId)));
    const people = await Promise.all(rows.map((r) => db.getUserById(r.id)));
    return people.filter(Boolean).map((p) => ({ id: p!.id, name: p!.name, email: p!.email, lastSignedIn: p!.lastSignedIn, isActive: p!.isActive, createdAt: p!.createdAt }));
  }),

  saveUnit: adminProcedure
    .input(z.object({
      id: z.number().int().optional(),
      code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "Código: letras minúsculas, números, - e _."),
      name: z.string().trim().min(2).max(255), city: z.string().trim().max(120).optional(), active: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      const [same] = await c.select({ id: units.id }).from(units).where(eq(units.code, input.code));
      if (same && same.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma unidade com esse código." });
      const values = { code: input.code, name: input.name, city: input.city || null, active: input.active };
      if (input.id) await c.update(units).set(values).where(eq(units.id, input.id));
      else await c.insert(units).values(values);
      await db.recordAudit({ action: input.id ? "unit.updated" : "unit.created", actorUserId: ctx.actualUser!.id, targetType: "unit", targetId: input.code });
      return { ok: true };
    }),

  setAccountActive: adminProcedure
    .input(z.object({ userId: z.number().int(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      const [u] = await c.select({ type: users.accountType }).from(users).where(eq(users.id, input.userId));
      if (u?.type !== "unit") throw new TRPCError({ code: "BAD_REQUEST", message: "Só contas de unidade." });
      await c.update(users).set({ isActive: input.active }).where(eq(users.id, input.userId));
      if (!input.active) await db.bumpUserTokenVersion(input.userId); // derruba as sessões abertas
      await db.recordAudit({ action: input.active ? "admin.reactivate" : "admin.deactivate", actorUserId: ctx.actualUser!.id, targetUserId: input.userId });
      return { ok: true };
    }),

  // ── Materiais ──
  materials: adminProcedure.query(async () => {
    const c = await conn();
    return c.select().from(unitMaterials).orderBy(desc(unitMaterials.createdAt));
  }),

  addMaterial: adminProcedure
    .input(z.object({
      unitId: z.number().int().nullable(), kind: z.enum(["material", "midia_kit"]),
      title: z.string().trim().min(1).max(255), description: z.string().trim().max(2000).optional(),
      fileUrl: z.string().url().max(2000), fileName: z.string().trim().min(1).max(255),
      contentType: z.string().max(120), sizeBytes: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      if (input.kind === "midia_kit" && input.unitId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "O mídia kit é de uma unidade: escolha a unidade." });
      await c.insert(unitMaterials).values({ ...input, description: input.description || null, createdByUserId: ctx.actualUser!.id });
      return { ok: true };
    }),

  deleteMaterial: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    const c = await conn();
    await c.delete(unitMaterials).where(eq(unitMaterials.id, input.id));
    return { ok: true };
  }),

  // ── Planejamento semanal ──
  getPlan: adminProcedure.input(z.object({ weekStart: day })).query(async ({ input }) => {
    const c = await conn();
    const [plan] = await c.select().from(unitWeeklyPlans).where(eq(unitWeeklyPlans.weekStart, input.weekStart));
    return plan ?? null;
  }),

  /** Monta a semana a partir do planejamento da Alle: pautas com arte criada, com todas as artes e a legenda. */
  importFromAlle: adminProcedure.input(z.object({ weekStart: day })).mutation(async ({ ctx, input }) => {
    const end = addDays(input.weekStart, 6);
    const plans = await store.listThreads(ctx.user.id, "planejamento", "task");
    const items: UnitPlanItem[] = [];
    const covered = new Set<string>();
    for (const plan of plans) {
      const planItems = ((plan.result as { items?: Array<{ date: string; time?: string; format?: string; title: string }> } | null)?.items ?? []);
      const inWeek = planItems.map((it, index) => ({ it, index })).filter(({ it }) => it.date >= input.weekStart && it.date <= end && !covered.has(it.date));
      if (!inWeek.length) continue;
      const outputs = new Map<number, { images: string[]; caption: string | null }>();
      for (const t of await store.listPlanOutputs(ctx.user.id, plan.id)) {
        const index = Number((t.taskInput as { planLink?: { index?: number } } | null)?.planLink?.index);
        const r = (t.result ?? {}) as Record<string, any>;
        const images: string[] = (r.slides?.map((s: any) => s.imageUrl) ?? r.frames?.map((f: any) => f.imageUrl) ?? (r.imageUrl ? [r.imageUrl] : [])).filter(Boolean);
        if (Number.isInteger(index) && images.length) outputs.set(index, { images, caption: r.caption ?? null }); // a mais nova vence
      }
      for (const { it, index } of inWeek) {
        const out = outputs.get(index);
        covered.add(it.date);
        if (!out) continue; // sem arte criada, a unidade não tem o que postar
        items.push({ date: it.date, time: it.time ?? null, format: it.format ?? null, title: it.title, caption: out.caption, imageUrls: out.images });
      }
    }
    items.sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
    return { items };
  }),

  savePlan: adminProcedure
    .input(z.object({ weekStart: day, title: z.string().trim().max(255).optional(), notes: z.string().trim().max(5000).optional(), items: z.array(planItemSchema).max(30), publish: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (mondayOf(new Date(`${input.weekStart}T15:00:00Z`)) !== input.weekStart) throw new TRPCError({ code: "BAD_REQUEST", message: "A semana precisa começar numa segunda-feira." });
      const c = await conn();
      const values = {
        title: input.title || null, notes: input.notes || null, items: input.items,
        status: input.publish ? "published" : "draft", publishedAt: input.publish ? new Date() : null, createdByUserId: ctx.actualUser!.id,
      };
      await c.insert(unitWeeklyPlans).values({ weekStart: input.weekStart, ...values })
        .onConflictDoUpdate({ target: unitWeeklyPlans.weekStart, set: values });
      await db.recordAudit({ action: input.publish ? "unit.plan.published" : "unit.plan.saved", actorUserId: ctx.actualUser!.id, targetType: "unit_plan", targetId: input.weekStart });
      return { ok: true };
    }),
});
