import { and, desc, eq, gte, ilike, inArray, lt, type SQL } from "drizzle-orm";
import { z } from "zod";
import { agentThreads, motionVideos } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

// Aba Histórico: todas as artes criadas na conta (carrosséis, posts, stories e
// vídeos motion), da mais nova para a mais antiga, com filtro por tipo, mês e busca.

const ART_AGENTS = { carrossel: "Carrossel", legendas: "Post", stories: "Stories" } as const;
type Kind = "todos" | "carrossel" | "post" | "stories" | "video";

export type HistoryEntry = {
  key: string;
  kind: "carrossel" | "post" | "stories" | "video";
  title: string;
  createdAt: Date;
  updatedAt: Date;
  images: string[];
  total: number;
  threadId: number | null;
  motionId: number | null;
  videoUrl: string | null;
  posterUrl: string | null;
  format: string | null;
  fromCta: boolean;
  planDate: string | null;
};

function monthRange(month: string | undefined) {
  if (!month) return null;
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1, 3)), end: new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1, 3)) };
}

export const historyRouter = router({
  list: protectedProcedure
    .input(z.object({
      kind: z.enum(["todos", "carrossel", "post", "stories", "video"]).default("todos"),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      search: z.string().trim().max(100).optional(),
      limit: z.number().int().min(1).max(120).default(48),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { entries: [] as HistoryEntry[], hasMore: false };
      const range = monthRange(input.month);
      const like = input.search ? `%${input.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%` : null;
      const want = input.kind as Kind;
      // Busca um pouco a mais das duas fontes e intercala por data (a paginação é por posição).
      const take = input.offset + input.limit + 1;

      const entries: HistoryEntry[] = [];
      if (want !== "video") {
        const slugs = want === "todos" ? Object.keys(ART_AGENTS) : [want === "post" ? "legendas" : want];
        const where: SQL[] = [eq(agentThreads.userId, ctx.user.id), eq(agentThreads.mode, "task"), inArray(agentThreads.agentSlug, slugs)];
        if (range) where.push(gte(agentThreads.createdAt, range.start), lt(agentThreads.createdAt, range.end));
        if (like) where.push(ilike(agentThreads.title, like));
        const rows = await db.select().from(agentThreads).where(and(...where)).orderBy(desc(agentThreads.createdAt)).limit(take * 2);
        for (const t of rows) {
          const r = (t.result ?? {}) as Record<string, any>;
          const arts: string[] = (r.slides?.map((s: any) => s.imageUrl) ?? r.frames?.map((f: any) => f.imageUrl) ?? (r.imageUrl ? [r.imageUrl] : [])).filter(Boolean);
          if (!arts.length) continue; // tarefa que falhou ou ainda não terminou
          const input = (t.taskInput ?? {}) as { ctaId?: number; format?: string; planLink?: { index?: number } };
          entries.push({
            key: `t${t.id}`, kind: t.agentSlug === "legendas" ? "post" : (t.agentSlug as "carrossel" | "stories"),
            title: String(r.title ?? t.title).replace(/^(Post|Carrossel|Stories): /, ""), createdAt: t.createdAt, updatedAt: t.updatedAt,
            images: arts.slice(0, 4), total: arts.length, threadId: t.id, motionId: null, videoUrl: null, posterUrl: null,
            format: input.format ?? (t.agentSlug === "stories" ? "story_9x16" : "feed_4x5"), fromCta: Boolean(input.ctaId), planDate: null,
          });
        }
      }
      if (want === "todos" || want === "video") {
        const where: SQL[] = [eq(motionVideos.userId, ctx.user.id), eq(motionVideos.status, "pronto")];
        if (range) where.push(gte(motionVideos.createdAt, range.start), lt(motionVideos.createdAt, range.end));
        if (like) where.push(ilike(motionVideos.title, like));
        const rows = await db.select().from(motionVideos).where(and(...where)).orderBy(desc(motionVideos.createdAt)).limit(take);
        for (const m of rows) {
          entries.push({
            key: `m${m.id}`, kind: "video", title: m.title, createdAt: m.createdAt, updatedAt: m.updatedAt,
            images: m.posterUrl ? [m.posterUrl] : [], total: 1, threadId: null, motionId: m.id, videoUrl: m.videoUrl, posterUrl: m.posterUrl,
            format: String((m.spec as { format?: string })?.format ?? "story_9x16"), fromCta: Boolean(m.ctaId), planDate: null,
          });
        }
      }
      entries.sort((a, b) => +b.createdAt - +a.createdAt);
      const page = entries.slice(input.offset, input.offset + input.limit);
      return { entries: page, hasMore: entries.length > input.offset + input.limit };
    }),

  /** Quantas artes existem por tipo (para os filtros). */
  counts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { carrossel: 0, post: 0, stories: 0, video: 0 };
    const rows = await db.select({ slug: agentThreads.agentSlug, result: agentThreads.result }).from(agentThreads)
      .where(and(eq(agentThreads.userId, ctx.user.id), eq(agentThreads.mode, "task"), inArray(agentThreads.agentSlug, Object.keys(ART_AGENTS))));
    const has = (r: any) => Boolean(r?.slides?.length || r?.frames?.length || r?.imageUrl);
    const n = (slug: string) => rows.filter((x) => x.slug === slug && has(x.result)).length;
    const videos = await db.select({ id: motionVideos.id }).from(motionVideos).where(and(eq(motionVideos.userId, ctx.user.id), eq(motionVideos.status, "pronto")));
    return { carrossel: n("carrossel"), post: n("legendas"), stories: n("stories"), video: videos.length };
  }),
});
