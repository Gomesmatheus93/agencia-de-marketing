import { getMetaFetchableStorageUrl } from "./storage";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLog, unitAnnouncements, unitMaterials, unitPostMarks, units, unitWeeklyPlans, userUnits, users, type UnitPlanItem, type User } from "../drizzle/schema";
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

export async function conn() {
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

/**
 * Academias que a pessoa pode ver: todas (direção/super admin do sistema da Alle, e a equipe da
 * agência em prévia) ou as liberadas no login unificado (gestor/visualizador: 1; regional: o grupo).
 */
async function accessibleUnits(me: User) {
  const c = await conn();
  if (me.accountType !== "unit" || me.allUnits) {
    return c.select().from(units).where(eq(units.active, true)).orderBy(units.name);
  }
  const links = await c.select({ unitId: userUnits.unitId }).from(userUnits).where(eq(userUnits.userId, me.id));
  const ids = links.length ? links.map((l) => l.unitId) : me.unitId ? [me.unitId] : [];
  if (!ids.length) return [];
  return c.select().from(units).where(and(inArray(units.id, ids), eq(units.active, true))).orderBy(units.name);
}

/** Academia aberta no portal (a escolhida, se ainda for permitida; senão a primeira). */
export async function currentUnit(me: User) {
  const list = await accessibleUnits(me);
  return { list, current: list.find((u) => u.id === me.unitId) ?? list[0] ?? null };
}

// ─── Portal (contas de unidade; a equipe também consegue ver, como prévia) ────

export const unitPortalRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.actualUser;
    const { list, current } = await currentUnit(me);
    return {
      name: me.name, isUnit: me.accountType === "unit", role: me.externalRole, groupName: me.groupName,
      allUnits: me.accountType !== "unit" || me.allUnits,
      unit: current ? { id: current.id, name: current.name, code: current.code, city: current.city, signupUrl: current.signupUrl, qrUrl: current.qrUrl } : null,
      units: list.map((u) => ({ id: u.id, name: u.name, groupName: u.groupName })),
    };
  }),

  /** Troca a academia aberta no portal (só entre as liberadas). */
  selectUnit: protectedProcedure.input(z.object({ unitId: z.number().int() })).mutation(async ({ ctx, input }) => {
    const list = await accessibleUnits(ctx.actualUser);
    if (!list.some((u) => u.id === input.unitId)) throw new TRPCError({ code: "FORBIDDEN", message: "Academia não liberada para você." });
    const c = await conn();
    await c.update(users).set({ unitId: input.unitId }).where(eq(users.id, ctx.actualUser.id));
    return { ok: true };
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
      const unitId = (await currentUnit(ctx.actualUser)).current?.id ?? null;
      const posted = plan && unitId
        ? (await c.select({ i: unitPostMarks.itemIndex }).from(unitPostMarks).where(and(eq(unitPostMarks.unitId, unitId), eq(unitPostMarks.weekStart, wanted)))).map((r) => r.i)
        : [];
      // Próximas semanas já publicadas (prévia).
      const next = published.filter((p) => p.weekStart > (plan?.weekStart ?? current)).map((p) => p.weekStart).sort().slice(0, 3);
      const upcoming = next.length
        ? (await c.select().from(unitWeeklyPlans).where(and(inArray(unitWeeklyPlans.weekStart, next), eq(unitWeeklyPlans.status, "published"))))
          .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
          .map((w) => ({ weekStart: w.weekStart, weekEnd: addDays(w.weekStart, 6), title: w.title, items: w.items.map((it) => ({ date: it.date, format: it.format ?? null, title: it.title, thumb: it.imageUrls[0] ?? null })) }))
        : [];
      return {
        weeks: published,
        plan: plan ? { weekStart: plan.weekStart, weekEnd: addDays(plan.weekStart, 6), title: plan.title, notes: plan.notes, items: plan.items } : null,
        weekStart: wanted,
        posted,
        upcoming,
        canMark: ctx.actualUser.accountType === "unit" && !!unitId,
      };
    }),

  /** "Já postei": marca (ou desmarca) um post da semana como publicado pela academia aberta. */
  markPosted: protectedProcedure
    .input(z.object({ weekStart: day, itemIndex: z.number().int().min(0).max(100), posted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.actualUser;
      if (me.accountType !== "unit") throw new TRPCError({ code: "BAD_REQUEST", message: "Só as contas das academias marcam o que postaram (aqui é uma prévia)." });
      const unit = (await currentUnit(me)).current;
      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma academia aberta." });
      const c = await conn();
      if (input.posted) {
        await c.insert(unitPostMarks).values({ unitId: unit.id, weekStart: input.weekStart, itemIndex: input.itemIndex, userId: me.id }).onConflictDoNothing();
        await db.recordAudit({ action: "unit.plan.posted", actorUserId: me.id, targetType: "unit_plan", targetId: input.weekStart, metadata: { unitId: unit.id, item: input.itemIndex } });
      } else {
        await c.delete(unitPostMarks).where(and(eq(unitPostMarks.unitId, unit.id), eq(unitPostMarks.weekStart, input.weekStart), eq(unitPostMarks.itemIndex, input.itemIndex)));
      }
      return { ok: true };
    }),

  /** Mural de avisos da equipe da Alle (fixados primeiro; os vencidos somem). */
  announcements: protectedProcedure.query(async () => {
    const c = await conn();
    const now = new Date();
    const rows = await c.select().from(unitAnnouncements).orderBy(desc(unitAnnouncements.pinned), desc(unitAnnouncements.createdAt)).limit(20);
    return rows.filter((a) => !a.expiresAt || a.expiresAt > now).slice(0, 6).map((a) => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned, createdAt: a.createdAt }));
  }),

  /** Biblioteca geral + materiais da unidade (ex.: mídia kit). */
  materials: protectedProcedure.query(async ({ ctx }) => {
    const c = await conn();
    const unitId = (await currentUnit(ctx.actualUser)).current?.id ?? null;
    const rows = await c.select().from(unitMaterials)
      .where(unitId ? or(isNull(unitMaterials.unitId), eq(unitMaterials.unitId, unitId)) : isNull(unitMaterials.unitId))
      .orderBy(desc(unitMaterials.createdAt));
    const strip = ({ fileUrl: _f, createdByUserId: _c, ...m }: typeof rows[number]) => m;
    // No kit da própria unidade, as imagens já vêm com a miniatura (o acesso foi conferido acima).
    const withThumb = (r: typeof rows[number]) => ({ ...strip(r), thumbUrl: r.contentType.startsWith("image/") ? r.fileUrl : null });
    return {
      training: rows.filter((r) => r.unitId === null && r.kind === "treinamento").map(strip),
      general: rows.filter((r) => r.unitId === null && r.kind !== "treinamento").map(strip),
      mine: rows.filter((r) => r.unitId !== null).sort((a, b) => `${a.description ?? ""}/${a.title}`.localeCompare(`${b.description ?? ""}/${b.title}`, "pt-BR", { numeric: true })).map(withThumb),
    };
  }),


  /** Libera o arquivo (confere se é desta unidade) e registra o download. */
  download: protectedProcedure
    .input(z.object({ materialId: z.number().int(), mode: z.enum(["baixar", "abrir"]).default("baixar") }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      const [m] = await c.select().from(unitMaterials).where(eq(unitMaterials.id, input.materialId));
      const me = ctx.actualUser;
      const allowed = m && (m.unitId === null || me.accountType !== "unit" || (await accessibleUnits(me)).some((u) => u.id === m.unitId));
      if (!allowed) throw new TRPCError({ code: "NOT_FOUND", message: "Material não encontrado." });
      if (me.accountType === "unit") {
        // Abrir/ampliar fica registrado à parte, para não inflar a contagem de downloads.
        await db.recordAudit({ action: input.mode === "abrir" ? "unit.material.view" : "unit.material.download", actorUserId: me.id, targetType: "unit_material", targetId: String(m.id), metadata: { unitId: me.unitId, title: m.title } });
      }
      return { url: m.fileUrl, fileName: m.fileName, contentType: m.contentType };
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

const UNIT_ACTIONS = ["sso.login", "unit.plan.view", "unit.plan.download", "unit.material.download", "unit.material.view", "unit.plan.posted", "unit.support.opened"];
const planItemSchema = z.object({
  date: day, time: z.string().max(10).nullable().optional(), format: z.string().max(30).nullable().optional(),
  title: z.string().trim().min(1).max(300), type: z.string().max(60).nullable().optional(), caption: z.string().max(5000).nullable().optional(),
  imageUrls: z.array(z.string().url().max(2000)).max(20),
  storyUrls: z.array(z.string().url().max(2000)).max(10).optional(),
});

export const unitAdminRouter = router({
  /** Visão geral: todas as unidades com contas, último acesso e atividade dos últimos 30 dias. */
  overview: adminProcedure.query(async () => {
    const c = await conn();
    const since = new Date(Date.now() - 30 * 86_400_000);
    const unitRows = await c.select().from(units).orderBy(units.name);
    const accounts = await c.select({ id: users.id, unitId: users.unitId, lastSignedIn: users.lastSignedIn, isActive: users.isActive, allUnits: users.allUnits })
      .from(users).where(eq(users.accountType, "unit"));
    const links = await c.select().from(userUnits);
    const unitsOfUser = new Map<number, number[]>();
    for (const l of links) unitsOfUser.set(l.userId, [...(unitsOfUser.get(l.userId) ?? []), l.unitId]);
    const events = await c.select({ actor: auditLog.actorUserId, action: auditLog.action, metadata: auditLog.metadata })
      .from(auditLog).where(and(inArray(auditLog.action, UNIT_ACTIONS), gte(auditLog.createdAt, since)));
    // Cada evento conta para a academia aberta no momento (metadata.unitId).
    const eventUnit = (e: { metadata: unknown }) => (e.metadata as { unitId?: number } | null)?.unitId ?? null;
    const materials = await c.select({ unitId: unitMaterials.unitId, kind: unitMaterials.kind }).from(unitMaterials);
    const [planRow] = await c.select({ n: sql<number>`count(*)::int` }).from(unitWeeklyPlans).where(eq(unitWeeklyPlans.status, "published"));
    const [current] = await c.select({ status: unitWeeklyPlans.status }).from(unitWeeklyPlans).where(eq(unitWeeklyPlans.weekStart, mondayOf()));
    // Adesão às postagens nas últimas 4 semanas: posts já vencidos (data até hoje) x marcados como postados.
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const fromWeek = addDays(mondayOf(), -21);
    const recentPlans = await c.select({ weekStart: unitWeeklyPlans.weekStart, items: unitWeeklyPlans.items }).from(unitWeeklyPlans)
      .where(and(eq(unitWeeklyPlans.status, "published"), gte(unitWeeklyPlans.weekStart, fromWeek)));
    const dueKeys = new Set(recentPlans.flatMap((p) => p.items.map((it, i) => (it.date <= today ? `${p.weekStart}:${i}` : null)).filter(Boolean) as string[]));
    const marks = await c.select().from(unitPostMarks).where(gte(unitPostMarks.weekStart, fromWeek));
    const thisWeek = mondayOf();

    const list = unitRows.map((u) => {
      const accs = accounts.filter((a) => !a.allUnits && (unitsOfUser.get(a.id) ?? (a.unitId ? [a.unitId] : [])).includes(u.id));
      const ev = events.filter((e) => eventUnit(e) === u.id);
      const last = accs.map((a) => a.lastSignedIn).filter(Boolean).sort((a, b) => +b! - +a!)[0] ?? null;
      return {
        id: u.id, code: u.code, name: u.name, city: u.city, groupName: u.groupName, active: u.active,
        accounts: accs.length,
        lastAccess: last,
        logins30d: ev.filter((e) => e.action === "sso.login").length,
        views30d: ev.filter((e) => e.action === "unit.plan.view").length,
        downloads30d: ev.filter((e) => e.action === "unit.material.download" || e.action === "unit.plan.download").length,
        posted4w: marks.filter((m) => m.unitId === u.id && dueKeys.has(`${m.weekStart}:${m.itemIndex}`)).length,
        due4w: dueKeys.size,
        postedThisWeek: marks.filter((m) => m.unitId === u.id && m.weekStart === thisWeek).length,
        hasLink: !!u.signupUrl,
        signupUrl: u.signupUrl,
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
        allUnitsAccounts: accounts.filter((a) => a.allUnits).length,
        accessed30d: list.filter((u) => u.logins30d > 0).length,
        neverAccessed: list.filter((u) => !u.lastAccess).length,
        withMidiaKit: list.filter((u) => u.hasMidiaKit).length,
        generalMaterials: materials.filter((m) => m.unitId === null).length,
        publishedPlans: planRow?.n ?? 0,
        postedThisWeek: list.filter((u) => u.postedThisWeek > 0).length,
        adherence4w: (() => { const due = dueKeys.size * list.filter((u) => u.active).length; const done = list.filter((u) => u.active).reduce((s, u) => s + u.posted4w, 0); return due ? Math.round((done / due) * 100) : null; })(),
        withLink: list.filter((u) => u.hasLink).length,
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
          const unitId = (r.metadata as { unitId?: number } | null)?.unitId ?? p?.unitId ?? null;
          return { at: r.at, action: r.action, userName: p?.name ?? "—", email: p?.email ?? null, role: p?.externalRole ?? null, unitId, unitName: unitId ? unitName.get(unitId) ?? "—" : "—", detail: (r.metadata as { title?: string } | null)?.title ?? r.targetId ?? null };
        })
        .filter((r) => !input.unitId || r.unitId === input.unitId)
        .slice(0, input.limit);
    }),

  /** Contas de uma unidade. */
  unitAccounts: adminProcedure.input(z.object({ unitId: z.number().int() })).query(async ({ input }) => {
    const c = await conn();
    // Contas com esta academia liberada (vínculo) e, à parte, quem vê todas.
    const linked = await c.select({ id: userUnits.userId }).from(userUnits).where(eq(userUnits.unitId, input.unitId));
    const all = await c.select({ id: users.id }).from(users).where(and(eq(users.accountType, "unit"), eq(users.allUnits, true)));
    const ids = [...new Set([...linked, ...all].map((r) => r.id))];
    const people = await Promise.all(ids.map((id) => db.getUserById(id)));
    return people.filter(Boolean).map((p) => ({
      id: p!.id, name: p!.name, email: p!.email, lastSignedIn: p!.lastSignedIn, isActive: p!.isActive, createdAt: p!.createdAt,
      role: p!.externalRole, groupName: p!.groupName, allUnits: p!.allUnits,
    }));
  }),

  saveUnit: adminProcedure
    .input(z.object({
      id: z.number().int().optional(),
      code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9:_-]{0,63}$/, "Código: letras minúsculas, números, :, - e _."),
      name: z.string().trim().min(2).max(255), city: z.string().trim().max(120).optional(), active: z.boolean().default(true),
      signupUrl: z.string().trim().url().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      const [same] = await c.select({ id: units.id }).from(units).where(eq(units.code, input.code));
      if (same && same.id !== input.id) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma unidade com esse código." });
      const values = { code: input.code, name: input.name, city: input.city || null, active: input.active, ...(input.signupUrl !== undefined ? { signupUrl: input.signupUrl || null } : {}) };
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
      unitId: z.number().int().nullable(), kind: z.enum(["material", "midia_kit", "treinamento"]),
      title: z.string().trim().min(1).max(255), description: z.string().trim().max(2000).optional(),
      fileUrl: z.string().url().max(2000), fileName: z.string().trim().min(1).max(255),
      contentType: z.string().max(120), sizeBytes: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      if (input.kind === "midia_kit" && input.unitId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "O mídia kit é de uma unidade: escolha a unidade." });
      if (input.kind === "treinamento" && input.unitId !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Treinamento vale para todas as unidades." });
      await c.insert(unitMaterials).values({ ...input, description: input.description || null, createdByUserId: ctx.actualUser!.id });
      return { ok: true };
    }),

  deleteMaterial: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    const c = await conn();
    await c.delete(unitMaterials).where(eq(unitMaterials.id, input.id));
    return { ok: true };
  }),

  // ── Mural de avisos ──
  announcements: adminProcedure.query(async () => {
    const c = await conn();
    return c.select().from(unitAnnouncements).orderBy(desc(unitAnnouncements.pinned), desc(unitAnnouncements.createdAt));
  }),

  saveAnnouncement: adminProcedure
    .input(z.object({
      id: z.number().int().optional(), title: z.string().trim().min(2).max(255), body: z.string().trim().max(3000).optional(),
      pinned: z.boolean().default(false), expiresAt: day.nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      const values = { title: input.title, body: input.body || null, pinned: input.pinned, expiresAt: input.expiresAt ? new Date(`${input.expiresAt}T23:59:59-03:00`) : null };
      if (input.id) await c.update(unitAnnouncements).set(values).where(eq(unitAnnouncements.id, input.id));
      else await c.insert(unitAnnouncements).values({ ...values, createdByUserId: ctx.actualUser!.id });
      return { ok: true };
    }),

  deleteAnnouncement: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    const c = await conn();
    await c.delete(unitAnnouncements).where(eq(unitAnnouncements.id, input.id));
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
      const planItems = ((plan.result as { items?: Array<{ date: string; time?: string; format?: string; title: string; type?: string }> } | null)?.items ?? []);
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
        items.push({ date: it.date, time: it.time ?? null, format: it.format ?? null, title: it.title, type: it.type ?? null, caption: out.caption, imageUrls: out.images });
      }
    }
    items.sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
    // Stories do planejamento entram como "story do dia" do post do feed da mesma data (se houver).
    const merged: UnitPlanItem[] = [];
    for (const it of items) {
      const feed = it.format === "stories" ? items.find((o) => o !== it && o.date === it.date && o.format !== "stories") : null;
      if (feed) feed.storyUrls = [...(feed.storyUrls ?? []), ...it.imageUrls].slice(0, 10);
      else merged.push(it);
    }
    return { items: merged };
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

/**
 * Mídia kit completo da academia aberta, em .zip (montado no servidor: o bucket não libera CORS).
 * Usado pela rota GET /api/unidade/midia-kit.zip.
 */
export async function buildUnitKitZip(me: User): Promise<{ zip: Buffer; fileName: string } | null> {
  const unit = (await currentUnit(me)).current;
  if (!unit) return null;
  const c = await conn();
  const rows = await c.select().from(unitMaterials).where(eq(unitMaterials.unitId, unit.id));
  if (!rows.length) return null;
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const r of rows) {
    const res = await fetch(await getMetaFetchableStorageUrl(r.fileUrl), { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Falha ao buscar ${r.fileName}`);
    let name = [r.description?.replace(/ › /g, "/"), r.fileName].filter(Boolean).join("/");
    for (let n = 2; used.has(name); n++) name = name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    used.add(name);
    zip.file(name, Buffer.from(await res.arrayBuffer()), { binary: true });
  }
  if (me.accountType === "unit") {
    await db.recordAudit({ action: "unit.material.download", actorUserId: me.id, targetType: "unit_kit", targetId: String(unit.id), metadata: { unitId: unit.id, title: "Mídia kit completo", files: rows.length } });
  }
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  return { zip: out, fileName: `Midia kit - ${unit.name}.zip` };
}
