import { Resvg } from "@resvg/resvg-js";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, like, or } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { unitKitTemplates, unitMaterials, units } from "../drizzle/schema";
import { qrSvgGroup } from "./_core/qr";
import { adminProcedure, router } from "./_core/trpc";
import { BRAND_ASSETS, FONT_FILES } from "./agents/design/render";
import * as db from "./db";
import { storagePut } from "./storage";
import { unitKey } from "./_core/unitKey";
import { conn } from "./unitPortal";

// Mídia kit impresso das academias: 4 materiais desenhados do zero, com o QR code de cada unidade.
// A arte é um SVG (largura 1000 e altura na proporção exata do material); o QR entra como vetor.
// Saída por academia: PDF no tamanho real (cm) para a gráfica + uma prévia em JPG para o portal.

export const KIT_FORMATS = {
  display: { label: "Display", wCm: 21, hCm: 29.7, dpi: 300, layout: "chat" },
  banner: { label: "Banner", wCm: 90.02, hCm: 120.24, dpi: 120, layout: "impact" },
  panfleto: { label: "Panfleto", wCm: 37.31, hCm: 52.92, dpi: 150, layout: "voucher" },
  windbanner: { label: "Windbanner", wCm: 111.57, hCm: 156.9, dpi: 100, layout: "flag" },
} as const;
export type KitFormat = keyof typeof KIT_FORMATS;
const formatSchema = z.enum(Object.keys(KIT_FORMATS) as [KitFormat, ...KitFormat[]]);

const DISCLAIMER = "*Até 35% de desconto para PJ e até 15% para PF na fatura de energia, sujeito à análise da fatura e às condições do benefício.";

/** Textos padrão de cada material (todos editáveis na tela). */
export const KIT_DEFAULTS: Record<KitFormat, Record<string, string>> = {
  // Display (balcão, lido de perto): conversa com a Ane.
  display: {
    eyebrow: "ALUNO ALLP FIT,",
    headline1: "VOCÊ JÁ TEM DESCONTO",
    headline2: "NA CONTA DE LUZ.",
    stickerTop: "ATÉ",
    stickerMain: "15%*",
    stickerBottom: "DE DESCONTO",
    chatName: "Ane · Alle Energia",
    chat1: "Oi! Você é aluno Allp Fit?",
    chat2: "Sou sim!",
    chat3: "Então você já tem direito ao desconto na conta de luz. Vamos ativar?",
    benefit1: "Sem custo",
    benefit2: "Sem obra",
    benefit3: "Sem fidelidade",
    qrLabel: "ESCANEIE E ATIVE",
    qrSub: "Aponte a câmera e fale com a Ane",
    disclaimer: DISCLAIMER,
  },
  // Banner (parede, visto de longe): frase grande, QR gigante e a Ane.
  banner: {
    headline1: "SEU DESCONTO",
    headline2: "JÁ ESTÁ AQUI.",
    sub: "Só falta ativar pelo QR code.",
    offer: "ATÉ 15%* DE DESCONTO TODO MÊS",
    qrLabel: "ATIVE AGORA",
    qrSub: "Aponte a câmera do celular",
    bubble: "Fala comigo!",
    benefits: "SEM CUSTO  ·  SEM OBRA  ·  SEM FIDELIDADE",
    disclaimer: DISCLAIMER,
  },
  // Panfleto (na mão, guardado): vale-desconto com canhoto de resgate.
  panfleto: {
    eyebrow: "ALUNO ALLP FIT",
    headline1: "SEU DESCONTO JÁ ESTÁ",
    headline2: "SEPARADO. É SÓ RESGATAR.",
    voucherTitle: "VALE-DESCONTO NA CONTA DE LUZ",
    voucherKicker: "ATÉ",
    voucherValue: "15%*",
    voucherSub: "de desconto todo mês",
    stubTitle: "RESGATE AQUI",
    stubText: "Aponte a câmera e fale com a Ane no WhatsApp da Alle Energia.",
    step1: "Escaneie o QR",
    step2: "Fale com a Ane",
    step3: "Envie sua conta de luz",
    benefits: "SEM CUSTO  ·  SEM OBRA  ·  SEM FIDELIDADE",
    disclaimer: DISCLAIMER,
  },
  windbanner: { wbLine1: "Desconto na", wbLine2: "conta de luz" },
};
export type KitFields = Record<string, string>;

/** Textos padrão dos cartazes das versões anteriores (para comparar). */
const ORIGINAL_DEFAULTS: KitFields = {
  kicker: "ATÉ",
  percent: "15%",
  line1: "de desconto na sua",
  line2: "CONTA DE LUZ",
  benefit1: "Sem custo",
  benefit2: "Sem obra",
  benefit3: "Sem fidelidade",
  benefit4: "Sem placa solar",
  audience: "Exclusivo para alunos Allp Fit",
  qrTitle: "Aponte a câmera",
  qrText: "e fale com a Ane no WhatsApp",
  footer: "@alleenergia  ·  alleenergia.com",
  disclaimer: "*Até 35% de desconto para PJ e até 15% para PF na fatura de energia, sujeito à análise da fatura e às condições do benefício.",
};
const ACTIVATION_DEFAULTS: KitFields = {
  eyebrow: "ALUNO ALLP FIT,",
  headline1: "VOCÊ JÁ TEM",
  headline2: "DESCONTO NA",
  headline3: "CONTA DE LUZ.",
  highlight: "Só falta ativar!",
  offer: "ATÉ 15%* DE DESCONTO TODO MÊS",
  stepsTitle: "ATIVE EM 3 PASSOS",
  step1: "Aponte a câmera|para o QR code ao lado",
  step2: "Fale com a Ane|no WhatsApp da Alle Energia",
  step3: "Envie sua conta de luz|e a gente analisa pra você",
  qrLabel: "ATIVE AGORA",
  qrSub: "Leia com a câmera do celular",
  benefit1: "Sem custo",
  benefit2: "Sem obra",
  benefit3: "Sem fidelidade",
  disclaimer: "*Até 35% de desconto para PJ e até 15% para PF na fatura de energia, sujeito à análise da fatura e às condições do benefício.",
};

type Variant = { id: string; label: string; note: string; defaults: KitFields; draw: (H: number, f: KitFields) => { svg: string; slots: Slot[] } };
/** Designs de cada material: o primeiro é o mais novo. A equipe escolhe qual vai para as academias. */
export function variantsOf(format: KitFormat): Variant[] {
  const older: Variant[] = [
    { id: "ativacao", label: "Ativação (2ª versão)", note: "Topo roxo com a mensagem e a Ane, base clara com os 3 passos e o QR.", defaults: ACTIVATION_DEFAULTS, draw: activationSvg },
    { id: "original", label: "Primeira versão", note: "Oferta grande, Ane com a fatura, benefícios e faixa “exclusivo”.", defaults: ORIGINAL_DEFAULTS, draw: originalSvg },
  ];
  switch (format) {
    case "display": return [{ id: "conversa", label: "Conversa com a Ane (nova)", note: "Balões de conversa, selo da oferta e a faixa roxa com o QR.", defaults: KIT_DEFAULTS.display, draw: chatSvg }, ...older];
    case "banner": return [{ id: "impacto", label: "Impacto (nova)", note: "Frase grande para ler de longe, QR gigante e a Ane com balão.", defaults: KIT_DEFAULTS.banner, draw: impactSvg }, ...older];
    case "panfleto": return [{ id: "vale", label: "Vale-desconto (nova)", note: "Cupom com picote e canhoto de resgate com o QR.", defaults: KIT_DEFAULTS.panfleto, draw: voucherSvg }, ...older];
    default: return [{ id: "bandeira", label: "Bandeira", note: "As duas faces da bandeira lado a lado no molde.", defaults: KIT_DEFAULTS.windbanner, draw: flagSvg }];
  }
}

/** O que fica salvo por material: o design escolhido, os textos de cada design e as artes editadas à mão. */
export type KitState = { variant: string; texts: Record<string, KitFields>; custom: Record<string, string> };
const fieldsSchema = z.record(z.string().max(40), z.string().max(240));

const W = 1000;
const heightOf = (f: KitFormat) => Math.round((W * KIT_FORMATS[f].hCm) / KIT_FORMATS[f].wCm * 10) / 10;
const pxOf = (f: KitFormat) => {
  const { wCm, hCm, dpi } = KIT_FORMATS[f];
  return { w: Math.round((wCm / 2.54) * dpi), h: Math.round((hCm / 2.54) * dpi) };
};

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const T = (x: number, y: number, size: number, weight: number, fill: string, text: string, anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}" font-family="Montserrat" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(text)}</text>`;

/** Quebra um texto em linhas de até `max` caracteres (por palavras). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

type Slot = { x: number; y: number; size: number };

// ── Peças comuns ────────────────────────────────────────────────────────────
const DEFS = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#8b3fd2"/><stop offset="1" stop-color="#5e1ca3"/></linearGradient>
    <linearGradient id="or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a1f"/><stop offset="1" stop-color="#ff6400"/></linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.3" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.15"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  </defs>`;
const svgOpen = (H: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${DEFS}`;
const check = (cx: number, cy: number, r: number, fill = "#ff7300") =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/><path d="M${cx - r * 0.45} ${cy} l${r * 0.3} ${r * 0.3} l${r * 0.55} ${-r * 0.6}" fill="none" stroke="#fff" stroke-width="${r * 0.26}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Largura aproximada de um texto em Montserrat (para dimensionar pílulas e balões). */
const textW = (t: string, size: number, weight = 700) => t.length * size * (weight >= 800 ? 0.68 : 0.58);
const discLines = (t: string, max: number, x: number, yLast: number, size: number, fill: string, anchor = "start") => {
  const lines = wrap(t, max);
  return lines.map((l, i) => T(x, yLast - (lines.length - 1 - i) * size * 1.35, size, 500, fill, l, anchor)).join("");
};

/** Display (A4, balcão): conversa com a Ane em balões, selo da oferta e faixa roxa com o QR. */
function chatSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
  const Z = H - 500; // início da faixa roxa
  const bubble = (side: "ane" | "aluno", text: string, y: number) => {
    const lines = wrap(text, 40);
    const w = Math.min(660, Math.max(...lines.map((l) => textW(l, 27, 600))) + 56);
    const h = 30 + lines.length * 38;
    const x = side === "ane" ? 64 : W - 64 - w;
    const fill = side === "ane" ? "#ffffff" : "url(#or)";
    const color = side === "ane" ? "#2a0a3d" : "#ffffff";
    const tail = side === "ane" ? `M${x + 26} ${y + h - 2} l-22 22 l44 -8 Z` : `M${x + w - 26} ${y + h - 2} l22 22 l-44 -8 Z`;
    return { h, svg: `<path d="${tail}" fill="${side === "ane" ? "#ffffff" : "#ff7300"}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${fill}" ${side === "ane" ? 'stroke="#e7dcf3" stroke-width="2"' : ""}/>`
      + lines.map((l, i) => T(x + 28, y + 46 + i * 38, 27, 600, color, l)).join("") };
  };
  let y = 498;
  const chat = [["ane", f.chat1], ["aluno", f.chat2], ["ane", f.chat3]].filter(([, t]) => t).map(([side, t]) => {
    const b = bubble(side as "ane" | "aluno", t, y);
    y += b.h + 28;
    return b.svg;
  }).join("");
  const benefits = [f.benefit1, f.benefit2, f.benefit3].filter(Boolean);
  let bx = 64;
  const chips = benefits.map((b) => {
    const w = textW(b.toUpperCase(), 20, 800) + 72;
    const out = `<rect x="${bx}" y="${y + 6}" width="${w}" height="48" rx="24" fill="#ffffff" stroke="#7B2FBE" stroke-opacity="0.25" stroke-width="2"/>${check(bx + 26, y + 30, 13)}${T(bx + 48, y + 37, 20, 800, "#44015e", b.toUpperCase())}`;
    bx += w + 12;
    return out;
  }).join("");
  const qr = { x: 92, y: Z + 112, size: 246 };
  const aneH = 560, aneW = (aneH * 742) / 1020;
  const svg = `${svgOpen(H)}
  <rect width="${W}" height="${H}" fill="#FFF8F2"/>
  <circle cx="${W + 40}" cy="-40" r="330" fill="#7B2FBE" opacity="0.06"/>
  <image href="alle:logo" x="64" y="56" width="218" height="64"/>
  <rect x="300" y="66" width="2" height="44" fill="#44015e" opacity="0.2"/>
  <image href="alle:allpfit-roxo" x="320" y="66" width="208" height="45"/>
  <g transform="translate(${W - 150} 150) rotate(-10)">
    <circle r="104" fill="url(#or)"/><circle r="90" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="3" stroke-dasharray="4 7"/>
    ${T(0, -34, 24, 800, "#ffffff", f.stickerTop, "middle")}${T(0, 24, 62, 900, "#ffffff", f.stickerMain, "middle")}${T(0, 56, 17, 800, "#ffffff", f.stickerBottom, "middle")}
  </g>
  ${T(64, 270, 28, 800, "#ff7300", f.eyebrow, "start", 'letter-spacing="2"')}
  ${T(62, 340, 54, 900, "#44015e", f.headline1)}
  ${T(62, 402, 54, 900, "#44015e", f.headline2)}
  <circle cx="74" cy="${464}" r="8" fill="#22c55e"/>${T(92, 471, 20, 700, "#6b5a78", f.chatName)}
  ${chat}
  ${chips}
  <path d="M0 ${Z + 40} Q0 ${Z} 40 ${Z} L${W - 40} ${Z} Q${W} ${Z} ${W} ${Z + 40} L${W} ${H} L0 ${H} Z" fill="url(#bg)"/>
  <rect x="0" y="${Z}" width="${W}" height="${H - Z}" fill="url(#glow)"/>
  <image href="alle:raio-mono" x="${W - 360}" y="${Z + 10}" width="300" height="480" opacity="0.07"/>
  ${T(64, Z + 66, 32, 900, "#ffffff", f.qrLabel, "start", 'letter-spacing="1"')}
  <rect x="${qr.x - 28}" y="${qr.y - 22}" width="${qr.size + 56}" height="${qr.size + 44}" rx="28" fill="#ffffff"/>
  ${T(64, qr.y + qr.size + 60, 21, 700, "#ffffff", f.qrSub)}
  <path d="M${qr.x + qr.size + 52} ${qr.y + qr.size / 2} q60 -10 90 -90" fill="none" stroke="#ff8a1f" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 12"/>
  ${discLines(f.disclaimer, 64, 64, H - 26, 12.5, "#e9dcf7")}
  <image href="alle:ane-ombro" x="${W - aneW + 6}" y="${H - aneH}" width="${aneW}" height="${aneH}"/>
</svg>`;
  return { svg, slots: [qr] };
}

/** Banner (90×120, parede): frase gigante, QR enorme com "ATIVE AGORA" e a Ane grande com balão. */
function impactSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
  const card = { x: 64, y: 586, w: 430 };
  const qrSize = 350;
  const qr = { x: card.x + (card.w - qrSize) / 2, y: card.y + 96, size: qrSize };
  const cardH = 96 + qrSize + 92;
  const aneH = Math.min(H - 600, 680), aneW = (aneH * 742) / 1020;
  const aneX = W - aneW + 20, aneY = H - aneH;
  const bw = textW(f.bubble, 30, 800) + 60;
  const offerW = textW(f.offer, 22, 800) + 56;
  const svg = `${svgOpen(H)}
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <path d="M${W} ${H * 0.36} C${W - 260} ${H * 0.42} ${W - 330} ${H * 0.7} ${W - 250} ${H} L${W} ${H} Z" fill="url(#or)"/>
  <image href="alle:raio-mono" x="-120" y="120" width="520" height="830" opacity="0.06"/>
  <image href="alle:logo-branco" x="64" y="58" width="238" height="70"/>
  <rect x="322" y="70" width="2" height="48" fill="#ffffff" opacity="0.4"/>
  <image href="alle:allpfit-branco" x="344" y="70" width="226" height="49"/>
  ${T(60, 286, 92, 900, "#ffffff", f.headline1)}
  ${T(60, 384, 92, 900, "#ff8a1f", f.headline2)}
  ${T(64, 452, 36, 700, "#ffffff", f.sub)}
  <rect x="64" y="486" width="${offerW}" height="52" rx="26" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="2.5"/>
  ${T(92, 520, 22, 800, "#ffffff", f.offer, "start", 'letter-spacing="0.5"')}
  <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${cardH}" rx="36" fill="url(#or)"/>
  ${T(card.x + card.w / 2, card.y + 66, 46, 900, "#ffffff", f.qrLabel, "middle", 'letter-spacing="1"')}
  <rect x="${qr.x - 18}" y="${qr.y - 18}" width="${qr.size + 36}" height="${qr.size + 36}" rx="22" fill="#ffffff"/>
  ${T(card.x + card.w / 2, card.y + cardH - 30, 22, 700, "#ffffff", f.qrSub, "middle")}
  ${wrap(f.benefits, 24).map((l, i) => T(64, card.y + cardH + 52 + i * 30, 20, 800, "#ffffff", l, "start", 'letter-spacing="0.5"')).join("")}
  ${discLines(f.disclaimer, 56, 64, H - 34, 13, "#e9dcf7")}
  <image href="alle:ane-ombro" x="${aneX}" y="${aneY}" width="${aneW}" height="${aneH}"/>
  <g transform="translate(${Math.min(aneX + aneW * 0.66, W - 40 - bw / 2)} ${aneY - 14})">
    <rect x="${-bw / 2}" y="-74" width="${bw}" height="70" rx="35" fill="#ffffff"/>
    <path d="M-34 -10 l-6 36 l34 -36 Z" fill="#ffffff"/>
    ${T(0, -28, 30, 800, "#7B2FBE", f.bubble, "middle")}
  </g>
</svg>`;
  return { svg, slots: [qr] };
}

/** Panfleto (37×53): vale-desconto com picote e canhoto de resgate com o QR, mais os 3 passos. */
function voucherSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
  const vx = 72, vw = W - 144, vy = 470, perfY = 806, vb = 1140;
  const qr = { x: vx + 64, y: perfY + 48, size: 270 };
  const steps = [f.step1, f.step2, f.step3];
  const colW = (W - 144) / 3;
  const stepY = vb + 66;
  const stepSvg = steps.map((t, i) => {
    const cx = 72 + colW * i + colW / 2;
    return `<circle cx="${cx}" cy="${stepY}" r="30" fill="#7B2FBE"/>${T(cx, stepY + 11, 30, 900, "#ffffff", String(i + 1), "middle")}`
      + T(cx, stepY + 70, 23, 800, "#2a0a3d", t, "middle")
      + (i < 2 ? `<path d="M${cx + 52} ${stepY} h${colW - 104}" stroke="#ff7300" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>` : "");
  }).join("");
  const stubLines = wrap(f.stubText, 26);
  const svg = `${svgOpen(H)}
  <rect width="${W}" height="${H}" fill="#FFF8F2"/>
  <path d="M0 0 H${W} V300 C${W * 0.7} 360 ${W * 0.3} 260 0 330 Z" fill="url(#bg)"/>
  <image href="alle:raio-mono" x="${W - 330}" y="-60" width="300" height="480" opacity="0.08"/>
  <image href="alle:logo-branco" x="72" y="56" width="218" height="64"/>
  <rect x="308" y="66" width="2" height="44" fill="#ffffff" opacity="0.4"/>
  <image href="alle:allpfit-branco" x="328" y="66" width="208" height="45"/>
  ${T(72, 196, 26, 800, "#ff8a1f", f.eyebrow, "start", 'letter-spacing="3"')}
  ${T(W / 2, 400, 46, 900, "#44015e", f.headline1, "middle")}
  ${T(W / 2, 452, 46, 900, "#ff7300", f.headline2, "middle")}
  <rect x="${vx}" y="${vy + 12}" width="${vw}" height="${vb - vy}" rx="36" fill="#7B2FBE" opacity="0.12"/>
  <rect x="${vx}" y="${vy}" width="${vw}" height="${vb - vy}" rx="36" fill="#ffffff"/>
  <rect x="${vx + 18}" y="${vy + 18}" width="${vw - 36}" height="${perfY - vy - 36}" rx="24" fill="none" stroke="#7B2FBE" stroke-opacity="0.35" stroke-width="3" stroke-dasharray="10 9"/>
  ${T(W / 2, vy + 86, 25, 800, "#7B2FBE", f.voucherTitle, "middle", 'letter-spacing="2"')}
  ${T(W / 2 - 230, vy + 196, 44, 800, "#44015e", f.voucherKicker, "middle")}
  ${T(W / 2 + 40, vy + 252, 200, 900, "#ff7300", f.voucherValue, "middle", 'letter-spacing="-4"')}
  ${T(W / 2, vy + 306, 32, 600, "#2a0a3d", f.voucherSub, "middle")}
  <line x1="${vx + 40}" y1="${perfY}" x2="${vx + vw - 40}" y2="${perfY}" stroke="#7B2FBE" stroke-opacity="0.45" stroke-width="3" stroke-dasharray="14 10"/>
  <circle cx="${vx}" cy="${perfY}" r="28" fill="#FFF8F2"/><circle cx="${vx + vw}" cy="${perfY}" r="28" fill="#FFF8F2"/>
  <rect x="${qr.x - 16}" y="${qr.y - 16}" width="${qr.size + 32}" height="${qr.size + 32}" rx="20" fill="#ffffff" stroke="#ff7300" stroke-width="5"/>
  ${T(qr.x + qr.size + 64, perfY + 110, 40, 900, "#7B2FBE", f.stubTitle)}
  <path d="M${qr.x + qr.size + 64} ${perfY + 136} h80" stroke="#ff7300" stroke-width="6" stroke-linecap="round"/>
  ${stubLines.map((l, i) => T(qr.x + qr.size + 64, perfY + 190 + i * 34, 24, 600, "#2a0a3d", l)).join("")}
  ${stepSvg}
  <line x1="72" y1="${H - 112}" x2="${W - 72}" y2="${H - 112}" stroke="#2a0a3d" stroke-opacity="0.08" stroke-width="2"/>
  ${T(W / 2, H - 70, 20, 800, "#44015e", f.benefits, "middle", 'letter-spacing="0.5"')}
  ${discLines(f.disclaimer, 120, W / 2, H - 28, 12.5, "#6b5a78", "middle")}
</svg>`;
  return { svg, slots: [qr] };
}

/** Cartaz (display, banner e panfleto): fundo roxo, oferta grande, Ane com a fatura, benefícios e QR. */
function originalSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
  const F = 96; // rodapé
  const pillH = 64, pillY = H - F - 58 - pillH;
  const panelH = 400, panelTop = pillY - 24 - panelH;
  const l2Y = panelTop - 56, l1Y = l2Y - 64, pctY = l1Y - 40, kickY = pctY - 176;
  const qr = { x: 92, y: panelTop + 46, size: 236 };
  const photoH = 640, photoW = (photoH * 900) / 1297;
  const benefits = [f.benefit1, f.benefit2, f.benefit3, f.benefit4];
  const check = (cx: number, cy: number) =>
    `<circle cx="${cx}" cy="${cy}" r="30" fill="#ff7300"/><path d="M${cx - 13} ${cy + 1} l9 9 l17 -19" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  const benefitSvg = benefits.map((b, i) => {
    const cx = i % 2 === 0 ? 420 : 700, cy = panelTop + (i < 2 ? 130 : 262);
    const [first, ...rest] = b.trim().split(/\s+/);
    return check(cx, cy) + T(cx + 44, cy - 6, 22, 700, "#ff7300", first.toUpperCase()) + T(cx + 44, cy + 24, 26, 900, "#44015e", rest.join(" ").toUpperCase());
  }).join("");
  const disc = wrap(f.disclaimer, 118);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#8a3bd0"/><stop offset="0.55" stop-color="#7B2FBE"/><stop offset="1" stop-color="#5B1D9A"/></linearGradient>
    <linearGradient id="or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a1f"/><stop offset="1" stop-color="#ff6a00"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <path d="M${W} 0 L${W} ${H * 0.34} C${W - 140} ${H * 0.27} ${W - 230} ${H * 0.13} ${W - 250} 0 Z" fill="url(#or)" opacity="0.92"/>
  <path d="M${W} 0 L${W} ${H * 0.2} C${W - 70} ${H * 0.16} ${W - 120} ${H * 0.08} ${W - 130} 0 Z" fill="#ffffff" opacity="0.10"/>
  <image href="alle:raio-mono" x="-120" y="${kickY - 120}" width="430" height="686" opacity="0.07"/>
  <image href="alle:logo-branco" x="64" y="62" width="238" height="70"/>
  ${T(336, 112, 40, 700, "#ffffff", "+", "middle")}
  <image href="alle:allpfit-branco" x="372" y="72" width="236" height="51"/>
  ${T(64, kickY, 46, 800, "#ffffff", f.kicker)}
  <text x="64" y="${pctY}" font-family="Montserrat" font-size="230" font-weight="900" fill="#ff7300" letter-spacing="-6">${esc(f.percent)}<tspan font-size="96" dy="-118">*</tspan></text>
  ${T(66, l1Y, 40, 600, "#ffffff", f.line1)}
  ${T(64, l2Y, 58, 900, "#ffffff", f.line2)}
  <rect x="40" y="${panelTop}" width="${W - 80}" height="${panelH}" rx="40" fill="#FFF8F2"/>
  <rect x="${qr.x - 16}" y="${qr.y - 16}" width="${qr.size + 32}" height="${qr.size + 32}" rx="26" fill="#ffffff" stroke="#ff7300" stroke-width="6"/>
  ${T(qr.x + qr.size / 2, panelTop + 344, 26, 800, "#44015e", f.qrTitle, "middle")}
  ${T(qr.x + qr.size / 2, panelTop + 374, 19, 500, "#5B1D9A", f.qrText, "middle")}
  <line x1="376" y1="${panelTop + 70}" x2="376" y2="${panelTop + 340}" stroke="#7B2FBE" stroke-opacity="0.15" stroke-width="3"/>
  ${benefitSvg}
  <image href="alle:ane-tablet" x="${W - photoW + 10}" y="${panelTop + 62 - photoH}" width="${photoW}" height="${photoH}" preserveAspectRatio="xMidYMax meet"/>
  <rect x="40" y="${pillY}" width="${W - 80}" height="${pillH}" rx="${pillH / 2}" fill="url(#or)"/>
  ${T(W / 2, pillY + 42, 28, 800, "#ffffff", f.audience.toUpperCase(), "middle", 'letter-spacing="1"')}
  ${disc.map((l, i) => T(W / 2, H - F - 36 + i * 19 - (disc.length - 2) * 19, 14, 500, "#ffffff", l, "middle", 'fill-opacity="0.78"')).join("")}
  <rect x="0" y="${H - F}" width="${W}" height="${F}" fill="#44015e"/>
  <image href="alle:raio" x="56" y="${H - F + 20}" width="35" height="56"/>
  ${T(W / 2, H - F / 2 + 10, 28, 700, "#ffffff", f.footer, "middle")}
</svg>`;
  return { svg, slots: [qr] };
}

/**
 * Cartaz (display, banner e panfleto), focado em ativação: o aluno já tem o desconto, falta ativar.
 * Topo roxo com a mensagem e a Ane (recortada na borda da faixa, sem invadir o resto);
 * base clara com os 3 passos e o QR em destaque ("Ative agora").
 */
function activationSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
  const Z = Math.round(H - 640); // divisa: a base clara tem a mesma altura em todos os formatos
  const hl = 58, hlGap = 66;
  const h3Y = Z - 196, h2Y = h3Y - hlGap, h1Y = h2Y - hlGap, eyeY = h1Y - 74;
  const hiY = h3Y + 34, offerY = hiY + 92;
  // Ane: caixa à direita, apoiada exatamente na divisa.
  const aneW = 470, aneH = Math.min(Z - 130, 560);
  // QR em destaque na base, à direita.
  const bY = H - 100; // linha dos benefícios
  const card = { x: 584, y: Z + 52, w: 352, h: bY - 64 - (Z + 52) };
  const qrSize = Math.min(card.w - 92, card.h - 168);
  const qr = { x: card.x + (card.w - qrSize) / 2, y: card.y + 94, size: qrSize };
  const steps = [f.step1, f.step2, f.step3].map((t) => t.split("|"));
  const stepSvg = steps.map(([title, sub], i) => {
    const y = Z + 162 + i * 104;
    return `<circle cx="96" cy="${y}" r="30" fill="#7B2FBE"/>${T(96, y + 11, 30, 900, "#ffffff", String(i + 1), "middle")}`
      + T(144, y - 4, 29, 800, "#2a0a3d", title ?? "") + T(144, y + 28, 21, 500, "#6b5a78", sub ?? "")
      + (i < steps.length - 1 ? `<line x1="96" y1="${y + 34}" x2="96" y2="${y + 70}" stroke="#7B2FBE" stroke-opacity="0.25" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round"/>` : "");
  }).join("");
  const benefits = [f.benefit1, f.benefit2, f.benefit3].filter(Boolean);
  const bw = (W - 128) / benefits.length;
  const benefitSvg = benefits.map((b, i) => {
    const cx = 64 + bw * i + bw / 2;
    return `<circle cx="${cx - 92}" cy="${bY - 9}" r="15" fill="#ff7300"/><path d="M${cx - 99} ${bY - 9} l5 5 l9 -10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
      + T(cx - 68, bY, 24, 800, "#2a0a3d", b.toUpperCase());
  }).join("");
  const disc = wrap(f.disclaimer, 120);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#8b3fd2"/><stop offset="1" stop-color="#5e1ca3"/></linearGradient>
    <linearGradient id="or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a1f"/><stop offset="1" stop-color="#ff6400"/></linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.62" r="0.55"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <clipPath id="top"><rect width="${W}" height="${Z}"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="#FFF8F2"/>
  <g clip-path="url(#top)">
    <rect width="${W}" height="${Z}" fill="url(#bg)"/>
    <rect width="${W}" height="${Z}" fill="url(#glow)"/>
    <image href="alle:raio-mono" x="610" y="${Z - 700}" width="470" height="750" opacity="0.08"/>
    <circle cx="${W - 235}" cy="${Z - 250}" r="250" fill="url(#or)" opacity="0.95"/>
    <image href="alle:ane-solto" x="${W - aneW - 10}" y="${Z - aneH}" width="${aneW}" height="${aneH}" preserveAspectRatio="xMidYMax meet"/>
  </g>
  <image href="alle:logo-branco" x="64" y="56" width="218" height="64"/>
  <rect x="300" y="66" width="2" height="44" fill="#ffffff" opacity="0.4"/>
  <image href="alle:allpfit-branco" x="320" y="66" width="208" height="45"/>
  ${T(64, eyeY, 30, 800, "#ff8a1f", f.eyebrow, "start", 'letter-spacing="2"')}
  ${T(62, h1Y, hl, 900, "#ffffff", f.headline1)}
  ${T(62, h2Y, hl, 900, "#ffffff", f.headline2)}
  ${T(62, h3Y, hl, 900, "#ffffff", f.headline3)}
  <rect x="58" y="${hiY}" width="${Math.min(470, 40 + f.highlight.length * 23)}" height="70" rx="14" fill="url(#or)"/>
  ${T(78, hiY + 48, 40, 900, "#ffffff", f.highlight)}
  <rect x="58" y="${offerY}" width="${Math.min(480, 40 + f.offer.length * 13.4)}" height="46" rx="23" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
  ${T(78, offerY + 31, 21, 700, "#ffffff", f.offer, "start", 'letter-spacing="0.5"')}
  ${T(64, Z + 86, 26, 900, "#7B2FBE", f.stepsTitle, "start", 'letter-spacing="2"')}
  <rect x="64" y="${Z + 102}" width="70" height="5" rx="2.5" fill="#ff7300"/>
  ${stepSvg}
  <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="32" fill="url(#or)"/>
  ${T(card.x + card.w / 2, card.y + 62, 38, 900, "#ffffff", f.qrLabel, "middle", 'letter-spacing="1"')}
  <rect x="${qr.x - 16}" y="${qr.y - 16}" width="${qr.size + 32}" height="${qr.size + 32}" rx="20" fill="#ffffff"/>
  ${T(card.x + card.w / 2, card.y + card.h - 24, 19, 700, "#ffffff", f.qrSub, "middle")}
  <line x1="64" y1="${bY - 44}" x2="${W - 64}" y2="${bY - 44}" stroke="#2a0a3d" stroke-opacity="0.08" stroke-width="2"/>
  ${benefitSvg}
  ${disc.map((l, i) => T(W / 2, H - 40 + i * 18 - (disc.length - 2) * 18, 13.5, 500, "#6b5a78", l, "middle")).join("")}
</svg>`;
  return { svg, slots: [qr] };
}

/** Windbanner: molde com as duas faces da bandeira lado a lado. */
function flagSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
  const pw = 470, xs = [20, 510];
  const slots: Slot[] = [];
  const panel = (x0: number) => {
    const cx = x0 + pw / 2;
    const card = { x: cx - 112, y: H - 268, size: 224 };
    const slot = { x: card.x + 16, y: card.y + 16, size: card.size - 32 };
    slots.push(slot);
    const shape = `M${x0} ${H - 20} L${x0} 300 C${x0} 130 ${x0 + 100} 40 ${x0 + 235} 40 C${x0 + 370} 40 ${x0 + pw} 130 ${x0 + pw} 300 L${x0 + pw} ${H - 20} Z`;
    return `<clipPath id="flag${x0}"><path d="${shape}"/></clipPath>
    <g clip-path="url(#flag${x0})">
      <rect x="${x0}" y="0" width="${pw}" height="${H}" fill="url(#bgf)"/>
      <path d="M${x0 + pw} ${H * 0.62} C${x0 + 300} ${H * 0.7} ${x0 + 140} ${H * 0.8} ${x0} ${H * 0.83} L${x0} ${H} L${x0 + pw} ${H} Z" fill="url(#orf)" opacity="0.95"/>
      <image href="alle:raio-mono" x="${x0 + 90}" y="${H * 0.2}" width="420" height="670" opacity="0.06"/>
    </g>
    <image href="alle:allpfit-branco" x="${cx - 140}" y="150" width="280" height="60"/>
    <image href="alle:logo-branco" x="-380" y="-112" width="760" height="223" transform="translate(${cx} 640) rotate(-90)"/>
    ${T(cx, H - 340, 38, 600, "#ffffff", f.wbLine1, "middle")}
    ${T(cx, H - 292, 42, 900, "#ffffff", f.wbLine2.toUpperCase(), "middle")}
    <rect x="${card.x}" y="${card.y}" width="${card.size}" height="${card.size}" rx="24" fill="#ffffff"/>`;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bgf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a3bd0"/><stop offset="1" stop-color="#5B1D9A"/></linearGradient>
    <linearGradient id="orf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a1f"/><stop offset="1" stop-color="#ff6a00"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${xs.map(panel).join("")}
</svg>`;
  return { svg, slots };
}

// ── Design escolhido, textos e arte editada à mão ───────────────────────────
const pick = (defaults: Record<string, string>, saved?: Record<string, unknown> | null) =>
  Object.fromEntries(Object.keys(defaults).map((k) => [k, typeof saved?.[k] === "string" ? (saved[k] as string) : defaults[k]]));

/** Lê o que está salvo (ou o padrão) de um material. */
function stateFrom(format: KitFormat, raw: unknown): KitState {
  const vs = variantsOf(format);
  const r = (raw ?? {}) as { variant?: string; texts?: Record<string, Record<string, unknown>>; custom?: Record<string, string> };
  const variant = vs.some((v) => v.id === r.variant) ? r.variant! : vs[0].id;
  const texts = Object.fromEntries(vs.map((v) => [v.id, pick(v.defaults, r.texts?.[v.id])]));
  const custom = Object.fromEntries(Object.entries(r.custom ?? {}).filter(([k, v]) => vs.some((x) => x.id === k) && typeof v === "string"));
  return { variant, texts, custom };
}

const num = (v: string | undefined, d = 0) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`))?.[1];

/** Espaço do QR numa arte editada: grupos data-qr-slot (o editor move com transform="matrix(...)"). */
function slotsOf(svg: string): Slot[] {
  const out: Slot[] = [];
  for (const m of svg.matchAll(/<g\b([^>]*\bdata-qr-slot\b[^>]*)>([\s\S]*?)<\/g>/g)) {
    const rect = m[2].match(/<rect\b[^>]*>/)?.[0];
    if (!rect) continue;
    const x = num(attr(rect, "x")), y = num(attr(rect, "y")), w = num(attr(rect, "width")), h = num(attr(rect, "height"));
    const t = attr(`<g ${m[1]}>`, "transform") ?? "";
    let [a, b, c, d, e, f] = [1, 0, 0, 1, 0, 0];
    const mat = t.match(/matrix\(([^)]+)\)/), tr = t.match(/translate\(([^)]+)\)/), sc = t.match(/scale\(([^)]+)\)/);
    if (mat) [a, b, c, d, e, f] = mat[1].split(/[\s,]+/).map(Number);
    else { if (tr) { const [tx, ty = 0] = tr[1].split(/[\s,]+/).map(Number); e = tx; f = ty; } if (sc) { const [sx, sy] = sc[1].split(/[\s,]+/).map(Number); a = sx; d = sy ?? sx; } }
    const size = Math.min(Math.abs(a * w), Math.abs(d * h));
    out.push({ x: a * x + c * y + e, y: b * x + d * y + f, size });
  }
  return out;
}
const stripSlots = (svg: string) => svg.replace(/<g\b[^>]*\bdata-qr-slot\b[^>]*>[\s\S]*?<\/g>/g, "");

/** Desenho de "QR aqui" (marcado para o editor e para a geração encontrarem o espaço do QR). */
const placeholderQr = (s: Slot) =>
  `<g data-qr-slot="1"><rect x="${s.x}" y="${s.y}" width="${s.size}" height="${s.size}" fill="#f1e9fb"/>` +
  T(s.x + s.size / 2, s.y + s.size / 2 - 4, s.size * 0.1, 800, "#7B2FBE", "QR da", "middle") +
  T(s.x + s.size / 2, s.y + s.size / 2 + s.size * 0.12, s.size * 0.1, 800, "#7B2FBE", "academia", "middle") + `</g>`;

/** Arte de um design: a editada à mão, se houver; senão o modelo com os textos. */
function drawVariant(format: KitFormat, state: KitState, variantId = state.variant): { svg: string; slots: Slot[]; custom: boolean } {
  const custom = state.custom[variantId];
  if (custom) return { svg: stripSlots(custom), slots: slotsOf(custom), custom: true };
  const v = variantsOf(format).find((x) => x.id === variantId) ?? variantsOf(format)[0];
  return { ...v.draw(heightOf(format), { ...v.defaults, ...state.texts[v.id] }), custom: false };
}

/** SVG para abrir no editor (com o espaço do QR marcado). */
function editableSvg(format: KitFormat, state: KitState, variantId: string) {
  if (state.custom[variantId]) return state.custom[variantId];
  const { svg, slots } = drawVariant(format, state, variantId);
  return svg.replace("</svg>", `${slots.map(placeholderQr).join("")}</svg>`);
}

/** Limpa o SVG salvo do editor: sem script/eventos; imagens só da marca, data: ou https. */
function sanitizeSvg(svg: string, format: KitFormat): string {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  const vb = root && attr(root, "viewBox")?.split(/[\s,]+/).map(Number);
  if (!vb || Math.round(vb[2]) !== W || Math.abs(vb[3] - heightOf(format)) > 1) throw new TRPCError({ code: "BAD_REQUEST", message: "O desenho não tem o tamanho deste material." });
  const out = svg
    .replace(/<(script|foreignObject|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(\s(?:xlink:)?href\s*=\s*)(["'])(.*?)\2/gi, (m, a: string, q: string, v: string) =>
      /^(alle:[a-z-]+|data:image\/(png|jpeg|webp|gif);|https:\/\/|#)/i.test(v.trim()) ? m : "");
  if (!slotsOf(out).length) throw new TRPCError({ code: "BAD_REQUEST", message: "O espaço do QR (“QR da academia”) precisa continuar na arte." });
  if (out.length > 6_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Arte grande demais." });
  return out;
}

/** Embute as imagens https (fotos enviadas no editor) para o renderizador. */
async function embedRemote(svg: string) {
  const urls = [...new Set([...svg.matchAll(/href="(https:\/\/[^"]+)"/g)].map((m) => m[1]))].slice(0, 10);
  for (const u of urls) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(20_000) });
      const type = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
      if (res.ok && type.startsWith("image/")) svg = svg.split(`href="${u}"`).join(`href="data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}"`);
    } catch { /* imagem fora do ar: fica sem ela */ }
  }
  return svg;
}

const withAssets = (svg: string) => svg.replace(/href="(alle:[a-z-]+)"/g, (m, k: string) => (BRAND_ASSETS[k] ? `href="${BRAND_ASSETS[k]}"` : m));
const renderSvg = (svg: string, width: number) =>
  Buffer.from(new Resvg(withAssets(svg), { fitTo: { mode: "width", value: width }, font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Montserrat" } }).render().asPng());

/** Prévia (PNG) de um design, com o QR de uma academia ou o espaço reservado. */
export async function previewKit(format: KitFormat, state: KitState, qrData: string | null, width = 900, variantId = state.variant) {
  const { svg, slots } = drawVariant(format, state, variantId);
  const extra = slots.map((s) => (qrData ? qrSvgGroup(qrData, s.x, s.y, s.size) : placeholderQr(s))).join("");
  return renderSvg(await embedRemote(svg.replace("</svg>", `${extra}</svg>`)), width);
}

/** PDF de uma página com a imagem JPEG ocupando o tamanho real do material. */
function jpegToPdf(jpeg: Buffer, px: { w: number; h: number }, cm: { w: number; h: number }): Buffer {
  const pw = ((cm.w / 2.54) * 72).toFixed(2), ph = ((cm.h / 2.54) * 72).toFixed(2);
  const content = Buffer.from(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Buffer | string) => { const buf = typeof b === "string" ? Buffer.from(b, "latin1") : b; parts.push(buf); len += buf.length; };
  const obj = (n: number, body: () => void) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${px.w} /Height ${px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push("\nendstream"); });
  obj(5, () => { push(`<< /Length ${content.length} >>\nstream\n`); push(content); push("\nendstream"); });
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, "0")} 00000 n \n`).join("")}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}

/**
 * Gera o material de várias academias: desenha a arte uma vez (sem QR) no tamanho de impressão
 * e encaixa o QR vetorial de cada unidade. Salva PDF + prévia e põe no mídia kit da unidade.
 */
/** mode "pendente": salva no mídia kit da unidade aguardando aprovação; "conferir": só devolve o PDF. */
async function generateFor(format: KitFormat, state: KitState, list: Array<{ id: number; name: string; qr: string }>, mode: "pendente" | "conferir", onProgress?: (done: number) => void) {
  const { svg, slots } = drawVariant(format, state);
  if (!slots.length) throw new Error("A arte não tem o espaço do QR.");
  const px = pxOf(format);
  const scale = px.w / W;
  const base = await sharp(renderSvg(await embedRemote(svg), px.w)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const fmt = KIT_FORMATS[format];
  const c = await conn();
  const label = `${fmt.label} ${String(fmt.wCm).replace(".", ",")} × ${String(fmt.hCm).replace(".", ",")} cm`;
  const description = `Impressão › ${fmt.label}`;
  let done = 0;
  const results: Array<{ unitId: number; url: string }> = [];
  for (const u of list) {
    const overlays = slots.map((s) => {
      const size = Math.round(s.size * scale);
      const qrPng = renderSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.size} ${s.size}"><rect width="${s.size}" height="${s.size}" fill="#fff"/>${qrSvgGroup(u.qr, 0, 0, s.size)}</svg>`, size);
      return { input: qrPng, left: Math.round(s.x * scale), top: Math.round(s.y * scale) };
    });
    const img = sharp(base.data, { raw: base.info }).composite(overlays);
    const jpeg = await img.clone().jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
    const preview = await sharp(jpeg).resize({ width: 1000 }).jpeg({ quality: 82 }).toBuffer();
    const key = `${unitKey(u.name)}-${format}-${Date.now().toString(36)}`;
    const pdf = jpegToPdf(jpeg, px, { w: fmt.wCm, h: fmt.hCm });
    if (mode === "conferir") {
      const { url } = await storagePut(`unit-kits-print/conferir/${key}.pdf`, pdf, "application/pdf");
      results.push({ unitId: u.id, url });
      onProgress?.(++done);
      continue;
    }
    const [{ url: pdfUrl }, { url: previewUrl }] = await Promise.all([
      storagePut(`unit-kits-print/${key}.pdf`, pdf, "application/pdf"),
      storagePut(`unit-kits-print/${key}-previa.jpg`, preview, "image/jpeg"),
    ]);
    // Troca só a versão pendente anterior; a aprovada continua no portal até a nova ser aprovada.
    await c.delete(unitMaterials).where(and(eq(unitMaterials.unitId, u.id), eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, description), eq(unitMaterials.pending, true)));
    await c.insert(unitMaterials).values({
      unitId: u.id, kind: "midia_kit", title: label, description, fileUrl: pdfUrl, previewUrl, pending: true,
      fileName: `${fmt.label} - ${u.name}.pdf`, contentType: "application/pdf", sizeBytes: pdf.length, createdByUserId: 1,
    });
    results.push({ unitId: u.id, url: pdfUrl });
    onProgress?.(++done);
  }
  return results;
}

async function stateOf(format: KitFormat): Promise<KitState> {
  const c = await conn();
  const [row] = await c.select().from(unitKitTemplates).where(eq(unitKitTemplates.format, format));
  return stateFrom(format, row?.fields);
}
async function saveState(format: KitFormat, state: KitState) {
  const c = await conn();
  const fields = state as unknown as Record<string, string>;
  await c.insert(unitKitTemplates).values({ format, fields, updatedAt: new Date() })
    .onConflictDoUpdate({ target: unitKitTemplates.format, set: { fields, updatedAt: new Date() } });
}
const variantSchema = z.string().min(1).max(40);

async function unitsWithQr(unitIds?: number[]) {
  const c = await conn();
  const rows = await c.select({ id: units.id, name: units.name, qrData: units.qrData, signupUrl: units.signupUrl, active: units.active })
    .from(units).where(or(isNotNull(units.qrData), isNotNull(units.signupUrl)));
  return rows.filter((u) => u.active && (!unitIds || unitIds.includes(u.id))).map((u) => ({ id: u.id, name: u.name, qr: (u.qrData ?? u.signupUrl)! }));
}

// Quem aprova o envio às unidades (só essa pessoa; os outros administradores só preparam).
const APPROVER_EMAIL = (process.env.UNIT_KIT_APPROVER_EMAIL || "matheus@alleenergia.com").toLowerCase();
const isApprover = (u: { email?: string | null } | null | undefined) => (u?.email ?? "").toLowerCase() === APPROVER_EMAIL;
function assertApprover(u: { email?: string | null } | null | undefined) {
  if (!isApprover(u)) throw new TRPCError({ code: "FORBIDDEN", message: `Só ${APPROVER_EMAIL} aprova o envio do mídia kit às unidades.` });
}

// Geração em segundo plano (uma por vez), com progresso para a tela acompanhar.
let job: { format: KitFormat; total: number; done: number; error: string | null; finishedAt: Date | null } | null = null;

export const unitKitRouter = router({
  formats: adminProcedure.query(() => Object.entries(KIT_FORMATS).map(([id, f]) => ({ id, ...f, ratio: f.hCm / f.wCm, px: pxOf(id as KitFormat) }))),

  /** Se quem está logado pode aprovar (e quem é o aprovador). */
  approver: adminProcedure.query(({ ctx }) => ({ canApprove: isApprover(ctx.actualUser), email: APPROVER_EMAIL })),

  templates: adminProcedure.query(async () => {
    const c = await conn();
    const rows = await c.select().from(unitKitTemplates);
    const mats = await c.select({ description: unitMaterials.description, pending: unitMaterials.pending, unitId: unitMaterials.unitId, previewUrl: unitMaterials.previewUrl, fileUrl: unitMaterials.fileUrl })
      .from(unitMaterials).where(and(eq(unitMaterials.kind, "midia_kit"), like(unitMaterials.description, "Impressão › %")));
    const unitRows = await c.select({ id: units.id, name: units.name }).from(units);
    const unitName = new Map(unitRows.map((u) => [u.id, u.name]));
    return (Object.keys(KIT_FORMATS) as KitFormat[]).map((format) => {
      const r = rows.find((x) => x.format === format);
      const state = stateFrom(format, r?.fields);
      const desc = `Impressão › ${KIT_FORMATS[format].label}`;
      const pending = mats.filter((m) => m.description === desc && m.pending);
      return {
        format, variant: state.variant, texts: state.texts,
        variants: variantsOf(format).map((v) => ({ id: v.id, label: v.label, note: v.note, defaults: v.defaults, edited: !!state.custom[v.id] })),
        updatedAt: r?.updatedAt ?? null, generatedAt: r?.generatedAt ?? null, generatedCount: r?.generatedCount ?? 0, approvedAt: r?.approvedAt ?? null,
        pendingCount: pending.length,
        sentCount: mats.filter((m) => m.description === desc && !m.pending).length,
        // Amostras da versão aguardando aprovação, para revisar antes de enviar.
        samples: pending.slice(0, 8).map((m) => ({ unitName: unitName.get(m.unitId ?? 0) ?? "—", previewUrl: m.previewUrl, pdfUrl: m.fileUrl })),
      };
    });
  }),

  /** Aprova a versão gerada: ela substitui a anterior no mídia kit de cada unidade. */
  approve: adminProcedure.input(z.object({ format: formatSchema })).mutation(async ({ ctx, input }) => {
    assertApprover(ctx.actualUser);
    const c = await conn();
    const desc = `Impressão › ${KIT_FORMATS[input.format].label}`;
    const pending = await c.select({ id: unitMaterials.id, unitId: unitMaterials.unitId }).from(unitMaterials)
      .where(and(eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc), eq(unitMaterials.pending, true)));
    if (!pending.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há versão gerada aguardando aprovação." });
    await c.transaction(async (tx) => {
      for (const p of pending) {
        await tx.delete(unitMaterials).where(and(eq(unitMaterials.unitId, p.unitId!), eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc), eq(unitMaterials.pending, false)));
      }
      await tx.update(unitMaterials).set({ pending: false }).where(and(eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc), eq(unitMaterials.pending, true)));
      await tx.insert(unitKitTemplates).values({ format: input.format, fields: stateFrom(input.format, null) as unknown as Record<string, string>, approvedAt: new Date(), approvedByUserId: ctx.actualUser!.id })
        .onConflictDoUpdate({ target: unitKitTemplates.format, set: { approvedAt: new Date(), approvedByUserId: ctx.actualUser!.id } });
    });
    await db.recordAudit({ action: "unit.kit.approved", actorUserId: ctx.actualUser!.id, targetType: "unit_kit", targetId: input.format, metadata: { units: pending.length } });
    return { sent: pending.length };
  }),

  /** Descarta a versão gerada (as unidades continuam com a anterior). */
  discard: adminProcedure.input(z.object({ format: formatSchema })).mutation(async ({ ctx, input }) => {
    assertApprover(ctx.actualUser);
    const c = await conn();
    const desc = `Impressão › ${KIT_FORMATS[input.format].label}`;
    await c.delete(unitMaterials).where(and(eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc), eq(unitMaterials.pending, true)));
    return { ok: true };
  }),

  /** Unidades que podem receber o material (têm QR ou link). */
  units: adminProcedure.query(async () => (await unitsWithQr()).map((u) => ({ id: u.id, name: u.name }))),

  /** Salva os textos de um design. */
  saveTexts: adminProcedure.input(z.object({ format: formatSchema, variant: variantSchema, fields: fieldsSchema })).mutation(async ({ input }) => {
    const state = await stateOf(input.format);
    const v = variantsOf(input.format).find((x) => x.id === input.variant);
    if (!v) throw new TRPCError({ code: "BAD_REQUEST", message: "Design não encontrado." });
    state.texts[v.id] = pick(v.defaults, input.fields);
    await saveState(input.format, state);
    return { ok: true };
  }),

  /** Escolhe o design que vai para as academias. */
  selectVariant: adminProcedure.input(z.object({ format: formatSchema, variant: variantSchema })).mutation(async ({ input }) => {
    const state = await stateOf(input.format);
    if (!variantsOf(input.format).some((x) => x.id === input.variant)) throw new TRPCError({ code: "BAD_REQUEST", message: "Design não encontrado." });
    state.variant = input.variant;
    await saveState(input.format, state);
    return { ok: true };
  }),

  /** Prévia de um design (com textos ainda não salvos, se vierem). */
  preview: adminProcedure
    .input(z.object({ format: formatSchema, variant: variantSchema, fields: fieldsSchema.optional(), unitId: z.number().int().nullable(), width: z.number().int().min(200).max(1200).default(900) }))
    .mutation(async ({ input }) => {
      const state = await stateOf(input.format);
      if (input.fields) state.texts[input.variant] = { ...state.texts[input.variant], ...input.fields };
      const u = input.unitId ? (await unitsWithQr([input.unitId]))[0] : null;
      const jpg = await sharp(await previewKit(input.format, state, u?.qr ?? null, input.width, input.variant)).jpeg({ quality: 84 }).toBuffer();
      return { dataUrl: `data:image/jpeg;base64,${jpg.toString("base64")}` };
    }),

  /** Todos os designs do material lado a lado (para comparar). */
  compare: adminProcedure.input(z.object({ format: formatSchema, unitId: z.number().int().nullable() })).mutation(async ({ input }) => {
    const state = await stateOf(input.format);
    const u = input.unitId ? (await unitsWithQr([input.unitId]))[0] : null;
    return Promise.all(variantsOf(input.format).map(async (v) => {
      const jpg = await sharp(await previewKit(input.format, state, u?.qr ?? null, 560, v.id)).jpeg({ quality: 82 }).toBuffer();
      return { id: v.id, label: v.label, note: v.note, edited: !!state.custom[v.id], selected: state.variant === v.id, dataUrl: `data:image/jpeg;base64,${jpg.toString("base64")}` };
    }));
  }),

  /** Arte de um design para abrir no editor (igual ao das artes dos agentes). */
  artSource: adminProcedure.input(z.object({ format: formatSchema, variant: variantSchema })).query(async ({ input }) => {
    const state = await stateOf(input.format);
    return { svg: editableSvg(input.format, state, input.variant), edited: !!state.custom[input.variant] };
  }),

  /** Salva a arte editada à mão (passa a valer no lugar do modelo com textos). */
  saveArt: adminProcedure.input(z.object({ format: formatSchema, variant: variantSchema, svg: z.string().max(6_000_000) })).mutation(async ({ input }) => {
    const state = await stateOf(input.format);
    if (!variantsOf(input.format).some((x) => x.id === input.variant)) throw new TRPCError({ code: "BAD_REQUEST", message: "Design não encontrado." });
    state.custom[input.variant] = sanitizeSvg(input.svg, input.format);
    await saveState(input.format, state);
    return { ok: true };
  }),

  /** Descarta a edição à mão e volta ao modelo com textos. */
  resetArt: adminProcedure.input(z.object({ format: formatSchema, variant: variantSchema })).mutation(async ({ input }) => {
    const state = await stateOf(input.format);
    delete state.custom[input.variant];
    await saveState(input.format, state);
    return { ok: true };
  }),

  /** Gera para uma academia só e devolve o PDF (para conferir ou mandar para a gráfica). */
  exportOne: adminProcedure.input(z.object({ format: formatSchema, unitId: z.number().int() })).mutation(async ({ input }) => {
    const list = await unitsWithQr([input.unitId]);
    if (!list.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta academia ainda não tem QR code nem link cadastrado." });
    const [r] = await generateFor(input.format, await stateOf(input.format), list, "conferir");
    return { url: r.url };
  }),

  /** Gera para todas as academias com QR (em segundo plano). */
  generateAll: adminProcedure.input(z.object({ format: formatSchema })).mutation(async ({ ctx, input }) => {
    if (job && !job.finishedAt) throw new TRPCError({ code: "CONFLICT", message: `Já existe uma geração em andamento (${KIT_FORMATS[job.format].label}).` });
    const list = await unitsWithQr();
    const state = await stateOf(input.format);
    const current = { format: input.format, total: list.length, done: 0, error: null as string | null, finishedAt: null as Date | null };
    job = current;
    void (async () => {
      try {
        await generateFor(input.format, state, list, "pendente", (d) => { current.done = d; });
        const c = await conn();
        await c.insert(unitKitTemplates).values({ format: input.format, fields: state as unknown as Record<string, string>, generatedAt: new Date(), generatedCount: list.length })
          .onConflictDoUpdate({ target: unitKitTemplates.format, set: { generatedAt: new Date(), generatedCount: list.length } });
        await db.recordAudit({ action: "unit.kit.generated", actorUserId: ctx.actualUser!.id, targetType: "unit_kit", targetId: input.format, metadata: { units: list.length } });
      } catch (err) {
        console.error("[mídia kit] erro na geração:", err);
        current.error = (err as Error).message;
      } finally {
        current.finishedAt = new Date();
      }
    })();
    return { total: list.length };
  }),

  job: adminProcedure.query(() => (job ? { ...job, label: KIT_FORMATS[job.format].label } : null)),
});
