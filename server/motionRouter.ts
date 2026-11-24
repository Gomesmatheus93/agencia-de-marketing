import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MUSIC_LIBRARY } from "../shared/musicLibrary";
import { protectedProcedure, router } from "./_core/trpc";
import { getCta } from "./ctaBank";
import * as motion from "./motion/service";
import { MOTION_EASES, MOTION_FORMATS, MOTION_LOOPS, MOTION_PRESETS, motionSpecSchema } from "./motion/spec";
import { ANE_PHOTOS, buildTemplate, MOTION_TEMPLATES, type MotionTemplate } from "./motion/templates";
import { renderMotionFrame } from "./motion/render";

// Aba Motion: vídeos animados a partir de um roteiro (modelos prontos ou roteiros
// escritos pelo Claude), renderizados no servidor (resvg + ffmpeg).

const parseSpec = (raw: unknown) => {
  const value = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "O roteiro não é um JSON válido." }); } })() : raw;
  const r = motionSpecSchema.safeParse(value);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new TRPCError({ code: "BAD_REQUEST", message: `Roteiro inválido${i?.path.length ? ` em ${i.path.join(".")}` : ""}: ${i?.message}` });
  }
  return r.data;
};

export const motionRouter = router({
  options: protectedProcedure.query(() => ({
    templates: Object.entries(MOTION_TEMPLATES).map(([id, label]) => ({ id, label })),
    formats: Object.entries(MOTION_FORMATS).map(([id, f]) => ({ id, label: f.label, width: f.width, height: f.height })),
    photos: Object.entries(ANE_PHOTOS).map(([id, p]) => ({ id, w: p.w, h: p.h, rightOnly: Boolean(p.rightOnly) })),
    presets: MOTION_PRESETS, loops: MOTION_LOOPS, eases: MOTION_EASES,
    music: MUSIC_LIBRARY.map((m) => ({ id: m.id, label: `${m.title} · ${m.mood}` })),
  })),

  list: protectedProcedure.query(async ({ ctx }) => (await motion.listMotion(ctx.user.id)).map(({ spec, ...v }) => ({ ...v, format: String((spec as { format?: string })?.format ?? "story_9x16") }))),

  get: protectedProcedure.input(z.object({ id: z.number().int() })).query(async ({ ctx, input }) => {
    const row = await motion.getMotion(ctx.user.id, input.id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Vídeo não encontrado." });
    return row;
  }),

  /** Novo vídeo a partir de um modelo pronto (com uma frase do banco de CTAs, se quiser). */
  fromTemplate: protectedProcedure
    .input(z.object({
      template: z.enum(Object.keys(MOTION_TEMPLATES) as [MotionTemplate, ...MotionTemplate[]]),
      format: z.enum(Object.keys(MOTION_FORMATS) as [keyof typeof MOTION_FORMATS, ...(keyof typeof MOTION_FORMATS)[]]).default("story_9x16"),
      ctaId: z.number().int().positive().optional(),
      photo: z.string().max(40).optional(),
      percent: z.number().int().min(1).max(35).optional(),
      music: z.string().max(40).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cta = input.ctaId ? await getCta(ctx.user.id, input.ctaId) : undefined;
      if (input.ctaId && !cta) throw new TRPCError({ code: "NOT_FOUND", message: "CTA não encontrado." });
      const spec = parseSpec(buildTemplate(input.template, { format: input.format, text: cta?.text, photo: input.photo, percent: input.percent, music: input.music }));
      const title = input.template === "cta" ? `CTA: ${cta?.text ?? "Seu benefício está a um toque."}` : input.template === "contador" ? `Contador: até ${input.percent ?? 15}%` : "Passo a passo da parceria";
      return motion.createMotion(ctx.user.id, { title, spec, origin: input.template, ctaId: cta?.id ?? null, createdBy: ctx.actualUser.id });
    }),

  /** Novo vídeo a partir de um roteiro JSON (escrito pelo Claude ou colado na tela). */
  create: protectedProcedure
    .input(z.object({ title: z.string().trim().min(2).max(160), spec: z.unknown(), caption: z.string().max(3000).optional() }))
    .mutation(async ({ ctx, input }) => motion.createMotion(ctx.user.id, { title: input.title, spec: parseSpec(input.spec), origin: "claude", caption: input.caption ?? null, createdBy: ctx.actualUser.id })),

  /** Salva o roteiro editado (e renderiza de novo) e/ou o título e a legenda. */
  update: protectedProcedure
    .input(z.object({ id: z.number().int(), title: z.string().trim().min(2).max(160).optional(), spec: z.unknown().optional(), caption: z.string().max(3000).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const row = await motion.updateMotion(ctx.user.id, input.id, { title: input.title, caption: input.caption, spec: input.spec !== undefined ? parseSpec(input.spec) : undefined });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Vídeo não encontrado." });
      return row;
    }),

  rerender: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    if (!(await motion.rerenderMotion(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND", message: "Vídeo não encontrado." });
    return { ok: true };
  }),

  duplicate: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    const row = await motion.getMotion(ctx.user.id, input.id);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Vídeo não encontrado." });
    return motion.createMotion(ctx.user.id, { title: `${row.title} (cópia)`, spec: parseSpec(row.spec), origin: row.origin, ctaId: row.ctaId, caption: row.caption, createdBy: ctx.actualUser.id });
  }),

  remove: protectedProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ ctx, input }) => {
    if (!(await motion.deleteMotion(ctx.user.id, input.id))) throw new TRPCError({ code: "NOT_FOUND", message: "Vídeo não encontrado." });
    return { ok: true };
  }),

  /** Um quadro do roteiro (PNG em data URI), para conferir antes de renderizar o vídeo todo. */
  previewFrame: protectedProcedure
    .input(z.object({ spec: z.unknown(), t: z.number().min(0).max(60) }))
    .mutation(async ({ input }) => {
      const spec = parseSpec(input.spec);
      const png = await renderMotionFrame(spec, input.t);
      return { dataUrl: `data:image/png;base64,${png.toString("base64")}` };
    }),
});
