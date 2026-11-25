import { DESIGN_FORMATS, type DesignFormat } from "./render";
import * as store from "../store";

// Apoio à edição manual das artes (editor visual na tela): de onde vem o SVG de
// cada arte e em que formato ela é renderizada.

/** Formato de render a partir do tamanho do SVG. */
export function formatOf(svg: string): DesignFormat {
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  const vb = root.match(/viewBox="[\d.\s-]*?(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/);
  const w = Number(root.match(/\bwidth="(\d+)/)?.[1] ?? vb?.[1]);
  const h = Number(root.match(/\bheight="(\d+)/)?.[1] ?? vb?.[2]);
  const found = (Object.keys(DESIGN_FORMATS) as DesignFormat[]).find((f) => DESIGN_FORMATS[f].width === w && DESIGN_FORMATS[f].height === h);
  return found ?? "feed_4x5";
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
  e[0] === "#" ? String.fromCodePoint(parseInt(e.slice(e[1] === "x" || e[1] === "X" ? 2 : 1), e[1] === "x" || e[1] === "X" ? 16 : 10)) : ENTITIES[e] ?? m);

/** Textos visíveis do SVG (um por <text>, com os <tspan> juntos). */
function svgTexts(svg: string): string[] {
  return [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Imagens usadas no SVG (fotos, ícones e logos), sem as embutidas em base64. */
function svgImages(svg: string): string[] {
  return [...svg.matchAll(/<image\b[^>]*?\b(?:xlink:)?href="([^"]+)"/gi)].map((m) => m[1]).filter((h) => !h.startsWith("data:"));
}

/** Diferença entre listas, respeitando repetições. */
function listDiff(before: string[], after: string[]) {
  const left = [...after];
  const removed: string[] = [];
  for (const b of before) {
    const i = left.indexOf(b);
    if (i >= 0) left.splice(i, 1); else removed.push(b);
  }
  return { removed, added: left };
}

/**
 * Resumo do que mudou entre duas versões de uma arte, para os registros do admin:
 * textos tirados e colocados, imagens trocadas e se mexeu em posição/cor/tamanho.
 */
export function svgChangeSummary(before: string, after: string) {
  const texts = listDiff(svgTexts(before), svgTexts(after));
  const images = listDiff(svgImages(before), svgImages(after));
  // Tira o conteúdo dos textos e o endereço das imagens: o que sobrar diferente é posição, cor, tamanho ou forma.
  const shape = (s: string) => s
    .replace(/(<text\b[^>]*>)[\s\S]*?<\/text>/gi, "$1</text>")
    .replace(/(\b(?:xlink:)?href=)"[^"]*"/gi, '$1""')
    .replace(/\s+/g, " ").trim();
  return {
    textsRemoved: texts.removed.slice(0, 30), textsAdded: texts.added.slice(0, 30),
    imagesRemoved: images.removed.slice(0, 20), imagesAdded: images.added.slice(0, 20),
    layoutChanged: shape(before) !== shape(after),
  };
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
