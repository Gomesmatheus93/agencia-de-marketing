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
