import { and, asc, desc, eq, ilike, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { agentThreads, ctas, socialPosts, type Cta } from "../drizzle/schema";
import { getDb } from "./db";

// Banco de CTAs (aba CTAs). Tudo por conta: userId é a conta principal da empresa.

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db;
}

export type CtaFilter = { search?: string; category?: string; angle?: string; source?: string; favorite?: boolean };

export async function listCtas(userId: number, f: CtaFilter = {}): Promise<Cta[]> {
  const db = await requireDb();
  const where: SQL[] = [eq(ctas.userId, userId)];
  if (f.search) {
    const q = `%${f.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push(or(ilike(ctas.text, q), ilike(ctas.notes, q), ilike(ctas.category, q), ilike(ctas.angle, q))!);
  }
  if (f.category) where.push(eq(ctas.category, f.category));
  if (f.angle) where.push(eq(ctas.angle, f.angle));
  if (f.source) where.push(eq(ctas.source, f.source));
  if (f.favorite) where.push(eq(ctas.favorite, true));
  return db.select().from(ctas).where(and(...where)).orderBy(desc(ctas.favorite), desc(ctas.createdAt));
}

/** Frases do banco em forma curta, para o agente não repetir. */
export async function listCtaTexts(userId: number) {
  const db = await requireDb();
  return db.select({ text: ctas.text, category: ctas.category, angle: ctas.angle }).from(ctas)
    .where(eq(ctas.userId, userId)).orderBy(asc(ctas.category), asc(ctas.angle)).limit(400);
}

export async function ctaFacets(userId: number) {
  const db = await requireDb();
  const cats = await db.selectDistinct({ v: ctas.category }).from(ctas).where(eq(ctas.userId, userId)).orderBy(asc(ctas.category));
  const angles = await db.selectDistinct({ v: ctas.angle }).from(ctas).where(and(eq(ctas.userId, userId), isNotNull(ctas.angle))).orderBy(asc(ctas.angle));
  return { categories: cats.map((c) => c.v), angles: angles.map((a) => a.v!).filter(Boolean) };
}

export async function getCta(userId: number, id: number): Promise<Cta | undefined> {
  const db = await requireDb();
  const [row] = await db.select().from(ctas).where(and(eq(ctas.id, id), eq(ctas.userId, userId))).limit(1);
  return row;
}

export type CtaWrite = { text: string; category: string; angle?: string | null; notes?: string | null; favorite?: boolean; source?: string };

/** Insere ignorando frases que já existem (mesmo texto). Devolve as que entraram. */
export async function insertCtas(userId: number, createdBy: number, items: CtaWrite[]): Promise<Cta[]> {
  if (!items.length) return [];
  const db = await requireDb();
  return db.insert(ctas).values(items.map((i) => ({
    userId, createdBy,
    text: i.text.trim(),
    category: i.category.trim(),
    angle: i.angle?.trim().toLowerCase() || null,
    notes: i.notes?.trim() || null,
    favorite: i.favorite ?? false,
    source: i.source ?? "manual",
  }))).onConflictDoNothing().returning();
}

export async function updateCta(userId: number, id: number, data: Partial<CtaWrite>): Promise<Cta | undefined> {
  const db = await requireDb();
  const patch: Partial<typeof ctas.$inferInsert> = {};
  if (data.text !== undefined) patch.text = data.text.trim();
  if (data.category !== undefined) patch.category = data.category.trim();
  if (data.angle !== undefined) patch.angle = data.angle?.trim().toLowerCase() || null;
  if (data.notes !== undefined) patch.notes = data.notes?.trim() || null;
  if (data.favorite !== undefined) patch.favorite = data.favorite;
  const [row] = await db.update(ctas).set(patch).where(and(eq(ctas.id, id), eq(ctas.userId, userId))).returning();
  return row;
}

export async function deleteCta(userId: number, id: number): Promise<boolean> {
  const db = await requireDb();
  const rows = await db.delete(ctas).where(and(eq(ctas.id, id), eq(ctas.userId, userId))).returning({ id: ctas.id });
  return rows.length > 0;
}

// ─── Artes feitas a partir de um CTA (tarefas do Agente de Legendas com ctaId) ──

export async function ctaArtThreads(userId: number, ctaId?: number, limit = 60) {
  const db = await requireDb();
  const ctaCond = ctaId
    ? sql`(${agentThreads.taskInput}->>'ctaId')::int = ${ctaId}`
    : sql`${agentThreads.taskInput}->>'ctaId' is not null`;
  return db.select().from(agentThreads)
    .where(and(eq(agentThreads.userId, userId), eq(agentThreads.mode, "task"), eq(agentThreads.agentSlug, "legendas"), ctaCond))
    .orderBy(desc(agentThreads.createdAt)).limit(limit);
}

/** Artes de cada CTA (mais recente primeiro), para mostrar no cartão do banco. */
export async function ctaArtPreviews(userId: number): Promise<Map<number, Array<{ threadId: number; imageUrl: string | null; status: string; format: string }>>> {
  const threads = await ctaArtThreads(userId, undefined, 2000);
  const out = new Map<number, Array<{ threadId: number; imageUrl: string | null; status: string; format: string }>>();
  for (const t of threads) {
    const input = (t.taskInput ?? {}) as { ctaId?: number; format?: string };
    if (!input.ctaId) continue;
    const r = (t.result ?? {}) as { imageUrl?: string };
    out.set(input.ctaId, [...(out.get(input.ctaId) ?? []), { threadId: t.id, imageUrl: r.imageUrl ?? null, status: t.status, format: input.format ?? "feed_4x5" }]);
  }
  return out;
}

/** Quantas artes cada CTA já tem. */
export async function ctaArtCounts(userId: number): Promise<Map<number, number>> {
  const db = await requireDb();
  const rows = await db.select({ id: sql<string>`${agentThreads.taskInput}->>'ctaId'`, n: sql<number>`count(*)::int` })
    .from(agentThreads)
    .where(and(eq(agentThreads.userId, userId), eq(agentThreads.agentSlug, "legendas"), sql`${agentThreads.taskInput}->>'ctaId' is not null`))
    .groupBy(sql`${agentThreads.taskInput}->>'ctaId'`);
  return new Map(rows.map((r) => [Number(r.id), r.n]));
}

// ─── Uso de cada CTA no conteúdo de verdade (pedido de 25/11/2026) ─────────────
// "Usada" = a frase apareceu numa pauta do planejamento, numa arte ligada a uma
// pauta ou num post programado/publicado. As artes feitas na própria aba CTAs
// (a galeria de cada frase) contam à parte, como "artes", e não como uso.
// Conta um uso por dia, para não contar três vezes a pauta, a arte e o post do mesmo dia.

/** Texto comparável: sem acento, minúsculo, só letras, números e %. */
const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
const ddmm = (d: string) => (/^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d);

export type CtaUse = { uses: number; lastUsedAt: string | null; usedIn: string[] };
type Doc = { day: string; label: string; blob: string; ctaId?: number };

export async function ctaUsage(userId: number): Promise<Map<number, CtaUse>> {
  const db = await requireDb();
  const [list, plans, outputs, posts] = await Promise.all([
    db.select({ id: ctas.id, text: ctas.text }).from(ctas).where(eq(ctas.userId, userId)),
    db.select({ id: agentThreads.id, result: agentThreads.result }).from(agentThreads)
      .where(and(eq(agentThreads.userId, userId), eq(agentThreads.agentSlug, "planejamento"), isNotNull(agentThreads.result))),
    db.select({ id: agentThreads.id, result: agentThreads.result, taskInput: agentThreads.taskInput, createdAt: agentThreads.createdAt }).from(agentThreads)
      .where(and(eq(agentThreads.userId, userId), ne(agentThreads.status, "failed"), sql`${agentThreads.taskInput}->'planLink' is not null`)),
    db.select({ id: socialPosts.id, title: socialPosts.title, content: socialPosts.content, status: socialPosts.status, scheduledAt: socialPosts.scheduledAt, publishedAt: socialPosts.publishedAt }).from(socialPosts)
      .where(and(eq(socialPosts.userId, userId), inArray(socialPosts.status, ["scheduled", "published"]))),
  ]);

  const docs: Doc[] = [];
  const itemDay = new Map<string, string>();
  for (const p of plans) {
    const items = ((p.result ?? {}) as { items?: Array<Record<string, unknown>> }).items ?? [];
    items.forEach((it, i) => {
      const day = String(it.date ?? "");
      itemDay.set(`${p.id}:${i}`, day);
      docs.push({ day, label: `pauta de ${ddmm(day)}`, blob: norm([it.title, it.hook, it.angle, it.captionIdea, it.notes].join(" ")) });
    });
  }
  for (const t of outputs) {
    const input = (t.taskInput ?? {}) as { planLink?: { threadId?: number; index?: number }; ctaId?: number; cta?: string };
    const r = (t.result ?? {}) as Record<string, any>;
    const parts = [r.title, r.caption, input.cta, ...(r.slides ?? []).flatMap((s: any) => [s.heading, s.body]), ...(r.frames ?? []).flatMap((f: any) => [f.heading, f.body, f.text])];
    const day = itemDay.get(`${input.planLink?.threadId}:${input.planLink?.index}`) || t.createdAt.toISOString().slice(0, 10);
    docs.push({ day, label: `arte da pauta de ${ddmm(day)}`, blob: norm(parts.join(" ")), ctaId: input.ctaId });
  }
  for (const p of posts) {
    const when = (p.publishedAt ?? p.scheduledAt)?.toISOString().slice(0, 10) ?? "";
    docs.push({ day: when, label: `${p.status === "published" ? "post publicado" : "post programado"} em ${ddmm(when)}`, blob: norm(`${p.title ?? ""} ${p.content}`) });
  }

  const out = new Map<number, CtaUse>();
  for (const c of list) {
    const phrase = norm(c.text);
    const hits = phrase.length >= 10 ? docs.filter((d) => d.ctaId === c.id || d.blob.includes(phrase)) : docs.filter((d) => d.ctaId === c.id);
    const days = [...new Set(hits.map((h) => h.day).filter(Boolean))].sort();
    out.set(c.id, {
      uses: days.length,
      lastUsedAt: days.at(-1) ?? null,
      usedIn: [...new Set(hits.sort((a, b) => b.day.localeCompare(a.day)).map((h) => h.label))].slice(0, 6),
    });
  }
  return out;
}

/**
 * Banco de CTAs para os agentes de criação e de planejamento, com as nunca usadas
 * primeiro (pedido da equipe: dar prioridade às frases que ainda não foram usadas).
 */
export async function ctaPriorityContext(userId: number): Promise<string | null> {
  const db = await requireDb();
  const [rows, usage] = await Promise.all([
    db.select({ id: ctas.id, text: ctas.text, category: ctas.category, angle: ctas.angle, favorite: ctas.favorite, createdAt: ctas.createdAt }).from(ctas).where(eq(ctas.userId, userId)),
    ctaUsage(userId),
  ]);
  if (!rows.length) return null;
  const tag = (r: (typeof rows)[number]) => `[${r.category}${r.angle ? ` · ${r.angle}` : ""}]${r.favorite ? " ★" : ""}`;
  const unused = rows.filter((r) => !usage.get(r.id)?.uses).sort((a, b) => Number(b.favorite) - Number(a.favorite) || +a.createdAt - +b.createdAt);
  const used = rows.filter((r) => usage.get(r.id)?.uses)
    .sort((a, b) => (usage.get(a.id)!.lastUsedAt ?? "").localeCompare(usage.get(b.id)!.lastUsedAt ?? ""));
  return [
    `BANCO DE CTAs DA EQUIPE (${rows.length} frases; ${unused.length} nunca usadas).`,
    `PRIORIDADE: use primeiro as NUNCA USADAS, de cima para baixo, na categoria que combina com o público da pauta ("Parceria Allp Fit" só em pauta de aluno/collab Allp Fit). Use a frase com as mesmas palavras.`,
    unused.length ? `NUNCA USADAS:\n${unused.slice(0, 40).map((r) => `- ${tag(r)} ${r.text}`).join("\n")}` : "NUNCA USADAS: nenhuma (todas já foram usadas).",
    used.length ? `JÁ USADAS (só se nenhuma nunca usada servir; a primeira é a usada há mais tempo):\n${used.slice(0, 15).map((r) => { const u = usage.get(r.id)!; return `- ${tag(r)} ${r.text} (usada ${u.uses}×, última em ${ddmm(u.lastUsedAt ?? "")})`; }).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}
