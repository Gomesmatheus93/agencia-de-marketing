import { generateImage } from "./imageGeneration";
import { invokeLLM, type MessageContent } from "./llm";

const CAROUSEL_AGENT_PROMPT = `Voce e um especialista em criacao de conteudo para Instagram, focado em carrosseis altamente virais, estrategicos e visualmente atrativos.

Sua funcao e transformar qualquer tema ou ideia em um carrossel completo, pronto para design e postagem, com foco em engajamento, retencao e conversao. Prendam atencao no primeiro slide, Gerem curiosidade e retencao ate o final, Estimulem salvamentos, compartilhamentos e comentarios, Tenham linguagem simples, direta e persuasiva. Use gatilhos mentais (curiosidade, urgencia, prova, dor), Crie sensacao de descoberta, Use contraste (ex: certo vs errado), Faca o leitor pensar "eu precisava disso".

O design final segue um modelo fixo: cabecalho com perfil, titulo grande centralizado, resumo curto abaixo e uma imagem tematica ocupando todo o bloco inferior. Por isso, escreva titulos curtos e resumos compactos, sem instrucoes visuais dentro do texto.

Quando existir um template visual enviado pelo usuario, preserve essa familia visual como referencia principal para o clima, a composicao e a direcao de arte.`;

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
  style: string;
  coverImageDataUrl?: string;
  coverImageUrl?: string;
  templateName?: string;
  templateStyleBrief?: string;
  templateImageDataUrl?: string;
  templateImageUrl?: string;
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
  return [
    "Use case: photorealistic social media carousel visual",
    "Asset type: lower half image for a 4:5 LinkedIn/Instagram carousel slide",
    `Main topic: ${input.topic}`,
    `Carousel hook: ${input.hook}`,
    `Slide ${input.slideIndex + 1} focus: ${input.slideTitle}`,
    `Slide context: ${input.slideBody}`,
    `Creative direction: ${input.imageSearchQuery || input.hook}`,
    input.templateName ? `Chosen design template: ${input.templateName}` : undefined,
    input.templateStyleBrief ? `Template style reference: ${input.templateStyleBrief}` : undefined,
    "The visual subject must clearly represent the main topic first. The slide focus only changes the angle inside that same topic.",
    "If a reference image is provided, treat it as a style reference: preserve the visual language, finish, palette, mood and framing logic, but generate a new scene that matches this slide's content.",
    "Style: ultra-realistic editorial photography, premium, clean, sharp, natural light, realistic details.",
    "Make the photography feel visually compatible with the chosen template, especially in tone, palette, framing and finish.",
    "Make this image specific to this slide, not a generic repeated cover for the whole carousel.",
    "Avoid random metaphors, unrelated people, unrelated office scenes, generic smartphones, abstract backgrounds, stock-photo cliches, or objects disconnected from the main topic.",
    "Composition: strong subject from the main topic, no text, no logos, no watermark, no UI, no charts, no fake typography.",
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
}) {
  const query = buildCentralThemeImageQuery(input);

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
    console.warn("[CarouselAgent] Image generation failed, trying Wikimedia:", err);
  }

  try {
    const searchedImage = await searchWikimediaImage(query);
    if (searchedImage) return searchedImage;
  } catch (err) {
    console.warn("[CarouselAgent] Wikimedia image search failed, using fallback:", err);
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

  const userPrompt = [
    `Tema do carrossel: ${input.topic}`,
    `Quantidade exata de slides: ${input.slideCount}`,
    `Direcao visual: ${styleGuide}`,
    input.templateName ? `Nome do template visual: ${input.templateName}` : undefined,
    "Escreva tudo em portugues brasileiro.",
    "Crie um gancho forte e direto.",
    "O primeiro slide deve prender a atencao imediatamente.",
    "Os slides do meio devem desenvolver a ideia com clareza, contraste e ritmo.",
    "O ultimo slide deve incentivar salvar, compartilhar ou comentar.",
    "Cada titulo deve ser curto, facil de diagramar e impactante, idealmente com ate 9 palavras.",
    "Cada corpo deve ser objetivo, persuasivo e pronto para virar resumo visual, com ate 150 caracteres.",
    "Gere uma legenda pronta para postagem.",
    "Gere um CTA final curto, claro e acionavel.",
    "Gere imageSearchQuery geral em ingles, com 3 a 8 palavras, para buscar ou gerar uma fotografia editorial relacionada ao tema central.",
    "Para cada slide, gere tambem um imageSearchQuery em ingles e especifico daquele slide, com 4 a 10 palavras.",
    "Toda imageSearchQuery de slide deve repetir explicitamente o assunto central em ingles e acrescentar apenas o foco do slide.",
    "Nao use consultas visuais abstratas, metaforicas ou genericas como transformation, growth, future, innovation ou success sem objeto/cena concreta do tema.",
    "Se o tema for energia, por exemplo, use cenas concretas como smart grid, solar panels, power transmission, battery storage, EV charging, power plant, oil market ou wind farm, de acordo com o assunto.",
    "Evite emojis e evite texto generico.",
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
