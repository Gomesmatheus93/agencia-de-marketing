import { Resvg } from "@resvg/resvg-js";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Renderiza as artes que os agentes desenham em SVG (o Claude não gera imagem
// em pixels, mas desenha layout, tipografia e formas em código) para PNG.

const DESIGN_DIR = path.resolve(process.cwd(), "server/agents/design");
const FONT_FILES = readdirSync(path.join(DESIGN_DIR, "fonts"))
  .filter((f) => f.endsWith(".otf") || f.endsWith(".ttf"))
  .map((f) => path.join(DESIGN_DIR, "fonts", f));

export const DESIGN_FORMATS = {
  feed_4x5: { width: 1080, height: 1350, label: "Feed 4:5 (1080×1350)" },
  feed_1x1: { width: 1080, height: 1080, label: "Feed quadrado (1080×1080)" },
  story_9x16: { width: 1080, height: 1920, label: "Stories/Reels (1080×1920)" },
} as const;
export type DesignFormat = keyof typeof DESIGN_FORMATS;

/** Arquivos da marca que o SVG pode referenciar com href="alle:<nome>". */
const BRAND_ASSETS: Record<string, string> = {};
for (const name of ["logo", "logo-branco", "logo-mono", "raio", "raio-branco", "raio-mono", "allpfit", "allpfit-branco", "allpfit-mono", "allpfit-roxo", "ane"]) {
  BRAND_ASSETS[`alle:${name}`] = `data:image/png;base64,${readFileSync(path.join(DESIGN_DIR, "assets", `${name}.png`)).toString("base64")}`;
}

const MAX_REMOTE_IMAGES = 8;
const MAX_IMAGE_BYTES = 8_000_000;

export class DesignError extends Error {}

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/.test(type)) throw new DesignError(`Imagem inacessível: ${url} (${res.status} ${type})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new DesignError(`Imagem grande demais: ${url}`);
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/**
 * Prepara o SVG: confere o tamanho, troca alle:* pelos arquivos da marca,
 * embute as imagens https e descarta qualquer outra referência (caminhos
 * locais nunca chegam ao renderizador).
 */
async function prepareSvg(svg: string, format: DesignFormat): Promise<string> {
  const { width, height } = DESIGN_FORMATS[format];
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) throw new DesignError("O conteúdo não é um SVG (falta a tag <svg>).");
  const viewBox = root.match(/viewBox\s*=\s*["']\s*0[\s,]+0[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*["']/i);
  if (!viewBox || Number(viewBox[1]) !== width || Number(viewBox[2]) !== height) {
    throw new DesignError(`O <svg> precisa de viewBox="0 0 ${width} ${height}" para o formato ${format}.`);
  }
  let out = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");

  const hrefRe = /(\s(?:xlink:)?href\s*=\s*)(["'])(.*?)\2/gi;
  const remote = [...new Set([...out.matchAll(hrefRe)].map((m) => m[3]).filter((h) => /^https:\/\//i.test(h)))];
  if (remote.length > MAX_REMOTE_IMAGES) throw new DesignError(`No máximo ${MAX_REMOTE_IMAGES} imagens externas por arte.`);
  const embedded = new Map(await Promise.all(remote.map(async (u) => [u, await fetchAsDataUri(u)] as const)));

  out = out.replace(hrefRe, (_m, attr: string, q: string, value: string) => {
    if (value.startsWith("#") || /^data:image\//i.test(value)) return `${attr}${q}${value}${q}`;
    const asset = BRAND_ASSETS[value] ?? embedded.get(value);
    return asset ? `${attr}${q}${asset}${q}` : "";
  });
  return out;
}

export async function renderDesign(svg: string, format: DesignFormat): Promise<Buffer> {
  const prepared = await prepareSvg(svg, format);
  try {
    const resvg = new Resvg(prepared, {
      fitTo: { mode: "width", value: DESIGN_FORMATS[format].width },
      font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Montserrat" },
    });
    return resvg.render().asPng();
  } catch (error) {
    throw new DesignError(`SVG inválido: ${(error as Error).message}`);
  }
}
