import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import * as db from "./db";
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
      if (input.useWebhook && user?.n8nWebhookUrl) {
        try {
          const webhookRes = await axios.post(user.n8nWebhookUrl, {
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

      // Fallback to built-in LLM
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
      if (input.useWebhook && user?.n8nImageWebhookUrl) {
        try {
          const webhookRes = await axios.post(user.n8nImageWebhookUrl, {
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
const articlesRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getArticles(ctx.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getArticle(input.id, ctx.user.id);
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

    if (input.useWebhook && user?.n8nArticleWebhookUrl) {
      try {
        const webhookRes = await axios.post(user.n8nArticleWebhookUrl, {
          topic: input.topic,
          sourceUrl: input.sourceUrl,
          userId: ctx.user.id,
        }, { timeout: 300000 });

        console.log("[n8n articles response]", JSON.stringify(webhookRes.data));

        let webhookData = webhookRes.data;
        if (webhookData?.resposta_site && typeof webhookData.resposta_site === 'string') {
          try {
            webhookData = JSON.parse(webhookData.resposta_site);
          } catch {
            webhookData = webhookRes.data;
          }
        }

        title = webhookData?.title || webhookData?.titulo || "";
        content = webhookData?.content || webhookData?.article || webhookData?.conteudo || "";
        summary = webhookData?.summary || webhookData?.resumo || "";

      } catch (err) {
        console.warn("[Articles] n8n webhook failed, falling back to LLM:", err);
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

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
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
      let webhookResponse = "";
      let status: "published" | "failed" = "published";

      if (user?.n8nPostWebhookUrl) {
        try {
          const res = await axios.post(user.n8nPostWebhookUrl, {
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
    };
  }),

  updateWebhooks: protectedProcedure
    .input(z.object({
      n8nWebhookUrl: z.string().optional(),
      n8nImageWebhookUrl: z.string().optional(),
      n8nArticleWebhookUrl: z.string().optional(),
      n8nPostWebhookUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserWebhooks(ctx.user.id, {
        n8nWebhookUrl: input.n8nWebhookUrl || null,
        n8nImageWebhookUrl: input.n8nImageWebhookUrl || null,
        n8nArticleWebhookUrl: input.n8nArticleWebhookUrl || null,
        n8nPostWebhookUrl: input.n8nPostWebhookUrl || null,
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
  posts: postsRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
