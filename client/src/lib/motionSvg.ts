// Utilidades do editor de motion para mexer no SVG de uma camada sem quebrar o
// desenho: textos (com destaques), cores, foto da Ane e endereços das imagens.

const SVG_NS = "http://www.w3.org/2000/svg";
export const ASSET_URL = "/api/design-assets/assets";
export const FONT_FACES = [["Light", 300], ["Regular", 400], ["Medium", 500], ["SemiBold", 600], ["Bold", 700], ["ExtraBold", 800], ["Black", 900]]
  .map(([n, w]) => `@font-face{font-family:"Montserrat";font-weight:${w};src:url("/api/design-assets/fonts/Montserrat-${n}.otf") format("opentype");}`)
  .join("");

/**
 * Prepara um fragmento para a prévia no navegador: limpa (o roteiro vem do
 * banco: nada de script, atributos on…, nem links que não sejam imagem) e troca
 * href="alle:nome" pelo arquivo servido.
 */
export function toPreview(svg: string) {
  if (!svg) return "";
  const root = parseFragment(svg);
  if (!root) return "";
  root.querySelectorAll("script, foreignObject, iframe, object, embed, animate, set, animateTransform, animateMotion").forEach((n) => n.remove());
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) { el.removeAttribute(attr.name); continue; }
      if (name === "href" || name === "xlink:href") {
        const v = attr.value.trim();
        if (/^alle:[a-z0-9-]+$/i.test(v)) { el.setAttribute(attr.name, `${ASSET_URL}/${v.slice(5)}.png`); continue; }
        if (!/^(https:\/\/|data:image\/(png|jpeg|webp|gif);|#)/i.test(v)) el.removeAttribute(attr.name);
      }
      if (/^javascript:/i.test(attr.value.trim())) el.removeAttribute(attr.name);
    }
  }
  return serialize(root);
}

function parseFragment(svg: string) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${svg}</svg>`, "image/svg+xml");
  return doc.querySelector("parsererror") ? null : doc.documentElement;
}
function serialize(root: Element) {
  const s = new XMLSerializer();
  return Array.from(root.childNodes).map((n) => s.serializeToString(n)).join("").replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
}

/** Uma linha por <text>; os <tspan> de destaque ficam juntos. */
export function readTexts(svg: string) {
  const root = parseFragment(svg);
  return root ? Array.from(root.querySelectorAll("text")).map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()) : [];
}
/** Troca o texto de uma linha redistribuindo as palavras pelos destaques (cada trecho mantém peso e cor). */
export function writeText(svg: string, index: number, value: string) {
  const root = parseFragment(svg);
  const el = root ? Array.from(root.querySelectorAll("text"))[index] : null;
  if (!root || !el) return svg;
  const spans = Array.from(el.querySelectorAll("tspan"));
  if (!spans.length) { el.textContent = value; return serialize(root); }
  const words = value.split(/\s+/).filter(Boolean);
  const counts = spans.map((sp) => Math.max(1, (sp.textContent ?? "").trim().split(/\s+/).filter(Boolean).length));
  let w = 0;
  spans.forEach((sp, i) => {
    const take = i === spans.length - 1 ? words.length - w : Math.min(counts[i], Math.max(0, words.length - w - (spans.length - 1 - i)));
    const part = words.slice(w, w + Math.max(0, take)).join(" ");
    w += Math.max(0, take);
    sp.textContent = part ? (i > 0 ? ` ${part}` : part) : "";
  });
  return serialize(root);
}

/** Cores sólidas usadas na camada (fill e stroke em hexadecimal). */
export function colorsOf(svg: string) {
  return [...new Set([...svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{3,6})"/g)].map((m) => m[1].toLowerCase()))].slice(0, 6);
}
export function replaceColor(svg: string, from: string, to: string) {
  const re = new RegExp(`((?:fill|stroke)=")${from.replace("#", "#")}(")`, "gi");
  return svg.replace(re, `$1${to}$2`);
}

export function anePhotoOf(svg: string) {
  return svg.match(/href="alle:(ane[a-z0-9-]*)"/)?.[1] ?? null;
}
export type AnePhoto = { id: string; w: number; h: number; rightOnly: boolean };
/** Troca a foto da Ane mantendo a altura e o encaixe (borda direita ou centro). */
export function swapAne(svg: string, photo: AnePhoto, W: number) {
  const root = parseFragment(svg);
  const img = root ? Array.from(root.querySelectorAll("image")).find((el) => (el.getAttribute("href") ?? "").startsWith("alle:ane")) : null;
  if (!root || !img) return svg;
  const x = Number(img.getAttribute("x")), w = Number(img.getAttribute("width")), h = Number(img.getAttribute("height"));
  const nw = Math.round(h * photo.w / photo.h);
  const rightAnchored = x + w >= W - 60;
  const nx = rightAnchored || photo.rightOnly ? W - nw + (photo.rightOnly ? 36 : x + w - W) : Math.round(x + w / 2 - nw / 2);
  img.setAttribute("href", `alle:${photo.id}`);
  img.setAttribute("width", String(nw));
  img.setAttribute("x", String(nx));
  return serialize(root);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const T = (x: number, y: number, size: number, weight: number, fill: string, t: string, extra = "") =>
  `<text x="${x}" y="${y}" font-family="Montserrat" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(t)}</text>`;

/** Elementos prontos da biblioteca "Adicionar" (coordenadas da arte inteira). */
export function libraryItem(kind: string, W: number, H: number, photo?: AnePhoto) {
  const cx = Math.round(W / 2), cy = Math.round(H / 2);
  switch (kind) {
    case "titulo": return { name: "título", svg: `<text x="${cx}" y="${cy}" font-family="Montserrat" font-size="96" text-anchor="middle"><tspan font-weight="300" fill="#FFFFFF">Seu título</tspan><tspan font-weight="800" fill="#ff7300"> aqui.</tspan></text>`, origin: [cx, cy - 34] as [number, number] };
    case "texto": return { name: "texto", svg: T(cx, cy, 48, 500, "#FFFFFF", "Texto de apoio", 'text-anchor="middle"'), origin: [cx, cy - 17] as [number, number] };
    case "botao": return { name: "botão", svg: `<rect x="${cx - 340}" y="${cy - 50}" width="680" height="100" rx="50" fill="#ff7300"/>${T(cx, cy + 13, 36, 900, "#FFFFFF", "ATIVE SEU BENEFÍCIO", 'text-anchor="middle" letter-spacing="1"')}`, origin: [cx, cy] as [number, number] };
    case "qr": {
      const s = 220, x = cx - s / 2, y = cy - s / 2, c = s / 7;
      const f = (fx: number, fy: number) => `<rect x="${x + fx * c}" y="${y + fy * c}" width="${c * 2.2}" height="${c * 2.2}" rx="${c * .35}" fill="none" stroke="#5a16a8" stroke-width="${c * .55}"/><rect x="${x + fx * c + c * .75}" y="${y + fy * c + c * .75}" width="${c * .7}" height="${c * .7}" fill="#5a16a8"/>`;
      const d = [[3.4, .6], [4.2, 1.6], [3.6, 3.4], [4.6, 3.6], [.8, 4.3], [2, 3.6], [3.6, 4.8], [4.8, 4.6], [5.6, 5.6], [4.4, 5.8]].map(([a, b]) => `<rect x="${x + a * c}" y="${y + b * c}" width="${c * .7}" height="${c * .7}" fill="#5a16a8"/>`).join("");
      return { name: "QR", svg: `<rect x="${x - c * .6}" y="${y - c * .6}" width="${s + c * 1.2}" height="${s + c * 1.2}" rx="${c}" fill="#ffffff"/>${f(0, 0)}${f(4.8, 0)}${f(0, 4.8)}${d}`, origin: [cx, cy] as [number, number] };
    }
    case "circulo": return { name: "círculo", svg: `<circle cx="${cx}" cy="${cy}" r="220" fill="#ff7300"/>`, origin: [cx, cy] as [number, number] };
    case "card": return { name: "card", svg: `<rect x="${cx - 380}" y="${cy - 150}" width="760" height="300" rx="36" fill="#ff7300"/>`, origin: [cx, cy] as [number, number] };
    case "contador": return { name: "contador", svg: T(cx, cy + 60, 200, 900, "#FFFFFF", "{{n}}%", 'text-anchor="middle" letter-spacing="-6"'), origin: [cx, cy] as [number, number], counter: { from: 0, to: 15, at: 0, dur: 1.6, decimals: 0, ease: "out" } };
    case "digitacao": return { name: "digitação", svg: T(cx, cy, 44, 600, "#FFFFFF", "{{t}}", 'text-anchor="middle"'), origin: [cx, cy - 15] as [number, number], typewriter: { text: "QR Code na recepção da sua unidade", at: 0, cps: 24 } };
    case "logos": {
      const aw = 269, lw = 272, x0 = Math.round(cx - (aw + 84 + lw) / 2), y = Math.round(H * 0.07);
      return { name: "logos", svg: `<image href="alle:allpfit-branco" x="${x0}" y="${y + 11}" width="${aw}" height="58"/>${T(x0 + aw + 26, y + 58, 44, 400, "#FFFFFF", "+")}<image href="alle:logo-branco" x="${x0 + aw + 84}" y="${y}" width="${lw}" height="80"/>`, origin: [cx, y + 40] as [number, number] };
    }
    case "ane": {
      const p = photo!, h = Math.round(H * (W > H ? 0.9 : 0.5)), w = Math.round(h * p.w / p.h);
      const x = p.rightOnly || W > H ? W - w + (p.rightOnly ? 36 : 0) : Math.round(cx - w / 2);
      return { name: "Ane", svg: `<image href="alle:${p.id}" x="${x}" y="${H - h}" width="${w}" height="${h}"/>`, origin: [x + w / 2, H - h / 2] as [number, number] };
    }
    default: return null;
  }
}
