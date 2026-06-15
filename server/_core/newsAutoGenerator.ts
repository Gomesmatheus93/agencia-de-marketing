import { invokeLLM } from "./llm";
import { generateArticleCoverWithDesigner } from "./articleDesignerAgent";
import { generateCarouselWithAgent } from "./carouselAgent";
import { persistCarouselAssets } from "./carouselPersistence";
import { sendWhatsAppText } from "./whatsapp";
import { fetchArticleContext } from "../routers";
import * as db from "../db";
import type { DigestNewsItem } from "../db";

function compact(s: string) {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

export async function autoGenerateFromNews(
  userId: number,
  newsItem: DigestNewsItem,
  whatsappNumber: string
): Promise<{ articleId: number; carouselId: number }> {
  // 1. Scrape article context
  const articleContext = await fetchArticleContext({
    title: newsItem.title,
    url: newsItem.url,
    source: newsItem.source,
    excerpt: newsItem.excerpt ?? null,
    publishedAt: newsItem.publishedAt ?? null,
  });

  const contextBlocks = [
    `Titulo original: ${articleContext.title}`,
    `Fonte: ${newsItem.source}`,
    `URL: ${newsItem.url}`,
    articleContext.publishedAt ? `Publicado em: ${articleContext.publishedAt}` : "",
    articleContext.excerpt ? `Resumo capturado: ${articleContext.excerpt}` : "",
    articleContext.content
      ? `Texto capturado da noticia:\n${articleContext.content}`
      : "Texto completo nao capturado; use apenas os metadados e seja conservador.",
  ]
    .filter(Boolean)
    .join("\n\n");

  // 2. Generate article content via LLM
  const llmResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `Voce e um agente redator especializado no setor de energia. Transforme uma noticia em um artigo claro, profissional e publicavel em portugues brasileiro.

Regras:
- Use somente informacoes presentes no material da noticia.
- Nao invente numeros, nomes, datas ou declaracoes.
- Preserve o contexto da fonte original.
- Explique impactos praticos para empresas, consumidores ou mercado quando o material permitir.
- Escreva em markdown, com introducao, 3 a 5 secoes com subtitulos e conclusao.
- Evite emojis, sensacionalismo e linguagem generica.
- Se o conteudo capturado for limitado, deixe o artigo mais analitico e conservador.`,
      },
      {
        role: "user",
        content: `Leia a noticia abaixo e transforme em artigo.\n\n${contextBlocks}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "energy_news_article",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            content: { type: "string" },
          },
          required: ["title", "summary", "content"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawArticle = llmResponse.choices[0]?.message?.content;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(
      (typeof rawArticle === "string" ? rawArticle : JSON.stringify(rawArticle)) || "{}"
    );
  } catch {
    throw new Error("Agente redator retornou resposta inválida.");
  }

  const title = compact(String(parsed.title || articleContext.title || newsItem.title)).slice(0, 512);
  const content = String(parsed.content || "").trim();
  const summary = compact(String(parsed.summary || articleContext.excerpt || ""));

  if (!content) throw new Error("Agente redator não retornou conteúdo para o artigo.");

  // 3. Generate cover image
  const cover = await generateArticleCoverWithDesigner({
    newsTitle: newsItem.title,
    source: newsItem.source,
    summary,
    articleTitle: title,
    articleContent: content,
  });

  // 4. Save article
  const savedArticle = await db.saveArticle(userId, {
    title,
    topic: `Energia: ${newsItem.title}`,
    sourceUrl: newsItem.url,
    coverImageUrl: cover.imageUrl,
    content,
    summary,
  });

  // 5. Generate carousel from the article content
  const generatedCarousel = await generateCarouselWithAgent({
    topic: title,
    slideCount: 8,
    carouselFormat: "feed",
    style: "claude-minimalista",
    articleContext: `${title}\n\n${content.slice(0, 3000)}`,
    useAiImages: false,
  });

  const persistedAssets = await persistCarouselAssets({
    userId,
    coverImageUrl: generatedCarousel.coverImageUrl,
    slides: generatedCarousel.slides,
  });

  const savedCarousel = await db.saveCarousel(userId, {
    topic: title,
    style: "claude-minimalista",
    hook: generatedCarousel.hook,
    caption: generatedCarousel.caption,
    finalCta: generatedCarousel.finalCta,
    coverImageUrl: persistedAssets.coverImageUrl,
    slides: persistedAssets.slides,
  });

  // 6. Notify user via WhatsApp
  const msg =
    `✅ *Geração concluída!*\n\n` +
    `📰 *Artigo:* ${title}\n` +
    `🎠 *Carrossel:* ${savedCarousel.slides.length} slides criados\n\n` +
    `Acesse a aba Artigos e Carrosséis no sistema para visualizar e publicar.`;

  await sendWhatsAppText(whatsappNumber, msg).catch((err) => {
    console.error("[NewsAutoGen] Falha ao enviar notificação WA:", err);
  });

  return { articleId: savedArticle.id, carouselId: savedCarousel.id };
}