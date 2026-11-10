import { and, eq, gte, lt, or } from "drizzle-orm";
import { z } from "zod";
import { socialPosts } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import * as store from "./agents/store";
import * as db from "./db";

// Visão do período (semana ou mês) para o Dashboard: pautas dos planos (com a arte criada) e postagens.

type PlanItem = { date: string; time?: string; type?: string; title: string; format?: string; collab?: string | null };
type Output = { threadId: number; agentSlug: string; images: string[]; total: number; videoUrl: string | null };
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Meia-noite de Brasília (UTC-3) do dia informado. */
function brMidnight(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3));
}

export const dashboardRouter = router({
  period: protectedProcedure
    .input(z.object({ start: day, end: day })) // end incluso
    .query(async ({ ctx, input }) => {
      const inRange = (date?: string) => Boolean(date) && date! >= input.start && date! <= input.end;

      // Pautas: dos planos mais novos para os mais antigos; um dia já coberto por um plano mais novo
      // não pega pautas de um plano mais antigo (a semana pode cruzar dois planos/meses).
      const plans = await store.listThreads(ctx.user.id, "planejamento", "task");
      const covered = new Set<string>();
      const items: Array<PlanItem & { planThreadId: number; index: number; output: Output | null }> = [];
      for (const plan of plans) {
        const planItems = ((plan.result as { items?: PlanItem[] } | null)?.items ?? []);
        const fresh = planItems.map((it, index) => ({ it, index })).filter(({ it }) => inRange(it.date) && !covered.has(it.date));
        if (!fresh.length) continue;
        const outputs = new Map<number, Output>();
        for (const t of await store.listPlanOutputs(ctx.user.id, plan.id)) {
          const index = Number((t.taskInput as { planLink?: { index?: number } } | null)?.planLink?.index);
          const r = (t.result ?? {}) as Record<string, any>;
          const arts: string[] = (r.slides?.map((s: any) => s.imageUrl) ?? r.frames?.map((f: any) => f.imageUrl) ?? (r.imageUrl ? [r.imageUrl] : [])).filter(Boolean);
          const video = r.videos?.[0];
          if (!Number.isInteger(index) || (!arts.length && !video)) continue;
          outputs.set(index, { threadId: t.id, agentSlug: t.agentSlug, images: arts.slice(0, 1), total: arts.length, videoUrl: video ? (video.editedUrl ?? video.url ?? null) : null });
        }
        const dates = new Set<string>();
        for (const { it, index } of fresh) {
          dates.add(it.date);
          items.push({ date: it.date, time: it.time, type: it.type, title: it.title, format: it.format, collab: it.collab ?? null, planThreadId: plan.id, index, output: outputs.get(index) ?? null });
        }
        dates.forEach((d) => covered.add(d));
      }
      items.sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));

      // Postagens do período (agendadas ou publicadas dentro dele).
      const start = brMidnight(input.start);
      const end = new Date(brMidnight(input.end).getTime() + 86_400_000);
      const conn = await db.getDb();
      const posts = conn ? await conn.select({ status: socialPosts.status, scheduledAt: socialPosts.scheduledAt, publishedAt: socialPosts.publishedAt, title: socialPosts.title })
        .from(socialPosts)
        .where(and(eq(socialPosts.userId, ctx.user.id), or(
          and(gte(socialPosts.scheduledAt, start), lt(socialPosts.scheduledAt, end)),
          and(gte(socialPosts.publishedAt, start), lt(socialPosts.publishedAt, end)),
        ))) : [];
      const now = Date.now();
      const next = posts.filter((p) => p.status === "scheduled" && p.scheduledAt && +p.scheduledAt > now)
        .sort((a, b) => +a.scheduledAt! - +b.scheduledAt!)[0];

      return {
        items,
        posts: {
          published: posts.filter((p) => p.status === "published").length,
          scheduled: posts.filter((p) => p.status === "scheduled").length,
          failed: posts.filter((p) => p.status === "failed").length,
          next: next ? { title: next.title, scheduledAt: next.scheduledAt } : null,
        },
      };
    }),
});
