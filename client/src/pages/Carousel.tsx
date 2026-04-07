import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
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

interface CarouselSlide {
  title: string;
  body: string;
  imageUrl?: string;
}

interface CarouselItem {
  id: number;
  topic: string;
  slides: CarouselSlide[];
  style: string;
  hook: string;
  caption: string;
  finalCta: string;
  coverImageUrl?: string;
  createdAt: string;
}

const topicSuggestions = [
  "5 erros que travam o crescimento no Instagram",
  "Como criar conteudo que gera comentarios de verdade",
  "O que separa um perfil comum de um perfil memoravel",
  "Como vender sem parecer forcar a venda nas redes sociais",
  "Os sinais de que sua estrategia de conteudo esta errada",
  "O passo a passo para transformar seguidores em clientes",
];

const DEFAULT_STYLE_ID = "signature";
const DEFAULT_STYLE_LABEL = "Assinatura";
const BRAND_PRIMARY = "#7b00ae";
const BRAND_SECONDARY = "#fe6e00";
const FLAVIO_PROFILE_NAME = "Flávio Vasconcelos";
const FLAVIO_PROFILE_HANDLE = "@comflavio";
const FLAVIO_PROFILE_AVATAR_URL = "/flavio-avatar.png";

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
};

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

function getStyleLabel(style: string) {
  return DEFAULT_STYLE_LABEL;
}

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
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
  return buildFlavioModelSlideSvg(input);
}

function buildFlavioModelSlideSvg(input: SlideRenderInput) {
  const idSuffix = hashString(`${input.topic}-${input.index}-${input.slide.title}`);
  const avatarClipId = `flavioAvatar-${idSuffix}`;
  const fallbackGradientId = `fallbackImage-${idSuffix}`;
  const coverImageUrl = toAbsoluteClientAssetUrl(input.slide.imageUrl || input.coverImageUrl);
  const titleSource = input.index === 0 ? input.hook || input.slide.title : input.slide.title;
  const titleLines = wrapTextLines(titleSource, titleSource.length > 52 ? 17 : 20, 3);
  const titleFontSize = titleLines.length >= 3 ? 58 : titleLines.some((line) => line.length > 18) ? 66 : 74;
  const titleLineHeight = Math.round(titleFontSize * 1.28);
  const summarySource = clampSentence(
    input.index === input.total - 1 && input.finalCta ? input.finalCta : input.slide.body,
    148
  );
  const summaryLines = wrapTextLines(summarySource || input.topic, 46, 2);
  const summaryFontSize = summaryLines.some((line) => line.length > 40) ? 34 : 38;
  const summaryLineHeight = Math.round(summaryFontSize * 1.28);
  const titleBlockHeight = (titleLines.length - 1) * titleLineHeight + titleFontSize;
  const summaryBlockHeight = summaryLines.length > 0
    ? (summaryLines.length - 1) * summaryLineHeight + summaryFontSize
    : 0;
  const textBlockGap = summaryLines.length > 0 ? 58 : 0;
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
  <text x="132" y="154" text-anchor="middle" fill="#ffffff" font-size="36" font-family="Arial, Helvetica, sans-serif" font-weight="700">FV</text>
  <image href="${toAbsoluteClientAssetUrl(FLAVIO_PROFILE_AVATAR_URL)}" x="68" y="74" width="128" height="128" preserveAspectRatio="xMidYMid slice" clip-path="url(#${avatarClipId})" />
  <circle cx="132" cy="138" r="64" fill="none" stroke="#e5e7eb" stroke-width="2" />

  <text x="222" y="140" fill="#050505" font-size="44" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(FLAVIO_PROFILE_NAME)}</text>
  <circle cx="682" cy="126" r="15" fill="#1d9bf0" />
  <path d="M675 126.5L680.5 132L690 121" stroke="#ffffff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" />
  <text x="222" y="185" fill="#9ca3af" font-size="35" font-family="Arial, Helvetica, sans-serif" font-weight="500">${escapeXml(FLAVIO_PROFILE_HANDLE)}</text>

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

function renderSvgToPngDataUrl(svg: string): Promise<string> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Renderizacao de imagem indisponivel fora do navegador"));
  }

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
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
  isPublishing,
}: {
  carousel: CarouselItem;
  onOpen: () => void;
  onDownload: () => void;
  onPublish: () => void;
  isPublishing: boolean;
}) {
  const heroSlide = carousel.slides[0];

  return (
    <div className="group relative overflow-hidden rounded-[30px] border border-border/40 bg-background/75 p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative overflow-hidden rounded-[26px]">
          <SlidePreview
            slide={heroSlide}
            index={0}
            total={carousel.slides.length}
            style={carousel.style}
            topic={carousel.topic}
            hook={carousel.hook}
            finalCta={carousel.finalCta}
            coverImageUrl={carousel.coverImageUrl}
            className="rounded-[26px] border-0 shadow-none"
          />
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
        <Button
          variant="outline"
          className="w-full border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          onClick={onPublish}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Instagram className="mr-2 h-4 w-4" />
          )}
          Postar Instagram
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

function buildCarouselZipEntries(carousel: CarouselItem): ZipEntry[] {
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
        coverImageUrl: carousel.coverImageUrl,
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

async function buildCarouselInstagramSlides(carousel: CarouselItem) {
  return Promise.all(
    carousel.slides.map(async (slide, index) => {
      const svg = buildSlideSvg({
        slide: {
          ...slide,
          imageUrl: toAbsoluteClientAssetUrl(slide.imageUrl),
        },
        index,
        total: carousel.slides.length,
        style: carousel.style,
        topic: carousel.topic,
        hook: carousel.hook,
        finalCta: carousel.finalCta,
        coverImageUrl: toAbsoluteClientAssetUrl(carousel.coverImageUrl),
      });
      const imageDataUrl = await renderSvgToPngDataUrl(svg);

      return {
        title: slide.title,
        body: slide.body,
        imageUrl: toAbsoluteClientAssetUrl(slide.imageUrl),
        svg,
        imageDataUrl,
      };
    })
  );
}

export default function Carousels() {
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const selectedStyle = DEFAULT_STYLE_ID;
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [carousels, setCarousels] = useState<CarouselItem[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCarousel, setSelectedCarousel] = useState<CarouselItem | null>(null);
  const [modalSlide, setModalSlide] = useState(0);

  const generateCarouselMutation = trpc.carousel.generate.useMutation();
  const publishInstagramMutation = trpc.carousel.publishInstagram.useMutation();
  const isGenerating = generateCarouselMutation.isPending;
  const isPublishingCarousel = publishInstagramMutation.isPending;

  const selectedSlides = selectedCarousel?.slides ?? [];
  const currentSlide = selectedSlides[modalSlide];

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error("Nao foi possivel copiar");
    }
  };

  const openCarousel = (carousel: CarouselItem) => {
    setSelectedCarousel(carousel);
    setModalSlide(0);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Digite o tema do carrossel");
      return;
    }

    try {
      const data = await generateCarouselMutation.mutateAsync({
        topic: topic.trim(),
        slideCount,
        style: selectedStyle,
        coverImageDataUrl: coverImageUrl || undefined,
      });

      const newCarousel: CarouselItem = {
        id: Date.now(),
        topic: topic.trim(),
        slides: data.slides ?? [],
        style: selectedStyle,
        hook: data.hook ?? data.slides?.[0]?.title ?? topic.trim(),
        caption: data.caption ?? "",
        finalCta: data.finalCta ?? "",
        coverImageUrl: data.coverImageUrl,
        createdAt: new Date().toISOString(),
      };

      setCarousels((prev) => [newCarousel, ...prev]);
      openCarousel(newCarousel);
      setTopic("");
      setCoverImageUrl("");
      toast.success("Carrossel gerado com sucesso!");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao gerar carrossel: " + message);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);
    try {
      setCarousels((prev) => prev.filter((carousel) => carousel.id !== id));
      if (selectedCarousel?.id === id) {
        setSelectedCarousel(null);
        setModalSlide(0);
      }
      toast.success("Carrossel excluido");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (carousel: CarouselItem) => {
    try {
      const zipEntries = buildCarouselZipEntries(carousel);
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

  const handlePublishInstagram = async (carousel: CarouselItem) => {
    try {
      toast.loading("Preparando imagens publicas para a Meta...", {
        id: "instagram-publish",
      });
      const slides = await buildCarouselInstagramSlides(carousel);
      const result = await publishInstagramMutation.mutateAsync({
        topic: carousel.topic,
        style: carousel.style,
        hook: carousel.hook,
        caption: carousel.caption,
        finalCta: carousel.finalCta,
        coverImageUrl: carousel.coverImageUrl,
        createdAt: carousel.createdAt,
        slides,
      });
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
              Geracao centralizada em carrossel
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Crie carrosseis com <span className="gradient-text">gancho, legenda e CTA</span>
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Esta pagina concentra toda a experiencia de geracao. Voce define o briefing e o
            agente interno devolve os slides, o gancho, a legenda pronta e o CTA final.
          </p>
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
                  Tudo o que o agente precisa para gerar uma versao pronta para design e postagem.
                </p>
              </div>
              <div className="rounded-full border border-[#7b00ae]/20 bg-[#7b00ae]/10 px-3 py-1 text-xs font-medium text-[#7b00ae]">
                Agente interno ativo
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
              <div className="flex flex-wrap gap-2">
                {topicSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setTopic(suggestion)}
                    className="rounded-full bg-accent/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
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
                <Image className="h-3.5 w-3.5" />
                Imagem do bloco inferior
              </label>
              <CoverImageUpload value={coverImageUrl} onChange={setCoverImageUrl} />
              <p className="text-xs text-muted-foreground">
                Se voce nao enviar uma imagem, o agente busca ou gera uma imagem relacionada ao
                tema para substituir o bloco azul do modelo.
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
                  O agente vai devolver os slides no modelo do Flavio, com imagem tematica aplicada.
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
              <h2 className="text-sm font-semibold text-foreground">Visao da geracao</h2>
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

          {carousels.length === 0 ? (
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
                  isPublishing={isPublishingCarousel}
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
            setSelectedCarousel(null);
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
                    coverImageUrl={selectedCarousel.coverImageUrl}
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
                      setSelectedCarousel(null);
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
                    disabled={isPublishingCarousel}
                    className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  >
                    {isPublishingCarousel ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Instagram className="mr-2 h-4 w-4" />
                    )}
                    Postar Instagram
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
    </AppLayout>
  );
}
