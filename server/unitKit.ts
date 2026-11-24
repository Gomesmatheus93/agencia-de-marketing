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

/**
 * Instruções de cada material: o que ele é (definição da equipe) e como a arte deve ser por causa disso.
 * Valem para todo design novo do mídia kit. Regras gerais: parceria Alle + Allp Fit, contraste alto
 * (branco sobre roxo ou laranja), pouca informação, sem % e sem ressalva na arte, a Ane de braços inteiros.
 */
export const KIT_FORMATS = {
  display: {
    label: "Display", wCm: 21, hCm: 29.7, dpi: 300, layout: "chat",
    purpose: "Arte de display (ou arte para display) é o arquivo gráfico ou design visual feito para ser aplicado em um display: suporte, expositor de mesa/chão, peça de comunicação visual, totem ou estrutura usada em pontos de venda (PDV), eventos ou festas.",
    guide: "Fica no balcão ou na recepção e é lido de perto, com a pessoa parada na frente. O QR é a ação principal e precisa estar grande e fácil de escanear. Mensagem curta em cima e, no máximo, os 3 passos.",
  },
  banner: {
    label: "Banner", wCm: 90.02, hCm: 120.24, dpi: 120, layout: "impact",
    purpose: "Um banner é uma peça visual, impressa ou digital, criada para transmitir uma mensagem de forma rápida, clara e chamativa, com objetivos publicitários, institucionais ou acadêmicos.",
    guide: "É lido de longe e de passagem, em poucos segundos. Uma frase gigante, uma linha de apoio e o QR grande. Nada de passos, listas ou texto pequeno.",
  },
  panfleto: {
    label: "Panfleto", wCm: 37.31, hCm: 52.92, dpi: 150, layout: "voucher",
    purpose: "Um panfleto (ou folheto) é um impresso ou documento de divulgação rápida e de baixo custo, usado para propagar ideias, produtos, marcas ou serviços.",
    guide: "É divulgação rápida: a pessoa olha por alguns segundos. Pode explicar um pouco mais que os outros materiais (os 3 passos e os benefícios), mas com hierarquia clara: título, como ativar e o QR.",
  },
  windbanner: {
    label: "Windbanner", wCm: 111.57, hCm: 156.9, dpi: 100, layout: "flag",
    purpose: "O Wind Banner (também chamado de fly banner, wind flag ou beach-flag) é uma bandeira promocional vertical que se movimenta com o vento, ideal para atrair atenção em fachadas de lojas, calçadas, eventos, feiras e praias.",
    guide: "Fica do lado de fora, balançando e visto de longe: chama a atenção, não explica. Logos grandes, poucas palavras bem grandes e empilhadas na vertical, cores fortes. O QR fica só embaixo, na altura das mãos.",
  },
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
    photo: "ane-tablet",
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
  const V = (id: string, label: string, note: string, draw: Draw): Variant => ({ id, label, note, defaults: ATIVAR_DEFAULTS, draw });
  const novas: Variant[] = {
    display: [
      V("disp-fundo", "Fundo roxo (novo)", "Fundo roxo com faixas diagonais, mensagem em cima, QR num card branco e a Ane.", dispFundo),
      V("disp-totem", "Totem de recepção", "Lido de perto no balcão: QR grande no centro e os 3 passos embaixo.", dispTotem),
      V("disp-laranja", "Laranja com a Ane", "Fundo laranja só com texto branco, QR num card roxo e a Ane na borda.", dispOrange),
      V("disp-cartao", "Cartão branco", "O QR enorme num cartão branco no centro, sem foto.", dispCard),
      V("disp-faixa", "Faixa lateral", "Faixa laranja à esquerda com o QR e os passos; a mensagem e a Ane à direita.", dispBand),
      V("disp-dividido", "Dividido (anterior)", "Roxo em cima com a mensagem e branco embaixo com o QR e os 3 passos.", dispSplit),
      V("disp-selo", "Selo (anterior)", "Laranja com um selo grande “JÁ É SEU!” e o QR num card roxo.", dispStamp),
      V("disp-celular", "Celular (anterior)", "Celular desenhado com o QR na tela e a Ane ao lado.", dispPhone),
    ],
    banner: [
      V("ban-frase", "Frase gigante", "Lido de longe: “JÁ É SEU.” enorme, uma linha de apoio, o QR e a Ane.", banGiant),
      V("ban-faixa", "Faixa laranja", "“SÓ FALTA ATIVAR!” numa faixa atravessada e o QR grande no centro.", banStripe),
      V("ban-selo", "Selo", "Círculo laranja enorme com “JÁ É SEU.”, o QR à esquerda e a Ane à direita.", banSeal),
      V("ban-qr", "QR gigante", "Para escanear de longe: o QR ocupa o centro, com uma frase em cima.", banQr),
      V("ban-ane-grande", "A Ane grande", "A Ane com a mão no queixo à esquerda e o QR num card laranja.", banAneBig),
      V("ban-tipografico", "Tipográfico (anterior)", "“JÁ É SEU.” gigante para ler de longe, QR grande e a Ane.", banType),
      V("ban-diagonal", "Diagonal (anterior)", "Laranja e roxo na diagonal, QR num círculo branco e a Ane.", banDiag),
      V("ban-arco", "Arco (anterior)", "Fundo claro com a Ane dentro de um arco roxo e o QR num card laranja.", banArch),
    ],
    panfleto: [
      V("pan-passos", "Passo a passo", "Título, os 3 passos em faixas laranja, o QR ao lado e os benefícios no rodapé.", panSteps),
      V("pan-beneficios", "Benefícios", "Laranja com os 3 benefícios em cards roxos, o QR e a Ane.", panPerks),
      V("pan-ane", "A Ane apresenta", "A Ane na borda esquerda, a mensagem e os passos na coluna da direita.", panAne),
      V("pan-perguntas", "Perguntas", "“Tem custo? NÃO.” para tirar as dúvidas rápido, o QR e a Ane.", panFaq),
      V("pan-dividido", "Laranja e roxo", "Laranja em cima com a mensagem e o QR; roxo embaixo com os passos e a Ane.", panSplit),
      V("pan-checklist", "Checklist (anterior)", "Lista grande com os benefícios marcados e o QR ao lado.", panCheck),
      V("pan-balao", "Balão (anterior)", "A Ane com um balão de fala grande e o QR no canto.", panBubble),
      V("pan-etiqueta", "Etiqueta (anterior)", "Uma etiqueta de presente “JÁ É SEU.” e o QR embaixo.", panTag),
    ],
    windbanner: [
      V("wb-logos", "Logos gigantes", "Vista de longe: logos grandes, “JÁ / É / SEU.” empilhado e o QR embaixo.", flagDraw(wbLogos)),
      V("wb-laranja", "Laranja vertical", "A frase gigante na vertical ao longo da bandeira e o QR num bloco roxo.", flagDraw(wbOrange)),
      V("wb-faixas", "Faixas", "Roxo com faixas laranja, “ATIVE SEU BENEFÍCIO” empilhado e o QR.", flagDraw(wbStripes)),
      V("wb-raio", "Raio", "Roxo com o raio da marca e “SEU DESCONTO NA CONTA DE LUZ” empilhado.", flagDraw(wbBolt)),
      V("wb-meio", "Meio a meio", "Roxo em cima com “SÓ FALTA ATIVAR!” e laranja embaixo com o QR.", flagDraw(wbHalf)),
      V("wb-vertical", "Vertical roxo (anterior)", "“JÁ É SEU.” na vertical e o QR embaixo.", flagDraw(wbVertical)),
      V("wb-ane", "Laranja com a Ane (anterior)", "O QR no meio, na altura de leitura, e a Ane embaixo.", flagDraw(wbAne)),
      V("wb-passos", "Claro com passos (anterior)", "Os 3 passos numerados e o QR.", flagDraw(wbSteps)),
    ],
  }[format];
  switch (format) {
    case "display": return [...novas, { id: "conversa", label: "Conversa com a Ane (nova)", note: "Balões de conversa, selo da oferta e a faixa roxa com o QR.", defaults: KIT_DEFAULTS.display, draw: chatSvg }, ...older];
    case "banner": return [...novas, { id: "impacto", label: "Impacto (nova)", note: "Frase grande para ler de longe, QR gigante e a Ane com balão.", defaults: KIT_DEFAULTS.banner, draw: impactSvg }, ...older];
    case "panfleto": return [...novas, { id: "vale", label: "Vale-desconto (nova)", note: "Cupom com picote e canhoto de resgate com o QR.", defaults: KIT_DEFAULTS.panfleto, draw: voucherSvg }, ...older];
    default: return [...novas, { id: "bandeira", label: "Bandeira", note: "As duas faces da bandeira lado a lado no molde.", defaults: KIT_DEFAULTS.windbanner, draw: flagSvg }];
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

/** Fotos da Ane (recortes sem fundo) e o tamanho de cada uma. */
export const ANE_PHOTOS: Record<string, { label: string; w: number; h: number }> = {
  "ane-ombro": { label: "Olhando por cima do ombro", w: 742, h: 1020 },
  "ane-solto": { label: "Sorrindo, de frente", w: 880, h: 994 },
  "ane": { label: "De frente, braços cruzados", w: 848, h: 997 },
  "ane-caneca": { label: "Com a caneca", w: 1016, h: 1020 },
  "ane-tablet": { label: "Mostrando a conta no tablet", w: 900, h: 1297 },
  "ane-sorrindo": { label: "Sorrindo, cabelo solto (nova)", w: 874, h: 1006 },
  "ane-queixo": { label: "Mão no queixo (nova)", w: 883, h: 1000 },
  "ane-costas": { label: "Olhando para trás (nova)", w: 773, h: 1020 },
  "ane-rabo": { label: "Rabo de cavalo, braços cruzados (24/11)", w: 842, h: 998 },
  "ane-ombro-2": { label: "De costas, por cima do ombro (24/11)", w: 718, h: 999 },
  "ane-solta": { label: "Cabelo solto, de frente (24/11)", w: 866, h: 1000 },
  "ane-coque-2": { label: "Coque, braços cruzados (24/11)", w: 872, h: 1000 },
  "ane-oculos-2": { label: "Ajustando os óculos (24/11)", w: 997, h: 1000 },
  "ane-tras": { label: "Olhando para trás, cabelo solto (24/11)", w: 746, h: 1000 },
  "ane-polo": { label: "Camisa polo com o logo da Alle (24/11)", w: 732, h: 1000 },
};

/** Banner (90×120, parede): frase gigante, QR enorme com "ATIVE AGORA" e a Ane grande com balão. */
function impactSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
  const card = { x: 64, y: 586, w: 430 };
  const qrSize = 350;
  const qr = { x: card.x + (card.w - qrSize) / 2, y: card.y + 96, size: qrSize };
  const cardH = 96 + qrSize + 92;
  // A foto cabe à direita do QR (a partir de x≈510) e encosta na borda de baixo.
  const photo = ANE_PHOTOS[f.photo] ? f.photo : "ane-ombro";
  const pd = ANE_PHOTOS[photo];
  const aneH = Math.min(H - 600, 680, (510 * pd.h) / pd.w), aneW = (aneH * pd.w) / pd.h;
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
  <image href="alle:${photo}" x="${aneX}" y="${aneY}" width="${aneW}" height="${aneH}"/>
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
    // PNG no tamanho de impressão, com a resolução (DPI) gravada: abre com o tamanho real em cm.
    const png = await img.clone().png({ compressionLevel: 6 }).withMetadata({ density: fmt.dpi }).toBuffer();
    const preview = await sharp(png).resize({ width: 1000 }).jpeg({ quality: 82 }).toBuffer();
    const key = `${unitKey(u.name)}-${format}-${Date.now().toString(36)}`;
    if (mode === "conferir") {
      const { url } = await storagePut(`unit-kits-print/conferir/${key}.png`, png, "image/png");
      results.push({ unitId: u.id, url });
      onProgress?.(++done);
      continue;
    }
    const [{ url: fileUrl }, { url: previewUrl }] = await Promise.all([
      storagePut(`unit-kits-print/${key}.png`, png, "image/png"),
      storagePut(`unit-kits-print/${key}-previa.jpg`, preview, "image/jpeg"),
    ]);
    // Troca só a versão pendente anterior; a aprovada continua no portal até a nova ser aprovada.
    await c.delete(unitMaterials).where(and(eq(unitMaterials.unitId, u.id), eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, description), eq(unitMaterials.pending, true)));
    await c.insert(unitMaterials).values({
      unitId: u.id, kind: "midia_kit", title: label, description, fileUrl, previewUrl, pending: true,
      fileName: `${fmt.label} - ${u.name}.png`, contentType: "image/png", sizeBytes: png.length, createdByUserId: 1,
    });
    results.push({ unitId: u.id, url: fileUrl });
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
  const rows = await c.select({ id: units.id, name: units.name, qrData: units.qrData, signupUrl: units.signupUrl, active: units.active, benefit: units.benefitAvailable })
    .from(units).where(or(isNotNull(units.qrData), isNotNull(units.signupUrl)));
  // Academias sem o benefício na região não recebem material.
  return rows.filter((u) => u.active && u.benefit && (!unitIds || unitIds.includes(u.id))).map((u) => ({ id: u.id, name: u.name, qr: (u.qrData ?? u.signupUrl)! }));
}

// Quem aprova o envio às unidades (só essa pessoa; os outros administradores só preparam).
const APPROVER_EMAIL = (process.env.UNIT_KIT_APPROVER_EMAIL || "matheus@alleenergia.com").toLowerCase();
const isApprover = (u: { email?: string | null } | null | undefined) => (u?.email ?? "").toLowerCase() === APPROVER_EMAIL;
function assertApprover(u: { email?: string | null } | null | undefined) {
  if (!isApprover(u)) throw new TRPCError({ code: "FORBIDDEN", message: `Só ${APPROVER_EMAIL} aprova o envio do mídia kit às unidades.` });
}

// Geração em segundo plano (uma por vez), com progresso para a tela acompanhar.
// Gera um ou vários materiais em sequência (todos de uma vez: display, banner, panfleto, windbanner).
type Job = { formats: KitFormat[]; format: KitFormat; total: number; done: number; error: string | null; finishedAt: Date | null };
let job: Job | null = null;

/** Troca, no mídia kit de cada unidade, a versão aprovada pela gerada. Devolve quantas foram enviadas. */
async function approveFormat(format: KitFormat, approverId: number) {
  const c = await conn();
  const desc = `Impressão › ${KIT_FORMATS[format].label}`;
  const pending = await c.select({ id: unitMaterials.id, unitId: unitMaterials.unitId }).from(unitMaterials)
    .where(and(eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc), eq(unitMaterials.pending, true)));
  if (!pending.length) return 0;
  await c.transaction(async (tx) => {
    for (const p of pending) {
      await tx.delete(unitMaterials).where(and(eq(unitMaterials.unitId, p.unitId!), eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc), eq(unitMaterials.pending, false)));
    }
    await tx.update(unitMaterials).set({ pending: false }).where(and(eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc), eq(unitMaterials.pending, true)));
    await tx.insert(unitKitTemplates).values({ format, fields: stateFrom(format, null) as unknown as Record<string, string>, approvedAt: new Date(), approvedByUserId: approverId })
      .onConflictDoUpdate({ target: unitKitTemplates.format, set: { approvedAt: new Date(), approvedByUserId: approverId } });
  });
  await db.recordAudit({ action: "unit.kit.approved", actorUserId: approverId, targetType: "unit_kit", targetId: format, metadata: { units: pending.length } });
  return pending.length;
}

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
        samples: pending.slice(0, 8).map((m) => ({ unitName: unitName.get(m.unitId ?? 0) ?? "—", previewUrl: m.previewUrl, fileUrl: m.fileUrl })),
      };
    });
  }),

  /** Aprova a versão gerada: ela substitui a anterior no mídia kit de cada unidade. */
  approve: adminProcedure.input(z.object({ format: formatSchema })).mutation(async ({ ctx, input }) => {
    assertApprover(ctx.actualUser);
    const sent = await approveFormat(input.format, ctx.actualUser!.id);
    if (!sent) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há versão gerada aguardando aprovação." });
    return { sent };
  }),

  /** Aprova de uma vez todos os materiais que estão aguardando. */
  approveAll: adminProcedure.mutation(async ({ ctx }) => {
    assertApprover(ctx.actualUser);
    if (job && !job.finishedAt) throw new TRPCError({ code: "CONFLICT", message: "Espere a geração terminar para aprovar." });
    const out: Record<string, number> = {};
    for (const f of Object.keys(KIT_FORMATS) as KitFormat[]) out[f] = await approveFormat(f, ctx.actualUser!.id);
    const total = Object.values(out).reduce((a, b) => a + b, 0);
    if (!total) throw new TRPCError({ code: "BAD_REQUEST", message: "Não há material aguardando aprovação." });
    return { total, byFormat: out };
  }),

  /** Exclui um material do mídia kit de uma academia (a versão enviada e/ou a que aguarda aprovação). */
  deleteUnitMaterial: adminProcedure
    .input(z.object({ unitId: z.number().int(), format: formatSchema, which: z.enum(["pendente", "enviado", "ambos"]).default("ambos") }))
    .mutation(async ({ ctx, input }) => {
      // Tirar um material já enviado das academias é como enviar: só quem aprova pode.
      if (input.which !== "pendente") assertApprover(ctx.actualUser);
      const c = await conn();
      const desc = `Impressão › ${KIT_FORMATS[input.format].label}`;
      const cond = [eq(unitMaterials.unitId, input.unitId), eq(unitMaterials.kind, "midia_kit"), eq(unitMaterials.description, desc)];
      if (input.which === "pendente") cond.push(eq(unitMaterials.pending, true));
      if (input.which === "enviado") cond.push(eq(unitMaterials.pending, false));
      const gone = await c.delete(unitMaterials).where(and(...cond)).returning({ id: unitMaterials.id });
      await db.recordAudit({ action: "unit.kit.deleted", actorUserId: ctx.actualUser!.id, targetType: "unit_kit", targetId: input.format, metadata: { unitId: input.unitId, which: input.which, files: gone.length } });
      return { deleted: gone.length };
    }),

  /** Mídia kit de cada unidade: o que já foi enviado e o que aguarda aprovação, por material. */
  kitsByUnit: adminProcedure.query(async () => {
    const c = await conn();
    const unitRows = await c.select({ id: units.id, name: units.name, active: units.active, qrData: units.qrData, signupUrl: units.signupUrl, code: units.code, benefit: units.benefitAvailable }).from(units).orderBy(units.name);
    const mats = await c.select({ unitId: unitMaterials.unitId, description: unitMaterials.description, pending: unitMaterials.pending, previewUrl: unitMaterials.previewUrl, fileUrl: unitMaterials.fileUrl, createdAt: unitMaterials.createdAt })
      .from(unitMaterials).where(and(eq(unitMaterials.kind, "midia_kit"), like(unitMaterials.description, "Impressão › %")));
    const formats = Object.keys(KIT_FORMATS) as KitFormat[];
    return unitRows.filter((u) => u.active).map((u) => ({
      id: u.id, name: u.name, hasQr: !!(u.qrData || u.signupUrl), linked: !u.code.startsWith("kit:"), benefit: u.benefit,
      materials: formats.map((f) => {
        const desc = `Impressão › ${KIT_FORMATS[f].label}`;
        const mine = mats.filter((m) => m.unitId === u.id && m.description === desc);
        const sent = mine.find((m) => !m.pending), pend = mine.find((m) => m.pending);
        return {
          format: f, label: KIT_FORMATS[f].label,
          sent: sent ? { previewUrl: sent.previewUrl, fileUrl: sent.fileUrl, at: sent.createdAt } : null,
          pending: pend ? { previewUrl: pend.previewUrl, fileUrl: pend.fileUrl, at: pend.createdAt } : null,
        };
      }),
    }));
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

  /** Fotos da Ane que podem ser escolhidas. */
  photos: adminProcedure.query(() => Object.entries(ANE_PHOTOS).map(([id, p]) => ({ id, label: p.label }))),

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

  /** Gera para todas as academias com QR, um ou vários materiais em sequência (em segundo plano). */
  generateAll: adminProcedure.input(z.object({ formats: z.array(formatSchema).min(1).max(4), unitIds: z.array(z.number().int()).max(500).optional() })).mutation(async ({ ctx, input }) => {
    if (job && !job.finishedAt) throw new TRPCError({ code: "CONFLICT", message: `Já existe uma geração em andamento (${KIT_FORMATS[job.format].label}).` });
    const formats = [...new Set(input.formats)];
    const list = await unitsWithQr(input.unitIds?.length ? input.unitIds : undefined);
    if (!list.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha pelo menos uma academia com QR code." });
    const states = await Promise.all(formats.map((f) => stateOf(f)));
    const current: Job = { formats, format: formats[0], total: list.length * formats.length, done: 0, error: null, finishedAt: null };
    job = current;
    void (async () => {
      try {
        for (const [i, format] of formats.entries()) {
          current.format = format;
          const before = i * list.length;
          await generateFor(format, states[i], list, "pendente", (d) => { current.done = before + d; });
          const c = await conn();
          await c.insert(unitKitTemplates).values({ format, fields: states[i] as unknown as Record<string, string>, generatedAt: new Date(), generatedCount: list.length })
            .onConflictDoUpdate({ target: unitKitTemplates.format, set: { generatedAt: new Date(), generatedCount: list.length } });
        }
        await db.recordAudit({ action: "unit.kit.generated", actorUserId: ctx.actualUser!.id, targetType: "unit_kit", targetId: formats.join(","), metadata: { units: list.length } });
      } catch (err) {
        console.error("[mídia kit] erro na geração:", err);
        current.error = (err as Error).message;
      } finally {
        current.finishedAt = new Date();
      }
    })();
    return { total: current.total, units: list.length };
  }),

  job: adminProcedure.query(() => (job ? { ...job, label: job.formats.length > 1 ? `Todos os materiais (agora: ${KIT_FORMATS[job.format].label})` : KIT_FORMATS[job.format].label } : null)),
});

// ── Novas opções (nov/2026): "Seu desconto já é seu. Só falta ativar!" ───────
// Três tons (roxo, laranja, claro) para display, banner e panfleto, e três bandeiras para o windbanner.
// Sem percentual (sem ressalva na peça), Ane de braços cruzados (braços inteiros), QR em destaque.

export const ATIVAR_DEFAULTS: KitFields = {
  kicker: "ALUNO ALLP FIT,",
  headline1: "Seu desconto",
  headline2: "na conta de luz",
  headline3: "já é seu.",
  cta: "Só falta ativar!",
  qrLabel: "ESCANEIE E ATIVE",
  qrSub: "Fale com a Ane no WhatsApp",
  benefits: "Sem custo · Sem obra · Sem fidelidade",
  step1: "Escaneie o QR Code",
  step2: "Fale com a Ane",
  step3: "Ative seu benefício",
};

type Tone = "roxo" | "laranja" | "claro";
const TONE = {
  roxo: { bg: "#5A16A8", bg2: "#3d0b80", tx: "#ffffff", hi: "#ffa040", allp: "allpfit-branco", alle: "logo-branco", stripe: "url(#nOr)", card: "#ffffff", cardTx: "#3A0057" },
  laranja: { bg: "#F47B20", bg2: "#ff6400", tx: "#ffffff", hi: "#3A0057", allp: "allpfit-mono", alle: "logo-branco", stripe: "#5A16A8", card: "#3A0057", cardTx: "#ffffff" },
  claro: { bg: "#FFF8F2", bg2: "#F3E8FA", tx: "#3A0057", hi: "#ff6a00", allp: "allpfit-roxo", alle: "logo", stripe: "url(#nOr)", card: "#ffffff", cardTx: "#3A0057" },
} as const;

const NDEFS = (H: number, id: string, ane?: { x: number; y: number; w: number; h: number; side: "left" | "right" }) => `<defs>
  <linearGradient id="nOr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa040"/><stop offset="1" stop-color="#ff5a00"/></linearGradient>
  ${ane ? `<linearGradient id="${id}g" x1="0" x2="1">${ane.side === "left"
    ? `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".18" stop-color="#fff"/>`
    : `<stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>`}</linearGradient>
  <mask id="${id}" maskUnits="userSpaceOnUse" x="${ane.x}" y="${ane.y}" width="${ane.w}" height="${ane.h}"><rect x="${ane.x}" y="${ane.y}" width="${ane.w}" height="${ane.h}" fill="url(#${id}g)"/></mask>` : ""}
</defs>`;
const ANE_RATIO = 848 / 997; // alle:ane (braços cruzados, braços inteiros)
const logosRow = (t: (typeof TONE)[Tone], x = 64, y = 64) =>
  `<image href="alle:${t.allp}" x="${x}" y="${y + 8}" width="236" height="51"/>${T(x + 268, y + 52, 40, 500, t.tx, "+", "middle")}<image href="alle:${t.alle}" x="${x + 300}" y="${y}" width="238" height="70"/>`;
const stripes = (H: number, t: (typeof TONE)[Tone]) =>
  `<path d="M${W - 230} 0 L${W - 40} 0 L${W} 60 L${W} 330 Z" fill="${t.stripe}" opacity="0.92"/>` +
  `<path d="M0 ${H * 0.6} L0 ${H * 0.6 + 130} L${W * 0.55} ${H} L${W * 0.55 - 190} ${H} Z" fill="${t.stripe}" opacity="0.85"/>`;
const headline = (f: KitFields, t: (typeof TONE)[Tone], y0: number, size = 78) =>
  T(64, y0, 32, 800, t.hi, f.kicker, "start", 'letter-spacing="2"') +
  T(62, y0 + size + 18, size, 300, t.tx, f.headline1) +
  T(62, y0 + 2 * size + 30, size, 900, t.tx, f.headline2) +
  T(62, y0 + 3 * size + 42, size, 900, t.hi, f.headline3);

// ── 12 layouts distintos (3 por material), todos com a mensagem de ativação ──
type Draw = (H: number, f: KitFields) => { svg: string; slots: Slot[] };
const open = (H: number, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs><linearGradient id="nOr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffa040"/><stop offset="1" stop-color="#ff5a00"/></linearGradient><linearGradient id="nPu" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7A22C8"/><stop offset="1" stop-color="#3A0057"/></linearGradient>${defs}</defs>`;
/** Ane de braços cruzados com a lateral esquerda (ou direita) suavizada. */
const aneAt = (id: string, x: number, y: number, h: number, side: "left" | "right" = "left", photo = "ane") => {
  const w = h * (ANE_PHOTOS[photo] ? ANE_PHOTOS[photo].w / ANE_PHOTOS[photo].h : ANE_RATIO);
  const stops = side === "left" ? `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".18" stop-color="#fff"/>` : `<stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>`;
  return {
    defs: `<linearGradient id="${id}g" x1="0" x2="1">${stops}</linearGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}g)"/></mask>`,
    img: `<image href="alle:${photo}" x="${x}" y="${y}" width="${w}" height="${h}" mask="url(#${id})"/>`, w,
  };
};
const logos = (tone: Tone, x = 64, y = 64) => logosRow(TONE[tone], x, y);
const qrCard = (x: number, y: number, size: number, fill: string, label: string, sub: string, labelColor: string) => {
  const pad = 40, w = size + pad * 2, h = size + 150;
  const box = fill === "#ffffff" ? "" : `<rect x="${x + pad - 14}" y="${y + 70}" width="${size + 28}" height="${size + 28}" rx="18" fill="#ffffff"/>`;
  return {
    svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="32" fill="${fill}"/>${T(x + w / 2, y + 50, 28, 900, labelColor, label, "middle", 'letter-spacing="1"')}${box}${sub ? T(x + w / 2, y + h - 22, 21, 600, labelColor, sub, "middle") : ""}`,
    slot: { x: x + pad, y: y + 84, size }, w, h,
  };
};

// Display 1 · dividido: roxo em cima com a mensagem, branco embaixo com QR e os 3 passos.
const dispSplit: Draw = (H, f) => {
  const Z = Math.round(H * 0.5);
  const qr = { x: 100, y: Z + 120, size: 300 };
  const steps = [f.step1, f.step2, f.step3].map((s, i) => `<circle cx="${500}" cy="${qr.y + 40 + i * 115}" r="28" fill="url(#nOr)"/>${T(500, qr.y + 50 + i * 115, 28, 900, "#fff", String(i + 1), "middle")}${T(546, qr.y + 50 + i * 115, 30, 800, "#3A0057", s)}`).join("");
  return { slots: [qr], svg: `${open(H)}<rect width="${W}" height="${H}" fill="#FFF8F2"/><rect width="${W}" height="${Z}" fill="url(#nPu)"/>
  <image href="alle:raio-mono" x="${W - 330}" y="60" width="300" height="480" opacity="0.1"/>${logos("roxo")}
  ${T(64, 230, 30, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(62, 315, 70, 300, "#fff", f.headline1)}${T(62, 395, 70, 900, "#fff", f.headline2)}${T(62, 475, 70, 900, "#ffa040", f.headline3)}
  <rect x="${W / 2 - 230}" y="${Z - 46}" width="460" height="92" rx="46" fill="url(#nOr)"/>${T(W / 2, Z + 16, 46, 900, "#fff", f.cta, "middle")}
  ${T(qr.x, qr.y - 22, 26, 900, "#3A0057", f.qrLabel, "start", 'letter-spacing="1"')}<rect x="${qr.x - 12}" y="${qr.y - 12}" width="${qr.size + 24}" height="${qr.size + 24}" rx="20" fill="#fff" stroke="#ff6a00" stroke-width="6"/>
  ${steps}${T(W / 2, H - 50, 26, 700, "#3A0057", f.benefits, "middle")}</svg>` };
};

// Display 2 · selo: laranja com um grande selo branco "JÁ É SEU!" e o QR num card roxo.
const dispStamp: Draw = (H, f) => {
  const card = qrCard(W / 2 - 190, H - 520, 300, "#3A0057", f.qrLabel, f.qrSub, "#fff");
  return { slots: [card.slot], svg: `${open(H)}<rect width="${W}" height="${H}" fill="#F47B20"/>
  <path d="M0 0 L260 0 L0 260 Z" fill="#5A16A8" opacity=".9"/><path d="M${W} ${H} L${W - 260} ${H} L${W} ${H - 260} Z" fill="#5A16A8" opacity=".9"/>
  ${logos("laranja", 230, 60)}
  <g transform="translate(${W / 2} 440) rotate(-8)"><circle r="215" fill="#fff"/><circle r="190" fill="none" stroke="#F47B20" stroke-width="5" stroke-dasharray="6 10"/>
  ${T(0, -70, 36, 800, "#5A16A8", f.kicker, "middle")}${T(0, 20, 96, 900, "#3A0057", "JÁ É", "middle")}${T(0, 120, 104, 900, "#ff6a00", "SEU!", "middle")}</g>
  ${T(W / 2, 735, 40, 600, "#fff", `${f.headline1} ${f.headline2}`, "middle")}${T(W / 2, 805, 54, 900, "#3A0057", f.cta, "middle")}
  ${card.svg}</svg>` };
};

// Display 3 · celular: um celular desenhado com o QR na tela ("aponte a câmera") e a Ane ao lado.
const dispPhone: Draw = (H, f) => {
  const ph = { x: 70, y: H - 760, w: 400, h: 720 };
  const qr = { x: ph.x + 50, y: ph.y + 220, size: 300 };
  const a = aneAt("aneP", W - 0.85 * 640 + 20, H - 640, 640);
  return { slots: [qr], svg: `${open(H, a.defs)}<rect width="${W}" height="${H}" fill="#2E0A63"/><circle cx="${W}" cy="${H}" r="560" fill="#5A16A8"/>
  ${logos("roxo")}${T(64, 240, 30, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(62, 315, 62, 300, "#fff", f.headline1)}${T(62, 390, 62, 900, "#fff", f.headline2)}${T(62, 465, 62, 900, "#ffa040", f.headline3)}${T(62, 545, 50, 900, "#fff", f.cta)}
  <rect x="${ph.x}" y="${ph.y}" width="${ph.w}" height="${ph.h}" rx="56" fill="#fff" stroke="#ff6a00" stroke-width="10"/><rect x="${ph.x + 150}" y="${ph.y + 24}" width="100" height="16" rx="8" fill="#3A0057" opacity=".25"/>
  ${T(ph.x + ph.w / 2, ph.y + 120, 34, 900, "#3A0057", "Aponte a câmera", "middle")}${T(ph.x + ph.w / 2, ph.y + 166, 22, 600, "#5A16A8", f.qrSub, "middle")}
  ${T(ph.x + ph.w / 2, ph.y + ph.h - 110, 28, 900, "#ff6a00", f.qrLabel, "middle")}${a.img}</svg>` };
};

// Display 4 · fundo roxo enviado pela equipe: mensagem em cima, QR num card branco e a Ane encostada na borda.
const dispFundo: Draw = (H, f) => {
  const ah = 680, a = aneAt("aneF", W - ah * ANE_RATIO + 40, H - ah, ah);
  const card = qrCard(64, H - 560, 320, "#ffffff", f.qrLabel, f.qrSub, "#3A0057");
  return { slots: [card.slot], svg: `${open(H, a.defs)}<image href="alle:fundo-display" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  ${logos("roxo")}${T(64, 260, 32, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(60, 355, 86, 300, "#fff", f.headline1)}${T(60, 450, 86, 900, "#fff", f.headline2)}${T(60, 545, 86, 900, "#ffa040", f.headline3)}
  ${T(62, 650, 58, 900, "#fff", f.cta)}
  ${T(64, 730, 26, 600, "#fff", f.benefits)}
  ${card.svg}${a.img}</svg>` };
};

// Banner 1 · tipográfico: "JÁ É SEU." gigante para ler de longe, QR grande e a Ane.
const banType: Draw = (H, f) => {
  const card = qrCard(64, H - 520, 340, "#ffffff", f.qrLabel, "", "#3A0057");
  const a = aneAt("aneT", W - 0.85 * 600 + 20, H - 600, 600);
  return { slots: [card.slot], svg: `${open(H, a.defs)}<rect width="${W}" height="${H}" fill="url(#nPu)"/><path d="M${W - 200} 0 L${W} 0 L${W} 200 Z" fill="url(#nOr)"/>
  ${logos("roxo")}${T(64, 215, 32, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(58, 360, 150, 900, "#fff", "JÁ É", "start", 'letter-spacing="-4"')}${T(52, 540, 190, 900, "#ffa040", "SEU.", "start", 'letter-spacing="-6"')}
  ${T(64, 610, 36, 500, "#fff", `${f.headline1} ${f.headline2}`)}${T(64, 680, 52, 900, "#fff", f.cta)}
  ${card.svg}${a.img}</svg>` };
};

// Banner 2 · diagonal: laranja e roxo divididos na diagonal, QR num círculo branco.
const banDiag: Draw = (H, f) => {
  const c = { cx: W - 260, cy: H - 330, r: 200 };
  const qr = { x: c.cx - 125, y: c.cy - 125, size: 250 };
  const a = aneAt("aneD", -20, H - 620, 620, "right");
  return { slots: [qr], svg: `${open(H, a.defs)}<rect width="${W}" height="${H}" fill="#3A0057"/><path d="M0 0 L${W} 0 L${W} ${H * 0.28} L0 ${H * 0.66} Z" fill="#F47B20"/>
  ${logos("laranja")}${T(64, 240, 30, 800, "#3A0057", f.kicker, "start", 'letter-spacing="2"')}${T(62, 325, 74, 300, "#fff", f.headline1)}${T(62, 410, 74, 900, "#fff", f.headline2)}${T(62, 495, 74, 900, "#3A0057", f.headline3)}
  ${T(W - 64, 700, 52, 900, "#fff", f.cta, "end")}${T(W - 64, 750, 26, 600, "#fff", f.benefits, "end")}
  <circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="#fff"/><circle cx="${c.cx}" cy="${c.cy}" r="${c.r + 14}" fill="none" stroke="#ffa040" stroke-width="8"/>
  ${T(c.cx, c.cy + c.r + 60, 28, 900, "#ffa040", f.qrLabel, "middle", 'letter-spacing="1"')}${a.img}</svg>` };
};

// Banner 3 · arco: fundo claro com a Ane dentro de um arco roxo e o QR num card laranja.
const banArch: Draw = (H, f) => {
  const arch = { x: 500, y: H - 820, w: 450, h: 820 };
  const ah = 640, a = aneAt("aneA3", arch.x + arch.w / 2 - (ah * ANE_RATIO) / 2, H - ah, ah);
  const card = qrCard(64, H - 500, 300, "url(#nOr)", f.qrLabel, f.qrSub, "#fff");
  return { slots: [card.slot], svg: `${open(H, `${a.defs}<clipPath id="arch"><rect x="${arch.x}" y="${arch.y}" width="${arch.w}" height="${arch.h + 300}" rx="${arch.w / 2}"/></clipPath>`)}<rect width="${W}" height="${H}" fill="#FFF8F2"/>
  <rect x="${arch.x}" y="${arch.y}" width="${arch.w}" height="${arch.h + 300}" rx="${arch.w / 2}" fill="#5A16A8"/>
  ${logos("claro")}${T(64, 240, 30, 800, "#ff6a00", f.kicker, "start", 'letter-spacing="2"')}${T(62, 320, 66, 300, "#3A0057", f.headline1)}${T(62, 395, 66, 900, "#3A0057", f.headline2)}${T(62, 470, 66, 900, "#ff6a00", f.headline3)}
  ${T(64, 560, 48, 900, "#3A0057", f.cta)}${T(64, 610, 24, 600, "#3A0057", f.benefits)}
  ${card.svg}<g clip-path="url(#arch)">${a.img}</g></svg>` };
};

// Panfleto 1 · checklist: lista grande com os benefícios marcados e o QR ao lado.
const panCheck: Draw = (H, f) => {
  const card = qrCard(W - 64 - 380, 640, 300, "#5A16A8", f.qrLabel, f.qrSub, "#fff");
  const items = [...f.benefits.split("·").map((s) => s.trim()).filter(Boolean), f.cta];
  const list = items.map((s, i) => `${check(100, 700 + i * 110, 30, i === items.length - 1 ? "#ff6a00" : "#5A16A8")}${T(150, 712 + i * 110, 36, 900, i === items.length - 1 ? "#ff6a00" : "#3A0057", s)}`).join("");
  return { slots: [card.slot], svg: `${open(H)}<rect width="${W}" height="${H}" fill="#F3E8FA"/><rect x="0" y="${H - 120}" width="${W}" height="120" fill="#5A16A8"/>
  ${logos("claro")}${T(64, 240, 30, 800, "#ff6a00", f.kicker, "start", 'letter-spacing="2"')}${T(62, 330, 74, 300, "#3A0057", f.headline1)}${T(62, 415, 74, 900, "#3A0057", f.headline2)}${T(62, 500, 74, 900, "#ff6a00", f.headline3)}
  ${list}${card.svg}${T(W / 2, H - 48, 34, 900, "#fff", `${f.step1} · ${f.step2}`, "middle")}</svg>` };
};

// Panfleto 2 · balão: a Ane "falando" num balão grande e o QR no canto.
const panBubble: Draw = (H, f) => {
  const a = aneAt("aneB", -20, H - 700, 700, "right");
  const card = qrCard(W - 64 - 380, H - 500, 300, "url(#nOr)", f.qrLabel, f.qrSub, "#fff");
  const b = { x: 300, y: 200, w: 636, h: 440 };
  return { slots: [card.slot], svg: `${open(H, a.defs)}<rect width="${W}" height="${H}" fill="#5A16A8"/><rect width="${W}" height="${H}" fill="#3d0b80" opacity=".35"/>
  ${logos("roxo")}
  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="44" fill="#fff"/><path d="M${b.x + 70} ${b.y + b.h - 4} L${b.x + 10} ${b.y + b.h + 90} L${b.x + 170} ${b.y + b.h - 4} Z" fill="#fff"/>
  ${T(b.x + 50, b.y + 85, 32, 800, "#ff6a00", f.kicker)}${T(b.x + 50, b.y + 160, 54, 300, "#3A0057", f.headline1)}${T(b.x + 50, b.y + 228, 54, 900, "#3A0057", f.headline2)}${T(b.x + 50, b.y + 296, 54, 900, "#ff6a00", f.headline3)}${T(b.x + 50, b.y + 380, 46, 900, "#5A16A8", f.cta)}
  ${card.svg}${a.img}</svg>` };
};

// Panfleto 3 · etiqueta de presente: uma tag roxa "já é seu" e o QR embaixo, sem foto.
const panTag: Draw = (H, f) => {
  const card = qrCard(W / 2 - 190, H - 540, 300, "#ffffff", f.qrLabel, f.qrSub, "#3A0057");
  return { slots: [card.slot], svg: `${open(H)}<rect width="${W}" height="${H}" fill="#F47B20"/>
  ${logos("laranja", 230, 60)}
  <g transform="translate(${W / 2} 470) rotate(-5)"><path d="M-400 -230 L330 -230 L420 0 L330 230 L-400 230 Z" fill="#3A0057"/><circle cx="330" cy="0" r="26" fill="#F47B20"/>
  ${T(-350, -150, 32, 800, "#ffa040", f.kicker)}${T(-350, -70, 58, 300, "#fff", f.headline1)}${T(-350, 0, 58, 900, "#fff", f.headline2)}${T(-350, 110, 104, 900, "#ffa040", "JÁ É SEU.")}</g>
  ${T(W / 2, 800, 54, 900, "#fff", f.cta, "middle")}${card.svg}${T(W / 2, H - 40, 24, 700, "#3A0057", f.benefits, "middle")}</svg>` };
};

/** Windbanner: monta as duas faces com o mesmo conteúdo e o formato da bandeira. */
function flagOf(bg: string, inner: (x0: number, cx: number, H: number, id: string) => { svg: string; slot: Slot; defs?: string }): Draw {
  return (H) => {
    const pw = 470, slots: Slot[] = [];
    let defs = "";
    const panels = [20, 510].map((x0, i) => {
      const shape = `M${x0} ${H - 20} L${x0} 300 C${x0} 130 ${x0 + 100} 40 ${x0 + 235} 40 C${x0 + 370} 40 ${x0 + pw} 130 ${x0 + pw} 300 L${x0 + pw} ${H - 20} Z`;
      const r = inner(x0, x0 + pw / 2, H, `p${i}`);
      slots.push(r.slot); defs += r.defs ?? "";
      return `<clipPath id="fc${i}"><path d="${shape}"/></clipPath><g clip-path="url(#fc${i})"><rect x="${x0}" y="0" width="${pw}" height="${H}" fill="${bg}"/>${r.svg}</g>${bg === "#FFF8F2" ? `<path d="${shape}" fill="none" stroke="#E6D3F5" stroke-width="4"/>` : ""}`;
    });
    return { slots, svg: `${open(H, defs)}<rect width="${W}" height="${H}" fill="#ffffff"/>${panels.join("")}</svg>` };
  };
}
const qrSq = (cx: number, y: number, size: number, stroke = "") => ({ svg: `<rect x="${cx - size / 2 - 16}" y="${y - 16}" width="${size + 32}" height="${size + 32}" rx="22" fill="#fff" ${stroke}/>`, slot: { x: cx - size / 2, y, size } });

// Windbanner 1 · "JÁ É SEU." na vertical, roxo.
const wbVertical = (f: KitFields) => flagOf("#5A16A8", (x0, cx, H) => {
  const q = qrSq(cx, H - 330, 220);
  return { slot: q.slot, svg: `<path d="M${x0} ${H * 0.82} L${x0 + 470} ${H * 0.7} L${x0 + 470} ${H} L${x0} ${H} Z" fill="url(#nOr)"/>
  <image href="alle:allpfit-branco" x="${cx - 130}" y="150" width="260" height="56"/>
  <g transform="translate(${cx + 40} ${H * 0.42}) rotate(-90)">${T(0, 0, 120, 900, "#ffa040", "JÁ É SEU.", "middle")}</g>
  <g transform="translate(${cx - 95} ${H * 0.42}) rotate(-90)">${T(0, 0, 40, 300, "#fff", `${f.headline1} ${f.headline2}`, "middle")}</g>
  ${T(cx, H * 0.7 - 10, 40, 900, "#fff", f.cta, "middle")}${q.svg}` };
});
// Windbanner 2 · laranja com a Ane embaixo e o QR no meio (altura de leitura).
const wbAne = (f: KitFields) => flagOf("#F47B20", (x0, cx, H, id) => {
  const q = qrSq(cx, H * 0.4, 220);
  const ah = 520, aw = ah * ANE_RATIO;
  return { slot: q.slot, defs: `<linearGradient id="${id}f" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".15" stop-color="#fff"/><stop offset=".85" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}m" maskUnits="userSpaceOnUse" x="${cx - aw / 2}" y="${H - ah}" width="${aw}" height="${ah}"><rect x="${cx - aw / 2}" y="${H - ah}" width="${aw}" height="${ah}" fill="url(#${id}f)"/></mask>`,
    svg: `<image href="alle:allpfit-mono" x="${cx - 130}" y="150" width="260" height="56"/><image href="alle:logo-branco" x="${cx - 120}" y="230" width="240" height="70"/>
  ${T(cx, 400, 40, 300, "#fff", f.headline1, "middle")}${T(cx, 450, 40, 900, "#fff", f.headline2, "middle")}${T(cx, 520, 60, 900, "#3A0057", f.headline3, "middle")}
  ${q.svg}${T(cx, H * 0.4 + 300, 40, 900, "#fff", f.cta, "middle")}
  <image href="alle:ane" x="${cx - aw / 2}" y="${H - ah}" width="${aw}" height="${ah}" mask="url(#${id}m)"/>` };
});
// Windbanner 3 · claro com os 3 passos numerados e o QR.
const wbSteps = (f: KitFields) => flagOf("#FFF8F2", (x0, cx, H) => {
  const q = qrSq(cx, H - 330, 220, 'stroke="#ff6a00" stroke-width="6"');
  const steps = [f.step1, f.step2, f.step3].map((s, i) => `<circle cx="${x0 + 80}" cy="${620 + i * 110}" r="32" fill="url(#nOr)"/>${T(x0 + 80, 632 + i * 110, 32, 900, "#fff", String(i + 1), "middle")}${wrap(s, 14).map((l, j) => T(x0 + 130, 612 + i * 110 + j * 34, 30, 800, "#3A0057", l)).join("")}`).join("");
  return { slot: q.slot, svg: `<image href="alle:raio" x="${x0 + 250}" y="80" width="260" height="415" opacity="0.18"/>
  <image href="alle:allpfit-roxo" x="${cx - 130}" y="150" width="260" height="56"/><image href="alle:logo" x="${cx - 120}" y="230" width="240" height="70"/>
  ${T(cx, 380, 34, 300, "#3A0057", f.headline1, "middle")}${T(cx, 425, 34, 800, "#3A0057", f.headline2, "middle")}${T(cx, 490, 58, 900, "#ff6a00", f.headline3, "middle")}${T(cx, 545, 36, 900, "#3A0057", f.cta, "middle")}
  ${steps}${q.svg}` };
});
const flagDraw = (mk: (f: KitFields) => Draw): Draw => (H, f) => mk(f)(H, f);

// ── Designs feitos a partir da definição de cada material (KIT_FORMATS.purpose/guide) ──
const fundo = (x: number, y: number, w: number, h: number) => `<image href="alle:fundo-display" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
const LOGOS_W = 538;
/** "já é seu." → ["JÁ É", "SEU."]: a última palavra vai sozinha na segunda linha. */
const splitLast = (t: string) => { const w = t.toUpperCase().trim().split(/\s+/); return w.length > 1 ? [w.slice(0, -1).join(" "), w[w.length - 1]] : [w[0] ?? "", ""]; };
const fit = (t: string, max: number, maxW: number, weight = 900) => Math.min(max, Math.floor(maxW / Math.max(1, t.length * (weight >= 800 ? 0.68 : 0.58))));

// Display · totem de recepção: lido de perto, o QR grande no centro é a ação principal.
const dispTotem: Draw = (H, f) => {
  const q = qrSq(W / 2, 560, 400);
  const steps = [f.step1, f.step2, f.step3].map((s, i) => {
    const cx = 180 + i * 320;
    return `<circle cx="${cx}" cy="${1120}" r="34" fill="url(#nOr)"/>${T(cx, 1133, 36, 900, "#fff", String(i + 1), "middle")}${wrap(s, 14).map((l, j) => T(cx, 1205 + j * 36, 30, 800, "#fff", l, "middle")).join("")}`;
  }).join("");
  return { slots: [q.slot], svg: `${open(H)}${fundo(0, 0, W, H)}
  ${logos("roxo", (W - LOGOS_W) / 2, 56)}${T(W / 2, 250, 30, 800, "#ffa040", f.kicker, "middle", 'letter-spacing="2"')}
  ${T(W / 2, 320, 50, 300, "#fff", `${f.headline1} ${f.headline2}`, "middle")}${T(W / 2, 430, 100, 900, "#ffa040", f.headline3.toUpperCase(), "middle")}
  ${q.svg}${T(W / 2, 1035, 40, 900, "#fff", f.qrLabel, "middle", 'letter-spacing="1"')}${steps}</svg>` };
};

// Display · laranja: fundo laranja, só texto branco, QR num card roxo e a Ane na borda esquerda.
const dispOrange: Draw = (H, f) => {
  const a = aneAt("aneO", -30, H - 700, 700, "right", "ane-costas");
  const card = qrCard(W - 64 - 400, H - 600, 320, "#3A0057", f.qrLabel, f.qrSub, "#fff");
  return { slots: [card.slot], svg: `${open(H, a.defs)}<rect width="${W}" height="${H}" fill="url(#nOr)"/><path d="M${W} 0 L${W - 320} 0 L${W} 320 Z" fill="#5A16A8"/>
  ${logos("laranja")}${T(64, 250, 32, 800, "#fff", f.kicker, "start", 'letter-spacing="2"')}${T(60, 345, 80, 300, "#fff", f.headline1)}${T(60, 435, 80, 900, "#fff", f.headline2)}${T(56, 560, 120, 900, "#fff", f.headline3.toUpperCase())}
  ${T(64, 640, 50, 800, "#fff", f.cta)}${a.img}${card.svg}</svg>` };
};

// Banner · frase gigante: lido de longe e de passagem; uma frase enorme, uma linha de apoio e o QR.
const banGiant: Draw = (H, f) => {
  const [l1, l2] = splitLast(f.headline3);
  const card = qrCard(64, H - 546, 330, "#ffffff", f.qrLabel, "", "#3A0057");
  const a = aneAt("aneG", W - 640 * (773 / 1020) + 40, H - 640, 640, "left", "ane-costas");
  return { slots: [card.slot], svg: `${open(H, a.defs)}${fundo(0, 0, W, H)}
  ${logos("roxo")}${T(52, 370, 230, 900, "#fff", l1, "start", 'letter-spacing="-6"')}${T(48, 590, 240, 900, "#ffa040", l2, "start", 'letter-spacing="-6"')}
  ${T(64, 665, 44, 600, "#fff", `${f.headline1} ${f.headline2}`)}${T(64, 740, 56, 900, "#fff", f.cta)}
  ${a.img}${card.svg}</svg>` };
};

// Banner · faixa laranja: "Só falta ativar!" numa faixa atravessada e o QR grande no centro, sem foto.
const banStripe: Draw = (H, f) => {
  const q = qrSq(W / 2, 790, 390);
  const cta = f.cta.toUpperCase();
  return { slots: [q.slot], svg: `${open(H)}<rect width="${W}" height="${H}" fill="url(#nPu)"/>
  ${logos("roxo", (W - LOGOS_W) / 2, 56)}${T(W / 2, 250, 32, 800, "#ffa040", f.kicker, "middle", 'letter-spacing="2"')}
  ${T(W / 2, 330, 54, 600, "#fff", `${f.headline1} ${f.headline2}`, "middle")}${T(W / 2, 470, 140, 900, "#fff", f.headline3.toUpperCase(), "middle")}
  <g transform="translate(${W / 2} 610) rotate(-4)"><rect x="-${W / 2 + 60}" y="-70" width="${W + 120}" height="140" fill="url(#nOr)"/>${T(0, 28, fit(cta, 84, 900), 900, "#fff", cta, "middle")}</g>
  ${q.svg}${T(W / 2, H - 70, 42, 900, "#ffa040", f.qrLabel, "middle", 'letter-spacing="1"')}</svg>` };
};

// Banner · selo: um círculo laranja enorme com "JÁ É SEU." no centro, QR à esquerda e a Ane à direita.
const banSeal: Draw = (H, f) => {
  const [l1, l2] = splitLast(f.headline3);
  const cy = 445;
  const card = qrCard(64, H - 425, 270, "#ffffff", f.qrLabel, "", "#3A0057");
  const a = aneAt("aneS", W - 470 * (874 / 1006) + 40, H - 470, 470, "left", "ane-sorrindo");
  return { slots: [card.slot], svg: `${open(H, a.defs)}${fundo(0, 0, W, H)}
  ${logos("roxo", (W - LOGOS_W) / 2, 50)}
  <circle cx="${W / 2}" cy="${cy}" r="280" fill="url(#nOr)"/><circle cx="${W / 2}" cy="${cy}" r="250" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="8 12"/>
  ${T(W / 2, cy - 110, 30, 800, "#fff", f.kicker, "middle", 'letter-spacing="2"')}${T(W / 2, cy + 20, 130, 900, "#fff", l1, "middle")}${T(W / 2, cy + 160, 140, 900, "#fff", l2, "middle")}
  ${T(W / 2, 790, 44, 700, "#fff", `${f.headline1} ${f.headline2}`, "middle")}${T(W / 2, 850, 50, 900, "#ffa040", f.cta, "middle")}
  ${a.img}${card.svg}</svg>` };
};

// Panfleto · passo a passo: título, os 3 passos em faixas laranja e o QR ao lado.
const panSteps: Draw = (H, f) => {
  const card = qrCard(W - 64 - 390, 760, 330, "#ffffff", f.qrLabel, f.qrSub, "#3A0057");
  const rows = [f.step1, f.step2, f.step3].map((s, i) => {
    const y = 760 + i * 170;
    return `<rect x="64" y="${y}" width="460" height="120" rx="60" fill="url(#nOr)"/><circle cx="124" cy="${y + 60}" r="40" fill="#fff"/>${T(124, y + 75, 42, 900, "#ff6a00", String(i + 1), "middle")}${wrap(s, 16).map((l, j, all) => T(186, y + 72 - (all.length - 1) * 18 + j * 36, 32, 800, "#fff", l)).join("")}`;
  }).join("");
  return { slots: [card.slot], svg: `${open(H)}${fundo(0, 0, W, H)}
  ${logos("roxo")}${T(64, 260, 32, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(60, 345, 76, 300, "#fff", f.headline1)}${T(60, 430, 76, 900, "#fff", f.headline2)}${T(60, 515, 76, 900, "#ffa040", f.headline3)}
  ${T(64, 610, 48, 900, "#fff", f.cta)}${rows}${card.svg}
  <rect x="0" y="${H - 130}" width="${W}" height="130" fill="url(#nOr)"/>${T(W / 2, H - 52, 36, 900, "#fff", f.benefits, "middle")}</svg>` };
};

// Panfleto · benefícios: laranja, os 3 benefícios em cards roxos, QR num card roxo e a Ane.
const panPerks: Draw = (H, f) => {
  const perks = f.benefits.split("·").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const cw = (W - 128 - 2 * 24) / Math.max(1, perks.length);
  const cards = perks.map((p, i) => {
    const x = 64 + i * (cw + 24);
    return `<rect x="${x}" y="620" width="${cw}" height="150" rx="28" fill="#3A0057"/>${check(x + cw / 2, 668, 24, "#ffa040")}${T(x + cw / 2, 740, fit(p, 36, cw - 30), 900, "#fff", p, "middle")}`;
  }).join("");
  const a = aneAt("aneK", W - 640 * (883 / 1000) + 40, H - 640, 640, "left", "ane-queixo");
  const card = qrCard(64, H - 540, 300, "#3A0057", f.qrLabel, f.qrSub, "#fff");
  return { slots: [card.slot], svg: `${open(H, a.defs)}<rect width="${W}" height="${H}" fill="url(#nOr)"/><path d="M0 0 L300 0 L0 300 Z" fill="#5A16A8"/>
  ${logos("laranja", 230, 60)}${T(64, 260, 32, 800, "#fff", f.kicker, "start", 'letter-spacing="2"')}${T(60, 345, 76, 300, "#fff", f.headline1)}${T(60, 430, 76, 900, "#fff", f.headline2)}${T(60, 540, 110, 900, "#fff", f.headline3.toUpperCase())}
  ${cards}${T(64, 840, 52, 900, "#fff", f.cta)}${a.img}${card.svg}</svg>` };
};

// Panfleto · a Ane apresenta: a Ane na borda esquerda, a mensagem e os passos na coluna da direita.
const panAne: Draw = (H, f) => {
  const x0 = 440;
  const a = aneAt("aneN", -30, H - 640, 640, "right", "ane-queixo");
  const card = qrCard(x0 + 40, H - 560, 320, "#ffffff", f.qrLabel, f.qrSub, "#3A0057");
  const steps = [f.step1, f.step2, f.step3].map((s, i) => `<circle cx="${x0 + 26}" cy="${640 + i * 72}" r="26" fill="url(#nOr)"/>${T(x0 + 26, 651 + i * 72, 30, 900, "#fff", String(i + 1), "middle")}${T(x0 + 70, 651 + i * 72, 30, 700, "#fff", s)}`).join("");
  return { slots: [card.slot], svg: `${open(H, a.defs)}${fundo(0, 0, W, H)}
  ${logos("roxo")}${T(x0, 260, 30, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(x0 - 2, 330, 48, 300, "#fff", f.headline1)}${T(x0 - 2, 390, 48, 900, "#fff", f.headline2)}${T(x0 - 4, 475, 72, 900, "#ffa040", f.headline3)}
  ${T(x0, 550, 44, 900, "#fff", f.cta)}${steps}${a.img}${card.svg}</svg>` };
};

// Windbanner · logos gigantes: chama a atenção de longe; logos grandes e "JÁ / É / SEU." empilhado.
const wbLogos = (f: KitFields) => flagOf("#4b1d80", (x0, cx, H) => {
  const q = qrSq(cx, H - 300, 230);
  const words = f.headline3.toUpperCase().trim().split(/\s+/);
  const big = words.map((w, i) => T(cx, 560 + i * 150, fit(w, 160, 420), 900, i === words.length - 1 ? "#ffa040" : "#fff", w, "middle")).join("");
  return { slot: q.slot, svg: `${fundo(x0, 0, 470, H)}
  <image href="alle:allpfit-branco" x="${cx - 180}" y="150" width="360" height="78"/><image href="alle:logo-branco" x="${cx - 170}" y="255" width="340" height="100"/>
  ${big}${T(cx, 580 + words.length * 150 - 60, fit(f.cta, 46, 420), 900, "#fff", f.cta, "middle")}
  ${T(cx, H - 330, 30, 900, "#ffa040", f.qrLabel, "middle", 'letter-spacing="1"')}${q.svg}` };
});
// Windbanner · laranja vertical: a frase gigante na vertical, ao longo da bandeira, e o QR num bloco roxo embaixo.
const wbOrange = (f: KitFields) => flagOf("#F47B20", (x0, cx, H) => {
  const q = qrSq(cx, H - 280, 200);
  const h3 = f.headline3.toUpperCase();
  return { slot: q.slot, svg: `<rect x="${x0}" y="0" width="470" height="${H}" fill="url(#nOr)"/>
  <image href="alle:allpfit-mono" x="${cx - 150}" y="140" width="300" height="65"/><image href="alle:logo-branco" x="${cx - 140}" y="225" width="280" height="82"/>
  <g transform="translate(${cx + 55} ${H * 0.47}) rotate(-90)">${T(0, 0, fit(h3, 150, 640), 900, "#fff", h3, "middle")}</g>
  <g transform="translate(${cx - 105} ${H * 0.47}) rotate(-90)">${T(0, 0, 40, 700, "#fff", `${f.headline1} ${f.headline2}`, "middle")}</g>
  <rect x="${x0}" y="${H - 380}" width="470" height="380" fill="#3A0057"/>${T(cx, H - 315, 30, 900, "#fff", f.qrLabel, "middle", 'letter-spacing="1"')}${q.svg}` };
});
// Windbanner · faixas: fundo roxo com faixas laranja e "ATIVE / SEU / BENEFÍCIO" empilhado.
const wbStripes = (f: KitFields) => flagOf("#4b1d80", (x0, cx, H) => {
  const q = qrSq(cx, H - 290, 220);
  const words = f.step3.toUpperCase().trim().split(/\s+/);
  const big = words.map((w, i) => T(cx, 520 + i * 115, fit(w, 120, 410), 900, "#fff", w, "middle")).join("");
  const yEnd = 520 + (words.length - 1) * 115;
  return { slot: q.slot, svg: `${fundo(x0, 0, 470, H)}
  <path d="M${x0} ${yEnd + 90} L${x0 + 470} ${yEnd + 20} L${x0 + 470} ${yEnd + 90} L${x0} ${yEnd + 160} Z" fill="url(#nOr)"/>
  <path d="M${x0} 390 L${x0 + 470} 330 L${x0 + 470} 355 L${x0} 415 Z" fill="url(#nOr)"/>
  <image href="alle:allpfit-branco" x="${cx - 150}" y="150" width="300" height="65"/><image href="alle:logo-branco" x="${cx - 140}" y="235" width="280" height="82"/>
  ${big}${T(cx, yEnd + 250, fit(f.headline3, 70, 420), 900, "#ffa040", f.headline3, "middle")}
  ${T(cx, H - 320, 30, 900, "#fff", f.qrLabel, "middle", 'letter-spacing="1"')}${q.svg}` };
});

// ── Mais opções (2 por material) ──
const P_ = "#3A0057";

// Display · cartão branco: o QR enorme num cartão branco no centro, sem foto.
const dispCard: Draw = (H, f) => {
  const qr = { x: W / 2 - 210, y: 560, size: 420 };
  return { slots: [qr], svg: `${open(H)}${fundo(0, 0, W, H)}
  ${logos("roxo", (W - LOGOS_W) / 2, 50)}${T(W / 2, 200, 30, 800, "#ffa040", f.kicker, "middle", 'letter-spacing="2"')}
  ${T(W / 2, 270, 46, 600, "#fff", `${f.headline1} ${f.headline2}`, "middle")}${T(W / 2, 385, 100, 900, "#ffa040", f.headline3.toUpperCase(), "middle")}
  <rect x="${W / 2 - 300}" y="450" width="600" height="680" rx="44" fill="#fff"/>${T(W / 2, 520, 36, 900, P_, f.qrLabel, "middle", 'letter-spacing="1"')}${T(W / 2, 1060, 26, 600, P_, f.qrSub, "middle")}
  ${T(W / 2, 1230, 64, 900, "#fff", f.cta, "middle")}${T(W / 2, 1300, 28, 600, "#fff", f.benefits, "middle")}</svg>` };
};

// Display · faixa lateral: faixa laranja à esquerda com o QR e os passos; mensagem e a Ane à direita.
const dispBand: Draw = (H, f) => {
  const q = qrSq(200, 340, 300);
  const a = aneAt("aneBd", W - 760 * (773 / 1020) + 30, H - 760, 760, "left", "ane-costas");
  const steps = [f.step1, f.step2, f.step3].map((s, i) => {
    const y = 760 + i * 150;
    return `<circle cx="70" cy="${y}" r="32" fill="#fff"/>${T(70, y + 12, 34, 900, "#ff6a00", String(i + 1), "middle")}${wrap(s, 13).map((l, j) => T(118, y + 10 + j * 34, 30, 800, "#fff", l)).join("")}`;
  }).join("");
  return { slots: [q.slot], svg: `${open(H, a.defs)}${fundo(0, 0, W, H)}<rect width="400" height="${H}" fill="url(#nOr)"/>
  ${T(200, 300, 30, 900, "#fff", f.qrLabel, "middle", 'letter-spacing="1"')}${q.svg}${steps}
  ${logos("roxo", 432, 56)}${T(440, 250, 28, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(438, 320, 56, 300, "#fff", f.headline1)}${T(438, 385, 56, 900, "#fff", f.headline2)}${T(436, 480, 84, 900, "#ffa040", f.headline3)}
  ${T(440, 560, 44, 900, "#fff", f.cta)}${a.img}</svg>` };
};

// Banner · QR gigante: para escanear de longe, o QR ocupa o centro; uma frase em cima e o "Só falta ativar!".
const banQr: Draw = (H, f) => {
  const qr = { x: W / 2 - 255, y: 480, size: 510 };
  return { slots: [qr], svg: `${open(H)}${fundo(0, 0, W, H)}
  ${logos("roxo", (W - LOGOS_W) / 2, 50)}${T(W / 2, 205, 32, 800, "#ffa040", f.kicker, "middle", 'letter-spacing="2"')}${T(W / 2, 330, 124, 900, "#fff", f.headline3.toUpperCase(), "middle")}
  <rect x="${W / 2 - 300}" y="390" width="600" height="700" rx="44" fill="#fff"/>${T(W / 2, 455, 38, 900, P_, f.qrLabel, "middle", 'letter-spacing="1"')}${T(W / 2, 1050, 26, 600, P_, f.qrSub, "middle")}
  ${T(W / 2, 1210, 72, 900, "#ffa040", f.cta, "middle")}</svg>` };
};

// Banner · a Ane grande: a Ane com a mão no queixo ocupando a esquerda e o QR num card laranja à direita.
const banAneBig: Draw = (H, f) => {
  const a = aneAt("aneQ", -30, H - 800, 800, "right", "ane-queixo");
  const card = qrCard(W - 64 - 370, H - 520, 290, "url(#nOr)", f.cta, f.qrLabel, "#fff");
  return { slots: [card.slot], svg: `${open(H, a.defs)}<rect width="${W}" height="${H}" fill="url(#nPu)"/><path d="M${W - 220} 0 L${W} 0 L${W} 220 Z" fill="url(#nOr)"/>
  ${logos("roxo")}${T(64, 215, 32, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(58, 365, 150, 900, "#fff", f.headline3.toUpperCase(), "start", 'letter-spacing="-3"')}
  ${T(64, 440, 44, 600, "#fff", `${f.headline1} ${f.headline2}`)}${a.img}${card.svg}</svg>` };
};

// Panfleto · perguntas: "Tem custo? NÃO." para tirar as dúvidas rápido, o QR e a Ane.
const panFaq: Draw = (H, f) => {
  const rows = ["Tem custo?", "Precisa de obra?", "Tem fidelidade?"].map((q, i) => {
    const y = 590 + i * 110;
    return `<rect x="64" y="${y}" width="520" height="90" rx="45" fill="#fff" opacity=".12"/>${T(104, y + 57, 34, 800, "#fff", q)}<rect x="${64 + 520 - 150}" y="${y + 13}" width="136" height="64" rx="32" fill="url(#nOr)"/>${T(64 + 520 - 82, y + 57, 32, 900, "#fff", "NÃO", "middle")}`;
  }).join("");
  const a = aneAt("aneC", W - 620 * (773 / 1020) + 40, H - 620, 620, "left", "ane-costas");
  const card = qrCard(64, H - 430, 260, "#ffffff", f.qrLabel, f.qrSub, P_);
  return { slots: [card.slot], svg: `${open(H, a.defs)}${fundo(0, 0, W, H)}
  ${logos("roxo")}${T(64, 250, 30, 800, "#ffa040", f.kicker, "start", 'letter-spacing="2"')}${T(60, 330, 64, 300, "#fff", f.headline1)}${T(60, 405, 64, 900, "#fff", f.headline2)}${T(58, 510, 90, 900, "#ffa040", f.headline3)}
  ${rows}${T(64, 965, 48, 900, "#fff", f.cta)}${a.img}${card.svg}</svg>` };
};

// Panfleto · dividido: laranja em cima com a mensagem e o QR, roxo embaixo com os passos e a Ane.
const panSplit: Draw = (H, f) => {
  const Z = Math.round(H * 0.52);
  const card = qrCard(W - 64 - 340, 220, 260, P_, f.qrLabel, f.qrSub, "#fff");
  const a = aneAt("aneDv", W - 640 * (874 / 1006) + 20, H - 640, 640, "left", "ane-sorrindo");
  const steps = [f.step1, f.step2, f.step3].map((s, i) => {
    const y = Z + 140 + i * 110;
    return `<circle cx="96" cy="${y}" r="32" fill="url(#nOr)"/>${T(96, y + 12, 34, 900, "#fff", String(i + 1), "middle")}${T(148, y + 11, 32, 800, "#fff", s)}`;
  }).join("");
  return { slots: [card.slot], svg: `${open(H, a.defs)}${fundo(0, 0, W, H)}<rect width="${W}" height="${Z}" fill="url(#nOr)"/>
  ${logos("laranja")}${T(64, 250, 30, 800, "#fff", f.kicker, "start", 'letter-spacing="2"')}${T(62, 320, 50, 300, "#fff", f.headline1)}${T(62, 380, 50, 900, "#fff", f.headline2)}${T(60, 475, 80, 900, "#fff", f.headline3.toUpperCase())}
  ${T(64, 560, 44, 900, "#fff", f.cta)}${T(64, Z + 70, 30, 900, "#ffa040", "COMO ATIVAR", "start", 'letter-spacing="2"')}${steps}${a.img}${card.svg}</svg>` };
};

// Windbanner · raio: roxo com o raio da marca ao fundo e "SEU / DESCONTO / NA CONTA / DE LUZ" empilhado.
const wbBolt = (f: KitFields) => flagOf("#3A0057", (x0, cx, H) => {
  const q = qrSq(cx, H - 290, 220);
  const lines = wrap(`${f.headline1} ${f.headline2}`.toUpperCase(), 8);
  const big = lines.map((l, i) => T(cx, 470 + i * 112, fit(l, 110, 360), 900, "#fff", l, "middle")).join("");
  const yEnd = 470 + (lines.length - 1) * 112;
  return { slot: q.slot, svg: `${fundo(x0, 0, 470, H)}<image href="alle:raio-mono" x="${cx - 220}" y="330" width="440" height="702" opacity=".1"/>
  <image href="alle:allpfit-branco" x="${cx - 150}" y="150" width="300" height="65"/><image href="alle:logo-branco" x="${cx - 140}" y="235" width="280" height="82"/>
  ${big}${T(cx, yEnd + 130, fit(f.headline3.toUpperCase(), 84, 420), 900, "#ffa040", f.headline3.toUpperCase(), "middle")}
  ${T(cx, H - 320, 30, 900, "#fff", f.qrLabel, "middle", 'letter-spacing="1"')}${q.svg}` };
});
// Windbanner · meio a meio: roxo em cima com "SÓ / FALTA / ATIVAR!" e laranja embaixo com o QR.
const wbHalf = (f: KitFields) => flagOf("#3A0057", (x0, cx, H) => {
  const q = qrSq(cx, H - 290, 220);
  const Z = Math.round(H * 0.56);
  const lines = wrap(f.cta.toUpperCase(), 7);
  const big = lines.map((l, i) => T(cx, 480 + i * 130, fit(l, 130, 360), 900, "#fff", l, "middle")).join("");
  return { slot: q.slot, svg: `<rect x="${x0}" y="0" width="470" height="${Z}" fill="url(#nPu)"/><rect x="${x0}" y="${Z}" width="470" height="${H - Z}" fill="url(#nOr)"/>
  <image href="alle:allpfit-branco" x="${cx - 150}" y="150" width="300" height="65"/><image href="alle:logo-branco" x="${cx - 140}" y="235" width="280" height="82"/>
  ${big}${T(cx, Z + 95, fit(f.headline3.toUpperCase(), 70, 420), 900, "#fff", f.headline3.toUpperCase(), "middle")}
  ${T(cx, H - 320, 30, 900, "#fff", f.qrLabel, "middle", 'letter-spacing="1"')}${q.svg}` };
});
