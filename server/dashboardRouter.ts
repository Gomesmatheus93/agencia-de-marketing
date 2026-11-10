import { and, eq, gte, lt, or } from "drizzle-orm";
import { z } from "zod";
import { socialPosts } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import * as store from "./agents/store";
import * as db from "./db";

// Visão do mês para o Dashboard: pautas do plano (com a arte criada) e postagens.

type PlanItem = { date: string; time?: string; type?: string; title: string; format?: string; collab?: string | null };

export const dashboardRouter = router({
  month: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const [year, mon] = input.month.split("-").map(Number);
      // Limites do mês em horário de Brasília (UTC-3).
      const start = new Date(Date.UTC(year, mon - 1, 1, 3));
      const end = new Date(Date.UTC(year, mon, 1, 3));

      // Plano: o mais recente que tenha pautas neste mês.
      const plans = await store.listThreads(ctx.user.id, "planejamento", "task");
      const plan = plans.find((t) => ((t.result as { items?: PlanItem[] } | null)?.items ?? []).some((i) => i.date?.startsWith(input.month)));
      let items: Array<PlanItem & { index: number; output: { threadId: number; agentSlug: string; images: string[]; total: number; videoUrl: string | null } | null }> = [];
      if (plan) {
        const outputs = new Map<number, (typeof items)[number]["output"]>();
        for (const t of await store.listPlanOutputs(ctx.user.id, plan.id)) {
          const index = Number((t.taskInput as { planLink?: { index?: number } } | null)?.planLink?.index);
          const r = (t.result ?? {}) as Record<string, any>;
          const arts: string[] = (r.slides?.map((s: any) => s.imageUrl) ?? r.frames?.map((f: any) => f.imageUrl) ?? (r.imageUrl ? [r.imageUrl] : [])).filter(Boolean);
          const video = r.videos?.[0];
          if (!Number.isInteger(index) || (!arts.length && !video)) continue;
          outputs.set(index, { threadId: t.id, agentSlug: t.agentSlug, images: arts.slice(0, 1), total: arts.length, videoUrl: video ? (video.editedUrl ?? video.url ?? null) : null });
        }
        items = ((plan.result as { items: PlanItem[] }).items)
          .map((it, index) => ({ date: it.date, time: it.time, type: it.type, title: it.title, format: it.format, collab: it.collab ?? null, index, output: outputs.get(index) ?? null }))
          .filter((it) => it.date?.startsWith(input.month))
          .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
      }

      // Postagens do mês (agendadas ou publicadas dentro do mês).
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
        plan: plan ? { threadId: plan.id, periodLabel: (plan.result as { periodLabel?: string }).periodLabel ?? plan.title } : null,
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
