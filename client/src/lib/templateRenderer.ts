/**
 * Template Renderer — Fase 3
 *
 * Converte TemplateDefinition + ContentBlock[] em PNG data-URLs (1080×1350).
 * Renderização 100% client-side: SVG → Canvas API → PNG.
 *
 * API pública:
 *   renderTemplate(template, blocks, images?, brandKit?) → Promise<string[]>
 */

import type {
  TemplateDefinition,
  TemplatePalette,
  SlideDefinition,
  SlideRole,
  ContentBlock,
} from "@shared/_core/templateTypes";

// ─── Public types ─────────────────────────────────────────────────────────────

export type { ContentBlock };

export type RenderBrandKit = {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  profileName?: string;
  profileHandle?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1350;
const FONT_FAMILY = "system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

// ─── Slot assignment ──────────────────────────────────────────────────────────

/**
 * Distributes content blocks into ordered slide slots.
 *
 * Rules:
 *  - Slot 0 (hook): always the first block (type "hook") — falls back to first block.
 *  - Last slot (cta): always the last block (type "cta") — falls back to last block.
 *  - Second-to-last slot (saveable): block with the most items[] or longest body.
 *  - Remaining slots (development): fill in block order.
 */
function assignBlocksToSlots(
  templateSlides: SlideDefinition[],
  blocks: ContentBlock[]
): Array<{ slot: SlideDefinition; block: ContentBlock }> {
  if (blocks.length === 0 || templateSlides.length === 0) return [];

  const hookSlots = templateSlides.filter((s) => s.role === "hook");
  const ctaSlots = templateSlides.filter((s) => s.role === "cta");
  const saveableSlots = templateSlides.filter((s) => s.role === "saveable");
  const devSlots = templateSlides.filter((s) => s.role === "development");

  const hookBlocks = blocks.filter((b) => b.type === "hook");
  const ctaBlocks = blocks.filter((b) => b.type === "cta");
  const saveableBlocks = blocks.filter(
    (b) => b.type === "list_item" && (b.items?.length ?? 0) >= 3
  );
  const middleBlocks = blocks.filter(
    (b) => b.type !== "hook" && b.type !== "cta"
  );

  const result: Array<{ slot: SlideDefinition; block: ContentBlock }> = [];

  // Hook slot
  if (hookSlots[0]) {
    result.push({ slot: hookSlots[0], block: hookBlocks[0] ?? blocks[0]! });
  }

  // Development slots — fill with middle blocks cycling
  devSlots.forEach((slot, i) => {
    const candidateBlock =
      middleBlocks[i % middleBlocks.length] ?? blocks[Math.min(i + 1, blocks.length - 2)] ?? blocks[0]!;
    result.push({ slot, block: candidateBlock });
  });

  // Saveable slot (penúltimo)
  if (saveableSlots[0]) {
    const saveBlock =
      saveableBlocks[0] ??
      middleBlocks.find((b) => b.type === "list_item") ??
      middleBlocks[middleBlocks.length - 1] ??
      blocks[blocks.length - 2] ??
      blocks[0]!;
    result.push({ slot: saveableSlots[0], block: saveBlock });
  }

  // CTA slot (último)
  if (ctaSlots[0]) {
    result.push({ slot: ctaSlots[0], block: ctaBlocks[0] ?? blocks[blocks.length - 1]! });
  }

  return result;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wraps long text into tspan lines. Returns array of tspan elements. */
function wrapText(
  text: string,
  maxCharsPerLine: number,
  x: number,
  fontSize: number,
  fill: string,
  fontWeight: string | number = 400,
  lineHeightMultiplier = 1.25
): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  const lineH = fontSize * lineHeightMultiplier;
  const totalH = lineH * lines.length;

  return lines
    .map((line, i) => {
      const dy = i === 0 ? -totalH / 2 + lineH / 2 : lineH;
      return `<tspan x="${x}" dy="${dy}" fill="${esc(fill)}" font-weight="${fontWeight}">${esc(line)}</tspan>`;
    })
    .join("");
}

/** Generates a linear gradient def for slide backgrounds. */
function backgroundGradient(id: string, palette: TemplatePalette): string {
  return `<defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${esc(palette.background)}"/>
      <stop offset="100%" stop-color="${esc(palette.surface)}"/>
    </linearGradient>
  </defs>`;
}

/** Renders an embedded base64 image with optional overlay. */
function imageBlock(
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number,
  overlayColor = "rgba(0,0,0,0.35)"
): string {
  if (!dataUrl) return "";
  return `
    <image href="${dataUrl}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(overlayColor)}" rx="0"/>
  `;
}

/** Top accent bar. */
function accentBar(palette: TemplatePalette, width = 80, height = 4, x = 540, y = 80): string {
  return `<rect x="${x - width / 2}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="${esc(palette.primary)}"/>`;
}

/** Small profile badge at bottom. */
function profileBadge(
  palette: TemplatePalette,
  name: string,
  handle: string,
  font: string
): string {
  const displayName = name || "KrythosLab";
  const displayHandle = handle ? `@${handle.replace("@", "")}` : "@krythoslab";
  return `
    <g>
      <text x="68" y="${H - 56}" font-family="${esc(font)}" font-size="20" font-weight="700" fill="${esc(palette.text)}">${esc(displayName)}</text>
      <text x="68" y="${H - 34}" font-family="${esc(font)}" font-size="17" fill="${esc(palette.textMuted)}">${esc(displayHandle)}</text>
    </g>
  `;
}

// ─── Slide SVG builders ───────────────────────────────────────────────────────

function buildHookSvg(
  block: ContentBlock,
  slot: SlideDefinition,
  palette: TemplatePalette,
  image: string,
  brandKit: RenderBrandKit,
  font: string
): string {
  const title = block.title ?? block.body ?? "Você está cometendo esse erro?";
  const hasImage = !!image;
  const imageH = hasImage ? 560 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backgroundGradient("hookBg", palette)}
    <rect width="${W}" height="${H}" fill="url(#hookBg)"/>

    ${hasImage ? imageBlock(image, 0, 0, W, imageH + 80, "rgba(0,0,0,0.28)") : ""}

    ${accentBar(palette, 100, 5, 540, hasImage ? imageH + 60 : 100)}

    <text
      font-family="${esc(font)}"
      font-size="62"
      font-weight="800"
      text-anchor="middle"
      x="${W / 2}"
      y="${hasImage ? imageH + 200 : 420}"
    >${wrapText(title, 20, W / 2, 62, palette.text, 800)}</text>

    <rect x="0" y="${H - 120}" width="${W}" height="120" fill="${palette.surface}" opacity="0.6"/>
    ${profileBadge(palette, brandKit.profileName ?? "", brandKit.profileHandle ?? "", font)}

    <rect x="${W - 100}" y="${H - 90}" width="72" height="36" rx="18" fill="${esc(palette.primary)}" opacity="0.15"/>
    <text x="${W - 64}" y="${H - 67}" font-family="${esc(font)}" font-size="14" font-weight="700" fill="${esc(palette.primary)}" text-anchor="middle">1 →</text>
  </svg>`;
}

function buildStatSvg(
  block: ContentBlock,
  slot: SlideDefinition,
  palette: TemplatePalette,
  image: string,
  brandKit: RenderBrandKit,
  font: string,
  index: number,
  total: number
): string {
  const value = block.value ?? block.title ?? "—";
  const label = block.label ?? block.body ?? "";
  const title = block.title && block.title !== value ? block.title : undefined;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backgroundGradient("statBg", palette)}
    <rect width="${W}" height="${H}" fill="url(#statBg)"/>

    ${accentBar(palette, 60, 4, 540, 90)}

    ${title ? `<text x="${W / 2}" y="155" font-family="${esc(font)}" font-size="24" font-weight="600" fill="${esc(palette.textMuted)}" text-anchor="middle">${esc(title)}</text>` : ""}

    <text
      x="${W / 2}" y="620"
      font-family="${esc(font)}"
      font-size="180"
      font-weight="900"
      fill="${esc(palette.primary)}"
      text-anchor="middle"
    >${esc(value)}</text>

    ${label ? `<text x="${W / 2}" y="740" font-family="${esc(font)}" font-size="32" font-weight="400" fill="${esc(palette.textMuted)}" text-anchor="middle">${esc(label)}</text>` : ""}

    <rect x="0" y="${H - 120}" width="${W}" height="120" fill="${palette.surface}" opacity="0.5"/>
    ${profileBadge(palette, brandKit.profileName ?? "", brandKit.profileHandle ?? "", font)}
    <text x="${W - 68}" y="${H - 56}" font-family="${esc(font)}" font-size="18" fill="${esc(palette.textMuted)}" text-anchor="end">${index + 1}/${total}</text>
  </svg>`;
}

function buildListSvg(
  block: ContentBlock,
  slot: SlideDefinition,
  palette: TemplatePalette,
  _image: string,
  brandKit: RenderBrandKit,
  font: string,
  index: number,
  total: number
): string {
  const title = block.title ?? "";
  const items = block.items ?? (block.body ? block.body.split("•").map((s) => s.trim()).filter(Boolean) : []);
  const isSaveable = slot.role === "saveable";

  const itemsHtml = items
    .slice(0, 6)
    .map((item, i) => {
      const yPos = 340 + i * 120;
      return `
        <rect x="60" y="${yPos - 32}" width="48" height="48" rx="12" fill="${esc(palette.primary)}" opacity="${isSaveable ? "1" : "0.18"}"/>
        <text x="84" y="${yPos}" font-family="${esc(font)}" font-size="22" font-weight="700" fill="${isSaveable ? esc(palette.background) : esc(palette.primary)}" text-anchor="middle">${i + 1}</text>
        <text x="130" y="${yPos}" font-family="${esc(font)}" font-size="28" font-weight="500" fill="${esc(palette.text)}">${esc(item.slice(0, 52))}</text>
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backgroundGradient("listBg", palette)}
    <rect width="${W}" height="${H}" fill="url(#listBg)"/>

    ${isSaveable ? `<rect x="0" y="0" width="${W}" height="8" fill="${esc(palette.primary)}"/>` : accentBar(palette, 60, 4, 540, 90)}

    ${title ? `<text x="${W / 2}" y="195" font-family="${esc(font)}" font-size="36" font-weight="700" fill="${esc(palette.text)}" text-anchor="middle">${esc(title.slice(0, 36))}</text>` : ""}

    <line x1="60" y1="230" x2="${W - 60}" y2="230" stroke="${esc(palette.primary)}" stroke-width="1" opacity="0.3"/>

    ${itemsHtml}

    <rect x="0" y="${H - 120}" width="${W}" height="120" fill="${palette.surface}" opacity="0.5"/>
    ${profileBadge(palette, brandKit.profileName ?? "", brandKit.profileHandle ?? "", font)}
    <text x="${W - 68}" y="${H - 56}" font-family="${esc(font)}" font-size="18" fill="${esc(palette.textMuted)}" text-anchor="end">${index + 1}/${total}</text>
  </svg>`;
}

function buildQuoteSvg(
  block: ContentBlock,
  _slot: SlideDefinition,
  palette: TemplatePalette,
  image: string,
  brandKit: RenderBrandKit,
  font: string,
  index: number,
  total: number
): string {
  const body = block.body ?? block.title ?? "";
  const hasImage = !!image;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backgroundGradient("quoteBg", palette)}
    <rect width="${W}" height="${H}" fill="url(#quoteBg)"/>

    ${hasImage ? imageBlock(image, 0, 0, W, 440, "rgba(0,0,0,0.5)") : ""}

    <text x="80" y="540" font-family="Georgia, serif" font-size="120" fill="${esc(palette.primary)}" opacity="0.35">"</text>

    <text
      x="${W / 2}" y="700"
      font-family="${esc(font)}"
      font-size="40"
      font-weight="400"
      text-anchor="middle"
      font-style="italic"
    >${wrapText(body, 28, W / 2, 40, palette.text, 400, 1.4)}</text>

    <rect x="${W / 2 - 30}" y="${H - 180}" width="60" height="4" rx="2" fill="${esc(palette.primary)}" opacity="0.6"/>

    <rect x="0" y="${H - 120}" width="${W}" height="120" fill="${palette.surface}" opacity="0.5"/>
    ${profileBadge(palette, brandKit.profileName ?? "", brandKit.profileHandle ?? "", font)}
    <text x="${W - 68}" y="${H - 56}" font-family="${esc(font)}" font-size="18" fill="${esc(palette.textMuted)}" text-anchor="end">${index + 1}/${total}</text>
  </svg>`;
}

function buildComparisonSvg(
  block: ContentBlock,
  _slot: SlideDefinition,
  palette: TemplatePalette,
  _image: string,
  brandKit: RenderBrandKit,
  font: string,
  index: number,
  total: number
): string {
  const title = block.title ?? "";
  const sideA = block.compareA ?? "Antes";
  const sideB = block.compareB ?? "Depois";
  const mid = W / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backgroundGradient("compBg", palette)}
    <rect width="${W}" height="${H}" fill="url(#compBg)"/>

    ${title ? `<text x="${mid}" y="160" font-family="${esc(font)}" font-size="34" font-weight="700" fill="${esc(palette.text)}" text-anchor="middle">${esc(title.slice(0, 36))}</text>` : ""}

    <rect x="52" y="220" width="${mid - 72}" height="${H - 420}" rx="20" fill="${esc(palette.surface)}" opacity="0.7"/>
    <text x="${mid / 2}" y="290" font-family="${esc(font)}" font-size="18" font-weight="600" fill="${esc(palette.textMuted)}" text-anchor="middle">SEM SOLAR</text>
    <text x="${mid / 2}" y="560" font-family="${esc(font)}" font-size="38" font-weight="700" fill="${esc(palette.text)}" text-anchor="middle">${wrapText(sideA, 14, mid / 2, 38, palette.text, 700)}</text>

    <rect x="${mid + 20}" y="220" width="${mid - 72}" height="${H - 420}" rx="20" fill="${esc(palette.primary)}" opacity="0.15"/>
    <rect x="${mid + 20}" y="220" width="${mid - 72}" height="6" rx="3" fill="${esc(palette.primary)}"/>
    <text x="${mid + (mid - 72) / 2 + 20}" y="290" font-family="${esc(font)}" font-size="18" font-weight="600" fill="${esc(palette.primary)}" text-anchor="middle">COM SOLAR</text>
    <text x="${mid + (mid - 72) / 2 + 20}" y="560" font-family="${esc(font)}" font-size="38" font-weight="700" fill="${esc(palette.text)}" text-anchor="middle">${wrapText(sideB, 14, mid + (mid - 72) / 2 + 20, 38, palette.text, 700)}</text>

    <circle cx="${mid}" cy="${(H - 120) / 2 + 60}" r="28" fill="${esc(palette.background)}" stroke="${esc(palette.primary)}" stroke-width="2"/>
    <text x="${mid}" y="${(H - 120) / 2 + 68}" font-family="${esc(font)}" font-size="20" font-weight="700" fill="${esc(palette.primary)}" text-anchor="middle">VS</text>

    <rect x="0" y="${H - 120}" width="${W}" height="120" fill="${palette.surface}" opacity="0.5"/>
    ${profileBadge(palette, brandKit.profileName ?? "", brandKit.profileHandle ?? "", font)}
    <text x="${W - 68}" y="${H - 56}" font-family="${esc(font)}" font-size="18" fill="${esc(palette.textMuted)}" text-anchor="end">${index + 1}/${total}</text>
  </svg>`;
}

function buildCtaSvg(
  block: ContentBlock,
  _slot: SlideDefinition,
  palette: TemplatePalette,
  _image: string,
  brandKit: RenderBrandKit,
  font: string,
  index: number,
  total: number
): string {
  const title = block.title ?? "Salva esse carrossel";
  const body = block.body ?? "para consultar quando precisar!";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backgroundGradient("ctaBg", palette)}
    <rect width="${W}" height="${H}" fill="url(#ctaBg)"/>

    <circle cx="${W / 2}" cy="${H / 2 - 120}" r="140" fill="${esc(palette.primary)}" opacity="0.08"/>
    <circle cx="${W / 2}" cy="${H / 2 - 120}" r="90" fill="${esc(palette.primary)}" opacity="0.12"/>

    <text x="${W / 2}" y="${H / 2 - 180}" font-family="${esc(font)}" font-size="64" text-anchor="middle">💾</text>

    <text
      x="${W / 2}" y="${H / 2 + 20}"
      font-family="${esc(font)}"
      font-size="56"
      font-weight="800"
      fill="${esc(palette.text)}"
      text-anchor="middle"
    >${wrapText(title, 18, W / 2, 56, palette.text, 800)}</text>

    <text
      x="${W / 2}" y="${H / 2 + 160}"
      font-family="${esc(font)}"
      font-size="30"
      fill="${esc(palette.textMuted)}"
      text-anchor="middle"
    >${wrapText(body, 28, W / 2, 30, palette.textMuted, 400)}</text>

    <rect x="${W / 2 - 180}" y="${H - 260}" width="360" height="68" rx="34" fill="${esc(palette.primary)}"/>
    <text x="${W / 2}" y="${H - 218}" font-family="${esc(font)}" font-size="24" font-weight="700" fill="${esc(palette.background)}" text-anchor="middle">Salvar agora ↓</text>

    <rect x="0" y="${H - 120}" width="${W}" height="120" fill="${palette.surface}" opacity="0.5"/>
    ${profileBadge(palette, brandKit.profileName ?? "", brandKit.profileHandle ?? "", font)}
    <text x="${W - 68}" y="${H - 56}" font-family="${esc(font)}" font-size="18" fill="${esc(palette.textMuted)}" text-anchor="end">${index + 1}/${total}</text>
  </svg>`;
}

function buildGenericDevelopmentSvg(
  block: ContentBlock,
  slot: SlideDefinition,
  palette: TemplatePalette,
  image: string,
  brandKit: RenderBrandKit,
  font: string,
  index: number,
  total: number
): string {
  const title = block.title ?? "";
  const body = block.body ?? "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${backgroundGradient("devBg", palette)}
    <rect width="${W}" height="${H}" fill="url(#devBg)"/>

    ${image ? imageBlock(image, 0, 0, W, 480, "rgba(0,0,0,0.4)") : accentBar(palette, 60, 4, 540, 90)}

    ${title ? `<text x="${W / 2}" y="${image ? 540 : 240}" font-family="${esc(font)}" font-size="42" font-weight="700" fill="${esc(palette.text)}" text-anchor="middle">${wrapText(title, 24, W / 2, 42, palette.text, 700)}</text>` : ""}

    ${body ? `<text x="${W / 2}" y="${image ? 720 : 500}" font-family="${esc(font)}" font-size="32" font-weight="400" fill="${esc(palette.textMuted)}" text-anchor="middle">${wrapText(body, 32, W / 2, 32, palette.textMuted, 400)}</text>` : ""}

    <rect x="0" y="${H - 120}" width="${W}" height="120" fill="${palette.surface}" opacity="0.5"/>
    ${profileBadge(palette, brandKit.profileName ?? "", brandKit.profileHandle ?? "", font)}
    <text x="${W - 68}" y="${H - 56}" font-family="${esc(font)}" font-size="18" fill="${esc(palette.textMuted)}" text-anchor="end">${index + 1}/${total}</text>
  </svg>`;
}

// ─── Per-slide dispatcher ─────────────────────────────────────────────────────

function buildSlideSvgForBlock(
  block: ContentBlock,
  slot: SlideDefinition,
  palette: TemplatePalette,
  image: string,
  brandKit: RenderBrandKit,
  font: string,
  index: number,
  total: number
): string {
  const role = slot.role;

  if (role === "hook") {
    return buildHookSvg(block, slot, palette, image, brandKit, font);
  }

  if (role === "cta") {
    return buildCtaSvg(block, slot, palette, image, brandKit, font, index, total);
  }

  // Development and saveable: dispatch by block type
  const blockType = block.type;

  if (blockType === "stat") {
    return buildStatSvg(block, slot, palette, image, brandKit, font, index, total);
  }

  if (blockType === "list_item" || role === "saveable") {
    return buildListSvg(block, slot, palette, image, brandKit, font, index, total);
  }

  if (blockType === "quote") {
    return buildQuoteSvg(block, slot, palette, image, brandKit, font, index, total);
  }

  if (blockType === "comparison") {
    return buildComparisonSvg(block, slot, palette, image, brandKit, font, index, total);
  }

  return buildGenericDevelopmentSvg(block, slot, palette, image, brandKit, font, index, total);
}

// ─── SVG → PNG pipeline ───────────────────────────────────────────────────────

async function inlineExternalImages(svg: string): Promise<string> {
  const urlPattern = /href="(https?:\/\/[^"]+)"/g;
  const matches = [...svg.matchAll(urlPattern)];
  const unique = [...new Set(matches.map((m) => m[1]!))];

  const results = await Promise.allSettled(
    unique.map(async (url) => {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    })
  );

  let result = svg;
  for (let i = 0; i < unique.length; i++) {
    const r = results[i];
    if (r?.status === "fulfilled") {
      const escaped = unique[i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`href="${escaped}"`, "g"), `href="${r.value}"`);
    }
  }
  return result;
}

async function svgToPngDataUrl(svg: string): Promise<string> {
  const embedded = await inlineExternalImages(svg);

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, W, H);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("SVG load failed"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(embedded)}`;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders a carousel using the given template definition and content blocks.
 *
 * @param template   TemplateDefinition from the registry
 * @param blocks     ContentBlock[] as generated by the content agent
 * @param images     Optional data-URL images indexed by block position
 * @param brandKit   Optional brand customization (colors, profile info)
 * @returns          Array of PNG data-URLs, one per slide
 */
export async function renderTemplate(
  template: TemplateDefinition,
  blocks: ContentBlock[],
  images: string[] = [],
  brandKit: RenderBrandKit = {}
): Promise<string[]> {
  const font = brandKit.fontFamily ?? FONT_FAMILY;

  // Override palette with brandKit colors if provided
  const palette: TemplatePalette = {
    ...template.palette,
    ...(brandKit.primaryColor ? { primary: brandKit.primaryColor } : {}),
    ...(brandKit.secondaryColor ? { accent: brandKit.secondaryColor } : {}),
  };

  // Distribute blocks to slots
  const assignments = assignBlocksToSlots(template.slides, blocks);
  const total = assignments.length;

  // Build SVGs in parallel, then convert sequentially (Canvas is single-threaded anyway)
  const svgs = assignments.map(({ slot, block }, i) => {
    const image = images[i] ?? "";
    return buildSlideSvgForBlock(block, slot, palette, image, brandKit, font, i, total);
  });

  const pngUrls: string[] = [];
  for (const svg of svgs) {
    pngUrls.push(await svgToPngDataUrl(svg));
  }

  return pngUrls;
}