import { generateImage } from "./imageGeneration";
import {
  invokeAnthropicLLM,
  parseClaudeJsonResponse,
  buildAnthropicImageContent,
  type AnthropicContent,
} from "./anthropicClient";
import { ENV } from "./env";

// ─── Profile contexts ─────────────────────────────────────────────────────────

const PROFILE_CONTEXTS: Record<string, string> = {
  flavio: `Perfil: Flávio Vasconcelos (@comflavio). Visual premium em azul-marinho (#0f172a) com acentos dourados (#c9a227) e azul vibrante (#2196F3). Tom: inspirador, direto, autoridade em coaching e liderança. Sem gírias. Frases curtas e impactantes. Público: empreendedores e líderes. PROIBIDO: clichês de autoajuda, linguagem casual, emojis.`,
  krythos: `Perfil: KrythosLab (@krythoslab). Visual tech dark: fundo preto (#0d1117), acentos ciano neon (#29d9ff). Tom: técnico, inovador, direto. Linguagem de agência digital criativa. Pode usar termos em inglês quando pertinente. Público: founders, devs, designers e profissionais de marketing digital. PROIBIDO: linguagem muito formal, termos genéricos sem substância.`,
  "alle-laranja": `Perfil: Alle Energia (@alleenergia). Visual em laranja vibrante (#F47B20) com formas dinâmicas e bold. Tom: próximo, acessível, econômico. Destaca benefícios práticos na conta de luz. Linguagem simples para o consumidor médio. Público: donos de imóvel, pequenos empresários. PROIBIDO: jargão técnico, linguagem muito formal.`,
  "alle-roxo": `Perfil: Alle Energia (@alleenergia) — variante premium. Visual em roxo intenso (#7B2FBE) com acentos laranja. Tom: confiável, moderno, premium. Destaca credibilidade e inovação. Público: empresas médias e grandes, tomadores de decisão em energia. PROIBIDO: linguagem muito popular, imprecisão técnica.`,
  "alle-minimalista": `Perfil: Alle Energia Minimalista (@alleenergia). Use o mesmo layout editorial minimalista do modelo Claude Minimalista, adaptado para a marca Alle Energia. Paleta obrigatoria: fundo roxo escuro #44015e, paines/areas de apoio em #7c00ae, acentos em laranja #ff6600 e texto branco #ffffff. Composicao centrada, limpa, premium e com muito respiro. Primeiro slide com imagem destacada e titulo forte em caixa alta. Slides internos com titulo centralizado, texto curto e bloco visual limpo. Ultimo slide com CTA elegante e direto. Tom: confiavel, estrategico, claro e comercial. Frases curtas. Sem emojis. PROIBIDO: excesso de texto, floreios visuais, jargao tecnico desnecessario, degrades chamativos fora da paleta e promessas vagas.`,
  "claude-minimalista": `Perfil: Claude Minimalista (@claude.design). Visual editorial minimalista inspirado em ferramentas premium de carrossel: fundo preto absoluto (#050505), molduras cinza-escuro, tipografia branca bold, composicao centrada e muito respiro. Primeiro slide com imagem destacada no topo e titulo forte em caixa alta. Slides internos com titulo centralizado, texto curto e bloco visual limpo. Ultimo slide com CTA elegante e direto. Tom: estrategico, seco, confiante e rapido. Frases curtas. Sem emojis. PROIBIDO: excesso de texto, floreios visuais, jargao vazio, degrades chamativos e promessas genericas.`,
};

const DESIGNER_AGENT_SYSTEM_PROMPT = `
Você é um Agente Designer Sênior da agência KrythosLab, especializado em carrosséis profissionais para Instagram.

Sua missão é transformar um template base enviado pelo usuário em um carrossel visualmente natural, estratégico e profissional, como se tivesse sido criado por um designer humano experiente.

REGRAS PRINCIPAIS:
1. Não copie o template de forma rígida. Use-o como referência de estrutura, estilo e intenção visual.
2. Preserve a identidade visual do template: cores, hierarquia, estilo gráfico, ritmo visual e proporção.
3. Ajuste textos, quebras de linha, espaçamentos e composição para parecer natural.
4. Evite aparência genérica, robótica ou "feita por IA".
5. Crie layouts com boa hierarquia, contraste, respiro, alinhamento e equilíbrio.
6. O conteúdo deve ser adaptado para carrossel, com leitura rápida e impacto visual.
7. Nunca sobrecarregue os slides com texto.
8. Caso o texto enviado seja fraco, reescreva para ficar mais claro, persuasivo e profissional.
9. O primeiro slide deve ter um gancho forte.
10. Os slides intermediários devem desenvolver a ideia com fluidez.
11. O último slide deve ter um CTA claro e elegante.

COMPORTAMENTO:
- Pense como designer, copywriter e social media sênior.
- Seja criterioso com estética e clareza visual.
- Entregue algo pronto para produção.
- Quando faltar informação, assuma uma solução profissional em vez de travar.

PROIBIDO nos textos: "Você sabia?", "No mundo atual", "Em um cenário cada vez mais digital", clichês genéricos de autoajuda.

Quando existir template visual enviado, preserve essa família visual como referência.
Quando receber "=== Pesquisa sobre o tema ===", use os dados para enriquecer slides de desenvolvimento. Incorpore naturalmente, sem citar fonte.

Retorne APENAS o JSON abaixo, sem texto antes ou depois:
{
  "carouselTitle": "título interno descritivo",
  "caption": "legenda completa para o post no Instagram",
  "imageSearchQuery": "3 a 8 palavras em inglês para buscar imagem editorial do tema central",
  "hashtags": ["hashtag1", "hashtag2"],
  "cta": "chamada para ação final",
  "slides": [
    {
      "id": 1,
      "type": "hook",
      "title": "título curto do slide",
      "text": "texto principal do slide (até 150 chars)",
      "shortText": "versão ultra-resumida (até 50 chars)",
      "imagePrompt": "detailed English prompt for the slide hero image — lighting, composition, mood",
      "backgroundPrompt": "English prompt for slide background — gradient, texture or photo",
      "visualDirection": "explicação curta do visual esperado para o designer",
      "layoutNotes": "observações de layout",
      "imageSearchQuery": "4 a 10 palavras em inglês para buscar imagem deste slide",
      "highlightWords": ["palavra-chave1", "palavra-chave2"],
      "editableFields": { "title": true, "text": true, "image": true, "background": true, "cta": false }
    }
  ],
  "generalDesignRules": ["regra geral 1"],
  "qualityChecklist": {
    "textsFitTemplate": true,
    "strongHook": true,
    "clearProgression": true,
    "profileToneRespected": true,
    "formatRespected": true,
    "editableOutput": true
  }
}
`;

// ─── Topic Research (Serper — Google Search) ─────────────────────────────────

type SerperOrganicResult = {
  title?: string;
  snippet?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  answerBox?: { answer?: string; snippet?: string; title?: string };
  knowledgeGraph?: { description?: string; title?: string };
};

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function researchTopicContext(topic: string): Promise<string | null> {
  if (!ENV.serperApiKey) return null;

  try {
    const res = await fetchWithTimeout(
      "https://google.serper.dev/search",
      {
        method: "POST",
        headers: {
          "X-API-KEY": ENV.serperApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: topic, gl: "br", hl: "pt", num: 6 }),
      },
      3000
    );
    if (!res.ok) return null;

    const data = (await res.json()) as SerperResponse;
    const parts: string[] = [];

    // Answer box ou Knowledge Graph têm o melhor resumo direto
    const directAnswer =
      data.answerBox?.answer ||
      data.answerBox?.snippet ||
      data.knowledgeGraph?.description;
    if (directAnswer) {
      parts.push(`Resumo: ${directAnswer.replace(/\n/g, " ").trim()}`);
    }

    // Top resultados orgânicos
    const organic = (data.organic ?? [])
      .slice(0, 5)
      .map((r) => {
        const title = r.title?.trim() ?? "";
        const snippet = r.snippet?.replace(/\n/g, " ").trim() ?? "";
        return title && snippet ? `• ${title}: ${snippet}` : snippet || title;
      })
      .filter(Boolean);

    parts.push(...organic);

    if (parts.length === 0) return null;

    return `[Google — "${topic}"]\n${parts.join("\n")}`;
  } catch {
    return null;
  }
}

// ─── Style Guide ──────────────────────────────────────────────────────────────

const STYLE_GUIDE: Record<string, string> = {
  signature: "Visual premium, contrastado e moderno, com atmosfera roxa profunda e acentos laranja vibrantes.",
  minimal: "Visual limpo, elegante e direto ao ponto.",
  bold: "Visual forte, marcante e com frases de impacto.",
  gradient: "Visual moderno, energico e com sensacao de movimento.",
  corporate: "Visual profissional, confiavel e orientado a autoridade.",
  vibrant: "Visual vibrante, expansivo e com bastante energia.",
  dark: "Visual sofisticado, contrastado e mais dramatico.",
};

const FALLBACK_CTA = "Salve este carrossel e compartilhe com quem precisa ver isso hoje.";

function assertAnthropicCarouselConfigured() {
  if (!ENV.anthropicApiKey.trim()) {
    throw new Error(
      "ANTHROPIC_API_KEY e obrigatoria para gerar ou regenerar carrosseis. A OpenAI continua sendo usada apenas para as imagens."
    );
  }
}

export type CarouselAgentInput = {
  topic: string;
  slideCount: number;
  carouselFormat?: "feed" | "story";
  style: string;
  profileId?: string;
  coverImageDataUrl?: string;
  coverImageUrl?: string;
  templateName?: string;
  templateStyleBrief?: string;
  templateImageDataUrl?: string;
  templateImageUrl?: string;
  useAiImages?: boolean;
  articleContext?: string;
};

export type SlideEditableFields = {
  title: boolean;
  text: boolean;
  image: boolean;
  background: boolean;
  cta: boolean;
};

export type CarouselAgentSlide = {
  title: string;
  body: string;
  imageUrl?: string;
  slideType?: "hook" | "development" | "cta";
  shortText?: string;
  imagePrompt?: string;
  backgroundPrompt?: string;
  visualDirection?: string;
  layoutNotes?: string;
  highlightWords?: string[];
  editableFields?: SlideEditableFields;
};

export type CarouselAgentResult = {
  slides: CarouselAgentSlide[];
  coverImageUrl?: string;
  hook: string;
  caption: string;
  finalCta: string;
  hashtags?: string[];
  profileId?: string;
};

type CarouselAgentPayload = {
  carouselTitle?: string;
  caption?: string;
  imageSearchQuery?: string;
  hashtags?: string[];
  cta?: string;
  slides?: Array<{
    id?: number;
    type?: "hook" | "development" | "cta";
    title?: string;
    text?: string;
    shortText?: string;
    imagePrompt?: string;
    backgroundPrompt?: string;
    visualDirection?: string;
    layoutNotes?: string;
    imageSearchQuery?: string;
    highlightWords?: string[];
    editableFields?: SlideEditableFields;
  }>;
  generalDesignRules?: string[];
  qualityChecklist?: {
    textsFitTemplate?: boolean;
    strongHook?: boolean;
    clearProgression?: boolean;
    profileToneRespected?: boolean;
    formatRespected?: boolean;
    editableOutput?: boolean;
  };
};

type WikimediaImageInfo = {
  url?: string;
  thumburl?: string;
  mime?: string;
};

type WikimediaSearchResponse = {
  query?: {
    pages?: Record<string, { imageinfo?: WikimediaImageInfo[] }>;
  };
};

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeImageSearchQuery(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .slice(0, 120) || "professional editorial business photography"
  );
}

function buildCentralThemeImageQuery(input: {
  topic: string;
  slideTitle: string;
  imageSearchQuery: string;
}) {
  return normalizeImageSearchQuery(
    [
      input.topic,
      input.imageSearchQuery,
      input.slideTitle,
      "photorealistic editorial image",
    ].join(" ")
  );
}

async function searchUnsplashImage(query: string): Promise<string | undefined> {
  if (!ENV.unsplashAccessKey) return undefined;
  try {
    const params = new URLSearchParams({
      query: normalizeImageSearchQuery(query),
      per_page: "5",
      orientation: "portrait",
    });
    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${ENV.unsplashAccessKey}` },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { results?: Array<{ urls?: { regular?: string } }> };
    return data.results?.[0]?.urls?.regular;
  } catch {
    return undefined;
  }
}

async function searchPexelsImage(query: string): Promise<string | undefined> {
  if (!ENV.pexelsApiKey) return undefined;
  try {
    const params = new URLSearchParams({
      query: normalizeImageSearchQuery(query),
      per_page: "5",
      orientation: "portrait",
    });
    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: ENV.pexelsApiKey },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { photos?: Array<{ src?: { large?: string } }> };
    return data.photos?.[0]?.src?.large;
  } catch {
    return undefined;
  }
}

async function searchPixabayImage(query: string): Promise<string | undefined> {
  if (!ENV.pixabayApiKey) return undefined;
  try {
    const params = new URLSearchParams({
      key: ENV.pixabayApiKey,
      q: normalizeImageSearchQuery(query),
      image_type: "photo",
      orientation: "vertical",
      per_page: "5",
      safesearch: "true",
    });
    const response = await fetch(`https://pixabay.com/api/?${params}`);
    if (!response.ok) return undefined;
    const data = (await response.json()) as { hits?: Array<{ largeImageURL?: string }> };
    return data.hits?.[0]?.largeImageURL;
  } catch {
    return undefined;
  }
}

async function searchWikimediaImage(query: string) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: normalizeImageSearchQuery(query),
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "1080",
    format: "json",
    origin: "*",
  });

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: {
      "user-agent": "KrythosLab carousel image agent",
    },
  });

  if (!response.ok) return undefined;

  const data = (await response.json()) as WikimediaSearchResponse;
  const pages = Object.values(data.query?.pages || {});
  const imageInfo = pages
    .flatMap((page) => page.imageinfo || [])
    .find((info) => {
      const imageUrl = info.thumburl || info.url;
      return Boolean(imageUrl && info.mime?.startsWith("image/") && !info.mime.includes("svg"));
    });

  const imageUrl = imageInfo?.thumburl || imageInfo?.url;
  return imageUrl;
}

function buildCarouselImagePrompt(input: {
  topic: string;
  hook: string;
  slideTitle: string;
  slideBody: string;
  imageSearchQuery: string;
  slideIndex: number;
  templateName?: string;
  templateStyleBrief?: string;
}) {
  const isHook = input.slideIndex === 0;

  return [
    // ── Intent ──────────────────────────────────────────────────────────────
    "Create a photorealistic hero image for an Instagram/LinkedIn carousel slide.",
    `Portrait orientation, 2:3 aspect ratio. Topic: ${input.topic}.`,

    // ── Slide context ────────────────────────────────────────────────────────
    `Carousel hook: ${input.hook}`,
    `This slide: ${input.slideTitle}`,
    input.slideBody ? `Slide context: ${input.slideBody}` : undefined,
    `Visual direction: ${input.imageSearchQuery || input.hook}`,

    // ── Camera & lens ────────────────────────────────────────────────────────
    "Camera: full-frame mirrorless (Sony A7R V or Canon R5 equivalent). Lens: 24–50mm prime, f/1.4–f/2.8. Shallow depth of field with smooth bokeh background. Tack-sharp foreground subject.",

    // ── Lighting ─────────────────────────────────────────────────────────────
    "Lighting: dramatic professional lighting — cinematic side-light, rim-light, or motivated natural source. Deep shadows, rich midtones, controlled highlights. No flat or blown-out exposures.",

    // ── Color grade & mood ───────────────────────────────────────────────────
    "Color grade: cinematic. Deep blacks, slightly desaturated mids, selective color accents. Dark and moody overall — compatible with a dark UI overlay without losing subject legibility. Reference mood: high-end editorial magazines, Bloomberg or Wired cover photography.",

    // ── Composition ──────────────────────────────────────────────────────────
    isHook
      ? "Composition: impactful wide or medium shot. Strong visual tension. Hero subject occupies center-to-lower third, leaving the upper portion naturally dark for text overlay. Rule of thirds applied."
      : "Composition: clean medium or close-up shot. Hero subject clearly identifiable. Strong visual hierarchy. Upper area intentionally darker or uncluttered for text overlay. Rule of thirds applied.",

    // ── Template alignment ───────────────────────────────────────────────────
    input.templateName ? `Design context: ${input.templateName}` : undefined,
    input.templateStyleBrief
      ? `Visual style reference: ${input.templateStyleBrief}`
      : "Visual palette: dark navy/charcoal tones, compatible with a dark-themed carousel card design.",

    // ── Specificity requirement ──────────────────────────────────────────────
    "This image must be uniquely composed for this specific slide — not a generic stock cover. The scene, subject, and framing must directly represent the slide's message and energy.",

    // ── Reference image handling ─────────────────────────────────────────────
    "If a style reference image is provided: match its visual language, color palette, mood, depth, and finish — but generate a completely new scene aligned with this slide's content.",

    // ── Hard constraints ─────────────────────────────────────────────────────
    "Do not include: text, letters, numbers, logos, watermarks, UI elements, charts, infographics, device screens, fake typography, illustration, vector art, or cartoon style.",
    "Do not use stock-photo clichés: no random handshakes, disconnected office scenes, generic laptops, anonymous crowds, or objects unrelated to the topic.",
    "Photorealistic photography only. No AI-obvious artifacts. No oversaturated, overexposed, or HDR-style processing.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackImageDataUrl(topic: string) {
  const hue = (Math.abs(topic.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 70) + 195;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 600" data-carousel-fallback="true">
  <defs>
    <linearGradient id="fallbackBg" x1="0" y1="0" x2="1080" y2="600" gradientUnits="userSpaceOnUse">
      <stop stop-color="hsl(${hue} 34% 86%)" />
      <stop offset="0.52" stop-color="hsl(${hue} 32% 62%)" />
      <stop offset="1" stop-color="hsl(${hue} 36% 28%)" />
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="34" /></filter>
  </defs>
  <rect width="1080" height="600" fill="url(#fallbackBg)" />
  <circle cx="250" cy="210" r="160" fill="white" opacity="0.22" filter="url(#blur)" />
  <circle cx="836" cy="258" r="230" fill="black" opacity="0.16" filter="url(#blur)" />
  <path d="M0 484L180 332L342 412L528 224L742 408L928 278L1080 386V600H0V484Z" fill="hsl(${hue} 42% 18%)" opacity="0.44" />
  <path d="M0 542L264 374L456 456L646 292L842 454L1080 316V600H0V542Z" fill="hsl(${hue} 42% 10%)" opacity="0.42" />
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function decodeDataUrlPayload(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return "";

  const header = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);

  try {
    if (header.includes(";base64")) {
      return Buffer.from(body, "base64").toString("utf-8");
    }

    return decodeURIComponent(body);
  } catch {
    return "";
  }
}

function isCarouselFallbackImageUrl(imageUrl?: string) {
  if (!imageUrl || !imageUrl.startsWith("data:image/svg+xml")) {
    return false;
  }

  const payload = decodeDataUrlPayload(imageUrl);
  return payload.includes('data-carousel-fallback="true"') || payload.includes('id="fallbackBg"');
}

async function resolveCarouselCoverImage(input: {
  topic: string;
  hook: string;
  imageSearchQuery: string;
  slideTitle: string;
  slideBody: string;
  slideIndex: number;
  templateName?: string;
  templateStyleBrief?: string;
  referenceImageUrl?: string;
  useAiImages?: boolean;
}) {
  const query = buildCentralThemeImageQuery(input);

  if (input.useAiImages) {
    try {
      const generatedImage = await generateImage({
        prompt: buildCarouselImagePrompt({
          topic: input.topic,
          hook: input.hook,
          slideTitle: input.slideTitle,
          slideBody: input.slideBody,
          imageSearchQuery: query,
          slideIndex: input.slideIndex,
          templateName: input.templateName,
          templateStyleBrief: input.templateStyleBrief,
        }),
        referenceImageUrl: input.referenceImageUrl,
      });

      if (generatedImage.url) {
        return generatedImage.url;
      }
    } catch (err) {
      console.warn("[CarouselAgent] AI image generation failed, falling back to stock photos:", err);
    }
  }

  const stockSources = [
    searchUnsplashImage(query),
    searchPexelsImage(query),
    searchPixabayImage(query),
    searchWikimediaImage(query),
  ].map((p) => p.then((url) => {
    if (!url) throw new Error("no result");
    return url;
  }));

  try {
    return await Promise.any(stockSources);
  } catch {
    // all sources failed
  }

  return buildFallbackImageDataUrl(`${input.topic} ${input.slideTitle}`);
}

export async function generateCarouselWithAgent(
  input: CarouselAgentInput
): Promise<CarouselAgentResult> {
  assertAnthropicCarouselConfigured();

  const referenceImageUrl = input.coverImageDataUrl || input.coverImageUrl;
  const templateImageUrl = input.templateImageDataUrl || input.templateImageUrl;
  const styleGuide = input.templateStyleBrief?.trim()
    ? `Template escolhido: ${input.templateName || input.style}. ${input.templateStyleBrief.trim()}`
    : STYLE_GUIDE[input.style] || `Estilo visual: ${input.style}.`;

  // Use article content when provided; otherwise fall back to Google search
  const topicResearch = input.articleContext
    ? `[Notícia]\n${input.articleContext}`
    : await researchTopicContext(input.topic).catch(() => null);

  if (topicResearch) {
    console.log(`[CarouselAgent] Research context ready for topic: "${input.topic}" (source: ${input.articleContext ? "article" : "google"})`);
  }

  const lastSlideIndex = input.slideCount;

  const carouselFormat = input.carouselFormat || "feed";
  const formatInfo = carouselFormat === "story"
    ? "Story (9:16, 1080x1920) — formato vertical extendido do Instagram Stories"
    : "Feed (4:5, 1080x1350) — formato padrão de posts no feed";

  const profileContext = input.profileId
    ? PROFILE_CONTEXTS[input.profileId] ?? ""
    : "";

  const userPrompt = [
    profileContext ? `=== Perfil do Instagram ===\n${profileContext}\n` : undefined,
    `Tema do carrossel: ${input.topic}`,
    `Quantidade exata de slides: ${input.slideCount}`,
    `Formato: ${formatInfo}`,
    `Direcao visual: ${styleGuide}`,
    input.templateName ? `Nome do template visual: ${input.templateName}` : undefined,
    `MAPA DE SLIDES (siga obrigatoriamente):`,
    `  Slide 1 (id:1, type:"hook"): GANCHO — para o scroll, gera curiosidade, promessa ou dor. NAO entrega o conteudo ainda.`,
    input.slideCount > 2
      ? `  Slides 2 a ${lastSlideIndex - 1} (type:"development"): cada um aprofunda um aspecto diferente do tema com dados, contraste ou descoberta.`
      : undefined,
    `  Slide ${lastSlideIndex} (id:${lastSlideIndex}, type:"cta"): CTA DE ENGAJAMENTO — pede curtida, comentario e compartilhamento de forma natural e direta.`,
    "Gere imageSearchQuery geral em ingles (3-8 palavras) para fotografia editorial do tema central.",
    "Para cada slide, gere imageSearchQuery em ingles especifico (4-10 palavras) e imagePrompt detalhado em ingles.",
    "Nao use consultas abstratas como transformation, growth, future ou innovation sem objeto concreto do tema.",
    topicResearch
      ? `\n=== Pesquisa sobre o tema ===\nUse os fatos, dados e conceitos abaixo para enriquecer os slides de desenvolvimento. Incorpore-os naturalmente — nao cite a fonte:\n\n${topicResearch}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  // ── Build Anthropic content (supports images) ───────────────────────────────
  const anthropicParts: AnthropicContent[] = [{ type: "text", text: userPrompt }];
  if (templateImageUrl) {
    anthropicParts.push({ type: "text", text: "Template visual de referencia — preserve a familia visual." });
    const img = buildAnthropicImageContent(templateImageUrl);
    if (img) anthropicParts.push(img);
  }
  if (referenceImageUrl) {
    anthropicParts.push({ type: "text", text: "Imagem de referencia de conteudo — use quando fizer sentido." });
    const img = buildAnthropicImageContent(referenceImageUrl);
    if (img) anthropicParts.push(img);
  }

  // ── Build OpenAI content (fallback) ────────────────────────────────────────

  // ── Invoke LLM: Anthropic first, OpenAI/Gemini as fallback ─────────────────
  const raw = await invokeAnthropicLLM({
    system: DESIGNER_AGENT_SYSTEM_PROMPT,
    userContent: anthropicParts.length === 1 ? userPrompt : anthropicParts,
  });
  const parsed = parseClaudeJsonResponse<CarouselAgentPayload>(raw, { slides: [] });

  const slides = (parsed.slides || []).map((slide, index) => ({
    title: cleanText(slide?.title, `Slide ${index + 1}`),
    body: cleanText(slide?.text),
    imageSearchQuery: cleanText(slide?.imageSearchQuery),
    slideType: slide?.type,
    shortText: slide?.shortText,
    imagePrompt: slide?.imagePrompt,
    backgroundPrompt: slide?.backgroundPrompt,
    visualDirection: slide?.visualDirection,
    layoutNotes: slide?.layoutNotes,
    highlightWords: slide?.highlightWords ?? [],
    editableFields: slide?.editableFields,
  }));

  if (slides.length !== input.slideCount) {
    throw new Error("O agente nao retornou a quantidade esperada de slides");
  }

  const hook = cleanText(
    parsed.slides?.find((s) => s.type === "hook")?.title,
    slides[0]?.title || input.topic
  );
  const finalCta = cleanText(
    parsed.cta ?? parsed.slides?.find((s) => s.type === "cta")?.title,
    FALLBACK_CTA
  );
  const caption = cleanText(
    parsed.caption,
    `${hook}\n\n${slides.map((slide) => `${slide.title}: ${slide.body}`).join("\n\n")}\n\n${finalCta}`
  );
  const slidesWithImage: CarouselAgentSlide[] = await Promise.all(
    slides.map(async (slide, index) => {
      const slideImageUrl =
        referenceImageUrl ||
        (await resolveCarouselCoverImage({
          topic: input.topic,
          hook,
          imageSearchQuery: cleanText(
            slide.imageSearchQuery,
            `${parsed.imageSearchQuery || input.topic} ${slide.title}`
          ),
          slideTitle: slide.title,
          slideBody: slide.body,
          slideIndex: index,
          templateName: input.templateName,
          templateStyleBrief: input.templateStyleBrief,
          referenceImageUrl: templateImageUrl,
          useAiImages: input.useAiImages ?? false,
        }));

      return {
        title: slide.title,
        body: slide.body,
        imageUrl: slideImageUrl,
        slideType: slide.slideType,
        shortText: slide.shortText,
        imagePrompt: slide.imagePrompt,
        backgroundPrompt: slide.backgroundPrompt,
        visualDirection: slide.visualDirection,
        layoutNotes: slide.layoutNotes,
        highlightWords: slide.highlightWords,
        editableFields: slide.editableFields,
      };
    })
  );

  const sharedImageUrl =
    [referenceImageUrl, ...slidesWithImage.map((slide) => slide.imageUrl)].find(
      (imageUrl) => imageUrl && !isCarouselFallbackImageUrl(imageUrl)
    ) || undefined;

  const normalizedSlides = slidesWithImage.map((slide) => ({
    ...slide,
    imageUrl:
      slide.imageUrl && !isCarouselFallbackImageUrl(slide.imageUrl)
        ? slide.imageUrl
        : sharedImageUrl || slide.imageUrl,
  }));

  return {
    slides: normalizedSlides,
    coverImageUrl: normalizedSlides[0]?.imageUrl || sharedImageUrl || referenceImageUrl,
    hook,
    caption,
    finalCta,
    hashtags: parsed.hashtags ?? [],
    profileId: input.profileId,
  };
}

// ─── Regeneration helpers ──────────────────────────────────────────────────────

const REGEN_SYSTEM = `Você é um social media sênior e copywriter especializado em carrosséis de Instagram. Retorne APENAS JSON válido, sem texto antes ou depois.`;

async function callRegenLLM(userPrompt: string, fallback: CarouselAgentPayload): Promise<CarouselAgentPayload> {
  assertAnthropicCarouselConfigured();
  const raw = await invokeAnthropicLLM({ system: REGEN_SYSTEM, userContent: userPrompt });
  return parseClaudeJsonResponse<CarouselAgentPayload>(raw, fallback);
}

export async function regenerateSlide(params: {
  topic: string;
  hook: string;
  totalSlides: number;
  slideIndex: number;
  slideType: "hook" | "development" | "cta";
  profileId?: string;
  format?: "feed" | "story";
  style?: string;
  useAiImages?: boolean;
}): Promise<CarouselAgentSlide> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  const prompt = [
    profileCtx ? `Perfil: ${profileCtx}` : undefined,
    `Tema: ${params.topic}`,
    `Formato: ${params.format ?? "feed"}. Estilo: ${params.style ?? "signature"}.`,
    `Carrossel tem ${params.totalSlides} slides. Você deve regenerar o slide ${params.slideIndex + 1} (tipo: ${params.slideType}).`,
    `Retorne JSON com um único objeto no formato:`,
    `{"id":${params.slideIndex + 1},"type":"${params.slideType}","title":"...","text":"...","shortText":"...","imagePrompt":"...","backgroundPrompt":"...","visualDirection":"...","layoutNotes":"...","imageSearchQuery":"...","highlightWords":[],"editableFields":{"title":true,"text":true,"image":true,"background":true,"cta":false}}`,
  ].filter(Boolean).join("\n");

  const result = await callRegenLLM(prompt, {});
  const s = (result as unknown as Record<string, unknown>);

  const slideData: CarouselAgentSlide = {
    title: cleanText(s.title, `Slide ${params.slideIndex + 1}`),
    body: cleanText(s.text),
    slideType: params.slideType,
    shortText: typeof s.shortText === "string" ? s.shortText : undefined,
    imagePrompt: typeof s.imagePrompt === "string" ? s.imagePrompt : undefined,
    backgroundPrompt: typeof s.backgroundPrompt === "string" ? s.backgroundPrompt : undefined,
    visualDirection: typeof s.visualDirection === "string" ? s.visualDirection : undefined,
    layoutNotes: typeof s.layoutNotes === "string" ? s.layoutNotes : undefined,
    highlightWords: Array.isArray(s.highlightWords) ? (s.highlightWords as string[]) : [],
    editableFields: typeof s.editableFields === "object" && s.editableFields !== null
      ? (s.editableFields as SlideEditableFields)
      : { title: true, text: true, image: true, background: true, cta: false },
  };

  const imageSearchQuery = cleanText(s.imageSearchQuery, `${params.topic} ${slideData.title}`);
  slideData.imageUrl = await resolveCarouselCoverImage({
    topic: params.topic,
    hook: params.hook,
    imageSearchQuery,
    slideTitle: slideData.title,
    slideBody: slideData.body,
    slideIndex: params.slideIndex,
    useAiImages: params.useAiImages ?? false,
  });

  return slideData;
}

export async function regenerateSlideText(params: {
  topic: string;
  hook: string;
  slideType: "hook" | "development" | "cta";
  currentTitle: string;
  currentBody: string;
  profileId?: string;
  instruction?: string;
}): Promise<{ title: string; body: string; shortText: string; highlightWords: string[] }> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  const prompt = [
    profileCtx ? `Perfil: ${profileCtx}` : undefined,
    `Tema geral: ${params.topic}. Gancho do carrossel: ${params.hook}.`,
    `Slide atual (tipo: ${params.slideType}): Título: "${params.currentTitle}" | Texto: "${params.currentBody}"`,
    params.instruction ? `Instrução do usuário: ${params.instruction}` : "Melhore o texto para ser mais impactante e natural.",
    `Retorne JSON: {"title":"...","text":"...","shortText":"...","highlightWords":[]}`,
  ].filter(Boolean).join("\n");

  const result = await callRegenLLM(prompt, {});
  const s = result as unknown as Record<string, unknown>;
  return {
    title: cleanText(s.title, params.currentTitle),
    body: cleanText(s.text, params.currentBody),
    shortText: typeof s.shortText === "string" ? s.shortText : "",
    highlightWords: Array.isArray(s.highlightWords) ? (s.highlightWords as string[]) : [],
  };
}

export async function regenerateSlideImage(params: {
  topic: string;
  hook: string;
  slideTitle: string;
  slideBody: string;
  slideIndex: number;
  imagePrompt?: string;
  profileId?: string;
  useAiImages?: boolean;
}): Promise<{ imageUrl: string; imagePrompt: string }> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  let imagePrompt = params.imagePrompt ?? "";

  if (!imagePrompt) {
    const prompt = [
      profileCtx ? `Perfil visual: ${profileCtx}` : undefined,
      `Tema: ${params.topic}. Slide: "${params.slideTitle}" — ${params.slideBody}`,
      `Gere um imagePrompt em inglês detalhado (lighting, composition, mood) para uma foto profissional deste slide.`,
      `Retorne JSON: {"imagePrompt":"...","imageSearchQuery":"..."}`,
    ].filter(Boolean).join("\n");

    const result = await callRegenLLM(prompt, {});
    const s = result as unknown as Record<string, unknown>;
    imagePrompt = cleanText(s.imagePrompt, `${params.topic} ${params.slideTitle}`);
  }

  const imageUrl = await resolveCarouselCoverImage({
    topic: params.topic,
    hook: params.hook,
    imageSearchQuery: `${params.topic} ${params.slideTitle}`,
    slideTitle: params.slideTitle,
    slideBody: params.slideBody,
    slideIndex: params.slideIndex,
    useAiImages: params.useAiImages ?? false,
  });

  return { imageUrl, imagePrompt };
}

export async function regenerateCaption(params: {
  topic: string;
  hook: string;
  slides: Array<{ title: string; body: string }>;
  profileId?: string;
  cta: string;
}): Promise<{ caption: string; hashtags: string[]; cta: string }> {
  const profileCtx = params.profileId ? (PROFILE_CONTEXTS[params.profileId] ?? "") : "";
  const slidesSummary = params.slides
    .map((s, i) => `Slide ${i + 1}: ${s.title} — ${s.body}`)
    .join("\n");

  const prompt = [
    profileCtx ? `Perfil: ${profileCtx}` : undefined,
    `Tema: ${params.topic}. Gancho: ${params.hook}.`,
    `Slides:\n${slidesSummary}`,
    `CTA atual: ${params.cta}`,
    `Gere uma legenda completa para o Instagram e hashtags relevantes.`,
    `Retorne JSON: {"caption":"...","hashtags":["hashtag1","hashtag2"],"cta":"..."}`,
  ].filter(Boolean).join("\n");

  const result = await callRegenLLM(prompt, {});
  const s = result as unknown as Record<string, unknown>;
  return {
    caption: cleanText(s.caption, `${params.hook}\n\n${params.cta}`),
    hashtags: Array.isArray(s.hashtags) ? (s.hashtags as string[]) : [],
    cta: cleanText(s.cta, params.cta),
  };
}

export function validateCarouselOutput(result: CarouselAgentResult, expectedSlideCount: number): boolean {
  if (result.slides.length !== expectedSlideCount) return false;
  if (!result.hook || !result.caption) return false;
  return result.slides.every((s) => s.title && s.body !== undefined);
}
