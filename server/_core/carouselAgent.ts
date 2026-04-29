import { generateImage } from "./imageGeneration";
import { invokeLLM, type MessageContent } from "./llm";
import { ENV } from "./env";

const CAROUSEL_AGENT_PROMPT = `Voce e um especialista em criacao de conteudo para Instagram, focado em carrosseis altamente virais, estrategicos e visualmente atrativos.

ESTRUTURA OBRIGATORIA DOS SLIDES — siga exatamente esta ordem:

SLIDE 1 — GANCHO: Unica funcao e parar o scroll. Deve gerar curiosidade imediata, provocar uma dor, revelar algo surpreendente ou fazer uma promessa irresistivel. Titulo impactante, corpo que amplifica a tensao e faz o leitor querer ver o proximo slide. NAO antecipe o conteudo, apenas crie urgencia de continuar.

SLIDES INTERMEDIARIOS (do 2 ate o penultimo) — DESENVOLVIMENTO: Cada slide aprofunda um aspecto do tema com clareza, dados, contraste (certo vs errado, antes vs depois) ou descoberta. Mantenha ritmo crescente de valor. Use gatilhos mentais: prova, curiosidade, urgencia, especificidade. Faca o leitor pensar "eu precisava saber disso".

ULTIMO SLIDE — CTA DE ENGAJAMENTO: Exclusivamente voltado para engajamento social. Titulo convidativo e direto. Corpo pedindo de forma natural que o seguidor curta, comente e compartilhe — sem soar forcado. Exemplo de corpo: "Se isso te ajudou, curte e compartilha com quem precisa ver isso hoje. Comenta aqui o que voce achou!" Adapte o texto ao tom do tema, mas mantenha o pedido de curtir, comentar e compartilhar.

REGRAS GERAIS:
- Linguagem simples, direta e persuasiva em portugues brasileiro
- Titulos curtos e impactantes, idealmente ate 9 palavras
- Corpo objetivo e pronto para virar resumo visual, com ate 150 caracteres
- Sem emojis, sem instrucoes visuais dentro do texto, sem texto generico
- O design segue modelo fixo: cabecalho de perfil, titulo centralizado, resumo abaixo, imagem tematica no bloco inferior

Quando existir um template visual enviado pelo usuario, preserve essa familia visual como referencia.

Quando receber uma secao "=== Pesquisa sobre o tema ===", use os dados como base factual para enriquecer os slides intermediarios. Incorpore fatos, numeros e conceitos naturalmente — sem citar a fonte.`;

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
      6000
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

export type CarouselAgentInput = {
  topic: string;
  slideCount: number;
  carouselFormat?: "feed" | "story";
  style: string;
  coverImageDataUrl?: string;
  coverImageUrl?: string;
  templateName?: string;
  templateStyleBrief?: string;
  templateImageDataUrl?: string;
  templateImageUrl?: string;
  useAiImages?: boolean;
  articleContext?: string;
};

export type CarouselAgentSlide = {
  title: string;
  body: string;
  imageUrl?: string;
};

export type CarouselAgentResult = {
  slides: CarouselAgentSlide[];
  coverImageUrl?: string;
  hook: string;
  caption: string;
  finalCta: string;
};

type CarouselAgentPayload = {
  hook?: string;
  caption?: string;
  finalCta?: string;
  imageSearchQuery?: string;
  slides?: Array<{
    title?: string;
    body?: string;
    imageSearchQuery?: string;
  }>;
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

  const stockSources: Array<{ name: string; fn: () => Promise<string | undefined> }> = [
    { name: "Unsplash", fn: () => searchUnsplashImage(query) },
    { name: "Pexels", fn: () => searchPexelsImage(query) },
    { name: "Pixabay", fn: () => searchPixabayImage(query) },
    { name: "Wikimedia", fn: () => searchWikimediaImage(query) },
  ];

  for (const source of stockSources) {
    try {
      const result = await source.fn();
      if (result) return result;
    } catch (err) {
      console.warn(`[CarouselAgent] ${source.name} failed:`, err);
    }
  }

  return buildFallbackImageDataUrl(`${input.topic} ${input.slideTitle}`);
}

export async function generateCarouselWithAgent(
  input: CarouselAgentInput
): Promise<CarouselAgentResult> {
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

  const userPrompt = [
    `Tema do carrossel: ${input.topic}`,
    `Quantidade exata de slides: ${input.slideCount}`,
    `Formato: ${formatInfo}`,
    `Direcao visual: ${styleGuide}`,
    input.templateName ? `Nome do template visual: ${input.templateName}` : undefined,
    `MAPA DE SLIDES (siga obrigatoriamente):`,
    `  Slide 1: GANCHO — para o scroll, gera curiosidade, promessa ou dor. NAO entrega o conteudo ainda.`,
    input.slideCount > 2
      ? `  Slides 2 a ${lastSlideIndex - 1}: DESENVOLVIMENTO — cada um aprofunda um aspecto diferente do tema com dados, contraste ou descoberta.`
      : undefined,
    `  Slide ${lastSlideIndex}: CTA DE ENGAJAMENTO — pede curtida, comentario e compartilhamento de forma natural e direta.`,
    "Gere uma legenda completa pronta para postagem, com o gancho, os pontos principais e o CTA.",
    "Gere imageSearchQuery geral em ingles, com 3 a 8 palavras, para fotografia editorial do tema central.",
    "Para cada slide, gere imageSearchQuery em ingles especifico daquele slide, com 4 a 10 palavras.",
    "Toda imageSearchQuery deve mencionar o assunto central em ingles e acrescentar apenas o foco do slide.",
    "Nao use consultas abstratas como transformation, growth, future ou innovation sem objeto concreto do tema.",
    topicResearch
      ? `\n=== Pesquisa sobre o tema ===\nUse os fatos, dados e conceitos abaixo para enriquecer os slides de desenvolvimento. Incorpore-os naturalmente — nao cite a fonte:\n\n${topicResearch}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const userContentParts: MessageContent[] = [
    {
      type: "text",
      text: userPrompt,
    },
  ];

  if (templateImageUrl) {
    userContentParts.push({
      type: "text",
      text: "Imagem de referencia 1: template visual do usuario. Preserve a familia visual, o clima, a composicao e o acabamento desse modelo.",
    });
    userContentParts.push({
      type: "image_url",
      image_url: {
        url: templateImageUrl,
        detail: "low",
      },
    });
  }

  if (referenceImageUrl) {
    userContentParts.push({
      type: "text",
      text: "Imagem de referencia 2: imagem opcional para o bloco inferior. Use como referencia de conteudo quando fizer sentido.",
    });
    userContentParts.push({
      type: "image_url",
      image_url: {
        url: referenceImageUrl,
        detail: "auto",
      },
    });
  }

  const userContent: MessageContent | MessageContent[] =
    userContentParts.length === 1 ? userPrompt : userContentParts;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: CAROUSEL_AGENT_PROMPT,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "instagram_carousel_agent_output",
        strict: true,
        schema: {
          type: "object",
          properties: {
            hook: { type: "string" },
            caption: { type: "string" },
            finalCta: { type: "string" },
            imageSearchQuery: { type: "string" },
            slides: {
              type: "array",
              minItems: input.slideCount,
              maxItems: input.slideCount,
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  body: { type: "string" },
                  imageSearchQuery: { type: "string" },
                },
                required: ["title", "body", "imageSearchQuery"],
                additionalProperties: false,
              },
            },
          },
          required: ["hook", "caption", "finalCta", "imageSearchQuery", "slides"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  const parsed = JSON.parse(
    (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) || "{}"
  ) as CarouselAgentPayload;

  const slides = (parsed.slides || []).map((slide, index) => ({
    title: cleanText(slide?.title, `Slide ${index + 1}`),
    body: cleanText(slide?.body),
    imageSearchQuery: cleanText(slide?.imageSearchQuery),
  }));

  if (slides.length !== input.slideCount) {
    throw new Error("O agente nao retornou a quantidade esperada de slides");
  }

  const hook = cleanText(parsed.hook, slides[0]?.title || input.topic);
  const finalCta = cleanText(parsed.finalCta, FALLBACK_CTA);
  const caption = cleanText(
    parsed.caption,
    `${hook}\n\n${slides.map((slide) => `${slide.title}: ${slide.body}`).join("\n\n")}\n\n${finalCta}`
  );
  const slidesWithImage: CarouselAgentSlide[] = [];

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
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

    slidesWithImage.push({
      title: slide.title,
      body: slide.body,
      imageUrl: slideImageUrl,
    });
  }

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
  };
}
