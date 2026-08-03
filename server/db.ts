import { eq, desc, asc, and, lte, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { ResultSetHeader } from "mysql2";

function insertId(result: unknown): number {
  return (result as ResultSetHeader).insertId;
}
import {
  InsertUser,
  users,
  dailyUsage,
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
  linkedinConnections,
  featureFlags,
  postMetrics,
  templatePerformance,
  editorialPlanItems,
  instagramAccountInsightsDaily,
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
  type LinkedInConnection,
  type InsertLinkedInConnection,
  type FeatureFlag,
  type PostMetric,
  type TemplatePerformance,
  type EditorialPlanItem,
  type InsertEditorialPlanItem,
  type InstagramAccountInsightsDaily,
  type InstagramDemographicsBreakdown,
  brandKits,
  type BrandKit,
  type CommentAutomation,
  trendingTopics,
  userTopicAngles,
  type TrendingTopic,
  type UserTopicAngle,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _dailyUsageTableReady: Promise<void> | null = null;
let _carouselTableReady: Promise<void> | null = null;
let _carouselTemplateTableReady: Promise<void> | null = null;
let _avatarVideoTableReady: Promise<void> | null = null;
let _socialPostsMetadataReady: Promise<void> | null = null;
let _featureFlagsTableReady: Promise<void> | null = null;
let _canvaConnectionsTableReady: Promise<void> | null = null;
let _linkedinConnectionsTableReady: Promise<void> | null = null;
let _reelsScriptsTableReady: Promise<void> | null = null;
let _commentPollStateReady: Promise<void> | null = null;
let _commentAlertsReady: Promise<void> | null = null;
let _commentAutomationsTableReady: Promise<void> | null = null;
let _postMetricsTableReady: Promise<void> | null = null;
let _postMetricsVideoColumnsReady: Promise<void> | null = null;
let _igAccountInsightsTableReady: Promise<void> | null = null;
let _templatePerformanceTableReady: Promise<void> | null = null;
let _editorialPlanItemsTableReady: Promise<void> | null = null;

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
          sourceTopicAngleId int,
          hookType varchar(32),
          contentFormat varchar(32) DEFAULT 'carousel',
          templateId int,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      // Backfill columns for existing installs
      for (const stmt of [
        sql`ALTER TABLE carousels ADD COLUMN designSettings text`,
        sql`ALTER TABLE carousels ADD COLUMN sourceTopicAngleId int`,
        sql`ALTER TABLE carousels ADD COLUMN hookType varchar(32)`,
        sql`ALTER TABLE carousels ADD COLUMN contentFormat varchar(32) DEFAULT 'carousel'`,
        sql`ALTER TABLE carousels ADD COLUMN templateId int`,
      ]) {
        try { await db.execute(stmt); } catch (e) { if (!isMysqlDuplicateColumnError(e)) throw e; }
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
          AND column_name IN ('metadata', 'errorMessage', 'igMediaId', 'contentType', 'contentId', 'storyData')
      `)) as unknown as [Array<{ column_name: string }>, unknown];

      const existing = new Set((columnRows as Array<{ column_name: string }>).map((r) => r.column_name));

      for (const [col, ddl] of [
        ["metadata", sql`ALTER TABLE social_posts ADD COLUMN metadata text`],
        ["errorMessage", sql`ALTER TABLE social_posts ADD COLUMN errorMessage text`],
        ["igMediaId", sql`ALTER TABLE social_posts ADD COLUMN igMediaId varchar(100)`],
        ["contentType", sql`ALTER TABLE social_posts ADD COLUMN contentType varchar(20)`],
        ["contentId", sql`ALTER TABLE social_posts ADD COLUMN contentId int`],
        ["storyData", sql`ALTER TABLE social_posts ADD COLUMN storyData text`],
      ] as const) {
        if (!existing.has(col)) {
          try {
            await db.execute(ddl);
          } catch (error) {
            if (!isMysqlDuplicateColumnError(error)) throw error;
          }
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
          AND column_name IN ('isActive', 'plan', 'trialExpiresAt')
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

      if (!existing.has("trialExpiresAt")) {
        try {
          await db.execute(sql`ALTER TABLE users ADD COLUMN trialExpiresAt datetime NULL`);
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
    if ((user as { trialExpiresAt?: Date | null }).trialExpiresAt !== undefined) {
      const t = (user as { trialExpiresAt?: Date | null }).trialExpiresAt ?? null;
      (values as Record<string, unknown>).trialExpiresAt = t;
      updateSet.trialExpiresAt = t;
    }
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

// Backfill legacy accounts (trialExpiresAt IS NULL, plan='free', not admin) with a 7-day trial from now.
export async function migrateNullTrialDates(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureUserExtraColumns();
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.execute(
    sql`UPDATE users SET trialExpiresAt = ${sevenDaysFromNow}
        WHERE trialExpiresAt IS NULL AND plan = 'free' AND role != 'admin'`
  );
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
    trialExpiresAt: (u as unknown as { trialExpiresAt?: Date | null }).trialExpiresAt ?? null,
  }));
}

export async function listUsersWithStats() {
  const db = await getDb();
  if (!db) return [];
  await ensureUserExtraColumns();
  // Ensure all lazily-created tables exist before querying them
  await ensureAvatarVideoTable();
  await ensureSocialPostsMetadataColumn();
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));

  type CountRow = { userId: number; n: number };
  const countStar = sql<number>`count(*)`;

  // Aggregate content counts per userId in parallel using raw sql count (safe across all Drizzle versions)
  const [imgCounts, artCounts, carCounts, vidCounts, postCounts, chatCounts] = await Promise.all([
    db.select({ userId: generatedImages.userId,     n: countStar }).from(generatedImages).groupBy(generatedImages.userId),
    db.select({ userId: articles.userId,            n: countStar }).from(articles).groupBy(articles.userId),
    db.select({ userId: carousels.userId,           n: countStar }).from(carousels).groupBy(carousels.userId),
    db.select({ userId: avatarVideos.userId,        n: countStar }).from(avatarVideos).groupBy(avatarVideos.userId),
    db.select({ userId: socialPosts.userId,         n: countStar }).from(socialPosts).groupBy(socialPosts.userId),
    db.select({ userId: chatConversations.userId,   n: countStar }).from(chatConversations).groupBy(chatConversations.userId),
  ]);

  const toMap = (arr: CountRow[]) =>
    Object.fromEntries((arr as CountRow[]).map((r) => [r.userId, Number(r.n)]));

  const imgs  = toMap(imgCounts  as unknown as CountRow[]);
  const arts  = toMap(artCounts  as unknown as CountRow[]);
  const cars  = toMap(carCounts  as unknown as CountRow[]);
  const vids  = toMap(vidCounts  as unknown as CountRow[]);
  const posts = toMap(postCounts as unknown as CountRow[]);
  const chats = toMap(chatCounts as unknown as CountRow[]);

  return rows.map((u) => ({
    ...u,
    plan: ((u as unknown as { plan?: string }).plan ?? "free") as "free" | "pro" | "agency",
    isActive: ((u as unknown as { isActive?: number | boolean }).isActive ?? 1) !== 0,
    trialExpiresAt: (u as unknown as { trialExpiresAt?: Date | null }).trialExpiresAt ?? null,
    usage: {
      images:   imgs[u.id]  ?? 0,
      articles: arts[u.id]  ?? 0,
      carousel: cars[u.id]  ?? 0,
      videos:   vids[u.id]  ?? 0,
      posts:    posts[u.id] ?? 0,
      chats:    chats[u.id] ?? 0,
    },
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
  fileKey?: string,
  width?: number,
  height?: number
): Promise<GeneratedImage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(generatedImages).values({ userId, prompt, imageUrl, fileKey, width, height });
  const created = await db.select().from(generatedImages)
    .where(eq(generatedImages.id, insertId(result))).limit(1);
  return created[0];
}

export async function getImageById(id: number, userId: number): Promise<GeneratedImage | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(generatedImages).where(
    and(eq(generatedImages.id, id), eq(generatedImages.userId, userId))
  );
  return row ?? null;
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

let _articlesTableReady: Promise<void> | null = null;
async function ensureArticlesTable() {
  const db = await getDb();
  if (!db) return;
  if (!_articlesTableReady) {
    _articlesTableReady = (async () => {
      // Create table if not exists (handles fresh installs)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`articles\` (
          \`id\`                 int AUTO_INCREMENT PRIMARY KEY,
          \`userId\`             int NOT NULL,
          \`title\`              varchar(512) NOT NULL,
          \`topic\`              mediumtext,
          \`sourceUrl\`          text,
          \`coverImageUrl\`      text,
          \`content\`            mediumtext NOT NULL,
          \`summary\`            mediumtext,
          \`status\`             enum('draft','published','archived') NOT NULL DEFAULT 'draft',
          \`sourceTopicAngleId\` int,
          \`hookType\`           varchar(32),
          \`contentFormat\`      varchar(32) DEFAULT 'article',
          \`createdAt\`          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\`          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_articles_userId\` (\`userId\`)
        )
      `);

      // For existing installs: add columns that may be missing and upgrade TEXT→MEDIUMTEXT
      for (const [label, stmt] of [
        ["add sourceTopicAngleId", sql`ALTER TABLE articles ADD COLUMN sourceTopicAngleId int`],
        ["add hookType",           sql`ALTER TABLE articles ADD COLUMN hookType varchar(32)`],
        ["add contentFormat",      sql`ALTER TABLE articles ADD COLUMN contentFormat varchar(32) DEFAULT 'article'`],
        ["content→MEDIUMTEXT",     sql`ALTER TABLE articles MODIFY COLUMN content MEDIUMTEXT NOT NULL`],
        ["topic→MEDIUMTEXT",       sql`ALTER TABLE articles MODIFY COLUMN topic MEDIUMTEXT`],
        ["summary→MEDIUMTEXT",     sql`ALTER TABLE articles MODIFY COLUMN summary MEDIUMTEXT`],
      ] as const) {
        try {
          await db.execute(stmt);
          console.log(`[DB] articles: ${label} ok`);
        } catch (e) {
          // Duplicate column (1060) or same type = already migrated, ignore
          const msg = String(e);
          if (!msg.includes("1060") && !msg.includes("Duplicate column")) {
            console.warn(`[DB] articles: ${label} skipped:`, msg.slice(0, 200));
          }
        }
      }
    })().catch((e) => { _articlesTableReady = null; throw e; });
  }
  await _articlesTableReady;
}

export async function getArticles(userId: number): Promise<Article[]> {
  await ensureArticlesTable();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(articles)
    .where(eq(articles.userId, userId))
    .orderBy(desc(articles.createdAt));
}

export async function getArticle(id: number, userId: number): Promise<Article | undefined> {
  await ensureArticlesTable();
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
    sourceTopicAngleId?: number;
    hookType?: string;
    contentFormat?: string;
  }
): Promise<Article> {
  await ensureArticlesTable();
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
    sourceTopicAngleId?: number;
    hookType?: string;
    contentFormat?: string;
    templateId?: number;
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
    contentType?: string;
    contentId?: number;
    storyData?: string;
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

export async function getStoryPosts(userId: number): Promise<SocialPost[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureSocialPostsMetadataColumn();
  return db.select().from(socialPosts).where(
    and(eq(socialPosts.userId, userId), eq(socialPosts.contentType, "story"))
  ).orderBy(desc(socialPosts.createdAt));
}

export async function getSocialPostById(id: number, userId: number): Promise<SocialPost | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureSocialPostsMetadataColumn();
  const rows = await db.select().from(socialPosts).where(
    and(eq(socialPosts.id, id), eq(socialPosts.userId, userId))
  ).limit(1);
  return rows[0] ?? null;
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
    igMediaId: string | null;
    contentType: string | null;
    contentId: number | null;
    storyData: string | null;
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

export async function getInstagramConnectionByIgId(igAccountId: string): Promise<InstagramConnection | null> {
  await ensureInstagramConnectionsColumns();
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(instagramConnections).where(eq(instagramConnections.instagramAccountId, igAccountId));
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

// ─── LinkedIn Connections ──────────────────────────────────────────────────────

async function ensureLinkedInConnectionsTable(): Promise<void> {
  if (!_linkedinConnectionsTableReady) {
    _linkedinConnectionsTableReady = (async () => {
      const db = await getDb();
      if (!db) return;
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`linkedin_connections\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`userId\` int NOT NULL,
          \`linkedinMemberId\` varchar(128) NOT NULL,
          \`authorUrn\` varchar(160) NOT NULL,
          \`name\` varchar(255),
          \`email\` varchar(320),
          \`profilePictureUrl\` text,
          \`accessToken\` text NOT NULL,
          \`refreshToken\` text,
          \`tokenExpiresAt\` timestamp NULL,
          \`connectedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`linkedin_connections_pk\` PRIMARY KEY (\`id\`),
          CONSTRAINT \`linkedin_connections_userId_unique\` UNIQUE (\`userId\`)
        )
      `);
    })();
  }
  return _linkedinConnectionsTableReady;
}

export async function getLinkedInConnection(userId: number): Promise<LinkedInConnection | null> {
  try {
    await ensureLinkedInConnectionsTable();
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(linkedinConnections).where(eq(linkedinConnections.userId, userId));
    return row ?? null;
  } catch {
    return null;
  }
}

export async function upsertLinkedInConnection(data: InsertLinkedInConnection): Promise<void> {
  await ensureLinkedInConnectionsTable();
  const db = await getDb();
  if (!db) return;
  const existing = await getLinkedInConnection(data.userId);
  if (existing) {
    await db.update(linkedinConnections)
      .set({
        linkedinMemberId: data.linkedinMemberId,
        authorUrn: data.authorUrn,
        name: data.name,
        email: data.email,
        profilePictureUrl: data.profilePictureUrl,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
      })
      .where(eq(linkedinConnections.userId, data.userId));
  } else {
    await db.insert(linkedinConnections).values(data);
  }
}

export async function deleteLinkedInConnection(userId: number): Promise<void> {
  try {
    await ensureLinkedInConnectionsTable();
    const db = await getDb();
    if (!db) return;
    await db.delete(linkedinConnections).where(eq(linkedinConnections.userId, userId));
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
    await ensureBrandKitNicheColumns();
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

export type BrandKitData = Omit<BrandKit, "id" | "userId" | "createdAt" | "updatedAt"> & {
  nicheId?: string | null;
  subNicheId?: string | null;
};

export async function saveBrandKit(userId: number, data: Partial<BrandKitData>): Promise<BrandKit> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureBrandKitTable(db);
  await ensureBrandKitNicheColumns();

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
  const ni  = n((data as { nicheId?: string | null }).nicheId);
  const sni = n((data as { subNicheId?: string | null }).subNicheId);

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
      linkedinUrl     = ${li},
      nicheId         = COALESCE(${ni}, nicheId),
      subNicheId      = COALESCE(${sni}, subNicheId)
    WHERE userId = ${userId}
  `);

  const result = await getBrandKit(userId);
  if (!result) throw new Error("Failed to save brand kit");
  return result;
}

// ─── WhatsApp Digest ───────────────────────────────────────────────────────────

// ── Delivered news deduplication ─────────────────────────────────────────────

let _deliveredNewsTableReady: Promise<void> | null = null;

async function ensureDeliveredNewsTable(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  if (!_deliveredNewsTableReady) {
    _deliveredNewsTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`delivered_news\` (
          \`id\`           INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\`      INT NOT NULL,
          \`url_key\`      VARCHAR(500) NOT NULL,
          \`title\`        VARCHAR(500),
          \`delivered_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_url (\`user_id\`, \`url_key\`(255)),
          INDEX idx_user_delivered (\`user_id\`, \`delivered_at\`)
        )
      `);
    })();
  }
  return _deliveredNewsTableReady;
}

function normalizeDeliveredUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.toLowerCase().slice(0, 500);
  } catch {
    return url.toLowerCase().slice(0, 500);
  }
}

export async function getDeliveredNewsKeys(userId: number, daysBack = 7): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  await ensureDeliveredNewsTable(db);
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT url_key FROM delivered_news
    WHERE user_id = ${userId} AND delivered_at > ${cutoff}
  `);
  const list = (rows[0] as unknown as Array<{ url_key: string }>);
  return new Set(list.map((r) => r.url_key));
}

export async function saveDeliveredNews(
  userId: number,
  items: { url: string; title?: string | null }[]
): Promise<void> {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await ensureDeliveredNewsTable(db);
  for (const item of items) {
    const key = normalizeDeliveredUrl(item.url);
    await db
      .execute(sql`
        INSERT IGNORE INTO delivered_news (user_id, url_key, title)
        VALUES (${userId}, ${key}, ${(item.title ?? "").slice(0, 500)})
      `)
      .catch(() => {});
  }
}

// ── Digest tables ─────────────────────────────────────────────────────────────

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
      await db.execute(sql`ALTER TABLE \`user_digest_settings\` ADD COLUMN \`reply_webhook_url\` VARCHAR(500) NULL`).catch(() => {});
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`whatsapp_digest_sessions\` (
          \`id\`             INT AUTO_INCREMENT PRIMARY KEY,
          \`campaign_id\`    VARCHAR(36) NOT NULL,
          \`user_id\`        INT NOT NULL,
          \`phone_number\`   VARCHAR(20) NOT NULL,
          \`news_items\`     TEXT NOT NULL,
          \`message_text\`   TEXT,
          \`sent_at\`        DATETIME NOT NULL,
          \`expires_at\`     DATETIME NOT NULL,
          \`user_response\`  VARCHAR(5),
          \`chosen_index\`   TINYINT,
          \`responded_at\`   DATETIME,
          INDEX idx_phone_expires (\`phone_number\`, \`expires_at\`),
          INDEX idx_campaign (\`campaign_id\`)
        )
      `);
      // Migrate old sessions table (add columns if not present)
      await db.execute(sql`ALTER TABLE \`whatsapp_digest_sessions\` ADD COLUMN \`campaign_id\` VARCHAR(36) NOT NULL DEFAULT ''`).catch(() => {});
      await db.execute(sql`ALTER TABLE \`whatsapp_digest_sessions\` ADD COLUMN \`message_text\` TEXT`).catch(() => {});
      await db.execute(sql`ALTER TABLE \`whatsapp_digest_sessions\` ADD COLUMN \`user_response\` VARCHAR(5)`).catch(() => {});
      await db.execute(sql`ALTER TABLE \`whatsapp_digest_sessions\` ADD COLUMN \`chosen_index\` TINYINT`).catch(() => {});
      await db.execute(sql`ALTER TABLE \`whatsapp_digest_sessions\` ADD COLUMN \`responded_at\` DATETIME`).catch(() => {});
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
  replyWebhookUrl: string | null;
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
    replyWebhookUrl: row.reply_webhook_url ? String(row.reply_webhook_url) : null,
  };
}

export async function upsertDigestSettings(
  userId: number,
  data: { whatsappNumber: string; digestHour: number; digestMinute: number; enabled: boolean; templateName?: string; templateLanguage?: string; replyWebhookUrl?: string | null }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureDigestTables(db);
  const tplName = data.templateName ?? "envio_de_noticias_diario";
  const tplLang = data.templateLanguage ?? "pt_BR";
  const webhookUrl = data.replyWebhookUrl ?? null;
  await db.execute(sql`
    INSERT INTO user_digest_settings (user_id, whatsapp_number, digest_hour, digest_minute, enabled, template_name, template_language, reply_webhook_url)
    VALUES (${userId}, ${data.whatsappNumber}, ${data.digestHour}, ${data.digestMinute}, ${data.enabled ? 1 : 0}, ${tplName}, ${tplLang}, ${webhookUrl})
    ON DUPLICATE KEY UPDATE
      whatsapp_number    = VALUES(whatsapp_number),
      digest_hour        = VALUES(digest_hour),
      digest_minute      = VALUES(digest_minute),
      enabled            = VALUES(enabled),
      template_name      = VALUES(template_name),
      template_language  = VALUES(template_language),
      reply_webhook_url  = VALUES(reply_webhook_url)
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
    replyWebhookUrl: row.reply_webhook_url ? String(row.reply_webhook_url) : null,
  }));
}

export type DigestNewsItem = {
  title: string;
  url: string;
  source: string;
  excerpt: string | null;
  publishedAt: string | null;
};

// Remove +, spaces and dashes so "5511..." and "+55 11..." both match
function normalizePhone(phone: string): string {
  return phone.replace(/[\s+\-().]/g, "");
}

// Brazilian mobile numbers: 55 + 2-digit area + 9 + 8-digit (13 total) ↔ without leading 9 (12 total)
function brazilianVariant(normalized: string): string | null {
  if (!normalized.startsWith('55')) return null;
  if (normalized.length === 13 && normalized[4] === '9') {
    return normalized.slice(0, 4) + normalized.slice(5);
  }
  if (normalized.length === 12) {
    return normalized.slice(0, 4) + '9' + normalized.slice(4);
  }
  return null;
}

export async function saveDigestSession(
  userId: number,
  phoneNumber: string,
  newsItems: DigestNewsItem[],
  campaignId?: string,
  messageText?: string
): Promise<string> {
  const db = await getDb();
  const id = campaignId ?? randomCampaignId();
  if (!db) return id;
  await ensureDigestTables(db);
  const normalized = normalizePhone(phoneNumber);
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  console.log(`[DigestSession] Salvando sessão phone=${normalized} userId=${userId} campaign=${id}`);
  await db.execute(sql`
    INSERT INTO whatsapp_digest_sessions (campaign_id, user_id, phone_number, news_items, message_text, sent_at, expires_at)
    VALUES (${id}, ${userId}, ${normalized}, ${JSON.stringify(newsItems)}, ${messageText ?? null}, ${now}, ${expires})
  `);
  return id;
}

export async function recordSessionResponse(
  phoneNumber: string,
  choice: number
): Promise<{ userId: number; campaignId: string; newsItems: DigestNewsItem[]; chosenItem: DigestNewsItem } | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureDigestTables(db);
  const normalized = normalizePhone(phoneNumber);
  const withPlus = `+${normalized}`;
  const brAlt = brazilianVariant(normalized);
  const brCondition = brAlt ? sql`OR phone_number = ${brAlt} OR phone_number = ${`+${brAlt}`}` : sql``;
  console.log(`[DigestSession] Buscando sessão para phone=${normalized}${brAlt ? ` | variante BR: ${brAlt}` : ''} choice=${choice}`);
  const rows = await db.execute(sql`
    SELECT id, campaign_id, user_id, news_items FROM whatsapp_digest_sessions
    WHERE (phone_number = ${normalized} OR phone_number = ${withPlus} ${brCondition})
      AND expires_at > NOW() AND user_response IS NULL
    ORDER BY sent_at DESC LIMIT 1
  `);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  if (!row) {
    console.warn(`[DigestSession] Sessão não encontrada para phone=${normalized} nem variantes`);
    return null;
  }
  let newsItems: DigestNewsItem[];
  try { newsItems = JSON.parse(String(row.news_items)) as DigestNewsItem[]; }
  catch { return null; }
  const idx = choice - 1;
  const chosenItem = newsItems[idx];
  if (!chosenItem) return null;
  await db.execute(sql`
    UPDATE whatsapp_digest_sessions
    SET user_response = ${String(choice)}, chosen_index = ${idx}, responded_at = NOW()
    WHERE id = ${Number(row.id)}
  `);
  console.log(`[DigestSession] Sessão encontrada e registrada: userId=${String(row.user_id)} campaign=${String(row.campaign_id)}`);
  return {
    userId: Number(row.user_id),
    campaignId: String(row.campaign_id),
    newsItems,
    chosenItem,
  };
}

function randomCampaignId(): string {
  return `camp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getActiveDigestSession(
  phoneNumber: string
): Promise<{ userId: number; newsItems: DigestNewsItem[] } | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureDigestTables(db);
  const normalized = normalizePhone(phoneNumber);
  const withPlus = `+${normalized}`;
  const brAlt = brazilianVariant(normalized);
  const brCondition = brAlt ? sql`OR phone_number = ${brAlt} OR phone_number = ${`+${brAlt}`}` : sql``;
  const rows = await db.execute(sql`
    SELECT user_id, news_items FROM whatsapp_digest_sessions
    WHERE (phone_number = ${normalized} OR phone_number = ${withPlus} ${brCondition}) AND expires_at > NOW()
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


// ─────────────────────────────────────────────────────────────
// Reels Scripts
// ─────────────────────────────────────────────────────────────

export type ReelsScript = {
  id: number;
  userId: number;
  title: string;
  topic: string;
  tone: string;
  duration: string;
  hook: string;
  reward: string;
  loopClose: string;
  caption: string;
  hashtags: string[];
  scenes: import('./_core/reelsScriptAgent').ReelsScene[];
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
};

async function ensureReelsScriptsTable() {
  const db = await getDb();
  if (!db) return;

  if (!_reelsScriptsTableReady) {
    _reelsScriptsTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS reels_scripts (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          title varchar(512) NOT NULL,
          topic text NOT NULL,
          tone varchar(64) NOT NULL DEFAULT 'educational',
          duration varchar(32) NOT NULL DEFAULT 'medium',
          hook text NOT NULL,
          reward text NOT NULL,
          loopClose text NOT NULL,
          caption text NOT NULL,
          hashtags text NOT NULL,
          scenes text NOT NULL,
          sourceTopicAngleId int,
          hookType varchar(32),
          contentFormat varchar(32) DEFAULT 'reels',
          status enum('draft','published') NOT NULL DEFAULT 'draft',
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      for (const stmt of [
        sql`ALTER TABLE reels_scripts ADD COLUMN sourceTopicAngleId int`,
        sql`ALTER TABLE reels_scripts ADD COLUMN hookType varchar(32)`,
        sql`ALTER TABLE reels_scripts ADD COLUMN contentFormat varchar(32) DEFAULT 'reels'`,
      ]) {
        try { await db.execute(stmt); } catch (e) { if (!isMysqlDuplicateColumnError(e)) throw e; }
      }
    })().catch((error) => {
      _reelsScriptsTableReady = null;
      throw error;
    });
  }

  await _reelsScriptsTableReady;
}

function hydrateReelsScript(row: Record<string, unknown>): ReelsScript {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    title: String(row.title),
    topic: String(row.topic),
    tone: String(row.tone ?? 'educational'),
    duration: String(row.duration ?? 'medium'),
    hook: String(row.hook ?? ''),
    reward: String(row.reward ?? ''),
    loopClose: String(row.loopClose ?? ''),
    caption: String(row.caption ?? ''),
    hashtags: (() => { try { return JSON.parse(String(row.hashtags ?? '[]')); } catch { return []; } })(),
    scenes: (() => { try { return JSON.parse(String(row.scenes ?? '[]')); } catch { return []; } })(),
    status: (row.status as 'draft' | 'published') ?? 'draft',
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
  };
}

export async function getReelsScripts(userId: number): Promise<ReelsScript[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureReelsScriptsTable();
  const rows = await db.execute(sql`
    SELECT * FROM reels_scripts WHERE userId = ${userId} ORDER BY createdAt DESC
  `);
  return (rows[0] as unknown as Record<string, unknown>[]).map(hydrateReelsScript);
}

export async function saveReelsScript(
  userId: number,
  data: {
    title: string;
    topic: string;
    tone: string;
    duration: string;
    hook: string;
    reward: string;
    loopClose: string;
    caption: string;
    hashtags: string[];
    scenes: import('./_core/reelsScriptAgent').ReelsScene[];
    sourceTopicAngleId?: number;
    hookType?: string;
    contentFormat?: string;
  }
): Promise<ReelsScript> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await ensureReelsScriptsTable();
  const insertResult = await db.execute(sql`
    INSERT INTO reels_scripts (userId, title, topic, tone, duration, hook, reward, loopClose, caption, hashtags, scenes, sourceTopicAngleId, hookType, contentFormat)
    VALUES (
      ${userId},
      ${data.title},
      ${data.topic},
      ${data.tone},
      ${data.duration},
      ${data.hook},
      ${data.reward},
      ${data.loopClose},
      ${data.caption},
      ${JSON.stringify(data.hashtags)},
      ${JSON.stringify(data.scenes)},
      ${data.sourceTopicAngleId ?? null},
      ${data.hookType ?? null},
      ${data.contentFormat ?? 'reels'}
    )
  `);
  const id = insertId(insertResult[0]);
  const selectResult = await db.execute(sql`SELECT * FROM reels_scripts WHERE id = ${id}`);
  return hydrateReelsScript((selectResult[0] as unknown as Record<string, unknown>[])[0]);
}

export async function deleteReelsScript(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureReelsScriptsTable();
  await db.execute(sql`DELETE FROM reels_scripts WHERE id = ${id} AND userId = ${userId}`);
}

export async function getReelsScriptCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  await ensureReelsScriptsTable();
  const cntResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM reels_scripts WHERE userId = ${userId}`);
  const row = (cntResult[0] as unknown as Record<string, unknown>[])[0];
  return Number(row?.cnt ?? 0);
}


// ─────────────────────────────────────────────────────────────
// Comment Alerts (Phase 5 — 60-minute engagement window)
// ─────────────────────────────────────────────────────────────

export type CommentAlert = {
  id: number;
  userId: number;
  mediaId: string;
  mediaCaption: string | null;
  mediaPermalink: string | null;
  previousCount: number;
  newCount: number;
  detectedAt: Date;
  whatsappSentAt: Date | null;
  acknowledgedAt: Date | null;
};

async function ensureCommentPollStateTable() {
  const db = await getDb();
  if (!db) return;
  if (!_commentPollStateReady) {
    _commentPollStateReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS comment_poll_state (
          userId int NOT NULL,
          mediaId varchar(100) NOT NULL,
          lastKnownCount int NOT NULL DEFAULT 0,
          lastCheckedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (userId, mediaId)
        )
      `);
    })().catch((err) => {
      _commentPollStateReady = null;
      throw err;
    });
  }
  await _commentPollStateReady;
}

async function ensureCommentAlertsTable() {
  const db = await getDb();
  if (!db) return;
  if (!_commentAlertsReady) {
    _commentAlertsReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS comment_alerts (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          mediaId varchar(100) NOT NULL,
          mediaCaption text,
          mediaPermalink text,
          previousCount int NOT NULL DEFAULT 0,
          newCount int NOT NULL DEFAULT 0,
          detectedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          whatsappSentAt timestamp NULL,
          acknowledgedAt timestamp NULL,
          INDEX idx_user_ack (userId, acknowledgedAt)
        )
      `);
    })().catch((err) => {
      _commentAlertsReady = null;
      throw err;
    });
  }
  await _commentAlertsReady;
}

function hydrateAlert(row: Record<string, unknown>): CommentAlert {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    mediaId: String(row.mediaId),
    mediaCaption: row.mediaCaption ? String(row.mediaCaption) : null,
    mediaPermalink: row.mediaPermalink ? String(row.mediaPermalink) : null,
    previousCount: Number(row.previousCount ?? 0),
    newCount: Number(row.newCount ?? 0),
    detectedAt: row.detectedAt instanceof Date ? row.detectedAt : new Date(String(row.detectedAt)),
    whatsappSentAt: row.whatsappSentAt ? (row.whatsappSentAt instanceof Date ? row.whatsappSentAt : new Date(String(row.whatsappSentAt))) : null,
    acknowledgedAt: row.acknowledgedAt ? (row.acknowledgedAt instanceof Date ? row.acknowledgedAt : new Date(String(row.acknowledgedAt))) : null,
  };
}

export async function getCommentPollCount(userId: number, mediaId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  await ensureCommentPollStateTable();
  const rows = await db.execute(sql`
    SELECT lastKnownCount FROM comment_poll_state
    WHERE userId = ${userId} AND mediaId = ${mediaId}
  `);
  const row = (rows[0] as unknown as Array<Record<string, unknown>>)[0];
  return row ? Number(row.lastKnownCount) : -1;
}

export async function upsertCommentPollState(userId: number, mediaId: string, count: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureCommentPollStateTable();
  await db.execute(sql`
    INSERT INTO comment_poll_state (userId, mediaId, lastKnownCount)
    VALUES (${userId}, ${mediaId}, ${count})
    ON DUPLICATE KEY UPDATE lastKnownCount = ${count}, lastCheckedAt = CURRENT_TIMESTAMP
  `);
}

export async function insertCommentAlert(
  userId: number,
  data: {
    mediaId: string;
    mediaCaption?: string | null;
    mediaPermalink?: string | null;
    previousCount: number;
    newCount: number;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await ensureCommentAlertsTable();
  const result = await db.execute(sql`
    INSERT INTO comment_alerts (userId, mediaId, mediaCaption, mediaPermalink, previousCount, newCount)
    VALUES (
      ${userId},
      ${data.mediaId},
      ${data.mediaCaption ?? null},
      ${data.mediaPermalink ?? null},
      ${data.previousCount},
      ${data.newCount}
    )
  `);
  return insertId(result[0]);
}

export async function markAlertWhatsappSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE comment_alerts SET whatsappSentAt = CURRENT_TIMESTAMP WHERE id = ${id}`);
}

export async function acknowledgeCommentAlert(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureCommentAlertsTable();
  await db.execute(sql`
    UPDATE comment_alerts SET acknowledgedAt = CURRENT_TIMESTAMP
    WHERE id = ${id} AND userId = ${userId}
  `);
}

export async function getOpenCommentAlerts(userId: number): Promise<CommentAlert[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureCommentAlertsTable();
  const rows = await db.execute(sql`
    SELECT * FROM comment_alerts
    WHERE userId = ${userId} AND acknowledgedAt IS NULL
    ORDER BY detectedAt DESC
    LIMIT 20
  `);
  return (rows[0] as unknown as Record<string, unknown>[]).map(hydrateAlert);
}

export async function getAllInstagramConnections(): Promise<Array<{ userId: number; instagramAccountId: string; accessToken: string }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT userId, instagramAccountId, accessToken FROM instagram_connections
    WHERE accessToken IS NOT NULL AND instagramAccountId IS NOT NULL
  `);
  return (rows[0] as unknown as Array<Record<string, unknown>>).map((r) => ({
    userId: Number(r.userId),
    instagramAccountId: String(r.instagramAccountId),
    accessToken: String(r.accessToken),
  }));
}

// ─── Comment Automations (Comment-to-DM) ─────────────────────────────────────

async function ensureCommentAutomationsTable(): Promise<void> {
  if (!_commentAutomationsTableReady) {
    _commentAutomationsTableReady = (async () => {
      const db = await getDb();
      if (!db) return;
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`comment_automations\` (
          \`id\`                    INT AUTO_INCREMENT PRIMARY KEY,
          \`userId\`                INT NOT NULL,
          \`igAccountId\`           VARCHAR(64) NOT NULL,
          \`igPostId\`              VARCHAR(64) NOT NULL,
          \`postCaption\`           TEXT,
          \`postThumbnailUrl\`      TEXT,
          \`keywords\`              JSON NOT NULL,
          \`publicReplyMessage\`    TEXT NOT NULL,
          \`dmFirstMessage\`        TEXT NOT NULL,
          \`dmFollowupMessage\`     TEXT,
          \`dmLink\`                TEXT,
          \`status\`                VARCHAR(16) NOT NULL DEFAULT 'active',
          \`commentsMatchedCount\`  INT NOT NULL DEFAULT 0,
          \`dmsSentCount\`          INT NOT NULL DEFAULT 0,
          \`linkClicksCount\`       INT NOT NULL DEFAULT 0,
          \`createdAt\`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_ca_userId\` (\`userId\`),
          INDEX \`idx_ca_igPost\` (\`igAccountId\`, \`igPostId\`)
        )
      `);
    })().catch(() => { _commentAutomationsTableReady = null; });
  }
  return _commentAutomationsTableReady!;
}

function hydrateAutomation(row: Record<string, unknown>): CommentAutomation {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    igAccountId: String(row.igAccountId),
    igPostId: String(row.igPostId),
    postCaption: row.postCaption != null ? String(row.postCaption) : null,
    postThumbnailUrl: row.postThumbnailUrl != null ? String(row.postThumbnailUrl) : null,
    keywords: (() => { try { return typeof row.keywords === 'string' ? JSON.parse(row.keywords) : (row.keywords as string[]); } catch { return []; } })(),
    publicReplyMessage: String(row.publicReplyMessage ?? ''),
    dmFirstMessage: String(row.dmFirstMessage ?? ''),
    dmFollowupMessage: row.dmFollowupMessage != null ? String(row.dmFollowupMessage) : null,
    dmLink: row.dmLink != null ? String(row.dmLink) : null,
    status: String(row.status ?? 'active'),
    commentsMatchedCount: Number(row.commentsMatchedCount ?? 0),
    dmsSentCount: Number(row.dmsSentCount ?? 0),
    linkClicksCount: Number(row.linkClicksCount ?? 0),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
  };
}

export async function getCommentAutomations(userId: number): Promise<CommentAutomation[]> {
  const db = await getDb();
  if (!db) return [];
  await ensureCommentAutomationsTable();
  const rows = await db.execute(sql`
    SELECT * FROM comment_automations WHERE userId = ${userId} ORDER BY createdAt DESC
  `);
  return (rows[0] as unknown as Record<string, unknown>[]).map(hydrateAutomation);
}

export async function createCommentAutomation(
  userId: number,
  data: {
    igAccountId: string;
    igPostId: string;
    postCaption?: string | null;
    postThumbnailUrl?: string | null;
    keywords: string[];
    publicReplyMessage: string;
    dmFirstMessage: string;
    dmFollowupMessage?: string | null;
    dmLink?: string | null;
  }
): Promise<CommentAutomation> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureCommentAutomationsTable();
  const result = await db.execute(sql`
    INSERT INTO comment_automations
      (userId, igAccountId, igPostId, postCaption, postThumbnailUrl, keywords,
       publicReplyMessage, dmFirstMessage, dmFollowupMessage, dmLink)
    VALUES (
      ${userId}, ${data.igAccountId}, ${data.igPostId},
      ${data.postCaption ?? null}, ${data.postThumbnailUrl ?? null},
      ${JSON.stringify(data.keywords)},
      ${data.publicReplyMessage}, ${data.dmFirstMessage},
      ${data.dmFollowupMessage ?? null}, ${data.dmLink ?? null}
    )
  `);
  const rows = await db.execute(sql`SELECT * FROM comment_automations WHERE id = ${insertId(result[0])} LIMIT 1`);
  return hydrateAutomation((rows[0] as unknown as Record<string, unknown>[])[0]);
}

export async function toggleCommentAutomationStatus(id: number, userId: number): Promise<'active' | 'paused'> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await ensureCommentAutomationsTable();
  const rows = await db.execute(sql`SELECT status FROM comment_automations WHERE id = ${id} AND userId = ${userId} LIMIT 1`);
  const current = ((rows[0] as unknown as Record<string, unknown>[])[0])?.status as string ?? 'active';
  const next = current === 'active' ? 'paused' : 'active';
  await db.execute(sql`UPDATE comment_automations SET status = ${next} WHERE id = ${id} AND userId = ${userId}`);
  return next;
}

export async function deleteCommentAutomation(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureCommentAutomationsTable();
  await db.execute(sql`DELETE FROM comment_automations WHERE id = ${id} AND userId = ${userId}`);
}

export async function matchCommentAutomation(
  igAccountId: string,
  igPostId: string,
  commentText: string
): Promise<CommentAutomation | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureCommentAutomationsTable();
  const rows = await db.execute(sql`
    SELECT * FROM comment_automations
    WHERE igAccountId = ${igAccountId} AND igPostId = ${igPostId} AND status = 'active'
  `);
  const campaigns = (rows[0] as unknown as Record<string, unknown>[]).map(hydrateAutomation);
  console.log(`[DB] matchCommentAutomation: igAccountId=${igAccountId}, igPostId=${igPostId}, campaigns_found=${campaigns.length}`);
  if (campaigns.length === 0) {
    // Debug: show all active campaigns to help diagnose mismatch
    const allRows = await db.execute(sql`SELECT igAccountId, igPostId, status, keywords FROM comment_automations WHERE status = 'active' LIMIT 5`);
    const allCampaigns = allRows[0] as unknown as Array<{ igAccountId: string; igPostId: string; status: string; keywords: string }>;
    console.log(`[DB] Campanhas ativas no banco:`, JSON.stringify(allCampaigns));
  }
  const lowerComment = commentText.toLowerCase();
  return campaigns.find((c) =>
    c.keywords.some((kw) => lowerComment.includes(kw.toLowerCase()))
  ) ?? null;
}

export async function getInstagramConnectionByAutomationId(automationId: number): Promise<InstagramConnection | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureCommentAutomationsTable();
  const rows = await db.execute(sql`SELECT userId FROM comment_automations WHERE id = ${automationId} LIMIT 1`);
  const userId = ((rows[0] as unknown as Record<string, unknown>[])[0])?.userId as number | undefined;
  if (!userId) return null;
  return getInstagramConnection(userId);
}

export async function incrementCommentMatchedCount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE comment_automations SET commentsMatchedCount = commentsMatchedCount + 1 WHERE id = ${id}`);
}

export async function incrementDmsSentCount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE comment_automations SET dmsSentCount = dmsSentCount + 1 WHERE id = ${id}`);
}

// ── Style profiles ────────────────────────────────────────────────────────────

let _styleProfilesTableReady: Promise<void> | null = null;

async function ensureStyleProfilesTable(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  if (!_styleProfilesTableReady) {
    _styleProfilesTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`style_profiles\` (
          \`id\`                  INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\`             INT NOT NULL,
          \`profile_handle\`      VARCHAR(100) NOT NULL,
          \`profile_name\`        VARCHAR(255),
          \`profile_picture_url\` TEXT,
          \`source\`              VARCHAR(20) NOT NULL DEFAULT 'scrape',
          \`analysis_json\`       LONGTEXT NOT NULL,
          \`created_at\`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_created (\`user_id\`, \`created_at\`)
        )
      `);
    })();
  }
  return _styleProfilesTableReady;
}

export async function saveStyleProfile(
  userId: number,
  data: {
    profileHandle: string;
    profileName?: string | null;
    profilePictureUrl?: string | null;
    source: string;
    analysisJson: string;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  await ensureStyleProfilesTable(db);
  const result = await db.execute(sql`
    INSERT INTO \`style_profiles\`
      (\`user_id\`, \`profile_handle\`, \`profile_name\`, \`profile_picture_url\`, \`source\`, \`analysis_json\`)
    VALUES
      (${userId}, ${data.profileHandle}, ${data.profileName ?? null}, ${data.profilePictureUrl ?? null}, ${data.source}, ${data.analysisJson})
  `);
  return insertId(result);
}

export async function listStyleProfiles(userId: number): Promise<Array<{
  id: number;
  profileHandle: string;
  profileName: string | null;
  profilePictureUrl: string | null;
  source: string;
  analysisJson: string;
  createdAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  await ensureStyleProfilesTable(db);
  const rows = await db.execute(sql`
    SELECT id, profile_handle, profile_name, profile_picture_url, source, analysis_json, created_at
    FROM \`style_profiles\`
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  const list = Array.isArray(rows[0]) ? (rows[0] as Record<string, unknown>[]) : [];
  return list.map((r) => ({
    id: Number(r.id),
    profileHandle: String(r.profile_handle ?? ""),
    profileName: r.profile_name != null ? String(r.profile_name) : null,
    profilePictureUrl: r.profile_picture_url != null ? String(r.profile_picture_url) : null,
    source: String(r.source ?? "scrape"),
    analysisJson: String(r.analysis_json ?? "{}"),
    createdAt: r.created_at instanceof Date ? r.created_at : new Date(String(r.created_at)),
  }));
}

export async function deleteStyleProfile(userId: number, id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await ensureStyleProfilesTable(db);
  await db.execute(sql`
    DELETE FROM \`style_profiles\` WHERE id = ${id} AND user_id = ${userId}
  `);
}

// ─── Niche Profiles ───────────────────────────────────────────────────────────

let _nicheProfilesReady: Promise<void> | null = null;

async function ensureNicheProfilesTable() {
  const db = await getDb();
  if (!db) return;
  if (!_nicheProfilesReady) {
    _nicheProfilesReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`niche_profiles\` (
          \`id\`                 VARCHAR(64)  NOT NULL PRIMARY KEY,
          \`parentId\`           VARCHAR(64),
          \`label\`              VARCHAR(128) NOT NULL,
          \`version\`            INT          NOT NULL DEFAULT 1,
          \`subNiches\`          JSON,
          \`visualGrammar\`      JSON,
          \`copyTone\`           JSON,
          \`referenceImageTags\` JSON,
          \`carouselPatterns\`   JSON,
          \`keywords\`           JSON,
          \`isActive\`           TINYINT(1)   NOT NULL DEFAULT 1,
          \`createdAt\`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      await seedNicheProfiles(db);
    })().catch((e) => { _nicheProfilesReady = null; throw e; });
  }
  await _nicheProfilesReady;
}

async function seedNicheProfiles(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) return;
  const { NICHE_PROFILES } = await import('./_core/nicheProfilesSeed');
  const [rows] = await db.execute(sql`SELECT COUNT(*) as cnt FROM niche_profiles`) as unknown as [Array<{ cnt: number }>, unknown];
  if (Number((rows as Array<{ cnt: number }>)[0]?.cnt) > 0) return;
  for (const p of NICHE_PROFILES) {
    await db.execute(sql`
      INSERT IGNORE INTO niche_profiles (id, label, version, subNiches, visualGrammar, copyTone, referenceImageTags, carouselPatterns, keywords)
      VALUES (
        ${p.id}, ${p.label}, ${p.version},
        ${JSON.stringify(p.subNiches)},
        ${JSON.stringify(p.visualGrammar)},
        ${JSON.stringify(p.copyTone)},
        ${JSON.stringify(p.referenceImageTags)},
        ${JSON.stringify(p.carouselPatterns)},
        ${JSON.stringify(p.keywords)}
      )
    `);
  }
  console.log(`[NicheProfiles] Seeded ${NICHE_PROFILES.length} niche profiles.`);
}

export async function listNicheProfiles(): Promise<Array<{ id: string; label: string; version: number; subNiches: unknown; keywords: unknown }>> {
  const db = await getDb();
  if (!db) return [];
  await ensureNicheProfilesTable();
  const [rows] = await db.execute(sql`SELECT id, label, version, subNiches, keywords FROM niche_profiles WHERE isActive = 1 ORDER BY label`) as unknown as [Array<Record<string, unknown>>, unknown];
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    label: String(r.label),
    version: Number(r.version ?? 1),
    subNiches: r.subNiches ? (typeof r.subNiches === 'string' ? JSON.parse(r.subNiches) : r.subNiches) : [],
    keywords: r.keywords ? (typeof r.keywords === 'string' ? JSON.parse(r.keywords) : r.keywords) : [],
  }));
}

export async function getNicheProfile(id: string): Promise<{ id: string; label: string; version: number; visualGrammar: unknown; copyTone: unknown; referenceImageTags: unknown; carouselPatterns: unknown } | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureNicheProfilesTable();
  const [rows] = await db.execute(sql`SELECT * FROM niche_profiles WHERE id = ${id} AND isActive = 1 LIMIT 1`) as unknown as [Array<Record<string, unknown>>, unknown];
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  const parse = (v: unknown) => v ? (typeof v === 'string' ? JSON.parse(v) : v) : null;
  return {
    id: String(row.id),
    label: String(row.label),
    version: Number(row.version ?? 1),
    visualGrammar: parse(row.visualGrammar),
    copyTone: parse(row.copyTone),
    referenceImageTags: parse(row.referenceImageTags),
    carouselPatterns: parse(row.carouselPatterns),
  };
}

// ─── Brand Kit niche columns migration ───────────────────────────────────────

let _brandKitNicheColumnsReady: Promise<void> | null = null;

async function ensureBrandKitNicheColumns() {
  const db = await getDb();
  if (!db) return;
  if (!_brandKitNicheColumnsReady) {
    _brandKitNicheColumnsReady = (async () => {
      await db.execute(sql`ALTER TABLE brand_kits ADD COLUMN nicheId VARCHAR(64)`).catch(() => {});
      await db.execute(sql`ALTER TABLE brand_kits ADD COLUMN subNicheId VARCHAR(64)`).catch(() => {});
    })().catch((e) => { _brandKitNicheColumnsReady = null; throw e; });
  }
  await _brandKitNicheColumnsReady;
}

// ─── Daily Usage (trial limits) ───────────────────────────────────────────────

async function ensureDailyUsageTable() {
  const db = await getDb();
  if (!db) return;
  if (!_dailyUsageTableReady) {
    _dailyUsageTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS daily_usage (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          feature VARCHAR(32) NOT NULL,
          date VARCHAR(10) NOT NULL,
          count INT NOT NULL DEFAULT 0,
          UNIQUE KEY uq_daily_usage (userId, feature, date),
          INDEX idx_daily_usage_uid_feat_date (userId, feature, date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { _dailyUsageTableReady = null; throw e; });
  }
  await _dailyUsageTableReady;
}

export async function getDailyUsageCount(userId: number, feature: string, date: string): Promise<number> {
  await ensureDailyUsageTable();
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: dailyUsage.count })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.feature, feature), eq(dailyUsage.date, date)))
    .limit(1);
  return rows[0]?.count ?? 0;
}

export async function incrementDailyUsage(userId: number, feature: string, date: string): Promise<void> {
  await ensureDailyUsageTable();
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    INSERT INTO daily_usage (userId, feature, date, count)
    VALUES (${userId}, ${feature}, ${date}, 1)
    ON DUPLICATE KEY UPDATE count = count + 1
  `);
}

export async function getDailyUsageAll(userId: number, date: string): Promise<Record<string, number>> {
  await ensureDailyUsageTable();
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({ feature: dailyUsage.feature, count: dailyUsage.count })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, date)));
  return Object.fromEntries(rows.map((r) => [r.feature, r.count]));
}

// ─── Radar de Temas (Module 1.1) ─────────────────────────────────────────────

let _radarTablesReady: Promise<void> | null = null;

async function ensureRadarTables() {
  const db = await getDb();
  if (!db) return;

  if (!_radarTablesReady) {
    _radarTablesReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS trending_topics (
          id INT AUTO_INCREMENT PRIMARY KEY,
          externalId VARCHAR(128) NOT NULL,
          title VARCHAR(512) NOT NULL,
          description TEXT,
          source VARCHAR(16) NOT NULL DEFAULT 'serper',
          viralScore INT NOT NULL DEFAULT 50,
          emotionalAngle VARCHAR(16),
          relevanceWindow VARCHAR(16),
          niches JSON,
          sourceUrl VARCHAR(1000),
          collectedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expiresAt TIMESTAMP NOT NULL,
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_trending_topics_externalId (externalId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      // Add sourceUrl to existing tables (no IF NOT EXISTS — not supported in MySQL 5.7)
      // Fails silently if column already exists (Duplicate column name error) — that's fine
      await db.execute(sql`ALTER TABLE trending_topics ADD COLUMN sourceUrl VARCHAR(1000)`).catch(() => {});
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_topic_angles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          trendingTopicId INT NOT NULL,
          suggestedTitle VARCHAR(512) NOT NULL,
          suggestedHook TEXT NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'sugerido',
          contentRef VARCHAR(255),
          createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_topic_angles_user_topic (userId, trendingTopicId),
          INDEX idx_user_topic_angles_userId (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { _radarTablesReady = null; throw e; });
  }

  await _radarTablesReady;
}

export type RadarTopic = TrendingTopic & { angle: UserTopicAngle | null };

export async function upsertTrendingTopic(data: {
  externalId: string;
  title: string;
  description?: string;
  source?: string;
  sourceUrl?: string;
  expiresAt: Date;
}): Promise<number> {
  await ensureRadarTables();
  const db = await getDb();
  if (!db) return 0;
  await db.execute(sql`
    INSERT INTO trending_topics (externalId, title, description, source, expiresAt)
    VALUES (${data.externalId}, ${data.title}, ${data.description ?? null}, ${data.source ?? "serper"}, ${data.expiresAt})
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      description = VALUES(description),
      expiresAt = VALUES(expiresAt)
  `);
  const rows = await db
    .select({ id: trendingTopics.id })
    .from(trendingTopics)
    .where(eq(trendingTopics.externalId, data.externalId))
    .limit(1);
  const id = rows[0]?.id ?? 0;
  // sourceUrl stored separately — column may not exist yet on first deploy
  if (id && data.sourceUrl) {
    await db.execute(sql`UPDATE trending_topics SET sourceUrl = ${data.sourceUrl} WHERE id = ${id}`).catch(() => {});
  }
  return id;
}

export async function updateTopicClassification(id: number, data: {
  viralScore: number;
  emotionalAngle: string;
  relevanceWindow: string;
  niches: string[];
}): Promise<void> {
  await ensureRadarTables();
  const db = await getDb();
  if (!db) return;
  await db
    .update(trendingTopics)
    .set({
      viralScore: data.viralScore,
      emotionalAngle: data.emotionalAngle,
      relevanceWindow: data.relevanceWindow,
      niches: data.niches,
    })
    .where(eq(trendingTopics.id, id));
}

export async function getPendingTopicsForClassification(): Promise<TrendingTopic[]> {
  await ensureRadarTables();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trendingTopics)
    .where(sql`niches IS NULL AND expiresAt > NOW()`)
    .limit(20);
}

export async function getActiveTopics(): Promise<TrendingTopic[]> {
  await ensureRadarTables();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trendingTopics)
    .where(sql`expiresAt > NOW() AND niches IS NOT NULL`)
    .orderBy(desc(trendingTopics.viralScore))
    .limit(50);
}

export async function getUsersWithNiches(): Promise<Array<{ id: number; nicheId: string | null; subNicheId: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ id: users.id, nicheId: brandKits.nicheId, subNicheId: brandKits.subNicheId })
    .from(users)
    .leftJoin(brandKits, eq(users.id, brandKits.userId))
    .where(sql`users.isActive = 1`);
  return rows;
}

export async function upsertUserTopicAngle(data: {
  userId: number;
  trendingTopicId: number;
  suggestedTitle: string;
  suggestedHook: string;
}): Promise<void> {
  await ensureRadarTables();
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    INSERT INTO user_topic_angles (userId, trendingTopicId, suggestedTitle, suggestedHook)
    VALUES (${data.userId}, ${data.trendingTopicId}, ${data.suggestedTitle}, ${data.suggestedHook})
    ON DUPLICATE KEY UPDATE
      suggestedTitle = VALUES(suggestedTitle),
      suggestedHook = VALUES(suggestedHook),
      updatedAt = CURRENT_TIMESTAMP
  `);
}

export async function getRadarTopicsForUser(userId: number): Promise<(RadarTopic & { sourceUrl: string | null })[]> {
  await ensureRadarTables();
  const db = await getDb();
  if (!db) return [];

  // Try with sourceUrl (may not exist on old DBs before the column was added)
  try {
    const rows = await db
      .select({
        topic: trendingTopics,
        angle: userTopicAngles,
        sourceUrl: sql<string | null>`trending_topics.sourceUrl`,
      })
      .from(trendingTopics)
      .leftJoin(
        userTopicAngles,
        and(eq(userTopicAngles.trendingTopicId, trendingTopics.id), eq(userTopicAngles.userId, userId))
      )
      .where(sql`trending_topics.expiresAt > NOW() AND trending_topics.niches IS NOT NULL`)
      .orderBy(desc(trendingTopics.viralScore))
      .limit(30);
    return rows.map((r) => ({ ...r.topic, angle: r.angle ?? null, sourceUrl: r.sourceUrl ?? null }));
  } catch (err) {
    // sourceUrl column may not exist yet — fall back to query without it
    console.warn("[Radar] getRadarTopicsForUser fallback (sourceUrl column missing?):", (err as Error).message);
    const rows = await db
      .select({ topic: trendingTopics, angle: userTopicAngles })
      .from(trendingTopics)
      .leftJoin(
        userTopicAngles,
        and(eq(userTopicAngles.trendingTopicId, trendingTopics.id), eq(userTopicAngles.userId, userId))
      )
      .where(sql`trending_topics.expiresAt > NOW() AND trending_topics.niches IS NOT NULL`)
      .orderBy(desc(trendingTopics.viralScore))
      .limit(30);
    return rows.map((r) => ({ ...r.topic, angle: r.angle ?? null, sourceUrl: null }));
  }
}

export async function updateUserTopicAngleStatus(userId: number, trendingTopicId: number, status: string): Promise<void> {
  await ensureRadarTables();
  const db = await getDb();
  if (!db) return;
  await db
    .update(userTopicAngles)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(userTopicAngles.userId, userId), eq(userTopicAngles.trendingTopicId, trendingTopicId)));
}

// ─── Post Metrics (Module 1.3) ────────────────────────────────────────────────

async function ensurePostMetricsTable() {
  const db = await getDb();
  if (!db) return;
  if (!_postMetricsTableReady) {
    _postMetricsTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS post_metrics (
          id int AUTO_INCREMENT PRIMARY KEY,
          socialPostId int NOT NULL,
          collectedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          reach int NOT NULL DEFAULT 0,
          saves int NOT NULL DEFAULT 0,
          shares int NOT NULL DEFAULT 0,
          comments int NOT NULL DEFAULT 0,
          likes int NOT NULL DEFAULT 0,
          followsDelta int NOT NULL DEFAULT 0,
          rawScore int NOT NULL DEFAULT 0,
          normalizedScore int NOT NULL DEFAULT 0,
          impressions int NOT NULL DEFAULT 0,
          videoViews int NOT NULL DEFAULT 0,
          avgWatchTimeMs int NOT NULL DEFAULT 0,
          INDEX idx_post_metrics_socialPostId (socialPostId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { _postMetricsTableReady = null; throw e; });
  }
  await _postMetricsTableReady;
  await ensurePostMetricsVideoColumns();
}

async function ensurePostMetricsVideoColumns(): Promise<void> {
  if (!_postMetricsVideoColumnsReady) {
    _postMetricsVideoColumnsReady = (async () => {
      const db = await getDb();
      if (!db) return;
      const [cols] = await db.execute(sql`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post_metrics'
      `);
      const existing = new Set((cols as unknown as Array<{ COLUMN_NAME: string }>).map(c => c.COLUMN_NAME));
      if (!existing.has("impressions")) {
        await db.execute(sql`ALTER TABLE \`post_metrics\` ADD COLUMN \`impressions\` int NOT NULL DEFAULT 0`);
      }
      if (!existing.has("videoViews")) {
        await db.execute(sql`ALTER TABLE \`post_metrics\` ADD COLUMN \`videoViews\` int NOT NULL DEFAULT 0`);
      }
      if (!existing.has("avgWatchTimeMs")) {
        await db.execute(sql`ALTER TABLE \`post_metrics\` ADD COLUMN \`avgWatchTimeMs\` int NOT NULL DEFAULT 0`);
      }
    })().catch((e) => { _postMetricsVideoColumnsReady = null; throw e; });
  }
  await _postMetricsVideoColumnsReady;
}

async function ensureInstagramAccountInsightsDailyTable(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (!_igAccountInsightsTableReady) {
    _igAccountInsightsTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS instagram_account_insights_daily (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          dateKey varchar(10) NOT NULL,
          collectedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          demographics json,
          websiteClicks int NOT NULL DEFAULT 0,
          phoneCallClicks int NOT NULL DEFAULT 0,
          emailContacts int NOT NULL DEFAULT 0,
          textMessageClicks int NOT NULL DEFAULT 0,
          getDirectionsClicks int NOT NULL DEFAULT 0,
          totalInteractions int NOT NULL DEFAULT 0,
          accountsEngaged int NOT NULL DEFAULT 0,
          INDEX idx_ig_account_insights_userId (userId),
          UNIQUE KEY uq_ig_account_insights_user_date (userId, dateKey)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { _igAccountInsightsTableReady = null; throw e; });
  }
  await _igAccountInsightsTableReady;
}

async function ensureTemplatePerformanceTable() {
  const db = await getDb();
  if (!db) return;
  if (!_templatePerformanceTableReady) {
    _templatePerformanceTableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS template_performance (
          id int AUTO_INCREMENT PRIMARY KEY,
          userId int NOT NULL,
          niche varchar(64) NOT NULL,
          templateStyle varchar(100) NOT NULL,
          hookType varchar(32) NOT NULL,
          contentFormat varchar(32) NOT NULL,
          sourceKind varchar(16) NOT NULL,
          avgScore int NOT NULL DEFAULT 0,
          postCount int NOT NULL DEFAULT 0,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_template_perf_userId_niche (userId, niche),
          UNIQUE KEY uq_template_perf_combo (userId, niche, templateStyle, hookType, contentFormat, sourceKind)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { _templatePerformanceTableReady = null; throw e; });
  }
  await _templatePerformanceTableReady;
}

export async function savePostMetric(data: {
  socialPostId: number;
  reach: number;
  saves: number;
  shares: number;
  comments: number;
  likes: number;
  followsDelta: number;
  rawScore: number;
  normalizedScore: number;
  impressions?: number;
  videoViews?: number;
  avgWatchTimeMs?: number;
}): Promise<void> {
  await ensurePostMetricsTable();
  const db = await getDb();
  if (!db) return;
  await db.insert(postMetrics).values({
    socialPostId: data.socialPostId,
    reach: data.reach,
    saves: data.saves,
    shares: data.shares,
    comments: data.comments,
    likes: data.likes,
    followsDelta: data.followsDelta,
    rawScore: data.rawScore,
    normalizedScore: data.normalizedScore,
    impressions: data.impressions ?? 0,
    videoViews: data.videoViews ?? 0,
    avgWatchTimeMs: data.avgWatchTimeMs ?? 0,
  });
}

export async function getLatestMetricForPost(socialPostId: number): Promise<PostMetric | null> {
  await ensurePostMetricsTable();
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(postMetrics)
    .where(eq(postMetrics.socialPostId, socialPostId))
    .orderBy(desc(postMetrics.collectedAt))
    .limit(1);
  return rows[0] ?? null;
}

function todayDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
}

export async function saveInstagramAccountInsightsSnapshot(data: {
  userId: number;
  demographics?: InstagramDemographicsBreakdown;
  websiteClicks: number;
  phoneCallClicks: number;
  emailContacts: number;
  textMessageClicks: number;
  getDirectionsClicks: number;
  totalInteractions: number;
  accountsEngaged: number;
}): Promise<void> {
  await ensureInstagramAccountInsightsDailyTable();
  const db = await getDb();
  if (!db) return;
  const dateKey = todayDateKey();

  const [existing] = await db
    .select()
    .from(instagramAccountInsightsDaily)
    .where(and(eq(instagramAccountInsightsDaily.userId, data.userId), eq(instagramAccountInsightsDaily.dateKey, dateKey)));

  const values = {
    demographics: data.demographics ?? undefined,
    websiteClicks: data.websiteClicks,
    phoneCallClicks: data.phoneCallClicks,
    emailContacts: data.emailContacts,
    textMessageClicks: data.textMessageClicks,
    getDirectionsClicks: data.getDirectionsClicks,
    totalInteractions: data.totalInteractions,
    accountsEngaged: data.accountsEngaged,
  };

  if (existing) {
    await db.update(instagramAccountInsightsDaily)
      .set(values)
      .where(eq(instagramAccountInsightsDaily.id, existing.id));
  } else {
    await db.insert(instagramAccountInsightsDaily).values({
      userId: data.userId,
      dateKey,
      ...values,
    });
  }
}

export async function getLatestInstagramAccountInsights(userId: number): Promise<InstagramAccountInsightsDaily | null> {
  await ensureInstagramAccountInsightsDailyTable();
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(instagramAccountInsightsDaily)
    .where(eq(instagramAccountInsightsDaily.userId, userId))
    .orderBy(desc(instagramAccountInsightsDaily.dateKey))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInstagramAccountInsightsHistory(userId: number, days: number): Promise<InstagramAccountInsightsDaily[]> {
  await ensureInstagramAccountInsightsDailyTable();
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 86400_000);
  const sinceKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(since);
  return db
    .select()
    .from(instagramAccountInsightsDaily)
    .where(and(eq(instagramAccountInsightsDaily.userId, userId), sql`${instagramAccountInsightsDaily.dateKey} >= ${sinceKey}`))
    .orderBy(asc(instagramAccountInsightsDaily.dateKey));
}

export async function getPublishedPostsWithIgMedia(): Promise<Array<{
  id: number;
  userId: number;
  igMediaId: string;
  contentType: string | null;
  style: string | null;
  hookType: string | null;
  contentFormat: string | null;
  sourceTopicAngleId: number | null;
  contentId: number | null;
  publishedAt: Date | null;
}>> {
  await ensurePostMetricsTable();
  await ensureSocialPostsMetadataColumn();
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    SELECT sp.id, sp.userId, sp.igMediaId, sp.contentType, sp.contentId, sp.publishedAt,
           COALESCE(c.style, r.contentFormat, 'unknown') AS style,
           COALESCE(c.hookType, r.hookType, sp.contentType) AS hookType,
           COALESCE(c.contentFormat, r.contentFormat, sp.contentType) AS contentFormat,
           COALESCE(c.sourceTopicAngleId, r.sourceTopicAngleId) AS sourceTopicAngleId
    FROM social_posts sp
    LEFT JOIN carousels c ON sp.contentType = 'carousel' AND c.id = sp.contentId
    LEFT JOIN reels_scripts r ON sp.contentType = 'reels' AND r.id = sp.contentId
    WHERE sp.status = 'published'
      AND sp.igMediaId IS NOT NULL
      AND sp.channel = 'instagram'
    ORDER BY sp.publishedAt DESC
    LIMIT 200
  `);
  return (rows[0] as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    userId: Number(r.userId),
    igMediaId: String(r.igMediaId),
    contentType: r.contentType ? String(r.contentType) : null,
    style: r.style ? String(r.style) : null,
    hookType: r.hookType ? String(r.hookType) : null,
    contentFormat: r.contentFormat ? String(r.contentFormat) : null,
    sourceTopicAngleId: r.sourceTopicAngleId != null ? Number(r.sourceTopicAngleId) : null,
    contentId: r.contentId != null ? Number(r.contentId) : null,
    publishedAt: r.publishedAt ? (r.publishedAt instanceof Date ? r.publishedAt : new Date(String(r.publishedAt))) : null,
  }));
}

export async function upsertTemplatePerformance(data: {
  userId: number;
  niche: string;
  templateStyle: string;
  hookType: string;
  contentFormat: string;
  sourceKind: string;
  avgScore: number;
  postCount: number;
}): Promise<void> {
  await ensureTemplatePerformanceTable();
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    INSERT INTO template_performance (userId, niche, templateStyle, hookType, contentFormat, sourceKind, avgScore, postCount)
    VALUES (${data.userId}, ${data.niche}, ${data.templateStyle}, ${data.hookType}, ${data.contentFormat}, ${data.sourceKind}, ${data.avgScore}, ${data.postCount})
    ON DUPLICATE KEY UPDATE
      avgScore = VALUES(avgScore),
      postCount = VALUES(postCount),
      updatedAt = CURRENT_TIMESTAMP
  `);
}

export async function getTopPerformanceForUser(userId: number, contentFormat?: string): Promise<TemplatePerformance[]> {
  await ensureTemplatePerformanceTable();
  const db = await getDb();
  if (!db) return [];
  const rows = contentFormat
    ? await db.select().from(templatePerformance)
        .where(and(eq(templatePerformance.userId, userId), eq(templatePerformance.contentFormat, contentFormat), sql`postCount >= 3`))
        .orderBy(desc(templatePerformance.avgScore))
        .limit(10)
    : await db.select().from(templatePerformance)
        .where(and(eq(templatePerformance.userId, userId), sql`postCount >= 3`))
        .orderBy(desc(templatePerformance.avgScore))
        .limit(20);
  return rows;
}

export async function getUserNicheForPerformance(userId: number): Promise<string> {
  const kit = await getBrandKit(userId);
  return kit?.nicheId ?? "generic";
}

// ─── Editorial Plan Items (Module 2.1) ───────────────────────────────────────

async function ensureEditorialPlanItemsTable() {
  if (!_editorialPlanItemsTableReady) {
    _editorialPlanItemsTableReady = (async () => {
      const db = await getDb();
      if (!db) return;
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`editorial_plan_items\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`userId\` int NOT NULL,
          \`year\` int NOT NULL,
          \`month\` int NOT NULL,
          \`scheduledDate\` varchar(10) NOT NULL,
          \`format\` varchar(32) NOT NULL,
          \`category\` varchar(255) NOT NULL,
          \`suggestedTitle\` varchar(512) NOT NULL,
          \`pauta\` text NOT NULL,
          \`status\` varchar(16) NOT NULL DEFAULT 'pending',
          \`socialPostId\` int DEFAULT NULL,
          \`contentType\` varchar(20) DEFAULT NULL,
          \`contentId\` int DEFAULT NULL,
          \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`editorial_plan_items_pk\` PRIMARY KEY(\`id\`),
          INDEX \`idx_editorial_plan_userId_month\` (\`userId\`, \`year\`, \`month\`)
        )
      `);
    })().catch((error) => {
      _editorialPlanItemsTableReady = null;
      throw error;
    });
  }
  return _editorialPlanItemsTableReady;
}

export async function getEditorialPlanItems(userId: number, year: number, month: number): Promise<EditorialPlanItem[]> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(editorialPlanItems)
    .where(and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.year, year),
      eq(editorialPlanItems.month, month),
    ))
    .orderBy(asc(editorialPlanItems.scheduledDate));
}

export async function countGeneratedPlanItems(userId: number, year: number, month: number): Promise<number> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return 0;
  const [rows] = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM editorial_plan_items
    WHERE userId = ${userId} AND year = ${year} AND month = ${month}
    AND (status = 'done' OR socialPostId IS NOT NULL OR contentId IS NOT NULL)
  `);
  return Number((rows as unknown as Array<{ cnt: number }>)[0]?.cnt ?? 0);
}

export async function saveEditorialPlanItems(
  userId: number,
  year: number,
  month: number,
  items: Array<Omit<InsertEditorialPlanItem, "userId" | "year" | "month" | "id" | "createdAt" | "updatedAt">>
): Promise<EditorialPlanItem[]> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return [];
  await db.delete(editorialPlanItems).where(
    and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.year, year),
      eq(editorialPlanItems.month, month),
    )
  );
  if (items.length === 0) return [];
  await db.insert(editorialPlanItems).values(
    items.map((item) => ({ ...item, userId, year, month }))
  );
  return getEditorialPlanItems(userId, year, month);
}

export async function updateEditorialPlanItem(
  id: number,
  userId: number,
  data: Partial<Pick<EditorialPlanItem, "status" | "socialPostId" | "contentType" | "contentId" | "scheduledDate">>
): Promise<EditorialPlanItem | null> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return null;
  await db.update(editorialPlanItems)
    .set(data)
    .where(and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId)));
  const [row] = await db.select().from(editorialPlanItems)
    .where(and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId)));
  return row ?? null;
}

export async function getEditorialPlanItemById(id: number, userId: number): Promise<EditorialPlanItem | null> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(editorialPlanItems)
    .where(and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId)));
  return row ?? null;
}

export async function deleteEditorialPlanItems(userId: number, year: number, month: number): Promise<void> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return;
  await db.delete(editorialPlanItems).where(
    and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.year, year),
      eq(editorialPlanItems.month, month),
    )
  );
}

export async function deleteEditorialPlanItemsByDate(userId: number, scheduledDate: string): Promise<void> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return;
  await db.delete(editorialPlanItems).where(
    and(
      eq(editorialPlanItems.userId, userId),
      eq(editorialPlanItems.scheduledDate, scheduledDate),
    )
  );
}

export async function deleteEditorialPlanItem(userId: number, id: number): Promise<void> {
  await ensureEditorialPlanItemsTable();
  const db = await getDb();
  if (!db) return;
  await db.delete(editorialPlanItems).where(
    and(eq(editorialPlanItems.id, id), eq(editorialPlanItems.userId, userId))
  );
}
