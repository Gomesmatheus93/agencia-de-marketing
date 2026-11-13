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
  display: { label: "Display", wCm: 21, hCm: 29.7, dpi: 300, layout: "poster" },
  banner: { label: "Banner", wCm: 90.02, hCm: 120.24, dpi: 120, layout: "poster" },
  panfleto: { label: "Panfleto", wCm: 37.31, hCm: 52.92, dpi: 150, layout: "poster" },
  windbanner: { label: "Windbanner", wCm: 111.57, hCm: 156.9, dpi: 100, layout: "flag" },
} as const;
export type KitFormat = keyof typeof KIT_FORMATS;
const formatSchema = z.enum(Object.keys(KIT_FORMATS) as [KitFormat, ...KitFormat[]]);

export const KIT_DEFAULTS = {
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
  wbLine1: "Desconto na",
  wbLine2: "conta de luz",
};
export type KitFields = typeof KIT_DEFAULTS;
const fieldsSchema = z.object(Object.fromEntries(Object.keys(KIT_DEFAULTS).map((k) => [k, z.string().max(220)])) as Record<keyof KitFields, z.ZodString>);

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

/**
 * Cartaz (display, banner e panfleto), focado em ativação: o aluno já tem o desconto, falta ativar.
 * Topo roxo com a mensagem e a Ane (recortada na borda da faixa, sem invadir o resto);
 * base clara com os 3 passos e o QR em destaque ("Ative agora").
 */
function posterSvg(H: number, f: KitFields): { svg: string; slots: Slot[] } {
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

function buildSvg(format: KitFormat, fields: KitFields) {
  const H = heightOf(format);
  return KIT_FORMATS[format].layout === "flag" ? flagSvg(H, fields) : posterSvg(H, fields);
}

const withAssets = (svg: string) => svg.replace(/href="(alle:[a-z-]+)"/g, (m, k: string) => (BRAND_ASSETS[k] ? `href="${BRAND_ASSETS[k]}"` : m));
const renderSvg = (svg: string, width: number) =>
  Buffer.from(new Resvg(withAssets(svg), { fitTo: { mode: "width", value: width }, font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Montserrat" } }).render().asPng());

/** Desenho de "QR aqui" para a prévia sem academia. */
const placeholderQr = (s: Slot) =>
  `<rect x="${s.x}" y="${s.y}" width="${s.size}" height="${s.size}" fill="#f1e9fb"/>` +
  T(s.x + s.size / 2, s.y + s.size / 2 - 4, s.size * 0.1, 800, "#7B2FBE", "QR da", "middle") +
  T(s.x + s.size / 2, s.y + s.size / 2 + s.size * 0.12, s.size * 0.1, 800, "#7B2FBE", "academia", "middle");

/** Prévia (JPEG em data URL) com o QR de uma academia ou o espaço reservado. */
export function previewKit(format: KitFormat, fields: KitFields, qrData: string | null, width = 900) {
  const { svg, slots } = buildSvg(format, fields);
  const extra = slots.map((s) => (qrData ? qrSvgGroup(qrData, s.x, s.y, s.size) : placeholderQr(s))).join("");
  return renderSvg(svg.replace("</svg>", `${extra}</svg>`), width);
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
async function generateFor(format: KitFormat, fields: KitFields, list: Array<{ id: number; name: string; qr: string }>, mode: "pendente" | "conferir", onProgress?: (done: number) => void) {
  const { svg, slots } = buildSvg(format, fields);
  const px = pxOf(format);
  const scale = px.w / W;
  const base = await sharp(renderSvg(svg, px.w)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
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

async function fieldsOf(format: KitFormat): Promise<KitFields> {
  const c = await conn();
  const [row] = await c.select().from(unitKitTemplates).where(eq(unitKitTemplates.format, format));
  return { ...KIT_DEFAULTS, ...(row?.fields ?? {}) } as KitFields;
}

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
    return Object.keys(KIT_FORMATS).map((format) => {
      const r = rows.find((x) => x.format === format);
      const desc = `Impressão › ${KIT_FORMATS[format as KitFormat].label}`;
      const pending = mats.filter((m) => m.description === desc && m.pending);
      return {
        format, fields: { ...KIT_DEFAULTS, ...(r?.fields ?? {}) }, updatedAt: r?.updatedAt ?? null,
        generatedAt: r?.generatedAt ?? null, generatedCount: r?.generatedCount ?? 0, approvedAt: r?.approvedAt ?? null,
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
      await tx.insert(unitKitTemplates).values({ format: input.format, fields: KIT_DEFAULTS, approvedAt: new Date(), approvedByUserId: ctx.actualUser!.id })
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

  defaults: adminProcedure.query(() => KIT_DEFAULTS),

  /** Unidades que podem receber o material (têm QR ou link). */
  units: adminProcedure.query(async () => (await unitsWithQr()).map((u) => ({ id: u.id, name: u.name }))),

  save: adminProcedure.input(z.object({ format: formatSchema, fields: fieldsSchema })).mutation(async ({ input }) => {
    const c = await conn();
    await c.insert(unitKitTemplates).values({ format: input.format, fields: input.fields, updatedAt: new Date() })
      .onConflictDoUpdate({ target: unitKitTemplates.format, set: { fields: input.fields, updatedAt: new Date() } });
    return { ok: true };
  }),

  preview: adminProcedure.input(z.object({ format: formatSchema, fields: fieldsSchema, unitId: z.number().int().nullable() })).mutation(async ({ input }) => {
    const u = input.unitId ? (await unitsWithQr([input.unitId]))[0] : null;
    const png = previewKit(input.format, input.fields, u?.qr ?? null, 900);
    const jpg = await sharp(png).jpeg({ quality: 85 }).toBuffer();
    return { dataUrl: `data:image/jpeg;base64,${jpg.toString("base64")}` };
  }),

  /** Gera para uma academia só e devolve o PDF (para conferir ou mandar para a gráfica). */
  exportOne: adminProcedure.input(z.object({ format: formatSchema, unitId: z.number().int() })).mutation(async ({ input }) => {
    const list = await unitsWithQr([input.unitId]);
    if (!list.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta academia ainda não tem QR code nem link cadastrado." });
    const [r] = await generateFor(input.format, await fieldsOf(input.format), list, "conferir");
    return { url: r.url };
  }),

  /** Gera para todas as academias com QR (em segundo plano). */
  generateAll: adminProcedure.input(z.object({ format: formatSchema })).mutation(async ({ ctx, input }) => {
    if (job && !job.finishedAt) throw new TRPCError({ code: "CONFLICT", message: `Já existe uma geração em andamento (${KIT_FORMATS[job.format].label}).` });
    const list = await unitsWithQr();
    const fields = await fieldsOf(input.format);
    const current = { format: input.format, total: list.length, done: 0, error: null as string | null, finishedAt: null as Date | null };
    job = current;
    void (async () => {
      try {
        await generateFor(input.format, fields, list, "pendente", (d) => { current.done = d; });
        const c = await conn();
        await c.insert(unitKitTemplates).values({ format: input.format, fields, generatedAt: new Date(), generatedCount: list.length })
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
