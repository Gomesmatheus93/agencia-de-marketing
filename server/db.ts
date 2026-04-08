import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  chatConversations,
  chatMessages,
  generatedImages,
  articles,
  carousels,
  socialPosts,
  type ChatConversation,
  type ChatMessage,
  type GeneratedImage,
  type Article,
  type Carousel,
  type CarouselSlideData,
  type SocialPost,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _carouselTableReady: Promise<void> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function parseCarouselSlides(value: unknown): CarouselSlideData[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        title: typeof item.title === "string" ? item.title : "",
        body: typeof item.body === "string" ? item.body : "",
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
        templateSvgUrl:
          typeof item.templateSvgUrl === "string" ? item.templateSvgUrl : undefined,
        renderedImageUrl:
          typeof item.renderedImageUrl === "string" ? item.renderedImageUrl : undefined,
      }));
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    return parseCarouselSlides(JSON.parse(value));
  } catch {
    return [];
  }
}

function hydrateCarousel(row: Omit<Carousel, "slides"> & { slides: unknown }): Carousel {
  return {
    ...row,
    slides: parseCarouselSlides(row.slides),
  };
}

async function ensureCarouselTable() {
  const db = await getDb();
  if (!db) return;

  if (!_carouselTableReady) {
    _carouselTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS carousels (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          topic varchar(512) NOT NULL,
          style varchar(100) NOT NULL,
          hook text NOT NULL,
          caption text NOT NULL,
          finalCta text NOT NULL,
          coverImageUrl text,
          slides text NOT NULL,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    })().catch((error) => {
      _carouselTableReady = null;
      throw error;
    });
  }

  await _carouselTableReady;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserWebhooks(
  userId: number,
  webhooks: {
    n8nWebhookUrl?: string | null;
    n8nImageWebhookUrl?: string | null;
    n8nArticleWebhookUrl?: string | null;
    n8nPostWebhookUrl?: string | null;
    n8nCarouselWebhookUrl?: string | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(webhooks).where(eq(users.id, userId));
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function getConversations(userId: number): Promise<ChatConversation[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatConversations)
    .where(eq(chatConversations.userId, userId))
    .orderBy(desc(chatConversations.updatedAt));
}

export async function createConversation(userId: number, title?: string): Promise<ChatConversation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(chatConversations).values({
    userId,
    title: title || "Nova Conversa",
  });
  const created = await db.select().from(chatConversations)
    .where(eq(chatConversations.id, (result as any).insertId)).limit(1);
  return created[0];
}

export async function updateConversationTitle(id: number, userId: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(chatConversations).set({ title }).where(
    and(eq(chatConversations.id, id), eq(chatConversations.userId, userId))
  );
}

export async function deleteConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatMessages).where(eq(chatMessages.conversationId, id));
  await db.delete(chatConversations).where(
    and(eq(chatConversations.id, id), eq(chatConversations.userId, userId))
  );
}

export async function getMessages(conversationId: number, userId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.userId, userId)))
    .orderBy(chatMessages.createdAt);
}

export async function addMessage(
  conversationId: number,
  userId: number,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(chatMessages).values({ conversationId, userId, role, content });
  // Update conversation updatedAt
  await db.update(chatConversations).set({ updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));
  const created = await db.select().from(chatMessages)
    .where(eq(chatMessages.id, (result as any).insertId)).limit(1);
  return created[0];
}

export async function getChatCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(chatConversations).where(eq(chatConversations.userId, userId));
  return result.length;
}

// ─── Images ───────────────────────────────────────────────────────────────────

export async function getImages(userId: number): Promise<GeneratedImage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedImages)
    .where(eq(generatedImages.userId, userId))
    .orderBy(desc(generatedImages.createdAt));
}

export async function saveImage(
  userId: number,
  prompt: string,
  imageUrl: string,
  fileKey?: string
): Promise<GeneratedImage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(generatedImages).values({ userId, prompt, imageUrl, fileKey });
  const created = await db.select().from(generatedImages)
    .where(eq(generatedImages.id, (result as any).insertId)).limit(1);
  return created[0];
}

export async function deleteImage(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(generatedImages).where(
    and(eq(generatedImages.id, id), eq(generatedImages.userId, userId))
  );
}

export async function getImageCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(generatedImages).where(eq(generatedImages.userId, userId));
  return result.length;
}

// ─── Articles ─────────────────────────────────────────────────────────────────

export async function getArticles(userId: number): Promise<Article[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(articles)
    .where(eq(articles.userId, userId))
    .orderBy(desc(articles.createdAt));
}

export async function getArticle(id: number, userId: number): Promise<Article | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(articles)
    .where(and(eq(articles.id, id), eq(articles.userId, userId))).limit(1);
  return result[0];
}

export async function saveArticle(
  userId: number,
  data: {
    title: string;
    topic?: string;
    sourceUrl?: string;
    coverImageUrl?: string;
    content: string;
    summary?: string;
  }
): Promise<Article> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(articles).values({ userId, ...data });
  const created = await db.select().from(articles)
    .where(eq(articles.id, (result as any).insertId)).limit(1);
  return created[0];
}

export async function updateArticle(
  id: number,
  userId: number,
  data: Partial<{
    title: string;
    content: string;
    coverImageUrl: string;
    status: "draft" | "published" | "archived";
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(articles).set(data).where(
    and(eq(articles.id, id), eq(articles.userId, userId))
  );
}

export async function deleteArticle(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(articles).where(and(eq(articles.id, id), eq(articles.userId, userId)));
}

export async function getArticleCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(articles).where(eq(articles.userId, userId));
  return result.length;
}

export async function getCarousels(userId: number): Promise<Carousel[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureCarouselTable();
  const result = await db.select().from(carousels)
    .where(eq(carousels.userId, userId))
    .orderBy(desc(carousels.createdAt));
  return result.map((row) => hydrateCarousel(row as Omit<Carousel, "slides"> & { slides: unknown }));
}

export async function saveCarousel(
  userId: number,
  data: {
    topic: string;
    style: string;
    hook: string;
    caption: string;
    finalCta: string;
    coverImageUrl?: string;
    slides: CarouselSlideData[];
  }
): Promise<Carousel> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureCarouselTable();
  const [result] = await db.insert(carousels).values({
    userId,
    ...data,
    slides: JSON.stringify(data.slides),
  });
  const created = await db.select().from(carousels)
    .where(eq(carousels.id, (result as any).insertId)).limit(1);
  return hydrateCarousel(created[0] as Omit<Carousel, "slides"> & { slides: unknown });
}

export async function deleteCarousel(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await ensureCarouselTable();
  await db.delete(carousels).where(and(eq(carousels.id, id), eq(carousels.userId, userId)));
}

export async function updateCarouselSlides(
  id: number,
  userId: number,
  slides: CarouselSlideData[]
): Promise<Carousel | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await ensureCarouselTable();
  await db.update(carousels).set({
    slides: JSON.stringify(slides),
    updatedAt: new Date(),
  }).where(and(eq(carousels.id, id), eq(carousels.userId, userId)));

  const updated = await db.select().from(carousels)
    .where(and(eq(carousels.id, id), eq(carousels.userId, userId))).limit(1);

  if (!updated[0]) return undefined;
  return hydrateCarousel(updated[0] as Omit<Carousel, "slides"> & { slides: unknown });
}

export async function getCarouselCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  await ensureCarouselTable();
  const result = await db.select().from(carousels).where(eq(carousels.userId, userId));
  return result.length;
}

// ─── Social Posts ─────────────────────────────────────────────────────────────

export async function getSocialPosts(
  userId: number,
  channel?: "instagram" | "linkedin" | "newsletter"
): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = channel
    ? and(eq(socialPosts.userId, userId), eq(socialPosts.channel, channel))
    : eq(socialPosts.userId, userId);
  return db.select().from(socialPosts)
    .where(conditions)
    .orderBy(desc(socialPosts.createdAt));
}

export async function saveSocialPost(
  userId: number,
  data: {
    channel: "instagram" | "linkedin" | "newsletter";
    title?: string;
    content: string;
    imageUrl?: string;
    scheduledAt?: Date;
  }
): Promise<SocialPost> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const status = data.scheduledAt ? "scheduled" : "draft";
  const [result] = await db.insert(socialPosts).values({ userId, ...data, status });
  const created = await db.select().from(socialPosts)
    .where(eq(socialPosts.id, (result as any).insertId)).limit(1);
  return created[0];
}

export async function updateSocialPost(
  id: number,
  userId: number,
  data: Partial<{
    content: string;
    title: string;
    status: "draft" | "scheduled" | "published" | "failed";
    scheduledAt: Date | null;
    publishedAt: Date | null;
    webhookResponse: string;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(socialPosts).set(data).where(
    and(eq(socialPosts.id, id), eq(socialPosts.userId, userId))
  );
}

export async function deleteSocialPost(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.userId, userId)));
}

export async function getPostCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(socialPosts).where(eq(socialPosts.userId, userId));
  return result.length;
}
