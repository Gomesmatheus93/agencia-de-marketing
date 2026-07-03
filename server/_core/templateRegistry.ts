/**
 * Template Registry — Fase 2
 *
 * Define a biblioteca de templates de carrossel disponiveis na plataforma.
 * Cada TemplateDefinition descreve estrutura de conteudo + identidade visual base.
 * O renderizador (Fase 3) consome esses dados para produzir slides visuais.
 *
 * Tipos compartilhados vivem em shared/_core/templateTypes.ts (importaveis pelo client).
 */

export type {
  CarouselBlockType,
  ImageSlot,
  SlideRole,
  SlideDefinition,
  TemplatePalette,
  TemplateDefinition,
} from '@shared/_core/templateTypes';

import type { CarouselBlockType, TemplateDefinition } from '@shared/_core/templateTypes';

// ─── Registry ─────────────────────────────────────────────────────────────────

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  // ── 1. Flávio Vasconcelos — Coaching & Liderança ───────────────────────────
  {
    id: "flavio-premium",
    name: "Flávio Premium",
    description: "Editorial inspirador em azul-marinho e dourado. Tom de autoridade em coaching e liderança.",
    niches: ["coaching", "liderança", "empreendedorismo", "desenvolvimento pessoal", "carreira"],
    compatibleBlockTypes: ["hook", "quote", "comparison", "list_item", "cta"],
    slideCount: { min: 5, max: 10, recommended: 7 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "hero",     styleHints: { layout: "hero-top",      emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "quote",      imageSlot: "portrait", styleHints: { layout: "centered",      emphasis: "body",  textSize: "lg" } },
      { role: "development", preferredBlockType: "comparison",                        styleHints: { layout: "split",         emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "list_item",                         styleHints: { layout: "left",          emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                         styleHints: { layout: "centered",      emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                               styleHints: { layout: "centered",      emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#0f172a",
      surface:    "#1e293b",
      primary:    "#c9a227",
      accent:     "#2196F3",
      text:       "#f8fafc",
      textMuted:  "#94a3b8",
    },
    profileId: "flavio",
  },

  // ── 2. KrythosLab — Tech Dark ───────────────────────────────────────────────
  {
    id: "krythos-tech-dark",
    name: "Krythos Tech Dark",
    description: "Visual tech dark com ciano neon. Linguagem de agência digital criativa para devs e founders.",
    niches: ["marketing digital", "tecnologia", "SaaS", "agência digital", "desenvolvimento", "startups"],
    compatibleBlockTypes: ["hook", "stat", "list_item", "comparison", "cta"],
    slideCount: { min: 5, max: 10, recommended: 8 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "abstract",    styleHints: { layout: "centered",      emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "list_item",                            styleHints: { layout: "left",          emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "comparison",                           styleHints: { layout: "split",         emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                            styleHints: { layout: "centered",      emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                                  styleHints: { layout: "centered",      emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#0d1117",
      surface:    "#161b22",
      primary:    "#29d9ff",
      accent:     "#58a6ff",
      text:       "#f0f6fc",
      textMuted:  "#8b949e",
    },
    profileId: "krythos",
  },

  // ── 3. Alle Energia — Laranja B2C ──────────────────────────────────────────
  {
    id: "alle-energia-laranja",
    name: "Alle Energia — Laranja",
    description: "Visual vibrante em laranja. Linguagem acessível focada em economia na conta de luz para consumidores.",
    niches: ["energia solar", "sustentabilidade", "economia doméstica", "residencial", "energia"],
    compatibleBlockTypes: ["hook", "stat", "comparison", "list_item", "cta"],
    slideCount: { min: 5, max: 8, recommended: 6 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "hero",        styleHints: { layout: "hero-top",      emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "comparison",                           styleHints: { layout: "split",         emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "list_item",                            styleHints: { layout: "left",          emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                            styleHints: { layout: "centered",      emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                                  styleHints: { layout: "centered",      emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#1a0a00",
      surface:    "#2d1400",
      primary:    "#F47B20",
      accent:     "#FFB347",
      text:       "#fff8f0",
      textMuted:  "#d4a574",
    },
    profileId: "alle-laranja",
  },

  // ── 4. Alle Energia — Roxo Premium B2B ────────────────────────────────────
  {
    id: "alle-energia-roxo",
    name: "Alle Energia — Roxo Premium",
    description: "Visual premium em roxo com acentos laranja. Tom confiável para empresas e tomadores de decisão.",
    niches: ["energia solar", "sustentabilidade", "B2B", "empresas", "energia", "eficiência energética"],
    compatibleBlockTypes: ["hook", "stat", "quote", "comparison", "cta"],
    slideCount: { min: 5, max: 8, recommended: 7 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "hero",        styleHints: { layout: "hero-top",      emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "quote",      imageSlot: "portrait",    styleHints: { layout: "centered",      emphasis: "body",  textSize: "lg" } },
      { role: "development", preferredBlockType: "comparison",                           styleHints: { layout: "split",         emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                            styleHints: { layout: "centered",      emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                                  styleHints: { layout: "centered",      emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#1a0a2e",
      surface:    "#2d1060",
      primary:    "#7B2FBE",
      accent:     "#F47B20",
      text:       "#f5f0ff",
      textMuted:  "#c4a8e0",
    },
    profileId: "alle-roxo",
  },

  // ── 5. Alle Energia — Minimalista Premium ─────────────────────────────────
  {
    id: "alle-energia-minimalista",
    name: "Alle Energia — Minimalista",
    description: "Layout editorial minimalista adaptado para Alle Energia. Roxo escuro com acentos laranja, muito respiro.",
    niches: ["energia solar", "sustentabilidade", "premium", "energia", "empresas"],
    compatibleBlockTypes: ["hook", "stat", "list_item", "comparison", "cta"],
    slideCount: { min: 5, max: 8, recommended: 6 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "hero",        styleHints: { layout: "hero-top",      emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "list_item",                            styleHints: { layout: "centered",      emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                            styleHints: { layout: "centered",      emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                                  styleHints: { layout: "centered",      emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#44015e",
      surface:    "#7c00ae",
      primary:    "#ff6600",
      accent:     "#cc44ff",
      text:       "#ffffff",
      textMuted:  "#e0b3ff",
    },
    profileId: "alle-minimalista",
  },

  // ── 6. Claude Minimalista — Editorial Genérico ────────────────────────────
  {
    id: "claude-editorial",
    name: "Claude Minimalista",
    description: "Editorial minimalista premium: fundo preto absoluto, tipografia bold, muito respiro. Funciona para qualquer nicho.",
    niches: ["genérico", "editorial", "marketing", "coaching", "negócios", "tecnologia", "saúde", "finanças"],
    compatibleBlockTypes: ["hook", "list_item", "quote", "stat", "comparison", "cta"],
    slideCount: { min: 5, max: 10, recommended: 7 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "hero",     styleHints: { layout: "hero-top",  emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "list_item",                         styleHints: { layout: "centered",  emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "abstract", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "comparison",                        styleHints: { layout: "split",     emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                         styleHints: { layout: "centered",  emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                               styleHints: { layout: "centered",  emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#050505",
      surface:    "#111111",
      primary:    "#ffffff",
      accent:     "#555555",
      text:       "#ffffff",
      textMuted:  "#888888",
    },
    profileId: "claude-minimalista",
  },

  // ── 7. BrandsDecoded — Editorial de Mercado ───────────────────────────────
  {
    id: "brandsdecoded-editorial",
    name: "BrandsDecoded Editorial",
    description: "Copy provocadora, autoridade imediata. Headlines memoráveis. Diagnóstico de mercado, não post motivacional.",
    niches: ["branding", "marketing", "negócios", "análise de mercado", "estratégia", "empreendedorismo"],
    compatibleBlockTypes: ["hook", "quote", "comparison", "stat", "list_item", "cta"],
    slideCount: { min: 5, max: 10, recommended: 8 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "abstract",    styleHints: { layout: "centered",      emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "quote",                                styleHints: { layout: "centered",      emphasis: "body",  textSize: "lg" } },
      { role: "development", preferredBlockType: "comparison",                           styleHints: { layout: "split",         emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "list_item",                            styleHints: { layout: "left",          emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                            styleHints: { layout: "centered",      emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                                  styleHints: { layout: "centered",      emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#080808",
      surface:    "#141414",
      primary:    "#ffffff",
      accent:     "#c9a227",
      text:       "#f5f5f5",
      textMuted:  "#777777",
    },
    profileId: "brandsdecoded-claude",
  },

  // ── 8. NEW: Checklist Visual — Fitness / Imóveis / Saúde ──────────────────
  {
    id: "checklist-visual",
    name: "Checklist Visual",
    description: "Carrossel estilo lista de dicas com estética de checklist. Alto índice de salvamento. Ideal para fitness, imóveis, saúde e bem-estar.",
    niches: ["fitness", "saúde", "bem-estar", "imóveis", "nutrição", "educação", "lifestyle", "produtividade"],
    compatibleBlockTypes: ["hook", "list_item", "stat", "cta"],
    slideCount: { min: 5, max: 8, recommended: 6 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "hero",        styleHints: { layout: "hero-top",  emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "list_item",                            styleHints: { layout: "left",      emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "list_item",                            styleHints: { layout: "left",      emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "saveable",    preferredBlockType: "list_item",                            styleHints: { layout: "centered",  emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                                  styleHints: { layout: "centered",  emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#0f1a0f",
      surface:    "#1a2e1a",
      primary:    "#4ade80",
      accent:     "#86efac",
      text:       "#f0fdf4",
      textMuted:  "#86efac",
    },
  },

  // ── 9. NEW: Data Story — Energia / Finanças / Dados ───────────────────────
  {
    id: "data-story",
    name: "Data Story",
    description: "Storytelling baseado em dados: números grandes, comparações de impacto. Ideal para energia, finanças e qualquer nicho data-driven.",
    niches: ["energia", "finanças", "investimentos", "dados", "economia", "tecnologia", "sustentabilidade", "mercado"],
    compatibleBlockTypes: ["hook", "stat", "comparison", "list_item", "cta"],
    slideCount: { min: 5, max: 9, recommended: 7 },
    slides: [
      { role: "hook",        preferredBlockType: "hook",       imageSlot: "abstract",    styleHints: { layout: "centered",      emphasis: "title", textSize: "xl" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "comparison",                           styleHints: { layout: "split",         emphasis: "body",  textSize: "md" } },
      { role: "development", preferredBlockType: "stat",       imageSlot: "data_visual", styleHints: { layout: "value-focused", emphasis: "value", textSize: "xl" } },
      { role: "development", preferredBlockType: "comparison",                           styleHints: { layout: "split",         emphasis: "body",  textSize: "md" } },
      { role: "saveable",    preferredBlockType: "list_item",                            styleHints: { layout: "centered",      emphasis: "body",  textSize: "sm" } },
      { role: "cta",         preferredBlockType: "cta",                                  styleHints: { layout: "centered",      emphasis: "title", textSize: "lg" } },
    ],
    palette: {
      background: "#050b14",
      surface:    "#0d1f35",
      primary:    "#38bdf8",
      accent:     "#f59e0b",
      text:       "#f0f9ff",
      textMuted:  "#7dd3fc",
    },
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Busca template por ID. Retorna undefined se não encontrado. */
export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === id);
}

/**
 * Filtra templates compatíveis com um nicho/indústria.
 * Matching case-insensitive, parcial (ex: "energia solar" bate em "energia").
 */
export function getTemplatesForNiche(industry: string): TemplateDefinition[] {
  const lower = industry.toLowerCase();
  return TEMPLATE_REGISTRY.filter((t) =>
    t.niches.some(
      (n) => n.toLowerCase().includes(lower) || lower.includes(n.toLowerCase())
    )
  );
}

/**
 * Sugere o template mais adequado para um conjunto de tipos de bloco gerados.
 * Prioriza o template com maior sobreposição de compatibleBlockTypes.
 * Em caso de empate, prefere templates com profileId definido.
 */
export function suggestTemplate(
  blockTypes: CarouselBlockType[],
  industry?: string
): TemplateDefinition {
  const pool = industry ? getTemplatesForNiche(industry) : TEMPLATE_REGISTRY;
  const candidates = pool.length > 0 ? pool : TEMPLATE_REGISTRY;

  const scored = candidates.map((t) => {
    const overlap = blockTypes.filter((b) =>
      t.compatibleBlockTypes.includes(b)
    ).length;
    return { template: t, score: overlap };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Em empate: prefere template com profileId (mais personalizado)
    return (b.template.profileId ? 1 : 0) - (a.template.profileId ? 1 : 0);
  });

  return scored[0]!.template;
}