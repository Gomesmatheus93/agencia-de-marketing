import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Calendar,
  Download,
  Image,
  Instagram,
  Layers,
  LayoutTemplate,
  Loader2,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isSchedulerDatetimeLocalInFuture,
  POST_SCHEDULER_TIME_ZONE,
  toSchedulerDatetimeLocalValue,
} from "@/lib/scheduling";

interface CarouselSlide {
  title: string;
  body: string;
  imageUrl?: string;
  designTemplateName?: string;
  designTemplateUrl?: string;
  designStyleBrief?: string;
  templateSvgUrl?: string;
  renderedImageUrl?: string;
}

interface CarouselItem {
  id: number;
  userId: number;
  topic: string;
  slides: CarouselSlide[];
  style: string;
  hook: string;
  caption: string;
  finalCta: string;
  coverImageUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const topicSuggestions = [
  
];

const DEFAULT_STYLE_ID = "signature";
const DEFAULT_STYLE_LABEL = "Assinatura";
const BRAND_PRIMARY = "#7b00ae";
const BRAND_SECONDARY = "#fe6e00";
const FLAVIO_PROFILE_NAME = "Flávio Vasconcelos";
const FLAVIO_PROFILE_HANDLE = "@comflavio";
const FLAVIO_PROFILE_AVATAR_URL = "/flavio-avatar.png";
const KRYTHOS_PROFILE_NAME = "krythoslab";
const KRYTHOS_PROFILE_HANDLE = "@krythoslab";
const KRYTHOS_PROFILE_AVATAR_URL = "/krythoslab-avatar.png";

type ProfileModel = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarUrl: string;
};

const PROFILE_MODELS: ProfileModel[] = [
  { id: "flavio", name: FLAVIO_PROFILE_NAME, handle: FLAVIO_PROFILE_HANDLE, initials: "FV", avatarUrl: FLAVIO_PROFILE_AVATAR_URL },
  { id: "krythos", name: KRYTHOS_PROFILE_NAME, handle: KRYTHOS_PROFILE_HANDLE, initials: "KL", avatarUrl: KRYTHOS_PROFILE_AVATAR_URL },
];

const slideCountOptions = [3, 5, 7, 10];

const deliveryHighlights = [
  {
    title: "Gancho forte",
    description: "Uma abertura pensada para prender a atencao logo no primeiro slide.",
  },
  {
    title: "Slides prontos",
    description: "Estrutura completa para design, com ritmo, contraste e retencao.",
  },
  {
    title: "Legenda e CTA",
    description: "Legenda pronta para postar e CTA final para salvar, comentar ou compartilhar.",
  },
];

type SlideTheme = {
  start: string;
  end: string;
  accent: string;
  accentSoft: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  muted: string;
  stroke: string;
};

type SlideRenderInput = {
  slide: CarouselSlide;
  index: number;
  total: number;
  style: string;
  topic: string;
  hook: string;
  finalCta?: string;
  coverImageUrl?: string;
  profileAvatarUrl?: string;
  profileName?: string;
  profileHandle?: string;
  profileInitials?: string;
  profileId?: string;
};

type TemplateDrivenTone = "light" | "dark";

type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const BRAND_SLIDE_THEME: SlideTheme = {
  start: "#06010b",
  end: "#18031b",
  accent: BRAND_SECONDARY,
  accentSoft: "#ffb074",
  surface: "#14031d",
  surfaceStrong: "#09010e",
  text: "#f7e7ff",
  muted: "#cfb1df",
  stroke: "#4c1663",
};

const SLIDE_THEMES: Record<string, SlideTheme> = {
  [DEFAULT_STYLE_ID]: BRAND_SLIDE_THEME,
  minimal: BRAND_SLIDE_THEME,
  bold: BRAND_SLIDE_THEME,
  gradient: BRAND_SLIDE_THEME,
  corporate: BRAND_SLIDE_THEME,
  vibrant: BRAND_SLIDE_THEME,
  dark: BRAND_SLIDE_THEME,
};

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }

  return table;
})();

const embeddedAssetCache = new Map<string, Promise<string | undefined>>();

function getStyleLabel(style: string) {
  if (!style.trim()) {
    return DEFAULT_STYLE_LABEL;
  }

  if (style === DEFAULT_STYLE_ID) {
    return DEFAULT_STYLE_LABEL;
  }

  return style;
}

function formatDateLabel(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function toIsoTimestamp(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const value = Number.parseInt(expanded, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "carousel"
  );
}

function wrapTextLines(text: string, maxChars: number, maxLines: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxChars || currentLine.length === 0) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  const joinedWords = lines.join(" ").split(" ").length;
  if (joinedWords < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = lines[lastIndex].replace(/[.,;:!?-]*$/, "");
    lines[lastIndex] = `${lines[lastIndex]}...`;
  }

  return lines;
}

function splitBulletPoints(text: string, maxItems: number) {
  const parts = text
    .split(/\n|[.;!?](?:\s+|$)/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.slice(0, maxItems);
  }

  return wrapTextLines(text, 28, maxItems);
}

function clampSentence(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}

function extractTitleParts(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(\d+[.)-]?)\s*(.+)$/);

  if (!match) {
    return {
      prefix: "",
      content: normalized,
    };
  }

  return {
    prefix: match[1].replace(/[.)-]/g, ""),
    content: match[2],
  };
}

function buildCtaButtonLabel(text: string) {
  const normalized = text.trim();
  const lowered = normalized.toLowerCase();

  if (!normalized) {
    return "Quero saber mais";
  }

  if (lowered.includes("direct")) {
    return "Me chama no direct";
  }

  if (lowered.includes("whatsapp")) {
    return "Fale comigo no WhatsApp";
  }

  if (lowered.includes("comente")) {
    return 'Comente "quero"';
  }

  if (lowered.includes("salve")) {
    return "Salve e compartilhe";
  }

  return clampSentence(normalized, 28);
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function toAbsoluteClientAssetUrl(url?: string) {
  if (!url || url.startsWith("data:") || /^https?:\/\//i.test(url)) {
    return url;
  }

  if (typeof window === "undefined") {
    return url;
  }

  return new URL(url, window.location.origin).toString();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Nao foi possivel converter o blob para data URL"));
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Falha ao ler o blob da imagem"));
    };
    reader.readAsDataURL(blob);
  });
}

async function toEmbeddedAssetUrl(url?: string) {
  const resolvedUrl = toAbsoluteClientAssetUrl(url);
  if (!resolvedUrl || resolvedUrl.startsWith("data:")) {
    return resolvedUrl;
  }

  if (!embeddedAssetCache.has(resolvedUrl)) {
    embeddedAssetCache.set(
      resolvedUrl,
      (async () => {
        try {
          const response = await fetch(resolvedUrl, { credentials: "include" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return await blobToDataUrl(await response.blob());
        } catch (error) {
          console.warn("[Carousel] Nao consegui embutir a imagem no template:", resolvedUrl, error);
          return resolvedUrl;
        }
      })()
    );
  }

  return embeddedAssetCache.get(resolvedUrl);
}

function isEmbeddedAssetUrl(url?: string) {
  return Boolean(url && url.startsWith("data:"));
}

function decodeDataUrlPayload(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return "";
  }

  const header = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);

  try {
    if (header.includes(";base64")) {
      return window.atob(body);
    }

    return decodeURIComponent(body);
  } catch {
    return "";
  }
}

function isCarouselFallbackAssetUrl(url?: string) {
  if (!url || !url.startsWith("data:image/svg+xml")) {
    return false;
  }

  const payload = decodeDataUrlPayload(url);
  return payload.includes('data-carousel-fallback="true"') || payload.includes('id="fallbackBg"');
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < data.length; index += 1) {
    crc = ZIP_CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);

  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      (Math.floor(date.getSeconds() / 2) & 0x1f),
    date:
      (((year - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f),
  };
}

function joinUint8Arrays(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function createZipBlob(entries: ZipEntry[]) {
  const localFiles: Uint8Array[] = [];
  const centralFiles: Uint8Array[] = [];
  const stamp = getDosDateTime();
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = encodeUtf8(entry.name);
    const fileData = entry.data;
    const checksum = crc32(fileData);

    const localHeader = new Uint8Array(30 + fileName.length + fileData.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, fileData.length, true);
    localView.setUint32(22, fileData.length, true);
    localView.setUint16(26, fileName.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(fileName, 30);
    localHeader.set(fileData, 30 + fileName.length);
    localFiles.push(localHeader);

    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, fileData.length, true);
    centralView.setUint32(24, fileData.length, true);
    centralView.setUint16(28, fileName.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(fileName, 46);
    centralFiles.push(centralHeader);

    localOffset += localHeader.length;
  }

  const localBytes = joinUint8Arrays(localFiles);
  const centralBytes = joinUint8Arrays(centralFiles);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localBytes.length, true);
  endView.setUint16(20, 0, true);

  return new Blob([localBytes, centralBytes, endRecord], {
    type: "application/zip",
  });
}

function buildSlideSvg(input: SlideRenderInput) {
  if (input.slide.designTemplateUrl) {
    return buildTemplateDrivenSlideSvg(input);
  }

  if (input.profileId === "krythos") {
    return buildKrythosModelSlideSvg(input);
  }

  return buildFlavioModelSlideSvg(input);
}

function resolveTemplateDrivenTone(styleBrief?: string, templateName?: string): TemplateDrivenTone {
  const source = `${styleBrief || ""} ${templateName || ""}`.toLowerCase();
  const lightHints = [
    "claro",
    "clean",
    "cleaner",
    "minimal",
    "minimalista",
    "branco",
    "light",
    "suave",
    "soft",
    "editorial",
    "premium claro",
  ];
  const darkHints = [
    "escuro",
    "dark",
    "noturno",
    "cinema",
    "dramatico",
    "dramática",
    "alto contraste",
    "luxo",
    "preto",
    "neon",
    "moody",
  ];

  const lightScore = lightHints.reduce(
    (score, hint) => score + (source.includes(hint) ? 1 : 0),
    0
  );
  const darkScore = darkHints.reduce(
    (score, hint) => score + (source.includes(hint) ? 1 : 0),
    0
  );

  return darkScore > lightScore ? "dark" : "light";
}

function buildTemplateDrivenSlideSvg(input: SlideRenderInput) {
  const idSuffix = hashString(
    `${input.topic}-${input.index}-${input.slide.title}-${input.slide.designTemplateName || "template"}`
  );
  const templateImageUrl = toAbsoluteClientAssetUrl(input.slide.designTemplateUrl);
  const generatedImageUrl = toAbsoluteClientAssetUrl(input.slide.imageUrl || input.coverImageUrl);
  const tone = resolveTemplateDrivenTone(
    input.slide.designStyleBrief,
    input.slide.designTemplateName
  );
  const titleSource = input.index === 0 ? input.hook || input.slide.title : input.slide.title;
  const bodySource =
    input.index === input.total - 1 && input.finalCta
      ? input.finalCta
      : input.slide.body || input.topic;
  const topicLabel = clampSentence(input.topic, 40).toUpperCase();
  const templateLabel = clampSentence(
    input.slide.designTemplateName || getStyleLabel(input.style),
    28
  ).toUpperCase();
  const titleLines = wrapTextLines(titleSource, input.index === 0 ? 20 : 22, 3);
  const titleFontSize =
    titleLines.length >= 3 ? 74 : titleLines.some((line) => line.length > 18) ? 82 : 92;
  const titleLineHeight = Math.round(titleFontSize * 1.04);
  const bodyLines = wrapTextLines(bodySource, 34, input.index === input.total - 1 ? 4 : 3);
  const bodyFontSize =
    bodyLines.length >= 4 ? 34 : bodyLines.length === 3 ? 36 : bodyLines.some((line) => line.length > 28) ? 38 : 40;
  const bodyLineHeight = Math.round(bodyFontSize * 1.24);
  const kickerText = input.index === input.total - 1
    ? clampSentence(input.finalCta || "Salve este conteudo para revisar depois.", 52)
    : clampSentence(input.slide.body || input.topic, 56);
  const kickerLines = wrapTextLines(kickerText, 34, 2);
  const headerChipId = `templateHeader-${idSuffix}`;
  const panelShadowId = `panelShadow-${idSuffix}`;
  const imageClipId = `templateImageClip-${idSuffix}`;
  const fallbackGradientId = `templateFallback-${idSuffix}`;
  const imageFallbackGradientId = `templateImageFallback-${idSuffix}`;
  const textX = 116;
  const titleStartY = 236;
  const bodyStartY = titleStartY + (titleLines.length - 1) * titleLineHeight + 84;
  const kickerStartY = Math.min(
    666,
    bodyStartY + (bodyLines.length - 1) * bodyLineHeight + 62
  );
  const titleFill = tone === "dark" ? "#f8fafc" : "#101828";
  const bodyFill = tone === "dark" ? "#e2e8f0" : "#344054";
  const mutedFill = tone === "dark" ? "#cbd5e1" : "#475467";
  const panelFill = tone === "dark" ? "rgba(7, 12, 24, 0.62)" : "rgba(255, 255, 255, 0.76)";
  const panelStroke = tone === "dark" ? "rgba(226, 232, 240, 0.14)" : "rgba(15, 23, 42, 0.12)";
  const outerStroke = tone === "dark" ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.08)";
  const overlayTop = tone === "dark" ? "rgba(2, 6, 23, 0.72)" : "rgba(248, 250, 252, 0.34)";
  const overlayBottom = tone === "dark" ? "rgba(2, 6, 23, 0.28)" : "rgba(248, 250, 252, 0.18)";
  const chipFill = tone === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.82)";
  const chipText = tone === "dark" ? "#f8fafc" : "#0f172a";
  const chipAccent = tone === "dark" ? "#c084fc" : "#7c3aed";
  const counterFill = tone === "dark" ? "rgba(15, 23, 42, 0.58)" : "rgba(255, 255, 255, 0.84)";
  const counterText = tone === "dark" ? "#f8fafc" : "#0f172a";
  const imageOverlay = tone === "dark" ? "rgba(15, 23, 42, 0.16)" : "rgba(15, 23, 42, 0.04)";
  const imageYOffset = generatedImageUrl ? 792 : 0;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="${fallbackGradientId}" x1="0" y1="0" x2="1080" y2="1350" gradientUnits="userSpaceOnUse">
      <stop stop-color="${tone === "dark" ? "#111827" : "#f8fafc"}" />
      <stop offset="1" stop-color="${tone === "dark" ? "#312e81" : "#dbeafe"}" />
    </linearGradient>
    <linearGradient id="${headerChipId}" x1="84" y1="82" x2="436" y2="82" gradientUnits="userSpaceOnUse">
      <stop stop-color="${tone === "dark" ? "#7c3aed" : "#4f46e5"}" />
      <stop offset="1" stop-color="${tone === "dark" ? "#ec4899" : "#7c3aed"}" />
    </linearGradient>
    <linearGradient id="${imageFallbackGradientId}" x1="96" y1="792" x2="984" y2="1248" gradientUnits="userSpaceOnUse">
      <stop stop-color="${tone === "dark" ? "#111827" : "#e2e8f0"}" />
      <stop offset="1" stop-color="${tone === "dark" ? "#4338ca" : "#cbd5e1"}" />
    </linearGradient>
    <clipPath id="${imageClipId}">
      <rect x="72" y="792" width="936" height="486" rx="34" />
    </clipPath>
    <filter id="${panelShadowId}" x="28" y="34" width="1024" height="1310" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="28" flood-color="${tone === "dark" ? "#020617" : "#0f172a"}" flood-opacity="${tone === "dark" ? "0.42" : "0.16"}" />
    </filter>
  </defs>

  ${templateImageUrl
    ? `<image href="${escapeXml(templateImageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" />`
    : `<rect width="1080" height="1350" fill="url(#${fallbackGradientId})" />`}
  <rect width="1080" height="1350" fill="${overlayTop}" opacity="1" />
  <rect width="1080" height="1350" fill="${overlayBottom}" opacity="1" />
  <rect x="36" y="36" width="1008" height="1278" rx="40" fill="none" stroke="${outerStroke}" />

  <rect x="72" y="72" width="936" height="654" rx="42" fill="${panelFill}" stroke="${panelStroke}" filter="url(#${panelShadowId})" />
  <rect x="96" y="96" width="350" height="50" rx="25" fill="${chipFill}" stroke="${panelStroke}" />
  <rect x="112" y="112" width="122" height="18" rx="9" fill="url(#${headerChipId})" />
  <text x="252" y="126" fill="${chipText}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(templateLabel)}</text>

  <rect x="862" y="96" width="146" height="50" rx="25" fill="${counterFill}" stroke="${panelStroke}" />
  <text x="935" y="128" text-anchor="middle" fill="${counterText}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">${input.index + 1}/${input.total}</text>

  <text x="${textX}" y="184" fill="${chipAccent}" font-size="22" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.4" font-weight="700">${escapeXml(topicLabel)}</text>

  <text x="${textX}" y="${titleStartY}" fill="${titleFill}" font-size="${titleFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">
    ${titleLines
      .map(
        (line, lineIndex) =>
          `<tspan x="${textX}" dy="${lineIndex === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>

  <text x="${textX}" y="${bodyStartY}" fill="${bodyFill}" font-size="${bodyFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="500">
    ${bodyLines
      .map(
        (line, lineIndex) =>
          `<tspan x="${textX}" dy="${lineIndex === 0 ? 0 : bodyLineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>

  <rect x="${textX}" y="610" width="412" height="62" rx="31" fill="${tone === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.06)"}" stroke="${panelStroke}" />
  <text x="${textX + 206}" y="650" text-anchor="middle" fill="${titleFill}" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.index === input.total - 1 ? "CTA do fechamento" : "Mensagem principal")}</text>

  <text x="${textX}" y="${kickerStartY}" fill="${mutedFill}" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="500">
    ${kickerLines
      .map(
        (line, lineIndex) =>
          `<tspan x="${textX}" dy="${lineIndex === 0 ? 0 : 34}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>

  <rect x="72" y="792" width="936" height="486" rx="34" fill="${generatedImageUrl ? "rgba(255, 255, 255, 0.12)" : `url(#${imageFallbackGradientId})`}" stroke="${panelStroke}" />
  ${
    generatedImageUrl
      ? `
  <g clip-path="url(#${imageClipId})">
    <image href="${escapeXml(generatedImageUrl)}" x="72" y="${imageYOffset}" width="936" height="486" preserveAspectRatio="xMidYMid slice" />
    <rect x="72" y="792" width="936" height="486" fill="${imageOverlay}" />
  </g>
      `
      : `
  <circle cx="284" cy="1018" r="168" fill="${tone === "dark" ? "rgba(129, 140, 248, 0.24)" : "rgba(99, 102, 241, 0.16)"}" />
  <circle cx="812" cy="1126" r="210" fill="${tone === "dark" ? "rgba(236, 72, 153, 0.22)" : "rgba(168, 85, 247, 0.14)"}" />
  <path d="M72 1192L266 1034L424 1128L612 972L792 1096L1008 972V1278H72V1192Z" fill="${tone === "dark" ? "rgba(15, 23, 42, 0.38)" : "rgba(255, 255, 255, 0.42)"}" />
      `
  }
  <rect x="96" y="818" width="322" height="56" rx="28" fill="${tone === "dark" ? "rgba(2, 6, 23, 0.44)" : "rgba(255, 255, 255, 0.86)"}" stroke="${panelStroke}" />
  <text x="257" y="853" text-anchor="middle" fill="${tone === "dark" ? "#f8fafc" : "#0f172a"}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.index === 0 ? "Visual guiado pelo template" : "Imagem gerada no estilo escolhido")}</text>
</svg>
  `.trim();
}

function buildFlavioModelSlideSvg(input: SlideRenderInput) {
  const idSuffix = hashString(`${input.topic}-${input.index}-${input.slide.title}`);
  const avatarClipId = `flavioAvatar-${idSuffix}`;
  const fallbackGradientId = `fallbackImage-${idSuffix}`;
  const coverImageUrl = toAbsoluteClientAssetUrl(input.slide.imageUrl || input.coverImageUrl);
  const profileAvatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || FLAVIO_PROFILE_AVATAR_URL);
  const titleSource = input.index === 0 ? input.hook || input.slide.title : input.slide.title;
  const titleLines = wrapTextLines(titleSource, titleSource.length > 52 ? 17 : 20, 3);
  const titleFontSize = titleLines.length >= 3 ? 58 : titleLines.some((line) => line.length > 18) ? 66 : 74;
  const titleLineHeight = Math.round(titleFontSize * 1.28);
  const summarySource = (
    input.index === input.total - 1 && input.finalCta ? input.finalCta : input.slide.body
  )
    ?.replace(/\s+/g, " ")
    .trim();
  const summaryMaxLines = titleLines.length >= 3 ? 3 : 4;
  const summaryLines = wrapTextLines(summarySource || input.topic, titleLines.length >= 3 ? 38 : 42, summaryMaxLines);
  const summaryFontSize = summaryLines.length >= 4 ? 30 : summaryLines.length === 3 ? 32 : summaryLines.some((line) => line.length > 38) ? 34 : 38;
  const summaryLineHeight = Math.round(summaryFontSize * 1.28);
  const titleBlockHeight = (titleLines.length - 1) * titleLineHeight + titleFontSize;
  const summaryBlockHeight = summaryLines.length > 0
    ? (summaryLines.length - 1) * summaryLineHeight + summaryFontSize
    : 0;
  const textBlockGap = summaryLines.length > 0 ? (summaryLines.length >= 3 || titleLines.length >= 3 ? 42 : 58) : 0;
  const textZoneTop = 304;
  const textZoneBottom = 700;
  const textBlockHeight = titleBlockHeight + textBlockGap + summaryBlockHeight;
  const textBlockTop = textZoneTop + Math.max(0, (textZoneBottom - textZoneTop - textBlockHeight) / 2);
  const titleStartY = Math.round(textBlockTop + titleFontSize * 0.78);
  const summaryStartY = Math.round(
    titleStartY + (titleLines.length - 1) * titleLineHeight + textBlockGap + summaryFontSize * 0.78
  );
  const summaryTextWidth = 640;
  const summaryTextX = (1080 - summaryTextWidth) / 2;
  const summaryMarkup = summaryLines
    .map((line, lineIndex) => {
      const shouldJustify =
        lineIndex < summaryLines.length - 1 && line.split(" ").length > 3 && line.length > 28;
      const positionAttributes = shouldJustify
        ? `x="${summaryTextX}" text-anchor="start" textLength="${summaryTextWidth}" lengthAdjust="spacing"`
        : `x="540" text-anchor="middle"`;

      return `<text ${positionAttributes} y="${summaryStartY + lineIndex * summaryLineHeight}" fill="#242424" font-size="${summaryFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(line)}</text>`;
    })
    .join("");
  const imageTop = 750;
  const fallbackImageMarkup = `
    <rect x="0" y="${imageTop}" width="1080" height="600" fill="url(#${fallbackGradientId})" />
    <circle cx="276" cy="1006" r="170" fill="#0f172a" opacity="0.18" />
    <circle cx="828" cy="932" r="230" fill="#475569" opacity="0.2" />
    <path d="M0 1190L196 1038L346 1124L536 914L716 1054L868 934L1080 1094V1350H0V1190Z" fill="#111827" opacity="0.34" />
    <path d="M0 1244L244 1096L410 1180L614 984L812 1132L1080 980V1350H0V1244Z" fill="#030712" opacity="0.38" />
  `;
  const imageMarkup = coverImageUrl
    ? `<image href="${escapeXml(coverImageUrl)}" x="0" y="${imageTop}" width="1080" height="600" preserveAspectRatio="xMidYMid slice" />`
    : fallbackImageMarkup;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <clipPath id="${avatarClipId}">
      <circle cx="132" cy="138" r="64" />
    </clipPath>
    <linearGradient id="${fallbackGradientId}" x1="0" y1="${imageTop}" x2="1080" y2="1350" gradientUnits="userSpaceOnUse">
      <stop stop-color="#cbd5e1" />
      <stop offset="0.52" stop-color="#94a3b8" />
      <stop offset="1" stop-color="#334155" />
    </linearGradient>
  </defs>

  <rect width="1080" height="1350" fill="#ffffff" />

  <circle cx="132" cy="138" r="64" fill="#111827" />
  <text x="132" y="154" text-anchor="middle" fill="#ffffff" font-size="36" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileInitials || "FV")}</text>
  <image href="${escapeXml(profileAvatarUrl || "")}" x="68" y="74" width="128" height="128" preserveAspectRatio="xMidYMid slice" clip-path="url(#${avatarClipId})" />
  <circle cx="132" cy="138" r="64" fill="none" stroke="#e5e7eb" stroke-width="2" />

  <text x="222" y="140" fill="#050505" font-size="44" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileName || FLAVIO_PROFILE_NAME)}</text>
  <circle cx="682" cy="126" r="15" fill="#1d9bf0" />
  <path d="M675 126.5L680.5 132L690 121" stroke="#ffffff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" />
  <text x="222" y="185" fill="#9ca3af" font-size="35" font-family="Arial, Helvetica, sans-serif" font-weight="500">${escapeXml(input.profileHandle || FLAVIO_PROFILE_HANDLE)}</text>

  <text x="540" y="${titleStartY}" text-anchor="middle" fill="#050505" font-size="${titleFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">
    ${titleLines
      .map(
        (line, lineIndex) =>
          `<tspan x="540" dy="${lineIndex === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>

  ${summaryMarkup}

  ${imageMarkup}
  <rect x="0" y="${imageTop}" width="1080" height="2" fill="#f3f4f6" />
</svg>
  `.trim();
}

function buildKrythosModelSlideSvg(input: SlideRenderInput) {
  const idSuffix = hashString(`${input.topic}-${input.index}-${input.slide.title}`);
  const overlayId = `krOverlay-${idSuffix}`;
  const fallbackId = `krFallback-${idSuffix}`;

  const ACCENT_CYAN = "#29d9ff";
  const imageUrl = toAbsoluteClientAssetUrl(input.slide.imageUrl || input.coverImageUrl);
  const profileAvatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || KRYTHOS_PROFILE_AVATAR_URL);

  const rawTitle = (input.index === 0 ? input.hook || input.slide.title : input.slide.title)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const MAX_CHARS = 14;
  const MAX_LINES = 4;
  const titleLines = wrapTextLines(rawTitle, MAX_CHARS, MAX_LINES);

  const FONT_SIZE = titleLines.length >= 4 ? 82 : titleLines.length >= 3 ? 90 : titleLines.length >= 2 ? 100 : 112;
  const LINE_HEIGHT = Math.round(FONT_SIZE * 1.18);

  const accentStartLine = titleLines.length <= 1 ? 0 : Math.ceil(titleLines.length * 0.62);

  const BOTTOM_PADDING = 100;
  const MAX_TEXT_BOTTOM = 1350 - BOTTOM_PADDING;
  const titleBlockHeight = (titleLines.length - 1) * LINE_HEIGHT + FONT_SIZE;

  const PILL_H = 80;
  const PILL_AVATAR_R = 30;
  const GAP_PILL_TEXT = 44;
  const totalBlockHeight = PILL_H + GAP_PILL_TEXT + titleBlockHeight;
  const CONTENT_CENTER = 1060;
  const PILL_CY = Math.min(
    Math.round(CONTENT_CENTER - totalBlockHeight / 2 + PILL_H / 2),
    Math.round(MAX_TEXT_BOTTOM - titleBlockHeight - GAP_PILL_TEXT - PILL_H / 2)
  );

  const profileHandle = input.profileHandle || "@krythoslab";
  const profileInitials = input.profileInitials || "K";
  const handleWidth = profileHandle.length * 23;
  const PILL_W = PILL_AVATAR_R * 2 + 24 + handleWidth + 32;
  const PILL_X = (1080 - PILL_W) / 2;
  const AVATAR_CX = PILL_X + PILL_AVATAR_R + 12;
  const HANDLE_X = AVATAR_CX + PILL_AVATAR_R + 18;

  const TEXT_ZONE_TOP = PILL_CY + PILL_H / 2 + GAP_PILL_TEXT;
  const titleStartY = TEXT_ZONE_TOP + FONT_SIZE * 0.82;

  const MAX_TEXT_WIDTH = 1000;
  const titleMarkup = titleLines
    .map((line, i) => {
      const isAccent = i >= accentStartLine;
      const estimatedWidth = line.length * FONT_SIZE * 0.62;
      const needsClamp = estimatedWidth > MAX_TEXT_WIDTH;
      const clampAttr = needsClamp
        ? ` textLength="${MAX_TEXT_WIDTH}" lengthAdjust="spacingAndGlyphs"`
        : "";
      return `<text x="540" y="${titleStartY + i * LINE_HEIGHT}" text-anchor="middle" fill="${isAccent ? ACCENT_CYAN : "#ffffff"}" font-size="${FONT_SIZE}" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900"${clampAttr}>${escapeXml(line)}</text>`;
    })
    .join("\n  ");

  const imageMarkup = imageUrl
    ? `<image href="${escapeXml(imageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" />`
    : `<rect width="1080" height="1350" fill="url(#${fallbackId})" />`;

  const slideLabel = `${input.index + 1}/${input.total}`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="${overlayId}" x1="0" y1="0" x2="0" y2="1350" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="40%" stop-color="#000000" stop-opacity="0.06" />
      <stop offset="60%" stop-color="#000000" stop-opacity="0.65" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.96" />
    </linearGradient>
    <linearGradient id="${fallbackId}" x1="0" y1="0" x2="1080" y2="1350" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0d1b2a" />
      <stop offset="0.5" stop-color="#1b2838" />
      <stop offset="1" stop-color="#0a3d62" />
    </linearGradient>
    <clipPath id="krAvatar-${idSuffix}">
      <circle cx="${AVATAR_CX}" cy="${PILL_CY}" r="${PILL_AVATAR_R}" />
    </clipPath>
  </defs>

  ${imageMarkup}
  <rect width="1080" height="1350" fill="url(#${overlayId})" />

  <text x="540" y="64" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="600" letter-spacing="4">${escapeXml(slideLabel)}</text>

  <rect x="${PILL_X}" y="${PILL_CY - PILL_H / 2}" width="${PILL_W}" height="${PILL_H}" rx="${PILL_H / 2}" fill="rgba(0,0,0,0.60)" stroke="rgba(255,255,255,0.14)" stroke-width="1.5" />
  <circle cx="${AVATAR_CX}" cy="${PILL_CY}" r="${PILL_AVATAR_R}" fill="#1a1a2e" />
  <text x="${AVATAR_CX}" y="${PILL_CY + 11}" text-anchor="middle" fill="#ffffff" font-size="26" font-family="Arial Black, Arial, sans-serif" font-weight="900">${escapeXml(profileInitials)}</text>
  <image href="${escapeXml(profileAvatarUrl || "")}" x="${AVATAR_CX - PILL_AVATAR_R}" y="${PILL_CY - PILL_AVATAR_R}" width="${PILL_AVATAR_R * 2}" height="${PILL_AVATAR_R * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#krAvatar-${idSuffix})" />
  <text x="${HANDLE_X}" y="${PILL_CY + 14}" fill="#ffffff" font-size="38" font-family="Arial, Helvetica, sans-serif" font-weight="600">${escapeXml(profileHandle)}</text>

  ${titleMarkup}
</svg>
  `.trim();
}

function buildLegacySlideSvg(input: SlideRenderInput) {
  const theme = SLIDE_THEMES[input.style] || SLIDE_THEMES.gradient;
  const isHero = input.index === 0;
  const isClosing = input.index === input.total - 1;
  const useImageOnRight = isHero || isClosing || input.index % 2 === 1;
  const titleParts = extractTitleParts(input.slide.title);
  const resolvedTitle = titleParts.content || input.slide.title;
  const hasTitlePrefix = Boolean(titleParts.prefix);
  const titleMaxChars = isHero
    ? hasTitlePrefix
      ? 12
      : resolvedTitle.length > 32
        ? 13
        : 15
    : isClosing
      ? hasTitlePrefix
        ? 15
        : resolvedTitle.length > 30
          ? 16
          : 18
      : hasTitlePrefix
        ? 15
        : resolvedTitle.length > 30
          ? 17
          : 19;
  const titleLines = wrapTextLines(resolvedTitle, titleMaxChars, isHero ? 4 : 3);
  const isLongTitle = resolvedTitle.length > 30 || titleLines.length >= 3;
  const isDenseBody = input.slide.body.length > 180;
  const hookLines = wrapTextLines(input.hook, 22, 2);
  const topicLines = wrapTextLines(input.topic, 28, 2);
  const rawBulletCount = isHero ? 2 : isClosing ? 2 : isDenseBody ? 3 : 4;
  const baseBulletCount = Math.max(1, titleLines.length >= 3 ? rawBulletCount - 1 : rawBulletCount);
  const bulletCharLimit = isHero ? 24 : 28;
  const bulletPoints = splitBulletPoints(input.slide.body, baseBulletCount);
  const calloutText = isHero
    ? clampSentence(hookLines[0] || input.hook || "Qual e a melhor escolha hoje?", 34)
    : isClosing
      ? clampSentence(input.finalCta || "Me chama no direct!", 34)
      : clampSentence(bulletPoints[0] || "Muito mais simples, ne?", 34);
  const sectionLabel = isHero
    ? "ABERTURA ESTRATEGICA"
    : isClosing
      ? "CHAMADA FINAL"
      : "DIFERENCIAL EM FOCO";
  const kickerText = isHero
    ? topicLines[0] || "Conteudo com alto poder de retencao"
    : isClosing
      ? "Quer pagar menos e comunicar melhor?"
      : topicLines.join("  ");
  const highlightTitle = isHero
    ? "versus"
    : isClosing
      ? "economia que converte"
      : "o que voce ganha";
  const coverImageUrl = input.slide.imageUrl || (input.index === 0 ? input.coverImageUrl : undefined);
  const imageBox = isHero
    ? { x: 598, y: 168, width: 372, height: 720, radius: 52 }
    : isClosing
      ? { x: 656, y: 380, width: 296, height: 498, radius: 40 }
      : useImageOnRight
        ? { x: 682, y: 180, width: 290, height: 540, radius: 42 }
        : { x: 96, y: 180, width: 290, height: 540, radius: 42 };
  const textPanel = isHero
    ? { x: 76, y: 84, width: 494, height: 914 }
    : isClosing
      ? { x: 76, y: 86, width: 536, height: 906 }
      : useImageOnRight
        ? { x: 82, y: 94, width: 564, height: 892 }
        : { x: 434, y: 94, width: 564, height: 892 };
  const panelTextX = textPanel.x + 48;
  const panelTopY = textPanel.y + 74;
  const titlePrefixColumn = hasTitlePrefix ? (isHero ? 102 : 82) : 0;
  const titleX = panelTextX + titlePrefixColumn;
  const titleFontSize = isHero
    ? titleLines.length >= 4
      ? 58
      : titleLines.length === 3
        ? 66
        : hasTitlePrefix
          ? 76
          : 84
    : isClosing
      ? titleLines.length >= 3
        ? 54
        : 64
      : titleLines.length >= 3
        ? 56
        : hasTitlePrefix
          ? 60
          : 64;
  const titlePrefixFontSize = isHero ? 68 : 54;
  const badgeWidth = isClosing ? 248 : isHero ? 356 : 286;
  const titleLineHeight = Math.round(titleFontSize * (isHero ? 0.94 : 0.92));
  const primaryGlow = hexToRgba(BRAND_PRIMARY, 0.34);
  const secondaryGlow = hexToRgba(BRAND_SECONDARY, 0.3);
  const softGlow = hexToRgba(theme.accentSoft, 0.22);
  const titleStartY = panelTopY + (hasTitlePrefix ? (isHero ? 172 : 154) : isHero ? 138 : 126);
  const titleBlockBottom = titleStartY + (titleLines.length - 1) * titleLineHeight;
  const bodyMaxChars = isHero ? (isDenseBody ? 24 : 26) : isDenseBody ? 30 : 32;
  let visibleBodyLines = wrapTextLines(
    input.slide.body,
    bodyMaxChars,
    isHero ? (titleLines.length >= 3 ? 2 : 3) : isClosing ? 2 : titleLines.length >= 3 ? 2 : 3
  );
  const bodyLineHeight = isDenseBody ? 32 : 36;
  const bodyStartY = titleBlockBottom + (titleLines.length >= 3 ? (isHero ? 76 : 68) : isHero ? 84 : 74);
  const buttonWidth = isClosing ? 384 : isHero ? 404 : 340;
  const buttonHeight = isClosing ? 78 : 70;
  const buttonY = textPanel.y + textPanel.height - (isClosing ? 188 : 150);
  const buttonTextY = buttonY + (isClosing ? 49 : 45);
  const contentBottomLimit = buttonY - (isClosing ? 124 : 98);
  let visibleBulletLayouts = bulletPoints.map((line) => wrapTextLines(line, bulletCharLimit, 2));
  let bodyBlockHeight = Math.max(0, (visibleBodyLines.length - 1) * bodyLineHeight);
  let bulletHeaderY = bodyStartY + bodyBlockHeight + (isHero ? 50 : 72);
  let bulletStartY = bulletHeaderY + (isHero ? 28 : 44);

  const getBulletAreaHeight = (layouts: string[][]) =>
    layouts.reduce((total, lines, index) => total + (index === 0 ? 0 : 16) + (lines.length > 1 ? 94 : 62), 0);

  while (
    visibleBulletLayouts.length > 1 &&
    bulletStartY + getBulletAreaHeight(visibleBulletLayouts) > contentBottomLimit
  ) {
    visibleBulletLayouts = visibleBulletLayouts.slice(0, -1);
  }

  while (
    visibleBodyLines.length > 1 &&
    bulletStartY + getBulletAreaHeight(visibleBulletLayouts) > contentBottomLimit
  ) {
    visibleBodyLines = visibleBodyLines.slice(0, -1);
    bodyBlockHeight = Math.max(0, (visibleBodyLines.length - 1) * bodyLineHeight);
    bulletHeaderY = bodyStartY + bodyBlockHeight + (isHero ? 50 : 72);
    bulletStartY = bulletHeaderY + (isHero ? 28 : 44);
  }

  if (bulletStartY + getBulletAreaHeight(visibleBulletLayouts) > contentBottomLimit) {
    bulletHeaderY = bodyStartY + bodyBlockHeight + (isHero ? 34 : 52);
    bulletStartY = bulletHeaderY + (isHero ? 24 : 38);
  }

  const ctaButtonLabel = isClosing
    ? buildCtaButtonLabel(input.finalCta || calloutText)
    : calloutText;
  const closingSupportLines = isClosing
    ? wrapTextLines(
        clampSentence(input.finalCta || input.slide.body || "Fale comigo e descubra o melhor caminho para o seu negocio.", 88),
        30,
        2
      )
    : [];
  const imageSideDecoration = useImageOnRight ? imageBox.x - 26 : imageBox.x + imageBox.width - 18;
  let currentBulletY = bulletStartY;
  const bulletMarkup = visibleBulletLayouts
    .map((wrapped, bulletIndex) => {
      const y = currentBulletY;
      currentBulletY += (wrapped.length > 1 ? 94 : 62) + 16;

      return `
        <circle cx="${panelTextX + 8}" cy="${y - 10}" r="6" fill="${theme.accent}" />
        <text x="${panelTextX + 28}" y="${y}" fill="${bulletIndex === 1 ? theme.accentSoft : theme.text}" font-size="${isHero ? 28 : 30}" font-family="Arial, Helvetica, sans-serif" font-weight="500">
          ${wrapped
            .map(
              (wrappedLine, lineIndex) =>
                `<tspan x="${panelTextX + 28}" dy="${lineIndex === 0 ? 0 : 36}">${escapeXml(wrappedLine)}</tspan>`
            )
            .join("")}
        </text>
      `;
    })
    .join("");
  const imageMarkup = coverImageUrl
    ? `
      <defs>
        <clipPath id="imageClip">
          <rect x="${imageBox.x}" y="${imageBox.y}" width="${imageBox.width}" height="${imageBox.height}" rx="${imageBox.radius}" />
        </clipPath>
      </defs>
      <g clip-path="url(#imageClip)">
        <image href="${escapeXml(coverImageUrl)}" x="${imageBox.x}" y="${imageBox.y}" width="${imageBox.width}" height="${imageBox.height}" preserveAspectRatio="xMidYMid slice" />
        <rect x="${imageBox.x}" y="${imageBox.y}" width="${imageBox.width}" height="${imageBox.height}" fill="${hexToRgba(theme.surfaceStrong, isHero ? 0.18 : 0.14)}" />
      </g>
      <rect x="${imageBox.x}" y="${imageBox.y}" width="${imageBox.width}" height="${imageBox.height}" rx="${imageBox.radius}" fill="none" stroke="${hexToRgba(theme.accentSoft, 0.28)}" />
    `
    : `
      <rect x="${imageBox.x}" y="${imageBox.y}" width="${imageBox.width}" height="${imageBox.height}" rx="${imageBox.radius}" fill="${hexToRgba(theme.surfaceStrong, 0.56)}" stroke="${hexToRgba(theme.accentSoft, 0.18)}" />
      <circle cx="${imageBox.x + imageBox.width * 0.66}" cy="${imageBox.y + imageBox.height * 0.28}" r="94" fill="${primaryGlow}" />
      <circle cx="${imageBox.x + imageBox.width * 0.34}" cy="${imageBox.y + imageBox.height * 0.72}" r="132" fill="${secondaryGlow}" />
      <path d="M${imageBox.x + 54} ${imageBox.y + imageBox.height - 118}L${imageBox.x + 132} ${imageBox.y + imageBox.height - 224}L${imageBox.x + 212} ${imageBox.y + imageBox.height - 118}" stroke="${hexToRgba(theme.accentSoft, 0.28)}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M${imageBox.x + 182} ${imageBox.y + 116}L${imageBox.x + 236} ${imageBox.y + 206}L${imageBox.x + 196} ${imageBox.y + 206}L${imageBox.x + 248} ${imageBox.y + 304}" fill="${hexToRgba(theme.accent, 0.9)}" />
    `;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" fill="none">
  <defs>
    <linearGradient id="bg" x1="84" y1="64" x2="1004" y2="1036" gradientUnits="userSpaceOnUse">
      <stop stop-color="${theme.start}" />
      <stop offset="1" stop-color="${theme.end}" />
    </linearGradient>
    <linearGradient id="panel" x1="${textPanel.x}" y1="${textPanel.y}" x2="${textPanel.x + textPanel.width}" y2="${textPanel.y + textPanel.height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${hexToRgba(theme.surfaceStrong, 0.94)}" />
      <stop offset="1" stop-color="${hexToRgba(theme.surface, 0.88)}" />
    </linearGradient>
    <radialGradient id="glowTop" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(858 126) rotate(90) scale(240 288)">
      <stop stop-color="${secondaryGlow}" />
      <stop offset="1" stop-color="${hexToRgba(theme.accent, 0)}" />
    </radialGradient>
    <radialGradient id="glowBottom" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(224 930) rotate(90) scale(200 300)">
      <stop stop-color="${primaryGlow}" />
      <stop offset="1" stop-color="${hexToRgba(BRAND_PRIMARY, 0)}" />
    </radialGradient>
    <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0H0V56" stroke="${hexToRgba(theme.stroke, 0.14)}" stroke-width="1" />
    </pattern>
    <filter id="blur">
      <feGaussianBlur stdDeviation="32" />
    </filter>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="${hexToRgba(theme.surfaceStrong, 0.48)}" />
    </filter>
    <linearGradient id="button" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="${theme.accentSoft}" />
      <stop offset="1" stop-color="${theme.accent}" />
    </linearGradient>
  </defs>

  <rect width="1080" height="1080" rx="48" fill="#070707" />
  <rect x="20" y="20" width="1040" height="1040" rx="42" fill="url(#bg)" />
  <rect x="20" y="20" width="1040" height="1040" rx="42" fill="url(#grid)" />
  <circle cx="858" cy="126" r="230" fill="url(#glowTop)" />
  <circle cx="228" cy="924" r="210" fill="url(#glowBottom)" />
  <circle cx="${useImageOnRight ? 874 : 210}" cy="${isClosing ? 322 : 286}" r="94" fill="${secondaryGlow}" filter="url(#blur)" />
  <circle cx="${useImageOnRight ? 720 : 900}" cy="${isHero ? 850 : 908}" r="72" fill="${softGlow}" filter="url(#blur)" />
  <circle cx="${useImageOnRight ? 764 : 316}" cy="${isHero ? 182 : 864}" r="58" fill="${primaryGlow}" filter="url(#blur)" />
  <rect x="${textPanel.x}" y="${textPanel.y}" width="${textPanel.width}" height="${textPanel.height}" rx="44" fill="url(#panel)" stroke="${hexToRgba(theme.stroke, 0.26)}" filter="url(#softShadow)" />
  <rect x="${textPanel.x + 22}" y="${textPanel.y + 22}" width="${textPanel.width - 44}" height="${textPanel.height - 44}" rx="36" fill="${hexToRgba(theme.surfaceStrong, 0.12)}" stroke="${hexToRgba(theme.accentSoft, 0.06)}" />
  <rect x="${textPanel.x + 34}" y="${textPanel.y + 34}" width="${badgeWidth}" height="56" rx="28" fill="${hexToRgba(theme.surfaceStrong, 0.72)}" stroke="${hexToRgba(theme.accentSoft, 0.18)}" />
  <circle cx="${textPanel.x + 64}" cy="${textPanel.y + 62}" r="8" fill="${theme.accent}" />
  <text x="${textPanel.x + 82}" y="${textPanel.y + 69}" fill="${theme.accentSoft}" font-size="20" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.2" font-weight="700">${sectionLabel}</text>

  <rect x="916" y="58" width="110" height="46" rx="23" fill="${hexToRgba(theme.surfaceStrong, 0.66)}" stroke="${hexToRgba(theme.accentSoft, 0.18)}" />
  <text x="971" y="88" text-anchor="middle" fill="${theme.text}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">${input.index + 1}/${input.total}</text>

  <text x="${panelTextX}" y="${panelTopY}" fill="${theme.accent}" font-size="${isHero ? 26 : 22}" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.2" font-weight="700">${escapeXml(highlightTitle.toUpperCase())}</text>
  ${
    titleParts.prefix
      ? `<text x="${panelTextX}" y="${titleStartY + 4}" fill="${theme.accentSoft}" font-size="${titlePrefixFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">${escapeXml(titleParts.prefix)}</text>`
      : ""
  }
  <text x="${titleX}" y="${titleStartY}" fill="${theme.text}" font-size="${titleFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="700">
    ${titleLines
      .map(
        (line, lineIndex) =>
          `<tspan x="${titleX}" dy="${lineIndex === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>

  <text x="${panelTextX}" y="${bodyStartY}" fill="${theme.muted}" font-size="${isDenseBody ? 24 : 26}" font-family="Arial, Helvetica, sans-serif" font-weight="500">
    ${visibleBodyLines
      .map(
        (line, lineIndex) =>
          `<tspan x="${panelTextX}" dy="${lineIndex === 0 ? 0 : bodyLineHeight}">${escapeXml(line)}</tspan>`
      )
      .join("")}
  </text>

  ${isHero || visibleBulletLayouts.length === 0 ? `` : `<text x="${panelTextX}" y="${bulletHeaderY}" fill="${theme.accentSoft}" font-size="22" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.2" font-weight="700">POR QUE ISSO IMPORTA</text>`}
  ${bulletMarkup}

  ${
    isClosing
      ? `<text x="${panelTextX}" y="${buttonY - 54}" fill="${theme.accentSoft}" font-size="24" font-family="Arial, Helvetica, sans-serif" letter-spacing="2.4" font-weight="700">CTA FINAL</text>
         <text x="${panelTextX}" y="${buttonY - 10}" fill="${theme.text}" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="500">
           ${closingSupportLines
             .map(
               (line, lineIndex) =>
                 `<tspan x="${panelTextX}" dy="${lineIndex === 0 ? 0 : 34}">${escapeXml(line)}</tspan>`
             )
             .join("")}
         </text>`
      : ""
  }
  <rect x="${panelTextX}" y="${buttonY}" width="${buttonWidth}" height="${buttonHeight}" rx="${Math.round(buttonHeight / 2)}" fill="${isClosing ? "url(#button)" : hexToRgba(theme.surfaceStrong, 0.7)}" stroke="${isClosing ? "none" : hexToRgba(theme.accentSoft, 0.2)}" />
  <text x="${panelTextX + buttonWidth / 2}" y="${buttonTextY}" text-anchor="middle" fill="${isClosing ? "#15100A" : theme.text}" font-size="${isClosing ? 28 : isHero ? 28 : 24}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(ctaButtonLabel)}</text>

  <text x="${panelTextX}" y="${textPanel.y + textPanel.height - 48}" fill="${theme.muted}" font-size="20" font-family="Arial, Helvetica, sans-serif" letter-spacing="1.9" font-weight="600">${escapeXml(kickerText.toUpperCase())}</text>

  ${imageMarkup}
  <rect x="${imageBox.x - 20}" y="${imageBox.y + 38}" width="18" height="${Math.max(160, imageBox.height - 90)}" rx="9" fill="${hexToRgba(BRAND_PRIMARY, 0.95)}" />
  <path d="M${imageSideDecoration} ${imageBox.y + 56}L${imageSideDecoration + (useImageOnRight ? 28 : -28)} ${imageBox.y + 118}L${imageSideDecoration + (useImageOnRight ? 6 : -6)} ${imageBox.y + 118}L${imageSideDecoration + (useImageOnRight ? 34 : -34)} ${imageBox.y + 178}" fill="${BRAND_SECONDARY}" />
  <path d="M${useImageOnRight ? imageBox.x - 10 : imageBox.x + imageBox.width + 10} ${imageBox.y + imageBox.height - 180}L${useImageOnRight ? imageBox.x + 16 : imageBox.x + imageBox.width - 16} ${imageBox.y + imageBox.height - 122}L${useImageOnRight ? imageBox.x - 4 : imageBox.x + imageBox.width + 4} ${imageBox.y + imageBox.height - 122}L${useImageOnRight ? imageBox.x + 24 : imageBox.x + imageBox.width - 24} ${imageBox.y + imageBox.height - 64}" fill="${hexToRgba(theme.accentSoft, 0.9)}" />
  <rect x="${useImageOnRight ? imageBox.x - 92 : imageBox.x + imageBox.width - 96}" y="${imageBox.y + imageBox.height - 90}" width="128" height="56" rx="28" fill="${hexToRgba(theme.surfaceStrong, 0.78)}" stroke="${hexToRgba(theme.accentSoft, 0.18)}" />
  <text x="${useImageOnRight ? imageBox.x - 28 : imageBox.x + imageBox.width - 32}" y="${imageBox.y + imageBox.height - 54}" text-anchor="middle" fill="${theme.text}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">${isClosing ? "CHAMADA" : "IMPACTO"}</text>
</svg>
  `.trim();
}

function buildSlideSvgDataUrl(input: SlideRenderInput) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSlideSvg(input))}`;
}

async function inlineSvgExternalImages(svg: string): Promise<string> {
  const hrefPattern = /href="([^"]+)"/g;
  const externalUrls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(svg)) !== null) {
    const url = match[1];
    if (!url.startsWith("data:") && (url.startsWith("http") || url.startsWith("/"))) {
      externalUrls.push(url);
    }
  }

  if (externalUrls.length === 0) return svg;

  const unique = Array.from(new Set(externalUrls));
  const results = await Promise.all(
    unique.map(async (url) => {
      try {
        const absUrl = toAbsoluteClientAssetUrl(url) || url;
        const response = await fetch(absUrl, { credentials: "include" });
        if (!response.ok) return null;
        const blob = await response.blob();
        return blobToDataUrl(blob);
      } catch {
        return null;
      }
    })
  );

  let result = svg;
  for (let i = 0; i < unique.length; i++) {
    const dataUrl = results[i];
    if (dataUrl) {
      const escaped = unique[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`href="${escaped}"`, "g"), `href="${dataUrl}"`);
    }
  }
  return result;
}

async function renderSvgToPngDataUrl(svg: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Renderizacao de imagem indisponivel fora do navegador");
  }

  const embeddedSvg = await inlineSvgExternalImages(svg);

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1350;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Nao foi possivel preparar o canvas do slide"));
          return;
        }
        context.drawImage(image, 0, 0, 1080, 1350);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Falha ao converter slide para PNG"));
      }
    };
    image.onerror = () => {
      reject(new Error("Nao foi possivel carregar o SVG do slide para conversao"));
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(embeddedSvg)}`;
  });
}

function CoverImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no maximo 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => onChange((event.target?.result as string) || "");
    reader.readAsDataURL(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/70 p-3">
        <div className="h-16 w-16 overflow-hidden rounded-xl">
          <img src={value} alt="Capa do carrossel" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Imagem do bloco pronta</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ela sera aplicada no bloco inferior do modelo.
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl"
            onClick={() => inputRef.current?.click()}
            title="Trocar imagem"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onChange("")}
            title="Remover imagem"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-all duration-200",
        isDragging
          ? "scale-[1.01] border-primary bg-primary/5"
          : "border-border/40 hover:border-border hover:bg-accent/20"
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00] shadow-sm">
        <Image className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Adicionar imagem do bloco</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Opcional, o agente cria ou pesquisa uma imagem se voce nao enviar
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

function SlidePreview({
  slide,
  index,
  total,
  style,
  topic,
  hook,
  finalCta,
  coverImageUrl,
  profileAvatarUrl,
  profileName,
  profileHandle,
  profileInitials,
  profileId,
  className,
}: {
  slide: CarouselSlide;
  index: number;
  total: number;
  style: string;
  topic: string;
  hook: string;
  finalCta?: string;
  coverImageUrl?: string;
  profileAvatarUrl?: string;
  profileName?: string;
  profileHandle?: string;
  profileInitials?: string;
  profileId?: string;
  className?: string;
}) {
  const previewSvg = buildSlideSvg({
    slide,
    index,
    total,
    style,
    topic,
    hook,
    finalCta,
    coverImageUrl,
    profileAvatarUrl,
    profileName,
    profileHandle,
    profileInitials,
    profileId,
  });

  return (
    <div
      role="img"
      aria-label={`Preview do slide ${index + 1}`}
      className={cn(
        "relative aspect-[4/5] overflow-hidden rounded-lg border border-black/5 bg-white shadow-[0_30px_120px_-30px_rgba(15,23,42,0.42)] [&>svg]:block [&>svg]:h-full [&>svg]:w-full",
        className
      )}
      dangerouslySetInnerHTML={{ __html: previewSvg }}
    >
    </div>
  );
}

function CarouselCard({
  carousel,
  onOpen,
  onDownload,
  onPublish,
  onSchedule,
  onDelete,
  isPublishing,
  isScheduling,
  isDeleting,
  profileId,
}: {
  carousel: CarouselItem;
  onOpen: () => void;
  onDownload: () => void;
  onPublish: () => void;
  onSchedule: () => void;
  onDelete: () => void;
  isPublishing: boolean;
  isScheduling: boolean;
  isDeleting: boolean;
  profileId?: string;
}) {
  const heroSlide = carousel.slides[0];
  const renderedPreviewUrl = heroSlide?.renderedImageUrl
    ? toAbsoluteClientAssetUrl(heroSlide.renderedImageUrl)
    : null;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="group relative overflow-hidden rounded-[30px] border border-border/40 bg-background/75 p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative overflow-hidden rounded-[26px]">
          {renderedPreviewUrl && !imgFailed ? (
            <div className="aspect-[4/5] overflow-hidden rounded-[26px]">
              <img
                src={renderedPreviewUrl}
                alt="preview do slide"
                className="h-full w-full object-cover"
                onError={() => setImgFailed(true)}
              />
            </div>
          ) : (
            <SlidePreview
              slide={heroSlide}
              index={0}
              total={carousel.slides.length}
              style={carousel.style}
              topic={carousel.topic}
              hook={carousel.hook}
              finalCta={carousel.finalCta}
              coverImageUrl={carousel.coverImageUrl ?? undefined}
              profileId={profileId}
              profileHandle={profileId === "krythos" ? KRYTHOS_PROFILE_HANDLE : FLAVIO_PROFILE_HANDLE}
              profileName={profileId === "krythos" ? KRYTHOS_PROFILE_NAME : FLAVIO_PROFILE_NAME}
              profileInitials={profileId === "krythos" ? "KL" : "FV"}
              profileAvatarUrl={profileId === "krythos" ? KRYTHOS_PROFILE_AVATAR_URL : FLAVIO_PROFILE_AVATAR_URL}
              className="rounded-[26px] border-0 shadow-none"
            />
          )}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              <span>Carrossel IA</span>
              <span>{carousel.slides.length} slides</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
                {carousel.topic}
              </p>
              <ZoomIn className="h-4 w-4 shrink-0 text-white/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          </div>
        </div>
      </button>

      <div className="space-y-3 px-1 pb-1 pt-4">
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Gancho</span>
          <span>{formatDateLabel(carousel.createdAt)}</span>
        </div>
        <h3 className="line-clamp-3 text-base font-semibold leading-tight text-foreground transition-colors duration-200 group-hover:text-primary">
          {carousel.hook}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {carousel.finalCta}
        </p>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onOpen}>
            <ZoomIn className="mr-2 h-4 w-4" />
            Abrir
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={onDownload}
          >
            <Download className="mr-2 h-4 w-4" />
            ZIP
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            onClick={onPublish}
            disabled={isPublishing || isScheduling}
          >
            {isPublishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Instagram className="mr-2 h-4 w-4" />
            )}
            Postar
          </Button>
          <Button
            variant="outline"
            className="border-blue-500/30 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
            onClick={onSchedule}
            disabled={isPublishing || isScheduling}
          >
            {isScheduling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="mr-2 h-4 w-4" />
            )}
            Agendar
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Excluir
        </Button>
      </div>
    </div>
  );
}

function buildCarouselExportText(carousel: CarouselItem): string {
  const sections = [
    `Tema: ${carousel.topic}`,
    `Estilo: ${getStyleLabel(carousel.style)}`,
    `Gancho: ${carousel.hook}`,
    `CTA final: ${carousel.finalCta}`,
    "",
    "Legenda pronta:",
    carousel.caption,
    "",
    "Slides:",
    ...carousel.slides.map(
      (slide, index) =>
        `Slide ${index + 1}\nTitulo: ${slide.title}\n\n${slide.body}`
    ),
  ];

  return sections.join("\n\n");
}

function buildCarouselZipEntries(carousel: CarouselItem, profile?: ProfileModel): ZipEntry[] {
  const activeProfile = profile || PROFILE_MODELS[0];
  const slideEntries = carousel.slides.map((slide, index) => ({
    name: `slides/slide-${String(index + 1).padStart(2, "0")}.svg`,
    data: encodeUtf8(
      buildSlideSvg({
        slide,
        index,
        total: carousel.slides.length,
        style: carousel.style,
        topic: carousel.topic,
        hook: carousel.hook,
        finalCta: carousel.finalCta,
        coverImageUrl: carousel.coverImageUrl ?? undefined,
        profileId: activeProfile.id,
        profileAvatarUrl: activeProfile.avatarUrl,
        profileName: activeProfile.name,
        profileHandle: activeProfile.handle,
        profileInitials: activeProfile.initials,
      })
    ),
  }));

  const manifest = {
    topic: carousel.topic,
    style: carousel.style,
    styleLabel: getStyleLabel(carousel.style),
    hook: carousel.hook,
    caption: carousel.caption,
    finalCta: carousel.finalCta,
    slides: carousel.slides,
    createdAt: carousel.createdAt,
  };

  return [
    ...slideEntries,
    {
      name: "conteudo/carrossel.txt",
      data: encodeUtf8(buildCarouselExportText(carousel)),
    },
    {
      name: "conteudo/carrossel.json",
      data: encodeUtf8(JSON.stringify(manifest, null, 2)),
    },
  ];
}

async function buildCarouselTemplateSlides(
  carousel: CarouselItem,
  resolveAssetUrl: (url?: string) => Promise<string | undefined>,
  profile?: ProfileModel
) {
  const activeProfile = profile || PROFILE_MODELS[0];
  const embeddedProfileAvatarUrl = await resolveAssetUrl(activeProfile.avatarUrl);
  const embeddedCoverImageUrl = await resolveAssetUrl(carousel.coverImageUrl ?? undefined);
  const embeddedSlideImageUrls = await Promise.all(
    carousel.slides.map((slide) => resolveAssetUrl(slide.imageUrl))
  );
  const embeddedDesignTemplateUrls = await Promise.all(
    carousel.slides.map((slide) => resolveAssetUrl(slide.designTemplateUrl))
  );
  const sharedEmbeddedImageUrl =
    embeddedSlideImageUrls.find(
      (imageUrl) => isEmbeddedAssetUrl(imageUrl) && !isCarouselFallbackAssetUrl(imageUrl)
    ) ||
    (embeddedCoverImageUrl && !isCarouselFallbackAssetUrl(embeddedCoverImageUrl)
      ? embeddedCoverImageUrl
      : undefined);

  return Promise.all(
    carousel.slides.map(async (slide, index) => {
      const ownEmbeddedImageUrl = embeddedSlideImageUrls[index];
      const embeddedSlideImageUrl =
        ownEmbeddedImageUrl && !isCarouselFallbackAssetUrl(ownEmbeddedImageUrl)
          ? ownEmbeddedImageUrl
          : sharedEmbeddedImageUrl;
      const embeddedDesignTemplateUrl = embeddedDesignTemplateUrls[index];
      const svg = buildSlideSvg({
        slide: {
          ...slide,
          imageUrl: embeddedSlideImageUrl,
          designTemplateUrl: embeddedDesignTemplateUrl || slide.designTemplateUrl,
        },
        index,
        total: carousel.slides.length,
        style: carousel.style,
        topic: carousel.topic,
        hook: carousel.hook,
        finalCta: carousel.finalCta,
        coverImageUrl: embeddedCoverImageUrl,
        profileAvatarUrl: embeddedProfileAvatarUrl,
        profileName: activeProfile.name,
        profileHandle: activeProfile.handle,
        profileInitials: activeProfile.initials,
        profileId: activeProfile.id,
      });
      const imageDataUrl = await renderSvgToPngDataUrl(svg);

      return {
        title: slide.title,
        body: slide.body,
        imageUrl: slide.imageUrl,
        designTemplateName: slide.designTemplateName,
        designTemplateUrl: slide.designTemplateUrl,
        designStyleBrief: slide.designStyleBrief,
        renderedImageDataUrl: imageDataUrl,
        templateSvgUrl: slide.templateSvgUrl,
        renderedImageUrl: slide.renderedImageUrl,
      };
    })
  );
}

export default function Carousels() {
  const utils = trpc.useUtils();
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const selectedStyle = DEFAULT_STYLE_ID;
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [selectedCarouselId, setSelectedCarouselId] = useState<number | null>(null);
  const [modalSlide, setModalSlide] = useState(0);
  const [scheduleCarousel, setScheduleCarousel] = useState<CarouselItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(PROFILE_MODELS[0].id);
  const [useAiImages, setUseAiImages] = useState(false);
  const selectedProfileRef = useRef<ProfileModel>(PROFILE_MODELS[0]);
  const pendingTemplateSyncsRef = useRef(new Map<number, Promise<CarouselItem>>());

  const { data: carousels = [], isLoading } = trpc.carousel.getAll.useQuery();

  const generateCarouselMutation = trpc.carousel.generate.useMutation({
    onSuccess: (carousel) => {
      utils.carousel.getAll.invalidate();
      utils.carousel.getStats.invalidate();
      setSelectedCarouselId(carousel.id);
      setModalSlide(0);
      setTopic("");
      setCoverImageUrl("");
      toast.success("Carrossel gerado com sucesso!");
      void ensureCarouselDesignAssets(carousel as CarouselItem).catch((error) => {
        console.warn("[Carousel] Nao foi possivel enviar a imagem renderizada para AWS:", error);
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao gerar carrossel: " + message);
    },
  });
  const resolveAssetDataUrlMutation = trpc.carousel.resolveAssetDataUrl.useMutation();
  const saveDesignAssetsMutation = trpc.carousel.saveDesignAssets.useMutation({
    onSuccess: () => {
      utils.carousel.getAll.invalidate();
    },
  });
  const publishInstagramMutation = trpc.carousel.publishInstagram.useMutation();
  const scheduleInstagramMutation = trpc.carousel.scheduleInstagram.useMutation({
    onSuccess: () => {
      utils.posts.getAll.invalidate();
      utils.posts.getStats.invalidate();
    },
  });
  const deleteCarouselMutation = trpc.carousel.delete.useMutation({
    onSuccess: (_result, variables) => {
      utils.carousel.getAll.invalidate();
      utils.carousel.getStats.invalidate();
      if (selectedCarouselId === variables.id) {
        setSelectedCarouselId(null);
        setModalSlide(0);
      }
      toast.success("Carrossel excluido");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao excluir carrossel: " + message);
    },
  });
  const isGenerating = generateCarouselMutation.isPending;
  const isPublishingCarousel = publishInstagramMutation.isPending;
  const isSchedulingCarousel = scheduleInstagramMutation.isPending;
  const isDeleting = deleteCarouselMutation.isPending;

  const selectedCarousel =
    carousels.find((carousel) => carousel.id === selectedCarouselId) ?? null;
  const selectedSlides = selectedCarousel?.slides ?? [];
  const currentSlide = selectedSlides[modalSlide];

  const resolveTemplateAssetUrl = async (url?: string) => {
    const embeddedUrl = await toEmbeddedAssetUrl(url);
    if (!embeddedUrl || embeddedUrl.startsWith("data:")) {
      return embeddedUrl;
    }

    const resolvedUrl = toAbsoluteClientAssetUrl(url);
    if (!resolvedUrl) {
      return embeddedUrl;
    }

    try {
      const result = await resolveAssetDataUrlMutation.mutateAsync({ url: resolvedUrl });
      return result.dataUrl;
    } catch (error) {
      console.warn("[Carousel] Nao consegui resolver a imagem pelo servidor:", resolvedUrl, error);
      return undefined;
    }
  };

  const ensureCarouselDesignAssets = async (
    carousel: CarouselItem,
    options?: { silent?: boolean; force?: boolean }
  ): Promise<CarouselItem> => {
    const hasRenderedSlides =
      carousel.slides.length > 0 &&
      carousel.slides.every((slide) => Boolean(slide.renderedImageUrl));

    if (hasRenderedSlides && !options?.force) {
      return carousel;
    }

    const existing = pendingTemplateSyncsRef.current.get(carousel.id);
    if (existing) {
      return existing;
    }

    const task = (async () => {
      const toastId = `carousel-template-${carousel.id}`;

      if (!options?.silent) {
        toast.loading("Renderizando imagem completa dos slides...", { id: toastId });
      }

      try {
        const slides = await buildCarouselTemplateSlides(carousel, resolveTemplateAssetUrl, selectedProfileRef.current);
        const updated = await saveDesignAssetsMutation.mutateAsync({
          id: carousel.id,
          slides,
        });

        if (!options?.silent) {
          toast.success("Imagem completa salva no carrossel", { id: toastId });
        }

        return updated as CarouselItem;
      } catch (error) {
        if (!options?.silent) {
          const message = error instanceof Error ? error.message : "Erro desconhecido";
          toast.error("Nao foi possivel salvar a imagem renderizada: " + message, { id: toastId });
        }
        throw error;
      } finally {
        pendingTemplateSyncsRef.current.delete(carousel.id);
      }
    })();

    pendingTemplateSyncsRef.current.set(carousel.id, task);
    return task;
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error("Nao foi possivel copiar");
    }
  };

  const openCarousel = (carousel: CarouselItem) => {
    setSelectedCarouselId(carousel.id);
    setModalSlide(0);
  };

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error("Digite o tema do carrossel");
      return;
    }

    generateCarouselMutation.mutate({
      topic: topic.trim(),
      slideCount,
      style: selectedStyle,
      coverImageDataUrl: coverImageUrl || undefined,
      useAiImages,
    });
  };

  const handleDelete = (id: number) => {
    deleteCarouselMutation.mutate({ id });
  };

  const handleDownload = (carousel: CarouselItem) => {
    try {
      const zipEntries = buildCarouselZipEntries(carousel, selectedProfileRef.current);
      const blob = createZipBlob(zipEntries);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sanitizeFileName(carousel.topic)}-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Pacote .zip baixado com sucesso");
    } catch {
      toast.error("Erro ao gerar o pacote .zip");
    }
  };

  const prepareInstagramCarouselPayload = async (carousel: CarouselItem) => {
    const preparedCarousel = await ensureCarouselDesignAssets(carousel, {
      silent: true,
      force: true,
    });
    const slides = preparedCarousel.slides.map((slide) => ({
      title: slide.title,
      body: slide.body,
      imageUrl: toAbsoluteClientAssetUrl(slide.renderedImageUrl || slide.imageUrl),
    }));

    return {
      topic: preparedCarousel.topic,
      style: preparedCarousel.style,
      hook: preparedCarousel.hook,
      caption: preparedCarousel.caption,
      finalCta: preparedCarousel.finalCta,
      coverImageUrl: preparedCarousel.coverImageUrl ?? undefined,
      createdAt: toIsoTimestamp(preparedCarousel.createdAt),
      slides,
    };
  };

  const handlePublishInstagram = async (carousel: CarouselItem) => {
    try {
      toast.loading("Preparando carrossel completo para a Meta...", {
        id: "instagram-publish",
      });
      const payload = await prepareInstagramCarouselPayload(carousel);
      const result = await publishInstagramMutation.mutateAsync(payload);
      toast.success(`Carrossel publicado no Instagram. Media ID: ${result.mediaId}`, {
        id: "instagram-publish",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao postar no Instagram: " + message, {
        id: "instagram-publish",
      });
    }
  };

  const openScheduleDialog = (carousel: CarouselItem) => {
    setScheduleCarousel(carousel);
    setScheduleDate(toSchedulerDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
  };

  const handleScheduleInstagram = async () => {
    if (!scheduleCarousel) return;

    const scheduledAt = scheduleDate.trim();
    if (!scheduledAt) {
      toast.error("Escolha uma data e hora para agendar.");
      return;
    }

    if (!isSchedulerDatetimeLocalInFuture(scheduledAt)) {
      toast.error("Escolha uma data futura para agendar.");
      return;
    }

    try {
      toast.loading("Preparando carrossel para agendar...", {
        id: "instagram-schedule",
      });
      const payload = await prepareInstagramCarouselPayload(scheduleCarousel);
      await scheduleInstagramMutation.mutateAsync({
        ...payload,
        scheduledAt,
      });
      toast.success("Carrossel agendado para o Instagram.", {
        id: "instagram-schedule",
      });
      setScheduleCarousel(null);
      setScheduleDate("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao agendar no Instagram: " + message, {
        id: "instagram-schedule",
      });
    }
  };

  const handleCopySlide = async (slide: CarouselSlide, index: number) => {
    await copyText(
      `Slide ${index + 1}\n${slide.title}\n\n${slide.body}`,
      "Slide copiado"
    );
  };

  const handleCopyCaption = async (carousel: CarouselItem) => {
    await copyText(carousel.caption, "Legenda copiada");
  };

  const handleCopyHook = async (carousel: CarouselItem) => {
    await copyText(carousel.hook, "Gancho copiado");
  };

  const handleCopyCta = async (carousel: CarouselItem) => {
    await copyText(carousel.finalCta, "CTA copiado");
  };

  const handleCopyAll = async (carousel: CarouselItem) => {
    await copyText(buildCarouselExportText(carousel), "Carrossel completo copiado");
  };

  return (
    <AppLayout activeModule="carousel">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6 lg:p-8">
        <div className="animate-fade-in-up space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00] shadow-md">
              <Instagram className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Geração centralizada em carrossel
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Crie carrosseis com <span className="gradient-text">gancho, legenda e CTA</span>
          </h1>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div
            className="glass-card animate-fade-in-up space-y-6 p-6"
            style={{ animationDelay: "0.05s" }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Briefing do carrossel</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Defina o tema, a quantidade de slides e a imagem opcional para gerar no modelo original.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Type className="h-3.5 w-3.5" />
                Tema / Assunto
              </label>
              <Textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Ex: 5 erros que fazem seu conteudo passar despercebido no Instagram"
                className="min-h-[120px] resize-none rounded-2xl border-border/50 bg-background/70 text-sm"
                disabled={isGenerating}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Quantidade de slides
              </label>
              <div className="flex flex-wrap gap-2">
                {slideCountOptions.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSlideCount(count)}
                    className={cn(
                      "rounded-2xl border-2 px-4 py-2 text-sm font-semibold transition-all duration-150",
                      slideCount === count
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/30 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Instagram className="h-3.5 w-3.5" />
                Perfil do Instagram
              </label>
              <div className="flex flex-wrap gap-3">
                {PROFILE_MODELS.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => {
                      setSelectedProfileId(profile.id);
                      selectedProfileRef.current = profile;
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2.5 text-sm font-medium transition-all duration-150",
                      selectedProfileId === profile.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/30 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                      {profile.initials}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold leading-none">{profile.name}</p>
                      <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">{profile.handle}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Image className="h-3.5 w-3.5" />
                Imagem do bloco inferior
              </label>
              <CoverImageUpload value={coverImageUrl} onChange={setCoverImageUrl} />
              <p className="text-xs text-muted-foreground">
                Se você não enviar uma imagem, o agente busca ou gera uma imagem relacionada ao
                tema.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {deliveryHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/40 bg-background/60 p-4"
                >
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Pronto para gerar</p>
                <p className="text-xs text-muted-foreground">
                  O agente vai devolver os slides no perfil <strong>{PROFILE_MODELS.find((p) => p.id === selectedProfileId)?.handle}</strong>, com imagem tematica aplicada.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!topic.trim() || isGenerating}
                className="gap-2 border-0 bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white hover:opacity-90"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando carrossel...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Gerar carrossel no modelo
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/60 px-4 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">Imagens geradas por IA</p>
                <p className="text-xs text-muted-foreground">
                  {useAiImages
                    ? "Ligado — o agente vai gerar imagens com IA para cada slide."
                    : "Desligado — o agente vai buscar fotos no Unsplash, Pexels e Pixabay."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useAiImages}
                onClick={() => setUseAiImages((v) => !v)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none",
                  useAiImages ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200",
                    useAiImages ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {isGenerating ? (
              <div className="grid gap-3 rounded-2xl border border-border/40 bg-background/60 p-4 md:grid-cols-3">
                {["Gancho", "Legenda", "Slides"].map((label) => (
                  <div key={label} className="rounded-2xl border border-border/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="h-3 rounded-full bg-muted shimmer" />
                      <div className="h-3 w-4/5 rounded-full bg-muted shimmer" />
                      <div className="h-3 w-3/5 rounded-full bg-muted shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div
            className="glass-card animate-fade-in-up space-y-4 p-6"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Visão da geracão</h2>
            </div>

            <div className="rounded-3xl border border-border/40 bg-background/60 p-5">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Tema atual
              </p>
              <h3 className="mt-3 text-xl font-bold leading-tight text-foreground">
                {topic.trim() || "Seu proximo carrossel comeca aqui"}
              </h3>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-muted-foreground">
                  {slideCount} slides
                </span>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-muted-foreground">
                  {coverImageUrl ? "Com imagem propria" : "Imagem automatica"}
                </span>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-muted-foreground">
                  {DEFAULT_STYLE_LABEL}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  O que sai daqui
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  Slides em 4:5 com perfil, titulo, resumo e imagem tematica no bloco inferior.
                </p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Melhor uso
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  Use temas especificos, com dor clara, promessa forte ou contraste que gere
                  curiosidade.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Carrosseis gerados{" "}
              <span className="font-normal text-muted-foreground">({carousels.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="glass-card overflow-hidden p-4">
                  <div className="aspect-[4/5] rounded-2xl bg-muted shimmer" />
                  <div className="mt-4 space-y-3">
                    <div className="h-3 w-24 rounded-full bg-muted shimmer" />
                    <div className="h-5 rounded-full bg-muted shimmer" />
                    <div className="h-4 w-4/5 rounded-full bg-muted shimmer" />
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="h-9 rounded-xl bg-muted shimmer" />
                      <div className="h-9 rounded-xl bg-muted shimmer" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : carousels.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00] opacity-50">
                <Instagram className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Nenhum carrossel ainda</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Gere o primeiro carrossel acima e a plataforma devolve tudo pronto para usar.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {carousels.map((carousel) => (
                <CarouselCard
                  key={carousel.id}
                  carousel={carousel}
                  onOpen={() => openCarousel(carousel)}
                  onDownload={() => handleDownload(carousel)}
                  onPublish={() => handlePublishInstagram(carousel)}
                  onSchedule={() => openScheduleDialog(carousel)}
                  onDelete={() => deleteCarouselMutation.mutate({ id: carousel.id })}
                  isPublishing={isPublishingCarousel}
                  isScheduling={isSchedulingCarousel}
                  isDeleting={deleteCarouselMutation.isPending && deleteCarouselMutation.variables?.id === carousel.id}
                  profileId={selectedProfileId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={!!selectedCarousel}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCarouselId(null);
            setModalSlide(0);
          }
        }}
      >
        <DialogContent className="w-[min(96vw,1480px)] max-w-none overflow-hidden border-border/50 bg-background p-0">
          {selectedCarousel && currentSlide ? (
            <>
            <DialogTitle className="sr-only">
              Carrossel gerado: {selectedCarousel.topic}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Revise os slides, copie a legenda, baixe o pacote ou publique no Instagram.
            </DialogDescription>
            <div className="flex max-h-[92vh] min-h-[760px] flex-col xl:flex-row">
              <div className="border-b border-border/30 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(244,244,245,0.92)_40%,_rgba(228,228,231,0.88)_100%)] p-6 lg:p-8 xl:w-[560px] xl:border-b-0 xl:border-r">
                <div className="mx-auto w-full max-w-[420px]">
                  <SlidePreview
                    slide={currentSlide}
                    index={modalSlide}
                    total={selectedSlides.length}
                    style={selectedCarousel.style}
                    topic={selectedCarousel.topic}
                    hook={selectedCarousel.hook}
                    finalCta={selectedCarousel.finalCta}
                    coverImageUrl={selectedCarousel.coverImageUrl ?? undefined}
                    profileAvatarUrl={selectedProfileRef.current.avatarUrl}
                    profileName={selectedProfileRef.current.name}
                    profileHandle={selectedProfileRef.current.handle}
                    profileInitials={selectedProfileRef.current.initials}
                    profileId={selectedProfileRef.current.id}
                  />
                </div>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-2xl bg-background/80"
                    onClick={() => setModalSlide((value) => Math.max(0, value - 1))}
                    disabled={modalSlide === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="w-20 text-center text-xs text-muted-foreground">
                    {modalSlide + 1} / {selectedSlides.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-2xl bg-background/80"
                    onClick={() =>
                      setModalSlide((value) => Math.min(selectedSlides.length - 1, value + 1))
                    }
                    disabled={modalSlide === selectedSlides.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {selectedSlides.map((slide, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setModalSlide(index)}
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition-all duration-150",
                        modalSlide === index
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/40 bg-background/70 text-muted-foreground hover:border-border hover:text-foreground"
                      )}
                    >
                      {index + 1}. {slide.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-6 border-b border-border/30 p-6 lg:p-8">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Carrossel gerado
                    </p>
                    <h3 className="text-2xl font-semibold leading-tight text-foreground lg:text-3xl">
                      {selectedCarousel.topic}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedSlides.length} slides | pronto para design e postagem
                    </p>
                    <p className="hidden">
                      {selectedSlides.length} slides · {selectedCarousel.style}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/40 bg-background/70 transition-colors hover:bg-accent"
                    onClick={() => {
                      setSelectedCarouselId(null);
                      setModalSlide(0);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6 lg:p-8">
                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-border/40 bg-background/60 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Gancho
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handleCopyHook(selectedCarousel)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copiar
                        </Button>
                      </div>
                      <p className="mt-4 text-2xl font-semibold leading-tight text-foreground">
                        {selectedCarousel.hook}
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-border/40 bg-background/60 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          CTA final
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handleCopyCta(selectedCarousel)}
                        >
                          <Copy className="mr-1 h-3 w-3" />
                          Copiar
                        </Button>
                      </div>
                      <p className="mt-4 text-base leading-8 text-foreground">
                        {selectedCarousel.finalCta}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-border/40 bg-background/60 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Legenda pronta
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => handleCopyCaption(selectedCarousel)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copiar legenda
                      </Button>
                    </div>
                    <p className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground">
                      {selectedCarousel.caption}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-border/40 bg-background/60 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Slide {modalSlide + 1}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => handleCopySlide(currentSlide, modalSlide)}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copiar slide
                      </Button>
                    </div>
                    <h4 className="mt-4 text-2xl font-semibold leading-tight text-foreground">
                      {currentSlide.title}
                    </h4>
                    <p className="mt-4 whitespace-pre-line text-base leading-8 text-muted-foreground">
                      {currentSlide.body}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Todos os slides
                    </p>
                    {selectedSlides.map((slide, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setModalSlide(index)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-all duration-150",
                          modalSlide === index
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/20 hover:border-border/50 hover:bg-accent/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground">
                            {slide.title}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-border/30 p-6 lg:p-8">
                  <Button
                    onClick={() => handleDownload(selectedCarousel)}
                    className="gap-2 border-0 bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white hover:opacity-90"
                  >
                    <Download className="h-4 w-4" />
                    Baixar .zip
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePublishInstagram(selectedCarousel)}
                    disabled={isPublishingCarousel || isSchedulingCarousel}
                    className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  >
                    {isPublishingCarousel ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Instagram className="mr-2 h-4 w-4" />
                    )}
                    Postar Instagram
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openScheduleDialog(selectedCarousel)}
                    disabled={isPublishingCarousel || isSchedulingCarousel}
                    className="border-blue-500/30 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
                  >
                    {isSchedulingCarousel ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Calendar className="mr-2 h-4 w-4" />
                    )}
                    Agendar Instagram
                  </Button>
                  <Button variant="outline" onClick={() => handleCopyAll(selectedCarousel)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar tudo
                  </Button>
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => handleDelete(selectedCarousel.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!scheduleCarousel}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleCarousel(null);
            setScheduleDate("");
          }
        }}
      >
        <DialogContent className="w-[min(92vw,480px)] border-border/50 bg-background">
          <DialogTitle>Agendar Instagram</DialogTitle>
          <DialogDescription>
            Escolha quando este carrossel deve ser publicado no Instagram.
          </DialogDescription>
          <div className="space-y-4 pt-2">
            {scheduleCarousel ? (
              <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                <p className="line-clamp-2 text-sm font-medium text-foreground">
                  {scheduleCarousel.hook || scheduleCarousel.topic}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scheduleCarousel.slides.length} slides
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Data e hora ({POST_SCHEDULER_TIME_ZONE})
              </label>
              <Input
                type="datetime-local"
                value={scheduleDate}
                min={toSchedulerDatetimeLocalValue(new Date())}
                onChange={(event) => setScheduleDate(event.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setScheduleCarousel(null);
                  setScheduleDate("");
                }}
                disabled={isSchedulingCarousel}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2 bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleScheduleInstagram}
                disabled={isSchedulingCarousel || !scheduleDate}
              >
                {isSchedulingCarousel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
                Agendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
