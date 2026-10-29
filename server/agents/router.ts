import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { AGENTS, getAgent } from "./registry";
import { regeneratePlanItem, sendUserMessage } from "./runtime";
import { TASKS, planItemSchema, type PlanResult } from "./tasks";
import * as store from "./store";
import { persistGeneratedImage } from "../_core/imageGeneration";
import { DESIGN_FORMATS, DesignError, renderDesign } from "./design/render";
import { findSvgForImage, formatOf } from "./design/edit";
import { editForReels } from "./video/reelsEdit";
import { getHeyGenSubtitle } from "../_core/heyGenAvatarAgent";

const filePath = z.string().regex(/^[a-z0-9][a-z0-9_\-./]{0,99}\.(md|txt|tsv|json)$/i).refine((p) => !p.includes(".."));

async function ownThread(userId: number, threadId: number) {
  const thread = await store.getThread(userId, threadId);
  if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada" });
  return thread;
}


// ─── Edição manual das artes (texto) ──────────────────────────────────────────

// Qual arte de qual tarefa: slide do carrossel, quadro dos stories ou a arte do post.
const artTarget = z.object({ kind: z.enum(["slide", "frame", "post"]), index: z.number().int().min(0).default(0) });
type ArtNode = { imageUrl: string; svg?: string; previous?: { imageUrl: string; svg: string } };

const ART_AGENT: Record<z.infer<typeof artTarget>["kind"], string> = { slide: "carrossel", frame: "stories", post: "legendas" };

function artNode(result: Record<string, any> | null, target: z.infer<typeof artTarget>): ArtNode | null {
  if (!result) return null;
  if (target.kind === "post") return typeof result.imageUrl === "string" ? (result as ArtNode) : null;
  const list = target.kind === "slide" ? result.slides : result.frames;
  return Array.isArray(list) && list[target.index]?.imageUrl ? list[target.index] : null;
}

async function artSvg(threadId: number, node: ArtNode) {
  return node.svg ?? (await findSvgForImage(threadId, node.imageUrl));
}

async function loadArt(userId: number, threadId: number, target: z.infer<typeof artTarget>) {
  const thread = await ownThread(userId, threadId);
  if (thread.agentSlug !== ART_AGENT[target.kind]) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta tarefa não tem essa arte." });
  const result = structuredClone(thread.result as Record<string, any> | null);
  const node = artNode(result, target);
  if (!result || !node) throw new TRPCError({ code: "NOT_FOUND", message: "Arte não encontrada." });
  return { thread, result, node };
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

  /** Troca uma pauta por outra criada pelo Agente de Planejamento. */
  regeneratePlanItem: protectedProcedure
    .input(z.object({ threadId: z.number().int(), index: z.number().int().min(0), feedback: z.string().trim().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      const plan = thread.result as PlanResult | null;
      if (thread.agentSlug !== "planejamento" || !plan?.items[input.index]) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pauta não encontrada." });
      }
      const item = await regeneratePlanItem(ctx.user.id, plan, input.index, input.feedback || undefined)
        .catch((e) => { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (e as Error).message }); });
      // Relê o plano: a equipe pode ter mexido em outra pauta enquanto o agente trabalhava.
      const fresh = (await ownThread(ctx.user.id, input.threadId)).result as PlanResult;
      await store.setThreadResult(thread.id, { ...fresh, items: fresh.items.map((it, i) => (i === input.index ? item : it)) });
      return { item };
    }),

  /** O desenho (SVG) de uma arte, para o editor visual. */
  artSource: protectedProcedure
    .input(z.object({ threadId: z.number().int(), target: artTarget }))
    .query(async ({ ctx, input }) => {
      const { thread, node } = await loadArt(ctx.user.id, input.threadId, input.target);
      const svg = await artSvg(thread.id, node);
      return { svg, canUndo: Boolean(node.previous) };
    }),

  /** Salva a arte editada no editor visual: renderiza o SVG, guarda o PNG e mantém a versão anterior. */
  saveArt: protectedProcedure
    .input(z.object({ threadId: z.number().int(), target: artTarget, svg: z.string().min(20).max(1_500_000) }))
    .mutation(async ({ ctx, input }) => {
      const { thread, result, node } = await loadArt(ctx.user.id, input.threadId, input.target);
      const svg = await artSvg(thread.id, node);
      if (!svg) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta arte foi feita antes da edição existir e não tem o desenho guardado." });
      const format = formatOf(input.svg);
      let png: Buffer;
      try {
        png = await renderDesign(input.svg, format);
      } catch (e) {
        throw new TRPCError({ code: "BAD_REQUEST", message: e instanceof DesignError ? e.message : "Não consegui desenhar a arte." });
      }
      const { url } = await persistGeneratedImage(png.toString("base64"), "png");
      const { width, height } = DESIGN_FORMATS[format];
      await db.saveImage(ctx.user.id, `${thread.title.slice(0, 200)} (editada)`, url, undefined, width, height);
      node.previous = { imageUrl: node.imageUrl, svg };
      node.imageUrl = url;
      node.svg = input.svg;
      await store.setThreadResult(thread.id, result);
      return { imageUrl: url };
    }),

  undoArtEdit: protectedProcedure
    .input(z.object({ threadId: z.number().int(), target: artTarget }))
    .mutation(async ({ ctx, input }) => {
      const { thread, result, node } = await loadArt(ctx.user.id, input.threadId, input.target);
      if (!node.previous) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há edição para desfazer." });
      const current = { imageUrl: node.imageUrl, svg: node.svg ?? "" };
      node.imageUrl = node.previous.imageUrl;
      node.svg = node.previous.svg;
      node.previous = current.svg ? current : undefined;
      await store.setThreadResult(thread.id, result);
      return { imageUrl: node.imageUrl };
    }),

  /** Edição manual da legenda e das hashtags de um carrossel ou post. */
  editCaption: protectedProcedure
    .input(z.object({ threadId: z.number().int(), caption: z.string().trim().min(1).max(2200), hashtags: z.array(z.string().trim().min(2).max(60)).max(30) }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      const result = thread.result as Record<string, any> | null;
      if (!result || typeof result.caption !== "string") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta tarefa não tem legenda." });
      await store.setThreadResult(thread.id, { ...result, caption: input.caption, hashtags: input.hashtags });
      return { ok: true };
    }),

  /** Guarda no resultado da tarefa de vídeo o vídeo gerado no HeyGen e o roteiro usado. */
  attachVideo: protectedProcedure
    .input(z.object({
      threadId: z.number().int(),
      script: z.string().trim().min(10).max(5000),
      video: z.object({ id: z.number().int(), url: z.string().url().nullable(), avatarName: z.string().max(200), voiceId: z.string().max(256) }),
    }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      const result = thread.result as Record<string, any> | null;
      if (!result || thread.agentSlug !== "video-ia") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta tarefa não é de vídeo." });
      const videos = Array.isArray(result.videos) ? result.videos : [];
      await store.setThreadResult(thread.id, { ...result, script: input.script, videos: [{ ...input.video, createdAt: new Date().toISOString() }, ...videos].slice(0, 10) });
      return { ok: true };
    }),

  /** Edição para Reels (legenda viral, cortes, transição, gancho e CTA) de um vídeo da tarefa. */
  editVideoForReels: protectedProcedure
    .input(z.object({
      threadId: z.number().int(),
      videoIndex: z.number().int().min(0),
      hook: z.string().trim().max(80),
      cta: z.string().trim().max(60),
      transition: z.boolean().default(true),
      dynamic: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const thread = await ownThread(ctx.user.id, input.threadId);
      const result = thread.result as Record<string, any> | null;
      const videos = Array.isArray(result?.videos) ? [...result!.videos] : [];
      const video = videos[input.videoIndex];
      if (!result || thread.agentSlug !== "video-ia" || !video?.url) throw new TRPCError({ code: "BAD_REQUEST", message: "Vídeo não encontrado nesta tarefa." });
      const record = (await db.getAvatarVideos(ctx.user.id)).find((v) => v.id === video.id);
      const srt = record?.providerJobId ? await getHeyGenSubtitle(record.providerJobId) : null;
      const caption = String(result.caption ?? "");
      const footnote = /15%/.test(String(result.script ?? "") + caption) || /quinze por cento/i.test(String(result.script ?? ""))
        ? "*Até 15% de desconto, sujeito à análise da fatura e às condições do benefício."
        : null;
      try {
        const { url } = await editForReels({
          videoUrl: video.url, script: String(result.script ?? ""), srt,
          hook: input.hook, cta: input.cta, footnote, transition: input.transition,
          framing: /\(vertical\)/.test(String(video.avatarName ?? "")) ? "aberto" : "fechado",
          dynamic: input.dynamic,
          storageKey: `videos/${ctx.user.id}/reels-${thread.id}-${input.videoIndex}-${Date.now()}.mp4`,
        });
        videos[input.videoIndex] = { ...video, editedUrl: url, editedAt: new Date().toISOString(), edit: { hook: input.hook, cta: input.cta, transition: input.transition, dynamic: input.dynamic } };
        await store.setThreadResult(thread.id, { ...result, videos });
        return { url };
      } catch (err) {
        console.error("[Reels] edição falhou:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Não consegui editar o vídeo: ${err instanceof Error ? err.message.slice(0, 300) : "erro"}` });
      }
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
