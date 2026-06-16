import { eq, desc, asc, and, lte, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { ResultSetHeader } from "mysql2";

function insertId(result: unknown): number {
  return (result as ResultSetHeader).insertId;
}
import {
  InsertUser,
  users,
  chatConversations,
  chatMessages,
  generatedImages,
  articles,
  carousels,
  carouselTemplates,
  avatarVideos,
  socialPosts,
  instagramConnections,
  canvaConnections,
  featureFlags,
  type ChatConversation,
  type ChatMessage,
  type GeneratedImage,
  type Article,
  type Carousel,
  type CarouselSlideData,
  type CarouselTemplate,
  type AvatarVideo,
  type SocialPost,
  type InstagramConnection,
  type InsertInstagramConnection,
  type CanvaConnection,
  type InsertCanvaConnection,
  type FeatureFlag,
  brandKits,
  type BrandKit,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _carouselTableReady: Promise<void> | null = null;
let _carouselTemplateTableReady: Promise<void> | null = null;
let _avatarVideoTableReady: Promise<void> | null = null;
let _socialPostsMetadataReady: Promise<void> | null = null;
let _featureFlagsTableReady: Promise<void> | null = null;
let _canvaConnectionsTableReady: Promise<void> | null = null;

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
        profileId: typeof item.profileId === "string" ? item.profileId : undefined,
        slideType: (item.slideType === "hook" || item.slideType === "development" || item.slideType === "cta") ? item.slideType : undefined,
        shortText: typeof item.shortText === "string" ? item.shortText : undefined,
        imagePrompt: typeof item.imagePrompt === "string" ? item.imagePrompt : undefined,
        backgroundPrompt: typeof item.backgroundPrompt === "string" ? item.backgroundPrompt : undefined,
        visualDirection: typeof item.visualDirection === "string" ? item.visualDirection : undefined,
        layoutNotes: typeof item.layoutNotes === "string" ? item.layoutNotes : undefined,
        highlightWords: Array.isArray(item.highlightWords) ? (item.highlightWords as string[]).filter((w) => typeof w === "string") : undefined,
        wordStyles: Array.isArray(item.wordStyles)
          ? (item.wordStyles as unknown[]).filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null).map((w) => ({
              word: typeof w.word === "string" ? w.word : "",
              color: typeof w.color === "string" ? w.color : undefined,
              bold: typeof w.bold === "boolean" ? w.bold : undefined,
              italic: typeof w.italic === "boolean" ? w.italic : undefined,
            })).filter((w) => w.word)
          : undefined,
        titleColor: typeof item.titleColor === "string" ? item.titleColor : undefined,
        bodyColor: typeof item.bodyColor === "string" ? item.bodyColor : undefined,
        designTemplateName:
          typeof item.designTemplateName === "string" ? item.designTemplateName : undefined,
        designTemplateUrl:
          typeof item.designTemplateUrl === "string" ? item.designTemplateUrl : undefined,
        designStyleBrief:
          typeof item.designStyleBrief === "string" ? item.designStyleBrief : undefined,
        templateSvgUrl:
          typeof item.templateSvgUrl === "string" ? item.templateSvgUrl : undefined,
        renderedImageUrl:
          typeof item.renderedImageUrl === "string" ? item.renderedImageUrl : undefined,
        fontFamily:
          typeof item.fontFamily === "string" ? item.fontFamily : undefined,
        accentColor:
          typeof item.accentColor === "string" ? item.accentColor : undefined,
        backgroundColor:
          typeof item.backgroundColor === "string" ? item.backgroundColor : undefined,
        editorSettings:
          typeof item.editorSettings === "object" && item.editorSettings !== null
            ? (() => {
                const editorSettings = item.editorSettings as Record<string, unknown>;
                return {
                  titleOffsetX:
                    typeof editorSettings.titleOffsetX === "number"
                      ? editorSettings.titleOffsetX
                      : undefined,
                  titleOffsetY:
                    typeof editorSettings.titleOffsetY === "number"
                      ? editorSettings.titleOffsetY
                      : undefined,
                  titleScale:
                    typeof editorSettings.titleScale === "number"
                      ? editorSettings.titleScale
                      : undefined,
                  bodyOffsetX:
                    typeof editorSettings.bodyOffsetX === "number"
                      ? editorSettings.bodyOffsetX
                      : undefined,
                  bodyOffsetY:
                    typeof editorSettings.bodyOffsetY === "number"
                      ? editorSettings.bodyOffsetY
                      : undefined,
                  bodyScale:
                    typeof editorSettings.bodyScale === "number"
                      ? editorSettings.bodyScale
                      : undefined,
                  imageOffsetX:
                    typeof editorSettings.imageOffsetX === "number"
                      ? editorSettings.imageOffsetX
                      : undefined,
                  imageOffsetY:
                    typeof editorSettings.imageOffsetY === "number"
                      ? editorSettings.imageOffsetY
                      : undefined,
                  imageScale:
                    typeof editorSettings.imageScale === "number"
                      ? editorSettings.imageScale
                      : undefined,
                  imageRotation:
                    typeof editorSettings.imageRotation === "number"
                      ? editorSettings.imageRotation
                      : undefined,
                  imageBrightness:
                    typeof editorSettings.imageBrightness === "number"
                      ? editorSettings.imageBrightness
                      : undefined,
                  imageContrast:
                    typeof editorSettings.imageContrast === "number"
                      ? editorSettings.imageContrast
                      : undefined,
                  imageSaturate:
                    typeof editorSettings.imageSaturate === "number"
                      ? editorSettings.imageSaturate
                      : undefined,
                  titleColor:
                    typeof editorSettings.titleColor === "string"
                      ? editorSettings.titleColor
                      : undefined,
                  bodyColor:
                    typeof editorSettings.bodyColor === "string"
                      ? editorSettings.bodyColor
                      : undefined,
                };
              })()
            : undefined,
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

function hydrateCarousel(row: Omit<Carousel, "slides"> & { slides: unknown; designSettings?: unknown }): Carousel {
  const hydrated: Carousel = {
    ...row,
    slides: parseCarouselSlides(row.slides),
  };
  if (row.designSettings && typeof row.designSettings === "string") {
    try { (hydrated as Record<string, unknown>).designSettings = JSON.parse(row.designSettings); } catch { /* ignore */ }
  }
  return hydrated;
}

function isMysqlDuplicateColumnError(error: unknown): boolean {
  const inspected = new Set<unknown>();
  const parts: string[] = [];

  const collect = (value: unknown, depth = 0) => {
    if (!value || depth > 4 || inspected.has(value)) return;
    inspected.add(value);

    if (typeof value === "string") {
      parts.push(value);
      return;
    }

    if (typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    for (const key of ["code", "errno", "sqlState", "sqlMessage", "message"]) {
      const field = record[key];
      if (field !== undefined) parts.push(String(field));
    }

    collect(record.cause, depth + 1);
  };

  collect(error);

  return /ER_DUP_FIELDNAME|Duplicate column|1060|42S21/i.test(parts.join(" "));
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
          designSettings text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      // Add column to pre-existing tables that don't have it yet
      try {
        await db.execute(sql`ALTER TABLE carousels ADD COLUMN designSettings text`);
      } catch (e) {
        if (!isMysqlDuplicateColumnError(e)) throw e;
      }
    })().catch((error) => {
      _carouselTableReady = null;
      throw error;
    });
  }

  await _carouselTableReady;
}

async function ensureCarouselTemplateTable() {
  const db = await getDb();
  if (!db) return;

  if (!_carouselTemplateTableReady) {
    _carouselTemplateTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS carousel_templates (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          name varchar(255) NOT NULL,
          imageUrl text NOT NULL,
          styleBrief text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    })().catch((error) => {
      _carouselTemplateTableReady = null;
      throw error;
    });
  }

  await _carouselTemplateTableReady;
}

async function ensureAvatarVideoTable() {
  const db = await getDb();
  if (!db) return;

  if (!_avatarVideoTableReady) {
    _avatarVideoTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS avatar_videos (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          provider varchar(32) NOT NULL DEFAULT 'd-id',
          title varchar(512) NOT NULL,
          topic text,
          script text NOT NULL,
          sourceImageUrl text NOT NULL,
          videoUrl text,
          voiceProvider varchar(64),
          voiceId varchar(128),
          providerJobId varchar(255),
          status enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
          errorMessage text,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    })().catch((error) => {
      _avatarVideoTableReady = null;
      throw error;
    });
  }

  await _avatarVideoTableReady;
}

// ─── Approval columns migration ──────────────────────────────────────────────
let _approvalColumnsReady: Promise<void> | null = null;

async function ensureApprovalColumns() {
  const db = await getDb();
  if (!db) return;

  if (!_approvalColumnsReady) {
    _approvalColumnsReady = (async () => {
      // 1. Add approvalToken column if missing
      const [cols] = (await db.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'social_posts'
          AND column_name IN ('approvalToken', 'approvalExpiresAt')
      `)) as unknown as [Array<{ column_name: string }>, unknown];

      const existing = new Set((cols as Array<{ column_name: string }>).map((r) => r.column_name));

      if (!existing.has("approvalToken")) {
        try {
          await db.execute(sql`ALTER TABLE social_posts ADD COLUMN approvalToken varchar(64)`);
        } catch (e) {
          if (!isMysqlDuplicateColumnError(e)) throw e;
        }
      }
      if (!existing.has("approvalExpiresAt")) {
        try {
          await db.execute(sql`ALTER TABLE social_posts ADD COLUMN approvalExpiresAt timestamp NULL`);
        } catch (e) {
          if (!isMysqlDuplicateColumnError(e)) throw e;
        }
      }

      // 2. Extend the status enum to include pending_approval and rejected
      const [enumRows] = (await db.execute(sql`
        SELECT COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'social_posts'
          AND COLUMN_NAME = 'status'
      `)) as unknown as [Array<{ COLUMN_TYPE: string }>, unknown];

      const colType = (enumRows as Array<{ COLUMN_TYPE: string }>)[0]?.COLUMN_TYPE ?? "";
      if (!colType.includes("pending_approval")) {
        await db.execute(sql`
          ALTER TABLE social_posts
          MODIFY COLUMN status enum('draft','pending_approval','scheduled','published','failed','rejected')
          NOT NULL DEFAULT 'draft'
        `);
      }
    })().catch((e) => {
      _approvalColumnsReady = null;
      throw e;
    });
  }
  await _approvalColumnsReady;
}

async function ensureSocialPostsMetadataColumn() {
  const db = await getDb();
  if (!db) return;

  if (!_socialPostsMetadataReady) {
    _socialPostsMetadataReady = (async () => {
      const [columnRows] = (await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'social_posts'
          AND column_name IN ('metadata', 'errorMessage')
      `)) as unknown as [Array<{ column_name: string }>, unknown];

      const existing = new Set((columnRows as Array<{ column_name: string }>).map((r) => r.column_name));

      if (!existing.has("metadata")) {
        try {
          await db.execute(sql`ALTER TABLE social_posts ADD COLUMN metadata text`);
        } catch (error) {
          if (!isMysqlDuplicateColumnError(error)) throw error;
        }
      }

      if (!existing.has("errorMessage")) {
        try {
          await db.execute(sql`ALTER TABLE social_posts ADD COLUMN errorMessage text`);
        } catch (error) {
          if (!isMysqlDuplicateColumnError(error)) throw error;
        }
      }
    })().catch((error) => {
      _socialPostsMetadataReady = null;
      throw error;
    });
  }

  await _socialPostsMetadataReady;
}

// ─── Users — runtime column migration ────────────────────────────────────────

let _userExtraColumnsReady: Promise<void> | null = null;

async function ensureUserExtraColumns() {
  const db = await getDb();
  if (!db) return;

  if (!_userExtraColumnsReady) {
    _userExtraColumnsReady = (async () => {
      const [cols] = (await db.execute(sql`
        SELECT column_name, column_type FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND column_name IN ('isActive', 'plan')
      `)) as unknown as [Array<{ column_name: string; column_type: string }>, unknown];

      const existing = new Map(
        (cols as Array<{ column_name: string; column_type: string }>).map((r) => [r.column_name, r.column_type])
      );

      if (!existing.has("isActive")) {
        try {
          await db.execute(sql`ALTER TABLE users ADD COLUMN isActive tinyint(1) NOT NULL DEFAULT 1`);
        } catch (e) { if (!isMysqlDuplicateColumnError(e)) throw e; }
      }

      if (!existing.has("plan")) {
        try {
          await db.execute(sql`ALTER TABLE users ADD COLUMN plan enum('free','pro','agency') NOT NULL DEFAULT 'free'`);
        } catch (e) { if (!isMysqlDuplicateColumnError(e)) throw e; }
      }
    })().catch((e) => { _userExtraColumnsReady = null; throw e; });
  }
  await _userExtraColumnsReady;
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
  await ensureUserExtraColumns();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByOpenIdWithActiveCheck(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  await ensureUserExtraColumns();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  const user = result[0];
  if (!user) return undefined;
  // isActive defaults to true for rows that pre-date the column
  const isActive = (user as unknown as { isActive?: number | boolean }).isActive;
  if (isActive === 0 || isActive === false) return null; // null = found but inactive
  return user;
}

export async function setUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function setUserPlan(id: number, plan: "free" | "pro" | "agency") {
  const db = await getDb();
  if (!db) return;
  await ensureUserExtraColumns();
  await db.execute(sql`UPDATE users SET plan = ${plan} WHERE id = ${id}`);
}

export async function setUserActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  await ensureUserExtraColumns();
  await db.execute(sql`UPDATE users SET isActive = ${isActive ? 1 : 0} WHERE id = ${id}`);
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  await ensureUserExtraColumns();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  return rows.map((u) => ({
    ...u,
    plan: ((u as unknown as { plan?: string }).plan ?? "free") as "free" | "pro" | "agency",
    isActive: ((u as unknown as { isActive?: number | boolean }).isActive ?? 1) !== 0,
  }));
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
    .where(eq(chatConversations.id, insertId(result))).limit(1);
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
    .where(eq(chatMessages.id, insertId(result))).limit(1);
  return created[0];
}

export async function getChatCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(chatConversations).where(eq(chatConversations.userId, userId));
  return row?.count ?? 0;
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
    .where(eq(generatedImages.id, insertId(result))).limit(1);
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
  const [row] = await db.select({ count: count() }).from(generatedImages).where(eq(generatedImages.userId, userId));
  return row?.count ?? 0;
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
    .where(eq(articles.id, insertId(result))).limit(1);
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
  const [row] = await db.select({ count: count() }).from(articles).where(eq(articles.userId, userId));
  return row?.count ?? 0;
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
    .where(eq(carousels.id, insertId(result))).limit(1);
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

export async function updateCarouselContent(
  id: number,
  userId: number,
  data: {
    hook: string;
    caption: string;
    finalCta: string;
    slides: CarouselSlideData[];
    designSettings?: Record<string, unknown>;
  }
): Promise<Carousel | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await ensureCarouselTable();
  await db.update(carousels).set({
    hook: data.hook,
    caption: data.caption,
    finalCta: data.finalCta,
    slides: JSON.stringify(data.slides),
    designSettings: data.designSettings ? JSON.stringify(data.designSettings) : null,
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
  const [row] = await db.select({ count: count() }).from(carousels).where(eq(carousels.userId, userId));
  return row?.count ?? 0;
}

// ─── Social Posts ─────────────────────────────────────────────────────────────

export async function getCarouselTemplates(userId: number): Promise<CarouselTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureCarouselTemplateTable();
  return db
    .select()
    .from(carouselTemplates)
    .where(eq(carouselTemplates.userId, userId))
    .orderBy(desc(carouselTemplates.createdAt));
}

export async function getCarouselTemplate(
  id: number,
  userId: number
): Promise<CarouselTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await ensureCarouselTemplateTable();
  const result = await db
    .select()
    .from(carouselTemplates)
    .where(and(eq(carouselTemplates.id, id), eq(carouselTemplates.userId, userId)))
    .limit(1);
  return result[0];
}

export async function saveCarouselTemplate(
  userId: number,
  data: {
    name: string;
    imageUrl: string;
    styleBrief?: string;
  }
): Promise<CarouselTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureCarouselTemplateTable();
  const [result] = await db.insert(carouselTemplates).values({
    userId,
    name: data.name,
    imageUrl: data.imageUrl,
    styleBrief: data.styleBrief ?? null,
  });
  const created = await db
    .select()
    .from(carouselTemplates)
    .where(eq(carouselTemplates.id, insertId(result)))
    .limit(1);
  return created[0];
}

export async function deleteCarouselTemplate(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await ensureCarouselTemplateTable();
  await db
    .delete(carouselTemplates)
    .where(and(eq(carouselTemplates.id, id), eq(carouselTemplates.userId, userId)));
}

export async function getAvatarVideos(userId: number): Promise<AvatarVideo[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureAvatarVideoTable();
  return db.select().from(avatarVideos)
    .where(eq(avatarVideos.userId, userId))
    .orderBy(desc(avatarVideos.createdAt));
}

export async function saveAvatarVideo(
  userId: number,
  data: {
    provider?: string;
    title: string;
    topic?: string;
    script: string;
    sourceImageUrl: string;
    videoUrl?: string;
    voiceProvider?: string;
    voiceId?: string;
    providerJobId?: string;
    status?: "processing" | "completed" | "failed";
    errorMessage?: string;
  }
): Promise<AvatarVideo> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureAvatarVideoTable();
  const [result] = await db.insert(avatarVideos).values({
    userId,
    provider: data.provider ?? "d-id",
    title: data.title,
    topic: data.topic,
    script: data.script,
    sourceImageUrl: data.sourceImageUrl,
    videoUrl: data.videoUrl,
    voiceProvider: data.voiceProvider,
    voiceId: data.voiceId,
    providerJobId: data.providerJobId,
    status: data.status ?? "processing",
    errorMessage: data.errorMessage,
  });
  const created = await db.select().from(avatarVideos)
    .where(eq(avatarVideos.id, insertId(result))).limit(1);
  return created[0];
}

export async function updateAvatarVideo(
  id: number,
  userId: number,
  data: Partial<{
    title: string;
    topic: string | null;
    script: string;
    sourceImageUrl: string;
    videoUrl: string | null;
    voiceProvider: string | null;
    voiceId: string | null;
    providerJobId: string | null;
    status: "processing" | "completed" | "failed";
    errorMessage: string | null;
  }>
): Promise<AvatarVideo | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await ensureAvatarVideoTable();
  await db.update(avatarVideos).set({
    ...data,
    updatedAt: new Date(),
  }).where(and(eq(avatarVideos.id, id), eq(avatarVideos.userId, userId)));

  const updated = await db.select().from(avatarVideos)
    .where(and(eq(avatarVideos.id, id), eq(avatarVideos.userId, userId))).limit(1);

  return updated[0];
}

export async function deleteAvatarVideo(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await ensureAvatarVideoTable();
  await db.delete(avatarVideos).where(and(eq(avatarVideos.id, id), eq(avatarVideos.userId, userId)));
}

export async function getAvatarVideoCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  await ensureAvatarVideoTable();
  const [row] = await db.select({ count: count() }).from(avatarVideos).where(eq(avatarVideos.userId, userId));
  return row?.count ?? 0;
}

export async function getSocialPosts(
  userId: number,
  channel?: "instagram" | "linkedin" | "newsletter"
): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureSocialPostsMetadataColumn();
  const conditions = channel
    ? and(eq(socialPosts.userId, userId), eq(socialPosts.channel, channel))
    : eq(socialPosts.userId, userId);
  return db.select().from(socialPosts)
    .where(conditions)
    .orderBy(desc(socialPosts.createdAt));
}

export async function getDueScheduledInstagramPosts(
  now = new Date(),
  limit = 20
): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureSocialPostsMetadataColumn();
  return db.select().from(socialPosts)
    .where(
      and(
        eq(socialPosts.channel, "instagram"),
        eq(socialPosts.status, "scheduled"),
        lte(socialPosts.scheduledAt, now)
      )
    )
    .orderBy(asc(socialPosts.scheduledAt))
    .limit(limit);
}

export async function saveSocialPost(
  userId: number,
  data: {
    channel: "instagram" | "linkedin" | "newsletter";
    title?: string;
    content: string;
    imageUrl?: string;
    metadata?: string;
    scheduledAt?: Date;
  }
): Promise<SocialPost> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureSocialPostsMetadataColumn();
  const status = data.scheduledAt ? "scheduled" : "draft";
  const [result] = await db.insert(socialPosts).values({ userId, ...data, status });
  const created = await db.select().from(socialPosts)
    .where(eq(socialPosts.id, insertId(result))).limit(1);
  return created[0];
}

export async function updateSocialPost(
  id: number,
  userId: number,
  data: Partial<{
    content: string;
    title: string;
    status: "draft" | "scheduled" | "published" | "failed";
    imageUrl: string | null;
    metadata: string | null;
    scheduledAt: Date | null;
    publishedAt: Date | null;
    errorMessage: string | null;
  }>
) {
  const db = await getDb();
  if (!db) return;
  await ensureSocialPostsMetadataColumn();
  await db.update(socialPosts).set(data).where(
    and(eq(socialPosts.id, id), eq(socialPosts.userId, userId))
  );
}

export async function deleteSocialPost(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.userId, userId)));
}

export async function setSocialPostPendingApproval(
  id: number,
  userId: number,
  token: string,
  expiresAt: Date
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureApprovalColumns();
  await db.execute(sql`
    UPDATE social_posts
    SET status = 'pending_approval', approvalToken = ${token}, approvalExpiresAt = ${expiresAt}
    WHERE id = ${id} AND userId = ${userId}
  `);
}

export async function getSocialPostByApprovalToken(
  token: string
): Promise<SocialPost | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureApprovalColumns();
  const rows = await db.execute(sql`
    SELECT * FROM social_posts WHERE approvalToken = ${token} LIMIT 1
  `) as unknown as [Array<Record<string, unknown>>, unknown];
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return row as unknown as SocialPost;
}

export async function resolveApprovalToken(
  token: string,
  action: "approve" | "reject"
): Promise<{ ok: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "Banco de dados indisponível" };
  await ensureApprovalColumns();

  const post = await getSocialPostByApprovalToken(token);
  if (!post) return { ok: false, reason: "Token inválido ou expirado" };
  if (post.status !== "pending_approval") {
    return { ok: false, reason: `Este post já foi ${post.status === "published" ? "publicado" : post.status}` };
  }

  const expires = (post as unknown as Record<string, unknown>).approvalExpiresAt as Date | null;
  if (expires && new Date() > new Date(expires)) {
    return { ok: false, reason: "Link de aprovação expirado" };
  }

  const newStatus = action === "approve" ? "scheduled" : "rejected";
  await db.execute(sql`
    UPDATE social_posts
    SET status = ${newStatus}, approvalToken = NULL, approvalExpiresAt = NULL
    WHERE id = ${post.id}
  `);
  return { ok: true };
}

export async function getPostCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ count: count() }).from(socialPosts).where(eq(socialPosts.userId, userId));
  return row?.count ?? 0;
}

// ─── Instagram Connections ────────────────────────────────────────────────────
let _igConnectionsReady: Promise<void> | null = null;

async function ensureInstagramConnectionsColumns(): Promise<void> {
  if (!_igConnectionsReady) {
    _igConnectionsReady = (async () => {
      const db = await getDb();
      if (!db) return;
      const [cols] = await db.execute(sql`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'instagram_connections'
      `);
      const existing = new Set((cols as unknown as Array<{ COLUMN_NAME: string }>).map(c => c.COLUMN_NAME));
      if (!existing.has("tokenSource")) {
        await db.execute(sql`
          ALTER TABLE \`instagram_connections\`
          ADD COLUMN \`tokenSource\` varchar(16) DEFAULT 'facebook'
        `);
        console.log("[DB] Added tokenSource column to instagram_connections");
      }
    })();
  }
  return _igConnectionsReady;
}

export async function getInstagramConnection(userId: number): Promise<InstagramConnection | null> {
  await ensureInstagramConnectionsColumns();
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(instagramConnections).where(eq(instagramConnections.userId, userId));
  return row ?? null;
}

export async function upsertInstagramConnection(data: InsertInstagramConnection): Promise<void> {
  await ensureInstagramConnectionsColumns();
  const db = await getDb();
  if (!db) return;
  const existing = await getInstagramConnection(data.userId);
  if (existing) {
    await db.update(instagramConnections)
      .set({
        instagramAccountId: data.instagramAccountId,
        facebookPageId: data.facebookPageId ?? null,
        username: data.username,
        name: data.name,
        profilePictureUrl: data.profilePictureUrl,
        accessToken: data.accessToken,
        tokenExpiresAt: data.tokenExpiresAt,
        tokenSource: data.tokenSource ?? "facebook",
      })
      .where(eq(instagramConnections.userId, data.userId));
  } else {
    await db.insert(instagramConnections).values({
      ...data,
      tokenSource: data.tokenSource ?? "facebook",
    });
  }
}

export async function deleteInstagramConnection(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(instagramConnections).where(eq(instagramConnections.userId, userId));
}

// ─── Canva Connections ────────────────────────────────────────────────────────

async function ensureCanvaConnectionsTable(): Promise<void> {
  if (!_canvaConnectionsTableReady) {
    _canvaConnectionsTableReady = (async () => {
      const db = await getDb();
      if (!db) return;
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`canva_connections\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`userId\` int NOT NULL,
          \`canvaUserId\` varchar(128) NOT NULL,
          \`displayName\` varchar(255),
          \`email\` varchar(320),
          \`profilePictureUrl\` text,
          \`accessToken\` text NOT NULL,
          \`refreshToken\` text,
          \`tokenExpiresAt\` timestamp NULL,
          \`connectedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`canva_connections_pk\` PRIMARY KEY (\`id\`),
          CONSTRAINT \`canva_connections_userId_unique\` UNIQUE (\`userId\`)
        )
      `);
    })();
  }
  return _canvaConnectionsTableReady;
}

export async function getCanvaConnection(userId: number): Promise<CanvaConnection | null> {
  try {
    await ensureCanvaConnectionsTable();
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(canvaConnections).where(eq(canvaConnections.userId, userId));
    return row ?? null;
  } catch {
    return null;
  }
}

export async function upsertCanvaConnection(data: InsertCanvaConnection): Promise<void> {
  await ensureCanvaConnectionsTable();
  const db = await getDb();
  if (!db) return;
  const existing = await getCanvaConnection(data.userId);
  if (existing) {
    await db.update(canvaConnections)
      .set({
        canvaUserId: data.canvaUserId,
        displayName: data.displayName,
        email: data.email,
        profilePictureUrl: data.profilePictureUrl,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      })
      .where(eq(canvaConnections.userId, data.userId));
  } else {
    await db.insert(canvaConnections).values(data);
  }
}

export async function deleteCanvaConnection(userId: number): Promise<void> {
  try {
    await ensureCanvaConnectionsTable();
    const db = await getDb();
    if (!db) return;
    await db.delete(canvaConnections).where(eq(canvaConnections.userId, userId));
  } catch {
    // table may not exist yet
  }
}

// ─── Feature Flags ────────────────────────────────────────────────────────────
async function ensureFeatureFlagsTable(): Promise<void> {
  if (!_featureFlagsTableReady) {
    _featureFlagsTableReady = (async () => {
      const db = await getDb();
      if (!db) return;
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`feature_flags\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`key\` varchar(128) NOT NULL,
          \`label\` varchar(255) NOT NULL,
          \`description\` text,
          \`enabled\` boolean NOT NULL DEFAULT false,
          \`createdAt\` timestamp NOT NULL DEFAULT (now()),
          \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`feature_flags_id\` PRIMARY KEY(\`id\`),
          CONSTRAINT \`feature_flags_key_unique\` UNIQUE(\`key\`)
        )
      `);
    })();
  }
  return _featureFlagsTableReady;
}

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureFeatureFlagsTable();
  return db.select().from(featureFlags).orderBy(asc(featureFlags.createdAt));
}

export async function getFeatureFlagByKey(key: string): Promise<FeatureFlag | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureFeatureFlagsTable();
  const [row] = await db.select().from(featureFlags).where(eq(featureFlags.key, key));
  return row ?? null;
}

export async function upsertFeatureFlag(
  key: string,
  label: string,
  description: string | undefined,
  enabled: boolean,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureFeatureFlagsTable();
  const existing = await getFeatureFlagByKey(key);
  if (existing) {
    await db.update(featureFlags)
      .set({ label, description: description ?? null, enabled })
      .where(eq(featureFlags.key, key));
  } else {
    await db.insert(featureFlags).values({ key, label, description: description ?? null, enabled });
  }
}

export async function toggleFeatureFlag(key: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureFeatureFlagsTable();
  await db.update(featureFlags).set({ enabled }).where(eq(featureFlags.key, key));
}

export async function deleteFeatureFlag(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureFeatureFlagsTable();
  await db.delete(featureFlags).where(eq(featureFlags.key, key));
}

// ─── Brand Kits ───────────────────────────────────────────────────────────────

async function ensureBrandKitTable(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  // If the table exists with the OLD schema (has a 'name' column), drop and recreate.
  const [oldCols] = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'brand_kits'
      AND column_name  = 'name'
  `) as unknown as [Array<{ cnt: number }>, unknown];
  if (Number((oldCols as Array<{ cnt: number }>)[0]?.cnt) > 0) {
    await db.execute(sql`DROP TABLE brand_kits`);
  }
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS brand_kits (
      id              int NOT NULL AUTO_INCREMENT PRIMARY KEY,
      userId          int NOT NULL UNIQUE,
      companyName     varchar(255),
      tagline         varchar(512),
      logoUrl         text,
      industry        varchar(128),
      targetAudience  text,
      brandValues     text,
      toneOfVoice     varchar(64)  DEFAULT 'professional',
      primaryColor    varchar(7)   DEFAULT '#6366f1',
      secondaryColor  varchar(7)   DEFAULT '#8b5cf6',
      accentColor     varchar(7)   DEFAULT '#06b6d4',
      instagramHandle varchar(128),
      linkedinUrl     varchar(255),
      createdAt       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt       timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function getBrandKit(userId: number): Promise<BrandKit | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    await ensureBrandKitTable(db);
    const [rows] = await db.execute(
      sql`SELECT * FROM brand_kits WHERE userId = ${userId} LIMIT 1`
    ) as unknown as [Array<Record<string, unknown>>, unknown];
    const row = (rows as Array<Record<string, unknown>>)[0];
    return row ? (row as unknown as BrandKit) : null;
  } catch (e) {
    console.error("[BrandKit] getBrandKit error:", e);
    return null;
  }
}

export type BrandKitData = Omit<BrandKit, "id" | "userId" | "createdAt" | "updatedAt">;

export async function saveBrandKit(userId: number, data: Partial<BrandKitData>): Promise<BrandKit> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureBrandKitTable(db);

  // Coerce empty strings to null so MySQL doesn't reject them
  const n = (v: string | null | undefined) => (v === "" || v == null ? null : v);

  const cn  = n(data.companyName);
  const tl  = n(data.tagline);
  const lo  = n(data.logoUrl);
  const ind = n(data.industry);
  const ta  = n(data.targetAudience);
  const bv  = n(data.brandValues);
  const tv  = n(data.toneOfVoice) ?? "professional";
  const pc  = n(data.primaryColor)   ?? "#6366f1";
  const sc  = n(data.secondaryColor) ?? "#8b5cf6";
  const ac  = n(data.accentColor)    ?? "#06b6d4";
  const ig  = n(data.instagramHandle);
  const li  = n(data.linkedinUrl);

  // Use INSERT IGNORE to create the row if it doesn't exist, then always UPDATE.
  // Avoids VALUES() reference which causes issues with MySQL2 + Drizzle.
  await db.execute(sql`INSERT IGNORE INTO brand_kits (userId) VALUES (${userId})`);
  await db.execute(sql`
    UPDATE brand_kits SET
      companyName     = ${cn},
      tagline         = ${tl},
      logoUrl         = ${lo},
      industry        = ${ind},
      targetAudience  = ${ta},
      brandValues     = ${bv},
      toneOfVoice     = ${tv},
      primaryColor    = ${pc},
      secondaryColor  = ${sc},
      accentColor     = ${ac},
      instagramHandle = ${ig},
      linkedinUrl     = ${li}
    WHERE userId = ${userId}
  `);

  const result = await getBrandKit(userId);
  if (!result) throw new Error("Failed to save brand kit");
  return result;
}

// ─── WhatsApp Digest ───────────────────────────────────────────────────────────

let _digestTablesReady: Promise<void> | null = null;

async function ensureDigestTables(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  if (!_digestTablesReady) {
    _digestTablesReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`user_digest_settings\` (
          \`id\`                INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\`           INT NOT NULL UNIQUE,
          \`whatsapp_number\`   VARCHAR(20) NOT NULL,
          \`digest_hour\`       TINYINT NOT NULL DEFAULT 6,
          \`digest_minute\`     TINYINT NOT NULL DEFAULT 50,
          \`enabled\`           TINYINT(1) NOT NULL DEFAULT 1,
          \`last_sent_date\`    VARCHAR(12),
          \`template_name\`     VARCHAR(100) NOT NULL DEFAULT 'envio_de_noticias_diario',
          \`template_language\` VARCHAR(20)  NOT NULL DEFAULT 'pt_BR',
          \`created_at\`        DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      // Add new columns if table was created before they existed (catch 1060 = duplicate column)
      await db.execute(sql`ALTER TABLE \`user_digest_settings\` ADD COLUMN \`template_name\` VARCHAR(100) NOT NULL DEFAULT 'envio_de_noticias_diario'`).catch(() => {});
      await db.execute(sql`ALTER TABLE \`user_digest_settings\` ADD COLUMN \`template_language\` VARCHAR(20) NOT NULL DEFAULT 'pt_BR'`).catch(() => {});
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`whatsapp_digest_sessions\` (
          \`id\`           INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\`      INT NOT NULL,
          \`phone_number\` VARCHAR(20) NOT NULL,
          \`news_items\`   TEXT NOT NULL,
          \`sent_at\`      DATETIME NOT NULL,
          \`expires_at\`   DATETIME NOT NULL,
          INDEX idx_phone_expires (\`phone_number\`, \`expires_at\`)
        )
      `);
    })();
  }
  return _digestTablesReady;
}

export type DigestSettings = {
  id: number;
  userId: number;
  whatsappNumber: string;
  digestHour: number;
  digestMinute: number;
  enabled: boolean;
  lastSentDate: string | null;
  templateName: string;
  templateLanguage: string;
};

export async function getUserDigestSettings(userId: number): Promise<DigestSettings | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureDigestTables(db);
  const rows = await db.execute(sql`SELECT * FROM user_digest_settings WHERE user_id = ${userId} LIMIT 1`);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    whatsappNumber: String(row.whatsapp_number),
    digestHour: Number(row.digest_hour),
    digestMinute: Number(row.digest_minute),
    enabled: Boolean(Number(row.enabled)),
    lastSentDate: row.last_sent_date ? String(row.last_sent_date) : null,
    templateName: row.template_name ? String(row.template_name) : "envio_de_noticias_diario",
    templateLanguage: row.template_language ? String(row.template_language) : "pt_BR",
  };
}

export async function upsertDigestSettings(
  userId: number,
  data: { whatsappNumber: string; digestHour: number; digestMinute: number; enabled: boolean; templateName?: string; templateLanguage?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureDigestTables(db);
  const tplName = data.templateName ?? "envio_de_noticias_diario";
  const tplLang = data.templateLanguage ?? "pt_BR";
  await db.execute(sql`
    INSERT INTO user_digest_settings (user_id, whatsapp_number, digest_hour, digest_minute, enabled, template_name, template_language)
    VALUES (${userId}, ${data.whatsappNumber}, ${data.digestHour}, ${data.digestMinute}, ${data.enabled ? 1 : 0}, ${tplName}, ${tplLang})
    ON DUPLICATE KEY UPDATE
      whatsapp_number   = VALUES(whatsapp_number),
      digest_hour       = VALUES(digest_hour),
      digest_minute     = VALUES(digest_minute),
      enabled           = VALUES(enabled),
      template_name     = VALUES(template_name),
      template_language = VALUES(template_language)
  `);
}

export async function resetDigestLastSent(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureDigestTables(db);
  await db.execute(sql`UPDATE user_digest_settings SET last_sent_date = NULL WHERE user_id = ${userId}`);
}

export async function markDigestLastSent(userId: number, dateStr: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureDigestTables(db);
  await db.execute(sql`UPDATE user_digest_settings SET last_sent_date = ${dateStr} WHERE user_id = ${userId}`);
}

export async function getAllEnabledDigestSettings(): Promise<DigestSettings[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureDigestTables(db);
  const rows = await db.execute(sql`SELECT * FROM user_digest_settings WHERE enabled = 1`);
  return (rows[0] as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    whatsappNumber: String(row.whatsapp_number),
    digestHour: Number(row.digest_hour),
    digestMinute: Number(row.digest_minute),
    enabled: Boolean(Number(row.enabled)),
    lastSentDate: row.last_sent_date ? String(row.last_sent_date) : null,
    templateName: row.template_name ? String(row.template_name) : "envio_de_noticias_diario",
    templateLanguage: row.template_language ? String(row.template_language) : "pt_BR",
  }));
}

export type DigestNewsItem = {
  title: string;
  url: string;
  source: string;
  excerpt: string | null;
  publishedAt: string | null;
};

export async function saveDigestSession(
  userId: number,
  phoneNumber: string,
  newsItems: DigestNewsItem[]
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureDigestTables(db);
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  await db.execute(sql`
    INSERT INTO whatsapp_digest_sessions (user_id, phone_number, news_items, sent_at, expires_at)
    VALUES (${userId}, ${phoneNumber}, ${JSON.stringify(newsItems)}, ${now}, ${expires})
  `);
}

export async function getActiveDigestSession(
  phoneNumber: string
): Promise<{ userId: number; newsItems: DigestNewsItem[] } | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureDigestTables(db);
  const rows = await db.execute(sql`
    SELECT user_id, news_items FROM whatsapp_digest_sessions
    WHERE phone_number = ${phoneNumber} AND expires_at > NOW()
    ORDER BY sent_at DESC LIMIT 1
  `);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  try {
    return {
      userId: Number(row.user_id),
      newsItems: JSON.parse(String(row.news_items)) as DigestNewsItem[],
    };
  } catch {
    return null;
  }
}
