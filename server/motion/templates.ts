import { BEBAS_WIDTHS, MONTSERRAT_WIDTHS } from "./montserratWidths";
import { MOTION_FORMATS, type MotionFormat, type MotionLayer, type MotionScene, type MotionSpec } from "./spec";

// Modelos prontos de motion no padrão da parceria Alle + Allp Fit. Servem para
// testar sem IA e como ponto de partida: o roteiro gerado pode ser editado na tela.

const WIDTHS = MONTSERRAT_WIDTHS;
export const measure = (t: string, size: number, weight: number) => [...t].reduce((a, ch) => a + (WIDTHS[String(weight)]?.[ch === " " ? " " : ch] ?? 650), 0) * size / 1000;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const T = (x: number, y: number, size: number, weight: number, fill: string, t: string, extra = "") =>
  `<text x="${x}" y="${y}" font-family="Montserrat" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(t)}</text>`;
const OR = "#ff7300";
// Títulos em Bebas Neue (padrão dos posts desde 24/11/2026): caixa alta, um peso só.
export const measureBebas = (t: string, size: number) => [...t].reduce((a, ch) => a + (BEBAS_WIDTHS[ch === "\u00a0" ? " " : ch] ?? 380), 0) * size / 1000;
const TB = (x: number, y: number, size: number, fill: string, t: string, extra = "") =>
  `<text x="${x}" y="${y}" font-family="Bebas Neue" font-size="${size}" fill="${fill}" ${extra}>${esc(t.toUpperCase().replace("{{N}}", "{{n}}").replace("{{T}}", "{{t}}"))}</text>`;

export const ANE_PHOTOS: Record<string, { w: number; h: number; rightOnly?: boolean }> = {
  "ane-rabo": { w: 842, h: 998 }, "ane-coque-2": { w: 872, h: 1000 }, "ane-oculos-2": { w: 997, h: 1000 },
  "ane-tras": { w: 746, h: 1000 }, "ane-ombro-2": { w: 718, h: 999 }, "ane-solta": { w: 866, h: 1000, rightOnly: true },
  "ane-polo": { w: 732, h: 1000 },
};

// ─── Peças ────────────────────────────────────────────────────────────────────
const DEFS = `<defs><linearGradient id="or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa040"/><stop offset="1" stop-color="#ff5a00"/></linearGradient><radialGradient id="rad" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#8B2FD9"/><stop offset=".55" stop-color="#5E17A8"/><stop offset="1" stop-color="#2E0A63"/></radialGradient><pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="17" cy="17" r="2.2" fill="#fff" opacity=".07"/></pattern></defs>`;
/** Fundo roxo da parceria: brilho, pontos e fitas laranja nos cantos. */
export function partnerBackground(W: number, H: number) {
  return `${DEFS}<rect width="${W}" height="${H}" fill="url(#rad)"/><rect width="${W}" height="${H}" fill="url(#dots)"/><path d="M${W} 0V${H * 0.2}C${W - 100} ${H * 0.14} ${W - 210} ${H * 0.07} ${W - 320} 0Z" fill="url(#or)"/><path d="M0 ${H}V${H * 0.8}C110 ${H * 0.86} 220 ${H * 0.93} 300 ${H}Z" fill="url(#or)"/>`;
}
function cobrand(W: number, y: number) {
  const aw = Math.round(58 * 1279 / 276), lw = Math.round(80 * 1200 / 353), total = aw + 84 + lw, x0 = Math.round(W / 2 - total / 2);
  return `<image href="alle:allpfit-branco" x="${x0}" y="${y + 11}" width="${aw}" height="58"/>${T(x0 + aw + 26, y + 58, 44, 400, "#FFFFFF", "+")}<image href="alle:logo-branco" x="${x0 + aw + 84}" y="${y}" width="${lw}" height="80"/>`;
}
function aneSvg(photo: string, h: number, W: number, H: number, place: "center" | "right", inset = 0) {
  const p = ANE_PHOTOS[photo] ?? ANE_PHOTOS["ane-rabo"];
  const w = Math.round(h * p.w / p.h);
  const x = place === "right" || p.rightOnly ? W - w + (p.rightOnly ? 36 : -inset) : Math.round(W / 2 - w / 2);
  return { svg: `<image href="alle:${photo}" x="${x}" y="${H - h}" width="${w}" height="${h}"/>`, x, w };
}
function qrIcon(x: number, y: number, s: number, color = "#5A16A8") {
  const c = s / 7, f = (fx: number, fy: number) => `<rect x="${x + fx * c}" y="${y + fy * c}" width="${c * 2.2}" height="${c * 2.2}" rx="${c * .35}" fill="none" stroke="${color}" stroke-width="${c * .55}"/><rect x="${x + fx * c + c * .75}" y="${y + fy * c + c * .75}" width="${c * .7}" height="${c * .7}" fill="${color}"/>`;
  const dots = [[3.4, .6], [4.2, 1.6], [3.6, 3.4], [4.6, 3.6], [.8, 4.3], [2, 3.6], [3.6, 4.8], [4.8, 4.6], [5.6, 5.6], [4.4, 5.8]].map(([a, b]) => `<rect x="${x + a * c}" y="${y + b * c}" width="${c * .7}" height="${c * .7}" fill="${color}"/>`).join("");
  return `<rect x="${x - c * .6}" y="${y - c * .6}" width="${s + c * 1.2}" height="${s + c * 1.2}" rx="${c}" fill="#FFFFFF"/>${f(0, 0)}${f(4.8, 0)}${f(0, 4.8)}${dots}`;
}
function pill(cx: number, y: number, w: number, label: string, fill = "url(#or)", size = 36) {
  return `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="100" rx="50" fill="${fill}"/>${T(cx, y + 63, size, 900, "#FFFFFF", label, 'text-anchor="middle" letter-spacing="1"')}`;
}

/** Quebra o título em linhas (parte fina 300 + destaque 800 laranja), centralizado. */
function titleLines(text: string, width: number, sizes: number[], maxLines: number) {
  const prepared = text.toUpperCase().replace(/ALLP FIT/g, "ALLP\u00a0FIT").replace(/ALLE ENERGIA/g, "ALLE\u00a0ENERGIA");
  const m = prepared.match(/^(.+?[.,?:!])\s+(.+)$/);
  const toWords = (s: string, hi: boolean) => s.split(/\s+/).filter(Boolean).map((t) => ({ t, hi }));
  let words = m && m[1].length >= 8 && m[2].length >= 6 ? [...toWords(m[1], false), ...toWords(m[2], true)] : toWords(prepared, false);
  if (!words.some((w) => w.hi)) words = words.map((w, i) => ({ ...w, hi: i >= words.length - (words.length > 5 ? 3 : 2) }));
  for (const size of sizes) {
    const ww = (w: { t: string; hi: boolean }) => measureBebas(w.t, size);
    const lines: Array<typeof words> = [[]]; let cur = 0;
    for (const w of words) {
      const add = (lines[lines.length - 1].length ? size * 0.16 : 0) + ww(w);
      if (cur + add > width && lines[lines.length - 1].length) { lines.push([w]); cur = ww(w); } else { lines[lines.length - 1].push(w); cur += add; }
    }
    const orphan = lines.length > 1 && lines.some((l) => l.length === 1 && l[0].t.length <= 4);
    if (lines.length <= maxLines && !orphan) return { size, lines };
    if (size === sizes[sizes.length - 1]) return { size, lines };
  }
  return { size: sizes[0], lines: [words] };
}
function lineSvg(line: Array<{ t: string; hi: boolean }>, cx: number, y: number, size: number) {
  return `<text x="${cx}" y="${y}" font-family="Bebas Neue" font-size="${size}" text-anchor="middle">${line.map((w, j) => `<tspan fill="${w.hi ? OR : "#FFFFFF"}">${j ? " " : ""}${esc(w.t)}</tspan>`).join("")}</text>`;
}

// ─── Modelos ──────────────────────────────────────────────────────────────────
export const MOTION_TEMPLATES = {
  cta: "CTA animado (frase do banco + Ane + QR)",
  contador: "Número de economia (contador até X%)",
  passos: "Passo a passo da parceria (QR → Ane → conta → benefício)",
} as const;
export type MotionTemplate = keyof typeof MOTION_TEMPLATES;

export type TemplateInput = { format: MotionFormat; text?: string; photo?: string; percent?: number; music?: string | null };

/**
 * Geometria por formato: em pé alto (9:16), em pé (4:5), quadrado/curto (1:1) e
 * horizontal (16:9, texto numa coluna à esquerda e a Ane à direita).
 */
function geometry(format: MotionFormat) {
  const { width: W, height: H } = MOTION_FORMATS[format];
  const wide = W > H, tall = H > 1500, short = !tall && H <= 1080;
  const cx = wide ? 580 : W / 2;
  return {
    W, H, wide, tall, short, cx,
    colW: wide ? 880 : W - 160,
    logoY: tall ? 280 : wide ? 70 : 90,
    logos: (y?: number) => cobrand(cx * 2, y ?? (tall ? 280 : wide ? 70 : 90)),
    /** Ane: no horizontal fica à direita; nos outros, no centro. */
    ane: (photo: string, hTall: number, hMid: number, hShort: number, hWide: number) =>
      wide ? aneSvg(photo, hWide, W, H, "right", 0) : aneSvg(photo, tall ? hTall : short ? hShort : hMid, W, H, "center"),
    /** Valor por formato: [9:16, 4:5, 1:1, 16:9]. */
    pick: <T,>(t: T, m: T, sh: T, w: T) => (wide ? w : tall ? t : short ? sh : m),
  };
}

function ctaSpec(i: TemplateInput): MotionSpec {
  const g = geometry(i.format);
  const { W, H, cx } = g;
  const photo = i.photo ?? "ane-rabo";
  const title = titleLines(i.text ?? "Seu benefício está a um toque.", g.colW, g.pick([190, 176, 162, 150, 138, 126], [160, 148, 136, 124, 112], [140, 130, 120, 110, 100], [180, 166, 152, 140, 128, 116]), g.pick(5, 4, 3, 4));
  const lh = Math.round(title.size * 0.98);
  const y0 = g.pick(560, 330, 300, Math.round(H / 2 - ((title.lines.length - 1) * lh) / 2 + title.size * 0.35));
  const lines: MotionLayer[] = title.lines.map((l, k) => ({ name: `título ${k + 1}`, svg: lineSvg(l, cx, y0 + k * lh, title.size), in: { preset: "slide-up", at: 0.35 + k * 0.14, dur: 0.6, ease: "out", distance: 70 } }));
  const ane = g.ane(photo, 940, 700, 520, 1000);
  const qrY = g.pick(560, 420, 300, 330);
  const ane2 = g.tall || g.wide ? g.ane(i.photo === "ane-oculos-2" ? "ane-coque-2" : "ane-oculos-2", 620, 0, 0, 960) : null;
  return {
    format: i.format, fps: 30, music: i.music ?? "mixkit-801", musicVolume: 0.5, background: partnerBackground(W, H),
    scenes: [
      { name: "frase", duration: 4.2, transition: "fade", layers: [
        { name: "logos", svg: g.logos(), in: { preset: "fade", at: 0, dur: 0.5, ease: "out" } },
        ...lines,
        { name: "Ane", svg: ane.svg, in: { preset: g.wide ? "slide-left" : "rise", at: 0.9, dur: 0.9, ease: "out", distance: g.wide ? 400 : 500 } },
      ] },
      { name: "ação", duration: 3.8, transition: "fade", layers: [
        { name: "logos", svg: g.logos() },
        { name: "título", svg: TB(cx, qrY - 60, g.pick(110, 96, 96, 110), "#FFFFFF", "Ative seu benefício", 'text-anchor="middle"'), in: { preset: "slide-down", at: 0.1, dur: 0.5, ease: "out", distance: 40 } },
        ...(ane2 ? [{ name: "Ane", svg: ane2.svg, in: { preset: g.wide ? "slide-left" as const : "rise" as const, at: 0.2, dur: 0.8, ease: "out" as const, distance: 400 } }] : []),
        { name: "QR", svg: qrIcon(cx - 110, qrY, 220), origin: [cx, qrY + 110], in: { preset: "pop", at: 0.35, dur: 0.6, ease: "back" }, loop: { kind: "pulse", period: 1.4, amount: 0.05, from: 1 } },
        { name: "chamada", svg: pill(cx, qrY + 330, 680, "ESCANEIE NA RECEPÇÃO"), origin: [cx, qrY + 380], in: { preset: "pop", at: 0.8, dur: 0.5, ease: "back" } },
        { name: "unidade", svg: T(cx, qrY + 520, 36, 600, "#F3E8FF", "{{t}}", 'text-anchor="middle"'), typewriter: { text: "e fale com a Ane na sua unidade", at: 1.3, cps: 26 } },
      ] },
    ],
  };
}

function counterSpec(i: TemplateInput): MotionSpec {
  const g = geometry(i.format);
  const { W, H, cx } = g;
  const pct = i.percent ?? 15;
  const cy = g.pick(860, 640, 500, 500);
  return {
    format: i.format, fps: 30, music: i.music ?? "mixkit-801", musicVolume: 0.5, background: partnerBackground(W, H),
    scenes: [
      { name: "número", duration: 4.6, transition: "zoom", layers: [
        { name: "logos", svg: g.logos(), in: { preset: "fade", at: 0, dur: 0.5, ease: "out" } },
        { name: "antes", svg: TB(cx, cy - 250, 110, "#FFFFFF", "Economize até", 'text-anchor="middle"'), in: { preset: "slide-down", at: 0.2, dur: 0.6, ease: "out", distance: 60 } },
        { name: "círculo", svg: `<circle cx="${cx}" cy="${cy}" r="${g.short ? 200 : 230}" fill="url(#or)"/>`, origin: [cx, cy], in: { preset: "pop", at: 0.4, dur: 0.7, ease: "back" } },
        { name: "contador", svg: TB(cx, cy + 100, g.short ? 270 : 300, "#FFFFFF", "{{n}}%", 'text-anchor="middle"'), origin: [cx, cy], in: { preset: "fade", at: 0.6, dur: 0.3, ease: "out" }, counter: { from: 0, to: pct, at: 0.6, dur: 1.6, decimals: 0, ease: "out" }, loop: { kind: "pulse", period: 1.2, amount: 0.04, from: 2.4 } },
        { name: "depois", svg: TB(cx, cy + (g.short ? 330 : 370), 104, "#FFFFFF", "na sua conta de luz", 'text-anchor="middle"'), in: { preset: "slide-up", at: 1.9, dur: 0.6, ease: "out", distance: 60 } },
        { name: "todo mês", svg: T(cx, cy + (g.short ? 390 : 440), 44, 500, "#F3E8FF", "todo mês, sem obra e sem fidelidade", 'text-anchor="middle"'), in: { preset: "fade", at: 2.4, dur: 0.6, ease: "out" } },
        ...(g.wide ? [{ name: "Ane", svg: g.ane(i.photo ?? "ane-tras", 0, 0, 0, 980).svg, in: { preset: "slide-left" as const, at: 1.2, dur: 0.8, ease: "out" as const, distance: 400 } }] : []),
      ] },
      { name: "ação", duration: 3.6, transition: "fade", layers: [
        { name: "logos", svg: g.logos() },
        { name: "Ane", svg: g.ane(i.photo ?? "ane-oculos-2", 900, 640, 560, 980).svg, in: { preset: g.wide ? "slide-left" : "rise", at: 0, dur: 0.8, ease: "out", distance: 400 } },
        { name: "chamada", svg: pill(cx, g.pick(520, 330, 300, 420), 700, "ATIVE SEU BENEFÍCIO"), origin: [cx, g.pick(570, 380, 350, 470)], in: { preset: "pop", at: 0.5, dur: 0.5, ease: "back" }, loop: { kind: "pulse", period: 1.4, amount: 0.04, from: 1.2 } },
        { name: "qr", svg: T(cx, g.pick(700, 500, 470, 600), 38, 700, "#FFFFFF", "QR Code na recepção da sua unidade", 'text-anchor="middle"'), in: { preset: "fade", at: 0.9, dur: 0.5, ease: "out" } },
      ] },
    ],
  };
}

function stepsSpec(i: TemplateInput): MotionSpec {
  const g = geometry(i.format);
  const { W, H, cx } = g;
  const cy = g.pick(900, 640, 560, 560);
  const bOff = g.short ? 300 : 330;
  const badge = (n: number) => `<circle cx="${cx}" cy="${cy - bOff}" r="58" fill="url(#or)"/>${TB(cx, cy - bOff + 28, 84, "#FFFFFF", String(n), 'text-anchor="middle"')}`;
  const caption = (a: string, b: string) => `${TB(cx, cy + 300, 110, "#FFFFFF", a, 'text-anchor="middle"')}${TB(cx, cy + 400, 110, OR, b, 'text-anchor="middle"')}`;
  const bill = `<g><rect x="${cx - 150}" y="${cy - 190}" width="300" height="380" rx="20" fill="#FFF8F2"/><rect x="${cx - 150}" y="${cy - 190}" width="300" height="22" rx="10" fill="#ff7300"/>${T(cx - 115, cy - 110, 40, 800, "#3d0b80", "CONTA")}${T(cx - 115, cy - 62, 40, 800, "#3d0b80", "DE LUZ")}<path d="M${cx - 115} ${cy - 10}H${cx + 115}M${cx - 115} ${cy + 30}H${cx + 60}M${cx - 115} ${cy + 70}H${cx + 95}" stroke="#D8C9E0" stroke-width="12" stroke-linecap="round"/></g>`;
  const chat = `<g><rect x="${cx - 260}" y="${cy - 170}" width="520" height="200" rx="44" fill="#FFFFFF"/><path d="M${cx - 150} ${cy + 28}L${cx - 190} ${cy + 90}L${cx - 90} ${cy + 28}Z" fill="#FFFFFF"/>${T(cx, cy - 58, 44, 700, "#3d0b80", "Oi! Sou a Ane.", 'text-anchor="middle"')}${T(cx, cy - 4, 38, 500, "#5A16A8", "Vamos ativar?", 'text-anchor="middle"')}</g>`;
  const check = `<g><circle cx="${cx}" cy="${cy}" r="170" fill="#22C55E"/><path d="M${cx - 80} ${cy}L${cx - 20} ${cy + 62}L${cx + 90} ${cy - 60}" fill="none" stroke="#FFFFFF" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  // No horizontal, a Ane acompanha os passos à direita (uma foto diferente por passo).
  const sideAne = (photo: string): MotionLayer[] => (g.wide ? [{ name: "Ane", svg: g.ane(photo, 0, 0, 0, 940).svg, in: { preset: "fade", at: 0, dur: 0.3, ease: "out" } }] : []);
  const step = (n: number, art: string, a: string, b: string, photo: string): MotionScene => ({
    name: `passo ${n}`, duration: 2.4, transition: "slide-left", layers: [
      { name: "logos", svg: g.logos() },
      ...sideAne(photo),
      { name: "número", svg: badge(n), origin: [cx, cy - bOff], in: { preset: "pop", at: 0.1, dur: 0.45, ease: "back" } },
      { name: "ícone", svg: art, origin: [cx, cy], in: { preset: "zoom-in", at: 0.25, dur: 0.55, ease: "back" }, loop: { kind: "float", period: 2, amount: 0.05, from: 0.8 } },
      { name: "texto", svg: caption(a, b), in: { preset: "slide-up", at: 0.45, dur: 0.5, ease: "out", distance: 60 } },
    ],
  });
  return {
    format: i.format, fps: 30, music: i.music ?? "mixkit-801", musicVolume: 0.5, background: partnerBackground(W, H),
    scenes: [
      { name: "abertura", duration: 2.4, transition: "fade", layers: [
        { name: "logos", svg: g.logos(), in: { preset: "fade", at: 0, dur: 0.4, ease: "out" } },
        ...sideAne("ane-rabo").map((l) => ({ ...l, in: { preset: "slide-left" as const, at: 0.3, dur: 0.8, ease: "out" as const, distance: 400 } })),
        { name: "título 1", svg: TB(cx, cy - 40, 140, "#FFFFFF", "Ativar é simples:", 'text-anchor="middle"'), in: { preset: "slide-up", at: 0.2, dur: 0.6, ease: "out", distance: 70 } },
        { name: "título 2", svg: TB(cx, cy + 110, 170, OR, "4 passos.", 'text-anchor="middle"'), in: { preset: "slide-up", at: 0.4, dur: 0.6, ease: "out", distance: 70 } },
      ] },
      step(1, qrIcon(cx - 150, cy - 150, 300), "Escaneie o QR", "na recepção", "ane-oculos-2"),
      step(2, chat, "Fale com", "a Ane", "ane-tras"),
      step(3, bill, "Envie sua", "conta de luz", "ane-coque-2"),
      { ...step(4, check, "Benefício", "ativado!", "ane-rabo"), transition: "fade" },
      { name: "fechamento", duration: 3, transition: "fade", layers: [
        { name: "logos", svg: g.logos() },
        { name: "Ane", svg: g.ane(i.photo ?? "ane-coque-2", 900, 640, 560, 980).svg, in: { preset: g.wide ? "slide-left" : "rise", at: 0, dur: 0.8, ease: "out", distance: 400 } },
        { name: "chamada", svg: pill(cx, g.pick(560, 340, 300, 440), 700, "ATIVE SEU BENEFÍCIO"), origin: [cx, g.pick(610, 390, 350, 490)], in: { preset: "pop", at: 0.5, dur: 0.5, ease: "back" }, loop: { kind: "pulse", period: 1.4, amount: 0.04, from: 1.2 } },
        ...(g.short || g.wide ? [{ name: "qr", svg: T(cx, g.pick(0, 0, 470, 610), 36, 700, "#FFFFFF", "QR Code na recepção da sua unidade", 'text-anchor="middle"'), in: { preset: "fade" as const, at: 0.9, dur: 0.5, ease: "out" as const } }] : []),
      ] },
    ],
  };
}

export function buildTemplate(template: MotionTemplate, input: TemplateInput): MotionSpec {
  if (template === "contador") return counterSpec(input);
  if (template === "passos") return stepsSpec(input);
  return ctaSpec(input);
}
