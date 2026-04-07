import { generateImage } from "./imageGeneration";
import { invokeLLM } from "./llm";

const ARTICLE_DESIGNER_AGENT_PROMPT = `Voce e um diretor de arte especializado em imagens para artigos de LinkedIn no setor de energia.

Sua funcao e transformar uma noticia em uma capa ultrarrealista, profissional e editorial.

Regras:
- A imagem deve parecer fotografia real, nao ilustração.
- A cena precisa estar relacionada ao tema da noticia.
- Evite qualquer texto, letras, logotipos, marcas, selos ou watermark.
- Evite pessoas posando para camera, a menos que o tema exija.
- Use composicao forte para feed de LinkedIn, com assunto claro e acabamento premium.
- Priorize infraestrutura de energia, tecnologia, redes eletricas, paineis solares, turbinas eolicas, usinas, baterias, transmissao, industria ou ambiente corporativo quando fizer sentido.`;

export type ArticleDesignerAgentInput = {
  newsTitle: string;
  source: string;
  summary: string;
  articleTitle: string;
  articleContent: string;
};

export type ArticleDesignerAgentResult = {
  imageUrl: string;
  prompt: string;
};

type DesignerPromptPayload = {
  prompt?: string;
};

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function buildFallbackPrompt(input: ArticleDesignerAgentInput) {
  return [
    "Use case: photorealistic-natural",
    "Asset type: LinkedIn article cover image, square 1:1",
    `Primary request: ultrarealistic editorial photograph for an energy-sector article about "${input.newsTitle}".`,
    `Context: ${input.summary || input.articleTitle}`,
    "Scene/backdrop: real energy infrastructure related to the topic, modern and credible.",
    "Style/medium: ultra-realistic documentary photography, premium business editorial, natural textures.",
    "Composition/framing: strong central subject, clean negative space, square crop, high visual clarity in social feed.",
    "Lighting/mood: realistic cinematic daylight or controlled industrial lighting, professional and trustworthy.",
    "Constraints: no text, no logos, no watermark, no charts, no fake UI, no illustration, no cartoon style.",
  ].join("\n");
}

export async function generateArticleCoverWithDesigner(
  input: ArticleDesignerAgentInput
): Promise<ArticleDesignerAgentResult> {
  let prompt = buildFallbackPrompt(input);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: ARTICLE_DESIGNER_AGENT_PROMPT,
        },
        {
          role: "user",
          content: [
            `Titulo da noticia: ${input.newsTitle}`,
            `Fonte: ${input.source}`,
            `Titulo do artigo: ${input.articleTitle}`,
            `Resumo: ${input.summary}`,
            `Trecho do artigo: ${input.articleContent.slice(0, 2200)}`,
            "",
            "Crie um prompt final em ingles para geracao de imagem ultrarrealista.",
            "Nao inclua texto visivel na imagem.",
          ].join("\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "article_cover_image_prompt",
          strict: true,
          schema: {
            type: "object",
            properties: {
              prompt: { type: "string" },
            },
            required: ["prompt"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0]?.message?.content;
    const parsed = JSON.parse(
      (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) || "{}"
    ) as DesignerPromptPayload;
    prompt = cleanText(parsed.prompt, prompt);
  } catch (err) {
    console.warn("[ArticleDesigner] Prompt generation failed, using fallback:", err);
  }

  const image = await generateImage({ prompt });

  if (!image.url) {
    throw new Error("O agente designer nao retornou uma imagem.");
  }

  return {
    imageUrl: image.url,
    prompt,
  };
}
