import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { generateCarouselWithAgent } from "./_core/carouselAgent";
import { saveCarouselTemplateAsset } from "./_core/carouselTemplateAgent";
import { publishArticleToLinkedInWithAgent } from "./_core/linkedinArticlePostingAgent";
import { publishInstagramCarouselWithAgent } from "./_core/instagramPostingAgent";

// Mock db module
vi.mock("./db", () => ({
  getConversations: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({ id: 1, title: "Nova Conversa", userId: 1, createdAt: new Date(), updatedAt: new Date() }),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  getMessages: vi.fn().mockResolvedValue([]),
  addMessage: vi.fn().mockResolvedValue({ id: 1, conversationId: 1, userId: 1, role: "user", content: "test", createdAt: new Date() }),
  getChatCount: vi.fn().mockResolvedValue(5),
  getImages: vi.fn().mockResolvedValue([]),
  saveImage: vi.fn().mockResolvedValue({ id: 1, userId: 1, prompt: "test", imageUrl: "https://example.com/img.png", createdAt: new Date() }),
  deleteImage: vi.fn().mockResolvedValue(undefined),
  getImageCount: vi.fn().mockResolvedValue(3),
  getAvatarVideos: vi.fn().mockResolvedValue([]),
  saveAvatarVideo: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    provider: "d-id",
    title: "Video teste",
    topic: "Tema teste",
    script: "Roteiro do video",
    sourceImageUrl: "/uploads/videos/1/sources/source.png",
    videoUrl: null,
    voiceProvider: "microsoft",
    voiceId: "pt-BR-FranciscaNeural",
    providerJobId: null,
    status: "processing",
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateAvatarVideo: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    provider: "d-id",
    title: "Video teste",
    topic: "Tema teste",
    script: "Roteiro do video",
    sourceImageUrl: "/uploads/videos/1/sources/source.png",
    videoUrl: "https://example.com/video.mp4",
    voiceProvider: "microsoft",
    voiceId: "pt-BR-FranciscaNeural",
    providerJobId: "talk_123",
    status: "completed",
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  deleteAvatarVideo: vi.fn().mockResolvedValue(undefined),
  getAvatarVideoCount: vi.fn().mockResolvedValue(1),
  getArticles: vi.fn().mockResolvedValue([]),
  getArticle: vi.fn().mockResolvedValue(undefined),
  saveArticle: vi.fn().mockResolvedValue({ id: 1, userId: 1, title: "Test", content: "Content", status: "draft", createdAt: new Date(), updatedAt: new Date() }),
  updateArticle: vi.fn().mockResolvedValue(undefined),
  deleteArticle: vi.fn().mockResolvedValue(undefined),
  getArticleCount: vi.fn().mockResolvedValue(2),
  getCarousels: vi.fn().mockResolvedValue([]),
  getCarouselTemplates: vi.fn().mockResolvedValue([]),
  getCarouselTemplate: vi.fn().mockResolvedValue({
    id: 9,
    userId: 1,
    name: "Editorial premium",
    imageUrl: "/uploads/carousel-templates/1/template.png",
    styleBrief: "Visual editorial premium, contrastado, com fotografia limpa e elegante.",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  saveCarouselTemplate: vi.fn().mockResolvedValue({
    id: 9,
    userId: 1,
    name: "Editorial premium",
    imageUrl: "/uploads/carousel-templates/1/template.png",
    styleBrief: "Visual editorial premium, contrastado, com fotografia limpa e elegante.",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  saveCarousel: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    topic: "Test carousel",
    style: "signature",
    hook: "Gancho forte",
    caption: "Legenda pronta",
    finalCta: "Salve este carrossel",
    coverImageUrl: "https://example.com/carousel-cover.png",
    slides: [{ title: "Slide 1", body: "Texto do slide", imageUrl: "https://example.com/slide-1.png" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateCarouselSlides: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    topic: "Test carousel",
    style: "signature",
    hook: "Gancho forte",
    caption: "Legenda pronta",
    finalCta: "Salve este carrossel",
    coverImageUrl: "https://example.com/carousel-cover.png",
    slides: [{
      title: "Slide 1",
      body: "Texto do slide",
      imageUrl: "https://example.com/slide-1.png",
      templateSvgUrl: "https://example.com/slide-1.svg",
      renderedImageUrl: "https://example.com/slide-1-rendered.png",
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  deleteCarousel: vi.fn().mockResolvedValue(undefined),
  deleteCarouselTemplate: vi.fn().mockResolvedValue(undefined),
  getCarouselCount: vi.fn().mockResolvedValue(4),
  getSocialPosts: vi.fn().mockResolvedValue([]),
  saveSocialPost: vi.fn().mockResolvedValue({ id: 1, userId: 1, channel: "instagram", content: "test", status: "draft", createdAt: new Date(), updatedAt: new Date() }),
  updateSocialPost: vi.fn().mockResolvedValue(undefined),
  deleteSocialPost: vi.fn().mockResolvedValue(undefined),
  getPostCount: vi.fn().mockResolvedValue(10),
  getUserByOpenId: vi.fn().mockResolvedValue({ id: 1, openId: "test-user" }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{"title":"Test Article","summary":"Summary","content":"Content"}' } }],
  }),
}));

// Mock image generation
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/generated.png" }),
}));

vi.mock("./_core/carouselAgent", () => ({
  generateCarouselWithAgent: vi.fn().mockResolvedValue({
    hook: "Gancho forte",
    caption: "Legenda pronta",
    finalCta: "Salve este carrossel",
    coverImageUrl: "https://example.com/carousel-cover.png",
    slides: [{ title: "Slide 1", body: "Texto do slide", imageUrl: "https://example.com/slide-1.png" }],
  }),
}));

vi.mock("./_core/carouselTemplateAgent", () => ({
  saveCarouselTemplateAsset: vi.fn().mockResolvedValue({
    imageUrl: "/uploads/carousel-templates/1/template.png",
    styleBrief: "Visual editorial premium, contrastado, com fotografia limpa e elegante.",
  }),
}));

vi.mock("./_core/linkedinArticlePostingAgent", () => ({
  publishArticleToLinkedInWithAgent: vi.fn().mockResolvedValue({
    success: true,
    postUrn: "urn:li:share:123",
    authorUrn: "urn:li:organization:5515715",
    postType: "article",
    commentary: "Texto pronto para LinkedIn",
    articleTitle: "Titulo do artigo",
    articleDescription: "Descricao do artigo",
    imageAltText: "Capa do artigo",
    imageUrn: "urn:li:image:123",
    sourceUrl: "https://example.com/article",
  }),
  diagnoseLinkedInAuth: vi.fn().mockResolvedValue({
    success: false,
    apiBaseUrl: "https://api.linkedin.com/rest",
    apiVersion: "202601",
    tokenPresent: true,
    tokenPreview: "AQS7****1234",
    configuredAuthorUrn: "urn:li:person:SEU_ID",
    configuredAuthorUrnType: "person",
    configuredAuthorUrnLooksValid: true,
    configuredAuthorUrnIsPlaceholder: true,
    detectedPersonUrn: "urn:li:person:real-id",
    detectedMemberId: "real-id",
    detectedMemberName: "Pessoa Teste",
    administeredOrganizationUrns: [],
    recommendedAuthorUrns: ["urn:li:person:real-id"],
    checks: [
      {
        name: "Validade do token",
        ok: true,
        detail: "Token valido.",
      },
    ],
    nextSteps: ["Troque LINKEDIN_AUTHOR_URN para urn:li:person:real-id."],
  }),
}));

vi.mock("./_core/instagramPostingAgent", () => ({
  publishInstagramCarouselWithAgent: vi.fn().mockResolvedValue({
    success: true,
    mediaId: "17890000000000000",
    containerId: "17900000000000000",
    childContainerIds: [],
    slideUrls: ["https://files.catbox.moe/instagram-post.png"],
    publicAssetType: "png",
    caption: "Conteudo do post",
  }),
}));

vi.mock("./_core/carouselPersistence", () => ({
  persistCarouselAssets: vi.fn().mockImplementation(async ({ coverImageUrl, slides }) => ({
    coverImageUrl,
    slides,
  })),
  persistCarouselDesignAssets: vi.fn().mockImplementation(async ({ slides }) => ({
    slides: slides.map((slide: any) => ({
      title: slide.title,
      body: slide.body || "",
      imageUrl: slide.imageUrl,
      templateSvgUrl: slide.templateSvgUrl || "https://example.com/slide-1.svg",
      renderedImageUrl:
        slide.renderedImageUrl || "https://example.com/slide-1-rendered.png",
    })),
  })),
  getCarouselAssetDataUrl: vi.fn().mockResolvedValue(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9mV8QAAAAASUVORK5CYII="
  ),
}));

vi.mock("./_core/videoScriptAgent", () => ({
  generateVideoScriptWithAgent: vi.fn().mockResolvedValue({
    title: "Video teste",
    script: "Roteiro gerado para o avatar.",
  }),
}));

vi.mock("./_core/openaiRealtime", () => ({
  createOpenAIRealtimeToken: vi.fn().mockResolvedValue({
    value: "ek_test_123",
    expiresAt: 1756310470,
    session: {
      type: "realtime",
      model: "gpt-realtime",
    },
  }),
}));

vi.mock("./_core/didAvatarAgent", () => ({
  prepareDidSourceImage: vi.fn().mockResolvedValue({
    previewSourceImageUrl: "/uploads/videos/1/sources/source.png",
    providerSourceImageUrl: "https://d-id-storage.example.com/source.png",
  }),
  createDidTalk: vi.fn().mockResolvedValue({
    talkId: "talk_123",
    sourceImageUrl: "https://d-id-storage.example.com/source.png",
    voiceProvider: "microsoft",
    voiceId: "pt-BR-FranciscaNeural",
  }),
  waitForDidTalkCompletion: vi.fn().mockResolvedValue({
    resultUrl: "https://example.com/result.mp4",
  }),
  downloadAndStoreDidVideo: vi.fn().mockResolvedValue({
    videoUrl: "https://example.com/video.mp4",
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: Array<{ name: string; options: Record<string, unknown> }> } {
  const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {}, ip: `test-${Math.random()}` } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });

  it("returns current user for auth.me", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.email).toBe("test@example.com");
  });
});

// ─── Chat Tests ───────────────────────────────────────────────────────────────
describe("chat", () => {
  it("returns empty conversations list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const conversations = await caller.chat.getConversations();
    expect(Array.isArray(conversations)).toBe(true);
  });

  it("creates a new conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const conv = await caller.chat.createConversation({ title: "Test" });
    expect(conv.id).toBe(1);
    expect(conv.title).toBe("Nova Conversa");
  });

  it("returns chat stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.chat.getStats();
    expect(stats.count).toBe(5);
  });

  it("deletes a conversation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.deleteConversation({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Images Tests ─────────────────────────────────────────────────────────────
describe("images", () => {
  it("returns empty images list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const images = await caller.images.getAll();
    expect(Array.isArray(images)).toBe(true);
  });

  it("returns image stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.images.getStats();
    expect(stats.count).toBe(3);
  });

  it("deletes an image", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.images.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Articles Tests ───────────────────────────────────────────────────────────
describe("videos", () => {
  it("returns empty videos list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const videos = await caller.videos.getAll();
    expect(Array.isArray(videos)).toBe(true);
  });

  it("creates an OpenAI realtime token", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const token = await caller.videos.createRealtimeToken({});

    expect(token.value).toBe("ek_test_123");
    expect(token.session).toMatchObject({ type: "realtime" });
  });

  it("generates a script for the avatar video", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const script = await caller.videos.generateScript({
      topic: "Como reduzir custos com energia",
      tone: "professional",
    });

    expect(script.title).toBe("Video teste");
    expect(script.script).toContain("Roteiro");
  });

  it("creates and stores a talking avatar video", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const video = await caller.videos.generate({
      title: "Video teste",
      topic: "Como reduzir custos com energia",
      script: "Roteiro do video com avatar.",
      sourceImageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9mV8QAAAAASUVORK5CYII=",
      voiceId: "pt-BR-FranciscaNeural",
    });

    expect(video.status).toBe("completed");
    expect(video.videoUrl).toBe("https://example.com/video.mp4");
  });

  it("returns video stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.videos.getStats();
    expect(stats.count).toBe(1);
  });

  it("deletes a video", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("articles", () => {
  it("returns empty articles list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const articles = await caller.articles.getAll();
    expect(Array.isArray(articles)).toBe(true);
  });

  it("returns article stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.articles.getStats();
    expect(stats.count).toBe(2);
  });

  it("updates an article", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.articles.update({ id: 1, title: "Updated Title" });
    expect(result.success).toBe(true);
  });

  it("deletes an article", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.articles.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("publishes an article to LinkedIn through the agent", async () => {
    vi.mocked(db.getArticle).mockResolvedValueOnce({
      id: 7,
      userId: 1,
      title: "Mercado livre de energia em 2026",
      topic: "Energia",
      sourceUrl: "https://example.com/article",
      coverImageUrl: "https://example.com/cover.png",
      content: "Conteudo do artigo",
      summary: "Resumo do artigo",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.saveSocialPost).mockResolvedValueOnce({
      id: 55,
      userId: 1,
      channel: "linkedin",
      title: "Mercado livre de energia em 2026",
      content: "Texto pronto para LinkedIn",
      imageUrl: "https://example.com/cover.png",
      scheduledAt: null,
      publishedAt: null,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.articles.publishLinkedIn({ id: 7 });

    expect(result.success).toBe(true);
    expect(vi.mocked(publishArticleToLinkedInWithAgent)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Mercado livre de energia em 2026",
        sourceUrl: "https://example.com/article",
      })
    );
    expect(vi.mocked(db.updateArticle)).toHaveBeenCalledWith(7, 1, {
      status: "published",
    });
    expect(vi.mocked(db.saveSocialPost)).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        channel: "linkedin",
        content: "Texto pronto para LinkedIn",
      })
    );
    expect(vi.mocked(db.updateSocialPost)).toHaveBeenCalledWith(55, 1, {
      status: "published",
      publishedAt: expect.any(Date),
    });
  });

  it("returns a LinkedIn diagnostic report", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.articles.diagnoseLinkedIn();

    expect(result.success).toBe(false);
    expect(result.detectedPersonUrn).toBe("urn:li:person:real-id");
    expect(result.nextSteps[0]).toContain("LINKEDIN_AUTHOR_URN");
  });
});

// ─── Posts Tests ──────────────────────────────────────────────────────────────
describe("carousel", () => {
  it("returns empty carousels list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const carousels = await caller.carousel.getAll();
    expect(Array.isArray(carousels)).toBe(true);
  });

  it("returns saved carousel templates", async () => {
    vi.mocked(db.getCarouselTemplates).mockResolvedValueOnce([
      {
        id: 9,
        userId: 1,
        name: "Editorial premium",
        imageUrl: "/uploads/carousel-templates/1/template.png",
        styleBrief: "Visual editorial premium, contrastado, com fotografia limpa e elegante.",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const templates = await caller.carousel.getTemplates();

    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toBe("Editorial premium");
  });

  it("creates a reusable carousel template", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const template = await caller.carousel.createTemplate({
      name: "Editorial premium",
      imageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9mV8QAAAAASUVORK5CYII=",
    });

    expect(template.id).toBe(9);
    expect(vi.mocked(saveCarouselTemplateAsset)).toHaveBeenCalled();
    expect(vi.mocked(db.saveCarouselTemplate)).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "Editorial premium" })
    );
  });

  it("persists a generated carousel", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const carousel = await caller.carousel.generate({
      topic: "Como crescer no Instagram",
      slideCount: 1,
      style: "signature",
    });
    expect(carousel.id).toBe(1);
    expect(carousel.topic).toBe("Test carousel");
  });

  it("uses the selected template when generating a carousel", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.carousel.generate({
      topic: "Como crescer no Instagram",
      slideCount: 1,
      style: "signature",
      templateId: 9,
    });

    expect(vi.mocked(db.getCarouselTemplate)).toHaveBeenCalledWith(9, 1);
    expect(vi.mocked(generateCarouselWithAgent)).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "Editorial premium",
        templateImageUrl: "/uploads/carousel-templates/1/template.png",
      })
    );
    expect(vi.mocked(db.saveCarousel)).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ style: "Editorial premium" })
    );
  });

  it("schedules a carousel for Instagram", async () => {
    const scheduledAt = "2099-01-02T10:30";
    const expectedScheduledAt = new Date("2099-01-02T13:30:00.000Z");
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.carousel.scheduleInstagram({
      topic: "Como crescer no Instagram",
      style: "signature",
      hook: "Gancho forte",
      caption: "Legenda pronta",
      finalCta: "Salve este carrossel",
      scheduledAt,
      slides: [{ title: "Slide 1", body: "Texto do slide", imageUrl: "https://example.com/slide-1.png" }],
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(db.saveSocialPost)).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        channel: "instagram",
        scheduledAt: expectedScheduledAt,
        metadata: expect.stringContaining("instagram_carousel"),
      })
    );
  });

  it("returns carousel stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.carousel.getStats();
    expect(stats.count).toBe(4);
  });

  it("deletes a carousel", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.carousel.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("deletes a saved carousel template", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.carousel.deleteTemplate({ id: 9 });

    expect(result.success).toBe(true);
    expect(vi.mocked(db.deleteCarouselTemplate)).toHaveBeenCalledWith(9, 1);
  });
});

describe("posts", () => {
  it("returns empty posts list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const posts = await caller.posts.getAll({});
    expect(Array.isArray(posts)).toBe(true);
  });

  it("returns posts filtered by channel", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const posts = await caller.posts.getAll({ channel: "instagram" });
    expect(Array.isArray(posts)).toBe(true);
  });

  it("creates a post", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const post = await caller.posts.create({
      channel: "instagram",
      content: "Test post content",
    });
    expect(post.id).toBe(1);
    expect(post.channel).toBe("instagram");
  });

  it("returns post stats", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.posts.getStats();
    expect(stats.count).toBe(10);
  });

  it("publishes an Instagram post with its image through Meta", async () => {
    const dbModule = await import("./db");
    vi.mocked(dbModule.getSocialPosts).mockResolvedValueOnce([
      {
        id: 99,
        userId: 1,
        channel: "instagram",
        title: "Post pronto",
        content: "Conteudo do post",
        imageUrl: "data:image/png;base64,aW1hZ2U=",
        scheduledAt: null,
        publishedAt: null,
        status: "draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.posts.publish({ id: 99 });

    expect(result).toMatchObject({
      success: true,
      status: "published",
      mediaId: "17890000000000000",
      imageUrl: "https://files.catbox.moe/instagram-post.png",
    });
    expect(vi.mocked(publishInstagramCarouselWithAgent)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        caption: "Conteudo do post",
        slides: [
          expect.objectContaining({
            imageDataUrl: "data:image/png;base64,aW1hZ2U=",
          }),
        ],
      })
    );
    expect(dbModule.updateSocialPost).toHaveBeenCalledWith(
      99,
      1,
      expect.objectContaining({
        status: "published",
        publishedAt: expect.any(Date),
        imageUrl: "https://files.catbox.moe/instagram-post.png",
      })
    );
  });

  it("deletes a post", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.posts.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Settings Tests ───────────────────────────────────────────────────────────
