import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DESIGN_MODEL_IDS } from "../shared/designModels";
import { protectedProcedure, router } from "./_core/trpc";
import { sendUserMessage } from "./agents/runtime";
import * as store from "./agents/store";
import { postTask, type CtaResult } from "./agents/tasks";
import * as bank from "./ctaBank";

// Aba CTAs: banco de frases, Agente de CTAs (tarefa "ctas", disparada por
// agents.startTask) e criação de artes a partir de uma frase (tarefa do Agente
// de Legendas com ctaId no input, para listar as artes de cada CTA).

const text = z.string().trim().min(3, "Escreva a frase").max(300, "Até 300 caracteres");
const category = z.string().trim().min(2, "Escolha a categoria").max(60);
const angle = z.string().trim().max(60).nullish();
const notes = z.string().trim().max(2000).nullish();

type Art = { threadId: number; ctaId: number | null; status: string; title: string; imageUrl: string | null; caption: string | null; format: string; createdAt: Date; variationOf: number | null; error: string | null };

function toArt(t: Awaited<ReturnType<typeof bank.ctaArtThreads>>[number]): Art {
  const input = (t.taskInput ?? {}) as { ctaId?: number; format?: string; variationOf?: number };
  const r = (t.result ?? {}) as { imageUrl?: string; caption?: string; title?: string };
  return {
    threadId: t.id, ctaId: input.ctaId ?? null, status: t.status, title: r.title ?? t.title,
    imageUrl: r.imageUrl ?? null, caption: r.caption ?? null, format: input.format ?? "feed_4x5",
    createdAt: t.createdAt, variationOf: input.variationOf ?? null, error: t.status === "failed" ? t.lastError ?? null : null,
  };
}

export const ctaRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().trim().max(100).optional(),
      category: z.string().max(60).optional(),
      angle: z.string().max(60).optional(),
      source: z.enum(["manual", "ia", "equipe"]).optional(),
      favorite: z.boolean().optional(),
      // Uso no conteúdo (pautas, artes das pautas e posts): "nao-usadas" ou "usadas".
      usage: z.enum(["nao-usadas", "usadas"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const [rows, previews, usage] = await Promise.all([bank.listCtas(ctx.user.id, input ?? {}), bank.ctaArtPreviews(ctx.user.id), bank.ctaUsage(ctx.user.id)]);
      return rows
        .map((r) => {
          const arts = previews.get(r.id) ?? [];
          const u = usage.get(r.id) ?? { uses: 0, lastUsedAt: null, usedIn: [] };
          return { ...r, arts: arts.length, artPreviews: arts.slice(0, 4), uses: u.uses, lastUsedAt: u.lastUsedAt, usedIn: u.usedIn };
        })
        .filter((r) => (input?.usage === "nao-usadas" ? r.uses === 0 : input?.usage === "usadas" ? r.uses > 0 : true));
    }),

  facets: protectedProcedure.query(({ ctx }) => bank.ctaFacets(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ text, category, angle, notes, favorite: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await bank.insertCtas(ctx.user.id, ctx.actualUser.id, [{ ...input, source: "manual" }]);
      if (!row) throw new TRPCError({ code: "CONFLICT", message: "Essa frase já está no banco." });
      return row;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), text: text.optional(), category: category.optional(), angle, notes, favorite: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        const row = await bank.updateCta(ctx.user.id, id, data);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "CTA não encontrado." });
        return row;
      } catch (e) {
        if (String((e as { code?: string }).code ?? e).includes("23505")) throw new TRPCError({ code: "CONFLICT", message: "Já existe outra frase igual no banco." });
        throw e;
      }
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await bank.deleteCta(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND", message: "CTA não encontrado." });
      return { ok: true };
    }),

  /** Salva no banco as sugestões escolhidas de uma rodada do Agente de CTAs. */
  addSuggestions: protectedProcedure
    .input(z.object({
      threadId: z.number().int(),
      items: z.array(z.object({ text, category, angle, notes })).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const thread = await store.getThread(ctx.user.id, input.threadId);
      if (!thread || thread.agentSlug !== "ctas") throw new TRPCError({ code: "NOT_FOUND", message: "Rodada do agente não encontrada." });
      const added = await bank.insertCtas(ctx.user.id, ctx.actualUser.id, input.items.map((i) => ({ ...i, source: "ia" })));
      return { added: added.length, skipped: input.items.length - added.length, rows: added };
    }),

  /** Artes de um CTA (ou de todos, as mais recentes). */
  arts: protectedProcedure
    .input(z.object({ ctaId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => (await bank.ctaArtThreads(ctx.user.id, input.ctaId)).map(toArt)),

  /** Cria uma arte (ou uma variação) a partir de um CTA do banco, com o Agente de Legendas. */
  createArt: protectedProcedure
    .input(z.object({
      ctaId: z.number().int().positive(),
      format: z.enum(["feed_4x5", "feed_1x1", "story_9x16"]).default("feed_4x5"),
      model: z.enum(DESIGN_MODEL_IDS as [string, ...string[]]).optional(),
      notes: z.string().trim().max(3000).optional(),
      variationOf: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cta = await bank.getCta(ctx.user.id, input.ctaId);
      if (!cta) throw new TRPCError({ code: "NOT_FOUND", message: "CTA não encontrado." });
      let notesText = input.notes;
      if (input.variationOf) {
        const base = await store.getThread(ctx.user.id, input.variationOf);
        const baseInput = (base?.taskInput ?? {}) as { ctaId?: number; model?: string };
        if (!base || baseInput.ctaId !== cta.id) throw new TRPCError({ code: "BAD_REQUEST", message: "A arte de origem não é deste CTA." });
        if (baseInput.model && !input.model) notesText = [notesText, `A arte de origem usou o modelo ${baseInput.model}: use outro.`].filter(Boolean).join("\n");
      }
      const parsed = postTask.input.parse({
        topic: `Arte de CTA (${cta.category}${cta.angle ? `, ângulo ${cta.angle}` : ""}): ${cta.text}`,
        format: input.format, model: input.model, notes: [cta.notes ? `Observação do CTA: ${cta.notes}` : null, notesText].filter(Boolean).join("\n") || undefined,
        ctaId: cta.id, cta: cta.text, variationOf: input.variationOf,
      });
      const thread = await store.createThread(ctx.user.id, postTask.agentSlug, input.variationOf ? `Variação: ${cta.text.slice(0, 50)}` : postTask.title(parsed), { input: parsed as Record<string, unknown> });
      await sendUserMessage(ctx.user.id, thread.id, postTask.brief(parsed));
      return { threadId: thread.id };
    }),
});

export type { CtaResult };
