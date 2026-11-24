import { and, asc, desc, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { agentThreads, ctas, type Cta } from "../drizzle/schema";
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
