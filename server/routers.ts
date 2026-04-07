import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { generateCarouselWithAgent } from "./_core/carouselAgent";
import { generateArticleCoverWithDesigner } from "./_core/articleDesignerAgent";
import { generateChatAgentReply } from "./_core/chatAgent";
import { publishInstagramCarouselWithAgent } from "./_core/instagramPostingAgent";
import { storagePut } from "./storage";
import * as db from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./_core/password";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import axios from "axios";

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
      useWebhook: z.boolean().optional().default(false),
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

      let assistantContent = "";

      // Try n8n webhook first if configured
      const user = await db.getUserByOpenId(ctx.user.openId);
      const chatWebhookUrl = user?.n8nWebhookUrl || ENV.n8nChatWebhookUrl;
      if (input.useWebhook && chatWebhookUrl) {
        try {
          const webhookRes = await axios.post(chatWebhookUrl, {
            message: input.content,
            conversationId: input.conversationId,
            userId: ctx.user.id,
            history: historyMessages,
          }, { timeout: 30000 });
          assistantContent = webhookRes.data?.response || webhookRes.data?.text || JSON.stringify(webhookRes.data);
        } catch (err) {
          console.warn("[Chat] n8n webhook failed, falling back to LLM:", err);
        }
      }

      // Fallback to built-in research/chat agent
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

  generate: protectedProcedure
  .input(z.object({
  prompt: z.string(),
  useWebhook: z.boolean(),
  referenceImageUrl:
  z.string().optional()
  }))
    .mutation(async ({ ctx, input }) => {
      let imageUrl = "";

      // Try n8n webhook first
      const user = await db.getUserByOpenId(ctx.user.openId);
      const imageWebhookUrl = user?.n8nImageWebhookUrl || ENV.n8nImageWebhookUrl;
      if (input.useWebhook && imageWebhookUrl) {
        try {
          const webhookRes = await axios.post(imageWebhookUrl, {
            prompt: input.prompt,
            userId: ctx.user.id,
            referenceImageUrl: input.referenceImageUrl,
          }, { timeout: 300000 });

          console.log("[n8n response]", JSON.stringify(webhookRes.data));
          imageUrl = webhookRes.data?.imageUrl || webhookRes.data?.url || webhookRes.data?.imagem_url || webhookRes.data?.imagemurl || "";
        } catch (err) {
          console.warn("[Images] n8n webhook failed, falling back to built-in:", err);
        }
      }

      // Fallback to built-in image generation
      if (!imageUrl) {
        const result = await generateImage({ 
          prompt: input.prompt,
          referenceImageUrl: input.referenceImageUrl,
          }); 
        imageUrl = result.url || "";
      }

      // Save to DB
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

  researchEnergyNews: protectedProcedure
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

  generateFromNews: protectedProcedure
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
      const parsed = JSON.parse((typeof rawArticle === "string" ? rawArticle : JSON.stringify(rawArticle)) || "{}");
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

  generate: protectedProcedure
  .input(z.object({
    topic: z.string().min(3).max(500),
    sourceUrl: z.string().url().optional(),
    useWebhook: z.boolean().optional().default(false),
  }))
  .mutation(async ({ ctx, input }) => {
    let title = "";
    let content = "";
    let summary = "";

    // GARANTA QUE ESSA LINHA EXISTE ANTES DO IF:
    const user = await db.getUserByOpenId(ctx.user.openId);
    const articleWebhookUrl = user?.n8nArticleWebhookUrl || ENV.n8nArticleWebhookUrl;

    if (input.useWebhook && articleWebhookUrl) {
      try {
        const webhookRes = await axios.get(articleWebhookUrl, {
          data: {
            topic: input.topic,
            sourceUrl: input.sourceUrl,
            userId: ctx.user.id,
          },
          timeout: 300000,
        });

        const rawData = webhookRes.data;
        let webhookData = Array.isArray(rawData) ? rawData[0] : rawData;
        if (webhookData?.resposta_site && typeof webhookData.resposta_site === 'string') {
          try {
            webhookData = JSON.parse(webhookData.resposta_site);
          } catch {
            webhookData = Array.isArray(rawData) ? rawData[0] : rawData;
          }
        }

        title = webhookData?.title || webhookData?.titulo || "";
        content = webhookData?.content || webhookData?.article || webhookData?.conteudo || "";
        summary = webhookData?.summary || webhookData?.resumo || "";

      } catch (err) {
        console.warn("[Articles] n8n webhook falhou:", err);
      }
    }

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
        const parsed = JSON.parse((typeof rawArticle === 'string' ? rawArticle : JSON.stringify(rawArticle)) || "{}");
        title = parsed.title || input.topic;
        content = parsed.content || "";
        summary = parsed.summary || "";
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

  publishToLinkedin: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const article = await db.getArticle(input.id, ctx.user.id);
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "Artigo não encontrado" });

      const linkedinWebhookUrl = ENV.n8nLinkedinWebhookUrl;
      if (!linkedinWebhookUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Webhook do LinkedIn não configurado" });

      try {
        await axios.post(linkedinWebhookUrl, {
          id: article.id,
          title: article.title,
          content: article.content,
          summary: article.summary ?? "",
          topic: article.topic ?? "",
          sourceUrl: article.sourceUrl ?? null,
          coverImageUrl: article.coverImageUrl ?? null,
          createdAt: article.createdAt,
        }, { timeout: 30000 });
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao publicar no LinkedIn: " + (err?.message || "falha no webhook") });
      }
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

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getArticleCount(ctx.user.id);
    return { count };
  }),
});

// ─── Posts Router ─────────────────────────────────────────────────────────────
const carouselRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        slideCount: z.number().int().min(1).max(10),
        style: z.string().min(1).max(100),
        coverImageUrl: z.string().optional(),
        coverImageDataUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await generateCarouselWithAgent({
          topic: input.topic,
          slideCount: input.slideCount,
          style: input.style,
          coverImageUrl: input.coverImageUrl,
          coverImageDataUrl: input.coverImageDataUrl,
        });
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao gerar carrossel com o agente: ${err?.message || "falha ao gerar"}`,
        });
      }
    }),

  publish: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(1).max(500),
        style: z.string().min(1).max(100),
        hook: z.string().optional(),
        caption: z.string().optional(),
        finalCta: z.string().optional(),
        coverImageUrl: z.string().optional(),
        createdAt: z.string().optional(),
        slides: z
          .array(
            z.object({
              title: z.string().min(1),
              body: z.string().optional(),
              imageUrl: z.string().optional(),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await db.getUserByOpenId(ctx.user.openId);
      const carouselWebhookUrl = user?.n8nCarouselWebhookUrl || ENV.n8nCarouselWebhookUrl;

      if (!carouselWebhookUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Webhook de postagem do carrossel no n8n nao configurado",
        });
      }

      const slides = input.slides.map((slide, index) => ({
        ...slide,
        order: index + 1,
        imageUrl: slide.imageUrl ? toPublicAssetUrl(ctx.req, slide.imageUrl) : undefined,
      }));

      try {
        const response = await axios.post(
          carouselWebhookUrl,
          {
            type: "carousel_publish",
            channel: "instagram",
            userId: ctx.user.id,
            user: {
              id: ctx.user.id,
              name: ctx.user.name,
              email: ctx.user.email,
            },
            carousel: {
              topic: input.topic,
              style: input.style,
              hook: input.hook || input.slides[0]?.title || input.topic,
              caption: input.caption || "",
              finalCta: input.finalCta || "",
              coverImageUrl: input.coverImageUrl
                ? toPublicAssetUrl(ctx.req, input.coverImageUrl)
                : slides[0]?.imageUrl,
              createdAt: input.createdAt || new Date().toISOString(),
              slides,
            },
          },
          { timeout: 60000 }
        );

        return { success: true, response: response.data };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao disparar postagem pelo n8n: ${err?.message || "falha no webhook"}`,
        });
      }
    }),

  publishInstagram: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(1).max(500),
        style: z.string().min(1).max(100),
        hook: z.string().optional(),
        caption: z.string().optional(),
        finalCta: z.string().optional(),
        coverImageUrl: z.string().optional(),
        createdAt: z.string().optional(),
        slides: z
          .array(
            z.object({
              title: z.string().min(1),
              body: z.string().optional(),
              imageUrl: z.string().optional(),
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
          caption: input.caption,
          finalCta: input.finalCta,
          slides: input.slides,
        });

        try {
          const savedPost = await db.saveSocialPost(ctx.user.id, {
            channel: "instagram",
            title: input.hook || input.topic,
            content: input.caption || input.topic,
            imageUrl: result.slideUrls[0],
          });
          await db.updateSocialPost(savedPost.id, ctx.user.id, {
            status: "published",
            publishedAt: new Date(),
            webhookResponse: JSON.stringify({
              provider: "meta",
              mediaId: result.mediaId,
              containerId: result.containerId,
              childContainerIds: result.childContainerIds,
              slideUrls: result.slideUrls,
            }),
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
    .input(z.object({
      channel: z.enum(["instagram", "linkedin", "newsletter"]),
      title: z.string().optional(),
      content: z.string().min(1),
      imageUrl: z.string().url().optional(),
      scheduledAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const saved = await db.saveSocialPost(ctx.user.id, input);
      return saved;
    }),

  generateContent: protectedProcedure
    .input(z.object({
      channel: z.enum(["instagram", "linkedin", "newsletter"]),
      topic: z.string().min(3),
      tone: z.enum(["professional", "casual", "inspiring", "educational"]).optional().default("professional"),
    }))
    .mutation(async ({ ctx, input }) => {
      const channelGuide: Record<string, string> = {
        instagram: "post para Instagram (máx 2200 chars, use emojis, hashtags relevantes, call-to-action)",
        linkedin: "post para LinkedIn (tom profissional, máx 3000 chars, insights valiosos, sem excessos de hashtags)",
        newsletter: "newsletter por email (assunto atrativo, corpo completo com saudação, conteúdo e CTA)",
      };

      const toneGuide: Record<string, string> = {
        professional: "profissional e formal",
        casual: "casual e amigável",
        inspiring: "inspirador e motivacional",
        educational: "educativo e informativo",
      };

      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um especialista em marketing de conteúdo. Crie conteúdo otimizado para redes sociais em português brasileiro.`,
          },
          {
            role: "user",
            content: `Crie um ${channelGuide[input.channel]} sobre "${input.topic}" com tom ${toneGuide[input.tone]}.
            
Responda em JSON:
{
  "title": "título ou assunto (para newsletter)",
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

  publish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const posts = await db.getSocialPosts(ctx.user.id);
      const post = posts.find((p) => p.id === input.id);
      if (!post) throw new Error("Post não encontrado");

      const user = await db.getUserByOpenId(ctx.user.openId);
      const postWebhookUrl = user?.n8nPostWebhookUrl || ENV.n8nPostWebhookUrl;
      let webhookResponse = "";
      let status: "published" | "failed" = "published";

      if (postWebhookUrl) {
        try {
          const res = await axios.post(postWebhookUrl, {
            postId: post.id,
            channel: post.channel,
            title: post.title,
            content: post.content,
            imageUrl: post.imageUrl,
            userId: ctx.user.id,
          }, { timeout: 30000 });
          webhookResponse = JSON.stringify(res.data);
        } catch (err: any) {
          status = "failed";
          webhookResponse = err?.message || "Webhook error";
        }
      }

      await db.updateSocialPost(input.id, ctx.user.id, {
        status,
        publishedAt: status === "published" ? new Date() : null,
        webhookResponse,
      });

      return { success: status === "published", status };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().optional(),
      title: z.string().optional(),
      scheduledAt: z.date().nullable().optional(),
      status: z.enum(["draft", "scheduled", "published", "failed"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await db.updateSocialPost(id, ctx.user.id, data);
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
});

// ─── Settings Router ──────────────────────────────────────────────────────────
const settingsRouter = router({
  getWebhooks: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserByOpenId(ctx.user.openId);
    return {
      n8nWebhookUrl: user?.n8nWebhookUrl || "",
      n8nImageWebhookUrl: user?.n8nImageWebhookUrl || "",
      n8nArticleWebhookUrl: user?.n8nArticleWebhookUrl || "",
      n8nPostWebhookUrl: user?.n8nPostWebhookUrl || "",
      n8nCarouselWebhookUrl: user?.n8nCarouselWebhookUrl || "",
      hasChat: !!(user?.n8nWebhookUrl || ENV.n8nChatWebhookUrl),
      hasImage: !!(user?.n8nImageWebhookUrl || ENV.n8nImageWebhookUrl),
      hasArticle: !!(user?.n8nArticleWebhookUrl || ENV.n8nArticleWebhookUrl),
      hasPost: !!(user?.n8nPostWebhookUrl || ENV.n8nPostWebhookUrl),
      hasCarousel: !!(user?.n8nCarouselWebhookUrl || ENV.n8nCarouselWebhookUrl),
    };
  }),

  updateWebhooks: protectedProcedure
    .input(z.object({
      n8nWebhookUrl: z.string().optional(),
      n8nImageWebhookUrl: z.string().optional(),
      n8nArticleWebhookUrl: z.string().optional(),
      n8nPostWebhookUrl: z.string().optional(),
      n8nCarouselWebhookUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserWebhooks(ctx.user.id, {
        n8nWebhookUrl: input.n8nWebhookUrl || null,
        n8nImageWebhookUrl: input.n8nImageWebhookUrl || null,
        n8nArticleWebhookUrl: input.n8nArticleWebhookUrl || null,
        n8nPostWebhookUrl: input.n8nPostWebhookUrl || null,
        n8nCarouselWebhookUrl: input.n8nCarouselWebhookUrl || null,
      });
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
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
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Email já cadastrado" });
        }
        const passwordHash = await hashPassword(input.password);
        const openId = `local_${nanoid()}`;
        await db.upsertUser({
          openId,
          name: input.name,
          email: input.email,
          loginMethod: "email",
          passwordHash,
        });
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
  articles: articlesRouter,
  carousel: carouselRouter,
  posts: postsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
