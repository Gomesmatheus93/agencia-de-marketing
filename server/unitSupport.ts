import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { unitSupportMessages, unitSupportTickets, units, type User } from "../drizzle/schema";
import { sendEmail } from "./_core/email";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { conn, currentUnit } from "./unitPortal";

// Suporte das unidades: a academia abre um chamado e conversa com a equipe da Alle.
// A equipe recebe e-mail a cada mensagem da unidade; a unidade recebe e-mail quando a equipe responde.

export const SUPPORT_CATEGORIES = {
  post: "Dúvida sobre um post ou legenda",
  material: "Material ou mídia kit",
  adesao: "Benefício e adesão de alunos",
  acesso: "Acesso à plataforma",
  outro: "Outro assunto",
} as const;
type Category = keyof typeof SUPPORT_CATEGORIES;
const categorySchema = z.enum(Object.keys(SUPPORT_CATEGORIES) as [Category, ...Category[]]);

const APP_URL = (process.env.PUBLIC_APP_URL || "https://agencia.alleenergia.com").replace(/\/$/, "");
const TEAM_EMAIL = process.env.UNIT_SUPPORT_EMAIL || "matheus@alleenergia.com";
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function notify(to: string | null | undefined, subject: string, lines: string[], link: string) {
  if (!to) return;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1E0A01">${lines.map((l) => `<p style="white-space:pre-wrap">${esc(l)}</p>`).join("")}<p><a href="${link}" style="color:#7B2FBE;font-weight:600">Abrir o chamado</a></p></div>`;
  try {
    await sendEmail({ to, subject, html, text: `${lines.join("\n\n")}\n\n${link}`, tag: "unit-support" });
  } catch (err) {
    console.error("[suporte] falha ao enviar e-mail:", err);
  }
}

async function ticketOfUnit(me: User, ticketId: number) {
  const unit = (await currentUnit(me)).current;
  const c = await conn();
  const [t] = await c.select().from(unitSupportTickets).where(eq(unitSupportTickets.id, ticketId));
  if (!t || !unit || t.unitId !== unit.id) throw new TRPCError({ code: "NOT_FOUND", message: "Chamado não encontrado." });
  return t;
}

async function messagesOf(ticketId: number) {
  const c = await conn();
  const rows = await c.select().from(unitSupportMessages).where(eq(unitSupportMessages.ticketId, ticketId)).orderBy(asc(unitSupportMessages.createdAt));
  const ids = [...new Set(rows.map((r) => r.authorUserId))];
  const people = new Map((await Promise.all(ids.map((id) => db.getUserById(id)))).filter(Boolean).map((p) => [p!.id, p!]));
  return rows.map((r) => ({
    id: r.id, body: r.body, fromTeam: r.fromTeam, createdAt: r.createdAt,
    author: r.fromTeam ? "Equipe Alle" : people.get(r.authorUserId)?.name ?? "Unidade",
  }));
}

const bodySchema = z.string().trim().min(2, "Escreva a mensagem.").max(4000);

// ─── Portal da unidade ───────────────────────────────────────────────────────
export const unitSupportRouter = router({
  categories: protectedProcedure.query(() => Object.entries(SUPPORT_CATEGORIES).map(([id, label]) => ({ id, label }))),

  list: protectedProcedure.query(async ({ ctx }) => {
    const unit = (await currentUnit(ctx.actualUser)).current;
    if (!unit) return [];
    const c = await conn();
    return c.select().from(unitSupportTickets).where(eq(unitSupportTickets.unitId, unit.id)).orderBy(desc(unitSupportTickets.lastMessageAt));
  }),

  unread: protectedProcedure.query(async ({ ctx }) => {
    const unit = (await currentUnit(ctx.actualUser)).current;
    if (!unit) return 0;
    const c = await conn();
    return (await c.select({ id: unitSupportTickets.id }).from(unitSupportTickets).where(and(eq(unitSupportTickets.unitId, unit.id), eq(unitSupportTickets.unreadByUnit, true)))).length;
  }),

  get: protectedProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const t = await ticketOfUnit(ctx.actualUser, input.id);
    if (t.unreadByUnit && ctx.actualUser.accountType === "unit") {
      const c = await conn();
      await c.update(unitSupportTickets).set({ unreadByUnit: false }).where(eq(unitSupportTickets.id, t.id));
    }
    return { ticket: { ...t, unreadByUnit: false }, messages: await messagesOf(t.id) };
  }),

  create: protectedProcedure
    .input(z.object({ category: categorySchema, subject: z.string().trim().min(3, "Escreva o assunto.").max(200), body: bodySchema }))
    .mutation(async ({ ctx, input }) => {
      const me = ctx.actualUser;
      if (me.accountType !== "unit") throw new TRPCError({ code: "BAD_REQUEST", message: "Só as contas das academias abrem chamados (aqui é uma prévia)." });
      const unit = (await currentUnit(me)).current;
      if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma academia aberta." });
      const c = await conn();
      const [t] = await c.insert(unitSupportTickets).values({ unitId: unit.id, userId: me.id, category: input.category, subject: input.subject }).returning();
      await c.insert(unitSupportMessages).values({ ticketId: t.id, authorUserId: me.id, body: input.body });
      await db.recordAudit({ action: "unit.support.opened", actorUserId: me.id, targetType: "unit_support", targetId: String(t.id), metadata: { unitId: unit.id, title: input.subject } });
      await notify(TEAM_EMAIL, `[Suporte] ${unit.name}: ${input.subject}`,
        [`${me.name ?? "Unidade"} (${unit.name}) abriu um chamado.`, `Assunto: ${SUPPORT_CATEGORIES[input.category]} · ${input.subject}`, input.body],
        `${APP_URL}/app/dashboard/unidades?suporte=${t.id}`);
      return { id: t.id };
    }),

  reply: protectedProcedure.input(z.object({ id: z.number().int(), body: bodySchema })).mutation(async ({ ctx, input }) => {
    const me = ctx.actualUser;
    if (me.accountType !== "unit") throw new TRPCError({ code: "BAD_REQUEST", message: "Responda pelo painel de Unidades." });
    const t = await ticketOfUnit(me, input.id);
    const c = await conn();
    await c.insert(unitSupportMessages).values({ ticketId: t.id, authorUserId: me.id, body: input.body });
    await c.update(unitSupportTickets).set({ status: "aberto", unreadByTeam: true, lastMessageAt: new Date() }).where(eq(unitSupportTickets.id, t.id));
    const [unit] = await c.select({ name: units.name }).from(units).where(eq(units.id, t.unitId));
    await notify(TEAM_EMAIL, `[Suporte] ${unit?.name ?? "Unidade"}: ${t.subject}`, [`Nova mensagem de ${me.name ?? "Unidade"} (${unit?.name ?? ""}):`, input.body], `${APP_URL}/app/dashboard/unidades?suporte=${t.id}`);
    return { ok: true };
  }),

  resolve: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const t = await ticketOfUnit(ctx.actualUser, input.id);
    const c = await conn();
    await c.update(unitSupportTickets).set({ status: "resolvido" }).where(eq(unitSupportTickets.id, t.id));
    return { ok: true };
  }),
});

// ─── Painel da equipe ────────────────────────────────────────────────────────
export const unitSupportAdminRouter = router({
  list: adminProcedure.input(z.object({ status: z.enum(["todos", "aberto", "respondido", "resolvido"]).default("todos") })).query(async ({ input }) => {
    const c = await conn();
    const rows = await c.select().from(unitSupportTickets)
      .where(input.status === "todos" ? undefined : eq(unitSupportTickets.status, input.status))
      .orderBy(desc(unitSupportTickets.unreadByTeam), desc(unitSupportTickets.lastMessageAt)).limit(300);
    const unitIds = [...new Set(rows.map((r) => r.unitId))];
    const names = new Map((unitIds.length ? await c.select({ id: units.id, name: units.name }).from(units).where(inArray(units.id, unitIds)) : []).map((u) => [u.id, u.name]));
    const people = new Map((await Promise.all([...new Set(rows.map((r) => r.userId))].map((id) => db.getUserById(id)))).filter(Boolean).map((p) => [p!.id, p!]));
    return rows.map((r) => ({ ...r, unitName: names.get(r.unitId) ?? "—", openedBy: people.get(r.userId)?.name ?? "—", categoryLabel: SUPPORT_CATEGORIES[r.category as Category] ?? r.category }));
  }),

  unread: adminProcedure.query(async () => {
    const c = await conn();
    return (await c.select({ id: unitSupportTickets.id }).from(unitSupportTickets).where(eq(unitSupportTickets.unreadByTeam, true))).length;
  }),

  get: adminProcedure.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const c = await conn();
    const [t] = await c.select().from(unitSupportTickets).where(eq(unitSupportTickets.id, input.id));
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Chamado não encontrado." });
    if (t.unreadByTeam) await c.update(unitSupportTickets).set({ unreadByTeam: false }).where(eq(unitSupportTickets.id, t.id));
    const [unit] = await c.select({ name: units.name }).from(units).where(eq(units.id, t.unitId));
    const opener = await db.getUserById(t.userId);
    return {
      ticket: { ...t, unreadByTeam: false, unitName: unit?.name ?? "—", categoryLabel: SUPPORT_CATEGORIES[t.category as Category] ?? t.category, openedBy: opener?.name ?? "—", openedByEmail: opener?.email ?? null, openedByRole: opener?.externalRole ?? null },
      messages: await messagesOf(t.id),
    };
  }),

  reply: adminProcedure.input(z.object({ id: z.number().int(), body: bodySchema, resolve: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const c = await conn();
    const [t] = await c.select().from(unitSupportTickets).where(eq(unitSupportTickets.id, input.id));
    if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Chamado não encontrado." });
    await c.insert(unitSupportMessages).values({ ticketId: t.id, authorUserId: ctx.actualUser!.id, fromTeam: true, body: input.body });
    await c.update(unitSupportTickets).set({ status: input.resolve ? "resolvido" : "respondido", unreadByUnit: true, unreadByTeam: false, lastMessageAt: new Date() }).where(eq(unitSupportTickets.id, t.id));
    const opener = await db.getUserById(t.userId);
    await notify(opener?.email, `Alle Energia respondeu: ${t.subject}`, [`A equipe da Alle respondeu o seu chamado "${t.subject}":`, input.body], `${APP_URL}/app/unidade/suporte`);
    return { ok: true };
  }),

  setStatus: adminProcedure.input(z.object({ id: z.number().int(), status: z.enum(["aberto", "respondido", "resolvido"]) })).mutation(async ({ input }) => {
    const c = await conn();
    await c.update(unitSupportTickets).set({ status: input.status }).where(eq(unitSupportTickets.id, input.id));
    return { ok: true };
  }),
});
