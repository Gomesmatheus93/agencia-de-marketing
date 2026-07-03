/**
 * Carousel Content Schema — Fase 1
 *
 * Representa o CONTEÚDO de um carrossel de forma genérica e independente de template visual.
 * O Claude gera esses blocos semânticos; o template consome e renderiza como quiser.
 */
import { z } from "zod";

// ─── Block types ──────────────────────────────────────────────────────────────

export const CarouselBlockTypeSchema = z.enum([
  "hook",        // Slide 1 — pergunta gancho, cria lacuna de informação
  "list_item",   // Checklist, dicas, framework, resumo salvável
  "stat",        // Dado numérico destacado (value + label)
  "quote",       // Citação ou afirmação de autoridade
  "comparison",  // Contraste antes × depois ou opção A × B
  "cta",         // Chamada para ação final (último slide)
]);

export type CarouselBlockType = z.infer<typeof CarouselBlockTypeSchema>;

// ─── Image slot identifiers ───────────────────────────────────────────────────

export const ImageSlotSchema = z.enum([
  "hero",         // Imagem principal de capa/abertura (foto editorial do tema)
  "background",   // Plano de fundo do slide
  "portrait",     // Retrato humano contextualizado
  "product",      // Produto ou objeto central
  "data_visual",  // Gráfico, infográfico, dashboard, número visual
  "abstract",     // Composição abstrata, textura, símbolo
]);

export type ImageSlot = z.infer<typeof ImageSlotSchema>;

// ─── Content block ────────────────────────────────────────────────────────────

export const CarouselContentBlockSchema = z.object({
  type: CarouselBlockTypeSchema,
  // Universal fields
  title: z.string().optional(),
  body: z.string().optional(),        // texto principal (≤150 chars); fallback para todos os tipos
  highlightWords: z.array(z.string()).optional(),
  // stat-specific
  value: z.string().optional(),       // ex: "38%", "R$ 2.400"
  label: z.string().optional(),       // o que a métrica representa
  // list_item-specific
  items: z.array(z.string()).optional(), // máx 6 tópicos curtos
  // comparison-specific
  compareA: z.string().optional(),    // lado A (antes, opção ruim, situação atual)
  compareB: z.string().optional(),    // lado B (depois, opção melhor, solução)
  // Image slot (guia geração DALL-E + busca de stock)
  imageSlot: ImageSlotSchema.optional(),
  imagePrompt: z.string().optional(),       // prompt detalhado em inglês para DALL-E
  imageSearchQuery: z.string().optional(),  // palavras-chave em inglês para foto stock
});

export type CarouselContentBlock = z.infer<typeof CarouselContentBlockSchema>;

// ─── Full carousel content ────────────────────────────────────────────────────

export const CarouselContentSchema = z.object({
  carouselTitle: z.string(),
  caption: z.string(),
  imageSearchQuery: z.string(),   // consulta global em inglês para imagem editorial do tema
  hashtags: z.array(z.string()),
  cta: z.string(),
  blocks: z.array(CarouselContentBlockSchema),
});

export type CarouselContent = z.infer<typeof CarouselContentSchema>;

// ─── Loose payload type (what Claude actually returns — all fields optional) ──

export type CarouselContentPayload = {
  carouselTitle?: string;
  caption?: string;
  imageSearchQuery?: string;
  hashtags?: string[];
  cta?: string;
  blocks?: Array<{
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
  }>;
};

// ─── Utility: resolve the "body" string from a block's typed fields ───────────

type ContentBlock = NonNullable<CarouselContentPayload["blocks"]>[number];

export function resolveBlockBody(block: ContentBlock): string {
  if (block.body?.trim()) return block.body.trim();

  switch (block.type) {
    case "list_item":
      if (block.items?.length) return block.items.join(" • ");
      break;
    case "stat":
      if (block.value) {
        return block.label ? `${block.value} — ${block.label}` : block.value;
      }
      break;
    case "comparison":
      if (block.compareA && block.compareB) {
        return `${block.compareA} × ${block.compareB}`;
      }
      break;
  }

  return "";
}