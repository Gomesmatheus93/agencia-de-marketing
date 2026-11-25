import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MUSIC_LIBRARY } from "../shared/musicLibrary";
import { protectedProcedure, router } from "./_core/trpc";
import { getCta } from "./ctaBank";
import * as motion from "./motion/service";
import { MOTION_EASES, MOTION_FORMATS, MOTION_LOOPS, MOTION_PRESETS, motionSpecSchema } from "./motion/spec";
import { ANE_PHOTOS, buildTemplate, MOTION_TEMPLATES, type MotionTemplate } from "./motion/templates";
import { renderMotionFrame } from "./motion/render";
import { and, desc, eq, like } from "drizzle-orm";
import { socialPosts } from "../drizzle/schema";
import * as db from "./db";
import { collaboratorsSchema } from "./_core/instagramCollaborators";
import { publishInstagramSocialPost } from "./_core/instagramSocialPostPublisher";

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
    music: MUSIC_LIBRARY.map((m) => ({ id: m.id, label: `${m.title} · ${m.mood}`, url: m.url })),
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

  /**
   * Publica (ou programa) o vídeo no Instagram: feed (sai como Reels, com legenda) e/ou story.
   * Cada destino vira uma postagem própria e segue o fluxo dela; as programadas saem pelo
   * agendador dos posts (instagramPostScheduler), com novas tentativas em caso de falha.
   */
  publish: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      feed: z.boolean(),
      story: z.boolean(),
      caption: z.string().trim().max(2200).optional(),
      when: z.string().datetime().nullable(),
      collaborators: collaboratorsSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.feed && !input.story) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha feed, story ou os dois." });
      const row = await motion.getMotion(ctx.user.id, input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Vídeo não encontrado." });
      if (row.status !== "pronto" || !row.videoUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "O vídeo ainda não está pronto." });
      const caption = (input.caption ?? row.caption ?? "").trim();
      if (input.feed && !caption) throw new TRPCError({ code: "BAD_REQUEST", message: "O feed precisa de legenda." });
      const scheduledAt = input.when ? new Date(input.when) : undefined;
      if (scheduledAt && scheduledAt.getTime() <= Date.now() + 60_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um horário no futuro." });

      const results: Array<{ target: "feed" | "story"; status: "published" | "scheduled" | "failed"; error?: string }> = [];
      const targets: Array<"feed" | "story"> = [...(input.feed ? ["feed" as const] : []), ...(input.story ? ["story" as const] : [])];
      for (const target of targets) {
        const post = await db.saveSocialPost(ctx.user.id, {
          channel: "instagram",
          title: `${target === "feed" ? "Reels" : "Story"} · ${row.title}`.slice(0, 255),
          content: target === "feed" ? caption : row.title,
          imageUrl: row.videoUrl,
          metadata: JSON.stringify({
            kind: target === "feed" ? "instagram_reel" : "instagram_story",
            motionId: row.id,
            ...(target === "feed" && input.collaborators?.length ? { collaborators: input.collaborators } : {}),
          }),
          scheduledAt,
        });
        if (scheduledAt) { results.push({ target, status: "scheduled" }); continue; }
        try {
          const { result } = await publishInstagramSocialPost(post);
          await db.updateSocialPost(post.id, ctx.user.id, { status: "published", publishedAt: new Date(), igMediaId: result.mediaId ?? null, errorMessage: null });
          results.push({ target, status: "published" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await db.updateSocialPost(post.id, ctx.user.id, { status: "failed", errorMessage: msg.slice(0, 1000) });
          results.push({ target, status: "failed", error: msg });
        }
      }
      return { results };
    }),

  /** Postagens (feed e story) feitas ou programadas a partir de cada vídeo. */
  publications: protectedProcedure.query(async ({ ctx }) => {
    const conn = await db.getDb();
    if (!conn) return [];
    const rows = await conn.select({ id: socialPosts.id, metadata: socialPosts.metadata, status: socialPosts.status, scheduledAt: socialPosts.scheduledAt, publishedAt: socialPosts.publishedAt, errorMessage: socialPosts.errorMessage })
      .from(socialPosts).where(and(eq(socialPosts.userId, ctx.user.id), like(socialPosts.metadata, '%"motionId":%'))).orderBy(desc(socialPosts.id)).limit(500);
    return rows.flatMap((r) => {
      try {
        const m = JSON.parse(r.metadata ?? "{}") as { kind?: string; motionId?: number };
        if (!m.motionId) return [];
        return [{ postId: r.id, motionId: m.motionId, target: m.kind === "instagram_story" ? "story" as const : "feed" as const, status: r.status, scheduledAt: r.scheduledAt, publishedAt: r.publishedAt, error: r.errorMessage }];
      } catch { return []; }
    });
  }),

  /** Cancela uma programação ainda não publicada. */
  cancelPublication: protectedProcedure.input(z.object({ postId: z.number().int() })).mutation(async ({ ctx, input }) => {
    const post = await db.getSocialPostById(input.postId, ctx.user.id);
    if (!post || post.status !== "scheduled") throw new TRPCError({ code: "BAD_REQUEST", message: "Só dá para cancelar o que ainda está programado." });
    await db.deleteSocialPost(input.postId, ctx.user.id);
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
