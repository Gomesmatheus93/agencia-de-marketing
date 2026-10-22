import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { AGENTS, getAgent } from "./registry";
import { sendUserMessage } from "./runtime";
import { TASKS, planItemSchema, type PlanResult } from "./tasks";
import * as store from "./store";

const filePath = z.string().regex(/^[a-z0-9][a-z0-9_\-./]{0,99}\.(md|txt|tsv|json)$/i).refine((p) => !p.includes(".."));

async function ownThread(userId: number, threadId: number) {
  const thread = await store.getThread(userId, threadId);
  if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada" });
  return thread;
}

export const agentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const connection = await db.getInstagramConnection(ctx.user.id);
    return {
      agents: AGENTS.map(({ slug, name, role, description, skill, starters }) => ({ slug, name, role, description, skill, starters })),
      instagram: connection ? { connected: true, username: connection.username ?? null } : { connected: false, username: null },
    };
  }),

  office: protectedProcedure.query(({ ctx }) => store.officeSnapshot(ctx.user.id, AGENTS.map((a) => a.slug))),

  // ─── Tarefas de tela (auditoria, planejamento…) ─────────────────────────────

  startTask: protectedProcedure
    .input(z.object({ agentSlug: z.string(), input: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const task = TASKS[input.agentSlug];
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Este agente não tem tarefa de tela." });
      const parsed = task.input.safeParse(input.input);
      if (!parsed.success) throw new TRPCError({ code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Dados inválidos" });
      const thread = await store.createThread(ctx.user.id, task.agentSlug, task.title(parsed.data), { input: parsed.data as Record<string, unknown> });
      const context = task.context ? await task.context(ctx.user.id) : null;
      const brief = task.brief(parsed.data) + (context ? `\n\nDADOS DA CONTA:\n${context}` : "");
      await sendUserMessage(ctx.user.id, thread.id, brief);
      return { threadId: thread.id };
    }),

  /** Última rodada de cada tarefa de tela, resumida para a tela inicial. */
  recent: protectedProcedure.query(async ({ ctx }) => {
    const out: Record<string, { threadId: number; title: string; status: string; createdAt: Date; summary: string | null; images: string[] } | null> = {};
    await Promise.all(Object.keys(TASKS).map(async (slug) => {
      const [thread] = await store.listThreads(ctx.user.id, slug, "task");
      if (!thread) { out[slug] = null; return; }
      const r = (thread.result ?? {}) as Record<string, any>;
      let summary: string | null = null;
      let images: string[] = [];
      if (slug === "planejamento" && r.items) summary = `${r.periodLabel} · ${r.items.length} pautas · ${(r.calendarSent ?? []).length} no calendário`;
      if (slug === "auditoria" && r.summary) summary = r.summary;
      if (slug === "carrossel" && r.slides) { images = r.slides.slice(0, 4).map((x: any) => x.imageUrl); summary = `${r.slides.length} slides`; }
      if (slug === "stories" && r.frames) { images = r.frames.slice(0, 4).map((x: any) => x.imageUrl); summary = `${r.frames.length} quadros`; }
      if (slug === "legendas" && r.imageUrl) { images = [r.imageUrl]; summary = r.title ?? null; }
      if (slug === "marca" && r.summary) summary = r.overallScore != null ? `Nota ${Math.round(r.overallScore)}/100 · ${r.summary}` : r.summary;
      out[slug] = { threadId: thread.id, title: thread.title, status: thread.status, createdAt: thread.createdAt, summary, images };
    }));
    return out;
  }),

  tasks: protectedProcedure
    .input(z.object({ agentSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const threads = await store.listThreads(ctx.user.id, input.agentSlug, "task");
      return threads.map((t) => ({ id: t.id, title: t.title, status: t.status, hasResult: Boolean(t.result), createdAt: t.createdAt }));
    }),

  task: protectedProcedure
    .input(z.object({ threadId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      return { thread, activity: await store.activityOf(thread) };
    }),

  planToCalendar: protectedProcedure
    .input(z.object({ threadId: z.number().int(), indexes: z.array(z.number().int().min(0)).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      const plan = thread.result as (PlanResult & { calendarSent?: number[] }) | null;
      if (thread.agentSlug !== "planejamento" || !plan) throw new TRPCError({ code: "BAD_REQUEST", message: "Plano não encontrado." });
      const sent = new Set(plan.calendarSent ?? []);
      const pick = input.indexes.filter((i) => plan.items[i] && !sent.has(i));
      const FORMAT_LABEL = { reel: "Reel", carrossel: "Carrossel", imagem: "Post (imagem)", stories: "Stories" } as const;
      await db.addEditorialPlanItems(ctx.user.id, pick.map((i) => {
        const item = plan.items[i];
        return {
          scheduledDate: item.date,
          format: item.format === "carrossel" ? "carousel" : "instagram",
          category: item.type.slice(0, 255),
          suggestedTitle: item.title.slice(0, 512),
          pauta: [
            `${FORMAT_LABEL[item.format]} · ${item.time}${item.collab ? ` · collab com ${item.collab}` : ""}`,
            `Ângulo: ${item.angle}`,
            `Gancho: ${item.hook}`,
            `Legenda: ${item.captionIdea}`,
            item.notes ? `Obs.: ${item.notes}` : "",
          ].filter(Boolean).join("\n"),
        };
      }));
      pick.forEach((i) => sent.add(i));
      await store.setThreadResult(thread.id, { ...plan, calendarSent: [...sent] });
      return { added: pick.length };
    }),

  /** Edição manual de uma pauta do plano (mover de dia, mudar o conteúdo). */
  updatePlanItem: protectedProcedure
    .input(z.object({ threadId: z.number().int(), index: z.number().int().min(0), item: planItemSchema }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      const plan = thread.result as PlanResult | null;
      if (thread.agentSlug !== "planejamento" || !plan?.items[input.index]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pauta não encontrada." });
      }
      const items = plan.items.map((it, i) => (i === input.index ? input.item : it));
      await store.setThreadResult(thread.id, { ...plan, items });
      return { ok: true };
    }),

  threads: protectedProcedure
    .input(z.object({ agentSlug: z.string() }))
    .query(({ ctx, input }) => store.listThreads(ctx.user.id, input.agentSlug)),

  thread: protectedProcedure
    .input(z.object({ threadId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      const messages = await store.listMessages(thread.id);
      return { thread, messages };
    }),

  start: protectedProcedure
    .input(z.object({ agentSlug: z.string(), message: z.string().trim().min(1).max(50_000) }))
    .mutation(async ({ ctx, input }) => {
      if (!getAgent(input.agentSlug)) throw new TRPCError({ code: "NOT_FOUND", message: "Agente não encontrado" });
      const thread = await store.createThread(ctx.user.id, input.agentSlug, input.message.split("\n")[0].slice(0, 80));
      await sendUserMessage(ctx.user.id, thread.id, input.message);
      return { threadId: thread.id };
    }),

  send: protectedProcedure
    .input(z.object({ threadId: z.number().int(), message: z.string().trim().min(1).max(50_000) }))
    .mutation(async ({ ctx, input }) => {
      await ownThread(ctx.user.id, input.threadId);
      try {
        await sendUserMessage(ctx.user.id, input.threadId, input.message);
      } catch (e) {
        throw new TRPCError({ code: "CONFLICT", message: (e as Error).message });
      }
      return { ok: true };
    }),

  setApproval: protectedProcedure
    .input(z.object({ messageId: z.number().int(), approval: z.enum(["approved", "rejected", "pending"]) }))
    .mutation(async ({ ctx, input }) => {
      await store.setApproval(ctx.user.id, input.messageId, input.approval);
      return { ok: true };
    }),

  deleteThread: protectedProcedure
    .input(z.object({ threadId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await store.deleteThread(ctx.user.id, input.threadId);
      return { ok: true };
    }),

  files: protectedProcedure.query(({ ctx }) => store.listFiles(ctx.user.id)),

  file: protectedProcedure
    .input(z.object({ path: filePath }))
    .query(async ({ ctx, input }) => ({ path: input.path, content: await store.readFile(ctx.user.id, input.path) })),

  saveFile: protectedProcedure
    .input(z.object({ path: filePath, content: z.string().max(200_000) }))
    .mutation(async ({ ctx, input }) => {
      await store.writeFile(ctx.user.id, input.path, input.content);
      return { ok: true };
    }),

  deleteFile: protectedProcedure
    .input(z.object({ path: filePath }))
    .mutation(async ({ ctx, input }) => {
      await store.deleteFile(ctx.user.id, input.path);
      return { ok: true };
    }),
});
