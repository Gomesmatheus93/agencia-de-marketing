import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Calendar,
  Check,
  Download,
  Image,
  Instagram,
  Layers,
  LayoutTemplate,
  Loader2,
  Newspaper,
  Link as LinkIcon,
  Pencil,
  RefreshCw,
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
  profileId?: string;
  slideType?: "hook" | "development" | "cta";
  shortText?: string;
  imagePrompt?: string;
  backgroundPrompt?: string;
  visualDirection?: string;
  layoutNotes?: string;
  highlightWords?: string[];
  editableFields?: {
    title: boolean;
    text: boolean;
    image: boolean;
    background: boolean;
    cta: boolean;
  };
  designTemplateName?: string;
  designTemplateUrl?: string;
  designStyleBrief?: string;
  templateSvgUrl?: string;
  renderedImageUrl?: string;
  fontFamily?: string;
  accentColor?: string;
  backgroundColor?: string;
  editorSettings?: SlideEditorSettings;
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

type SlideEditorSettings = {
  titleOffsetX?: number;
  titleOffsetY?: number;
  titleScale?: number;
  bodyOffsetX?: number;
  bodyOffsetY?: number;
  bodyScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imageScale?: number;
  imageRotation?: number;
  imageBrightness?: number;
  imageContrast?: number;
  imageSaturate?: number;
  titleColor?: string;
  bodyColor?: string;
};

type SlideEditorSettingKey = keyof SlideEditorSettings;

type NormalizedSlideEditorSettings = {
  titleOffsetX: number;
  titleOffsetY: number;
  titleScale: number;
  bodyOffsetX: number;
  bodyOffsetY: number;
  bodyScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageRotation: number;
  imageBrightness: number;
  imageContrast: number;
  imageSaturate: number;
  titleColor?: string;
  bodyColor?: string;
};

const topicSuggestions = [
  
];

const DEFAULT_STYLE_ID = "signature";
const DEFAULT_STYLE_LABEL = "Assinatura";
const BRAND_PRIMARY = "#7b00ae";
const BRAND_SECONDARY = "#fe6e00";
const FLAVIO_PROFILE_NAME = "Flávio Vasconcelos";
const FLAVIO_PROFILE_HANDLE = "@comflavio";
const FLAVIO_PROFILE_AVATAR_URL = "/flavio-avatar.png";
const FV_DARK = "#0f172a";
const FV_GOLD = "#c9a227";
const FV_BLUE = "#2196F3";
const FV_GRAY = "#6b7280";
const KRYTHOS_PROFILE_NAME = "krythoslab";
const KRYTHOS_PROFILE_HANDLE = "@krythoslab";
const KRYTHOS_PROFILE_AVATAR_URL = "/krythoslab-avatar.png";
const BRANDSDECODED_PROFILE_ID = "brandsdecoded-claude";
const BRANDSDECODED_PROFILE_NAME = "BrandsDecoded Claude";
const BRANDSDECODED_PROFILE_HANDLE = "@brandsdecoded";
const BRANDSDECODED_PROFILE_AVATAR_URL = KRYTHOS_PROFILE_AVATAR_URL;
const BRANDSDECODED_BG = "#050505";
const BRANDSDECODED_PANEL = "#111111";
const BRANDSDECODED_ACCENT = "#ff7a00";
const BRANDSDECODED_TEXT = "#f8f8f8";
const BRANDSDECODED_MUTED = "#d4d4d8";
const BRANDSDECODED_STROKE = "rgba(255,122,0,0.36)";
const DEFAULT_PROFILE_ID = BRANDSDECODED_PROFILE_ID;
const CLAUDE_MINIMAL_PROFILE_NAME = "Claude Minimalista";
const CLAUDE_MINIMAL_PROFILE_HANDLE = "@claude.design";
const CLAUDE_MINIMAL_PROFILE_AVATAR_URL = KRYTHOS_PROFILE_AVATAR_URL;
const CLAUDE_MINIMAL_BG = "#050505";
const CLAUDE_MINIMAL_PANEL = "#141414";
const CLAUDE_MINIMAL_ACCENT = "#d7d7d7";
const CLAUDE_MINIMAL_TEXT = "#f4f4f5";
const CLAUDE_MINIMAL_MUTED = "#b8b8b8";
const CLAUDE_MINIMAL_STROKE = "#2a2a2a";
const ALLE_ORANGE_BG = "#F47B20";
const ALLE_PURPLE_BG = "#7B2FBE";
const ALLE_DARK_TEXT = "#1E0A01";
const ALLE_SHAPE_LIGHT_ORANGE = "#F99040";
const ALLE_SHAPE_DARK_ORANGE = "#CC5500";
const ALLE_SHAPE_DARK_PURPLE = "#5B1D9A";
const ALLE_PROFILE_NAME = "Alle Energia";
const ALLE_PROFILE_HANDLE = "@alleenergia";
const ALLE_PROFILE_AVATAR_URL = "/alle-avatar.png";
const ALLE_MINIMAL_PROFILE_NAME = "Alle Energia Minimalista";
const ALLE_MINIMAL_PROFILE_HANDLE = ALLE_PROFILE_HANDLE;
const ALLE_MINIMAL_PROFILE_AVATAR_URL = ALLE_PROFILE_AVATAR_URL;
const ALLE_MINIMAL_BG = "#44015e";
const ALLE_MINIMAL_PANEL = "#7c00ae";
const ALLE_MINIMAL_ACCENT = "#ff6600";
const ALLE_MINIMAL_TEXT = "#ffffff";
const ALLE_MINIMAL_MUTED = "rgba(255,255,255,0.84)";
const ALLE_MINIMAL_STROKE = "rgba(255,102,0,0.45)";

const FONT_OPTIONS = [
  { id: "default", label: "Padrão (Arial)", value: "Arial, Helvetica, sans-serif" },
  { id: "serif", label: "Serifada (Georgia)", value: "Georgia, 'Times New Roman', serif" },
  { id: "rounded", label: "Arredondada (Verdana)", value: "Verdana, Geneva, sans-serif" },
  { id: "compact", label: "Compacta (Impact)", value: "Impact, 'Arial Narrow', sans-serif" },
  { id: "mono", label: "Mono (Courier)", value: "'Courier New', Courier, monospace" },
] as const;

type FontOptionId = (typeof FONT_OPTIONS)[number]["id"];

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
  { id: BRANDSDECODED_PROFILE_ID, name: BRANDSDECODED_PROFILE_NAME, handle: BRANDSDECODED_PROFILE_HANDLE, initials: "BD", avatarUrl: BRANDSDECODED_PROFILE_AVATAR_URL },
  { id: "claude-minimalista", name: CLAUDE_MINIMAL_PROFILE_NAME, handle: CLAUDE_MINIMAL_PROFILE_HANDLE, initials: "CM", avatarUrl: CLAUDE_MINIMAL_PROFILE_AVATAR_URL },
  { id: "alle-minimalista", name: ALLE_MINIMAL_PROFILE_NAME, handle: ALLE_MINIMAL_PROFILE_HANDLE, initials: "AE", avatarUrl: ALLE_MINIMAL_PROFILE_AVATAR_URL },
  { id: "alle-laranja", name: ALLE_PROFILE_NAME, handle: ALLE_PROFILE_HANDLE, initials: "AE", avatarUrl: ALLE_PROFILE_AVATAR_URL },
  { id: "alle-roxo", name: ALLE_PROFILE_NAME, handle: ALLE_PROFILE_HANDLE, initials: "AE", avatarUrl: ALLE_PROFILE_AVATAR_URL },
];

type MinimalCarouselTheme = {
  profileName: string;
  profileHandle: string;
  bg: string;
  panel: string;
  accent: string;
  text: string;
  muted: string;
  stroke: string;
  placeholderFill: string;
  ctaSupportText: string;
};

function isMinimalCarouselProfile(profileId?: string) {
  return profileId === BRANDSDECODED_PROFILE_ID || profileId === "claude-minimalista" || profileId === "alle-minimalista";
}

function getMinimalCarouselTheme(profileId?: string): MinimalCarouselTheme {
  if (profileId === BRANDSDECODED_PROFILE_ID) {
    return {
      profileName: BRANDSDECODED_PROFILE_NAME,
      profileHandle: BRANDSDECODED_PROFILE_HANDLE,
      bg: BRANDSDECODED_BG,
      panel: BRANDSDECODED_PANEL,
      accent: BRANDSDECODED_ACCENT,
      text: BRANDSDECODED_TEXT,
      muted: BRANDSDECODED_MUTED,
      stroke: BRANDSDECODED_STROKE,
      placeholderFill: "#0b0b0b",
      ctaSupportText: "Compartilhe com quem precisa transformar conteudo em autoridade.",
    };
  }

  if (profileId === "alle-minimalista") {
    return {
      profileName: ALLE_MINIMAL_PROFILE_NAME,
      profileHandle: ALLE_MINIMAL_PROFILE_HANDLE,
      bg: ALLE_MINIMAL_BG,
      panel: ALLE_MINIMAL_PANEL,
      accent: ALLE_MINIMAL_ACCENT,
      text: ALLE_MINIMAL_TEXT,
      muted: ALLE_MINIMAL_MUTED,
      stroke: ALLE_MINIMAL_STROKE,
      placeholderFill: ALLE_MINIMAL_BG,
      ctaSupportText: "Compartilhe com quem precisa economizar energia.",
    };
  }

  return {
    profileName: CLAUDE_MINIMAL_PROFILE_NAME,
    profileHandle: CLAUDE_MINIMAL_PROFILE_HANDLE,
    bg: CLAUDE_MINIMAL_BG,
    panel: CLAUDE_MINIMAL_PANEL,
    accent: CLAUDE_MINIMAL_ACCENT,
    text: CLAUDE_MINIMAL_TEXT,
    muted: CLAUDE_MINIMAL_MUTED,
    stroke: CLAUDE_MINIMAL_STROKE,
    placeholderFill: "#101010",
    ctaSupportText: "Compartilhe com quem ainda esta atras de quem usa IA.",
  };
}

function getProfileModelById(profileId?: string): ProfileModel {
  return PROFILE_MODELS.find((profile) => profile.id === profileId) ?? PROFILE_MODELS[0];
}

function getCarouselProfileId(carousel?: { slides: CarouselSlide[] } | null) {
  return carousel?.slides.find((slide) => slide.profileId)?.profileId;
}

function getCarouselProfileModel(
  carousel?: { slides: CarouselSlide[] } | null,
  fallbackProfileId?: string
) {
  return getProfileModelById(getCarouselProfileId(carousel) ?? fallbackProfileId);
}

function getSlideType(
  slide: CarouselSlide,
  slideIndex: number,
  totalSlides: number
): "hook" | "development" | "cta" {
  if (slide.slideType) return slide.slideType;
  if (slideIndex === 0) return "hook";
  if (slideIndex === totalSlides - 1) return "cta";
  return "development";
}

const slideCountOptions = [1, 3, 5, 7, 10];
const carouselFormatOptions = [
  { id: "feed", label: "Feed", description: "Tamanho atual (4:5)" },
  { id: "story", label: "Story", description: "9:16 (1080x1920)" },
] as const;

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
  fontFamily?: string;
  accentColor?: string;
  backgroundColor?: string;
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

const DEFAULT_SLIDE_EDITOR_SETTINGS: NormalizedSlideEditorSettings = {
  titleOffsetX: 0,
  titleOffsetY: 0,
  titleScale: 1,
  bodyOffsetX: 0,
  bodyOffsetY: 0,
  bodyScale: 1,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageScale: 1,
  imageRotation: 0,
  imageBrightness: 100,
  imageContrast: 100,
  imageSaturate: 100,
  titleColor: undefined,
  bodyColor: undefined,
};

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeOptionalHexColor(value?: string) {
  if (!value) return undefined;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : undefined;
}

function normalizeSlideEditorSettings(
  settings?: SlideEditorSettings
): NormalizedSlideEditorSettings {
  return {
    titleOffsetX: clampNumber(settings?.titleOffsetX ?? 0, -320, 320),
    titleOffsetY: clampNumber(settings?.titleOffsetY ?? 0, -320, 320),
    titleScale: clampNumber(settings?.titleScale ?? 1, 0.7, 1.6),
    bodyOffsetX: clampNumber(settings?.bodyOffsetX ?? 0, -320, 320),
    bodyOffsetY: clampNumber(settings?.bodyOffsetY ?? 0, -320, 320),
    bodyScale: clampNumber(settings?.bodyScale ?? 1, 0.7, 1.6),
    imageOffsetX: clampNumber(settings?.imageOffsetX ?? 0, -360, 360),
    imageOffsetY: clampNumber(settings?.imageOffsetY ?? 0, -360, 360),
    imageScale: clampNumber(settings?.imageScale ?? 1, 0.7, 2),
    imageRotation: clampNumber(settings?.imageRotation ?? 0, -45, 45),
    imageBrightness: clampNumber(settings?.imageBrightness ?? 100, 50, 160),
    imageContrast: clampNumber(settings?.imageContrast ?? 100, 50, 180),
    imageSaturate: clampNumber(settings?.imageSaturate ?? 100, 0, 200),
    titleColor: sanitizeOptionalHexColor(settings?.titleColor),
    bodyColor: sanitizeOptionalHexColor(settings?.bodyColor),
  };
}

function buildEditorTransform(
  offsetX: number,
  offsetY: number,
  scale = 1,
  rotation = 0
) {
  return `translate(${offsetX}px, ${offsetY}px) scale(${scale}) rotate(${rotation}deg)`;
}

function applySlideEditorSettings(svg: string, settings?: SlideEditorSettings) {
  if (!settings) {
    return svg;
  }

  const normalized = normalizeSlideEditorSettings(settings);
  const styleRules = [
    `.editor-title-layer{transform-box:fill-box;transform-origin:center center;transform:${buildEditorTransform(
      normalized.titleOffsetX,
      normalized.titleOffsetY,
      normalized.titleScale
    )};}`,
    `.editor-body-layer{transform-box:fill-box;transform-origin:center center;transform:${buildEditorTransform(
      normalized.bodyOffsetX,
      normalized.bodyOffsetY,
      normalized.bodyScale
    )};}`,
    `.editor-image,.editor-image-layer{transform-box:fill-box;transform-origin:center center;transform:${buildEditorTransform(
      normalized.imageOffsetX,
      normalized.imageOffsetY,
      normalized.imageScale,
      normalized.imageRotation
    )};}`,
    `.editor-image{filter:brightness(${normalized.imageBrightness}%) contrast(${normalized.imageContrast}%) saturate(${normalized.imageSaturate}%);}`,
    normalized.titleColor
      ? `.editor-title-layer,.editor-title-layer text,.editor-title-layer tspan{fill:${normalized.titleColor}!important;}`
      : "",
    normalized.bodyColor
      ? `.editor-body-layer,.editor-body-layer text,.editor-body-layer tspan{fill:${normalized.bodyColor}!important;}`
      : "",
  ]
    .filter(Boolean)
    .join("");

  if (!styleRules) {
    return svg;
  }

  return svg.replace(/(<svg\b[^>]*>)/, `$1<style>${styleRules}</style>`);
}

function clearRenderedSlideAsset(slide: CarouselSlide): CarouselSlide {
  return {
    ...slide,
    renderedImageUrl: undefined,
  };
}

function clearRenderedSlideAssets(slides: CarouselSlide[]) {
  return slides.map((slide) => clearRenderedSlideAsset(slide));
}

function slideSupportsImageEditor(
  slide: CarouselSlide,
  index: number,
  total: number,
  profileId?: string
) {
  if (slide.designTemplateUrl) {
    return true;
  }

  if (profileId === "krythos") {
    return index === 0;
  }

  return index < total - 1;
}

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

function wrapTextLinesWithoutTruncation(text: string, maxChars: number) {
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
  }

  if (currentLine) {
    lines.push(currentLine);
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
  if (input.style === "importado") {
    const url = toAbsoluteClientAssetUrl(input.slide.renderedImageUrl || input.slide.imageUrl) ?? "";
    return `<div style="width:100%;height:100%;background:url('${url}') center/cover no-repeat;display:block;"></div>`;
  }

  let svg: string;
  if (input.slide.designTemplateUrl) {
    svg = buildTemplateDrivenSlideSvg(input);
  } else if (isMinimalCarouselProfile(input.profileId)) {
    if (input.index === 0) svg = buildClaudeMinimalHookSlideSvg(input);
    else if (input.index === input.total - 1) svg = buildClaudeMinimalCTASlideSvg(input);
    else svg = buildClaudeMinimalContentSlideSvg(input);
  } else if (input.profileId === "krythos") {
    if (input.index === 0) svg = buildKrythosHookSlideSvg(input);
    else if (input.index === input.total - 1) svg = buildKrythosCTASlideSvg(input);
    else svg = buildKrythosContentSlideSvg(input);
  } else if (input.profileId === "alle-laranja" || input.profileId === "alle-roxo") {
    if (input.index === 0) svg = buildAlleHookSlideSvg(input);
    else if (input.index === input.total - 1) svg = buildAlleCTASlideSvg(input);
    else svg = buildAlleContentSlideSvg(input);
  } else {
    if (input.index === 0) svg = buildFlavioHookSlideSvg(input);
    else if (input.index === input.total - 1) svg = buildFlavioCTASlideSvg(input);
    else svg = buildFlavioContentSlideSvg(input);
  }

  const resolvedFont = input.fontFamily ?? input.slide.fontFamily;
  if (resolvedFont) {
    svg = svg.replace(/(<svg\b[^>]*>)/, `$1<style>text,tspan{font-family:${resolvedFont}!important}</style>`);
  }

  const resolvedAccent = input.accentColor ?? input.slide.accentColor;
  const resolvedBg = input.backgroundColor ?? input.slide.backgroundColor;
  if (resolvedAccent || resolvedBg) {
    if (isMinimalCarouselProfile(input.profileId)) {
      const minimalTheme = getMinimalCarouselTheme(input.profileId);
      if (resolvedAccent) svg = svg.replaceAll(minimalTheme.accent, resolvedAccent);
      if (resolvedBg) svg = svg.replaceAll(minimalTheme.bg, resolvedBg);
    } else if (input.profileId === "krythos") {
      if (resolvedAccent) svg = svg.replaceAll("#29d9ff", resolvedAccent).replaceAll("#29D9FF", resolvedAccent);
      if (resolvedBg) svg = svg.replaceAll("#0d1117", resolvedBg).replaceAll("#0D1117", resolvedBg);
    } else if (input.profileId === "alle-laranja") {
      if (resolvedAccent) svg = svg.replaceAll(ALLE_DARK_TEXT, resolvedAccent);
      if (resolvedBg) svg = svg.replaceAll(ALLE_ORANGE_BG, resolvedBg);
    } else if (input.profileId === "alle-roxo") {
      if (resolvedAccent) svg = svg.replaceAll(ALLE_ORANGE_BG, resolvedAccent);
      if (resolvedBg) svg = svg.replaceAll(ALLE_PURPLE_BG, resolvedBg);
    } else {
      if (resolvedAccent) svg = svg.replaceAll(FV_GOLD, resolvedAccent);
      if (resolvedBg) svg = svg.replaceAll(FV_BLUE, resolvedBg);
    }
  }

  return applySlideEditorSettings(svg, input.slide.editorSettings);
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

  <g class="editor-title-layer">
    <text x="${textX}" y="${titleStartY}" fill="${titleFill}" font-size="${titleFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="800">
      ${titleLines
        .map(
          (line, lineIndex) =>
            `<tspan x="${textX}" dy="${lineIndex === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`
        )
        .join("")}
    </text>
  </g>

  <g class="editor-body-layer">
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
  </g>

  <rect x="72" y="792" width="936" height="486" rx="34" fill="${generatedImageUrl ? "rgba(255, 255, 255, 0.12)" : `url(#${imageFallbackGradientId})`}" stroke="${panelStroke}" />
  ${
    generatedImageUrl
      ? `
  <g clip-path="url(#${imageClipId})">
    <image class="editor-image" href="${escapeXml(generatedImageUrl)}" x="72" y="${imageYOffset}" width="936" height="486" preserveAspectRatio="xMidYMid slice" />
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

// Helper: render two-tone title lines as separate <text> elements (one per line)
// Line index 1 gets its first word in gold, the rest dark navy.
function flavioTitleSvg(lines: string[], tfs: number, tlh: number, cx: number, startY: number, anchor: "middle" | "start"): string {
  return lines.map((line, i) => {
    const y = startY + i * tlh;
    const xAttr = `x="${cx}"`;
    const anchor_ = `text-anchor="${anchor}"`;
    const base = `font-size="${tfs}" font-family="Arial, Helvetica, sans-serif" font-weight="800"`;
    if (i === 1) {
      const sp = line.indexOf(" ");
      if (sp === -1) {
        return `<text ${xAttr} y="${y}" ${anchor_} ${base} fill="${FV_GOLD}">${escapeXml(line)}</text>`;
      }
      const w1 = line.slice(0, sp);
      const rest = line.slice(sp);
      return `<text ${xAttr} y="${y}" ${anchor_} ${base}><tspan fill="${FV_GOLD}">${escapeXml(w1)}</tspan><tspan fill="${FV_DARK}">${escapeXml(rest)}</tspan></text>`;
    }
    return `<text ${xAttr} y="${y}" ${anchor_} ${base} fill="${FV_DARK}">${escapeXml(line)}</text>`;
  }).join("\n  ");
}

// ── GANCHO (slide 0) ─────────────────────────────────────────────────────────
function buildFlavioHookSlideSvg(input: SlideRenderInput): string {
  const id = hashString(`${input.topic}-fh-${input.index}`);
  const avClip = `fhAv-${id}`;
  const imgClip = `fhImg-${id}`;
  const avatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || FLAVIO_PROFILE_AVATAR_URL);
  const imgUrl = toAbsoluteClientAssetUrl(input.slide.imageUrl || input.coverImageUrl);

  // Title — two-tone: line-2 first word = gold
  const rawTitle = (input.hook || input.slide.title || input.topic).replace(/\s+/g, " ").trim();
  const titleLines = wrapTextLines(rawTitle, 17, 3);
  const tfs = titleLines.length >= 3 ? 72 : titleLines.length === 2 ? 84 : 90;
  const tlh = Math.round(tfs * 1.22);
  const titleBlockH = (titleLines.length - 1) * tlh + tfs;

  // Summary — centered gray subtitle
  const rawSummary = (input.slide.body || input.topic).replace(/\s+/g, " ").trim();
  const sumLines = wrapTextLines(rawSummary, 38, 3);
  const sfs = 32;
  const slh = 42;

  // Vertical layout
  const blueY = 768;          // blue section starts here
  const titleZoneTop = 220;   // below profile+separator
  const titleZoneBot = blueY - 200; // leave room for underline + summary
  const titleZoneMid = Math.round((titleZoneTop + titleZoneBot) / 2);
  const titleTop = titleZoneMid - Math.round(titleBlockH / 2);
  const titleBaseY = titleTop + Math.round(tfs * 0.78);
  const titleBotPx = titleTop + titleBlockH;
  const underlineY = titleBotPx + 28;
  const sumStartY = underlineY + 8 + 36 + Math.round(sfs * 0.78);

  // Dot grid — left margin, below profile
  const dots = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 6 }, (_, c) =>
      `<circle cx="${52 + c * 16}" cy="${440 + r * 18}" r="2.5" fill="#c8c8c8" opacity="0.6" />`
    ).join("")
  ).join("\n  ");

  // Decorative quarter-circle arcs — top-right
  const arcs = [100, 180, 260, 340, 420].map(r =>
    `<path d="M${1080 - r},0 A${r},${r} 0 0 1 1080,${r}" fill="none" stroke="#e8ddd0" stroke-width="1.5" />`
  ).join("\n  ");

  // Blue area image markup
  const imgH = 1350 - blueY;
  const imgMarkup = imgUrl
    ? `<image href="${escapeXml(imgUrl)}" x="0" y="${blueY}" width="1080" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${imgClip})" />`
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <clipPath id="${avClip}"><circle cx="112" cy="108" r="56" /></clipPath>
    <clipPath id="${imgClip}"><rect x="0" y="${blueY}" width="1080" height="${imgH}" /></clipPath>
  </defs>

  <!-- White background -->
  <rect width="1080" height="1350" fill="#ffffff" />

  <!-- Decorative arcs top-right -->
  ${arcs}

  <!-- Profile: avatar -->
  <circle cx="112" cy="108" r="56" fill="#e5e7eb" />
  <text x="112" y="124" text-anchor="middle" fill="${FV_DARK}" font-size="32" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileInitials || "FV")}</text>
  <image href="${escapeXml(avatarUrl || "")}" x="56" y="52" width="112" height="112" preserveAspectRatio="xMidYMid slice" clip-path="url(#${avClip})" />
  <circle cx="112" cy="108" r="56" fill="none" stroke="#e5e7eb" stroke-width="2" />

  <!-- Profile: name + verified + handle -->
  <text x="196" y="100" fill="${FV_DARK}" font-size="40" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileName || FLAVIO_PROFILE_NAME)}</text>
  <circle cx="666" cy="87" r="13" fill="#1d9bf0" />
  <path d="M659 87.5L664.5 93L674 82" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" />
  <text x="196" y="142" fill="${FV_GRAY}" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(input.profileHandle || FLAVIO_PROFILE_HANDLE)}</text>

  <g class="editor-title-layer">
    <!-- Title (two-tone, centered) -->
    ${flavioTitleSvg(titleLines, tfs, tlh, 540, titleBaseY, "middle")}

    <!-- Gold underline (short, centered) -->
    <rect x="495" y="${underlineY}" width="90" height="5" rx="2.5" fill="${FV_GOLD}" />
  </g>

  <g class="editor-body-layer">
    <!-- Summary text -->
    ${sumLines.map((l, i) => `<text x="540" y="${sumStartY + i * slh}" text-anchor="middle" fill="${FV_GRAY}" font-size="${sfs}" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(l)}</text>`).join("\n  ")}
  </g>

  <!-- Dot grid (left margin) -->
  ${dots}

  <!-- Blue image section -->
  <rect x="0" y="${blueY}" width="1080" height="${imgH}" fill="${FV_BLUE}" />
  ${imgMarkup.replace("<image ", "<image class=\"editor-image\" ")}

  <!-- Swipe indicator bottom-right -->
  <text x="976" y="${blueY + imgH - 60}" text-anchor="end" fill="rgba(255,255,255,0.92)" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="400">Arraste para o lado</text>
  <text x="976" y="${blueY + imgH - 28}" text-anchor="end" fill="rgba(255,255,255,0.92)" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="400">e confira o conte&#250;do</text>
  <circle cx="1032" cy="${blueY + imgH - 44}" r="26" fill="${FV_DARK}" opacity="0.5" />
  <text x="1032" y="${blueY + imgH - 36}" text-anchor="middle" fill="#ffffff" font-size="26" font-family="Arial, Helvetica, sans-serif">&#8594;</text>
</svg>`.trim();
}

// ── DESENVOLVIMENTO (slides intermediários) ──────────────────────────────────
function buildFlavioContentSlideSvg(input: SlideRenderInput): string {
  const id = hashString(`${input.topic}-fc-${input.index}`);
  const avClip = `fcAv-${id}`;
  const imgClip = `fcImg-${id}`;
  const avatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || FLAVIO_PROFILE_AVATAR_URL);
  const imgUrl = toAbsoluteClientAssetUrl(input.slide.imageUrl || input.coverImageUrl);

  // Title — two-tone, left-aligned
  const rawTitle = input.slide.title.replace(/\s+/g, " ").trim();
  const titleLines = wrapTextLines(rawTitle, 15, 3);
  const tfs = titleLines.length >= 3 ? 52 : titleLines.length === 2 ? 60 : 68;
  const tlh = Math.round(tfs * 1.2);
  const titleBlockH = (titleLines.length - 1) * tlh + tfs;

  // Body text — split into sentences for paragraphs / quote / callout
  const rawBody = (input.slide.body || "").replace(/\s+/g, " ").trim();
  const sentences = rawBody.split(/(?<=[.!?])\s+/).filter(Boolean);
  const para1Text = sentences.slice(0, Math.ceil(sentences.length / 3)).join(" ");
  const quoteText = sentences.slice(Math.ceil(sentences.length / 3), Math.ceil(sentences.length * 2 / 3)).join(" ") || para1Text;
  const calloutText = sentences.slice(Math.ceil(sentences.length * 2 / 3)).join(" ") || rawTitle;

  const bfs = 28, blh = 42;
  const para1Lines = wrapTextLines(para1Text, 44, 4);
  const quoteLines = wrapTextLines(quoteText, 42, 4);
  const calloutLines = wrapTextLines(calloutText, 46, 2);

  // Layout constants
  const PL = 80, PR = 80;
  const CW = 1080 - PL - PR; // 920

  // Profile header
  const avCy = 74;
  const sepY = 132;

  // Title block
  const titleX = PL;
  const titleY = 162;
  const titleBaseY = titleY + Math.round(tfs * 0.78);
  const titleBotY = titleY + titleBlockH;

  // Gold underline (left-aligned, short)
  const ulY = titleBotY + 16;

  // Document icon + paragraph 1
  const iconY = ulY + 20;   // top of content row
  const iconCx = PL + 22;
  const iconCy = iconY + 30;
  const para1X = PL + 58;
  const para1Y = iconY + Math.round(bfs * 0.82);
  const para1H = para1Lines.length * blh;

  // Quote block
  const quoteTopY = Math.max(iconY + para1H + 20, iconY + 100);
  const quotePad = 22;
  const quoteH = Math.max(80, quoteLines.length * blh + quotePad * 2);
  const quoteBotY = quoteTopY + quoteH;

  // Callout row (icon circle + separator + text)
  const calloutY = quoteBotY + 24;
  const calloutH = calloutLines.length > 1 ? 80 : 58;
  const calloutBotY = calloutY + calloutH;

  // Blue rounded image at bottom
  const imgTopY = Math.max(calloutBotY + 28, 920);
  const imgH = 1310 - imgTopY;
  const imgRx = 24;

  const imgMarkup = imgUrl
    ? `<image href="${escapeXml(imgUrl)}" x="${PL}" y="${imgTopY}" width="${CW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${imgClip})" />`
    : "";

  // Document icon SVG (gold outline, centered at iconCx, iconCy)
  const docIcon = `
  <rect x="${iconCx - 18}" y="${iconCy - 22}" width="36" height="46" rx="5" fill="none" stroke="${FV_GOLD}" stroke-width="2.2" />
  <line x1="${iconCx - 10}" y1="${iconCy - 9}" x2="${iconCx + 10}" y2="${iconCy - 9}" stroke="${FV_GOLD}" stroke-width="1.8" />
  <line x1="${iconCx - 10}" y1="${iconCy}" x2="${iconCx + 10}" y2="${iconCy}" stroke="${FV_GOLD}" stroke-width="1.8" />
  <circle cx="${iconCx + 5}" cy="${iconCy + 14}" r="8" fill="none" stroke="${FV_GOLD}" stroke-width="1.8" />
  <line x1="${iconCx + 11}" y1="${iconCy + 20}" x2="${iconCx + 17}" y2="${iconCy + 26}" stroke="${FV_GOLD}" stroke-width="1.8" stroke-linecap="round" />`;

  // Target/goal icon (gold, centered at callout left)
  const tgtCx = PL + 24;
  const tgtCy = calloutY + Math.round(calloutH / 2);
  const tgtIcon = `
  <circle cx="${tgtCx}" cy="${tgtCy}" r="20" fill="none" stroke="${FV_GOLD}" stroke-width="2" />
  <circle cx="${tgtCx}" cy="${tgtCy}" r="12" fill="none" stroke="${FV_GOLD}" stroke-width="2" />
  <circle cx="${tgtCx}" cy="${tgtCy}" r="4" fill="${FV_GOLD}" />
  <line x1="${tgtCx + 12}" y1="${tgtCy - 12}" x2="${tgtCx + 22}" y2="${tgtCy - 22}" stroke="${FV_GOLD}" stroke-width="2" stroke-linecap="round" />
  <path d="M${tgtCx + 17},${tgtCy - 25} L${tgtCx + 24},${tgtCy - 22} L${tgtCx + 21},${tgtCy - 15}" fill="none" stroke="${FV_GOLD}" stroke-width="2" stroke-linejoin="round" />`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <clipPath id="${avClip}"><circle cx="74" cy="${avCy}" r="44" /></clipPath>
    <clipPath id="${imgClip}"><rect x="${PL}" y="${imgTopY}" width="${CW}" height="${imgH}" rx="${imgRx}" /></clipPath>
  </defs>

  <rect width="1080" height="1350" fill="#ffffff" />

  <!-- Compact profile header -->
  <circle cx="74" cy="${avCy}" r="44" fill="#e5e7eb" />
  <text x="74" y="${avCy + 12}" text-anchor="middle" fill="${FV_DARK}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileInitials || "FV")}</text>
  <image href="${escapeXml(avatarUrl || "")}" x="30" y="${avCy - 44}" width="88" height="88" preserveAspectRatio="xMidYMid slice" clip-path="url(#${avClip})" />
  <circle cx="74" cy="${avCy}" r="44" fill="none" stroke="#e5e7eb" stroke-width="1.5" />
  <text x="138" y="${avCy - 8}" fill="${FV_DARK}" font-size="32" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileName || FLAVIO_PROFILE_NAME)}</text>
  <circle cx="566" cy="${avCy - 20}" r="11" fill="#1d9bf0" />
  <path d="M560 ${avCy - 19.5}L565.5 ${avCy - 14}L575 ${avCy - 25}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  <text x="138" y="${avCy + 20}" fill="${FV_GRAY}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(input.profileHandle || FLAVIO_PROFILE_HANDLE)}</text>
  <text x="${PL + CW}" y="${avCy - 8}" text-anchor="end" fill="${FV_GRAY}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="400">${input.index + 1}/${input.total}</text>

  <!-- Separator -->
  <line x1="${PL}" y1="${sepY}" x2="${PL + CW}" y2="${sepY}" stroke="#e5e7eb" stroke-width="1.5" />

  <g class="editor-title-layer">
    <!-- Title (two-tone, left-aligned) -->
    ${flavioTitleSvg(titleLines, tfs, tlh, titleX, titleBaseY, "start")}

    <!-- Gold underline (left-aligned, short) -->
    <rect x="${PL}" y="${ulY}" width="72" height="4" rx="2" fill="${FV_GOLD}" />
  </g>

  <g class="editor-body-layer">
    <!-- Document icon -->
    ${docIcon}

    <!-- Paragraph 1 (to the right of icon) -->
    ${para1Lines.map((l, i) => `<text x="${para1X}" y="${para1Y + i * blh}" fill="${FV_DARK}" font-size="${bfs}" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(l)}</text>`).join("\n  ")}

    <!-- Quote block -->
    <rect x="${PL}" y="${quoteTopY}" width="${CW}" height="${quoteH}" rx="8" fill="#f8f8f8" />
    <rect x="${PL}" y="${quoteTopY}" width="4" height="${quoteH}" rx="2" fill="${FV_GOLD}" />
    <text x="${PL + 20}" y="${quoteTopY + 28}" fill="${FV_GOLD}" font-size="36" font-family="Georgia, serif" font-weight="700">&#8220;</text>
    ${quoteLines.map((l, i) => {
      // Bold emphasis: first word of first line is bold
      if (i === 0) {
        const sp = l.indexOf(" ");
        if (sp === -1) return `<text x="${PL + 54}" y="${quoteTopY + quotePad + Math.round(bfs * 0.82) + i * blh}" fill="${FV_DARK}" font-size="${bfs}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(l)}</text>`;
        const bold = l.slice(0, sp);
        const rest = l.slice(sp);
        return `<text x="${PL + 54}" y="${quoteTopY + quotePad + Math.round(bfs * 0.82) + i * blh}" fill="${FV_DARK}" font-size="${bfs}" font-family="Arial, Helvetica, sans-serif"><tspan font-weight="700">${escapeXml(bold)}</tspan><tspan font-weight="400">${escapeXml(rest)}</tspan></text>`;
      }
      return `<text x="${PL + 54}" y="${quoteTopY + quotePad + Math.round(bfs * 0.82) + i * blh}" fill="${FV_DARK}" font-size="${bfs}" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(l)}</text>`;
    }).join("\n  ")}

    <!-- Target callout row -->
    ${tgtIcon}
    <line x1="${tgtCx + 26}" y1="${calloutY + 8}" x2="${tgtCx + 26}" y2="${calloutY + calloutH - 8}" stroke="#e5e7eb" stroke-width="1.5" />
    ${calloutLines.map((l, i) => {
      if (i === 0) {
        const sp = l.indexOf(" ");
        if (sp === -1) return `<text x="${tgtCx + 38}" y="${calloutY + Math.round(calloutH / 2) - (calloutLines.length > 1 ? 10 : 0) + Math.round(bfs * 0.5)}" fill="${FV_GOLD}" font-size="${bfs}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(l)}</text>`;
        const bold = l.slice(0, sp);
        const rest = l.slice(sp);
        const cy = calloutY + Math.round(calloutH / 2) - (calloutLines.length > 1 ? 14 : 0) + Math.round(bfs * 0.5);
        return `<text x="${tgtCx + 38}" y="${cy}" fill="${FV_DARK}" font-size="${bfs}" font-family="Arial, Helvetica, sans-serif"><tspan fill="${FV_GOLD}" font-weight="700">${escapeXml(bold)}</tspan><tspan font-weight="400"> ${escapeXml(rest.trim())}</tspan></text>`;
      }
      return `<text x="${tgtCx + 38}" y="${calloutY + Math.round(calloutH / 2) + 20 + Math.round(bfs * 0.5)}" fill="${FV_DARK}" font-size="${bfs}" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(l)}</text>`;
    }).join("\n  ")}
  </g>

  <!-- Blue rounded image block -->
  <rect x="${PL}" y="${imgTopY}" width="${CW}" height="${imgH}" rx="${imgRx}" fill="${FV_BLUE}" />
  <g clip-path="url(#${imgClip})">
    ${imgMarkup.replace("<image ", "<image class=\"editor-image\" ")}
  </g>
</svg>`.trim();
}

// ── CTA (último slide) ───────────────────────────────────────────────────────
function buildFlavioCTASlideSvg(input: SlideRenderInput): string {
  const id = hashString(`${input.topic}-fcta-${input.index}`);
  const avClip = `fctaAv-${id}`;
  const avatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || FLAVIO_PROFILE_AVATAR_URL);

  // Profile
  const avR = 58, avCx = 112, avCy = 248;
  const nameY = avCy + avR + 56;  // baseline of name
  const handleY = nameY + 36;

  // Separator with gold center
  const sepY = handleY + 36;

  // Large title (two-tone, left-aligned)
  const rawCta = (input.finalCta || "Não deixe esse conteúdo se perder.").replace(/\s+/g, " ").trim();
  const sentences = rawCta.split(/(?<=[.!?])\s+/);
  const bigTitleRaw = sentences[0] || rawCta;
  const subtitleRaw = sentences.slice(1).join(" ") || "Salve agora e volte quando precisar aplicar.";

  const ctaTitleLines = wrapTextLines(bigTitleRaw, 13, 4);
  const ctaFs = ctaTitleLines.length >= 4 ? 82 : ctaTitleLines.length >= 3 ? 92 : ctaTitleLines.length === 2 ? 100 : 108;
  const ctaLh = Math.round(ctaFs * 1.18);
  const ctaTitleBlockH = (ctaTitleLines.length - 1) * ctaLh + ctaFs;

  const titleStartY = sepY + 60;
  const titleBaseY = titleStartY + Math.round(ctaFs * 0.78);
  const titleBotY = titleStartY + ctaTitleBlockH;

  // Subtitle
  const subLines = wrapTextLines(subtitleRaw, 30, 2);
  const subFs = 40, subLh = 52;
  const subY = titleBotY + 36 + Math.round(subFs * 0.78);
  const subBotY = subY + (subLines.length - 1) * subLh + subFs * 0.22;

  // 4 icons
  const iconTopY = Math.round(subBotY) + 64;
  const iconCy = iconTopY + 52;
  const iconR = 50;
  const cols = [136, 406, 676, 946];
  const sepX = [271, 541, 811];

  // Icon outlines (gold, stroke-only) and separators
  const iconData = [
    {
      label: "CURTA",
      desc1: "Se este conteúdo",
      desc2: "fez sentido para você.",
      icon: `<path d="M${cols[0]},${iconCy + 16} C${cols[0] - 26},${iconCy - 2} ${cols[0] - 26},${iconCy - 22} ${cols[0]},${iconCy - 10} C${cols[0] + 26},${iconCy - 22} ${cols[0] + 26},${iconCy - 2} ${cols[0]},${iconCy + 16}Z" fill="none" stroke="${FV_GOLD}" stroke-width="2.8" />`
    },
    {
      label: "COMENTE",
      desc1: "Compartilhe sua",
      desc2: "opinião ou dúvida.",
      icon: `<rect x="${cols[1] - 26}" y="${iconCy - 18}" width="52" height="36" rx="8" fill="none" stroke="${FV_GOLD}" stroke-width="2.8" /><path d="M${cols[1] - 10},${iconCy + 18} L${cols[1]},${iconCy + 30} L${cols[1] + 10},${iconCy + 18}" fill="none" stroke="${FV_GOLD}" stroke-width="2.8" stroke-linejoin="round" />`
    },
    {
      label: "COMPARTILHE",
      desc1: "Envie para alguém",
      desc2: "que precisa ver isso.",
      icon: `<path d="M${cols[2] - 24},${iconCy + 16} L${cols[2] + 24},${iconCy - 16} M${cols[2] + 10},${iconCy - 16} L${cols[2] + 24},${iconCy - 16} L${cols[2] + 24},${iconCy - 2}" fill="none" stroke="${FV_GOLD}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />`
    },
    {
      label: "SALVE",
      desc1: "Guarde para revisar",
      desc2: "e aplicar depois.",
      icon: `<path d="M${cols[3] - 18},${iconCy - 22} L${cols[3] + 18},${iconCy - 22} L${cols[3] + 18},${iconCy + 22} L${cols[3]},${iconCy + 10} L${cols[3] - 18},${iconCy + 22}Z" fill="none" stroke="${FV_GOLD}" stroke-width="2.8" stroke-linejoin="round" />`
    },
  ];

  const labelY = iconCy + iconR + 32;
  const desc1Y = labelY + 32;
  const desc2Y = desc1Y + 28;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <clipPath id="${avClip}"><circle cx="${avCx}" cy="${avCy}" r="${avR}" /></clipPath>
  </defs>

  <rect width="1080" height="1350" fill="#ffffff" />

  <!-- Profile -->
  <circle cx="${avCx}" cy="${avCy}" r="${avR}" fill="#e5e7eb" />
  <text x="${avCx}" y="${avCy + 14}" text-anchor="middle" fill="${FV_DARK}" font-size="32" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileInitials || "FV")}</text>
  <image href="${escapeXml(avatarUrl || "")}" x="${avCx - avR}" y="${avCy - avR}" width="${avR * 2}" height="${avR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${avClip})" />
  <circle cx="${avCx}" cy="${avCy}" r="${avR}" fill="none" stroke="#e5e7eb" stroke-width="2" />
  <text x="${avCx + avR + 28}" y="${nameY}" fill="${FV_DARK}" font-size="38" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeXml(input.profileName || FLAVIO_PROFILE_NAME)}</text>
  <circle cx="${avCx + avR + 28 + Math.min((input.profileName || FLAVIO_PROFILE_NAME).length * 22, 420) + 16}" cy="${nameY - 13}" r="13" fill="#1d9bf0" />
  <text x="${avCx + avR + 28}" y="${handleY}" fill="${FV_GRAY}" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(input.profileHandle || FLAVIO_PROFILE_HANDLE)}</text>

  <!-- Separator with gold center -->
  <line x1="80" y1="${sepY}" x2="420" y2="${sepY}" stroke="#e5e7eb" stroke-width="1.5" />
  <rect x="420" y="${sepY - 2}" width="160" height="5" rx="2.5" fill="${FV_GOLD}" />
  <line x1="580" y1="${sepY}" x2="1000" y2="${sepY}" stroke="#e5e7eb" stroke-width="1.5" />

  <g class="editor-title-layer">
    <!-- Large title (two-tone, left-aligned) -->
    ${flavioTitleSvg(ctaTitleLines, ctaFs, ctaLh, 80, titleBaseY, "start")}
  </g>

  <g class="editor-body-layer">
    <!-- Subtitle -->
    ${subLines.map((l, i) => `<text x="80" y="${subY + i * subLh}" fill="${FV_GRAY}" font-size="${subFs}" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(l)}</text>`).join("\n  ")}
  </g>

  <!-- Column separators -->
  ${sepX.map(sx => `<line x1="${sx}" y1="${iconTopY}" x2="${sx}" y2="${desc2Y + 8}" stroke="#e5e7eb" stroke-width="1.5" />`).join("\n  ")}

  <!-- Icons + labels + descriptions -->
  ${iconData.map((ic, i) => `
  ${ic.icon}
  <text x="${cols[i]}" y="${labelY}" text-anchor="middle" fill="${FV_DARK}" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="700">${ic.label}</text>
  <text x="${cols[i]}" y="${desc1Y}" text-anchor="middle" fill="${FV_GRAY}" font-size="20" font-family="Arial, Helvetica, sans-serif" font-weight="400">${ic.desc1}</text>
  <text x="${cols[i]}" y="${desc2Y}" text-anchor="middle" fill="${FV_GRAY}" font-size="20" font-family="Arial, Helvetica, sans-serif" font-weight="400">${ic.desc2}</text>`).join("\n  ")}
</svg>`.trim();
}

function buildKrythosHookSlideSvg(input: SlideRenderInput): string {
  const id = hashString(`kr-hook-${input.topic}-${input.index}`);
  const CYAN = "#29d9ff";
  const TF = "Arial Black, Impact, Arial, Helvetica, sans-serif";
  const UF = "Arial, Helvetica, sans-serif";

  const imageUrl = toAbsoluteClientAssetUrl(input.slide.imageUrl || input.coverImageUrl);
  const avatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || KRYTHOS_PROFILE_AVATAR_URL);
  const handle = input.profileHandle || "@krythoslab";
  const initials = input.profileInitials || "K";

  const raw = (input.hook || input.slide.title).toUpperCase().replace(/\s+/g, " ").trim();
  const lines = wrapTextLines(raw, 14, 4);
  const FS = lines.length >= 4 ? 82 : lines.length >= 3 ? 90 : lines.length >= 2 ? 100 : 112;
  const LH = Math.round(FS * 1.18);
  const accentFrom = lines.length <= 1 ? 0 : Math.ceil(lines.length * 0.62);

  const PH = 76, PR = 28;
  const PW = PR * 2 + 20 + handle.length * 21 + 30;
  const PX = 40, PCY = 470;
  const ACX = PX + PR + 10, HX = ACX + PR + 16;

  const titleY0 = PCY + PH / 2 + 50 + FS * 0.82;
  const titleEndY = titleY0 + (lines.length - 1) * LH;

  const titleMarkup = lines
    .map((ln, i) => {
      const acc = i >= accentFrom;
      const tl = ln.length * FS * 0.66 > 960 ? ` textLength="960" lengthAdjust="spacingAndGlyphs"` : "";
      return `<text x="40" y="${titleY0 + i * LH}" fill="${acc ? CYAN : "#fff"}" font-size="${FS}" font-family="${TF}" font-weight="900"${tl}>${escapeXml(ln)}</text>`;
    })
    .join("\n  ");

  const firstSentence = (input.slide.body || "").split(/[.!?]/)[0].trim();
  const subtitleLines = firstSentence ? wrapTextLines(firstSentence.toUpperCase(), 46, 2) : [];
  const SUBTITLE_LH = 36;
  const subtitleY = titleEndY + 62;
  const subtitleMarkup = subtitleLines
    .map((ln, i) => `<text x="40" y="${subtitleY + i * SUBTITLE_LH}" fill="rgba(255,255,255,0.50)" font-size="24" font-family="${UF}" font-weight="400" letter-spacing="1">${escapeXml(i === 0 ? `– ${ln}` : ln)}</text>`)
    .join("\n  ");
  const subtitleBlockH = subtitleLines.length * SUBTITLE_LH;
  const swipeY = Math.max(subtitleY + (subtitleLines.length ? subtitleBlockH + 46 : 36), 1205);

  const imgMk = imageUrl
    ? `<image class="editor-image" href="${escapeXml(imageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="1080" height="1350" fill="url(#krFb-${id})"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="krOv-${id}" x1="0" y1="0" x2="0" y2="1350" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#000" stop-opacity="0.25"/>
      <stop offset="35%" stop-color="#000" stop-opacity="0.58"/>
      <stop offset="65%" stop-color="#000" stop-opacity="0.84"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.97"/>
    </linearGradient>
    <linearGradient id="krFb-${id}" x1="0" y1="0" x2="0" y2="1350" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0d1117"/><stop offset="1" stop-color="#0a1628"/>
    </linearGradient>
    <clipPath id="krAv-${id}"><circle cx="${ACX}" cy="${PCY}" r="${PR}"/></clipPath>
  </defs>
  ${imgMk}
  <rect width="1080" height="1350" fill="url(#krOv-${id})"/>
  <rect x="0" y="0" width="280" height="5" fill="${CYAN}"/>
  <text x="40" y="68" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="2"><tspan fill="rgba(255,255,255,0.75)">SUA AGÊNCIA DE MARKETING </tspan><tspan fill="${CYAN}">POR IA</tspan></text>
  <text x="1040" y="68" text-anchor="end" fill="rgba(255,255,255,0.75)" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="2">@KRYTHOSLAB</text>
  <rect x="${PX}" y="${PCY - PH / 2}" width="${PW}" height="${PH}" rx="${PH / 2}" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
  <circle cx="${ACX}" cy="${PCY}" r="${PR}" fill="#141c2e"/>
  <text x="${ACX}" y="${PCY + 10}" text-anchor="middle" fill="#fff" font-size="22" font-family="${TF}" font-weight="900">${escapeXml(initials)}</text>
  <image href="${escapeXml(avatarUrl || "")}" x="${ACX - PR}" y="${PCY - PR}" width="${PR * 2}" height="${PR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#krAv-${id})"/>
  <text x="${HX}" y="${PCY + 12}" fill="#fff" font-size="34" font-family="${UF}" font-weight="600">${escapeXml(handle)}</text>
  <g class="editor-title-layer">
    ${titleMarkup}
  </g>
  <g class="editor-body-layer">
    ${subtitleMarkup}
  </g>
  <circle cx="82" cy="${swipeY}" r="42" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
  <text x="82" y="${swipeY + 15}" text-anchor="middle" fill="rgba(255,255,255,0.60)" font-size="42" font-family="${UF}" font-weight="300">›</text>
  <text x="144" y="${swipeY - 8}" fill="#fff" font-size="25" font-family="${UF}" font-weight="700" letter-spacing="1">ARRASTE PARA O LADO</text>
  <text x="144" y="${swipeY + 22}" fill="rgba(255,255,255,0.45)" font-size="21" font-family="${UF}" font-weight="400" letter-spacing="1">E CONFIRA O CONTEÚDO</text>
  <rect x="40" y="1318" width="1000" height="1.5" fill="rgba(255,255,255,0.15)"/>
</svg>`;
}

function buildKrythosContentSlideSvg(input: SlideRenderInput): string {
  const id = hashString(`kr-content-${input.topic}-${input.index}`);
  const CYAN = "#29d9ff";
  const TF = "Arial Black, Impact, Arial, Helvetica, sans-serif";
  const UF = "Arial, Helvetica, sans-serif";

  const avatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || KRYTHOS_PROFILE_AVATAR_URL);
  const handle = input.profileHandle || "@krythoslab";
  const initials = input.profileInitials || "K";

  const raw = input.slide.title.toUpperCase().replace(/\s+/g, " ").trim();
  const lines = wrapTextLines(raw, 16, 3);
  const FS = lines.length >= 3 ? 88 : lines.length >= 2 ? 100 : 112;
  const LH = Math.round(FS * 1.18);
  const accentFrom = lines.length <= 1 ? 0 : Math.ceil(lines.length * 0.62);

  const titleY0 = 220 + FS * 0.82;
  const titleEndY = titleY0 + (lines.length - 1) * LH;

  const titleMarkup = lines
    .map((ln, i) => {
      const acc = i >= accentFrom;
      const tl = ln.length * FS * 0.66 > 960 ? ` textLength="960" lengthAdjust="spacingAndGlyphs"` : "";
      return `<text x="40" y="${titleY0 + i * LH}" fill="${acc ? CYAN : "#fff"}" font-size="${FS}" font-family="${TF}" font-weight="900"${tl}>${escapeXml(ln)}</text>`;
    })
    .join("\n  ");

  const accentY = titleEndY + 38;

  const bodyLines = wrapTextLines(input.slide.body || "", 44, 8);
  const BS = 34, BH = 54;
  const bodyY0 = accentY + 56 + BS * 0.82;
  const bodyMarkup = bodyLines
    .map((ln, i) => `<text x="60" y="${bodyY0 + i * BH}" fill="rgba(255,255,255,0.85)" font-size="${BS}" font-family="${UF}" font-weight="400">${escapeXml(ln)}</text>`)
    .join("\n  ");

  const PH = 66, PR = 24;
  const PW = PR * 2 + 18 + handle.length * 18 + 26;
  const PX = 40, PCY = 1266;
  const ACX = PX + PR + 10, HX = ACX + PR + 14;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <clipPath id="krAv-${id}"><circle cx="${ACX}" cy="${PCY}" r="${PR}"/></clipPath>
  </defs>
  <rect width="1080" height="1350" fill="#0d1117"/>
  <rect x="0" y="0" width="280" height="5" fill="${CYAN}"/>
  <text x="40" y="68" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="2"><tspan fill="rgba(255,255,255,0.75)">AGÊNCIA DE MARKETING </tspan><tspan fill="${CYAN}">POR IA</tspan></text>
  <text x="1040" y="68" text-anchor="end" fill="rgba(255,255,255,0.75)" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="2">@KRYTHOSLAB</text>
  <g class="editor-title-layer">
    ${titleMarkup}
    <rect x="40" y="${accentY}" width="80" height="4" fill="${CYAN}" rx="2"/>
  </g>
  <g class="editor-body-layer">
    ${bodyMarkup}
  </g>
  <rect x="${PX}" y="${PCY - PH / 2}" width="${PW}" height="${PH}" rx="${PH / 2}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>
  <circle cx="${ACX}" cy="${PCY}" r="${PR}" fill="#141c2e"/>
  <text x="${ACX}" y="${PCY + 9}" text-anchor="middle" fill="#fff" font-size="19" font-family="${TF}" font-weight="900">${escapeXml(initials)}</text>
  <image href="${escapeXml(avatarUrl || "")}" x="${ACX - PR}" y="${PCY - PR}" width="${PR * 2}" height="${PR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#krAv-${id})"/>
  <text x="${HX}" y="${PCY + 11}" fill="#fff" font-size="28" font-family="${UF}" font-weight="600">${escapeXml(handle)}</text>
  <g transform="translate(882,${PCY})">
    <path d="M-10,-22 L10,-22 L10,18 L0,8 L-10,18Z" fill="none" stroke="${CYAN}" stroke-width="2.5" stroke-linejoin="round"/>
  </g>
  <text x="1038" y="${PCY - 7}" text-anchor="end" fill="${CYAN}" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="0.5">SALVE ESTE CONTEÚDO</text>
  <text x="1038" y="${PCY + 18}" text-anchor="end" fill="rgba(255,255,255,0.45)" font-size="19" font-family="${UF}" font-weight="400">E VOLTE QUANDO PRECISAR</text>
</svg>`;
}

function buildKrythosCTASlideSvg(input: SlideRenderInput): string {
  const id = hashString(`kr-cta-${input.topic}-${input.index}`);
  const CYAN = "#29d9ff";
  const TF = "Arial Black, Impact, Arial, Helvetica, sans-serif";
  const UF = "Arial, Helvetica, sans-serif";

  const avatarUrl = toAbsoluteClientAssetUrl(input.profileAvatarUrl || KRYTHOS_PROFILE_AVATAR_URL);
  const handle = input.profileHandle || "@krythoslab";
  const initials = input.profileInitials || "K";

  const raw = (input.finalCta || input.slide.title).toUpperCase().replace(/\s+/g, " ").trim();
  const lines = wrapTextLines(raw, 14, 3);
  const FS = lines.length >= 3 ? 88 : lines.length >= 2 ? 96 : 108;
  const LH = Math.round(FS * 1.18);
  const accentFrom = lines.length <= 1 ? 0 : Math.ceil(lines.length * 0.62);

  const PH = 76, PR = 28;
  const PW = PR * 2 + 20 + handle.length * 21 + 30;
  const PX = 40, PCY = 155;
  const ACX = PX + PR + 10, HX = ACX + PR + 16;

  const titleY0 = 230 + FS * 0.82;
  const titleEndY = titleY0 + (lines.length - 1) * LH;

  const titleMarkup = lines
    .map((ln, i) => {
      const acc = i >= accentFrom;
      const tl = ln.length * FS * 0.66 > 960 ? ` textLength="960" lengthAdjust="spacingAndGlyphs"` : "";
      return `<text x="40" y="${titleY0 + i * LH}" fill="${acc ? CYAN : "#fff"}" font-size="${FS}" font-family="${TF}" font-weight="900"${tl}>${escapeXml(ln)}</text>`;
    })
    .join("\n  ");

  const accentY = titleEndY + 40;
  const bodyLines = wrapTextLines(input.slide.body || "", 42, 4);
  const BS = 30, BH = 48;
  const bodyY0 = accentY + 54 + BS * 0.82;
  const bodyMarkup = bodyLines
    .map((ln, i) => `<text x="40" y="${bodyY0 + i * BH}" fill="rgba(255,255,255,0.80)" font-size="${BS}" font-family="${UF}" font-weight="400">${escapeXml(ln)}</text>`)
    .join("\n  ");

  const bodyEndY = bodyY0 + (bodyLines.length - 1) * BH + BS;
  const sepY = bodyEndY + 48;
  const icCY = Math.max(sepY + 98, 840);

  const iconData = [
    { path: "M0,-14 C0,-22 -8,-26 -15,-20 C-22,-14 -22,-6 -15,-1 L0,14 L15,-1 C22,-6 22,-14 15,-20 C8,-26 0,-22 0,-14Z", label: "CURTA", desc1: "Mostre que este conteúdo", desc2: "foi útil para você." },
    { path: "M-18,-18 C-18,-26 -12,-30 -5,-30 L5,-30 C12,-30 18,-26 18,-18 L18,-8 C18,-2 12,2 5,2 L-1,2 L-10,14 L-10,2 C-15,2 -18,-2 -18,-8Z", label: "COMENTE", desc1: "Compartilhe sua opinião", desc2: "sobre o conteúdo." },
    { path: "M-20,-20 L20,0 L-20,20 L-10,2 L-20,-20Z", label: "COMPARTILHE", desc1: "Envie para alguém que", desc2: "também precisa ver isso." },
    { path: "M-12,-22 L12,-22 L12,20 L0,10 L-12,20Z", label: "SALVE", desc1: "Guarde para consultar", desc2: "quando precisar." },
  ];
  const cols = [135, 405, 675, 945];

  const iconMarkup = cols
    .map((cx, i) => {
      const { path, label, desc1, desc2 } = iconData[i];
      const labelY = icCY + 62;
      const d1Y = labelY + 32, d2Y = d1Y + 28;
      const sep = i < 3 ? `<line x1="${cx + 135}" y1="${icCY - 60}" x2="${cx + 135}" y2="${d2Y + 8}" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>` : "";
      return `<circle cx="${cx}" cy="${icCY}" r="46" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
  <path d="${path}" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2.5" stroke-linejoin="round" transform="translate(${cx},${icCY})"/>
  <text x="${cx}" y="${labelY}" text-anchor="middle" fill="#fff" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="1">${label}</text>
  <text x="${cx}" y="${d1Y}" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="18" font-family="${UF}">${escapeXml(desc1)}</text>
  <text x="${cx}" y="${d2Y}" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="18" font-family="${UF}">${escapeXml(desc2)}</text>
  ${sep}`;
    })
    .join("\n  ");

  const icEndY = icCY + 62 + 32 + 28 + 8;
  const boxY = Math.max(icEndY + 30, 1068);
  const boxH = 132;
  const boxCY = Math.round(boxY + boxH / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <defs>
    <clipPath id="krAv-${id}"><circle cx="${ACX}" cy="${PCY}" r="${PR}"/></clipPath>
  </defs>
  <rect width="1080" height="1350" fill="#0d1117"/>
  <rect x="0" y="0" width="280" height="5" fill="${CYAN}"/>
  <text x="40" y="68" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="2"><tspan fill="rgba(255,255,255,0.75)">AGÊNCIA DE MARKETING </tspan><tspan fill="${CYAN}">POR IA</tspan></text>
  <text x="1040" y="68" text-anchor="end" fill="rgba(255,255,255,0.75)" font-size="22" font-family="${UF}" font-weight="700" letter-spacing="2">@KRYTHOSLAB</text>
  <rect x="${PX}" y="${PCY - PH / 2}" width="${PW}" height="${PH}" rx="${PH / 2}" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
  <circle cx="${ACX}" cy="${PCY}" r="${PR}" fill="#141c2e"/>
  <text x="${ACX}" y="${PCY + 10}" text-anchor="middle" fill="#fff" font-size="22" font-family="${TF}" font-weight="900">${escapeXml(initials)}</text>
  <image href="${escapeXml(avatarUrl || "")}" x="${ACX - PR}" y="${PCY - PR}" width="${PR * 2}" height="${PR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#krAv-${id})"/>
  <text x="${HX}" y="${PCY + 12}" fill="#fff" font-size="34" font-family="${UF}" font-weight="600">${escapeXml(handle)}</text>
  <g class="editor-title-layer">
    ${titleMarkup}
    <rect x="40" y="${accentY}" width="80" height="4" fill="${CYAN}" rx="2"/>
  </g>
  <g class="editor-body-layer">
    ${bodyMarkup}
  </g>
  <rect x="40" y="${sepY}" width="1000" height="1.5" fill="rgba(255,255,255,0.12)"/>
  ${iconMarkup}
  <rect x="40" y="${boxY}" width="1000" height="${boxH}" rx="12" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
  <circle cx="118" cy="${boxCY}" r="44" fill="#3b5bdb"/>
  <path d="M106,${boxCY - 22} L130,${boxCY - 22} L130,${boxCY + 20} L118,${boxCY + 10} L106,${boxCY + 20}Z" fill="rgba(255,255,255,0.92)"/>
  <text x="178" y="${boxCY - 8}" fill="#fff" font-size="24" font-family="${UF}" font-weight="700" letter-spacing="0.5">NÃO DEIXE ESSE CONTEÚDO SE PERDER.</text>
  <text x="178" y="${boxCY + 20}" fill="rgba(255,255,255,0.60)" font-size="19" font-family="${UF}" font-weight="400">Salve agora e volte quando precisar.</text>
  <g transform="translate(1018,${boxCY})">
    <path d="M-16,-14 Q8,-14 8,6" fill="none" stroke="${CYAN}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M1,0 L8,14 L16,2" fill="none" stroke="${CYAN}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <rect x="40" y="1318" width="1000" height="1.5" fill="rgba(255,255,255,0.15)"/>
</svg>`;
}

// ── ALLE ENERGIA ─────────────────────────────────────────────────────────────

function buildClaudeMinimalFooter(input: SlideRenderInput, actionLabel?: string) {
  const theme = getMinimalCarouselTheme(input.profileId);
  const leftLabel = escapeXml(clampSentence(input.profileName || theme.profileName, 18));
  const rightLabel = escapeXml(actionLabel || (input.index === input.total - 1 ? "salve ->" : "arraste ->"));
  const dotCount = Math.max(3, Math.min(input.total, 7));
  const dotStartX = 540 - ((dotCount - 1) * 22) / 2;
  const activeIndex = dotCount === input.total
    ? input.index
    : Math.round((input.index / Math.max(1, input.total - 1)) * (dotCount - 1));

  return `
  <text x="84" y="1248" fill="${theme.text}" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700">${leftLabel}</text>
  ${Array.from({ length: dotCount }, (_, index) => {
    const cx = dotStartX + index * 22;
    const fill = index === activeIndex ? theme.text : theme.stroke;
    return `<circle cx="${cx}" cy="1240" r="3.5" fill="${fill}" />`;
  }).join("\n  ")}
  <text x="994" y="1248" text-anchor="end" fill="${theme.muted}" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700">${rightLabel}</text>`;
}

function buildClaudeMinimalHeader(input: SlideRenderInput) {
  const theme = getMinimalCarouselTheme(input.profileId);
  const handle = escapeXml(input.profileHandle || theme.profileHandle);

  return `
  <rect x="24" y="24" width="1032" height="1302" rx="34" fill="none" stroke="${theme.stroke}" stroke-width="2" />
  <rect x="42" y="42" width="54" height="34" rx="10" fill="${theme.panel}" stroke="${theme.stroke}" />
  <text x="69" y="64" text-anchor="middle" fill="${theme.text}" font-size="16" font-family="Arial, Helvetica, sans-serif" font-weight="700">#${input.index + 1}</text>
  <text x="108" y="108" fill="${theme.text}" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700">${handle}</text>
  <text x="972" y="108" text-anchor="end" fill="${theme.text}" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700">Carrosseis com IA</text>`;
}

function buildClaudeMinimalImageBlock(input: {
  id: string;
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  theme: MinimalCarouselTheme;
}) {
  const clipId = `cmClip-${input.id}`;
  const imageUrl = toAbsoluteClientAssetUrl(input.imageUrl);

  return `
  <defs>
    <clipPath id="${clipId}">
      <rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${input.radius}" />
    </clipPath>
  </defs>
  <g class="editor-image-layer">
    <rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" rx="${input.radius}" fill="${input.theme.panel}" stroke="${input.theme.stroke}" />
    ${
      imageUrl
        ? `
    <g clip-path="url(#${clipId})">
      <image class="editor-image" href="${escapeXml(imageUrl)}" x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" preserveAspectRatio="xMidYMid slice" />
      <rect x="${input.x}" y="${input.y}" width="${input.width}" height="${input.height}" fill="rgba(0,0,0,0.12)" />
    </g>`
        : `
    <rect x="${input.x + 28}" y="${input.y + 28}" width="${input.width - 56}" height="${input.height - 56}" rx="${Math.max(18, input.radius - 10)}" fill="${input.theme.placeholderFill}" />
    <circle cx="${input.x + input.width - 86}" cy="${input.y + 74}" r="7" fill="${input.theme.accent}" opacity="0.9" />
    <circle cx="${input.x + input.width - 58}" cy="${input.y + 74}" r="7" fill="${input.theme.stroke}" />
    <rect x="${input.x + 44}" y="${input.y + input.height - 94}" width="${input.width * 0.52}" height="14" rx="7" fill="${input.theme.stroke}" />
    <rect x="${input.x + 44}" y="${input.y + input.height - 62}" width="${input.width * 0.36}" height="14" rx="7" fill="${input.theme.stroke}" />`
    }
  </g>`;
}

function buildClaudeMinimalHookSlideSvg(input: SlideRenderInput): string {
  const theme = getMinimalCarouselTheme(input.profileId);
  const id = hashString(`cm-hook-${input.topic}-${input.index}`);
  const title = (input.hook || input.slide.title || input.topic).toUpperCase().replace(/\s+/g, " ").trim();
  const titleLines = wrapTextLines(title, 15, 4);
  const titleFontSize =
    titleLines.length >= 4 ? 70 : titleLines.length === 3 ? 80 : titleLines.length === 2 ? 92 : 102;
  const titleLineHeight = Math.round(titleFontSize * 0.96);
  const titleStartY = 690;
  const bodyLines = wrapTextLinesWithoutTruncation(input.slide.body || input.topic, 40);
  const bodyFontSize =
    bodyLines.length >= 8 ? 18 : bodyLines.length >= 6 ? 20 : bodyLines.length >= 4 ? 22 : 26;
  const bodyLineHeight = Math.round(bodyFontSize * 1.3);
  const bodyY = titleStartY + titleLines.length * titleLineHeight + 56;
  const imageBlock = buildClaudeMinimalImageBlock({
    id,
    imageUrl: input.slide.imageUrl || input.coverImageUrl,
    x: 222,
    y: 182,
    width: 636,
    height: 368,
    radius: 28,
    theme,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <rect width="1080" height="1350" fill="${theme.bg}"/>
  ${buildClaudeMinimalHeader(input)}
  ${imageBlock}
  <g class="editor-title-layer">
    <text x="540" y="${titleStartY}" text-anchor="middle" fill="${theme.text}" font-size="${titleFontSize}" font-family="Arial Black, Impact, Arial, Helvetica, sans-serif" font-weight="900">
      ${titleLines.map((line, index) => `<tspan x="540" dy="${index === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </g>
  <g class="editor-body-layer">
    <text x="540" y="${bodyY}" text-anchor="middle" fill="${theme.muted}" font-size="${bodyFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="500">
      ${bodyLines.map((line, index) => `<tspan x="540" dy="${index === 0 ? 0 : bodyLineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </g>
  ${buildClaudeMinimalFooter(input, "arraste ->")}
</svg>`;
}

function buildClaudeMinimalContentSlideSvg(input: SlideRenderInput): string {
  const theme = getMinimalCarouselTheme(input.profileId);
  const id = hashString(`cm-content-${input.topic}-${input.index}`);
  const title = (input.slide.title || input.topic).toUpperCase().replace(/\s+/g, " ").trim();
  const titleLines = wrapTextLines(title, 18, 3);
  const titleFontSize = titleLines.length >= 3 ? 66 : titleLines.length === 2 ? 76 : 86;
  const titleLineHeight = Math.round(titleFontSize * 0.96);
  const titleY = 214;
  const bodyLines = wrapTextLinesWithoutTruncation(input.slide.body || input.topic, 42);
  const bodyFontSize =
    bodyLines.length >= 9 ? 17 : bodyLines.length >= 7 ? 19 : bodyLines.length >= 5 ? 21 : 25;
  const bodyLineHeight = Math.round(bodyFontSize * 1.32);
  const bodyY = titleY + titleLines.length * titleLineHeight + 54;
  const kicker = escapeXml((input.slide.shortText || input.slide.highlightWords?.[0] || "IDEIA CENTRAL").toUpperCase());
  const imageBlock = buildClaudeMinimalImageBlock({
    id,
    imageUrl: input.slide.imageUrl || input.coverImageUrl,
    x: 172,
    y: 468,
    width: 736,
    height: 396,
    radius: 26,
    theme,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <rect width="1080" height="1350" fill="${theme.bg}"/>
  ${buildClaudeMinimalHeader(input)}
  <text x="540" y="156" text-anchor="middle" fill="${theme.accent}" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="2.8">${kicker}</text>
  <g class="editor-title-layer">
    <text x="540" y="${titleY}" text-anchor="middle" fill="${theme.text}" font-size="${titleFontSize}" font-family="Arial Black, Impact, Arial, Helvetica, sans-serif" font-weight="900">
      ${titleLines.map((line, index) => `<tspan x="540" dy="${index === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </g>
  <g class="editor-body-layer">
    <text x="540" y="${bodyY}" text-anchor="middle" fill="${theme.muted}" font-size="${bodyFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="500">
      ${bodyLines.map((line, index) => `<tspan x="540" dy="${index === 0 ? 0 : bodyLineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </g>
  ${imageBlock}
  ${buildClaudeMinimalFooter(input, "continue ->")}
</svg>`;
}

function buildClaudeMinimalCTASlideSvg(input: SlideRenderInput): string {
  const theme = getMinimalCarouselTheme(input.profileId);
  const title = (input.finalCta || input.slide.title || "SALVE E COMPARTILHE").toUpperCase().replace(/\s+/g, " ").trim();
  const titleLines = wrapTextLines(title, 17, 3);
  const titleFontSize = titleLines.length >= 3 ? 72 : titleLines.length === 2 ? 82 : 92;
  const titleLineHeight = Math.round(titleFontSize * 0.96);
  const titleY = 272;
  const bodyLines = wrapTextLinesWithoutTruncation(
    input.slide.body || "Salve este carrossel e envie para quem ainda esta criando no manual.",
    42
  );
  const bodyFontSize =
    bodyLines.length >= 8 ? 18 : bodyLines.length >= 6 ? 20 : bodyLines.length >= 5 ? 22 : 26;
  const bodyLineHeight = Math.round(bodyFontSize * 1.3);
  const bodyY = titleY + titleLines.length * titleLineHeight + 58;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  <rect width="1080" height="1350" fill="${theme.bg}"/>
  ${buildClaudeMinimalHeader(input)}
  <g class="editor-title-layer">
    <text x="540" y="${titleY}" text-anchor="middle" fill="${theme.text}" font-size="${titleFontSize}" font-family="Arial Black, Impact, Arial, Helvetica, sans-serif" font-weight="900">
      ${titleLines.map((line, index) => `<tspan x="540" dy="${index === 0 ? 0 : titleLineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </g>
  <g class="editor-body-layer">
    <text x="540" y="${bodyY}" text-anchor="middle" fill="${theme.muted}" font-size="${bodyFontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="500">
      ${bodyLines.map((line, index) => `<tspan x="540" dy="${index === 0 ? 0 : bodyLineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </g>
  <rect x="214" y="742" width="652" height="148" rx="28" fill="${theme.panel}" stroke="${theme.stroke}" />
  <text x="540" y="806" text-anchor="middle" fill="${theme.text}" font-size="26" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="1.1">SALVE ESTE CARROSSEL</text>
  <text x="540" y="850" text-anchor="middle" fill="${theme.muted}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="500">${theme.ctaSupportText}</text>
  <rect x="326" y="958" width="428" height="68" rx="22" fill="none" stroke="${theme.accent}" />
  <text x="540" y="1002" text-anchor="middle" fill="${theme.text}" font-size="24" font-family="Arial, Helvetica, sans-serif" font-weight="700">COMENTAR  |  SALVAR  |  ENVIAR</text>
  ${buildClaudeMinimalFooter(input, "salve ->")}
</svg>`;
}

function alleLogo(x: number, y: number, boltFill: string, textFill: string): string {
  return `<g transform="translate(${x},${y})">
    <path d="M18,0 L4,34 L15,34 L1,64 L34,24 L22,24 Z" fill="${boltFill}"/>
    <text x="50" y="48" fill="${textFill}" font-size="38" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="-0.5">alle energia</text>
  </g>`;
}

function alleLaranjaBg(): string {
  return `<rect width="1080" height="1350" fill="${ALLE_ORANGE_BG}"/>
  <polygon points="720,0 1080,0 1080,740 860,880 640,500" fill="${ALLE_SHAPE_DARK_ORANGE}" opacity="0.45"/>
  <polygon points="840,0 1080,0 1080,500 960,580 800,240" fill="${ALLE_SHAPE_LIGHT_ORANGE}" opacity="0.50"/>`;
}

function alleRoxoBg(): string {
  return `<rect width="1080" height="1350" fill="${ALLE_PURPLE_BG}"/>
  <polygon points="680,80 900,80 540,620 760,620 340,1280 880,660 660,660" fill="${ALLE_SHAPE_DARK_PURPLE}"/>`;
}

function buildAlleHookSlideSvg(input: SlideRenderInput): string {
  const isLaranja = input.profileId === "alle-laranja";
  const accent = isLaranja ? ALLE_DARK_TEXT : ALLE_ORANGE_BG;
  const boltColor = isLaranja ? "#fff" : ALLE_ORANGE_BG;

  const rawHook = (input.hook || input.slide.title || "").replace(/\s+/g, " ").trim();
  const hookWords = rawHook.split(" ");
  const breakAt = Math.max(1, Math.ceil(hookWords.length * 0.45));
  const t1raw = hookWords.slice(0, breakAt).join(" ");
  const t2raw = hookWords.slice(breakAt).join(" ");

  const t1Lines = wrapTextLines(t1raw || " ", 18, 2);
  const t2Lines = wrapTextLines(t2raw || t1raw, 14, 2);
  const t1FS = t1Lines.some((l) => l.length > 15) ? 72 : 80;
  const t2FS = t2Lines.some((l) => l.length > 12) ? 80 : 96;
  const T1LH = Math.round(t1FS * 1.12);
  const T2LH = Math.round(t2FS * 1.12);

  const textX = 80;
  const t1Y = 780;
  const t2Y = t1Y + t1Lines.length * T1LH + 12;
  const t3Y = t2Y + t2Lines.length * T2LH + 52;

  const logoY = isLaranja ? 1262 : 80;
  const counterY = isLaranja ? 88 : 208;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  ${isLaranja ? alleLaranjaBg() : alleRoxoBg()}
  ${alleLogo(80, logoY, boltColor, "#fff")}
  <text x="1040" y="${counterY}" text-anchor="end" fill="rgba(255,255,255,0.75)" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="600">${input.index + 1}/${input.total}</text>
  <g class="editor-title-layer">
    <text x="${textX}" y="${t1Y}" fill="#fff" font-size="${t1FS}" font-family="Arial, Helvetica, sans-serif" font-weight="300">
      ${t1Lines.map((l, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : T1LH}">${escapeXml(l)}</tspan>`).join("")}
    </text>
    <text x="${textX}" y="${t2Y}" fill="${accent}" font-size="${t2FS}" font-family="Arial, Helvetica, sans-serif" font-weight="800">
      ${t2Lines.map((l, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : T2LH}">${escapeXml(l)}</tspan>`).join("")}
    </text>
  </g>
  <g class="editor-body-layer">
    <text x="${textX}" y="${t3Y}" fill="rgba(255,255,255,0.82)" font-size="38" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(clampSentence(input.topic, 52))}</text>
  </g>
</svg>`;
}

function buildAlleContentSlideSvg(input: SlideRenderInput): string {
  const isLaranja = input.profileId === "alle-laranja";
  const accent = isLaranja ? ALLE_DARK_TEXT : ALLE_ORANGE_BG;
  const boltColor = isLaranja ? "#fff" : ALLE_ORANGE_BG;

  const rawTitle = (input.slide.title || "").replace(/\s+/g, " ").trim();
  const titleWords = rawTitle.split(" ");
  const breakAt = Math.max(1, Math.ceil(titleWords.length * 0.5));
  const t1raw = titleWords.slice(0, breakAt).join(" ");
  const t2raw = titleWords.slice(breakAt).join(" ");

  const t1Lines = wrapTextLines(t1raw || " ", 18, 2);
  const t2Lines = t2raw ? wrapTextLines(t2raw, 16, 2) : [];
  const t1FS = t1Lines.some((l) => l.length > 16) ? 64 : 76;
  const t2FS = t2Lines.some((l) => l.length > 14) ? 72 : 84;
  const T1LH = Math.round(t1FS * 1.12);
  const T2LH = Math.round(t2FS * 1.12);

  const bodyLines = wrapTextLines(input.slide.body || "", 44, 4);
  const BSZ = 38;
  const BLH = 56;

  const textX = 80;
  const t1Y = 640;
  const t2Y = t1Y + t1Lines.length * T1LH + 10;
  const t3Y = t2Y + Math.max(1, t2Lines.length) * T2LH + 60;

  const logoY = isLaranja ? 1262 : 80;
  const counterY = isLaranja ? 88 : 208;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  ${isLaranja ? alleLaranjaBg() : alleRoxoBg()}
  ${alleLogo(80, logoY, boltColor, "#fff")}
  <text x="1040" y="${counterY}" text-anchor="end" fill="rgba(255,255,255,0.75)" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="600">${input.index + 1}/${input.total}</text>
  <g class="editor-title-layer">
    <text x="${textX}" y="${t1Y}" fill="#fff" font-size="${t1FS}" font-family="Arial, Helvetica, sans-serif" font-weight="300">
      ${t1Lines.map((l, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : T1LH}">${escapeXml(l)}</tspan>`).join("")}
    </text>
    ${t2Lines.length > 0 ? `<text x="${textX}" y="${t2Y}" fill="${accent}" font-size="${t2FS}" font-family="Arial, Helvetica, sans-serif" font-weight="800">
      ${t2Lines.map((l, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : T2LH}">${escapeXml(l)}</tspan>`).join("")}
    </text>` : ""}
  </g>
  <g class="editor-body-layer">
    <text x="${textX}" y="${t3Y}" fill="rgba(255,255,255,0.88)" font-size="${BSZ}" font-family="Arial, Helvetica, sans-serif" font-weight="400">
      ${bodyLines.map((l, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : BLH}">${escapeXml(l)}</tspan>`).join("")}
    </text>
  </g>
</svg>`;
}

function buildAlleCTASlideSvg(input: SlideRenderInput): string {
  const isLaranja = input.profileId === "alle-laranja";
  const accent = isLaranja ? ALLE_DARK_TEXT : ALLE_ORANGE_BG;
  const boltColor = isLaranja ? "#fff" : ALLE_ORANGE_BG;

  const rawCta = (input.finalCta || input.slide.title || "").replace(/\s+/g, " ").trim().toUpperCase();
  const ctaWords = rawCta.split(" ");
  const breakAt = Math.max(1, Math.ceil(ctaWords.length * 0.45));
  const t1raw = ctaWords.slice(0, breakAt).join(" ");
  const t2raw = ctaWords.slice(breakAt).join(" ");

  const t1Lines = wrapTextLines(t1raw || " ", 18, 2);
  const t2Lines = wrapTextLines(t2raw || t1raw, 14, 2);
  const t1FS = t1Lines.some((l) => l.length > 15) ? 72 : 80;
  const t2FS = t2Lines.some((l) => l.length > 12) ? 80 : 96;
  const T1LH = Math.round(t1FS * 1.12);
  const T2LH = Math.round(t2FS * 1.12);

  const textX = 80;
  const t1Y = 740;
  const t2Y = t1Y + t1Lines.length * T1LH + 12;
  const t3Y = t2Y + t2Lines.length * T2LH + 52;

  const logoY = isLaranja ? 1262 : 80;
  const counterY = isLaranja ? 88 : 208;

  const followText = input.slide.body
    ? clampSentence(input.slide.body, 48)
    : `Siga ${input.profileHandle || ALLE_PROFILE_HANDLE}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="100%" height="100%" fill="none">
  ${isLaranja ? alleLaranjaBg() : alleRoxoBg()}
  ${alleLogo(80, logoY, boltColor, "#fff")}
  <text x="1040" y="${counterY}" text-anchor="end" fill="rgba(255,255,255,0.75)" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="600">${input.index + 1}/${input.total}</text>
  <g class="editor-title-layer">
    <text x="${textX}" y="${t1Y}" fill="#fff" font-size="${t1FS}" font-family="Arial, Helvetica, sans-serif" font-weight="300">
      ${t1Lines.map((l, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : T1LH}">${escapeXml(l)}</tspan>`).join("")}
    </text>
    <text x="${textX}" y="${t2Y}" fill="${accent}" font-size="${t2FS}" font-family="Arial, Helvetica, sans-serif" font-weight="800">
      ${t2Lines.map((l, i) => `<tspan x="${textX}" dy="${i === 0 ? 0 : T2LH}">${escapeXml(l)}</tspan>`).join("")}
    </text>
  </g>
  <g class="editor-body-layer">
    <text x="${textX}" y="${t3Y}" fill="rgba(255,255,255,0.80)" font-size="42" font-family="Arial, Helvetica, sans-serif" font-weight="400">${escapeXml(followText)}</text>
  </g>
</svg>`;
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
        <image class="editor-image" href="${escapeXml(coverImageUrl)}" x="${imageBox.x}" y="${imageBox.y}" width="${imageBox.width}" height="${imageBox.height}" preserveAspectRatio="xMidYMid slice" />
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

  <g class="editor-title-layer">
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
  </g>

  <g class="editor-body-layer">
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
  </g>
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

function EditorSliderControl({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const displayValue =
    step < 1 ? value.toFixed(2).replace(/\.?0+$/, "") : Math.round(value).toString();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="rounded-full border border-border/50 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {displayValue}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0] ?? value)}
      />
    </div>
  );
}

function CarouselSlideStudio({
  slide,
  slideIndex,
  totalSlides,
  slideType,
  supportsImageEditor,
  settings,
  imagePanelOpen,
  isUploadingImage,
  isRegeneratingSlide,
  isRegeneratingText,
  isRegeneratingImage,
  onToggleImagePanel,
  onReset,
  onRegenerateSlide,
  onRegenerateText,
  onRegenerateImage,
  onTitleChange,
  onBodyChange,
  onApplyImageUrl,
  onUploadImage,
  onSettingChange,
}: {
  slide: CarouselSlide;
  slideIndex: number;
  totalSlides: number;
  slideType: "hook" | "development" | "cta";
  supportsImageEditor: boolean;
  settings: NormalizedSlideEditorSettings;
  imagePanelOpen: boolean;
  isUploadingImage: boolean;
  isRegeneratingSlide: boolean;
  isRegeneratingText: boolean;
  isRegeneratingImage: boolean;
  onToggleImagePanel: () => void;
  onReset: () => void;
  onRegenerateSlide: () => void;
  onRegenerateText: () => void;
  onRegenerateImage: () => void;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onApplyImageUrl: (url: string) => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSettingChange: (key: SlideEditorSettingKey, value: number | string | undefined) => void;
}) {
  const hasAgentMetadata = Boolean(
    slide.shortText ||
    slide.visualDirection ||
    slide.layoutNotes ||
    slide.highlightWords?.length
  );

  return (
    <div className="rounded-[30px] border border-border/40 bg-background/80 p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/30 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mini editor do slide
          </p>
          <h4 className="mt-2 text-lg font-semibold text-foreground">
            Slide {slideIndex + 1} de {totalSlides}
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste texto, imagem, escala, cor e posicao com preview ao vivo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={onRegenerateSlide}
            disabled={isRegeneratingSlide || isRegeneratingText || isRegeneratingImage}
          >
            {isRegeneratingSlide ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Regenerar slide
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={onReset}
            disabled={isRegeneratingSlide}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Resetar slide
          </Button>
        </div>
      </div>

      <Tabs defaultValue="content" className="mt-5 gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1.5 md:grid-cols-4">
          <TabsTrigger value="content" className="rounded-xl">
            <Type className="h-4 w-4" />
            Texto
          </TabsTrigger>
          <TabsTrigger value="image" className="rounded-xl">
            <Image className="h-4 w-4" />
            Imagem
          </TabsTrigger>
          <TabsTrigger value="style" className="rounded-xl">
            <Sparkles className="h-4 w-4" />
            Estilo
          </TabsTrigger>
          <TabsTrigger value="layout" className="rounded-xl">
            <Layers className="h-4 w-4" />
            Layout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {slideType}
            </span>
            {slide.highlightWords?.map((word) => (
              <span
                key={word}
                className="rounded-full border border-border/50 bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {word}
              </span>
            ))}
          </div>
          {hasAgentMetadata ? (
            <div className="grid gap-3 md:grid-cols-2">
              {slide.shortText ? (
                <div className="rounded-2xl border border-border/40 bg-background/70 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Resumo curto
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{slide.shortText}</p>
                </div>
              ) : null}
              {slide.visualDirection ? (
                <div className="rounded-2xl border border-border/40 bg-background/70 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Direcao visual
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{slide.visualDirection}</p>
                </div>
              ) : null}
              {slide.layoutNotes ? (
                <div className="rounded-2xl border border-border/40 bg-background/70 p-4 md:col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Observacoes de layout
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{slide.layoutNotes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-2xl border border-border/40 bg-background/70 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Titulo do slide
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11px]"
                onClick={onRegenerateText}
                disabled={isRegeneratingText || isRegeneratingSlide}
              >
                {isRegeneratingText ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Reescrever texto
              </Button>
            </div>
            <Input
              value={slide.title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="h-10 rounded-xl border-border/50 bg-background text-sm"
            />
          </div>
          <div className="rounded-2xl border border-border/40 bg-background/70 p-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Corpo do slide
            </p>
            <Textarea
              value={slide.body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="min-h-[160px] resize-none rounded-xl border-border/50 bg-background text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="image" className="space-y-4">
          {supportsImageEditor ? (
            <>
              <div className="space-y-3 rounded-2xl border border-border/40 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Fonte da imagem</p>
                    <p className="text-xs text-muted-foreground">
                      Cole uma URL ou envie um arquivo para trocar a imagem deste slide.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl text-xs"
                      onClick={onRegenerateImage}
                      disabled={isRegeneratingImage || isRegeneratingSlide}
                    >
                      {isRegeneratingImage ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Nova imagem com IA
                    </Button>
                    <button
                      type="button"
                      onClick={onToggleImagePanel}
                      className="flex items-center gap-1.5 rounded-xl border border-border/40 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Trocar imagem
                    </button>
                  </div>
                </div>

                {imagePanelOpen ? (
                  <div className="space-y-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4">
                    <div className="flex gap-2">
                      <Input
                        key={`editor-image-url-${slideIndex}`}
                        defaultValue={slide.imageUrl ?? ""}
                        placeholder="https://..."
                        className="h-10 rounded-xl border-border/50 bg-background/70 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const url = (e.target as HTMLInputElement).value.trim();
                            if (url) onApplyImageUrl(url);
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 shrink-0 rounded-xl text-xs"
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          const url = input?.value.trim();
                          if (url) onApplyImageUrl(url);
                        }}
                      >
                        Aplicar
                      </Button>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/40 bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground">
                      <Upload className="h-3.5 w-3.5" />
                      Upload de arquivo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onUploadImage}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-border/40 bg-background/70 p-4">
                  <EditorSliderControl
                    label="Zoom da imagem"
                    hint="Aproxime ou afaste a arte dentro do recorte."
                    value={settings.imageScale}
                    min={0.7}
                    max={2}
                    step={0.05}
                    onChange={(value) => onSettingChange("imageScale", value)}
                  />
                  <EditorSliderControl
                    label="Mover horizontal"
                    value={settings.imageOffsetX}
                    min={-260}
                    max={260}
                    onChange={(value) => onSettingChange("imageOffsetX", value)}
                  />
                  <EditorSliderControl
                    label="Mover vertical"
                    value={settings.imageOffsetY}
                    min={-260}
                    max={260}
                    onChange={(value) => onSettingChange("imageOffsetY", value)}
                  />
                </div>
                <div className="space-y-4 rounded-2xl border border-border/40 bg-background/70 p-4">
                  <EditorSliderControl
                    label="Rotacao"
                    value={settings.imageRotation}
                    min={-35}
                    max={35}
                    suffix="°"
                    onChange={(value) => onSettingChange("imageRotation", value)}
                  />
                  <EditorSliderControl
                    label="Brilho"
                    value={settings.imageBrightness}
                    min={50}
                    max={160}
                    suffix="%"
                    onChange={(value) => onSettingChange("imageBrightness", value)}
                  />
                  <EditorSliderControl
                    label="Contraste"
                    value={settings.imageContrast}
                    min={50}
                    max={180}
                    suffix="%"
                    onChange={(value) => onSettingChange("imageContrast", value)}
                  />
                  <EditorSliderControl
                    label="Saturacao"
                    value={settings.imageSaturate}
                    min={0}
                    max={200}
                    suffix="%"
                    onChange={(value) => onSettingChange("imageSaturate", value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-5">
              <p className="text-sm font-medium text-foreground">
                Este slide nao usa uma area de imagem independente neste layout.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nos slides de fechamento ou modelos mais tipograficos, a parte visual fica concentrada no texto e nas cores.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="style" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border/40 bg-background/70 p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Cor do titulo</span>
                <input
                  type="color"
                  value={settings.titleColor ?? "#111827"}
                  onChange={(e) => onSettingChange("titleColor", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-border/50 bg-transparent p-0.5"
                />
              </label>
              <EditorSliderControl
                label="Escala do titulo"
                value={settings.titleScale}
                min={0.7}
                max={1.6}
                step={0.05}
                onChange={(value) => onSettingChange("titleScale", value)}
              />
            </div>
            <div className="space-y-4 rounded-2xl border border-border/40 bg-background/70 p-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Cor do corpo</span>
                <input
                  type="color"
                  value={settings.bodyColor ?? "#475467"}
                  onChange={(e) => onSettingChange("bodyColor", e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-border/50 bg-transparent p-0.5"
                />
              </label>
              <EditorSliderControl
                label="Escala do corpo"
                value={settings.bodyScale}
                min={0.7}
                max={1.6}
                step={0.05}
                onChange={(value) => onSettingChange("bodyScale", value)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="layout" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border/40 bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Posicao do titulo</p>
              <EditorSliderControl
                label="Horizontal"
                value={settings.titleOffsetX}
                min={-240}
                max={240}
                onChange={(value) => onSettingChange("titleOffsetX", value)}
              />
              <EditorSliderControl
                label="Vertical"
                value={settings.titleOffsetY}
                min={-240}
                max={240}
                onChange={(value) => onSettingChange("titleOffsetY", value)}
              />
            </div>
            <div className="space-y-4 rounded-2xl border border-border/40 bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Posicao do corpo</p>
              <EditorSliderControl
                label="Horizontal"
                value={settings.bodyOffsetX}
                min={-240}
                max={240}
                onChange={(value) => onSettingChange("bodyOffsetX", value)}
              />
              <EditorSliderControl
                label="Vertical"
                value={settings.bodyOffsetY}
                min={-240}
                max={240}
                onChange={(value) => onSettingChange("bodyOffsetY", value)}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
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
  fontFamily,
  accentColor,
  backgroundColor,
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
  fontFamily?: string;
  accentColor?: string;
  backgroundColor?: string;
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
    fontFamily,
    accentColor,
    backgroundColor,
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
  onEdit,
  onDownload,
  onPublish,
  onSchedule,
  onDelete,
  isPublishing,
  isScheduling,
  isDeleting,
  profile,
}: {
  carousel: CarouselItem;
  onOpen: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onPublish: () => void;
  onSchedule: () => void;
  onDelete: () => void;
  isPublishing: boolean;
  isScheduling: boolean;
  isDeleting: boolean;
  profile: ProfileModel;
}) {
  const heroSlide = carousel.slides[0];
  const renderedPreviewUrl = heroSlide?.renderedImageUrl
    ? toAbsoluteClientAssetUrl(heroSlide.renderedImageUrl)
    : null;
  const [imgFailed, setImgFailed] = useState(false);
  const handleCardAction = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };
  const stopCardActionPropagation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="group relative overflow-hidden rounded-[30px] border border-border/40 bg-background/75 p-3 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative z-0">
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
              profileId={profile.id}
              profileHandle={profile.handle}
              profileName={profile.name}
              profileInitials={profile.initials}
              profileAvatarUrl={profile.avatarUrl}
              className="rounded-[26px] border-0 shadow-none"
            />
          )}
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-white backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
              <span>Carrossel IA</span>
              <span>{carousel.slides.length} slides</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
                {carousel.topic}
              </p>
              <button
                type="button"
                aria-label={`Abrir preview do carrossel ${carousel.topic}`}
                onPointerDown={stopCardActionPropagation}
                onMouseDown={stopCardActionPropagation}
                onClick={(event) => handleCardAction(event, onOpen)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-white/20"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-3 px-1 pb-1 pt-4">
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
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            onPointerDown={stopCardActionPropagation}
            onMouseDown={stopCardActionPropagation}
            onClick={(event) => handleCardAction(event, onEdit)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            onPointerDown={stopCardActionPropagation}
            onMouseDown={stopCardActionPropagation}
            onClick={(event) => handleCardAction(event, onDownload)}
          >
            <Download className="mr-2 h-4 w-4" />
            ZIP
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            onPointerDown={stopCardActionPropagation}
            onMouseDown={stopCardActionPropagation}
            onClick={(event) => handleCardAction(event, onPublish)}
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
            type="button"
            variant="outline"
            className="border-blue-500/30 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/30"
            onPointerDown={stopCardActionPropagation}
            onMouseDown={stopCardActionPropagation}
            onClick={(event) => handleCardAction(event, onSchedule)}
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
          type="button"
          variant="outline"
          className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onPointerDown={stopCardActionPropagation}
          onMouseDown={stopCardActionPropagation}
          onClick={(event) => handleCardAction(event, onDelete)}
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
      // Imported carousels already have ready-to-use images — skip SVG rendering
      if (carousel.style === "importado") {
        const imageDataUrl = await resolveAssetUrl(slide.renderedImageUrl || slide.imageUrl);
        return {
          ...slide,
          renderedImageDataUrl: imageDataUrl,
        };
      }

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
        ...slide,
        renderedImageDataUrl: imageDataUrl,
        fontFamily: slide.fontFamily,
        accentColor: slide.accentColor,
        backgroundColor: slide.backgroundColor,
        editorSettings: slide.editorSettings,
      };
    })
  );
}

export default function Carousels() {
  const utils = trpc.useUtils();
  const [inputMode, setInputMode] = useState<"topic" | "news">("topic");
  const [topic, setTopic] = useState("");
  const [newsUrl, setNewsUrl] = useState("");
  const [articleContext, setArticleContext] = useState<string | undefined>(undefined);
  const [articlePreview, setArticlePreview] = useState<{ title: string; summary: string } | null>(null);
  const [slideCount, setSlideCount] = useState(5);
  const [carouselFormat, setCarouselFormat] = useState<"feed" | "story">("feed");
  const selectedStyle = DEFAULT_STYLE_ID;
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [selectedCarouselId, setSelectedCarouselId] = useState<number | null>(null);
  const [modalSlide, setModalSlide] = useState(0);
  const [scheduleCarousel, setScheduleCarousel] = useState<CarouselItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>(DEFAULT_PROFILE_ID);
  const [useAiImages, setUseAiImages] = useState(true);
  const pendingTemplateSyncsRef = useRef(new Map<number, Promise<CarouselItem>>());

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTopic, setImportTopic] = useState("");
  const [importHook, setImportHook] = useState("");
  const [importCaption, setImportCaption] = useState("");
  const [importCta, setImportCta] = useState("");
  const [importSlides, setImportSlides] = useState<Array<{ title: string; dataUrl: string; fileName: string }>>([]);
  const [importUploading, setImportUploading] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Editor dialog state
  const [editorCarousel, setEditorCarousel] = useState<CarouselItem | null>(null);
  const [editorDraft, setEditorDraft] = useState<CarouselItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorSlideIndex, setEditorSlideIndex] = useState(0);
  const [editorFontId, setEditorFontId] = useState<FontOptionId>("default");
  const [editorAccentColor, setEditorAccentColor] = useState(FV_GOLD);
  const [editorBgColor, setEditorBgColor] = useState(FV_BLUE);
  const [editorImagePanelIndex, setEditorImagePanelIndex] = useState<number | null>(null);
  const [editorUploadingIndex, setEditorUploadingIndex] = useState<number | null>(null);
  const editorOpenTimeoutRef = useRef<number | null>(null);
  const editorPrimaryFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const previewOpenBlockedUntilRef = useRef(0);

  const { data: carousels = [], isLoading, isError, error } = trpc.carousel.getAll.useQuery(undefined, {
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // Diagnostic: remove after confirming carousels load correctly
  console.log('[Carousel] count=' + carousels.length + ' isLoading=' + isLoading + ' isError=' + isError + (isError ? ' err=' + String(error) : ''));

  const fetchArticleMutation = trpc.carousel.fetchArticle.useMutation({
    onSuccess: (data) => {
      setTopic(data.topic);
      setArticleContext(data.articleContext);
      setArticlePreview({ title: data.title, summary: data.summary });
      toast.success("Notícia carregada! Revise o tema e clique em gerar.");
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível carregar a notícia");
    },
  });

  const generateCarouselMutation = trpc.carousel.generate.useMutation({
    onSuccess: (carousel) => {
      utils.carousel.getAll.invalidate();
      utils.carousel.getStats.invalidate();
      setSelectedCarouselId(carousel.id);
      setModalSlide(0);
      setTopic("");
      setNewsUrl("");
      setArticleContext(undefined);
      setArticlePreview(null);
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
  const updateContentMutation = trpc.carousel.updateContent.useMutation({
    onSuccess: () => {
      utils.carousel.getAll.invalidate();
    },
  });
  const uploadSlideImageMutation = trpc.carousel.uploadSlideImage.useMutation();
  const regenerateSlideMutation = trpc.carousel.regenerateSlide.useMutation();
  const regenerateSlideTextMutation = trpc.carousel.regenerateSlideText.useMutation();
  const regenerateSlideImageMutation = trpc.carousel.regenerateSlideImage.useMutation();
  const regenerateCaptionMutation = trpc.carousel.regenerateCaption.useMutation();
  const generateCaptionMutation = trpc.carousel.generateCaptionFromImage.useMutation({
    onSuccess: ({ caption }) => {
      setImportCaption(caption);
    },
    onError: (err) => {
      toast.error("Erro ao gerar legenda: " + (err.message || "falha desconhecida"));
    },
  });

  const importImagesMutation = trpc.carousel.importImages.useMutation({
    onSuccess: (carousel) => {
      utils.carousel.getAll.invalidate();
      utils.carousel.getStats.invalidate();
      setImportDialogOpen(false);
      setImportTopic("");
      setImportHook("");
      setImportCaption("");
      setImportCta("");
      setImportSlides([]);
      setSelectedCarouselId(carousel.id);
      setModalSlide(0);
      toast.success("Carrossel importado com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao importar: " + (err.message || "falha desconhecida"));
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
  const selectedCarouselProfile = getCarouselProfileModel(selectedCarousel, selectedProfileId);
  const editorProfile = getCarouselProfileModel(editorDraft ?? editorCarousel, selectedProfileId);
  const currentEditorSlide =
    editorDraft?.slides[editorSlideIndex] ?? editorDraft?.slides[0] ?? null;
  const currentEditorSlideType =
    currentEditorSlide && editorDraft
      ? getSlideType(currentEditorSlide, editorSlideIndex, editorDraft.slides.length)
      : "development";
  const currentEditorSlideSettings = normalizeSlideEditorSettings(
    currentEditorSlide?.editorSettings
  );
  const currentEditorSlideHasImage =
    editorDraft && currentEditorSlide
      ? slideSupportsImageEditor(
          currentEditorSlide,
          editorSlideIndex,
          editorDraft.slides.length,
          editorProfile.id
        )
      : false;

  useEffect(() => {
    return () => {
      if (editorOpenTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(editorOpenTimeoutRef.current);
      }
    };
  }, []);

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
        const slides = await buildCarouselTemplateSlides(
          carousel,
          resolveTemplateAssetUrl,
          getCarouselProfileModel(carousel, selectedProfileId)
        );
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
    if (Date.now() < previewOpenBlockedUntilRef.current) {
      return;
    }
    setSelectedCarouselId(carousel.id);
    setModalSlide(0);
  };

  const openEditor = (carousel: CarouselItem) => {
    const fontFromSlides = carousel.slides[0]?.fontFamily;
    const matchedFont = FONT_OPTIONS.find((f) => f.value === fontFromSlides);
    const accentFromSlides = carousel.slides[0]?.accentColor;
    const bgFromSlides = carousel.slides[0]?.backgroundColor;
    if (editorOpenTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(editorOpenTimeoutRef.current);
      editorOpenTimeoutRef.current = null;
    }
    previewOpenBlockedUntilRef.current = Date.now() + 800;
    setIsEditorOpen(false);
    setSelectedCarouselId(null);
    setModalSlide(0);
    setEditorFontId(matchedFont?.id ?? "default");
    setEditorAccentColor(accentFromSlides ?? FV_GOLD);
    setEditorBgColor(bgFromSlides ?? FV_BLUE);
    setEditorDraft({ ...carousel, slides: carousel.slides.map((s) => ({ ...s })) });
    setEditorCarousel(carousel);
    setEditorSlideIndex(0);
    setEditorImagePanelIndex(null);
    if (typeof window === "undefined") {
      setIsEditorOpen(true);
      return;
    }
    editorOpenTimeoutRef.current = window.setTimeout(() => {
      setIsEditorOpen(true);
      editorOpenTimeoutRef.current = null;
    }, 0);
  };

  const closeEditor = () => {
    if (editorOpenTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(editorOpenTimeoutRef.current);
      editorOpenTimeoutRef.current = null;
    }
    setIsEditorOpen(false);
    setEditorCarousel(null);
    setEditorDraft(null);
    setEditorSlideIndex(0);
    setEditorImagePanelIndex(null);
  };

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error("Digite o tema do carrossel");
      return;
    }

    generateCarouselMutation.mutate({
      topic: topic.trim(),
      slideCount,
      carouselFormat,
      style: selectedStyle,
      profileId: selectedProfileId,
      coverImageDataUrl: coverImageUrl || undefined,
      useAiImages,
      articleContext,
    });
  };

  const handleDelete = (id: number) => {
    deleteCarouselMutation.mutate({ id });
  };

  const handleDownload = (carousel: CarouselItem) => {
    try {
      const zipEntries = buildCarouselZipEntries(
        carousel,
        getCarouselProfileModel(carousel, selectedProfileId)
      );
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
    const isImported = carousel.style === "importado";
    const preparedCarousel = isImported
      ? carousel
      : await ensureCarouselDesignAssets(carousel, { silent: true, force: true });
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

  const handleEditorField = (field: "hook" | "caption" | "finalCta", value: string) => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [field]: value,
        slides:
          field === "caption" ? prev.slides : clearRenderedSlideAssets(prev.slides),
      };
    });
  };

  const handleEditorSlideText = (index: number, field: "title" | "body", value: string) => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.map((s, i) =>
        i === index ? { ...clearRenderedSlideAsset(s), [field]: value } : s
      );
      return { ...prev, slides };
    });
  };

  const handleEditorSlideImageUrl = (index: number, url: string) => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.map((s, i) =>
        i === index ? { ...s, imageUrl: url, renderedImageUrl: undefined } : s
      );
      return { ...prev, slides };
    });
    setEditorImagePanelIndex(null);
  };

  const handleEditorUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slideIndex: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setEditorUploadingIndex(slideIndex);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = (ev) => {
          const result = ev.target?.result;
          if (typeof result === "string") resolve(result);
          else reject(new Error("Falha ao ler o arquivo"));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { url } = await uploadSlideImageMutation.mutateAsync({ imageDataUrl: dataUrl });
      handleEditorSlideImageUrl(slideIndex, url);
      toast.success("Imagem atualizada");
    } catch {
      toast.error("Erro ao enviar a imagem");
    } finally {
      setEditorUploadingIndex(null);
    }
  };

  const handleEditorFontChange = (fontId: FontOptionId) => {
    setEditorFontId(fontId);
    const fontValue = FONT_OPTIONS.find((f) => f.id === fontId)?.value;
    setEditorDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: clearRenderedSlideAssets(
          prev.slides.map((s) => ({ ...s, fontFamily: fontValue }))
        ),
      };
    });
  };

  const handleEditorAccentColorChange = (color: string) => {
    setEditorAccentColor(color);
    setEditorDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: clearRenderedSlideAssets(
          prev.slides.map((s) => ({ ...s, accentColor: color }))
        ),
      };
    });
  };

  const handleEditorBgColorChange = (color: string) => {
    setEditorBgColor(color);
    setEditorDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slides: clearRenderedSlideAssets(
          prev.slides.map((s) => ({ ...s, backgroundColor: color }))
        ),
      };
    });
  };

  const handleEditorSlideSetting = (
    index: number,
    key: SlideEditorSettingKey,
    value: number | string | undefined
  ) => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.map((slide, slideIndex) => {
        if (slideIndex !== index) {
          return slide;
        }

        const currentSettings = normalizeSlideEditorSettings(slide.editorSettings);
        const nextSettings: SlideEditorSettings = {
          ...currentSettings,
          [key]: value,
        };

        return {
          ...clearRenderedSlideAsset(slide),
          editorSettings: nextSettings,
        };
      });

      return { ...prev, slides };
    });
  };

  const resetCurrentSlideEditorSettings = () => {
    setEditorDraft((prev) => {
      if (!prev) return prev;
      const slides = prev.slides.map((slide, index) =>
        index === editorSlideIndex
          ? {
              ...clearRenderedSlideAsset(slide),
              editorSettings: {
                ...DEFAULT_SLIDE_EDITOR_SETTINGS,
              },
            }
          : slide
      );
      return { ...prev, slides };
    });
  };

  const handleSaveEditor = async () => {
    if (!editorDraft) return;
    try {
      await updateContentMutation.mutateAsync({
        id: editorDraft.id,
        hook: editorDraft.hook,
        caption: editorDraft.caption,
        finalCta: editorDraft.finalCta,
        slides: editorDraft.slides,
      });
      closeEditor();
      toast.success("Carrossel atualizado com sucesso");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao salvar: " + message);
    }
  };

  const mergeSavedCarouselIntoEditor = (
    savedCarousel: CarouselItem,
    options?: { preserveDraftContent?: boolean }
  ) => {
    setEditorCarousel(savedCarousel);
    setEditorDraft((prev) => {
      if (!prev) return savedCarousel;
      if (!options?.preserveDraftContent) {
        return savedCarousel;
      }

      return {
        ...savedCarousel,
        hook: prev.hook,
        caption: prev.caption,
        finalCta: prev.finalCta,
      };
    });
    void utils.carousel.getAll.invalidate();
  };

  const handleRegenerateCurrentSlide = async () => {
    if (!editorDraft || !currentEditorSlide) return;

    try {
      const savedCarousel = await regenerateSlideMutation.mutateAsync({
        carouselId: editorDraft.id,
        slideIndex: editorSlideIndex,
        topic: editorDraft.topic,
        hook: editorDraft.hook,
        totalSlides: editorDraft.slides.length,
        slideType: currentEditorSlideType,
        currentSlides: editorDraft.slides,
        profileId: editorProfile.id,
        format: carouselFormat,
        style: editorDraft.style,
        useAiImages,
      });
      mergeSavedCarouselIntoEditor(savedCarousel as CarouselItem, {
        preserveDraftContent: true,
      });
      toast.success("Slide regenerado com IA");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Nao foi possivel regenerar o slide: " + message);
    }
  };

  const handleRegenerateCurrentSlideText = async () => {
    if (!editorDraft || !currentEditorSlide) return;

    try {
      const result = await regenerateSlideTextMutation.mutateAsync({
        carouselId: editorDraft.id,
        slideIndex: editorSlideIndex,
        topic: editorDraft.topic,
        hook: editorDraft.hook,
        slideType: currentEditorSlideType,
        currentTitle: currentEditorSlide.title,
        currentBody: currentEditorSlide.body,
        currentSlides: editorDraft.slides,
        profileId: editorProfile.id,
      });
      mergeSavedCarouselIntoEditor(result.carousel as CarouselItem, {
        preserveDraftContent: true,
      });
      toast.success("Texto do slide atualizado com IA");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Nao foi possivel reescrever o slide: " + message);
    }
  };

  const handleRegenerateCurrentSlideImage = async () => {
    if (!editorDraft || !currentEditorSlide) return;

    try {
      const result = await regenerateSlideImageMutation.mutateAsync({
        carouselId: editorDraft.id,
        slideIndex: editorSlideIndex,
        topic: editorDraft.topic,
        hook: editorDraft.hook,
        slideTitle: currentEditorSlide.title,
        slideBody: currentEditorSlide.body,
        currentSlides: editorDraft.slides,
        imagePrompt: currentEditorSlide.imagePrompt,
        profileId: editorProfile.id,
        useAiImages,
      });
      mergeSavedCarouselIntoEditor(result.carousel as CarouselItem, {
        preserveDraftContent: true,
      });
      toast.success("Imagem do slide atualizada com IA");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Nao foi possivel gerar uma nova imagem: " + message);
    }
  };

  const handleRegenerateCaptionAndCta = async () => {
    if (!editorDraft) return;

    try {
      const result = await regenerateCaptionMutation.mutateAsync({
        carouselId: editorDraft.id,
        topic: editorDraft.topic,
        hook: editorDraft.hook,
        finalCta: editorDraft.finalCta,
        slides: editorDraft.slides,
        currentSlides: editorDraft.slides,
        profileId: editorProfile.id,
      });
      mergeSavedCarouselIntoEditor(result.carousel as CarouselItem);
      toast.success("Legenda e CTA atualizados com IA");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Nao foi possivel atualizar a legenda: " + message);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    const newSlides = await Promise.all(
      files.map((file) =>
        new Promise<{ title: string; dataUrl: string; fileName: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const result = ev.target?.result;
            if (typeof result === "string") {
              resolve({
                title: file.name.replace(/\.[^.]+$/, ""),
                dataUrl: result,
                fileName: file.name,
              });
            } else {
              reject(new Error("Falha ao ler arquivo"));
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        })
      )
    );
    setImportSlides((prev) => [...prev, ...newSlides].slice(0, 10));
  };

  const handleImportSubmit = async () => {
    if (!importTopic.trim()) { toast.error("Digite o tema do carrossel"); return; }
    if (!importSlides.length) { toast.error("Selecione pelo menos uma imagem"); return; }
    setImportUploading(true);
    try {
      await importImagesMutation.mutateAsync({
        topic: importTopic.trim(),
        hook: importHook.trim() || undefined,
        caption: importCaption.trim() || undefined,
        finalCta: importCta.trim() || undefined,
        profileId: selectedProfileId,
        slides: importSlides.map((s) => ({ title: s.title, imageDataUrl: s.dataUrl })),
      });
    } finally {
      setImportUploading(false);
    }
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

            {/* Mode toggle */}
            <div className="flex gap-1 rounded-xl border border-border/40 bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => {
                  setInputMode("topic");
                  setArticleContext(undefined);
                  setArticlePreview(null);
                }}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  inputMode === "topic"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Type className="h-3.5 w-3.5" />
                Tema livre
              </button>
              <button
                type="button"
                onClick={() => setInputMode("news")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  inputMode === "news"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Newspaper className="h-3.5 w-3.5" />
                A partir de uma notícia
              </button>
            </div>

            {inputMode === "news" ? (
              <div className="space-y-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Link da notícia
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newsUrl}
                    onChange={(e) => setNewsUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl border-border/50 bg-background/70 text-sm"
                    disabled={fetchArticleMutation.isPending || isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newsUrl.trim()) {
                        fetchArticleMutation.mutate({ url: newsUrl.trim() });
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fetchArticleMutation.mutate({ url: newsUrl.trim() })}
                    disabled={!newsUrl.trim() || fetchArticleMutation.isPending || isGenerating}
                    className="shrink-0 rounded-xl"
                  >
                    {fetchArticleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Buscar"
                    )}
                  </Button>
                </div>

                {articlePreview && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Newspaper className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                        {articlePreview.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {articlePreview.summary}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Type className="h-3.5 w-3.5" />
                    Tema do carrossel
                    <span className="text-muted-foreground/60">(gerado automaticamente, edite se quiser)</span>
                  </label>
                  <Textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Cole o link acima para preencher automaticamente..."
                    className="min-h-[80px] resize-none rounded-2xl border-border/50 bg-background/70 text-sm"
                    disabled={isGenerating}
                  />
                </div>
              </div>
            ) : (
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
            )}

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
                Formato do carrossel
              </label>
              <div className="flex flex-wrap gap-3">
                {carouselFormatOptions.map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setCarouselFormat(format.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-2xl border-2 px-4 py-2.5 transition-all duration-150",
                      carouselFormat === format.id
                        ? "border-primary bg-primary/10"
                        : "border-border/30 hover:border-border"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-semibold",
                      carouselFormat === format.id ? "text-primary" : "text-muted-foreground"
                    )}>
                      {format.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{format.description}</span>
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
              {selectedProfileId === BRANDSDECODED_PROFILE_ID ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Modo BrandsDecoded: o agente prioriza hook de autoridade, leitura de negocio,
                  progressao de diagnostico para impacto e imagem editorial premium.
                </p>
              ) : null}
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

            <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Importar imagens prontas</p>
                <p className="text-xs text-muted-foreground">
                  Envie imagens do computador e poste direto no Instagram, sem passar pela IA.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                className="gap-2 shrink-0"
              >
                <Upload className="h-4 w-4" />
                Importar imagens
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
                  {slideCount} slide{slideCount !== 1 ? 's' : ''}
                </span>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-muted-foreground">
                  {carouselFormatOptions.find(f => f.id === carouselFormat)?.description}
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
          ) : isError ? (
            <div className="glass-card p-12 text-center">
              <h3 className="text-base font-semibold text-destructive">Erro ao carregar carrosseis</h3>
              <p className="mt-2 text-sm text-muted-foreground font-mono break-all">
                {error instanceof Error ? error.message : String(error)}
              </p>
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
                  profile={getCarouselProfileModel(carousel, selectedProfileId)}
                  onOpen={() => openCarousel(carousel)}
                  onEdit={() => openEditor(carousel)}
                  onDownload={() => handleDownload(carousel)}
                  onPublish={() => handlePublishInstagram(carousel)}
                  onSchedule={() => openScheduleDialog(carousel)}
                  onDelete={() => deleteCarouselMutation.mutate({ id: carousel.id })}
                  isPublishing={isPublishingCarousel}
                  isScheduling={isSchedulingCarousel}
                  isDeleting={deleteCarouselMutation.isPending && deleteCarouselMutation.variables?.id === carousel.id}
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
                    slide={selectedCarousel.slides[modalSlide] ?? selectedCarousel.slides[0]}
                    index={modalSlide}
                    total={selectedCarousel.slides.length}
                    style={selectedCarousel.style}
                    topic={selectedCarousel.topic}
                    hook={selectedCarousel.hook}
                    finalCta={selectedCarousel.finalCta}
                    coverImageUrl={selectedCarousel.coverImageUrl ?? undefined}
                    profileAvatarUrl={selectedCarouselProfile.avatarUrl}
                    profileName={selectedCarouselProfile.name}
                    profileHandle={selectedCarouselProfile.handle}
                    profileInitials={selectedCarouselProfile.initials}
                    profileId={selectedCarouselProfile.id}
                    fontFamily={(selectedCarousel.slides[modalSlide] ?? selectedCarousel.slides[0])?.fontFamily}
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
                    {modalSlide + 1} / {selectedCarousel.slides.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-2xl bg-background/80"
                    onClick={() =>
                      setModalSlide((value) => Math.min(selectedCarousel.slides.length - 1, value + 1))
                    }
                    disabled={modalSlide === selectedCarousel.slides.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {selectedCarousel.slides.map((slide, index) => (
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

              {/* ── Right panel ─────────────────────────────────────────────── */}
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Header */}
                <div className="flex items-start justify-between gap-6 border-b border-border/30 p-6 lg:p-8">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Carrossel gerado
                    </p>
                    <h3 className="text-2xl font-semibold leading-tight text-foreground lg:text-3xl">
                      {selectedCarousel.topic}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedCarousel.slides.length} slides | pronto para design e postagem
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-2xl border border-border/40 bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => openEditor(selectedCarousel)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
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
                </div>

                {/* Body — view mode */}
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

                  <div className="hidden" aria-hidden="true">
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

                {/* Footer */}
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
                    onClick={() => openEditor(selectedCarousel)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar conteúdo
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

      {/* ── Editor Dialog ─────────────────────────────────────────────────────── */}
      <Dialog
        open={isEditorOpen && !!editorCarousel}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (typeof window === "undefined") return;
            window.requestAnimationFrame(() => {
              editorPrimaryFieldRef.current?.focus();
              editorPrimaryFieldRef.current?.scrollIntoView({
                block: "nearest",
                inline: "nearest",
              });
            });
          }}
          className="!w-[min(96vw,1180px)] !max-w-[1180px] flex h-[min(92vh,860px)] flex-col gap-0 overflow-hidden rounded-[30px] border-border/50 bg-background p-0 shadow-2xl"
        >
          {editorCarousel && editorDraft ? (
            <>
            <DialogTitle className="sr-only">Editor: {editorCarousel.topic}</DialogTitle>
            <DialogDescription className="sr-only">
              Edite textos, fontes, cores e imagens do carrossel.
            </DialogDescription>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-border/30 bg-background/95 px-5 py-5 backdrop-blur sm:px-6 sm:py-6 lg:px-7">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <span className="rounded-full border border-border/40 bg-background/80 px-3 py-1.5">
                        Editor do carrossel
                      </span>
                      <span>
                        Slide {editorSlideIndex + 1} de {editorDraft.slides.length}
                      </span>
                    </div>
                    <h3 className="max-w-3xl text-2xl font-semibold leading-tight text-foreground sm:text-3xl lg:text-[2.4rem]">
                      {editorCarousel.topic}
                    </h3>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      Ajuste textos, fonte, cores, imagem e posicao com preview ao vivo em um layout mais limpo.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/40 bg-background/80 transition-colors hover:bg-accent"
                    onClick={closeEditor}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
              {/* Left — live preview */}
              <div className="min-w-0 overflow-y-auto border-b border-border/30 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(244,244,245,0.92)_40%,_rgba(228,228,231,0.88)_100%)] p-4 sm:p-6 lg:p-7 xl:w-[410px] xl:shrink-0 xl:border-b-0 xl:border-r">
                <div className="mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[400px]">
                  <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/40 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 backdrop-blur">
                    <span>Preview ao vivo</span>
                    <span>{editorSlideIndex + 1} / {editorDraft.slides.length}</span>
                  </div>
                  <SlidePreview
                    slide={editorDraft.slides[editorSlideIndex] ?? editorDraft.slides[0]}
                    index={editorSlideIndex}
                    total={editorDraft.slides.length}
                    style={editorDraft.style}
                    topic={editorDraft.topic}
                    hook={editorDraft.hook}
                    finalCta={editorDraft.finalCta}
                    coverImageUrl={editorDraft.coverImageUrl ?? undefined}
                    profileAvatarUrl={editorProfile.avatarUrl}
                    profileName={editorProfile.name}
                    profileHandle={editorProfile.handle}
                    profileInitials={editorProfile.initials}
                    profileId={editorProfile.id}
                    fontFamily={FONT_OPTIONS.find((f) => f.id === editorFontId)?.value}
                    accentColor={editorAccentColor}
                    backgroundColor={editorBgColor}
                  />
                </div>

                <div className="mt-5 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-2xl bg-background/80"
                    onClick={() => setEditorSlideIndex((v) => Math.max(0, v - 1))}
                    disabled={editorSlideIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="w-20 text-center text-xs text-muted-foreground">
                    {editorSlideIndex + 1} / {editorDraft.slides.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-2xl bg-background/80"
                    onClick={() => setEditorSlideIndex((v) => Math.min(editorDraft.slides.length - 1, v + 1))}
                    disabled={editorSlideIndex === editorDraft.slides.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-5 overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-2">
                    {editorDraft.slides.map((slide, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setEditorSlideIndex(index)}
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-150",
                          editorSlideIndex === index
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/40 bg-background/70 text-muted-foreground hover:border-border hover:text-foreground"
                        )}
                      >
                        Slide {index + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-white/40 bg-white/70 px-4 py-3 text-center backdrop-blur">
                  <p className="text-sm font-semibold text-foreground">
                    {editorDraft.slides[editorSlideIndex]?.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Troque de slide acima para ajustar cada parte do carrossel sem baguncar o painel.
                  </p>
                </div>
              </div>

              {/* Right — controls */}
              <div className="min-w-0 min-h-0 flex-1 bg-[linear-gradient(180deg,rgba(248,250,252,0.72),rgba(255,255,255,0)_28%)]">
                <div className="h-full space-y-6 overflow-y-auto p-5 sm:p-6 lg:p-7">
                  <div className="rounded-[30px] border border-border/40 bg-background/80 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Aparencia geral
                        </p>
                        <h4 className="mt-2 text-lg font-semibold text-foreground">
                          Fonte, destaque e base do carrossel
                        </h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Esses ajustes valem para todos os slides. O ajuste fino fica por slide logo abaixo.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/40 bg-background/70 px-3 py-2">
                          <input
                            type="color"
                            value={editorAccentColor}
                            onChange={(e) => handleEditorAccentColorChange(e.target.value)}
                            className="h-9 w-9 cursor-pointer rounded-lg border border-border/50 bg-transparent p-0.5"
                          />
                          <span className="text-xs text-muted-foreground">Destaque</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/40 bg-background/70 px-3 py-2">
                          <input
                            type="color"
                            value={editorBgColor}
                            onChange={(e) => handleEditorBgColorChange(e.target.value)}
                            className="h-9 w-9 cursor-pointer rounded-lg border border-border/50 bg-transparent p-0.5"
                          />
                          <span className="text-xs text-muted-foreground">Fundo</span>
                        </label>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {FONT_OPTIONS.map((font) => (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => handleEditorFontChange(font.id)}
                          style={{ fontFamily: font.value }}
                          className={cn(
                            "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
                            editorFontId === font.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                          )}
                        >
                          {font.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {currentEditorSlide ? (
                    <CarouselSlideStudio
                      slide={currentEditorSlide}
                      slideIndex={editorSlideIndex}
                      totalSlides={editorDraft.slides.length}
                      slideType={currentEditorSlideType}
                      supportsImageEditor={currentEditorSlideHasImage}
                      settings={currentEditorSlideSettings}
                      imagePanelOpen={editorImagePanelIndex === editorSlideIndex}
                      isUploadingImage={editorUploadingIndex === editorSlideIndex}
                      isRegeneratingSlide={regenerateSlideMutation.isPending}
                      isRegeneratingText={regenerateSlideTextMutation.isPending}
                      isRegeneratingImage={regenerateSlideImageMutation.isPending}
                      onToggleImagePanel={() =>
                        setEditorImagePanelIndex(
                          editorImagePanelIndex === editorSlideIndex ? null : editorSlideIndex
                        )
                      }
                      onReset={resetCurrentSlideEditorSettings}
                      onRegenerateSlide={handleRegenerateCurrentSlide}
                      onRegenerateText={handleRegenerateCurrentSlideText}
                      onRegenerateImage={handleRegenerateCurrentSlideImage}
                      onTitleChange={(value) =>
                        handleEditorSlideText(editorSlideIndex, "title", value)
                      }
                      onBodyChange={(value) =>
                        handleEditorSlideText(editorSlideIndex, "body", value)
                      }
                      onApplyImageUrl={(url) =>
                        handleEditorSlideImageUrl(editorSlideIndex, url)
                      }
                      onUploadImage={(e) => handleEditorUploadImage(e, editorSlideIndex)}
                      onSettingChange={(key, value) =>
                        handleEditorSlideSetting(editorSlideIndex, key, value)
                      }
                    />
                  ) : null}

                  {/* Gancho */}
                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-[30px] border border-border/40 bg-background/80 p-5 shadow-sm">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Gancho</p>
                      <Textarea
                        ref={editorPrimaryFieldRef}
                        value={editorDraft.hook}
                        onChange={(e) => handleEditorField("hook", e.target.value)}
                        className="min-h-[120px] resize-none rounded-2xl border-border/50 bg-background/70 text-sm"
                      />
                    </div>

                    <div className="rounded-[30px] border border-border/40 bg-background/80 p-5 shadow-sm">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">CTA final</p>
                      <Textarea
                        value={editorDraft.finalCta}
                        onChange={(e) => handleEditorField("finalCta", e.target.value)}
                        className="min-h-[120px] resize-none rounded-2xl border-border/50 bg-background/70 text-sm"
                      />
                    </div>
                  </div>

                  <div className="rounded-[30px] border border-border/40 bg-background/80 p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Legenda</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-[11px]"
                        onClick={handleRegenerateCaptionAndCta}
                        disabled={regenerateCaptionMutation.isPending}
                      >
                        {regenerateCaptionMutation.isPending ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Atualizar legenda + CTA
                      </Button>
                    </div>
                    <Textarea
                      value={editorDraft.caption}
                      onChange={(e) => handleEditorField("caption", e.target.value)}
                      className="min-h-[160px] resize-none rounded-2xl border-border/50 bg-background/70 text-sm"
                    />
                  </div>

                  {/* Slides */}
                  <div className="hidden" aria-hidden="true">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Slides</p>
                    {editorDraft.slides.map((slide, index) => (
                      <div
                        key={index}
                        className={cn(
                          "rounded-[28px] border bg-background/60 p-5 transition-all",
                          editorSlideIndex === index ? "border-primary/40" : "border-border/40"
                        )}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setEditorSlideIndex(index)}
                            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold">
                              {index + 1}
                            </span>
                            Slide {index + 1}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditorImagePanelIndex(editorImagePanelIndex === index ? null : index)
                            }
                            className="flex items-center gap-1.5 rounded-xl border border-border/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
                          >
                            {editorUploadingIndex === index ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Trocar imagem
                          </button>
                        </div>

                        {editorImagePanelIndex === index && (
                          <div className="mb-4 space-y-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4">
                            <p className="text-[11px] font-medium text-muted-foreground">
                              Cole uma URL ou faça upload
                            </p>
                            <div className="flex gap-2">
                              <Input
                                placeholder="https://..."
                                className="h-9 rounded-xl border-border/50 bg-background/70 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const url = (e.target as HTMLInputElement).value.trim();
                                    if (url) handleEditorSlideImageUrl(index, url);
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 shrink-0 rounded-xl text-xs"
                                onClick={(e) => {
                                  const inp = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  const url = inp?.value.trim();
                                  if (url) handleEditorSlideImageUrl(index, url);
                                }}
                              >
                                OK
                              </Button>
                            </div>
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/40 bg-background/70 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-border hover:text-foreground">
                              <Upload className="h-3.5 w-3.5" />
                              Upload de arquivo
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleEditorUploadImage(e, index)}
                              />
                            </label>
                          </div>
                        )}

                        <div className="mb-3">
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Título
                          </p>
                          <Input
                            value={slide.title}
                            onChange={(e) => handleEditorSlideText(index, "title", e.target.value)}
                            className="h-9 rounded-xl border-border/50 bg-background/70 text-sm"
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Corpo
                          </p>
                          <Textarea
                            value={slide.body}
                            onChange={(e) => handleEditorSlideText(index, "body", e.target.value)}
                            className="min-h-[80px] resize-none rounded-xl border-border/50 bg-background/70 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

              <div className="shrink-0 border-t border-border/30 bg-background/95 px-5 py-4 backdrop-blur sm:px-6 lg:px-7">
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    onClick={handleSaveEditor}
                    disabled={updateContentMutation.isPending}
                    className="min-w-[190px] gap-2 border-0 bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white hover:opacity-90"
                  >
                    {updateContentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Salvar alterações
                  </Button>
                  <Button
                    variant="outline"
                    onClick={closeEditor}
                    disabled={updateContentMutation.isPending}
                    className="min-w-[140px]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Import Images Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setImportDialogOpen(false);
            setImportSlides([]);
            setImportTopic("");
            setImportHook("");
            setImportCaption("");
            setImportCta("");
          }
        }}
      >
        <DialogContent className="w-[min(96vw,780px)] max-w-none overflow-hidden border-border/50 bg-background p-0">
          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b border-border/30 p-6">
              <DialogTitle className="text-xl font-semibold">Importar imagens do computador</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                Selecione até 10 imagens. Elas serão salvas como carrossel e podem ser postadas direto no Instagram.
              </DialogDescription>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* File picker */}
              <div>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImportFileChange}
                />
                {importSlides.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border/50 bg-muted/20 p-10 text-center transition hover:border-primary/40 hover:bg-muted/30"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Clique para selecionar imagens</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — até 10 imagens</p>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {importSlides.map((slide, index) => (
                        <div key={index} className="group relative">
                          <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-border/40 bg-muted">
                            <img
                              src={slide.dataUrl}
                              alt={slide.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setImportSlides((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <p className="mt-1.5 truncate text-center text-[11px] text-muted-foreground">
                            {index + 1}. {slide.fileName}
                          </p>
                        </div>
                      ))}
                      {importSlides.length < 10 && (
                        <button
                          type="button"
                          onClick={() => importFileInputRef.current?.click()}
                          className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/40 bg-muted/20 text-center transition hover:border-primary/40"
                        >
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">Adicionar</span>
                        </button>
                      )}
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      {importSlides.length}/10 imagens
                    </p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tema <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="Ex: Lançamento do produto X"
                    value={importTopic}
                    onChange={(e) => setImportTopic(e.target.value)}
                    className="rounded-2xl border-border/50 bg-background/70"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Gancho / Título do post
                  </label>
                  <Input
                    placeholder="Ex: Descubra o segredo..."
                    value={importHook}
                    onChange={(e) => setImportHook(e.target.value)}
                    className="rounded-2xl border-border/50 bg-background/70"
                  />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Legenda
                    </label>
                    <button
                      type="button"
                      disabled={importSlides.length === 0 || generateCaptionMutation.isPending}
                      onClick={() => {
                        const first = importSlides[0];
                        if (first) generateCaptionMutation.mutate({ imageDataUrl: first.dataUrl });
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-border/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                    >
                      {generateCaptionMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      Gerar com IA
                    </button>
                  </div>
                  <Textarea
                    placeholder="Legenda para o post no Instagram..."
                    value={importCaption}
                    onChange={(e) => setImportCaption(e.target.value)}
                    className="min-h-[80px] resize-none rounded-2xl border-border/50 bg-background/70 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    CTA final
                  </label>
                  <Input
                    placeholder="Ex: Salve para não esquecer!"
                    value={importCta}
                    onChange={(e) => setImportCta(e.target.value)}
                    className="rounded-2xl border-border/50 bg-background/70"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-border/30 p-6">
              <Button
                onClick={handleImportSubmit}
                disabled={importUploading || !importTopic.trim() || importSlides.length === 0}
                className="gap-2 border-0 bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white hover:opacity-90"
              >
                {importUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Salvar carrossel
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(false)}
                disabled={importUploading}
              >
                Cancelar
              </Button>
            </div>
          </div>
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
