import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

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
  getArticles: vi.fn().mockResolvedValue([]),
  getArticle: vi.fn().mockResolvedValue(undefined),
  saveArticle: vi.fn().mockResolvedValue({ id: 1, userId: 1, title: "Test", content: "Content", status: "draft", createdAt: new Date(), updatedAt: new Date() }),
  updateArticle: vi.fn().mockResolvedValue(undefined),
  deleteArticle: vi.fn().mockResolvedValue(undefined),
  getArticleCount: vi.fn().mockResolvedValue(2),
  getSocialPosts: vi.fn().mockResolvedValue([]),
  saveSocialPost: vi.fn().mockResolvedValue({ id: 1, userId: 1, channel: "instagram", content: "test", status: "draft", createdAt: new Date(), updatedAt: new Date() }),
  updateSocialPost: vi.fn().mockResolvedValue(undefined),
  deleteSocialPost: vi.fn().mockResolvedValue(undefined),
  getPostCount: vi.fn().mockResolvedValue(10),
  getUserByOpenId: vi.fn().mockResolvedValue({ id: 1, openId: "test-user", n8nWebhookUrl: null }),
  updateUserWebhooks: vi.fn().mockResolvedValue(undefined),
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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
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
});

// ─── Posts Tests ──────────────────────────────────────────────────────────────
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

  it("deletes a post", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.posts.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Settings Tests ───────────────────────────────────────────────────────────
describe("settings", () => {
  it("returns webhook settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const webhooks = await caller.settings.getWebhooks();
    expect(typeof webhooks.n8nWebhookUrl).toBe("string");
    expect(typeof webhooks.n8nImageWebhookUrl).toBe("string");
    expect(typeof webhooks.n8nArticleWebhookUrl).toBe("string");
    expect(typeof webhooks.n8nPostWebhookUrl).toBe("string");
    expect(typeof webhooks.n8nCarouselWebhookUrl).toBe("string");
  });

  it("updates webhook settings", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.updateWebhooks({
      n8nWebhookUrl: "https://n8n.example.com/webhook/chat",
    });
    expect(result.success).toBe(true);
  });
});
