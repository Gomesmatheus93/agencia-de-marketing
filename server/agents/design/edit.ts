import { DESIGN_FORMATS, type DesignFormat } from "./render";
import * as store from "../store";

// Edição manual de texto das artes: troca os textos do SVG e renderiza de novo,
// sem IA. O layout, as cores e as fontes ficam como o agente desenhou.

// Texto "folha": <tspan>…</tspan> ou <text>…</text> sem elementos dentro.
const LEAF = /<(tspan|text)\b([^>]*)>([^<]*)<\/\1>/g;

function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function encode(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type ArtText = { id: number; text: string };

/** Os textos da arte, na ordem em que aparecem no SVG (ignora os vazios). */
export function extractTexts(svg: string): ArtText[] {
  const out: ArtText[] = [];
  let id = 0;
  for (const m of svg.matchAll(LEAF)) {
    const text = decode(m[3]);
    if (text.trim()) out.push({ id, text });
    id++;
  }
  return out;
}

/** Troca os textos pelos editados (por id), mantendo atributos e posição. */
export function applyTexts(svg: string, edits: ArtText[]): string {
  const byId = new Map(edits.map((e) => [e.id, e.text]));
  let id = 0;
  return svg.replace(LEAF, (whole, tag: string, attrs: string) => {
    const next = byId.get(id++);
    return next === undefined ? whole : `<${tag}${attrs}>${encode(next)}</${tag}>`;
  });
}

/** Formato de render a partir do tamanho do SVG. */
export function formatOf(svg: string): DesignFormat {
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const vb = root.match(/viewBox="[\d.\s-]*?(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/);
  const w = Number(root.match(/\bwidth="(\d+)/)?.[1] ?? vb?.[1]);
  const h = Number(root.match(/\bheight="(\d+)/)?.[1] ?? vb?.[2]);
  const found = (Object.keys(DESIGN_FORMATS) as DesignFormat[]).find((f) => DESIGN_FORMATS[f].width === w && DESIGN_FORMATS[f].height === h);
  return found ?? "feed_4x5";
}

/**
 * Acha o SVG que gerou uma imagem: o render_design cujo resultado devolveu
 * essa ARTE_URL no histórico da tarefa.
 */
export async function findSvgForImage(threadId: number, imageUrl: string): Promise<string | null> {
  const messages = await store.listMessages(threadId);
  const inputs = new Map<string, { svg?: string }>();
  for (const m of messages) {
    for (const b of m.content as Array<{ type: string; id?: string; name?: string; input?: { svg?: string } }>) {
      if (b.type === "tool_use" && b.name === "render_design" && b.id) inputs.set(b.id, b.input ?? {});
    }
  }
  for (const m of messages) {
    for (const b of m.content as Array<{ type: string; tool_use_id?: string; content?: unknown }>) {
      if (b.type !== "tool_result" || !b.tool_use_id || !inputs.has(b.tool_use_id)) continue;
      if (JSON.stringify(b.content ?? "").includes(`ARTE_URL=${imageUrl}`)) return inputs.get(b.tool_use_id)?.svg ?? null;
    }
  }
  return null;
}
