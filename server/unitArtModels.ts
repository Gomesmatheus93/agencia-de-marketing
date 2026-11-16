import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { unitArtBackgrounds, unitWeeklyPlans } from "../drizzle/schema";
import { persistGeneratedImage } from "./_core/imageGeneration";
import { adminProcedure, router } from "./_core/trpc";
import { renderDesign } from "./agents/design/render";
import { agentsRouter } from "./agents/router";
import * as store from "./agents/store";
import { storagePut } from "./storage";
import { conn } from "./unitPortal";

// Modelos de fundo das artes das academias: o post troca de fundo e o conteúdo continua o mesmo.
// O texto, os logos e os botões mudam de cor conforme o tom do fundo, para manter o contraste.

const TONES = ["escuro", "laranja", "claro"] as const;
type Tone = (typeof TONES)[number];
const P = "#3A0057";
const OR_DEF = `<linearGradient id="orModel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa040"/><stop offset="1" stop-color="#ff5a00"/></linearGradient>`;

/** Fundo da arte: elementos iniciais do tamanho da arte, faixas e marca d'água antes do conteúdo. */
function stripBackground(svg: string) {
  const open = svg.match(/<svg\b[^>]*>/)![0];
  let body = svg.slice(open.length, svg.lastIndexOf("</svg>"));
  const defs = body.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? "";
  body = body.replace(defs, "");
  for (;;) {
    const m = body.match(/^\s*(<rect\b(?![^>]*\sx=)(?![^>]*\sy=)[^>]*width="1080"[^>]*\/>|<image\b(?![^>]*alle:)[^>]*width="1080"[^>]*\/>|<path\b[^>]*\/>|<circle\b[^>]*\/>|<image\b[^>]*href="alle:raio[^"]*"[^>]*\/>)/);
    if (!m) break;
    body = body.slice(m[0].length);
  }
  return { open, defs: defs.replace(/<\/?defs>/g, ""), body };
}

/** Ajusta texto, logos, ícones e botões ao tom do fundo. */
function recolor(body: string, tone: Tone) {
  const light = tone === "claro";
  const textColor = light ? P : "#fff";
  // Textos (menos os dos botões, que ficam brancos sobre o botão).
  body = body.replace(/<text\b([^>]*)>/g, (m, attrs: string) => {
    if (/text-anchor="middle"/.test(attrs)) return m;
    const fill = attrs.match(/fill="([^"]*)"/)?.[1]?.toLowerCase();
    if (!fill) return m;
    const isNeutral = ["#fff", "#ffffff", "white", P.toLowerCase(), "#2a0a3d", "#44015e"].includes(fill);
    const isHighlight = ["#ffa040", "#ff6a00", "#ff8a1f", "#ff7300", "#f47b20"].includes(fill);
    if (isNeutral) return m.replace(/fill="[^"]*"/, `fill="${textColor}"`);
    if (isHighlight) return m.replace(/fill="[^"]*"/, `fill="${tone === "laranja" ? "#fff" : light ? "#ff6a00" : "#ffa040"}"`);
    return m;
  });
  // Ícones de traço (QR) acompanham o texto.
  body = body.replace(/stroke="(#fff|#ffffff|white|#3A0057)"/gi, `stroke="${textColor}"`);
  // Logos.
  body = body.replace(/href="alle:(allpfit-branco|allpfit-mono|allpfit-roxo|allpfit)"/g, `href="alle:${light ? "allpfit-roxo" : tone === "laranja" ? "allpfit-mono" : "allpfit-branco"}"`);
  body = body.replace(/href="alle:(logo-branco|logo)"/g, `href="alle:${light ? "logo" : "logo-branco"}"`);
  // Botões e cards: laranja some no fundo laranja; roxo some no fundo roxo.
  body = body.replace(/<rect\b([^>]*)\/>/g, (m, attrs: string) => {
    const fill = attrs.match(/fill="([^"]*)"/)?.[1] ?? "";
    const orange = /^url\(#(or|orModel|cta|card)\)$/.test(fill) || /^#(f47b20|ff7300|ff6a00|df5900|e65b00)$/i.test(fill);
    const purple = /^#(3a0057|5a16a8|4b0f99|44015e)$/i.test(fill);
    if (tone === "laranja" && orange) return m.replace(fill, P);
    if (tone !== "laranja" && purple && /rx=/.test(attrs)) return m.replace(fill, "url(#orModel)");
    return m;
  });
  return body;
}

function build(svg: string, bgUrl: string, tone: Tone, story: boolean) {
  const { open, defs, body } = stripBackground(svg);
  const content = recolor(body, tone);
  if (!story) return `${open}<defs>${defs}${OR_DEF}</defs><image href="${bgUrl}" x="0" y="0" width="1080" height="1350"/>${content}</svg>`;
  // Story: o conteúdo desce para a área segura e a Ane continua encostada na borda de baixo.
  let c = content.replace(/<path\b[^>]*d="M\s*[\d.]+\s+[\d.]+\s*H\s*[\d.]+\s*M\s*[\d.]+\s+[\d.]+\s*L\s*[\d.]+\s+[\d.]+\s*L\s*[\d.]+\s+[\d.]+"[^>]*\/>/g, "");
  const anes: string[] = [];
  c = c.replace(/<image\b[^>]*href="alle:ane[^"]*"[^>]*\/>/g, (m) => { anes.push(m); return ""; });
  const o = open.replace(/viewBox="0 0 1080 1350"/, 'viewBox="0 0 1080 1920"').replace(/height="1350"/, 'height="1920"');
  return `${o}<defs>${defs}${OR_DEF}</defs><image href="${bgUrl}" x="0" y="0" width="1080" height="1920"/><g transform="translate(0 285)">${c}</g><g transform="translate(0 570)">${anes.join("")}</g></svg>`;
}

/** Ajusta a imagem enviada aos dois tamanhos (cobrindo, sem distorcer). */
async function sizes(img: Buffer) {
  const feed = await sharp(img).resize(1080, 1350, { fit: "cover" }).png().toBuffer();
  const story = await sharp(img).resize(1080, 1920, { fit: "cover" }).png().toBuffer();
  const key = `unit-art-bg/${Date.now().toString(36)}`;
  const [f, s] = await Promise.all([storagePut(`${key}-feed.png`, feed, "image/png"), storagePut(`${key}-story.png`, story, "image/png")]);
  return { feedUrl: f.url, storyUrl: s.url };
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const unitArtRouter = router({
  backgrounds: adminProcedure.query(async () => {
    const c = await conn();
    return c.select().from(unitArtBackgrounds).orderBy(desc(unitArtBackgrounds.createdAt));
  }),

  /** Novo modelo a partir de uma imagem já enviada (URL pública). */
  addBackground: adminProcedure
    .input(z.object({ name: z.string().trim().min(1).max(80), tone: z.enum(TONES), url: z.string().url().max(2000) }))
    .mutation(async ({ input }) => {
      const res = await fetch(input.url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Não consegui abrir a imagem enviada." });
      const urls = await sizes(Buffer.from(await res.arrayBuffer()));
      const c = await conn();
      const [row] = await c.insert(unitArtBackgrounds).values({ name: input.name, tone: input.tone, ...urls }).returning();
      return row;
    }),

  deleteBackground: adminProcedure.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    const c = await conn();
    await c.delete(unitArtBackgrounds).where(eq(unitArtBackgrounds.id, input.id));
    return { ok: true };
  }),

  /** Troca o fundo de todas as artes do post (feed) e refaz os stories com o mesmo fundo. */
  applyModel: adminProcedure
    .input(z.object({ weekStart: day, itemIndex: z.number().int().min(0), backgroundId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const c = await conn();
      const [bg] = await c.select().from(unitArtBackgrounds).where(eq(unitArtBackgrounds.id, input.backgroundId));
      if (!bg) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo não encontrado." });
      const [row] = await c.select().from(unitWeeklyPlans).where(eq(unitWeeklyPlans.weekStart, input.weekStart));
      const item = row?.items[input.itemIndex];
      if (!item?.artThreadId) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta arte não tem desenho para trocar o fundo (só artes criadas na plataforma)." });
      const agents = agentsRouter.createCaller(ctx);
      const thread = await store.getThread(ctx.user.id, item.artThreadId);
      const r = (thread?.result ?? {}) as Record<string, any>;
      const kind = (r.slides ? "slide" : r.frames ? "frame" : "post") as "slide" | "frame" | "post";
      const count = r.slides?.length ?? r.frames?.length ?? 1;
      const feed: string[] = [], stories: string[] = [];
      for (let i = 0; i < count; i++) {
        const src = await agents.artSource({ threadId: item.artThreadId, target: { kind, index: i } });
        if (!src.svg) continue;
        const saved = await agents.saveArt({ threadId: item.artThreadId, target: { kind, index: i }, svg: build(src.svg, bg.feedUrl, bg.tone as Tone, false) });
        feed.push(saved.imageUrl);
        const png = await renderDesign(build(src.svg, bg.storyUrl, bg.tone as Tone, true), "story_9x16");
        stories.push((await persistGeneratedImage(png.toString("base64"), "png")).url);
      }
      if (!feed.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não encontrei o desenho desta arte." });
      const items = row.items.map((it, j) => (j === input.itemIndex ? { ...it, imageUrls: feed, storyUrls: stories } : it));
      await c.update(unitWeeklyPlans).set({ items }).where(eq(unitWeeklyPlans.id, row.id));
      return { imageUrls: feed, storyUrls: stories };
    }),
});
