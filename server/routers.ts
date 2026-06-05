import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminRouter, featuresRouter } from "./_core/adminRouter";
import { aiProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { buildNewsletterHtml } from "./_core/newsletterTemplate";
import { generateImage, type ImageStyle, type ImageSize } from "./_core/imageGeneration";
import {
  generateCarouselWithAgent,
  regenerateSlide,
  regenerateSlideText,
  regenerateSlideImage,
  regenerateCaption,
} from "./_core/carouselAgent";
import { saveCarouselTemplateAsset } from "./_core/carouselTemplateAgent";
import { generateArticleCoverWithDesigner } from "./_core/articleDesignerAgent";
import {
  diagnoseLinkedInAuth,
  publishArticleToLinkedInWithAgent,
} from "./_core/linkedinArticlePostingAgent";
import { generateChatAgentReply } from "./_core/chatAgent";
import { generateVideoScriptWithAgent } from "./_core/videoScriptAgent";
import { createOpenAIRealtimeToken } from "./_core/openaiRealtime";
import {
  prepareDidSourceImage,
  createDidTalk,
  waitForDidTalkCompletion,
  downloadAndStoreDidVideo,
} from "./_core/didAvatarAgent";
import {
  createHeyGenAvatarVideo,
  waitForHeyGenCompletion,
  downloadAndStoreHeyGenVideo,
  listHeyGenVoices,
} from "./_core/heyGenAvatarAgent";
import { publishInstagramCarouselWithAgent } from "./_core/instagramPostingAgent";
import {
  listCanvaDesigns,
  exportCanvaDesign,
  createCanvaDesign,
  refreshCanvaToken,
} from "./_core/canvaClient";
import {
  buildScheduledInstagramCarouselMetadata,
  publishInstagramSocialPost,
} from "./_core/instagramSocialPostPublisher";
import {
  getPostSchedulerTimeZone,
  parsePostScheduledAt,
} from "./_core/postScheduling";
import {
  persistCarouselAssets,
  persistCarouselDesignAssets,
  getCarouselAssetDataUrl,
  persistSingleCarouselImage,
} from "./_core/carouselPersistence";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./_core/password";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import axios from "axios";

const scheduledAtInputSchema = z.union([z.date(), z.string()]);

function parseScheduledAtInput(value: Date | string) {
  const scheduledAt = parsePostScheduledAt(value);
  if (!scheduledAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Informe uma data e hora validas para o agendamento.",
    });
  }
  return scheduledAt;
}

// ─── Chat Router ──────────────────────────────────────────────────────────────
const chatRouter = router({
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    return db.getConversations(ctx.user.id);
  }),

  createConversation: protectedProcedure
    .input(z.object({ title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.createConversation(ctx.user.id, input.title);
    }),

  updateTitle: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      await db.updateConversationTitle(input.id, ctx.user.id, input.title);
      return { success: true };
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteConversation(input.id, ctx.user.id);
      return { success: true };
    }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getMessages(input.conversationId, ctx.user.id);
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Save user message
      const userMsg = await db.addMessage(input.conversationId, ctx.user.id, "user", input.content);

      // Get conversation history for context
      const history = await db.getMessages(input.conversationId, ctx.user.id);
      const historyMessages = history.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const user = await db.getUserByOpenId(ctx.user.openId);
      let assistantContent = "";

      if (!assistantContent) {
        try {
          assistantContent = await generateChatAgentReply({
            history: historyMessages,
            userName: user?.name,
          });
        } catch (err) {
          console.warn("[Chat] research agent failed, falling back to basic LLM:", err);
        }
      }

      if (!assistantContent) {
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Você é um assistente de marketing digital especializado em criação de conteúdo, estratégias de redes sociais, SEO e automação de marketing. Responda sempre em português brasileiro de forma clara, objetiva e profissional.",
            },
            ...historyMessages.slice(-8),
            { role: "user", content: input.content },
          ],
        });
        const rawContent = llmResponse.choices[0]?.message?.content;
        assistantContent = (typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)) || "Desculpe, não consegui processar sua mensagem.";
      }

      // Save assistant message
      const assistantMsg = await db.addMessage(input.conversationId, ctx.user.id, "assistant", assistantContent);

      // Auto-update conversation title from first message
      if (history.length <= 1) {
        const shortTitle = input.content.slice(0, 60) + (input.content.length > 60 ? "..." : "");
        await db.updateConversationTitle(input.conversationId, ctx.user.id, shortTitle);
      }

      return { userMessage: userMsg, assistantMessage: assistantMsg };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getChatCount(ctx.user.id);
    return { count };
  }),
});


const imagesRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getImages(ctx.user.id);
  }),

  generate: aiProcedure
    .input(
      z.object({
        prompt: z.string(),
        referenceImageUrl: z.string().optional(),
        style: z.enum(["commercial", "produto", "banner", "social", "logo", "lifestyle"]).optional(),
        size: z.enum(["1:1", "4:5", "16:9"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandKit(ctx.user.id);

      const brandPrefix = brand
        ? [
            brand.companyName ? `Marca: ${brand.companyName}.` : null,
            brand.industry ? `Setor: ${brand.industry}.` : null,
            (brand.primaryColor && brand.primaryColor !== "#6366f1")
              ? `Paleta de cores obrigatória — primária: ${brand.primaryColor}${brand.secondaryColor && brand.secondaryColor !== "#8b5cf6" ? `, secundária: ${brand.secondaryColor}` : ""}${brand.accentColor && brand.accentColor !== "#06b6d4" ? `, destaque: ${brand.accentColor}` : ""}. Use estas cores como paleta dominante.`
              : null,
          ].filter(Boolean).join(" ")
        : null;

      const enhancedPrompt = brandPrefix
        ? `${brandPrefix} ${input.prompt}`
        : input.prompt;

      const result = await generateImage({
        prompt: enhancedPrompt,
        referenceImageUrl: input.referenceImageUrl,
        style: input.style as ImageStyle | undefined,
        size: input.size as ImageSize | undefined,
      });
      const imageUrl = result.url || "";

      const saved = await db.saveImage(ctx.user.id, input.prompt, imageUrl);
      return saved;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteImage(input.id, ctx.user.id);
      return { success: true };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getImageCount(ctx.user.id);
    return { count };
  }),
});

// ─── Articles Router ──────────────────────────────────────────────────────────
const videosRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getAvatarVideos(ctx.user.id);
  }),

  createRealtimeToken: protectedProcedure
    .input(
      z.object({
        instructions: z.string().trim().max(2000).optional(),
        model: z.string().trim().max(128).optional(),
        voice: z.string().trim().max(128).optional(),
        ttlSeconds: z.number().int().min(60).max(3600).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await createOpenAIRealtimeToken(input);
      } catch (err) {
        const message = err instanceof Error ? err.message : "falha desconhecida";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao criar token realtime da OpenAI: ${message}`,
        });
      }
    }),

  generateScript: aiProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        tone: z
          .enum(["professional", "casual", "inspiring", "educational"])
          .optional()
          .default("professional"),
      })
    )
    .mutation(async ({ input }) => {
      return generateVideoScriptWithAgent(input);
    }),

  getVoices: protectedProcedure
    .input(z.object({ provider: z.enum(["heygen", "did"]), language: z.string().optional() }))
    .query(async ({ input }) => {
      if (input.provider === "heygen") {
        return listHeyGenVoices(); // filtro de idioma feito no cliente
      }
      return [
        { voice_id: "pt-BR-FranciscaNeural", name: "Francisca PT-BR", language: "pt-BR", gender: "Female" },
        { voice_id: "pt-BR-AntonioNeural", name: "Antonio PT-BR", language: "pt-BR", gender: "Male" },
        { voice_id: "en-US-JennyNeural", name: "Jenny EN-US", language: "en-US", gender: "Female" },
        { voice_id: "en-US-GuyNeural", name: "Guy EN-US", language: "en-US", gender: "Male" },
      ];
    }),

  generate: aiProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512).optional(),
        topic: z.string().min(3).max(500).optional(),
        script: z.string().min(10).max(5000),
        sourceImageUrl: z.string().optional(),
        sourceImageDataUrl: z.string().optional(),
        voiceId: z.string().min(1).max(256).optional(),
        provider: z.enum(["did", "heygen"]).default("did"),
        emotion: z.enum(["Excited", "Friendly", "Serious", "Soothing", "Broadcaster"]).optional(),
        talkingStyle: z.enum(["expressive", "stable"]).optional(),
      }).refine((value) => Boolean(value.sourceImageUrl || value.sourceImageDataUrl), {
        message: "Envie a foto da pessoa para gerar o video.",
        path: ["sourceImageDataUrl"],
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedScript = input.script.replace(/\s+/g, " ").trim();

      const preparedSourceImage = await prepareDidSourceImage({
        userId: ctx.user.id,
        sourceImageUrl: input.sourceImageUrl,
        sourceImageDataUrl: input.sourceImageDataUrl,
      });

      const fallbackTitle = (
        input.topic?.trim() ||
        normalizedScript.split(/[.!?]/)[0] ||
        "Video com avatar"
      ).slice(0, 512);

      const saved = await db.saveAvatarVideo(ctx.user.id, {
        title: input.title?.trim() || fallbackTitle,
        topic: input.topic?.trim(),
        script: normalizedScript,
        sourceImageUrl: preparedSourceImage.previewSourceImageUrl,
        provider: input.provider,
        voiceProvider: input.provider === "heygen" ? "heygen" : "microsoft",
        voiceId: input.voiceId,
        status: "processing",
      });

      try {
        let videoUrl: string;

        if (input.provider === "heygen") {
          const { videoId } = await createHeyGenAvatarVideo({
            userId: ctx.user.id,
            imageBuffer: preparedSourceImage.imageBuffer,
            contentType: preparedSourceImage.contentType,
            script: normalizedScript,
            voiceId: input.voiceId ?? "",
            emotion: input.emotion,
            talkingStyle: input.talkingStyle ?? "expressive",
          });

          await db.updateAvatarVideo(saved.id, ctx.user.id, {
            providerJobId: videoId,
            errorMessage: null,
          });

          const completed = await waitForHeyGenCompletion(videoId);
          const stored = await downloadAndStoreHeyGenVideo({
            userId: ctx.user.id,
            videoId: saved.id,
            resultUrl: completed.resultUrl,
          });
          videoUrl = stored.videoUrl;
        } else {
          const talk = await createDidTalk({
            sourceImageUrl: preparedSourceImage.providerSourceImageUrl,
            script: normalizedScript,
            voiceId: input.voiceId,
          });

          await db.updateAvatarVideo(saved.id, ctx.user.id, {
            providerJobId: talk.talkId,
            voiceProvider: talk.voiceProvider,
            voiceId: talk.voiceId,
            errorMessage: null,
          });

          const completedTalk = await waitForDidTalkCompletion(talk.talkId);
          const stored = await downloadAndStoreDidVideo({
            userId: ctx.user.id,
            videoId: saved.id,
            resultUrl: completedTalk.resultUrl,
          });
          videoUrl = stored.videoUrl;
        }

        const updated = await db.updateAvatarVideo(saved.id, ctx.user.id, {
          sourceImageUrl: preparedSourceImage.previewSourceImageUrl,
          videoUrl,
          status: "completed",
          errorMessage: null,
        });

        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "O video foi gerado, mas nao consegui salvar o resultado final.",
          });
        }

        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "falha desconhecida";
        await db.updateAvatarVideo(saved.id, ctx.user.id, {
          status: "failed",
          errorMessage: message,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao gerar video com avatar: ${message}`,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteAvatarVideo(input.id, ctx.user.id);
      return { success: true };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getAvatarVideoCount(ctx.user.id);
    return { count };
  }),
});

type EnergyNewsItem = {
  title: string;
  url: string;
  source: string;
  excerpt: string | null;
  publishedAt: string | null;
};

type RankedEnergyNewsItem = EnergyNewsItem & {
  order: number;
  keywordScore: number;
};

const NEWS_AGENT_USER_AGENT =
  "Mozilla/5.0 (compatible; AgenciaMarketingEnergyResearchBot/1.0; +https://localhost)";

const NEWS_KEYWORDS = [
  "energia",
  "energetic",
  "eletric",
  "solar",
  "eolica",
  "hidro",
  "petroleo",
  "gas",
  "renovavel",
  "aneel",
  "ons",
  "mme",
  "tarifa",
  "hidrogenio",
  "combustivel",
  "power",
  "energy",
  "electric",
  "wind",
  "oil",
  "renewable",
];

const ARTICLE_CONTEXT_CHAR_LIMIT = 18000;

const selectedNewsSchema = z.object({
  title: z.string().min(3).max(500),
  url: z.string().url(),
  source: z.string().min(1).max(200),
  excerpt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
});

function decodeHtml(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    const normalized = entity.toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    }

    return namedEntities[normalized] ?? `&${entity};`;
  });
}

function compactText(value: string) {
  return decodeHtml(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return compactText(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function getAttrValue(tag: string, attr: string) {
  const match = tag.match(new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return compactText(match?.[2] || match?.[3] || match?.[4] || "");
}

function getTagValue(block: string, tag: string) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function getFirstTagValue(block: string, tags: string[]) {
  for (const tag of tags) {
    const value = getTagValue(block, tag);
    if (value) return value;
  }

  return "";
}

function toAbsoluteHttpUrl(href: string, baseUrl: string) {
  const trimmed = href.trim();
  if (!trimmed || /^(#|javascript:|mailto:|tel:)/i.test(trimmed)) return "";

  try {
    const url = new URL(trimmed, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toPublicAssetUrl(
  req: { protocol?: string; headers?: Record<string, string | string[] | undefined> },
  url: string
) {
  if (!url || /^https?:\/\//i.test(url)) return url;

  const host =
    getHeaderValue(req.headers?.["x-forwarded-host"]) ||
    getHeaderValue(req.headers?.host);
  const protocol =
    getHeaderValue(req.headers?.["x-forwarded-proto"]) ||
    req.protocol ||
    "http";

  if (!host) return url;

  return new URL(url, `${protocol}://${host}`).toString();
}

function inferSourceName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeNewsUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("utm_term");
    parsed.searchParams.delete("utm_content");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

function normalizeDate(value: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function getMetaContent(html: string, keys: string[]) {
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const marker =
      getAttrValue(tag, "property") ||
      getAttrValue(tag, "name") ||
      getAttrValue(tag, "itemprop");

    if (marker && normalizedKeys.includes(marker.toLowerCase())) {
      const content = getAttrValue(tag, "content");
      if (content) return content;
    }
  }

  return "";
}

function keywordScore(value: string, topic = "") {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const topicKeywords = topic
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((keyword) => keyword.length >= 3);

  const baseScore = NEWS_KEYWORDS.reduce(
    (score, keyword) => score + (normalized.includes(keyword) ? 1 : 0),
    0
  );
  const topicScore = topicKeywords.reduce(
    (score, keyword) => score + (normalized.includes(keyword) ? 2 : 0),
    0
  );

  return baseScore + topicScore;
}

function looksLikeArticleUrl(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    const segments = path.split("/").filter(Boolean);

    return (
      /(noticia|noticias|news|article|artigo|energia|mercado|economia|negocios|politica|sustentabilidade)/i.test(path) ||
      /\/20\d{2}\//.test(path) ||
      segments.some((segment) => segment.includes("-") && segment.length > 20)
    );
  } catch {
    return false;
  }
}

function isUsefulHeadline(title: string) {
  if (title.length < 18 || title.length > 220) return false;
  return !/^(home|menu|login|entrar|assine|newsletter|podcast|videos|fale conosco|leia mais)$/i.test(title);
}

async function fetchUrlText(url: string) {
  const response = await axios.get<string>(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": NEWS_AGENT_USER_AGENT,
    },
    maxRedirects: 5,
    responseType: "text",
    timeout: 20000,
    transformResponse: [(data) => data],
  });

  return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
}

function extractRssItems(xml: string, baseUrl: string, source: string): EnergyNewsItem[] {
  const blocks = [
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];

  return blocks
    .map((block) => {
      const title = getTagValue(block, "title");
      const linkTag = block.match(/<link\b[^>]*>/i)?.[0] || "";
      const atomHref = getAttrValue(linkTag, "href");
      const rawUrl = atomHref || getTagValue(block, "link") || getTagValue(block, "guid");
      const url = toAbsoluteHttpUrl(rawUrl, baseUrl);
      const excerpt = getFirstTagValue(block, ["description", "summary", "content:encoded"]);
      const publishedAt = normalizeDate(
        getFirstTagValue(block, ["pubDate", "published", "updated", "dc:date", "date"])
      );

      if (!url || !isUsefulHeadline(title)) return null;

      return {
        title,
        url,
        source,
        excerpt: excerpt || null,
        publishedAt,
      };
    })
    .filter((item): item is EnergyNewsItem => Boolean(item));
}

function getJsonLdUrl(value: unknown) {
  if (typeof value === "string") return value;

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate["@id"] === "string") return candidate["@id"];
    if (typeof candidate.url === "string") return candidate.url;
  }

  return "";
}

function extractJsonLdItems(html: string, baseUrl: string, source: string): EnergyNewsItem[] {
  const items: EnergyNewsItem[] = [];
  const scripts = html.match(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
  ) || [];

  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const rawType = record["@type"];
    const types = Array.isArray(rawType) ? rawType : [rawType];
    const isArticle = types.some(
      (type) => typeof type === "string" && /^(newsarticle|article|blogposting)$/i.test(type)
    );

    const title = compactText(String(record.headline || record.name || ""));
    const rawUrl = getJsonLdUrl(record.url) || getJsonLdUrl(record.mainEntityOfPage);
    const url = rawUrl ? toAbsoluteHttpUrl(rawUrl, baseUrl) : "";

    if (isArticle && title && url && isUsefulHeadline(title)) {
      const excerpt = compactText(String(record.description || ""));
      const publishedAt = normalizeDate(
        String(record.datePublished || record.dateModified || "")
      );

      items.push({
        title,
        url,
        source,
        excerpt: excerpt || null,
        publishedAt,
      });
    }

    Object.values(record).forEach((value) => {
      if (value && typeof value === "object") visit(value);
    });
  };

  scripts.forEach((script) => {
    const rawJson = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      visit(JSON.parse(decodeHtml(rawJson)));
    } catch {
      // Ignore malformed JSON-LD; many publishers embed invalid tracking fragments.
    }
  });

  return items;
}

function extractAnchorItems(html: string, baseUrl: string, source: string): EnergyNewsItem[] {
  const items: EnergyNewsItem[] = [];
  const anchorPattern = /<a\b[\s\S]*?<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null) {
    const anchor = match[0];
    const openingTag = anchor.match(/^<a\b[^>]*>/i)?.[0] || "";
    const href = getAttrValue(openingTag, "href");
    const url = toAbsoluteHttpUrl(href, baseUrl);
    const title = stripHtml(anchor) || getAttrValue(openingTag, "title");

    if (!url || !isUsefulHeadline(title)) continue;
    if (!looksLikeArticleUrl(url) && keywordScore(`${title} ${url}`) === 0) continue;

    const context = html.slice(
      Math.max(0, match.index - 600),
      Math.min(html.length, match.index + anchor.length + 900)
    );
    const timeTag = context.match(/<time\b[^>]*>/i)?.[0] || "";
    const publishedAt = normalizeDate(
      getAttrValue(timeTag, "datetime") || getMetaContent(context, ["article:published_time", "date"])
    );

    items.push({
      title,
      url,
      source,
      excerpt: null,
      publishedAt,
    });
  }

  return items;
}

function extractFeedUrls(html: string, baseUrl: string) {
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];

  return Array.from(
    new Set(
      linkTags
        .map((tag) => {
          const type = getAttrValue(tag, "type").toLowerCase();
          const rel = getAttrValue(tag, "rel").toLowerCase();
          const href = getAttrValue(tag, "href");

          if (!href) return "";
          if (!/(rss|atom|xml)/i.test(type) && !rel.includes("alternate")) return "";

          return toAbsoluteHttpUrl(href, baseUrl);
        })
        .filter(Boolean)
    )
  );
}

function dedupeNewsItems(items: EnergyNewsItem[]) {
  const byUrl = new Map<string, EnergyNewsItem>();

  for (const item of items) {
    const key = normalizeNewsUrl(item.url);
    const existing = byUrl.get(key);

    if (!existing) {
      byUrl.set(key, item);
      continue;
    }

    byUrl.set(key, {
      ...existing,
      title: existing.title.length >= item.title.length ? existing.title : item.title,
      excerpt: existing.excerpt || item.excerpt,
      publishedAt: existing.publishedAt || item.publishedAt,
    });
  }

  return Array.from(byUrl.values());
}

function rankNewsItems(items: EnergyNewsItem[], topic: string) {
  const ranked = items.map<RankedEnergyNewsItem>((item, order) => ({
    ...item,
    order,
    keywordScore: keywordScore(`${item.title} ${item.excerpt || ""} ${item.url}`, topic),
  }));

  const keywordPool = ranked.filter((item) => item.keywordScore > 0);
  const pool = keywordPool.length >= 5 ? keywordPool : ranked;

  return pool
    .sort((a, b) => {
      const aDate = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bDate = b.publishedAt ? Date.parse(b.publishedAt) : 0;

      if (aDate && bDate && aDate !== bDate) return bDate - aDate;
      if (a.keywordScore !== b.keywordScore) return b.keywordScore - a.keywordScore;
      if (aDate !== bDate) return bDate - aDate;
      return a.order - b.order;
    })
    .map(({ order, keywordScore, ...item }) => item);
}

async function fetchNewsFromSite(siteUrl: string) {
  const source = inferSourceName(siteUrl);
  const html = await fetchUrlText(siteUrl);
  const rssItems = extractRssItems(html, siteUrl, source);
  const htmlItems = [
    ...extractJsonLdItems(html, siteUrl, source),
    ...extractAnchorItems(html, siteUrl, source),
  ];
  const feedUrls = extractFeedUrls(html, siteUrl).slice(0, 2);
  const feedResults = await Promise.allSettled(
    feedUrls.map(async (feedUrl) => extractRssItems(await fetchUrlText(feedUrl), feedUrl, source))
  );
  const feedItems = feedResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  return [...rssItems, ...feedItems, ...htmlItems];
}

function extractMainHtml(html: string) {
  return (
    html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ||
    html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ||
    html.match(/<body\b[\s\S]*?<\/body>/i)?.[0] ||
    html
  );
}

function extractArticleTextFromHtml(html: string) {
  const mainHtml = extractMainHtml(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  const textBlocks = mainHtml.match(/<(h1|h2|h3|p|li|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi) || [];
  const unique = new Set<string>();
  const paragraphs: string[] = [];

  for (const block of textBlocks) {
    const tag = block.match(/^<([a-z0-9]+)/i)?.[1]?.toLowerCase() || "";
    const text = stripHtml(block);
    const key = text.toLowerCase();

    if (!text || unique.has(key)) continue;
    if (!tag.startsWith("h") && text.length < 40) continue;

    unique.add(key);
    paragraphs.push(text);
  }

  const articleText = paragraphs.join("\n\n");
  return (articleText || stripHtml(mainHtml)).slice(0, ARTICLE_CONTEXT_CHAR_LIMIT);
}

async function fetchArticleContext(news: z.infer<typeof selectedNewsSchema>) {
  try {
    const html = await fetchUrlText(news.url);
    const title =
      stripHtml(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] || "") ||
      getMetaContent(html, ["og:title", "twitter:title"]) ||
      news.title;
    const excerpt =
      getMetaContent(html, ["description", "og:description", "twitter:description"]) ||
      news.excerpt ||
      "";
    const publishedAt =
      normalizeDate(getMetaContent(html, ["article:published_time", "datePublished", "date"])) ||
      news.publishedAt ||
      null;

    return {
      title,
      excerpt,
      publishedAt,
      content: extractArticleTextFromHtml(html),
    };
  } catch (err) {
    console.warn("[Articles] Failed to fetch selected news:", err);
    return {
      title: news.title,
      excerpt: news.excerpt || "",
      publishedAt: news.publishedAt || null,
      content: "",
    };
  }
}

const articlesRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getArticles(ctx.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getArticle(input.id, ctx.user.id);
    }),

  researchEnergyNews: aiProcedure
    .input(z.object({
      sites: z.array(z.string().url()).min(1).max(12),
      topic: z.string().min(2).max(120).optional().default("energia"),
    }))
    .mutation(async ({ input }) => {
      const sites = Array.from(new Set(input.sites.map((site) => site.trim()).filter(Boolean)));
      const results = await Promise.allSettled(sites.map((site) => fetchNewsFromSite(site)));
      const items = dedupeNewsItems(
        results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      );
      const failedSites = results
        .map((result, index) => (result.status === "rejected" ? sites[index] : ""))
        .filter(Boolean);
      const topItems = rankNewsItems(items, input.topic).slice(0, 5);

      if (topItems.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "O agente pesquisador nao encontrou noticias nos sites informados.",
        });
      }

      return {
        items: topItems,
        failedSites,
      };
    }),

  generateFromNews: aiProcedure
    .input(z.object({
      news: selectedNewsSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const articleContext = await fetchArticleContext(input.news);
      const contextBlocks = [
        `Titulo original: ${articleContext.title}`,
        `Fonte: ${input.news.source}`,
        `URL: ${input.news.url}`,
        articleContext.publishedAt ? `Publicado em: ${articleContext.publishedAt}` : "",
        articleContext.excerpt ? `Resumo capturado: ${articleContext.excerpt}` : "",
        articleContext.content
          ? `Texto capturado da noticia:\n${articleContext.content}`
          : "Texto completo nao capturado; use apenas os metadados e seja conservador.",
      ]
        .filter(Boolean)
        .join("\n\n");

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
        parsed = JSON.parse((typeof rawArticle === "string" ? rawArticle : JSON.stringify(rawArticle)) || "{}");
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O agente redator retornou uma resposta invalida." });
      }
      const title = compactText(String(parsed.title || articleContext.title || input.news.title)).slice(0, 512);
      const content = String(parsed.content || "").trim();
      const summary = compactText(String(parsed.summary || articleContext.excerpt || ""));

      if (!content) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "O agente redator nao retornou conteudo para o artigo.",
        });
      }

      const cover = await generateArticleCoverWithDesigner({
        newsTitle: input.news.title,
        source: input.news.source,
        summary,
        articleTitle: title,
        articleContent: content,
      });
      const coverImageUrl = toPublicAssetUrl(ctx.req, cover.imageUrl);

      const saved = await db.saveArticle(ctx.user.id, {
        title,
        topic: `Energia: ${input.news.title}`,
        sourceUrl: input.news.url,
        coverImageUrl,
        content,
        summary,
      });

      return saved;
    }),

  regenerateCover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await db.getArticle(input.id, ctx.user.id);
      if (!article) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artigo nao encontrado" });
      }

      const cover = await generateArticleCoverWithDesigner({
        newsTitle: article.topic || article.title,
        source: article.sourceUrl ? inferSourceName(article.sourceUrl) : "Artigo interno",
        summary: article.summary || "",
        articleTitle: article.title,
        articleContent: article.content,
      });
      const coverImageUrl = toPublicAssetUrl(ctx.req, cover.imageUrl);

      await db.updateArticle(article.id, ctx.user.id, {
        coverImageUrl,
      });

      return {
        coverImageUrl,
        prompt: cover.prompt,
      };
    }),

  generate: aiProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        sourceUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let title = "";
      let content = "";
      let summary = "";

      // Fallback to built-in LLM
      if (!content) {
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Atue como o ESCRITOR LINKEDIN

Seu Papel e Objetivo:
Você é um redator especialista em mídias sociais, focado na criação de conteúdo para o LinkedIn que gera leads por meio de histórias autênticas. O seu objetivo não é apenas mostrar expertise técnica, mas criar uma conexão genuína por meio de experiências compartilhadas. Você transforma experiências comuns em narrativas envolventes que inspiram ação, atraem clientes ideais e otimizam visitas ao perfil (não apenas curtidas genéricas).

Restrição Absoluta: Posicione o narrador como uma pessoa comum que superou um desafio, não como um "guru" ou especialista intocável.

Princípios de Escrita (Como escrever):

Histórias em vez de conselhos: Nunca dê conselhos de especialistas não solicitados ou conteúdo puramente opinativo. Compartilhe histórias de transformação pessoal que demonstrem lições. Foque na jornada, não apenas no destino, e faça o leitor sentir que pode alcançar o mesmo.

Clareza e Simplicidade: Escreva em um nível de leitura básico (fácil e acessível). Use frases curtas (idealmente 15 palavras ou menos). Divida o texto com quebras de linha a cada 2 ou 3 frases para dar respiro à leitura. Evite jargões, termos técnicos e vocabulário complexo.

Diretrizes de Linguagem:

O que FAZER: Usar tom coloquial, focar nos benefícios, usar linguagem "Eu/Você", ser específico com números e detalhes, compartilhar momentos de vulnerabilidade e comemorar pequenas vitórias.

O que NÃO FAZER: Usar jargão corporativo, fazer generalizações amplas, usar estruturas de frases complexas.

Fórmulas de Gancho (Sempre comece o post com uma variação destas opções):

"Como eu [alcancei um resultado específico] sem [medo/obstáculo comum]..."

"Eu estava em [situação difícil] até que eu percebi [insight-chave]..."

"Esta é a maneira mais simples que encontrei de [atingir a meta]..."

"Há [período de tempo], eu não conseguia [fazer nada]. Hoje, [resultado da transformação]..."

A Estrutura Obrigatória do Post (Framework de Transformação):

Gancho (Hook): 1 frase baseada em curiosidade para prender a atenção (use as fórmulas acima).

Problema (O Estado "Antes"): 2 a 3 frases descrevendo uma luta ou obstáculo que gere identificação.

Jornada (O Processo): 3 a 4 frases descrevendo brevemente o esforço, desafio enfrentado ou a "virada de chave".

Resolução (O Estado "Depois"): 2 a 3 frases compartilhando o resultado, a lição prática ou a vitória alcançada.

Chamada para Ação (CTA): Finalize o post com uma pergunta específica para incentivar o engajamento (Ex: "Qual é a sua maior dificuldade com [tópico] no momento?", "Qual é o pequeno passo que você poderia dar esta semana?").

Estratégia Visual (Sempre que sugerir imagens ao usuário):
Recomende o uso de fotos que mostrem rostos humanos autênticos (de preferência o do autor), exemplos de antes/depois, cores vibrantes que se destaquem no feed ou gráficos muito simples que ilustrem o ponto principal.

Sempre que eu te passar um tema ou uma ideia, aplique todas essas regras e escreva o post perfeito para o LinkedIn. Responda apenas "Entendido. Estou pronto para escrever como o ESCRITOR LINKEDIN! Qual é o seu primeiro tema?" para confirmar.
              
Formato de resposta JSON:
{
  "title": "Título do artigo (máx 80 chars)",
  "summary": "Resumo em 2-3 frases",
  "content": "Artigo completo em markdown com introdução, desenvolvimento (3-5 seções com ##) e conclusão"
}`,
            },
            {
              role: "user",
              content: `Escreva um artigo completo sobre: "${input.topic}"${input.sourceUrl ? `\n\nReferência: ${input.sourceUrl}` : ""}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "article",
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
          parsed = JSON.parse((typeof rawArticle === "string" ? rawArticle : JSON.stringify(rawArticle)) || "{}");
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O agente redator retornou uma resposta invalida." });
        }
        title = String(parsed.title || input.topic);
        content = String(parsed.content || "");
        summary = String(parsed.summary || "");
      }

      const saved = await db.saveArticle(ctx.user.id, {
        title,
        topic: input.topic,
        sourceUrl: input.sourceUrl,
        content,
        summary,
      });
      return saved;
    }),

  publishLinkedIn: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await db.getArticle(input.id, ctx.user.id);
      if (!article) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artigo nao encontrado" });
      }

      const result = await publishArticleToLinkedInWithAgent({
        title: article.title,
        content: article.content,
        summary: article.summary,
        topic: article.topic,
        sourceUrl: article.sourceUrl,
        coverImageUrl: article.coverImageUrl,
      });

      await db.updateArticle(article.id, ctx.user.id, {
        status: "published",
      });

      try {
        const savedPost = await db.saveSocialPost(ctx.user.id, {
          channel: "linkedin",
          title: article.title,
          content: result.commentary,
          imageUrl: article.coverImageUrl ?? undefined,
        });
        await db.updateSocialPost(savedPost.id, ctx.user.id, {
          status: "published",
          publishedAt: new Date(),
        });
      } catch (err) {
        console.warn("[Articles] LinkedIn publish succeeded but history save failed:", err);
      }

      return result;
    }),

  diagnoseLinkedIn: protectedProcedure.mutation(async () => {
    return diagnoseLinkedInAuth();
  }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      coverImageUrl: z.string().optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateArticle(id, ctx.user.id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteArticle(input.id, ctx.user.id);
      return { success: true };
    }),

  generateNewsletter: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await db.getArticle(input.id, ctx.user.id);
      if (!article) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artigo não encontrado" });
      }

      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "user",
            content: `Você é um especialista em newsletters de e-mail. Transforme o artigo abaixo em conteúdo estruturado para uma newsletter visual em português brasileiro.

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "preheader": "texto de preview curto (máx 90 caracteres)",
  "intro": "parágrafo de abertura da newsletter (2-3 frases, tom próximo e direto com o leitor)",
  "highlights": [
    {"heading": "título do destaque", "text": "texto do destaque (2-3 frases)"}
  ],
  "conclusion": "parágrafo de fechamento com reflexão ou convite à leitura (2-3 frases)",
  "ctaText": "texto do botão de CTA (ex: Leia o artigo completo)"
}

Inclua de 3 a 4 highlights com os pontos mais importantes do artigo. Use linguagem clara e envolvente.

Título: ${article.title}
Conteúdo: ${article.content.slice(0, 4000)}`,
          },
        ],
        maxTokens: 1500,
      });

      const rawContent = llmResponse.choices[0]?.message?.content;
      const llmText = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? "");

      let newsletterData: {
        preheader: string;
        intro: string;
        highlights: { heading: string; text: string }[];
        conclusion: string;
        ctaText: string;
      };

      try {
        const jsonMatch = llmText.match(/\{[\s\S]*\}/);
        newsletterData = JSON.parse(jsonMatch?.[0] ?? llmText);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro ao processar conteúdo da newsletter. Tente novamente.",
        });
      }

      const htmlContent = buildNewsletterHtml({
        title: article.title,
        coverImageUrl: article.coverImageUrl,
        sourceUrl: article.sourceUrl,
        ...newsletterData,
      });

      return { subject: article.title, htmlContent };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getArticleCount(ctx.user.id);
    return { count };
  }),
});

// ─── Posts Router ─────────────────────────────────────────────────────────────
const carouselEditorSettingsSchema = z.object({
  titleOffsetX: z.number().optional(),
  titleOffsetY: z.number().optional(),
  titleScale: z.number().optional(),
  bodyOffsetX: z.number().optional(),
  bodyOffsetY: z.number().optional(),
  bodyScale: z.number().optional(),
  imageOffsetX: z.number().optional(),
  imageOffsetY: z.number().optional(),
  imageScale: z.number().optional(),
  imageRotation: z.number().optional(),
  imageBrightness: z.number().optional(),
  imageContrast: z.number().optional(),
  imageSaturate: z.number().optional(),
  titleColor: z.string().optional(),
  bodyColor: z.string().optional(),
});

const carouselSlideSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  profileId: z.string().optional(),
  // Agent-generated metadata (round-trips through frontend)
  slideType: z.enum(["hook", "development", "cta"]).optional(),
  shortText: z.string().optional(),
  imagePrompt: z.string().optional(),
  backgroundPrompt: z.string().optional(),
  visualDirection: z.string().optional(),
  layoutNotes: z.string().optional(),
  highlightWords: z.array(z.string()).optional(),
  wordStyles: z.array(z.object({
    word: z.string(),
    color: z.string().optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
  })).optional(),
  editableFields: z.object({
    title: z.boolean(),
    text: z.boolean(),
    image: z.boolean(),
    background: z.boolean(),
    cta: z.boolean(),
  }).optional(),
  // Design/template fields
  designTemplateName: z.string().optional(),
  designTemplateUrl: z.string().optional(),
  designStyleBrief: z.string().optional(),
  templateSvgUrl: z.string().optional(),
  renderedImageUrl: z.string().optional(),
  fontFamily: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  titleColor: z.string().optional(),
  bodyColor: z.string().optional(),
  editorSettings: carouselEditorSettingsSchema.optional(),
});

const carouselBaseSchema = z.object({
  topic: z.string().min(1).max(500),
  style: z.string().min(1).max(100),
  hook: z.string().optional(),
  caption: z.string().optional(),
  finalCta: z.string().optional(),
  coverImageUrl: z.string().optional(),
  createdAt: z.string().optional(),
});

const carouselTemplateInputSchema = z
  .object({
    name: z.string().trim().min(2).max(255),
    imageUrl: z.string().optional(),
    imageDataUrl: z.string().optional(),
  })
  .refine((value) => Boolean(value.imageUrl || value.imageDataUrl), {
    message: "Envie a imagem do template para salvar o estilo.",
    path: ["imageDataUrl"],
  });

const carouselRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getCarousels(ctx.user.id);
  }),

  getTemplates: protectedProcedure.query(async ({ ctx }) => {
    return db.getCarouselTemplates(ctx.user.id);
  }),

  createTemplate: protectedProcedure
    .input(carouselTemplateInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const preparedTemplate = await saveCarouselTemplateAsset({
          userId: ctx.user.id,
          name: input.name,
          imageUrl: input.imageUrl,
          imageDataUrl: input.imageDataUrl,
        });

        return await db.saveCarouselTemplate(ctx.user.id, {
          name: input.name,
          imageUrl: preparedTemplate.imageUrl,
          styleBrief: preparedTemplate.styleBrief,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao salvar template visual: ${
            err instanceof Error ? err.message : "falha desconhecida"
          }`,
        });
      }
    }),

  fetchArticle: aiProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      let html: string;
      try {
        html = await fetchUrlText(input.url);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível acessar a URL. Verifique se o link está correto e acessível." });
      }

      const title =
        stripHtml(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] || "") ||
        getMetaContent(html, ["og:title", "twitter:title"]) ||
        "";
      const articleText = extractArticleTextFromHtml(html);

      if (!articleText || articleText.length < 100) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível extrair o conteúdo do artigo. Tente uma URL diferente." });
      }

      const summaryResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Você é um editor de conteúdo especialista. Analise o artigo e retorne um JSON com: topic (string, tema direto e impactante para um carrossel no Instagram, máx 120 chars) e summary (string, resumo dos principais fatos e dados do artigo, máx 500 chars). Sem explicações extras.",
          },
          {
            role: "user",
            content: `Título: ${title}\n\nConteúdo:\n${articleText.slice(0, 4000)}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = summaryResponse.choices[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : "{}";
      let parsed: { topic?: string; summary?: string } = {};
      try { parsed = JSON.parse(raw); } catch { /* fallback below */ }

      return {
        title,
        topic: parsed.topic || title,
        summary: parsed.summary || articleText.slice(0, 500),
        articleContext: `Título: ${title}\n\nResumo: ${parsed.summary || ""}\n\nConteúdo:\n${articleText.slice(0, 3000)}`,
      };
    }),

  generate: aiProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        slideCount: z.number().int().min(1).max(10),
        carouselFormat: z.enum(["feed", "story"]).optional(),
        style: z.string().min(1).max(100),
        profileId: z.string().optional(),
        templateId: z.number().int().positive().optional(),
        coverImageUrl: z.string().optional(),
        coverImageDataUrl: z.string().optional(),
        useAiImages: z.boolean().optional(),
        articleContext: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const selectedTemplate = input.templateId
          ? await db.getCarouselTemplate(input.templateId, ctx.user.id)
          : undefined;

        if (input.templateId && !selectedTemplate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template visual nao encontrado.",
          });
        }

        const templateImageDataUrl = selectedTemplate?.imageUrl
          ? await getCarouselAssetDataUrl(selectedTemplate.imageUrl)
          : undefined;
        const selectedStyle = selectedTemplate?.name || input.style;

        const generatedCarousel = await generateCarouselWithAgent({
          topic: input.topic,
          slideCount: input.slideCount,
          carouselFormat: input.carouselFormat ?? "feed",
          style: selectedStyle,
          profileId: input.profileId,
          coverImageUrl: input.coverImageUrl,
          coverImageDataUrl: input.coverImageDataUrl,
          templateName: selectedTemplate?.name,
          templateStyleBrief: selectedTemplate?.styleBrief ?? undefined,
          templateImageUrl: selectedTemplate?.imageUrl,
          templateImageDataUrl,
          useAiImages: input.useAiImages ?? false,
          articleContext: input.articleContext,
        });

        const persistedAssets = await persistCarouselAssets({
          userId: ctx.user.id,
          coverImageUrl: generatedCarousel.coverImageUrl,
          slides: generatedCarousel.slides,
        });

        const slides = persistedAssets.slides.map((slide) => ({
          ...slide,
          profileId: input.profileId,
          designTemplateName: selectedTemplate?.name,
          designTemplateUrl: selectedTemplate?.imageUrl,
          designStyleBrief: selectedTemplate?.styleBrief ?? undefined,
        }));

        return await db.saveCarousel(ctx.user.id, {
          topic: input.topic,
          style: selectedStyle,
          hook: generatedCarousel.hook,
          caption: generatedCarousel.caption,
          finalCta: generatedCarousel.finalCta,
          coverImageUrl: persistedAssets.coverImageUrl,
          slides,
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao gerar carrossel com o agente: ${
            err instanceof Error ? err.message : "falha ao gerar"
          }`,
        });
      }
    }),

  saveDesignAssets: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        slides: z
          .array(
            carouselSlideSchema.extend({
              templateSvg: z.string().optional(),
              renderedImageDataUrl: z.string().optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const persisted = await persistCarouselDesignAssets({
          userId: ctx.user.id,
          carouselId: input.id,
          slides: input.slides,
        });

        const updated = await db.updateCarouselSlides(input.id, ctx.user.id, persisted.slides);
        if (!updated) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Carrossel nao encontrado para salvar o template",
          });
        }

        return updated;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao salvar as imagens completas do carrossel: ${
            err instanceof Error ? err.message : "falha desconhecida"
          }`,
        });
      }
    }),

  resolveAssetDataUrl: protectedProcedure
    .input(z.object({ url: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        const dataUrl = await getCarouselAssetDataUrl(input.url);
        if (!dataUrl) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Nao foi possivel resolver a imagem do template",
          });
        }

        return { dataUrl };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao carregar a imagem do template: ${
            err instanceof Error ? err.message : "falha desconhecida"
          }`,
        });
      }
    }),

  generateCaptionFromImage: aiProcedure
    .input(z.object({ imageDataUrl: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: input.imageDataUrl, detail: "auto" },
              },
              {
                type: "text",
                text: "Analise esta imagem e crie uma legenda envolvente para Instagram em português brasileiro. A legenda deve ser atraente, usar hashtags relevantes e ter um CTA natural no final. Retorne apenas a legenda pronta, sem títulos ou explicações.",
              },
            ],
          },
        ],
      });
      const caption = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : "";
      return { caption };
    }),

  importImages: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(1).max(500),
        hook: z.string().max(1000).optional(),
        caption: z.string().max(5000).optional(),
        finalCta: z.string().max(500).optional(),
        profileId: z.string().optional(),
        slides: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              imageDataUrl: z.string().min(1),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const persistedSlides = await Promise.all(
        input.slides.map(async (slide, index) => {
          const url = await persistSingleCarouselImage({
            userId: ctx.user.id,
            imageDataUrl: slide.imageDataUrl,
          });
          return {
            title: slide.title,
            body: "",
            profileId: input.profileId,
            renderedImageUrl: url,
            imageUrl: url,
          } as import("../drizzle/schema").CarouselSlideData;
        })
      );

      return db.saveCarousel(ctx.user.id, {
        topic: input.topic,
        style: "importado",
        hook: input.hook ?? input.topic,
        caption: input.caption ?? "",
        finalCta: input.finalCta ?? "",
        coverImageUrl: persistedSlides[0]?.renderedImageUrl,
        slides: persistedSlides,
      });
    }),

  publishInstagram: protectedProcedure
    .input(
      carouselBaseSchema.extend({
        slides: z
          .array(
            carouselSlideSchema.extend({
              imageDataUrl: z.string().optional(),
              svg: z.string().optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await publishInstagramCarouselWithAgent({
          userId: ctx.user.id,
          topic: input.topic,
          hook: input.hook,
          caption: input.caption,
          finalCta: input.finalCta,
          slides: input.slides,
        });

        try {
          const savedPost = await db.saveSocialPost(ctx.user.id, {
            channel: "instagram",
            title: input.hook || input.topic,
            content: result.caption,
            imageUrl: result.slideUrls[0],
          });
          await db.updateSocialPost(savedPost.id, ctx.user.id, {
            status: "published",
            publishedAt: new Date(),
          });
        } catch (err) {
          console.warn("[Carousel] Instagram post was published but history save failed:", err);
        }

        return result;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao postar no Instagram pela Meta API: ${
            err instanceof Error ? err.message : "falha desconhecida"
          }`,
        });
      }
    }),

  scheduleInstagram: protectedProcedure
    .input(
      carouselBaseSchema.extend({
        scheduledAt: scheduledAtInputSchema,
        slides: z
          .array(
            carouselSlideSchema.extend({
              imageDataUrl: z.string().optional(),
              svg: z.string().optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scheduledAt = parseScheduledAtInput(input.scheduledAt);

      if (scheduledAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escolha uma data futura para agendar o carrossel no Instagram.",
        });
      }

      const firstSlideImageUrl =
        input.slides.find((slide) => slide.imageUrl || slide.imageDataUrl)?.imageUrl ||
        input.coverImageUrl;
      const metadata = buildScheduledInstagramCarouselMetadata({
        topic: input.topic,
        hook: input.hook,
        caption: input.caption,
        finalCta: input.finalCta,
        slides: input.slides,
      });

      const savedPost = await db.saveSocialPost(ctx.user.id, {
        channel: "instagram",
        title: input.hook || input.topic,
        content: input.caption || input.hook || input.topic,
        imageUrl: firstSlideImageUrl,
        metadata,
        scheduledAt,
      });

      return {
        success: true,
        postId: savedPost.id,
        scheduledAt: savedPost.scheduledAt,
        timeZone: getPostSchedulerTimeZone(),
      };
    }),

  updateContent: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        hook: z.string(),
        caption: z.string(),
        finalCta: z.string(),
        slides: z
          .array(
            carouselSlideSchema
          )
          .min(1)
          .max(10),
        designSettings: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await db.updateCarouselContent(input.id, ctx.user.id, {
        hook: input.hook,
        caption: input.caption,
        finalCta: input.finalCta,
        slides: input.slides.map((s) => ({ ...s, body: s.body ?? "" })),
        designSettings: input.designSettings,
      });
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Carrossel não encontrado." });
      }
      return updated;
    }),

  uploadSlideImage: protectedProcedure
    .input(z.object({ imageDataUrl: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const url = await persistSingleCarouselImage({
          userId: ctx.user.id,
          imageDataUrl: input.imageDataUrl,
        });
        return { url };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao enviar imagem: ${err instanceof Error ? err.message : "falha desconhecida"}`,
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCarousel(input.id, ctx.user.id);
      return { success: true };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCarouselTemplate(input.id, ctx.user.id);
      return { success: true };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getCarouselCount(ctx.user.id);
    return { count };
  }),

  getTrendingTopics: protectedProcedure
    .input(z.object({ niche: z.string().max(100).optional() }))
    .query(async ({ input }) => {
      const today = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "user",
            content: `Você é um especialista em marketing digital e tendências do Instagram Brasil. Data: ${today}.

Gere 8 temas virais para carrosséis no Instagram. ${input.niche ? `Nicho: ${input.niche}.` : "Foque em negócios, marketing, empreendedorismo, finanças pessoais e produtividade para o público brasileiro."}

Critérios:
- Alto potencial de salvamento (conteúdo prático e aplicável)
- Gancho que para o scroll em menos de 1 segundo
- Baseado em dores reais do público brasileiro atual
- Formato de revelação ou lista numerada (ideal para carrossel)
- Alinhado com o algoritmo do Instagram 2025 (maximize saves e shares)

Retorne APENAS JSON válido:
{
  "topics": [
    {
      "topic": "tema completo (ex: '5 erros que todo empreendedor comete no início')",
      "category": "categoria curta (ex: Empreendedorismo)",
      "hook": "gancho impactante de 8-10 palavras para o primeiro slide",
      "emoji": "emoji relevante"
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = llmResponse.choices[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : "{}";
      let parsed: { topics?: Array<{ topic: string; category: string; hook: string; emoji: string }> } = {};
      try { parsed = JSON.parse(raw); } catch { /* fallback */ }

      return { topics: parsed.topics ?? [] };
    }),

  // ── Regeneration endpoints ────────────────────────────────────────────────

  regenerateSlide: aiProcedure
    .input(z.object({
      carouselId: z.number().int().positive(),
      slideIndex: z.number().int().min(0).max(9),
      topic: z.string().min(1).max(500),
      hook: z.string().max(500),
      totalSlides: z.number().int().min(1).max(10),
      slideType: z.enum(["hook", "development", "cta"]),
      currentSlides: z.array(carouselSlideSchema).min(1).max(10),
      profileId: z.string().optional(),
      format: z.enum(["feed", "story"]).optional(),
      style: z.string().optional(),
      useAiImages: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const newSlide = await regenerateSlide({
        topic: input.topic,
        hook: input.hook,
        totalSlides: input.totalSlides,
        slideIndex: input.slideIndex,
        slideType: input.slideType,
        profileId: input.profileId,
        format: input.format,
        style: input.style,
        useAiImages: input.useAiImages ?? false,
      });

      const updatedSlides = input.currentSlides.map((s, i) =>
        i === input.slideIndex
          ? { ...s, ...newSlide, profileId: s.profileId ?? input.profileId }
          : s
      );

      const saved = await db.updateCarouselSlides(
        input.carouselId,
        ctx.user.id,
        updatedSlides as import("../drizzle/schema").CarouselSlideData[]
      );

      if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Carrossel não encontrado." });
      return saved;
    }),

  regenerateSlideText: aiProcedure
    .input(z.object({
      carouselId: z.number().int().positive(),
      slideIndex: z.number().int().min(0).max(9),
      topic: z.string().min(1).max(500),
      hook: z.string().max(500),
      slideType: z.enum(["hook", "development", "cta"]),
      currentTitle: z.string().max(500),
      currentBody: z.string().max(1000),
      currentSlides: z.array(carouselSlideSchema).min(1).max(10),
      profileId: z.string().optional(),
      instruction: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const newText = await regenerateSlideText({
        topic: input.topic,
        hook: input.hook,
        slideType: input.slideType,
        currentTitle: input.currentTitle,
        currentBody: input.currentBody,
        profileId: input.profileId,
        instruction: input.instruction,
      });

      const updatedSlides = input.currentSlides.map((s, i) =>
        i === input.slideIndex
          ? {
              ...s,
              profileId: s.profileId ?? input.profileId,
              title: newText.title,
              body: newText.body,
              shortText: newText.shortText,
              highlightWords: newText.highlightWords,
            }
          : s
      );

      const saved = await db.updateCarouselSlides(
        input.carouselId,
        ctx.user.id,
        updatedSlides as import("../drizzle/schema").CarouselSlideData[]
      );

      if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Carrossel não encontrado." });
      return { carousel: saved, newText };
    }),

  regenerateSlideImage: aiProcedure
    .input(z.object({
      carouselId: z.number().int().positive(),
      slideIndex: z.number().int().min(0).max(9),
      topic: z.string().min(1).max(500),
      hook: z.string().max(500),
      slideTitle: z.string().max(500),
      slideBody: z.string().max(1000),
      currentSlides: z.array(carouselSlideSchema).min(1).max(10),
      imagePrompt: z.string().optional(),
      profileId: z.string().optional(),
      useAiImages: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await regenerateSlideImage({
        topic: input.topic,
        hook: input.hook,
        slideTitle: input.slideTitle,
        slideBody: input.slideBody,
        slideIndex: input.slideIndex,
        imagePrompt: input.imagePrompt,
        profileId: input.profileId,
        useAiImages: input.useAiImages ?? false,
      });

      const updatedSlides = input.currentSlides.map((s, i) =>
        i === input.slideIndex
          ? {
              ...s,
              profileId: s.profileId ?? input.profileId,
              imageUrl: result.imageUrl,
              imagePrompt: result.imagePrompt,
            }
          : s
      );

      const saved = await db.updateCarouselSlides(
        input.carouselId,
        ctx.user.id,
        updatedSlides as import("../drizzle/schema").CarouselSlideData[]
      );

      if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Carrossel não encontrado." });
      return { carousel: saved, imageUrl: result.imageUrl, imagePrompt: result.imagePrompt };
    }),

  regenerateCaption: aiProcedure
    .input(z.object({
      carouselId: z.number().int().positive(),
      topic: z.string().min(1).max(500),
      hook: z.string().max(500),
      finalCta: z.string().max(500),
      slides: z.array(z.object({ title: z.string(), body: z.string().optional() })).min(1).max(10),
      currentSlides: z.array(carouselSlideSchema).min(1).max(10),
      profileId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await regenerateCaption({
        topic: input.topic,
        hook: input.hook,
        slides: input.slides.map((s) => ({ title: s.title, body: s.body ?? "" })),
        profileId: input.profileId,
        cta: input.finalCta,
      });

      const saved = await db.updateCarouselContent(input.carouselId, ctx.user.id, {
        hook: input.hook,
        caption: result.caption,
        finalCta: result.cta,
        slides: input.currentSlides as import("../drizzle/schema").CarouselSlideData[],
      });

      if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Carrossel não encontrado." });
      return { carousel: saved, caption: result.caption, hashtags: result.hashtags, cta: result.cta };
    }),

  uploadRenderedSlides: protectedProcedure
    .input(
      z.object({
        carouselId: z.number().int().positive(),
        dataUrls: z.array(z.string().min(1)).min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("./storage");
      const urls = await Promise.all(
        input.dataUrls.map(async (dataUrl, i) => {
          const commaIdx = dataUrl.indexOf(",");
          if (commaIdx < 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `URL inválida no slide ${i + 1}` });
          }
          const mimeType = dataUrl.slice(5, commaIdx).split(";")[0] || "image/jpeg";
          const ext = mimeType.includes("png") ? "png" : "jpg";
          const buffer = Buffer.from(dataUrl.slice(commaIdx + 1), "base64");
          const key = `rendered/${ctx.user.id}/${input.carouselId}/slide-${String(i + 1).padStart(2, "0")}.${ext}`;
          const { url } = await storagePut(key, buffer, mimeType);
          return url;
        })
      );
      return { urls };
    }),

  persistImages: protectedProcedure
    .input(
      z.object({
        carouselId: z.number().int().positive(),
        slides: z.array(
          z.object({
            title: z.string(),
            body: z.string().optional(),
            imageUrl: z.string().optional(),
            slideType: z.enum(["hook", "development", "cta"]).optional(),
            shortText: z.string().optional(),
            imagePrompt: z.string().optional(),
            highlightWords: z.array(z.string()).optional(),
          })
        ).min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("./storage");
      const updatedSlides = await Promise.all(
        input.slides.map(async (slide, i) => {
          const url = slide.imageUrl;
          if (!url || !url.startsWith("http") || url.includes("amazonaws.com")) {
            return slide;
          }
          try {
            const res = await fetch(url, {
              headers: { "User-Agent": "KrythosLab/1.0 carousel-persist" },
              signal: AbortSignal.timeout(12_000),
            });
            if (!res.ok) return slide;
            const buffer = Buffer.from(await res.arrayBuffer());
            const contentType = res.headers.get("content-type") ?? "image/jpeg";
            const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
            const key = `proto/${ctx.user.id}/${input.carouselId}/slide-${String(i + 1).padStart(2, "0")}.${ext}`;
            const { url: s3Url } = await storagePut(key, buffer, contentType);
            return { ...slide, imageUrl: s3Url };
          } catch {
            return slide;
          }
        })
      );
      return { slides: updatedSlides };
    }),

  analyzeInstagramProfile: protectedProcedure
    .input(z.object({ usernameOrUrl: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const { analyzeInstagramProfileStyle } = await import("./_core/instagramStyleAgent");

      const connection = await db.getInstagramConnection(ctx.user.id);

      try {
        const result = await analyzeInstagramProfileStyle({
          username: input.usernameOrUrl,
          connectedAccount: connection
            ? {
                instagramAccountId: connection.instagramAccountId,
                accessToken: connection.accessToken,
                username: connection.username ?? undefined,
                name: connection.name,
                profilePictureUrl: connection.profilePictureUrl,
              }
            : null,
        });
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao analisar perfil: ${err instanceof Error ? err.message : "falha desconhecida"}`,
        });
      }
    }),
});

const postsRouter = router({
  getAll: protectedProcedure
    .input(z.object({
      channel: z.enum(["instagram", "linkedin", "newsletter"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getSocialPosts(ctx.user.id, input.channel);
    }),

  create: protectedProcedure
    .input(
      z
        .object({
          channel: z.enum(["instagram", "linkedin", "newsletter"]),
          title: z.string().optional(),
          content: z.string().min(1),
          imageUrl: z
            .string()
            .refine(
              (value) =>
                /^https?:\/\//i.test(value) ||
                value.startsWith("data:image/") ||
                value.startsWith("data:video/") ||
                value.startsWith("/uploads/"),
              "Informe uma URL de mídia válida."
            )
            .optional(),
          extraImageUrls: z.array(z.string().url()).optional(),
          scheduledAt: scheduledAtInputSchema.optional(),
        })
        .superRefine((value, ctx) => {
          if (value.channel === "instagram" && value.scheduledAt && !value.imageUrl?.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["imageUrl"],
              message: "Para agendar no Instagram, adicione uma imagem ou vídeo ao post.",
            });
          }
        })
    )
    .mutation(async ({ ctx, input }) => {
      const { scheduledAt: scheduledAtInput, extraImageUrls, ...data } = input;
      const scheduledAt = scheduledAtInput
        ? parseScheduledAtInput(scheduledAtInput)
        : undefined;

      if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escolha uma data futura para agendar a postagem.",
        });
      }

      // Upload base64 images to storage before saving to DB
      let imageUrl = data.imageUrl;
      if (imageUrl?.startsWith("data:")) {
        imageUrl = await persistSingleCarouselImage({ userId: ctx.user.id, imageDataUrl: imageUrl });
      }

      // Store additional images in metadata
      const metadata = extraImageUrls && extraImageUrls.length > 0
        ? JSON.stringify({ imageUrls: [imageUrl, ...extraImageUrls].filter(Boolean) })
        : undefined;

      const saved = await db.saveSocialPost(ctx.user.id, { ...data, imageUrl, metadata, scheduledAt });
      return saved;
    }),

  generateContent: protectedProcedure
    .input(z.object({
      channel: z.enum(["instagram", "linkedin", "newsletter"]),
      topic: z.string().min(3),
      tone: z.enum(["professional", "casual", "inspiring", "educational"]).optional().default("professional"),
    }))
    .mutation(async ({ ctx, input }) => {
      const brand = await db.getBrandKit(ctx.user.id);

      const toneGuide: Record<string, string> = {
        professional: "profissional e direto",
        casual: "casual e próximo",
        inspiring: "inspirador e motivacional",
        educational: "educativo e informativo",
      };

      const effectiveTone = brand?.toneOfVoice ?? input.tone;

      const channelGuide: Record<string, string> = {
        instagram: `legenda para Instagram em português brasileiro otimizada para o algoritmo 2025.

ESTRUTURA OBRIGATÓRIA:
1. GANCHO (linha 1-2, visível antes do "ver mais"): 5-10 palavras — dado surpreendente, pergunta provocadora ou afirmação ousada. SEM emoji na primeira linha.
2. DESENVOLVIMENTO: 3-5 frases curtas em parágrafos de 1-2 linhas. Use emojis como separadores estruturais. Inclua keywords do tema naturalmente no texto (aumentam 30% de alcance via busca semântica).
3. CTA FINAL: UM único CTA específico com benefício claro — peça salvamento ("Salva pra consultar quando precisar de X"), compartilhamento ("Manda pra quem precisa ver isso") ou comentário ("Me conta nos comentários: qual foi o seu maior desafio com X?"). NUNCA peça curtida.
4. HASHTAGS: exatamente 3-5 ao final. Priorize nicho (50K-500K posts). Nunca mais que 5.
Tamanho ideal: 800-1500 caracteres. Tom: ${toneGuide[effectiveTone]}.`,

        linkedin: `post para LinkedIn em português brasileiro — tom profissional mas acessível, máx 3000 chars.
Estrutura: gancho forte na primeira linha, desenvolvimento com insight real, no máximo 3 hashtags relevantes ao final.
Tom: ${toneGuide[effectiveTone]}.`,

        newsletter: `newsletter por email em português brasileiro — assunto atrativo, saudação, conteúdo de valor com seções claras, CTA final.
Tom: ${toneGuide[effectiveTone]}.`,
      };

      const brandContext = brand?.companyName
        ? [
            `IDENTIDADE DA MARCA:`,
            `- Empresa: ${brand.companyName}${brand.industry ? ` (${brand.industry})` : ""}`,
            brand.tagline ? `- Tagline: "${brand.tagline}"` : null,
            brand.targetAudience ? `- Público-alvo: ${brand.targetAudience}` : null,
            brand.brandValues ? `- Valores: ${brand.brandValues}` : null,
            `- Tom de voz: ${toneGuide[effectiveTone]}`,
            `\nO conteúdo DEVE refletir a identidade desta marca. Use o nome da empresa quando natural. Mantenha consistência com os valores e o tom definidos.`,
          ].filter(Boolean).join("\n")
        : null;

      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: [
              `Você é um especialista em copywriting para redes sociais e conhece profundamente o algoritmo do Instagram. Crie conteúdo em português brasileiro que maximize engajamento real (salvamentos, compartilhamentos e comentários).`,
              brandContext,
            ].filter(Boolean).join("\n\n"),
          },
          {
            role: "user",
            content: `Crie ${channelGuide[input.channel]} sobre o tema: "${input.topic}".

Responda em JSON:
{
  "title": "título ou assunto (para newsletter, ou gancho resumido para instagram/linkedin)",
  "content": "conteúdo completo pronto para publicar"
}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "post_content",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["title", "content"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawPost = llmResponse.choices[0]?.message?.content;
      const parsed = JSON.parse((typeof rawPost === 'string' ? rawPost : JSON.stringify(rawPost)) || "{}");
      return { title: parsed.title || "", content: parsed.content || "" };
    }),

  generateContentFromImage: aiProcedure
    .input(z.object({
      imageDataUrl: z.string().min(1),
      channel: z.enum(["instagram", "linkedin", "newsletter"]),
    }))
    .mutation(async ({ input }) => {
      const channelGuide: Record<string, string> = {
        instagram: "uma legenda envolvente para Instagram em português brasileiro, com emojis, hashtags relevantes e um CTA natural no final (máx ~2000 chars)",
        linkedin: "um post profissional para LinkedIn em português brasileiro, com insights valiosos, tom formal mas acessível e no máximo 2-3 hashtags relevantes (máx ~2500 chars)",
        newsletter: "um texto de email marketing em português brasileiro, com saudação, parágrafo de corpo bem escrito e uma chamada para ação clara (máx ~500 chars de pré-visualização)",
      };

      const response = await invokeLLM({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: input.imageDataUrl, detail: "auto" },
              },
              {
                type: "text",
                text: `Analise esta imagem e crie ${channelGuide[input.channel]}. Retorne apenas o conteúdo pronto para publicar, sem títulos ou explicações adicionais.`,
              },
            ],
          },
        ],
      });

      const content = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content.trim()
        : "";
      return { content };
    }),

  generateContentFromVideo: aiProcedure
    .input(z.object({
      videoUrl: z.string().url(),
      channel: z.enum(["instagram", "linkedin", "newsletter"]),
    }))
    .mutation(async ({ input }) => {
      const channelGuide: Record<string, string> = {
        instagram: "uma legenda envolvente para Instagram em português brasileiro, com emojis, hashtags relevantes e um CTA natural no final (máx ~2000 chars)",
        linkedin: "um post profissional para LinkedIn em português brasileiro, com insights valiosos, tom formal mas acessível e no máximo 2-3 hashtags relevantes (máx ~2500 chars)",
        newsletter: "um texto de email marketing em português brasileiro, com saudação, parágrafo de corpo bem escrito e uma chamada para ação clara (máx ~500 chars de pré-visualização)",
      };

      // Try to transcribe video audio with Whisper
      let transcript = "";
      try {
        const videoRes = await fetch(input.videoUrl);
        if (videoRes.ok) {
          const buffer = await videoRes.arrayBuffer();
          const sizeMB = buffer.byteLength / (1024 * 1024);
          if (sizeMB <= 25) {
            // Detect file extension from URL or content-type
            const contentType = videoRes.headers.get("content-type") ?? "video/mp4";
            const ext = /\.mov(\?|$)/i.test(input.videoUrl) ? "mov"
              : /\.webm(\?|$)/i.test(input.videoUrl) ? "webm"
              : "mp4";
            const formData = new FormData();
            formData.append("file", new Blob([buffer], { type: contentType }), `video.${ext}`);
            formData.append("model", "whisper-1");
            formData.append("response_format", "text");
            formData.append("language", "pt");
            const whisperRes = await fetch(`${ENV.openaiApiBaseUrl}/audio/transcriptions`, {
              method: "POST",
              headers: { authorization: `Bearer ${ENV.openaiApiKey}` },
              body: formData,
            });
            if (whisperRes.ok) {
              transcript = (await whisperRes.text()).trim();
            }
          }
        }
      } catch (e) {
        console.warn("[generateContentFromVideo] Whisper transcription failed:", e);
      }

      const contextText = transcript
        ? `Transcrição do áudio do vídeo:\n"${transcript}"\n\nCom base nessa transcrição, crie ${channelGuide[input.channel]}.`
        : `Crie ${channelGuide[input.channel]} para um vídeo de marketing. Use um tom envolvente e criativo.`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: contextText }],
      });

      const content = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content.trim()
        : "";
      return { content };
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const posts = await db.getSocialPosts(ctx.user.id);
      const post = posts.find((p) => p.id === input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado" });

      if (post.channel === "instagram") {
        const { result, publicImageUrl } = await publishInstagramSocialPost(post);

        await db.updateSocialPost(input.id, ctx.user.id, {
          status: "published",
          publishedAt: new Date(),
          imageUrl: publicImageUrl,
        });

        return {
          success: true,
          status: "published" as const,
          mediaId: result.mediaId,
          imageUrl: publicImageUrl,
        };
      }

      await db.updateSocialPost(input.id, ctx.user.id, {
        status: "published",
        publishedAt: new Date(),
      });

      return { success: true, status: "published" as const };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().optional(),
      title: z.string().optional(),
      scheduledAt: z.union([scheduledAtInputSchema, z.null()]).optional(),
      status: z.enum(["draft", "scheduled", "published", "failed"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, scheduledAt: scheduledAtInput, ...data } = input;
      const scheduledAt =
        scheduledAtInput === undefined || scheduledAtInput === null
          ? scheduledAtInput
          : parseScheduledAtInput(scheduledAtInput);

      if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escolha uma data futura para reagendar a postagem.",
        });
      }

      const updateData = {
        ...data,
        ...(scheduledAtInput === undefined
          ? {}
          : {
              scheduledAt,
            }),
      };
      await db.updateSocialPost(id, ctx.user.id, updateData);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteSocialPost(input.id, ctx.user.id);
      return { success: true };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getPostCount(ctx.user.id);
    return { count };
  }),

  sendForApproval: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const posts = await db.getSocialPosts(ctx.user.id);
      const post = posts.find((p) => p.id === input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado." });

      const { sendApprovalMessage, isWhatsAppConfigured } = await import("./_core/whatsapp.js");
      if (!isWhatsAppConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "WhatsApp não configurado. Preencha WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN e WHATSAPP_RECIPIENT_NUMBER no .env",
        });
      }

      const { nanoid } = await import("nanoid");
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

      await db.setSocialPostPendingApproval(input.id, ctx.user.id, token, expiresAt);

      const baseUrl = ENV.appBaseUrl.replace(/\/$/, "");
      const result = await sendApprovalMessage({
        postId: post.id,
        channel: post.channel,
        content: post.content,
        imageUrl: post.imageUrl,
        scheduledAt: post.scheduledAt,
        approveUrl: `${baseUrl}/api/posts/approve/${token}`,
        rejectUrl: `${baseUrl}/api/posts/reject/${token}`,
      });

      if (result.error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao enviar WhatsApp: ${result.error}` });
      }

      return { success: true };
    }),
});

// ─── Brand Kit Router ─────────────────────────────────────────────────────────

const brandKitRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return db.getBrandKit(ctx.user.id);
  }),

  save: protectedProcedure
    .input(z.object({
      companyName: z.string().max(255).optional(),
      tagline: z.string().max(512).optional(),
      logoUrl: z.string().optional(),
      industry: z.string().max(128).optional(),
      targetAudience: z.string().max(2000).optional(),
      brandValues: z.string().max(2000).optional(),
      toneOfVoice: z.enum(["professional", "casual", "inspiring", "educational"]).optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      instagramHandle: z.string().max(128).optional(),
      linkedinUrl: z.string().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.saveBrandKit(ctx.user.id, input);
    }),
});

// ─── Canva Router ─────────────────────────────────────────────────────────────
const canvaRouter = router({
  getClientId: publicProcedure.query(() => ({ clientId: ENV.canvaClientId })),

  getConnection: protectedProcedure.query(async ({ ctx }) => {
    const conn = await db.getCanvaConnection(ctx.user.id);
    if (!conn) return null;
    return {
      canvaUserId: conn.canvaUserId,
      displayName: conn.displayName,
      email: conn.email,
      profilePictureUrl: conn.profilePictureUrl,
      connectedAt: conn.connectedAt.toISOString(),
      tokenExpiresAt: conn.tokenExpiresAt?.toISOString() ?? null,
    };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await db.deleteCanvaConnection(ctx.user.id);
    return { success: true };
  }),

  listDesigns: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      continuation: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const conn = await db.getCanvaConnection(ctx.user.id);
      if (!conn) throw new TRPCError({ code: "UNAUTHORIZED", message: "Conecte sua conta Canva primeiro." });

      let accessToken = conn.accessToken;

      // Refresh token if within 5 min of expiry
      if (conn.tokenExpiresAt && conn.refreshToken) {
        const expiresIn = conn.tokenExpiresAt.getTime() - Date.now();
        if (expiresIn < 5 * 60 * 1_000) {
          try {
            const fresh = await refreshCanvaToken(conn.refreshToken);
            accessToken = fresh.access_token;
            await db.upsertCanvaConnection({
              ...conn,
              accessToken: fresh.access_token,
              refreshToken: fresh.refresh_token ?? conn.refreshToken,
              tokenExpiresAt: new Date(Date.now() + fresh.expires_in * 1_000),
            });
          } catch {
            // use existing token, may still be valid
          }
        }
      }

      const result = await listCanvaDesigns(accessToken, {
        query: input.query,
        continuation: input.continuation,
        limit: input.limit,
      });

      return {
        designs: result.items.map((d) => ({
          id: d.id,
          title: d.title || "Sem título",
          thumbnailUrl: d.thumbnail?.url ?? null,
          editUrl: d.urls?.edit_url ?? null,
          updatedAt: d.updated_at ? new Date(d.updated_at * 1000).toISOString() : null,
        })),
        continuation: result.continuation ?? null,
      };
    }),

  exportDesign: protectedProcedure
    .input(z.object({
      designId: z.string().min(1),
      format: z.enum(["jpg", "png"]).optional().default("jpg"),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await db.getCanvaConnection(ctx.user.id);
      if (!conn) throw new TRPCError({ code: "UNAUTHORIZED", message: "Conecte sua conta Canva primeiro." });

      const urls = await exportCanvaDesign(conn.accessToken, input.designId, input.format);
      return { urls };
    }),

  createDesign: protectedProcedure
    .input(z.object({
      title: z.string().optional(),
      width: z.number().int().positive().optional().default(1080),
      height: z.number().int().positive().optional().default(1350),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await db.getCanvaConnection(ctx.user.id);
      if (!conn) throw new TRPCError({ code: "UNAUTHORIZED", message: "Conecte sua conta Canva primeiro." });

      const design = await createCanvaDesign(conn.accessToken, {
        title: input.title,
        width: input.width,
        height: input.height,
      });
      return {
        id: design.id,
        title: design.title,
        editUrl: design.urls?.edit_url ?? null,
        thumbnailUrl: design.thumbnail?.url ?? null,
      };
    }),
});

// ─── Settings Router ──────────────────────────────────────────────────────────
// ─── App Router ───────────────────────────────────────────────────────────────
function graphUrl(path: string) {
  const base = (ENV.metaGraphApiBaseUrl || "https://graph.facebook.com").replace(/\/+$/, "");
  const version = (ENV.metaGraphApiVersion || "v25.0").replace(/^\/+/, "");
  return `${base}/${version}/${path}`;
}

async function graphGet<T>(path: string, params: Record<string, string> = {}, accessToken?: string): Promise<T> {
  const token = accessToken || ENV.metaAccessToken;
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${graphUrl(path)}?${qs}`);
  const data = await res.json() as T & { error?: { message?: string } };
  if (!res.ok || (data as { error?: { message?: string } }).error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: (data as { error?: { message?: string } }).error?.message ?? "Erro na API do Instagram",
    });
  }
  return data;
}

async function getInstagramCredentials(userId: number) {
  try {
    const connection = await db.getInstagramConnection(userId);
    if (connection?.accessToken && connection?.instagramAccountId) {
      return { accessToken: connection.accessToken, igAccountId: connection.instagramAccountId };
    }
  } catch {
    // DB may not have the table yet — fall back to ENV
  }
  if (!ENV.metaAccessToken || !ENV.metaInstagramAccountId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nenhuma conta Instagram conectada. Faça login com o Instagram para continuar.",
    });
  }
  return { accessToken: ENV.metaAccessToken, igAccountId: ENV.metaInstagramAccountId };
}

async function linkedInGet<T>(endpoint: string, accessToken: string): Promise<T> {
  const apiBase = (ENV.linkedinApiBaseUrl || "https://api.linkedin.com/rest").replace(/\/+$/, "");
  const apiVersion = (ENV.linkedinApiVersion || "202601").trim();
  const url = endpoint.startsWith("http") ? endpoint : `${apiBase}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Linkedin-Version": apiVersion,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Erro na LinkedIn API (${res.status}): ${text || res.statusText}`,
    });
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const analyticsRouter = router({
  saveInstagramCredentials: protectedProcedure
    .input(z.object({
      instagramAccountId: z.string().min(1),
      accessToken: z.string().min(1),
      username: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertInstagramConnection({
        userId: ctx.user.id,
        instagramAccountId: input.instagramAccountId,
        accessToken: input.accessToken,
        username: input.username,
        connectedAt: new Date(),
      });
      return { success: true };
    }),

  disconnectInstagram: protectedProcedure.mutation(async ({ ctx }) => {
    await db.deleteInstagramConnection(ctx.user.id);
    return { success: true };
  }),

  diagnoseInstagramToken: protectedProcedure.mutation(async ({ ctx }) => {
    const graphBase = (ENV.metaGraphApiBaseUrl || "https://graph.facebook.com").replace(/\/+$/, "");
    const version = (ENV.metaGraphApiVersion || "v25.0").replace(/^\/+/, "");

    let token = "";
    let tokenSource = "";

    try {
      const connection = await db.getInstagramConnection(ctx.user.id);
      if (connection?.accessToken) {
        token = connection.accessToken;
        tokenSource = `banco (conta: ${connection.username ?? connection.instagramAccountId})`;
      }
    } catch { /* ignore */ }

    if (!token) {
      token = ENV.metaAccessToken;
      tokenSource = ".env (META_ACCESS_TOKEN)";
    }

    if (!token) {
      return {
        ok: false,
        tokenSource: "nenhum",
        error: "Nenhum token configurado. Defina META_ACCESS_TOKEN no .env ou conecte sua conta em Configurações → Instagram.",
        details: null,
      };
    }

    const igAccountId = ENV.metaInstagramAccountId;

    try {
      // 1. Debug token
      const debugRes = await fetch(
        `${graphBase}/debug_token?input_token=${token}&access_token=${token}`
      );
      const debugData = await debugRes.json() as {
        data?: {
          is_valid?: boolean;
          expires_at?: number;
          scopes?: string[];
          type?: string;
          app_id?: string;
          error?: { message?: string; code?: number };
        };
        error?: { message?: string; code?: number };
      };

      if (debugData.error || !debugData.data?.is_valid) {
        const errMsg = debugData.error?.message ?? debugData.data?.error?.message ?? "Token inválido";
        return {
          ok: false,
          tokenSource,
          error: `Token inválido: ${errMsg}`,
          details: debugData.data ?? null,
        };
      }

      const expiresAt = debugData.data.expires_at;
      const expiresIn = expiresAt ? Math.round((expiresAt * 1000 - Date.now()) / 86400000) : null;
      const scopes = debugData.data.scopes ?? [];
      const requiredScopes = ["instagram_basic", "instagram_content_publish", "pages_read_engagement"];
      const missingScopes = requiredScopes.filter(s => !scopes.includes(s));

      // 2. Test account access
      let accountOk = false;
      let accountError = "";
      if (igAccountId) {
        const accRes = await fetch(
          `${graphBase}/${version}/${igAccountId}?fields=id,username&access_token=${token}`
        );
        const accData = await accRes.json() as { id?: string; username?: string; error?: { message?: string } };
        if (accData.error) {
          accountError = accData.error.message ?? "Sem acesso à conta";
        } else {
          accountOk = true;
        }
      }

      return {
        ok: missingScopes.length === 0 && (igAccountId ? accountOk : true),
        tokenSource,
        tokenType: debugData.data.type,
        expiresInDays: expiresIn,
        scopes,
        missingScopes,
        igAccountId: igAccountId || "(não configurado)",
        accountAccessOk: igAccountId ? accountOk : null,
        accountError: accountError || null,
        error: missingScopes.length > 0
          ? `Permissões faltando: ${missingScopes.join(", ")}`
          : accountError || null,
        details: debugData.data,
      };
    } catch (err) {
      return {
        ok: false,
        tokenSource,
        error: `Erro ao verificar token: ${err instanceof Error ? err.message : "falha desconhecida"}`,
        details: null,
      };
    }
  }),

  getInstagramConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    try {
      const connection = await db.getInstagramConnection(ctx.user.id);
      if (connection) {
        return {
          connected: true,
          username: connection.username,
          name: connection.name,
          profilePictureUrl: connection.profilePictureUrl,
          instagramAccountId: connection.instagramAccountId,
          tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
        };
      }
    } catch {
      // table may not exist yet
    }
    return { connected: false };
  }),

  getLinkedInProfile: protectedProcedure.query(async () => {
    if (!ENV.linkedinAccessToken) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "LINKEDIN_ACCESS_TOKEN não configurado." });
    }
    const profile = await linkedInGet<{
      sub?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      email?: string;
    }>("https://api.linkedin.com/v2/userinfo", ENV.linkedinAccessToken);

    const authorUrn = ENV.linkedinAuthorUrn || "";
    const isOrg = /^urn:li:organization:/i.test(authorUrn);
    let followerCount: number | undefined;

    if (isOrg && authorUrn) {
      try {
        const encoded = encodeURIComponent(authorUrn);
        const sizeData = await linkedInGet<{ firstDegreeSize?: number }>(
          `/networkSizes/${encoded}?edgeType=CompanyFollowedByMember`,
          ENV.linkedinAccessToken
        );
        followerCount = sizeData.firstDegreeSize;
      } catch {
        // follower count is optional
      }
    }

    return {
      sub: profile.sub,
      name: profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim(),
      picture: profile.picture,
      email: profile.email,
      authorUrn,
      isOrg,
      followerCount,
    };
  }),

  getLinkedInStats: protectedProcedure.query(async ({ ctx }) => {
    const posts = await db.getSocialPosts(ctx.user.id, "linkedin");
    const published = posts.filter((p) => p.status === "published");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const publishedThisMonth = published.filter(
      (p) => p.publishedAt && new Date(p.publishedAt) >= monthStart
    );

    const recent = published.slice(0, 12).map((p) => ({
      id: p.id,
      title: p.title,
      content: p.content,
      imageUrl: p.imageUrl,
      publishedAt: p.publishedAt?.toISOString() ?? p.createdAt.toISOString(),
      status: p.status,
    }));

    return {
      totalPublished: published.length,
      publishedThisMonth: publishedThisMonth.length,
      totalDrafts: posts.filter((p) => p.status === "draft").length,
      recentPosts: recent,
    };
  }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const { accessToken, igAccountId } = await getInstagramCredentials(ctx.user.id);
    return graphGet<{
      username: string;
      name: string;
      biography: string;
      followers_count: number;
      follows_count: number;
      media_count: number;
      profile_picture_url: string;
      website: string;
    }>(`${igAccountId}`, {
      fields: "username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website",
    }, accessToken);
  }),

  getInsights: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const { accessToken, igAccountId } = await getInstagramCredentials(ctx.user.id);
      const until = Math.floor(Date.now() / 1000);
      const since = until - input.days * 86400;
      const metrics = ["impressions", "reach", "profile_views", "follower_count"] as const;

      const results = await Promise.allSettled(
        metrics.map((metric) =>
          graphGet<{ data: Array<{ name: string; values: Array<{ value: number; end_time: string }> }> }>(
            `${igAccountId}/insights`,
            { metric, period: "day", since: String(since), until: String(until) },
            accessToken
          )
        )
      );

      return metrics.map((metric, i) => {
        const result = results[i];
        const values = result.status === "fulfilled"
          ? (result.value.data?.[0]?.values ?? [])
          : [];
        return { metric, values };
      });
    }),

  getMedia: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(12) }))
    .query(async ({ ctx, input }) => {
      const { accessToken, igAccountId } = await getInstagramCredentials(ctx.user.id);
      type MediaItem = {
        id: string;
        caption?: string;
        media_type: string;
        media_url?: string;
        thumbnail_url?: string;
        timestamp: string;
        like_count: number;
        comments_count: number;
        permalink: string;
      };

      const mediaData = await graphGet<{ data: MediaItem[] }>(
        `${igAccountId}/media`,
        {
          fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink",
          limit: String(input.limit),
        },
        accessToken
      );

      const items = mediaData.data ?? [];
      const withInsights = await Promise.all(
        items.map(async (item) => {
          try {
            const insightsData = await graphGet<{
              data: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>;
            }>(`${item.id}/insights`, { metric: "impressions,reach,saved,shares" }, accessToken);

            const insights: Record<string, number> = {};
            for (const d of insightsData.data ?? []) {
              insights[d.name] = d.value ?? d.values?.[0]?.value ?? 0;
            }
            return { ...item, insights };
          } catch {
            return { ...item, insights: {} as Record<string, number> };
          }
        })
      );

      return withInsights;
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(z.object({
        name: z.string().min(2).max(100),
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if open registration is enabled (default: open)
        const regFlag = await db.getFeatureFlagByKey("open_registration");
        if (regFlag && !regFlag.enabled) {
          throw new TRPCError({ code: "FORBIDDEN", message: "O cadastro público está desativado. Solicite um convite ao administrador." });
        }
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Email já cadastrado" });
        }
        const passwordHash = await hashPassword(input.password);
        const openId = `local_${nanoid()}`;
        await db.upsertUser({ openId, name: input.name, email: input.email, loginMethod: "email", passwordHash });
        const user = await db.getUserByOpenId(openId);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar usuário" });
        const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return user;
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos" });
        }
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos" });
        }
        // Block inactive users
        const isActive = (user as unknown as { isActive?: number | boolean }).isActive;
        if (isActive === 0 || isActive === false) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta está desativada. Entre em contato com o administrador." });
        }
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return user;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  chat: chatRouter,
  images: imagesRouter,
  videos: videosRouter,
  articles: articlesRouter,
  carousel: carouselRouter,
  canva: canvaRouter,
  posts: postsRouter,
  analytics: analyticsRouter,
  admin: adminRouter,
  features: featuresRouter,
  brandKit: brandKitRouter,
});

export type AppRouter = typeof appRouter;
