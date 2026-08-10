import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminRouter, featuresRouter } from "./_core/adminRouter";
import { aiProcedure, protectedProcedure, publicProcedure, publicRateLimitedProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { buildNewsletterHtml } from "./_core/newsletterTemplate";
import { generateImage, reformatImageToTarget, type ImageStyle, type ImageSize } from "./_core/imageGeneration";
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
import { generateReelsScript } from "./_core/reelsScriptAgent";
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
  deleteHeyGenTalkingPhoto,
  deleteHeyGenAvatar,
  createDigitalTwinAvatar,
  checkDigitalTwinStatus,
  generateDigitalTwinVideo,
  requestDigitalTwinConsentUrl,
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
import { getCalibrationBlock } from "./_core/calibration";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./_core/password";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { TEMPLATE_REGISTRY, getTemplatesForNiche } from './_core/templateRegistry';
import {
  StorySetSchema,
  STORY_TYPES,
  type StorySetPayload,
} from "./_core/storyContentSchema";

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

// ─── Trial Limits ─────────────────────────────────────────────────────────────
export const TRIAL_DAILY_LIMITS = {
  images:   5,
  carousel: 3,
  articles: 3,
  posts:    1,
} as const;

type TrialFeature = keyof typeof TRIAL_DAILY_LIMITS;

type PlanUser = { plan?: string; trialExpiresAt?: Date | null; role?: string };

type TrialStatus = 'paid' | 'trial' | 'expired' | 'legacy';

function getTrialState(user: PlanUser): { isPaid: boolean; status: TrialStatus } {
  // Admins always have full access regardless of plan
  if ((user as any).role === 'admin') return { isPaid: true, status: 'paid' };
  const plan = (user as any).plan ?? 'free';
  if (plan === 'pro' || plan === 'agency') return { isPaid: true, status: 'paid' };
  const expires = user.trialExpiresAt instanceof Date ? user.trialExpiresAt : null;
  // Legacy accounts (no trialExpiresAt): treat as having trial access without expiry
  if (!expires) return { isPaid: false, status: 'legacy' };
  if (expires > new Date()) return { isPaid: false, status: 'trial' };
  return { isPaid: false, status: 'expired' };
}

// Enforce daily limit for features available in trial. Paid and legacy users skip entirely.
async function checkAndIncrTrialUsage(
  userId: number,
  user: PlanUser,
  feature: TrialFeature,
): Promise<void> {
  const { isPaid, status } = getTrialState(user);
  if (isPaid || status === 'legacy') return;

  if (status === 'expired') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Seu período de teste gratuito expirou. Assine um plano para continuar usando a plataforma.',
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const used  = await db.getDailyUsageCount(userId, feature, today);
  const limit = TRIAL_DAILY_LIMITS[feature];

  if (used >= limit) {
    const labels: Record<TrialFeature, string> = {
      images: 'imagens', carousel: 'carrosséis', articles: 'artigos', posts: 'posts',
    };
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Você atingiu o limite diário de ${limit} ${labels[feature]} no trial gratuito. Faça upgrade para continuar sem restrições.`,
    });
  }

  await db.incrementDailyUsage(userId, feature, today);
}

// Block access entirely unless account has agency plan (or admin).
function requireAgencyPlan(user: PlanUser): void {
  if ((user as { role?: string }).role === 'admin') return;
  const plan = (user as { plan?: string }).plan ?? 'free';
  if (plan !== 'agency') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Este recurso está disponível apenas no plano Agency. Faça upgrade para desbloquear.',
    });
  }
}

// Block access entirely unless account has a paid plan.
function requirePaidPlan(user: PlanUser): void {
  const { isPaid, status } = getTrialState(user);
  if (isPaid) return;
  if (status === 'expired') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Seu período de teste gratuito expirou. Assine um plano para continuar usando a plataforma.',
    });
  }
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Este recurso está disponível apenas nos planos pagos. Faça upgrade para desbloquear.',
  });
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
      requirePaidPlan(ctx.user as PlanUser);
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
          max_tokens: 800,
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
        nicheId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkAndIncrTrialUsage(ctx.user.id, ctx.user as PlanUser, 'images');
      const [brand, nicheData] = await Promise.all([
        db.getBrandKit(ctx.user.id),
        input.nicheId ? db.getNicheProfile(input.nicheId) : Promise.resolve(null),
      ]);

      const effectiveNicheId = input.nicheId ?? (brand as unknown as { nicheId?: string })?.nicheId ?? undefined;
      const resolvedNiche = nicheData ?? (effectiveNicheId && effectiveNicheId !== input.nicheId
        ? await db.getNicheProfile(effectiveNicheId)
        : null);

      const brandContext = brand
        ? [
            brand.companyName ? `Company name: ${brand.companyName}` : null,
            brand.industry ? `Industry/sector: ${brand.industry}` : null,
            (brand.primaryColor && brand.primaryColor !== "#6366f1")
              ? `Brand color palette — primary: ${brand.primaryColor}${brand.secondaryColor && brand.secondaryColor !== "#8b5cf6" ? `, secondary: ${brand.secondaryColor}` : ""}${brand.accentColor && brand.accentColor !== "#06b6d4" ? `, accent: ${brand.accentColor}` : ""}. These colors MUST be used as the dominant palette.`
              : null,
          ].filter(Boolean).join(". ")
        : undefined;

      const result = await generateImage({
        prompt: input.prompt,
        referenceImageUrl: input.referenceImageUrl,
        style: input.style as ImageStyle | undefined,
        size: input.size as ImageSize | undefined,
        brandContext,
        nicheProfile: resolvedNiche?.visualGrammar as import("./_core/imageGeneration").NicheVisualGrammar | undefined,
      });
      const imageUrl = result.url || "";

      const saved = await db.saveImage(ctx.user.id, input.prompt, imageUrl);
      const { getMetaFetchableStorageUrl } = await import("./storage");
      const displayUrl = await getMetaFetchableStorageUrl(imageUrl).catch(() => imageUrl);
      return { ...saved, displayUrl };
    }),

  generateVariations: aiProcedure
    .input(z.object({
      prompt: z.string().min(1),
      nicheId: z.string().optional(),
      style: z.enum(["commercial", "produto", "banner", "social", "logo", "lifestyle"]).optional(),
      count: z.number().min(1).max(4).default(3),
    }))
    .mutation(async ({ ctx, input }) => {
      await checkAndIncrTrialUsage(ctx.user.id, ctx.user as PlanUser, 'images');
      const [brand, nicheData] = await Promise.all([
        db.getBrandKit(ctx.user.id),
        input.nicheId ? db.getNicheProfile(input.nicheId) : Promise.resolve(null),
      ]);

      const effectiveNicheId = input.nicheId ?? (brand as unknown as { nicheId?: string })?.nicheId ?? undefined;
      const resolvedNiche = nicheData ?? (effectiveNicheId && effectiveNicheId !== input.nicheId
        ? await db.getNicheProfile(effectiveNicheId)
        : null);

      const brandContext = brand
        ? [
            brand.companyName ? `Company name: ${brand.companyName}` : null,
            brand.industry ? `Industry/sector: ${brand.industry}` : null,
            (brand.primaryColor && brand.primaryColor !== "#6366f1")
              ? `Brand color palette — primary: ${brand.primaryColor}${brand.secondaryColor ? `, secondary: ${brand.secondaryColor}` : ""}${brand.accentColor ? `, accent: ${brand.accentColor}` : ""}. Use as dominant palette.`
              : null,
          ].filter(Boolean).join(". ")
        : undefined;

      const nicheProfile = resolvedNiche?.visualGrammar as import("./_core/imageGeneration").NicheVisualGrammar | undefined;

      const creativeAngles = [
        `${input.prompt} — editorial composition, high contrast, dramatic professional lighting`,
        `${input.prompt} — soft natural light, lifestyle aesthetic, authentic warm atmosphere`,
        `${input.prompt} — bold graphic design, strong typography, vibrant brand colors`,
        `${input.prompt} — minimal clean layout, negative space, premium editorial feel`,
      ].slice(0, input.count);

      const results = await Promise.all(
        creativeAngles.map((p) =>
          generateImage({
            prompt: p,
            style: input.style as ImageStyle | undefined ?? "commercial",
            brandContext,
            nicheProfile,
          }).catch(() => ({ url: "" }))
        )
      );

      const { getMetaFetchableStorageUrl } = await import("./storage");
      const variations = await Promise.all(
        results.map(async (r) => {
          if (!r.url) return null;
          const displayUrl = await getMetaFetchableStorageUrl(r.url).catch(() => r.url);
          await db.saveImage(ctx.user.id, input.prompt, r.url ?? "").catch(() => null);
          return { url: displayUrl };
        })
      );

      return { variations: variations.filter(Boolean) };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteImage(input.id, ctx.user.id);
      return { success: true };
    }),

  reformat: aiProcedure
    .input(z.object({
      id: z.number(),
      format: z.enum(["square", "portrait", "story"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const image = await db.getImageById(input.id, ctx.user.id);
      if (!image) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Imagem não encontrada" });
      }

      const result = await reformatImageToTarget(image.imageUrl, input.format, image.prompt);

      if (result.usedAI) {
        await checkAndIncrTrialUsage(ctx.user.id, ctx.user as PlanUser, "images");
      }

      const saved = await db.saveImage(
        ctx.user.id,
        `${image.prompt} (reformatado: ${input.format})`,
        result.url,
        undefined,
        result.width,
        result.height
      );
      const { getMetaFetchableStorageUrl } = await import("./storage");
      const displayUrl = await getMetaFetchableStorageUrl(result.url).catch(() => result.url);
      return { ...saved, displayUrl };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getImageCount(ctx.user.id);
    return { count };
  }),
});

// A HeyGen às vezes lista o "look" do Digital Twin como existente (o que nosso
// checkDigitalTwinStatus interpreta como "ready") antes de terminar de processar o
// consentimento internamente — daí a geração de vídeo rejeita com
// avatar_consent_required mesmo com o avatar aparecendo pronto. Quando isso acontece,
// marcamos com esta mensagem e aplicamos um cooldown antes de voltar a confiar no
// "ready" reportado pela HeyGen, pra evitar que o status pisque de "pendente" pra
// "pronto" de novo antes da HeyGen realmente terminar.
const DIGITAL_TWIN_CONSENT_REJECTED_MESSAGE =
  "A HeyGen ainda nao confirmou o consentimento. Reenvie o vídeo de consentimento abaixo.";
const DIGITAL_TWIN_CONSENT_COOLDOWN_MS = 2 * 60 * 1000;

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
        // Usa o Digital Twin (avatar treinado a partir de um video real do usuario,
        // corpo inteiro e movimento natural) em vez do Photo Avatar (so anima a boca).
        useDigitalTwin: z.boolean().optional(),
      }).refine((value) => value.useDigitalTwin || Boolean(value.sourceImageUrl || value.sourceImageDataUrl), {
        message: "Envie a foto da pessoa para gerar o video.",
        path: ["sourceImageDataUrl"],
      })
    )
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      const normalizedScript = input.script.replace(/\s+/g, " ").trim();

      // === Caminho Digital Twin: reusa o avatar 3D ja treinado, sem foto nova ===
      if (input.useDigitalTwin) {
        if (input.provider !== "heygen") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O Avatar 3D so esta disponivel com o motor HeyGen." });
        }
        if (!input.voiceId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma voz para continuar." });
        }
        const twin = await db.getHeygenDigitalTwin(ctx.user.id);
        if (!twin || twin.status !== "ready" || !twin.avatarId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Seu Avatar 3D ainda nao esta pronto. Crie ou aguarde o treinamento terminar em Videos.",
          });
        }

        const fallbackTitleTwin = (
          input.topic?.trim() ||
          normalizedScript.split(/[.!?]/)[0] ||
          "Video com Avatar 3D"
        ).slice(0, 512);

        const savedTwin = await db.saveAvatarVideo(ctx.user.id, {
          title: input.title?.trim() || fallbackTitleTwin,
          topic: input.topic?.trim(),
          script: normalizedScript,
          sourceImageUrl: "",
          provider: "heygen",
          voiceProvider: "heygen",
          voiceId: input.voiceId,
          status: "processing",
        });

        try {
          const videoId = await generateDigitalTwinVideo({
            avatarId: twin.avatarId,
            script: normalizedScript,
            voiceId: input.voiceId,
            emotion: input.emotion,
          });

          await db.updateAvatarVideo(savedTwin.id, ctx.user.id, { providerJobId: videoId, errorMessage: null });

          const completed = await waitForHeyGenCompletion(videoId, { provider: "v3" });
          const stored = await downloadAndStoreHeyGenVideo({
            userId: ctx.user.id,
            videoId: savedTwin.id,
            resultUrl: completed.resultUrl,
          });

          const updatedTwin = await db.updateAvatarVideo(savedTwin.id, ctx.user.id, {
            videoUrl: stored.videoUrl,
            status: "completed",
            errorMessage: null,
          });

          if (!updatedTwin) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O video foi gerado, mas nao consegui salvar o resultado final." });
          }

          return updatedTwin;
        } catch (err) {
          const message = err instanceof Error ? err.message : "falha desconhecida";
          await db.updateAvatarVideo(savedTwin.id, ctx.user.id, { status: "failed", errorMessage: message });

          // A HeyGen as vezes processa o consentimento de forma assincrona e so acusa
          // "avatar_consent_required" na hora de gerar o video, mesmo apos o envio
          // inicial. Volta o status do twin para pending_consent para reabilitar o
          // botao de reenviar consentimento na UI, em vez de deixar preso em "ready".
          if (message.includes("avatar_consent_required") || message.includes("requires consent")) {
            const twinRecord = await db.getHeygenDigitalTwin(ctx.user.id);
            if (twinRecord) {
              await db.upsertHeygenDigitalTwin({
                userId: ctx.user.id,
                groupId: twinRecord.groupId,
                avatarId: null,
                name: twinRecord.name,
                status: "pending_consent",
                errorMessage: DIGITAL_TWIN_CONSENT_REJECTED_MESSAGE,
              });
            }
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A HeyGen ainda nao confirmou o consentimento do seu Avatar 3D. Reenvie o vídeo de consentimento em Vídeos e tente novamente.",
            });
          }

          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao gerar video com Avatar 3D: ${message}` });
        }
      }

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
          const { videoId, talkingPhotoId, provider: heygenProvider } = await createHeyGenAvatarVideo({
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

          try {
            const completed = await waitForHeyGenCompletion(videoId, { provider: heygenProvider });
            const stored = await downloadAndStoreHeyGenVideo({
              userId: ctx.user.id,
              videoId: saved.id,
              resultUrl: completed.resultUrl,
            });
            videoUrl = stored.videoUrl;
          } finally {
            // Deleta o avatar após o uso para não acumular e atingir o limite
            if (heygenProvider === "v3") {
              await deleteHeyGenAvatar(talkingPhotoId);
            } else {
              await deleteHeyGenTalkingPhoto(talkingPhotoId);
            }
          }
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

  // === Digital Twin (avatar 3D treinado do video real do usuario) ===

  getDigitalTwinStatus: protectedProcedure.query(async ({ ctx }) => {
    const twin = await db.getHeygenDigitalTwin(ctx.user.id);
    if (!twin) return { exists: false as const };

    // Se a geracao de video acabou de rejeitar por falta de consentimento, o "look" do
    // avatar ainda aparece listado na HeyGen (o que reconciliaria pra "ready" abaixo) —
    // por isso aguardamos um cooldown antes de voltar a confiar nesse sinal, pra nao
    // o status ficar piscando entre "pendente" e "pronto" sem a HeyGen ter de fato
    // terminado de processar o consentimento internamente.
    const consentJustRejectedByGeneration =
      twin.status === "pending_consent" &&
      twin.errorMessage === DIGITAL_TWIN_CONSENT_REJECTED_MESSAGE &&
      Date.now() - twin.updatedAt.getTime() < DIGITAL_TWIN_CONSENT_COOLDOWN_MS;

    // Reconsulta a HeyGen sempre que nao tiver falhado — inclui "ready" de proposito:
    // se o avatarId salvo estiver errado (bug conhecido, HeyGen nao documenta bem o
    // formato de resposta do digital twin), isso se autocorrige a cada carregamento
    // da pagina sem precisar retreinar do zero.
    if (twin.status !== "failed" && !consentJustRejectedByGeneration) {
      try {
        const check = await checkDigitalTwinStatus(twin.groupId);
        if (check.status !== twin.status || (check.avatarId && check.avatarId !== twin.avatarId)) {
          await db.upsertHeygenDigitalTwin({
            userId: ctx.user.id,
            groupId: twin.groupId,
            avatarId: check.avatarId ?? twin.avatarId,
            name: twin.name,
            status: check.status,
            errorMessage: check.status === "failed" ? "O treinamento do avatar falhou na HeyGen." : null,
          });
        }
        return {
          exists: true as const,
          name: twin.name,
          status: check.status,
          errorMessage: check.status === "failed" ? "O treinamento do avatar falhou na HeyGen." : null,
        };
      } catch (err) {
        console.warn("[Videos] Falha ao consultar status do Digital Twin:", err);
      }
    }

    return { exists: true as const, name: twin.name, status: twin.status, errorMessage: twin.errorMessage };
  }),

  createDigitalTwin: aiProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      // URL publica (upload direto para S3 via /api/request-presigned-upload) — o
      // video de treino e grande demais para o limite de 20mb do body JSON do Express,
      // entao nao passa em base64.
      videoUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);

      const res = await fetch(input.videoUrl);
      if (!res.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nao consegui baixar o video de treino enviado." });
      }
      const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
      const buffer = Buffer.from(await res.arrayBuffer());

      try {
        const { groupId, consentUrl } = await createDigitalTwinAvatar({
          videoBuffer: buffer,
          videoContentType: contentType,
          name: input.name.trim(),
        });

        await db.upsertHeygenDigitalTwin({
          userId: ctx.user.id,
          groupId,
          avatarId: null,
          name: input.name.trim(),
          status: "pending_consent",
          errorMessage: null,
        });

        return { success: true, status: "pending_consent" as const, consentUrl };
      } catch (err) {
        const message = err instanceof Error ? err.message : "falha desconhecida";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao criar Avatar 3D: ${message}` });
      }
    }),

  deleteDigitalTwin: protectedProcedure.mutation(async ({ ctx }) => {
    await db.deleteHeygenDigitalTwin(ctx.user.id);
    return { success: true };
  }),

  // Gera um novo link de consentimento por webcam (o link da HeyGen expira em 24h, ou
  // o usuario pode precisar refazer a gravacao apos uma rejeicao).
  getDigitalTwinConsentUrl: aiProcedure.mutation(async ({ ctx }) => {
    requirePaidPlan(ctx.user as PlanUser);

    const twin = await db.getHeygenDigitalTwin(ctx.user.id);
    if (!twin) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum Avatar 3D encontrado para gerar o link de consentimento." });
    }

    try {
      const consentUrl = await requestDigitalTwinConsentUrl(twin.groupId);
      return { consentUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : "falha desconhecida";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Erro ao gerar link de consentimento: ${message}` });
    }
  }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getAvatarVideoCount(ctx.user.id);
    return { count };
  }),
});

export type EnergyNewsItem = {
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

export const DEFAULT_NEWS_SITES = [
  "https://canalsolar.com.br/",
  "https://www.portalsolar.com.br",
  "https://www.canalenergia.com.br",
  "https://agenciainfra.com/blog",
  "https://eixos.com.br/",
  "https://petronoticias.com.br/",
  "https://agenciabrasil.ebc.com.br/",
  "https://www.pv-magazine-brasil.com",
];

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

export function dedupeNewsItems(items: EnergyNewsItem[]) {
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

export function rankNewsItems(items: EnergyNewsItem[], topic: string) {
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

export async function fetchNewsFromSite(siteUrl: string) {
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

export async function fetchArticleContext(news: z.infer<typeof selectedNewsSchema>) {
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

// The stored coverImageUrl points at a private S3 object (the bucket blocks anonymous
// reads), so it must be re-signed into a fetchable URL every time it's sent to the
// browser — otherwise <img> tags 403. The raw URL is what stays persisted in the DB.
async function withSignedCover<T extends { coverImageUrl?: string | null }>(article: T): Promise<T> {
  if (!article.coverImageUrl) return article;
  const { getMetaFetchableStorageUrl } = await import("./storage");
  const coverImageUrl = await getMetaFetchableStorageUrl(article.coverImageUrl).catch(() => article.coverImageUrl);
  return { ...article, coverImageUrl };
}

const articlesRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const articles = await db.getArticles(ctx.user.id);
    return Promise.all(articles.map(withSignedCover));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const article = await db.getArticle(input.id, ctx.user.id);
      return article ? withSignedCover(article) : article;
    }),

  researchEnergyNews: aiProcedure
    .input(z.object({
      sites: z.array(z.string().url()).min(1).max(12),
      topic: z.string().min(2).max(120).optional().default("energia"),
    }))
    .mutation(async ({ ctx, input }) => {
      const sites = Array.from(new Set(input.sites.map((site) => site.trim()).filter(Boolean)));
      const results = await Promise.allSettled(sites.map((site) => fetchNewsFromSite(site)));
      const allItems = dedupeNewsItems(
        results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      );
      const failedSites = results
        .map((result, index) => (result.status === "rejected" ? sites[index] : ""))
        .filter(Boolean);

      // Drop items older than 7 days; keep items with no date (can't tell age)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentItems = allItems.filter((item) => {
        if (!item.publishedAt) return true;
        const ts = Date.parse(item.publishedAt);
        return !ts || ts >= sevenDaysAgo;
      });

      // Exclude news already delivered to this user in the last 7 days
      const deliveredKeys = await db.getDeliveredNewsKeys(ctx.user.id);
      const freshItems = recentItems.filter(
        (item) => !deliveredKeys.has(normalizeNewsUrl(item.url))
      );

      // Rank fresh items; if fewer than 5 are fresh, supplement with already-seen ones
      const pool = freshItems.length >= 5 ? freshItems : recentItems;
      const topItems = rankNewsItems(pool, input.topic).slice(0, 5);

      if (topItems.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "O agente pesquisador nao encontrou noticias nos sites informados.",
        });
      }

      // Persist what was delivered so future calls skip these
      void db.saveDeliveredNews(ctx.user.id, topItems);

      return {
        items: topItems,
        failedSites,
        freshCount: freshItems.length,
      };
    }),

  generateFromNews: aiProcedure
    .input(z.object({
      news: selectedNewsSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await checkAndIncrTrialUsage(ctx.user.id, ctx.user as PlanUser, 'articles');
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
            content: `Voce e um agente redator especializado no setor de energia. Transforme uma noticia em um artigo claro, profissional e publicavel em portugues brasileiro. Este artigo sera publicado no LinkedIn, uma pagina publica indexada pelo Google e rastreada por buscadores de IA (ChatGPT, Perplexity, Google AI Overviews) — por isso, alem de bem escrito, o texto precisa ser facil de citar.

Regras de conteudo:
- Use somente informacoes presentes no material da noticia.
- Nao invente numeros, nomes, datas ou declaracoes.
- Preserve o contexto da fonte original.
- Explique impactos praticos para empresas, consumidores ou mercado quando o material permitir.
- Evite emojis, sensacionalismo e linguagem generica.
- Se o conteudo capturado for limitado, deixe o artigo mais analitico e conservador.

Regras de estrutura (para ficar citavel por buscadores de IA, sem prejudicar a leitura humana):
- Escreva em markdown, com introducao, 3 a 5 secoes com subtitulos e conclusao. Limite a 600-800 palavras.
- Cada secao deve abrir com uma resposta direta e autocontida de 40-60 palavras (o leitor entende o ponto principal so com esse trecho, antes de qualquer detalhamento).
- Sempre que o material trouxer numeros, datas ou dados concretos, cite-os explicitamente e atribua a fonte (ex: "segundo [fonte]") — isso aumenta a chance do texto ser citado por IA.
- Encerre com uma secao "## Perguntas frequentes" com 2 a 3 perguntas em linguagem natural e respostas curtas, SOMENTE se o material capturado tiver base suficiente para responde-las sem inventar informacao. Se nao tiver, omita essa secao.
- Nao fragmente o texto em pedacos artificiais nem escreva paragrafos separados "para IA" — a estrutura acima serve tanto para quem le quanto para quem indexa.`,
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
        max_tokens: 2_000,
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
      // S3 urls are already absolute; only call toPublicAssetUrl for local /uploads/ paths
      const coverImageUrl = /^https?:\/\//i.test(cover.imageUrl)
        ? cover.imageUrl
        : toPublicAssetUrl(ctx.req, cover.imageUrl);

      const saved = await db.saveArticle(ctx.user.id, {
        title,
        topic: `Energia: ${input.news.title}`,
        sourceUrl: input.news.url,
        coverImageUrl,
        content,
        summary,
      });

      return withSignedCover(saved);
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
      // S3 urls are already absolute; only call toPublicAssetUrl for local /uploads/ paths
      const coverImageUrl = /^https?:\/\//i.test(cover.imageUrl)
        ? cover.imageUrl
        : toPublicAssetUrl(ctx.req, cover.imageUrl);

      await db.updateArticle(article.id, ctx.user.id, {
        coverImageUrl,
      });

      const { coverImageUrl: signedCoverImageUrl } = await withSignedCover({ coverImageUrl });

      return {
        coverImageUrl: signedCoverImageUrl,
        prompt: cover.prompt,
      };
    }),

  generate: aiProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        sourceUrl: z.string().url().optional(),
        sourceTopicAngleId: z.number().int().positive().optional(),
        hookType: z.string().max(32).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkAndIncrTrialUsage(ctx.user.id, ctx.user as PlanUser, 'articles');
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
          max_tokens: 2000,
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
        sourceTopicAngleId: input.sourceTopicAngleId,
        hookType: input.hookType,
        contentFormat: "article",
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

      const connection = await db.getLinkedInConnection(ctx.user.id);
      if (!connection) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Conecte sua conta do LinkedIn em Analytics antes de publicar.",
        });
      }

      const result = await publishArticleToLinkedInWithAgent(
        {
          title: article.title,
          content: article.content,
          summary: article.summary,
          topic: article.topic,
          sourceUrl: article.sourceUrl,
          coverImageUrl: article.coverImageUrl,
        },
        { accessToken: connection.accessToken, authorUrn: connection.authorUrn }
      );

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

  diagnoseLinkedIn: protectedProcedure.mutation(async ({ ctx }) => {
    const connection = await db.getLinkedInConnection(ctx.user.id);
    if (!connection) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Conecte sua conta do LinkedIn em Analytics antes de diagnosticar.",
      });
    }
    return diagnoseLinkedInAuth({ accessToken: connection.accessToken, authorUrn: connection.authorUrn });
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

      const { coverImageUrl } = await withSignedCover(article);
      const htmlContent = buildNewsletterHtml({
        title: article.title,
        coverImageUrl,
        sourceUrl: article.sourceUrl,
        ...newsletterData,
      });

      return { subject: article.title, htmlContent };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getArticleCount(ctx.user.id);
    return { count };
  }),

  getDigestSettings: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserDigestSettings(ctx.user.id);
  }),

  digestSchedulerStatus: protectedProcedure.query(async ({ ctx }) => {
    const { getPostSchedulerTimeZone } = await import("./_core/postScheduling");
    const settings = await db.getUserDigestSettings(ctx.user.id);
    const tz = getPostSchedulerTimeZone();
    const now = new Date();
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const currentMins = hour * 60 + minute;
    const today = now.toLocaleDateString("pt-BR", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const serverTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    if (!settings) return { serverTime, today, timezone: tz, status: "no_settings", message: "Configurações não salvas ainda." };

    const targetMins = settings.digestHour * 60 + settings.digestMinute;
    const windowEnd = targetMins + 30;
    const alreadySentToday = settings.lastSentDate === today;
    const inWindow = currentMins >= targetMins && currentMins < windowEnd;
    const windowPassed = currentMins >= windowEnd;
    const minsUntil = targetMins - currentMins;

    const pad = (n: number) => String(n).padStart(2, "0");
    const targetStr = `${pad(settings.digestHour)}:${pad(settings.digestMinute)}`;
    const windowEndStr = `${pad(Math.floor(windowEnd / 60) % 24)}:${pad(windowEnd % 60)}`;

    let status: string;
    let message: string;
    if (alreadySentToday) {
      status = "sent_today";
      message = `Digest já enviado hoje. Próximo envio: amanhã às ${targetStr}.`;
    } else if (inWindow) {
      status = "in_window";
      message = `Dentro da janela de envio (${targetStr}–${windowEndStr}). Enviando em breve...`;
    } else if (windowPassed) {
      status = "window_passed";
      message = `Janela de hoje passou (${targetStr}–${windowEndStr}). Próximo: amanhã.`;
    } else {
      status = "waiting";
      message = `Aguardando... faltam ${minsUntil} min para ${targetStr} (janela até ${windowEndStr}).`;
    }

    return { serverTime, today, timezone: tz, status, message };
  }),

  resetDigestToday: protectedProcedure.mutation(async ({ ctx }) => {
    await db.resetDigestLastSent(ctx.user.id);
    return { ok: true };
  }),

  getWebhookInfo: protectedProcedure.query(() => {
    const base = (ENV.appBaseUrl || "http://localhost:3000").replace(/\/$/, "");
    const isLocalhost = base.includes("localhost") || base.includes("127.0.0.1");
    return {
      // URL para registrar no painel Meta (verificação do número)
      metaWebhookUrl: `${base}/api/whatsapp/webhook`,
      verifyToken: ENV.whatsappVerifyToken || "krythos-webhook-verify",
      // URL para configurar no agregador de números ("Webhook do Agente IA")
      aggregatorWebhookUrl: `${base}/api/aggregator/webhook`,
      isLocalhost,
    };
  }),

  saveDigestSettings: protectedProcedure
    .input(z.object({
      whatsappNumber: z.string().regex(/^\d{10,15}$/, "Número inválido — use DDI + DDD + número, sem + ou espaços. Ex: 5527981244658"),
      digestHour: z.number().int().min(0).max(23),
      digestMinute: z.number().int().min(0).max(59),
      enabled: z.boolean(),
      templateName: z.string().min(1).optional(),
      templateLanguage: z.string().min(2).optional(),
      replyWebhookUrl: z.string().url("URL inválida").nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertDigestSettings(ctx.user.id, input);
      return db.getUserDigestSettings(ctx.user.id);
    }),

  getWhatsAppTemplates: protectedProcedure.query(async () => {
    const { getWhatsAppTemplates } = await import("./_core/whatsapp");
    return getWhatsAppTemplates();
  }),

  diagnoseTemplate: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getUserDigestSettings(ctx.user.id);
    const testRecipient = settings?.whatsappNumber || ENV.whatsappRecipientNumber;
    if (!testRecipient) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Configure o numero de WhatsApp primeiro." });
    }
    const { diagnoseWhatsAppTemplate } = await import("./_core/whatsapp");
    return diagnoseWhatsAppTemplate(testRecipient);
  }),

  diagnoseWhatsApp: protectedProcedure.query(async () => {
    const { ENV } = await import("./_core/env");
    const phoneNumberId = ENV.whatsappPhoneNumberId;
    const accessToken = ENV.whatsappAccessToken;

    if (!phoneNumberId || !accessToken) {
      return { ok: false, error: "WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN nao configurado." };
    }

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,is_official_business_account,account_mode`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json = await res.json() as Record<string, unknown>;

    return {
      ok: res.ok,
      phoneNumberId,
      senderNumber: json.display_phone_number as string | undefined,
      verifiedName: json.verified_name as string | undefined,
      verificationStatus: json.code_verification_status as string | undefined,
      qualityRating: json.quality_rating as string | undefined,
      isOfficialBusiness: json.is_official_business_account as boolean | undefined,
      accountMode: json.account_mode as string | undefined,
      rawPhoneInfo: json,
      error: !res.ok ? String((json.error as Record<string, unknown>)?.message ?? json) : undefined,
    };
  }),

  sendTestDigest: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getUserDigestSettings(ctx.user.id);
    if (!settings?.whatsappNumber) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Configure o número de WhatsApp antes de enviar o teste." });
    }
    const { isWhatsAppConfigured, sendNewsDigest } = await import("./_core/whatsapp");
    if (!isWhatsAppConfigured()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "WhatsApp não configurado no servidor. Verifique as variáveis WHATSAPP_* no .env." });
    }
    const results = await Promise.allSettled(DEFAULT_NEWS_SITES.map((site) => fetchNewsFromSite(site)));
    const items = dedupeNewsItems(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
    const top5 = rankNewsItems(items, "energia").slice(0, 5);
    if (top5.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma notícia encontrada nos sites monitorados no momento." });
    }
    await db.saveDigestSession(ctx.user.id, settings.whatsappNumber, top5);
    const result = await sendNewsDigest(top5, settings.whatsappNumber, settings.templateName, settings.templateLanguage);
    if (result.error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Falha ao enviar: ${result.error}` });
    }
    return { sent: top5.length, messageId: result.messageId, to: settings.whatsappNumber, template: settings.templateName };
  }),

  debugSendFormats: protectedProcedure.mutation(async ({ ctx }) => {
    const settings = await db.getUserDigestSettings(ctx.user.id);
    const to = settings?.whatsappNumber || ENV.whatsappRecipientNumber;
    if (!to) throw new TRPCError({ code: "BAD_REQUEST", message: "Configure o numero de WhatsApp primeiro." });

    const phoneNumberId = ENV.whatsappPhoneNumberId;
    const accessToken = ENV.whatsappAccessToken;

    const LANGS = ["pt_BR", "pt_PT", "pt"];

    // Format A: text only (no emojis, no newlines)
    const paramsSimple = ["1. Noticia teste A", "2. Noticia teste B", "3. Noticia teste C", "4. Noticia teste D", "5. Noticia teste E"]
      .map((text) => ({ type: "text" as const, text }));

    // Format B: with newlines only (no emojis)
    const paramsNewline = Array.from({ length: 5 }, (_, i) => ({
      type: "text" as const,
      text: `${i + 1}. Titulo noticia\nFonte: site.com.br\nLink: https://site.com.br/noticia-${i + 1}`,
    }));

    type Attempt = { lang: string; format: string; ok: boolean; messageId?: string; error?: string };
    const attempts: Attempt[] = [];

    for (const lang of LANGS) {
      for (const [fmt, params] of [["simples", paramsSimple], ["com-quebras", paramsNewline]] as const) {
        const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: "envio_de_noticias_diario",
              language: { code: lang },
              components: [{ type: "body", parameters: params }],
            },
          }),
        });
        const json = await res.json() as Record<string, unknown>;
        const err = json.error as Record<string, unknown> | undefined;
        const detail = (err?.error_data as Record<string, unknown> | undefined)?.details;
        const errMsg = err ? `[${String(err.code)}] ${String(err.message)}${detail ? ` — ${String(detail)}` : ""}` : undefined;
        const msgId = (json.messages as Array<{ id: string }> | undefined)?.[0]?.id;
        console.log(`[Debug] lang=${lang} fmt=${fmt} status=${res.status}:`, JSON.stringify(json));
        attempts.push({ lang, format: fmt, ok: res.ok, messageId: msgId, error: errMsg });
        if (res.ok) break; // stop as soon as one works
      }
      if (attempts.some(a => a.ok)) break;
    }

    return { to, attempts };
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
    const result = await db.getCarousels(ctx.user.id);
    console.log(`[carousel.getAll] userId=${ctx.user.id} count=${result.length}`);
    // Strip undefined values from slides before superjson serialization.
    // parseCarouselSlides explicitly sets optional fields to undefined, which
    // creates 1000+ entries in superjson meta for large carousels causing
    // client-side deserialization failure. JSON roundtrip removes them safely.
    return result.map(c => ({ ...c, slides: JSON.parse(JSON.stringify(c.slides)) }));
  }),

  listRegistryTemplates: protectedProcedure
    .input(z.object({ industry: z.string().optional() }).optional())
    .query(({ input }) => {
      const templates = input?.industry
        ? getTemplatesForNiche(input.industry)
        : TEMPLATE_REGISTRY;
      return templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        niches: t.niches,
        compatibleBlockTypes: t.compatibleBlockTypes,
        slideCount: t.slideCount,
        palette: t.palette,
        profileId: t.profileId,
      }));
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
        max_tokens: 500,
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
        sourceTopicAngleId: z.number().int().positive().optional(),
        hookType: z.string().max(32).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkAndIncrTrialUsage(ctx.user.id, ctx.user as PlanUser, 'carousel');
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

        const calibrationBlock = await getCalibrationBlock(ctx.user.id, "carousel");
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
          calibrationBlock: calibrationBlock || undefined,
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
          sourceTopicAngleId: input.sourceTopicAngleId,
          hookType: input.hookType,
          contentFormat: "carousel",
          templateId: input.templateId,
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
                text: "Analise esta imagem e crie uma legenda para Instagram em português brasileiro otimizada para SEO social. Estrutura: (1) gancho de 5-10 palavras na linha 1, SEM emoji; (2) desenvolvimento com 2-3 keywords primárias do tema distribuídas naturalmente no corpo — keywords têm 3x mais impacto de descoberta que hashtags; (3) CTA pedindo salvamento ou compartilhamento, NUNCA curtida; (4) máximo 3-5 hashtags de nicho ao final. Retorne apenas a legenda pronta, sem títulos ou explicações.",
              },
            ],
          },
        ],
        max_tokens: 400,
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
            igMediaId: result.mediaId ?? null,
            contentType: "carousel",
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
        max_tokens: 1200,
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

      // Trial users: only Instagram posts, 1 per day. Non-Instagram channels require paid plan.
      if (input.channel !== 'instagram') {
        requirePaidPlan(ctx.user as PlanUser);
      } else {
        await checkAndIncrTrialUsage(ctx.user.id, ctx.user as PlanUser, 'posts');
      }

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
        instagram: `legenda para Instagram em português brasileiro otimizada para SEO social e algoritmo 2026.

ESTRATÉGIA SEO SOCIAL (prioridade máxima):
• Identifique 2-3 keywords primárias do tema (termos que o público usaria para buscar esse conteúdo).
• Distribua essas keywords naturalmente no corpo do texto — NÃO as concentre em hashtags.
• O algoritmo do Instagram indexa o texto da legenda para busca semântica: keywords no corpo têm 3x mais impacto de descoberta que hashtags.

ESTRUTURA OBRIGATÓRIA:
1. GANCHO (linha 1-2, visível antes do "ver mais"): 5-10 palavras — dado surpreendente, pergunta provocadora ou afirmação ousada. SEM emoji na primeira linha. Use uma keyword primária aqui se couber naturalmente.
2. DESENVOLVIMENTO: 3-5 frases curtas em parágrafos de 1-2 linhas. Emojis como separadores. As 2-3 keywords primárias devem aparecer aqui de forma fluida, não forçada.
3. CTA FINAL: UM único CTA específico — peça salvamento ("Salva pra consultar quando precisar de X") ou compartilhamento. NUNCA peça curtida.
4. HASHTAGS: no máximo 3-5 ao final — de preferência apenas 3. Priorize nichos específicos (50K-500K posts). Nunca mais que 5. Não repita como hashtag o que já é keyword no texto.
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
        max_tokens: 1000,
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
        instagram: `uma legenda para Instagram em português brasileiro otimizada para SEO social (máx ~2000 chars). Estrutura: (1) gancho de 5-10 palavras na linha 1, SEM emoji; (2) desenvolvimento com 2-3 keywords primárias do tema distribuídas naturalmente no corpo do texto — keywords têm 3x mais impacto de descoberta que hashtags; (3) CTA pedindo salvamento ou compartilhamento, NUNCA curtida; (4) no máximo 3-5 hashtags de nicho ao final.`,
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
        max_tokens: 800,
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
        instagram: `uma legenda para Instagram em português brasileiro otimizada para SEO social (máx ~2000 chars). Estrutura: (1) gancho de 5-10 palavras na linha 1, SEM emoji; (2) desenvolvimento com 2-3 keywords primárias do tema distribuídas naturalmente no corpo do texto — keywords têm 3x mais impacto de descoberta que hashtags; (3) CTA pedindo salvamento ou compartilhamento, NUNCA curtida; (4) no máximo 3-5 hashtags de nicho ao final.`,
        linkedin: "um post profissional para LinkedIn em português brasileiro, com insights valiosos, tom formal mas acessível e no máximo 2-3 hashtags relevantes (máx ~2500 chars)",
        newsletter: "um texto de email marketing em português brasileiro, com saudação, parágrafo de corpo bem escrito e uma chamada para ação clara (máx ~500 chars de pré-visualização)",
      };

      // 1. Try Whisper audio transcription (only when OpenAI key is configured)
      let transcript = "";
      if (ENV.openaiApiKey.trim()) {
        try {
          const videoRes = await fetch(input.videoUrl);
          if (videoRes.ok) {
            const buffer = await videoRes.arrayBuffer();
            const sizeMB = buffer.byteLength / (1024 * 1024);
            if (sizeMB <= 25) {
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
              } else {
                console.warn("[generateContentFromVideo] Whisper status:", whisperRes.status, await whisperRes.text().catch(() => ""));
              }
            } else {
              console.warn(`[generateContentFromVideo] Video too large for Whisper: ${sizeMB.toFixed(1)}MB`);
            }
          } else {
            console.warn("[generateContentFromVideo] Video URL not accessible:", videoRes.status, input.videoUrl);
          }
        } catch (e) {
          console.warn("[generateContentFromVideo] Whisper failed:", e);
        }
      }

      // 2. If transcription succeeded, generate caption from transcript
      if (transcript) {
        const response = await invokeLLM({
          messages: [{
            role: "user",
            content: `Transcrição do áudio do vídeo:\n"${transcript}"\n\nCom base nessa transcrição, crie ${channelGuide[input.channel]}.`,
          }],
          max_tokens: 800,
        });
        const content = typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content.trim()
          : "";
        if (content) return { content };
      }

      // 3. Fallback: pass video URL directly to the LLM (works with multimodal models like Gemini)
      try {
        const response = await invokeLLM({
          messages: [{
            role: "user",
            content: [
              { type: "file_url", file_url: { url: input.videoUrl, mime_type: "video/mp4" as const } },
              { type: "text", text: `Analise este vídeo e crie ${channelGuide[input.channel]}.` },
            ],
          }],
          max_tokens: 800,
        });
        const content = typeof response.choices[0]?.message?.content === "string"
          ? response.choices[0].message.content.trim()
          : "";
        if (content) return { content };
      } catch (e) {
        console.warn("[generateContentFromVideo] Direct video LLM analysis failed:", e);
      }

      // 4. Both approaches failed — return clear error instead of random content
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Não foi possível analisar o áudio do vídeo. Verifique se o vídeo está acessível e possui áudio, ou configure OPENAI_API_KEY para habilitar a transcrição.",
      });
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
          igMediaId: result.mediaId ?? null,
          contentType: (post as unknown as { contentType?: string }).contentType ?? null,
          contentId: (post as unknown as { contentId?: number }).contentId ?? null,
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

  listNiches: protectedProcedure.query(async () => {
    return db.listNicheProfiles();
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
      nicheId: z.string().max(64).optional(),
      subNicheId: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.saveBrandKit(ctx.user.id, input);
    }),

  importFromAnalysis: protectedProcedure
    .input(z.object({
      companyName: z.string().optional(),
      instagramHandle: z.string().optional(),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      toneOfVoice: z.enum(["professional", "casual", "inspiring", "educational"]).optional(),
      industry: z.string().max(128).optional(),
      nicheId: z.string().max(64).optional(),
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

  getLinkedInConnectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const connection = await db.getLinkedInConnection(ctx.user.id);
    if (connection) {
      return {
        connected: true,
        name: connection.name,
        email: connection.email,
        profilePictureUrl: connection.profilePictureUrl,
        authorUrn: connection.authorUrn,
        tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
      };
    }
    return { connected: false };
  }),

  disconnectLinkedIn: protectedProcedure.mutation(async ({ ctx }) => {
    await db.deleteLinkedInConnection(ctx.user.id);
    return { success: true };
  }),

  getLinkedInProfile: protectedProcedure.query(async ({ ctx }) => {
    const connection = await db.getLinkedInConnection(ctx.user.id);
    if (!connection) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Conecte sua conta do LinkedIn primeiro." });
    }
    const profile = await linkedInGet<{
      sub?: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      email?: string;
    }>("https://api.linkedin.com/v2/userinfo", connection.accessToken);

    return {
      sub: profile.sub,
      name: profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim() || connection.name,
      picture: profile.picture || connection.profilePictureUrl,
      email: profile.email || connection.email,
      authorUrn: connection.authorUrn,
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
      const metrics = [
        "impressions",
        "reach",
        "profile_views",
        "follower_count",
        "website_clicks",
        "phone_call_clicks",
        "email_contacts",
        "text_message_clicks",
        "get_directions_clicks",
        "total_interactions",
        "accounts_engaged",
      ] as const;

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
        media_product_type?: string;
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
          fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink",
          limit: String(input.limit),
        },
        accessToken
      );

      const items = mediaData.data ?? [];

      // One request per metric — a single unsupported metric for this media type (e.g.
      // "impressions" on a Reel) makes the Graph API reject the whole comma-joined call.
      const fetchMetric = async (mediaId: string, metric: string): Promise<number> => {
        try {
          const data = await graphGet<{ data: Array<{ values?: Array<{ value: number }>; value?: number }> }>(
            `${mediaId}/insights`,
            { metric },
            accessToken
          );
          return data.data?.[0]?.value ?? data.data?.[0]?.values?.[0]?.value ?? 0;
        } catch {
          return 0;
        }
      };

      const withInsights = await Promise.all(
        items.map(async (item) => {
          const isReel = item.media_product_type === "REELS";
          const baseMetrics = ["reach", "saved", "shares"];
          const extraMetrics = isReel ? ["views", "ig_reels_avg_watch_time"] : ["impressions"];
          const allMetrics = [...baseMetrics, ...extraMetrics];

          const values = await Promise.all(allMetrics.map((m) => fetchMetric(item.id, m)));
          const insights: Record<string, number> = {};
          allMetrics.forEach((m, i) => { insights[m] = values[i]; });
          if (isReel) {
            insights.videoViews = insights.views ?? 0;
            insights.avgWatchTimeMs = insights.ig_reels_avg_watch_time ?? 0;
          }

          // Weighted engagement score (Instagram 2026 algorithm priorities)
          // shares = total shares via API (DM-specific not available — Meta limitation)
          // comments = total count (word-count filter not available via API)
          const reach = insights.reach ?? 0;
          const engagementScore = reach > 0
            ? parseFloat((
                ((insights.saved ?? 0) * 3 + (insights.shares ?? 0) * 4 + item.comments_count * 2 + item.like_count * 1)
                / reach * 100
              ).toFixed(2))
            : 0;

          return { ...item, insights, engagementScore };
        })
      );

      return withInsights;
    }),

  getAudienceDemographics: protectedProcedure.query(async ({ ctx }) => {
    const { accessToken, igAccountId } = await getInstagramCredentials(ctx.user.id);

    const fetchBreakdown = async (breakdown: string) => {
      try {
        const qs = new URLSearchParams({
          metric: "follower_demographics",
          period: "lifetime",
          metric_type: "total_value",
          breakdown,
          access_token: accessToken,
        }).toString();
        const res = await fetch(`${graphUrl(`${igAccountId}/insights`)}?${qs}`);
        const data = (await res.json()) as {
          data?: Array<{ total_value?: { breakdowns?: Array<{ results?: Array<{ dimension_values: string[]; value: number }> }> } }>;
          error?: { message?: string };
        };
        if (!res.ok || data.error) return [];
        const results = data.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
        return results.map((r) => ({ dimension: r.dimension_values.join(" / "), value: r.value }));
      } catch {
        return [];
      }
    };

    const [genderAge, city, country] = await Promise.all([
      fetchBreakdown("age,gender"),
      fetchBreakdown("city"),
      fetchBreakdown("country"),
    ]);

    const hasData = genderAge.length > 0 || city.length > 0 || country.length > 0;
    if (hasData) {
      await db.saveInstagramAccountInsightsSnapshot({
        userId: ctx.user.id,
        demographics: { genderAge, city, country },
        websiteClicks: 0,
        phoneCallClicks: 0,
        emailContacts: 0,
        textMessageClicks: 0,
        getDirectionsClicks: 0,
        totalInteractions: 0,
        accountsEngaged: 0,
      });
    }

    const [latest, history] = await Promise.all([
      db.getLatestInstagramAccountInsights(ctx.user.id),
      db.getInstagramAccountInsightsHistory(ctx.user.id, 90),
    ]);

    return {
      current: hasData ? { genderAge, city, country } : (latest?.demographics ?? null),
      available: hasData || Boolean(latest?.demographics),
      history: history.map((h) => ({
        dateKey: h.dateKey,
        totalInteractions: h.totalInteractions,
        accountsEngaged: h.accountsEngaged,
      })),
    };
  }),
});



// ─── Comment Automations Router ───────────────────────────────────────────────

const commentAutomationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getCommentAutomations(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object({
      igAccountId: z.string().min(1),
      igPostId: z.string().min(1),
      postCaption: z.string().optional(),
      postThumbnailUrl: z.string().optional(),
      keywords: z.array(z.string().min(1)).min(1),
      publicReplyMessage: z.string().min(1),
      dmFirstMessage: z.string().min(1),
      dmFollowupMessage: z.string().optional(),
      dmLink: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      const connection = await db.getInstagramConnection(ctx.user.id);
      if (!connection || connection.instagramAccountId !== input.igAccountId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conta Instagram não encontrada ou não autorizada." });
      }
      return db.createCommentAutomation(ctx.user.id, {
        ...input,
        dmLink: input.dmLink || null,
      });
    }),

  toggleStatus: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const next = await db.toggleCommentAutomationStatus(input.id, ctx.user.id);
      return { status: next };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCommentAutomation(input.id, ctx.user.id);
      return { success: true };
    }),

  subscribeWebhooks: protectedProcedure.mutation(async ({ ctx }) => {
    const connection = await db.getInstagramConnection(ctx.user.id);
    if (!connection?.accessToken || !connection.instagramAccountId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma conta Instagram conectada." });
    }
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${connection.instagramAccountId}/subscribed_apps?subscribed_fields=comments&access_token=${encodeURIComponent(connection.accessToken)}`,
      { method: "POST" }
    );
    const data = await res.json() as { success?: boolean; error?: { message?: string } };
    if (!data.success) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: data.error?.message ?? "Falha ao subscrever webhooks." });
    }
    return { success: true };
  }),
});

const commentAlertsRouter = router({
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    return db.getOpenCommentAlerts(ctx.user.id);
  }),

  acknowledge: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.acknowledgeCommentAlert(input.id, ctx.user.id);
      return { success: true };
    }),

  acknowledgeAll: protectedProcedure.mutation(async ({ ctx }) => {
    const alerts = await db.getOpenCommentAlerts(ctx.user.id);
    await Promise.all(alerts.map((a) => db.acknowledgeCommentAlert(a.id, ctx.user.id)));
    return { acknowledged: alerts.length };
  }),
});


const reelsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return db.getReelsScripts(ctx.user.id);
  }),

  generate: aiProcedure
    .input(z.object({
      topic: z.string().min(3).max(500),
      tone: z.enum(["educational", "entertaining", "inspiring", "informative"]).optional(),
      duration: z.enum(["short", "medium", "long"]).optional(),
      extraContext: z.string().max(1000).optional(),
      sourceTopicAngleId: z.number().int().positive().optional(),
      hookType: z.string().max(32).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      const generated = await generateReelsScript({
        topic: input.topic,
        tone: input.tone,
        duration: input.duration,
        extraContext: input.extraContext,
      });

      const saved = await db.saveReelsScript(ctx.user.id, {
        title: generated.title,
        topic: input.topic,
        tone: input.tone ?? "educational",
        duration: input.duration ?? "medium",
        hook: generated.hook,
        reward: generated.reward,
        loopClose: generated.loopClose,
        caption: generated.caption,
        hashtags: generated.hashtags,
        scenes: generated.scenes,
        sourceTopicAngleId: input.sourceTopicAngleId,
        hookType: input.hookType,
        contentFormat: "reels",
      });

      return saved;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteReelsScript(input.id, ctx.user.id);
      return { success: true };
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.getReelsScriptCount(ctx.user.id);
    return { count };
  }),
});


// ─── Campaign Router ──────────────────────────────────────────────────────────

const campaignRouter = router({
  generate: aiProcedure
    .input(
      z.object({
        subject:       z.string().min(3).max(500),
        client:        z.string().max(200).optional(),
        segment:       z.string().max(200).optional(),
        date:          z.string().max(30).optional(),
        objective:     z.string().max(300).optional(),
        socialNetwork: z.string().max(100).optional(),
        extraInfo:     z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const lines: string[] = [
        `Cliente: ${input.client || "A definir"}`,
        `Segmento: ${input.segment || "A definir"}`,
        `Data: ${input.date || new Date().toLocaleDateString("pt-BR")}`,
        `Assunto: ${input.subject}`,
        `Objetivo: ${input.objective || "Engajamento e conversão"}`,
        `Rede Social: ${input.socialNetwork || "Instagram"}`,
        input.extraInfo ? `Informações adicionais: ${input.extraInfo}` : null,
      ].filter(Boolean) as string[];

      const userPrompt = lines.join("\n");
      const systemPrompt = `Você é o Diretor Criativo e Head de Copy de uma agência de marketing de alto desempenho. Receba os dados de campanha e retorne APENAS um JSON válido (sem markdown, sem texto antes ou depois) com exatamente estas chaves:

{
  "creativeConcept": "Conceito criativo da campanha — 3 a 5 frases que explicam a ideia central, o ângulo emocional e como cada peça vai se conectar com o público.",
  "artPrompt": "Prompt completo em inglês para gerar a imagem principal da campanha. Inclua: estilo fotográfico ou ilustrativo, composição, iluminação (natural/estúdio/dramática), enquadramento (close, wide, overhead), paleta de cores, elementos visuais específicos, espaço reservado para texto, tipografia sugerida, qualidade 8K, aspecto profissional de publicidade premium.",
  "artCopy": {
    "title": "Título principal forte — máximo 8 palavras, impacto imediato",
    "subtitle": "Subtítulo que aprofunda o título — máximo 15 palavras",
    "body": "Parágrafo de copy persuasivo — 3 a 5 frases desenvolvendo o argumento de venda, benefícios reais, provas sociais ou urgência. Linguagem direta, sem clichês.",
    "cta": "Chamada para ação clara e específica — máximo 5 palavras",
    "secondary": "Informação de suporte — condições, garantia, prazo, detalhe que reforça a decisão",
    "badge": "Selo ou etiqueta promocional de destaque (ex: '30% OFF', 'Frete Grátis', 'Últimas Unidades') ou null"
  },
  "caption": "Legenda completa para o post — comece com um hook que para o scroll nas primeiras 2 linhas, desenvolva a proposta de valor com bullet points ou espaçamento, termine com CTA específico e 10 a 15 hashtags relevantes. Mínimo 150 palavras.",
  "reel": {
    "musicSuggestion": "Estilo musical recomendado para o Reel (ex: 'Pop animado BPM 120+', 'Lo-fi relaxante', 'Trap eletrônico com energia')",
    "hook":    { "narration": "Exatas palavras a dizer em câmera (0-3s) — frase que para o scroll instantaneamente", "visual": "Ação exata: como enquadrar, o que fazer com o corpo/produto/ambiente, movimento de câmera", "overlay": "Texto animado que aparece na tela (ou vazio se não houver)" },
    "scene1":  { "narration": "Exatas palavras (3-10s) — desenvolvimento do problema ou contexto", "visual": "Descrição detalhada do que mostrar: ângulo, iluminação, props, ação do apresentador", "overlay": "Texto de apoio na tela" },
    "scene2":  { "narration": "Exatas palavras (10-18s) — apresentação da solução / produto / oferta", "visual": "Tomada de produto, demonstração, reação — descreva o plano completo", "overlay": "Destaque textual: preço, benefício, feature" },
    "scene3":  { "narration": "Exatas palavras (18-24s) — prova, benefício ou detalhe que convence", "visual": "Plano de prova social, antes/depois, uso real, detalhe do produto", "overlay": "Número, dado ou argumento visual" },
    "closing": { "narration": "Exatas palavras (24-27s) — reforço emocional e urgência", "visual": "Plano de fechamento: marca, produto destacado, ambiente convidativo", "overlay": "Urgência ou escassez: 'Só até domingo', 'Últimas vagas'" },
    "cta":     { "narration": "Exatas palavras (27-30s) — instrução clara do que o espectador deve fazer agora", "visual": "Câmera direta no rosto, gesto de apontar para o link ou produto, expressão confiante", "overlay": "CTA em destaque máximo: botão, seta, link" }
  },
  "stories": [
    { "slide": 1, "visual": "Prompt em inglês para gerar a imagem do Story 1 — descreva composição vertical 9:16, cores, tipografia, elementos visuais, estilo premium", "text": "Texto de overlay curto que vai sobre a imagem — máximo 10 palavras, fonte grande", "cta": "Botão de ação do story (ex: 'Ver oferta', 'Arrasta pra cima')" },
    { "slide": 2, "visual": "Prompt em inglês para a imagem do Story 2 — segunda cena da sequência, continuidade visual", "text": "Texto curto que aprofunda a proposta — máximo 10 palavras", "cta": "Ação" },
    { "slide": 3, "visual": "Prompt em inglês para a imagem do Story 3 — fechamento com CTA forte, urgência visual", "text": "Texto de fechamento curto e direto", "cta": "CTA final imperativo" }
  ],
  "variations": {
    "emotional": {
      "concept": "Ângulo emocional: qual sentimento ativa, qual história conta, como conecta com a identidade do público",
      "headline": "Headline emocional — máximo 10 palavras, aciona pertencimento/desejo/medo de perder",
      "caption": "Legenda completa na abordagem emocional — storytelling, identificação, conexão, CTA suave"
    },
    "sales": {
      "concept": "Ângulo de conversão: foco em resultado concreto, ROI, economia, praticidade ou escassez",
      "headline": "Headline de vendas — máximo 10 palavras, número ou promessa específica",
      "caption": "Legenda completa na abordagem de vendas — benefícios diretos, objeções respondidas, CTA urgente"
    }
  },
  "recommendations": {
    "bestTime": "Dia da semana e horário ideal para publicar (ex: 'Terça ou quarta, 11h ou 19h')",
    "audience": "Perfil detalhado do público-alvo: faixa etária, interesses, comportamento de compra",
    "adObjective": "Objetivo de anúncio recomendado no Meta Ads (ex: 'Conversões no site', 'Alcance', 'Tráfego')",
    "campaignType": "Tipo de campanha (ex: 'Campanha de performance + retargeting', 'Brand awareness')",
    "segmentation": "Segmentação detalhada: interesses, comportamentos, lookalike, excluir compradores recentes",
    "keywords": ["palavra-chave 1", "palavra-chave 2", "palavra-chave 3", "palavra-chave 4", "palavra-chave 5"]
  }
}

REGRAS OBRIGATÓRIAS:
- Nunca use linguagem genérica de IA: 'nos dias de hoje', 'transforme sua vida', 'incrível', 'revolucionário'
- Copy real: escreva como um copywriter humano com 10 anos de experiência em conversão
- Reel: as narrations são o roteiro exato — palavras que saem da boca, não descrições do que dizer
- Visuals do reel: específicos e acionáveis — o cliente deve conseguir filmar sozinho com celular
- Stories: os prompts de imagem devem ser ricos o suficiente para gerar imagens profissionais
- Quando houver promoção: coloque o número do desconto, preço final ou condição em destaque real
- Respeite 100% a identidade visual e tom de voz se informados`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });

      const rawContent = response.choices[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : "{}";
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao processar resposta do agente criativo.",
        });
      }
    }),
});


// ─── Style Analyzer Router ────────────────────────────────────────────────────
// ─── Radar de Temas (Module 1.1) ─────────────────────────────────────────────

const radarRouter = router({
  getTopics: protectedProcedure.query(async ({ ctx }) => {
    const topics = await db.getRadarTopicsForUser(ctx.user.id);
    return topics;
  }),

  updateStatus: protectedProcedure
    .input(z.object({
      trendingTopicId: z.number().int(),
      status: z.enum(["sugerido", "usado", "descartado"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserTopicAngleStatus(ctx.user.id, input.trendingTopicId, input.status);
      return { success: true };
    }),

  adminRefresh: protectedProcedure.mutation(async ({ ctx }) => {
    requirePaidPlan(ctx.user as PlanUser);
    const { runRadarPipeline } = await import("./_core/radarScheduler");
    const result = await runRadarPipeline();
    return { inserted: result.inserted };
  }),
});

const styleAnalyzerRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      usernameOrUrl: z.string().min(1).max(255),
      // Accepts both HTTP URLs and data: URIs (base64 screenshots from client)
      uploadedImages: z.array(z.string().max(8_000_000)).max(8).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      const { analyzeInstagramProfileStyle } = await import("./_core/instagramStyleAgent");
      const connection = await db.getInstagramConnection(ctx.user.id);
      try {
        return await analyzeInstagramProfileStyle({
          username: input.usernameOrUrl,
          connectedAccount: connection ? {
            instagramAccountId: connection.instagramAccountId,
            accessToken: connection.accessToken,
            username: connection.username ?? undefined,
            name: connection.name,
            profilePictureUrl: connection.profilePictureUrl,
          } : null,
          uploadedImages: input.uploadedImages,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao analisar perfil: ${err instanceof Error ? err.message : "falha desconhecida"}`,
        });
      }
    }),

  save: protectedProcedure
    .input(z.object({
      profileHandle: z.string().min(1).max(100),
      profileName: z.string().optional(),
      profilePictureUrl: z.string().optional(),
      source: z.enum(["api", "scrape", "upload"]),
      analysisJson: z.string().max(50000),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = await db.saveStyleProfile(ctx.user.id, input);
      return { id };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listStyleProfiles(ctx.user.id);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteStyleProfile(ctx.user.id, input.id);
      return { success: true };
    }),
});

// ─── SEO Keyword Research Router ─────────────────────────────────────────────

const seoRouter = router({
  researchKeywords: aiProcedure
    .input(z.object({
      seedKeyword: z.string().trim().min(2).max(150),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      const { researchKeywordsWithAgent } = await import("./_core/seoKeywordAgent");
      const brand = await db.getBrandKit(ctx.user.id);

      try {
        return await researchKeywordsWithAgent({
          seedKeyword: input.seedKeyword,
          companyName: brand?.companyName ?? undefined,
          industry: brand?.industry ?? undefined,
          targetAudience: brand?.targetAudience ?? undefined,
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao pesquisar palavras-chave: ${err instanceof Error ? err.message : "falha desconhecida"}`,
        });
      }
    }),
});

// ─── Google Search Console Router ────────────────────────────────────────────

const searchConsoleRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const connection = await db.getSearchConsoleConnection(ctx.user.id);
    if (!connection) return { connected: false as const };

    let availableSites: string[] = [];
    try {
      availableSites = connection.availableSites ? JSON.parse(connection.availableSites) : [];
    } catch {
      availableSites = [];
    }

    return {
      connected: true as const,
      selectedSiteUrl: connection.selectedSiteUrl,
      availableSites,
    };
  }),

  selectSite: protectedProcedure
    .input(z.object({ siteUrl: z.string().min(1).max(512) }))
    .mutation(async ({ ctx, input }) => {
      const connection = await db.getSearchConsoleConnection(ctx.user.id);
      if (!connection) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conecte o Google Search Console primeiro." });
      }
      await db.updateSearchConsoleSelectedSite(ctx.user.id, input.siteUrl);
      return { success: true };
    }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await db.deleteSearchConsoleConnection(ctx.user.id);
    return { success: true };
  }),

  getTopQueries: protectedProcedure.query(async ({ ctx }) => {
    const connection = await db.getSearchConsoleConnection(ctx.user.id);
    if (!connection || !connection.selectedSiteUrl) return { rows: [] };

    const { getValidGscAccessToken, fetchGscTopQueries } = await import("./_core/googleSearchConsoleClient");

    try {
      const accessToken = await getValidGscAccessToken({
        userId: ctx.user.id,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        tokenExpiresAt: connection.tokenExpiresAt,
      });
      const rows = await fetchGscTopQueries({ accessToken, siteUrl: connection.selectedSiteUrl });
      return { rows };
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Erro ao buscar dados do Search Console: ${err instanceof Error ? err.message : "falha desconhecida"}`,
      });
    }
  }),
});

// ─── Performance Router (Module 1.3) ─────────────────────────────────────────

const performanceRouter = router({
  getTopTemplates: protectedProcedure
    .input(z.object({ contentFormat: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return db.getTopPerformanceForUser(ctx.user.id, input.contentFormat);
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const perf = await db.getTopPerformanceForUser(ctx.user.id);
    if (perf.length === 0) return null;
    const best = perf[0];
    const bestByFormat = new Map<string, typeof perf[0]>();
    for (const p of perf) {
      if (!bestByFormat.has(p.contentFormat) || p.avgScore > bestByFormat.get(p.contentFormat)!.avgScore) {
        bestByFormat.set(p.contentFormat, p);
      }
    }
    return {
      bestHook: best.hookType,
      bestStyle: best.templateStyle,
      bestSource: best.sourceKind,
      bestScore: best.avgScore,
      totalPostsAnalyzed: perf.reduce((acc, p) => acc + p.postCount, 0),
      byFormat: Object.fromEntries(bestByFormat),
    };
  }),

  adminTrigger: protectedProcedure.mutation(async ({ ctx }) => {
    if ((ctx.user as { role?: string }).role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Apenas admins" });
    }
    const { runMetricsPipeline, runAccountInsightsPipeline } = await import("./_core/metricsScheduler");
    runMetricsPipeline().catch((e: unknown) => console.error("[Performance] Admin trigger error:", e));
    runAccountInsightsPipeline().catch((e: unknown) => console.error("[Performance] Admin trigger (account insights) error:", e));
    return { ok: true };
  }),
});

// ─── Editorial Plan Router (Module 2.1) ──────────────────────────────────────

const editorialPlanRouter = router({
  generatePlan: protectedProcedure
    .input(z.object({
      year: z.number().int().min(2024).max(2030),
      month: z.number().int().min(1).max(12),
      postsPerWeek: z.number().int().min(1).max(14),
      formats: z.array(z.object({
        format: z.enum(["carousel", "instagram", "linkedin", "newsletter"]),
        weight: z.number().int().min(0).max(100),
      })).min(1),
      categories: z.array(z.string().min(1).max(100)).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAgencyPlan(ctx.user as PlanUser);

      const [brand, radarTopicsRaw] = await Promise.all([
        db.getBrandKit(ctx.user.id),
        db.getRadarTopicsForUser(ctx.user.id),
      ]);

      const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
      const monthName = monthNames[input.month - 1];

      const totalPosts = Math.round(input.postsPerWeek * 4.3);

      const formatDistribution = input.formats
        .filter(f => f.weight > 0)
        .map(f => {
          const count = Math.max(0, Math.round((f.weight / 100) * totalPosts));
          const labels: Record<string, string> = {
            carousel: "Carrossel",
            instagram: "Post Instagram (estático)",
            linkedin: "LinkedIn",
            newsletter: "Newsletter",
          };
          return `${labels[f.format] ?? f.format}: ~${count} posts (${f.weight}%)`;
        })
        .join("\n");

      const brandContext = brand?.companyName
        ? [
            `Empresa: ${brand.companyName}${brand.industry ? ` (${brand.industry})` : ""}`,
            brand.targetAudience ? `Público-alvo: ${brand.targetAudience}` : null,
            brand.toneOfVoice ? `Tom de voz: ${brand.toneOfVoice}` : null,
          ].filter(Boolean).join("\n")
        : null;

      // Build radar context: top trending topics not yet used/discarded
      const radarTopics = radarTopicsRaw
        .filter((t) => t.angle?.status !== "usado" && t.angle?.status !== "descartado")
        .sort((a, b) => (b.viralScore ?? 50) - (a.viralScore ?? 50))
        .slice(0, 12);

      const radarBlock = radarTopics.length > 0
        ? [
            `TEMAS EM ALTA — RADAR DE TENDÊNCIAS (incorpore os mais relevantes para as categorias definidas):`,
            ...radarTopics.map((t, i) => {
              const hook = t.angle?.suggestedHook ?? t.description ?? "";
              const hookSnippet = hook.length > 120 ? hook.slice(0, 120) + "…" : hook;
              return `${i + 1}. "${t.angle?.suggestedTitle ?? t.title}" — ${hookSnippet} [score viral: ${t.viralScore}]`;
            }),
            ``,
            `INSTRUÇÃO: Distribua entre 30-50% dos posts adaptando estes temas em alta para as categorias editoriais. Os demais posts devem ser pautas perenes e estratégicas da marca.`,
          ].join("\n")
        : null;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Você é um planejador editorial especialista em marketing digital para o Brasil. Crie planos de conteúdo estratégicos e variados que maximizem engajamento, combinando tendências em alta com conteúdo perene.",
          },
          {
            role: "user",
            content: [
              `Crie um planejamento editorial para ${monthName} de ${input.year}.`,
              `Total de posts: ~${totalPosts} (${input.postsPerWeek} por semana)`,
              ``,
              `DISTRIBUIÇÃO DE FORMATOS:`,
              formatDistribution,
              ``,
              `CATEGORIAS EDITORIAIS (use todas de forma balanceada):`,
              input.categories.join(", "),
              brandContext ? `\nINFO DA MARCA:\n${brandContext}` : "",
              radarBlock ? `\n${radarBlock}` : "",
              ``,
              `REGRAS:`,
              `- Distribua os posts ao longo do mês (prefira dias úteis: seg-sex)`,
              `- Varie as categorias de forma equilibrada`,
              `- Cada post deve ter um ângulo único e específico`,
              `- suggestedTitle deve ser um gancho impactante de até 80 caracteres`,
              `- pauta deve ter 2-3 frases: o que cobrir, ângulo, por que vai performar`,
              `- scheduledDate no formato YYYY-MM-DD, dentro de ${input.year}-${String(input.month).padStart(2,"0")}-01 a ${input.year}-${String(input.month).padStart(2,"0")}-${new Date(input.year, input.month, 0).getDate()}`,
              ``,
              `Retorne APENAS JSON válido:`,
              `{`,
              `  "items": [`,
              `    {`,
              `      "scheduledDate": "YYYY-MM-DD",`,
              `      "format": "carousel|instagram|linkedin|newsletter",`,
              `      "category": "categoria da lista acima",`,
              `      "suggestedTitle": "gancho ou título do post",`,
              `      "pauta": "briefing em 2-3 frases"`,
              `    }`,
              `  ]`,
              `}`,
            ].filter(Boolean).join("\n"),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "editorial_plan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      scheduledDate: { type: "string" },
                      format: { type: "string" },
                      category: { type: "string" },
                      suggestedTitle: { type: "string" },
                      pauta: { type: "string" },
                    },
                    required: ["scheduledDate", "format", "category", "suggestedTitle", "pauta"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: 3500,
      });

      const raw = response.choices[0]?.message?.content;
      const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw ?? "{}")) as {
        items: Array<{ scheduledDate: string; format: string; category: string; suggestedTitle: string; pauta: string }>;
      };

      return { items: parsed.items ?? [] };
    }),

  savePlan: protectedProcedure
    .input(z.object({
      year: z.number().int().min(2024).max(2030),
      month: z.number().int().min(1).max(12),
      items: z.array(z.object({
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        format: z.enum(["carousel", "instagram", "linkedin", "newsletter"]),
        category: z.string().min(1).max(255),
        suggestedTitle: z.string().min(1).max(512),
        pauta: z.string().min(1),
        status: z.enum(["pending", "approved", "rejected"]).default("pending"),
      })).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAgencyPlan(ctx.user as PlanUser);
      const generatedCount = await db.countGeneratedPlanItems(ctx.user.id, input.year, input.month);
      if (generatedCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Este mês já tem ${generatedCount} item(ns) com conteúdo gerado. Remova-os manualmente antes de substituir o plano.`,
        });
      }
      const saved = await db.saveEditorialPlanItems(
        ctx.user.id,
        input.year,
        input.month,
        input.items,
      );
      return { saved: saved.length };
    }),

  getByMonth: protectedProcedure
    .input(z.object({
      year: z.number().int().min(2024).max(2030),
      month: z.number().int().min(1).max(12),
    }))
    .query(async ({ ctx, input }) => {
      return db.getEditorialPlanItems(ctx.user.id, input.year, input.month);
    }),

  updateItem: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["pending", "approved", "rejected", "generating", "done"]).optional(),
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await db.updateEditorialPlanItem(id, ctx.user.id, data);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Item do plano não encontrado." });
      return updated;
    }),

  deletePlan: protectedProcedure
    .input(z.object({
      year: z.number().int().min(2024).max(2030),
      month: z.number().int().min(1).max(12),
    }))
    .mutation(async ({ ctx, input }) => {
      requireAgencyPlan(ctx.user as PlanUser);
      await db.deleteEditorialPlanItems(ctx.user.id, input.year, input.month);
      return { ok: true };
    }),

  deleteByDate: protectedProcedure
    .input(z.object({ scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      requireAgencyPlan(ctx.user as PlanUser);
      await db.deleteEditorialPlanItemsByDate(ctx.user.id, input.scheduledDate);
      return { ok: true };
    }),

  deleteItem: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAgencyPlan(ctx.user as PlanUser);
      await db.deleteEditorialPlanItem(ctx.user.id, input.id);
      return { ok: true };
    }),

  generateContent: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAgencyPlan(ctx.user as PlanUser);

      const found = await db.getEditorialPlanItemById(input.id, ctx.user.id);
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item do plano não encontrado." });
      }

      await db.updateEditorialPlanItem(input.id, ctx.user.id, { status: "generating" });

      try {
        const brand = await db.getBrandKit(ctx.user.id);
        const calibrationBlock = await getCalibrationBlock(ctx.user.id, found.format);

        let socialPostId: number;
        let contentType: string;
        let contentId: number | null = null;

        if (found.format === "carousel") {
          const carousel = await generateCarouselWithAgent({
            topic: `${found.suggestedTitle}. Pauta: ${found.pauta}`,
            style: "educational",
            slideCount: 6,
            calibrationBlock: calibrationBlock || undefined,
          });
          const savedCarousel = await db.saveCarousel(ctx.user.id, {
            topic: found.suggestedTitle,
            style: "educational",
            hook: carousel.hook,
            caption: carousel.caption,
            finalCta: carousel.finalCta,
            coverImageUrl: carousel.coverImageUrl,
            slides: carousel.slides as import("../drizzle/schema").CarouselSlideData[],
          });
          const scheduledAt = new Date(`${found.scheduledDate}T12:00:00`);
          const post = await db.saveSocialPost(ctx.user.id, {
            channel: "instagram",
            title: found.suggestedTitle,
            content: carousel.caption || found.pauta,
            scheduledAt,
          });
          await db.updateSocialPost(post.id, ctx.user.id, {
            contentType: "carousel",
            contentId: savedCarousel.id,
          });
          socialPostId = post.id;
          contentType = "carousel";
          contentId = savedCarousel.id;
        } else {
          const channelMap: Record<string, "instagram" | "linkedin" | "newsletter"> = {
            instagram: "instagram",
            linkedin: "linkedin",
            newsletter: "newsletter",
          };
          const channel = channelMap[found.format] ?? "instagram";

          const toneGuide: Record<string, string> = {
            professional: "profissional e direto",
            casual: "casual e próximo",
            inspiring: "inspirador e motivacional",
            educational: "educativo e informativo",
          };
          const effectiveTone = brand?.toneOfVoice ?? "professional";

          const llmResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: [
                  `Você é um especialista em copywriting para ${channel} no Brasil.`,
                  brand?.companyName ? `Marca: ${brand.companyName}${brand.industry ? ` (${brand.industry})` : ""}` : null,
                  `Tom de voz: ${toneGuide[effectiveTone] ?? effectiveTone}`,
                  calibrationBlock || null,
                ].filter(Boolean).join("\n\n"),
              },
              {
                role: "user",
                content: `Crie um post completo para ${channel} sobre: "${found.suggestedTitle}".\n\nPauta: ${found.pauta}\n\nCategoria editorial: ${found.category}\n\nResponda em JSON: { "title": "...", "content": "..." }`,
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
            max_tokens: 1200,
          });

          const rawPost = llmResponse.choices[0]?.message?.content;
          const parsed = JSON.parse(typeof rawPost === "string" ? rawPost : "{}") as { title?: string; content?: string };

          const scheduledAt = new Date(`${found.scheduledDate}T12:00:00`);
          const post = await db.saveSocialPost(ctx.user.id, {
            channel,
            title: parsed.title || found.suggestedTitle,
            content: parsed.content || found.pauta,
            scheduledAt,
          });
          socialPostId = post.id;
          contentType = "post";
        }

        await db.updateEditorialPlanItem(input.id, ctx.user.id, {
          status: "done",
          socialPostId,
          contentType,
          contentId: contentId ?? undefined,
        });

        return { socialPostId, contentType };
      } catch (err) {
        await db.updateEditorialPlanItem(input.id, ctx.user.id, { status: "approved" });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Erro ao gerar conteúdo: ${err instanceof Error ? err.message : "falha desconhecida"}`,
        });
      }
    }),
});

// ─── Stories Router (Module 2.2) ──────────────────────────────────────────────

const storiesRouter = router({
  generate: protectedProcedure
    .input(z.object({
      topic: z.string().min(3).max(512),
      storyTypes: z.array(z.enum(STORY_TYPES)).min(1).max(5).optional(),
      sourcePostId: z.number().int().optional(),
      nSlides: z.number().int().min(1).max(5).default(3),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      const brand = await db.getBrandKit(ctx.user.id);
      const calibrationBlock = await getCalibrationBlock(ctx.user.id, "story");

      const brandContext = brand?.companyName
        ? [
            `IDENTIDADE DA MARCA:`,
            `- Empresa: ${brand.companyName}${brand.industry ? ` (${brand.industry})` : ""}`,
            brand.tagline ? `- Tagline: "${brand.tagline}"` : null,
            brand.targetAudience ? `- Público-alvo: ${brand.targetAudience}` : null,
            brand.toneOfVoice ? `- Tom de voz: ${brand.toneOfVoice}` : null,
          ].filter(Boolean).join("\n")
        : null;

      const allowedTypes = input.storyTypes ?? [...STORY_TYPES];
      const typeDescriptions: Record<string, string> = {
        poll: "enquete com pergunta e 2 opções (option_a, option_b)",
        quiz: "quiz com pergunta, array de options (2-4) e correct_index",
        countdown: "contagem regressiva com body, target_label e cta",
        question_box: "caixinha de perguntas com prompt_text de abertura",
        behind_scenes: "bastidores com caption e tone: personal|educational|funny",
        post_reinforcement: "reforço de post do feed com angle e cta",
      };

      const allowedDesc = allowedTypes
        .map((t) => `  - "${t}": ${typeDescriptions[t]}`)
        .join("\n");

      const prompt = [
        `Crie um conjunto de ${input.nSlides} story(s) para Instagram sobre o tema: "${input.topic}".`,
        `Tipos permitidos neste conjunto (use apenas estes):\n${allowedDesc}`,
        `Cada slide deve ter: type, headline (≤60 chars), visual_prompt (inglês, cena descritiva para imagem de fundo), e os campos específicos do tipo.`,
        `O conjunto deve ter: setTitle (título interno), theme (contexto narrativo), caption (legenda do post agendado, otimizada para Instagram com 2-3 hashtags), hashtags (array, max 5).`,
        calibrationBlock || null,
        brandContext,
      ].filter(Boolean).join("\n\n");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Você é um especialista em estratégia de Instagram Stories. Crie sequências de stories que maximizem engajamento e interações." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "story_set",
            strict: true,
            schema: {
              type: "object",
              properties: {
                setTitle: { type: "string" },
                theme: { type: "string" },
                caption: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                slides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: allowedTypes },
                      headline: { type: "string" },
                      visual_prompt: { type: "string" },
                      question: { anyOf: [{ type: "string" }, { type: "null" }] },
                      option_a: { anyOf: [{ type: "string" }, { type: "null" }] },
                      option_b: { anyOf: [{ type: "string" }, { type: "null" }] },
                      options: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
                      correct_index: { anyOf: [{ type: "number" }, { type: "null" }] },
                      explanation: { anyOf: [{ type: "string" }, { type: "null" }] },
                      body: { anyOf: [{ type: "string" }, { type: "null" }] },
                      target_label: { anyOf: [{ type: "string" }, { type: "null" }] },
                      cta: { anyOf: [{ type: "string" }, { type: "null" }] },
                      prompt_text: { anyOf: [{ type: "string" }, { type: "null" }] },
                      caption: { anyOf: [{ type: "string" }, { type: "null" }] },
                      tone: { anyOf: [{ type: "string", enum: ["personal", "educational", "funny"] }, { type: "null" }] },
                      angle: { anyOf: [{ type: "string" }, { type: "null" }] },
                    },
                    required: ["type", "headline", "visual_prompt", "question", "option_a", "option_b", "options", "correct_index", "explanation", "body", "target_label", "cta", "prompt_text", "caption", "tone", "angle"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["setTitle", "theme", "caption", "hashtags", "slides"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: 2000,
      });

      const raw = response.choices[0]?.message?.content;
      const payload = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw ?? "{}")) as StorySetPayload;

      // Validate with Zod — surface friendly error if LLM output is malformed
      const parsed = StorySetSchema.safeParse(payload);
      if (!parsed.success) {
        console.warn("[Stories] Zod validation failed:", parsed.error.flatten());
        // Return raw payload so UI can still display something
        return { storySet: payload as unknown as typeof parsed.data, warning: "Estrutura parcial — revise os slides antes de salvar." };
      }

      // Art director + DALL-E 3 + sharp pipeline: generate 1080×1920 background per slide
      const { generateSlideImages } = await import("./_core/imageGenerator");
      const brandColors = brand
        ? [brand.primaryColor, brand.secondaryColor, brand.accentColor].filter(Boolean).join(", ")
        : undefined;
      const imageResults = await generateSlideImages(parsed.data.slides, input.topic, brandColors ?? undefined);
      const slidesWithImages = parsed.data.slides.map((slide, i) => {
        const img = imageResults[i];
        return {
          ...slide,
          imageUrl: img?.url ?? undefined,
          imageOverlayColor: img?.overlayColor ?? undefined,
          suggestedHeadline: img?.suggestedHeadline ?? undefined,
          suggestedCta: img?.suggestedCta ?? undefined,
        };
      });

      return { storySet: { ...parsed.data, slides: slidesWithImages } };
    }),

  save: protectedProcedure
    .input(z.object({
      storySet: z.object({
        setTitle: z.string(),
        theme: z.string(),
        caption: z.string(),
        hashtags: z.array(z.string()),
        slides: z.array(z.record(z.string(), z.unknown())).min(1).max(5),
      }),
      scheduledAt: scheduledAtInputSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      const scheduledAt = input.scheduledAt ? parseScheduledAtInput(input.scheduledAt) : undefined;
      const saved = await db.saveSocialPost(ctx.user.id, {
        channel: "instagram",
        title: input.storySet.setTitle,
        content: input.storySet.caption,
        scheduledAt,
        contentType: "story",
        storyData: JSON.stringify(input.storySet),
      });
      return saved;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    requirePaidPlan(ctx.user as PlanUser);
    return db.getStoryPosts(ctx.user.id);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);
      await db.deleteSocialPost(input.id, ctx.user.id);
      return { success: true };
    }),

  publish: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      imageDataUrl: z.string().startsWith("data:image/"),
    }))
    .mutation(async ({ ctx, input }) => {
      requirePaidPlan(ctx.user as PlanUser);

      const post = await db.getSocialPostById(input.id, ctx.user.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Story não encontrado." });

      const { publishInstagramStory } = await import("./_core/instagramPostingAgent");
      const result = await publishInstagramStory({
        userId: ctx.user.id,
        imageDataUrl: input.imageDataUrl,
        caption: post.content,
      });

      await db.updateSocialPost(input.id, ctx.user.id, {
        status: "published",
        igMediaId: result.mediaId,
        publishedAt: new Date(),
      });

      return { success: true, mediaId: result.mediaId };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && opts.ctx.user.email === adminEmail && opts.ctx.user.role !== "admin") {
        await db.setUserRole(opts.ctx.user.id, "admin");
        const fresh = await db.getUserByOpenId(opts.ctx.user.openId);
        if (fresh) {
          const { passwordHash: _ph, ...safeUser } = fresh;
          return safeUser;
        }
      }
      const { passwordHash: _ph, ...safeUser } = opts.ctx.user;
      return safeUser;
    }),

    register: publicRateLimitedProcedure
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
        const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        await db.upsertUser({ openId, name: input.name, email: input.email, loginMethod: "email", passwordHash, ...(trialExpiresAt && { trialExpiresAt }) } as Parameters<typeof db.upsertUser>[0]);
        const user = await db.getUserByOpenId(openId);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar usuário" });
        const sessionToken = await sdk.createSessionToken(openId, { name: input.name, expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        const { passwordHash: _rph, ...safeRegUser } = user;
        return safeRegUser;
      }),

    login: publicRateLimitedProcedure
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
        // Auto-grant admin role to the designated admin email on every login
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && user.email === adminEmail && user.role !== 'admin') {
          await db.setUserRole(user.id, 'admin');
        }
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        const freshUser = await db.getUserByOpenId(user.openId);
        const { passwordHash: _lph, ...safeLoginUser } = freshUser ?? user;
        return safeLoginUser;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    trialStatus: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user as typeof ctx.user & { trialExpiresAt?: Date | null; plan?: string; role?: string };
      const { isPaid, status } = getTrialState(user);
      const plan = (user.plan ?? 'free') as string;
      const expires = user.trialExpiresAt instanceof Date ? user.trialExpiresAt : null;
      const now = new Date();
      const isActive = status === 'trial';
      const isExpired = status === 'expired';
      const isLegacy = status === 'legacy';
      const daysLeft = isActive
        ? Math.ceil((expires!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : 0;
      const today = now.toISOString().slice(0, 10);
      const usage = (isActive || isLegacy) ? await db.getDailyUsageAll(ctx.user.id, today) : {};
      return {
        plan,
        isPaid,
        isActive,
        isExpired,
        isLegacy,
        daysLeft,
        expiresAt: expires?.toISOString() ?? null,
        limits: TRIAL_DAILY_LIMITS,
        usage: {
          images:   usage['images']   ?? 0,
          carousel: usage['carousel'] ?? 0,
          articles: usage['articles'] ?? 0,
          posts:    usage['posts']    ?? 0,
        },
      };
    }),

    upgradePlan: publicProcedure
      .input(z.object({
        webhookSecret: z.string(),
        userEmail: z.string().email(),
        plan: z.enum(["pro", "agency"]),
        paymentId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const secret = process.env.PAYMENT_WEBHOOK_SECRET;
        if (!secret || input.webhookSecret !== secret) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Webhook secret inválido.' });
        }
        const user = await db.getUserByEmail(input.userEmail);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado para este email.' });
        }
        await db.setUserPlan(user.id, input.plan);
        console.log(`[Payment] Upgraded user ${user.email} (id=${user.id}) to plan=${input.plan} paymentId=${input.paymentId ?? 'n/a'}`);
        return { success: true, userId: user.id, plan: input.plan };
      }),
  }),
  chat: chatRouter,
  images: imagesRouter,
  videos: videosRouter,
  articles: articlesRouter,
  carousel: carouselRouter,
  campaign: campaignRouter,
  canva: canvaRouter,
  posts: postsRouter,
  analytics: analyticsRouter,
  admin: adminRouter,
  features: featuresRouter,
  brandKit: brandKitRouter,
  reels: reelsRouter,
  commentAlerts: commentAlertsRouter,
  commentAutomations: commentAutomationsRouter,
  styleAnalyzer: styleAnalyzerRouter,
  radar: radarRouter,
  seo: seoRouter,
  searchConsole: searchConsoleRouter,
  performance: performanceRouter,
  editorialPlan: editorialPlanRouter,
  stories: storiesRouter,
});

export type AppRouter = typeof appRouter;
