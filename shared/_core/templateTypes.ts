/**
 * Template type definitions — shared between server and client.
 * No runtime dependencies (no Zod, no DB). Pure TypeScript interfaces.
 */

// ─── Block types ──────────────────────────────────────────────────────────────

export type CarouselBlockType =
  | "hook"
  | "list_item"
  | "stat"
  | "quote"
  | "comparison"
  | "cta";

export type ImageSlot =
  | "hero"
  | "background"
  | "portrait"
  | "product"
  | "data_visual"
  | "abstract";

// ─── Content block (what Claude returns, loose) ───────────────────────────────

export type ContentBlock = {
  type?: string;
  title?: string;
  body?: string;
  value?: string;
  label?: string;
  items?: string[];
  compareA?: string;
  compareB?: string;
  imageSlot?: string;
  imagePrompt?: string;
  imageSearchQuery?: string;
  highlightWords?: string[];
};

// ─── Slide role ───────────────────────────────────────────────────────────────

export type SlideRole = "hook" | "development" | "saveable" | "cta";

// ─── Slide definition ─────────────────────────────────────────────────────────

export type SlideDefinition = {
  role: SlideRole;
  preferredBlockType: CarouselBlockType;
  imageSlot?: ImageSlot;
  styleHints?: {
    textSize?: "xl" | "lg" | "md" | "sm";
    layout?: "centered" | "left" | "split" | "hero-top" | "value-focused";
    emphasis?: "title" | "body" | "value" | "image";
  };
};

// ─── Palette ──────────────────────────────────────────────────────────────────

export type TemplatePalette = {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  textMuted: string;
};

// ─── Template definition ──────────────────────────────────────────────────────

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  niches: string[];
  compatibleBlockTypes: CarouselBlockType[];
  slideCount: { min: number; max: number; recommended: number };
  slides: SlideDefinition[];
  palette: TemplatePalette;
  profileId?: string;
};