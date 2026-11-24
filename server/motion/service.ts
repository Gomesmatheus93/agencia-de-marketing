import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { motionVideos, type MotionVideo } from "../../drizzle/schema";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { renderMotion } from "./render";
import { motionDuration, motionSpecSchema, type MotionSpec } from "./spec";

// Fila de renderização dos vídeos motion: um vídeo por vez no processo (o
// render usa CPU), status e progresso gravados no banco para a tela acompanhar.

async function db() {
  const d = await getDb();
  if (!d) throw new Error("Banco de dados indisponível");
  return d;
}

export async function listMotion(userId: number): Promise<MotionVideo[]> {
  return (await db()).select().from(motionVideos).where(eq(motionVideos.userId, userId)).orderBy(desc(motionVideos.createdAt)).limit(200);
}
export async function getMotion(userId: number, id: number): Promise<MotionVideo | undefined> {
  const [row] = await (await db()).select().from(motionVideos).where(and(eq(motionVideos.id, id), eq(motionVideos.userId, userId))).limit(1);
  return row;
}

export type NewMotion = { title: string; spec: MotionSpec; origin?: string; ctaId?: number | null; caption?: string | null; createdBy?: number | null };
export async function createMotion(userId: number, m: NewMotion): Promise<MotionVideo> {
  const [row] = await (await db()).insert(motionVideos).values({
    userId, title: m.title.slice(0, 160), spec: m.spec as unknown as Record<string, unknown>, origin: m.origin ?? "modelo",
    ctaId: m.ctaId ?? null, caption: m.caption ?? null, createdBy: m.createdBy ?? null, seconds: Math.round(motionDuration(m.spec)),
  }).returning();
  enqueueRender(row.id);
  return row;
}
export async function updateMotion(userId: number, id: number, patch: { title?: string; spec?: MotionSpec; caption?: string | null }) {
  const set: Partial<typeof motionVideos.$inferInsert> = {};
  if (patch.title !== undefined) set.title = patch.title.slice(0, 160);
  if (patch.caption !== undefined) set.caption = patch.caption;
  if (patch.spec) { set.spec = patch.spec as unknown as Record<string, unknown>; set.status = "na_fila"; set.progress = 0; set.error = null; set.seconds = Math.round(motionDuration(patch.spec)); }
  const [row] = await (await db()).update(motionVideos).set(set).where(and(eq(motionVideos.id, id), eq(motionVideos.userId, userId))).returning();
  if (row && patch.spec) enqueueRender(row.id);
  return row;
}
export async function rerenderMotion(userId: number, id: number) {
  const [row] = await (await db()).update(motionVideos).set({ status: "na_fila", progress: 0, error: null }).where(and(eq(motionVideos.id, id), eq(motionVideos.userId, userId))).returning();
  if (row) enqueueRender(row.id);
  return row;
}
export async function deleteMotion(userId: number, id: number) {
  const rows = await (await db()).delete(motionVideos).where(and(eq(motionVideos.id, id), eq(motionVideos.userId, userId))).returning({ id: motionVideos.id });
  return rows.length > 0;
}

/** Ao subir o servidor: o que estava na fila ou renderizando volta para a fila. */
export async function resumeMotionQueue() {
  const rows = await (await db()).select({ id: motionVideos.id }).from(motionVideos).where(inArray(motionVideos.status, ["na_fila", "renderizando"]));
  for (const r of rows) enqueueRender(r.id);
}

const queue: number[] = [];
let running = false;
export function enqueueRender(id: number) {
  if (!queue.includes(id)) queue.push(id);
  void drain();
}
async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const id = queue.shift()!;
      await renderOne(id).catch((e) => console.warn("[motion] falha ao renderizar", id, String(e).slice(0, 300)));
    }
  } finally {
    running = false;
  }
}

async function renderOne(id: number) {
  const d = await db();
  const [row] = await d.select().from(motionVideos).where(eq(motionVideos.id, id)).limit(1);
  if (!row || row.status === "pronto") return;
  const parsed = motionSpecSchema.safeParse(row.spec);
  if (!parsed.success) {
    await d.update(motionVideos).set({ status: "falhou", error: `Roteiro inválido: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}` }).where(eq(motionVideos.id, id));
    return;
  }
  await d.update(motionVideos).set({ status: "renderizando", progress: 0, error: null }).where(eq(motionVideos.id, id));
  let last = 0;
  try {
    const r = await renderMotion(parsed.data, (p) => {
      const pct = Math.round(p * 100);
      if (pct - last >= 10) { last = pct; void d.update(motionVideos).set({ progress: pct }).where(eq(motionVideos.id, id)); }
    });
    const key = `motion/${row.userId}/${randomUUID()}`;
    const video = await storagePut(`${key}.mp4`, r.mp4, "video/mp4");
    const poster = await storagePut(`${key}.png`, r.poster, "image/png");
    await d.update(motionVideos).set({ status: "pronto", progress: 100, videoUrl: video.url, posterUrl: poster.url, seconds: Math.round(r.seconds) }).where(eq(motionVideos.id, id));
    console.log(`[motion] ${id} pronto: ${r.frames} quadros em ${(r.ms / 1000).toFixed(1)}s`);
  } catch (e) {
    await d.update(motionVideos).set({ status: "falhou", error: String((e as Error).message ?? e).slice(0, 1000) }).where(eq(motionVideos.id, id));
  }
}
