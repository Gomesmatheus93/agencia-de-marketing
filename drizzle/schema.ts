import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp as pgTimestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// Todas as datas são gravadas com fuso (timestamptz), lidas como Date em UTC.
const timestamp = (name: string) => pgTimestamp(name, { withTimezone: true });

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  // name e email guardam ciphertext ("enc:v1:...") — ver server/_core/crypto.ts.
  name: text("name"),
  email: text("email"),
  // Blind index (HMAC-SHA256 do e-mail normalizado) para busca sem decifrar.
  emailHash: varchar("emailHash", { length: 64 }),
  // Domínio do e-mail em texto puro — usado pelo match de empresa (companyAccess.ts).
  emailDomain: varchar("emailDomain", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  // Incrementado a cada "sair de todos os dispositivos" / troca de senha / mudança
  // de role — sessões com tokenVersion diferente do atual são rejeitadas.
  tokenVersion: integer("tokenVersion").default(0).notNull(),
  // Verificação de e-mail (null = não verificado). Contas OAuth já entram verificadas.
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  // 2FA por código de e-mail.
  twoFactorEnabled: boolean("twoFactorEnabled").default(false).notNull(),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  plan: text("plan", { enum: ["free", "pro", "agency"] }).default("free").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  trialExpiresAt: timestamp("trialExpiresAt"),
  activeBrandKitId: integer("activeBrandKitId"),
  // null = conta principal (dona da empresa); preenchido = funcionário,
  // aponta pro id da conta principal. Um único nível (sem sub-sub-usuário).
  companyOwnerId: integer("companyOwnerId"),
}, (t) => [
  uniqueIndex("uq_users_emailHash").on(t.emailHash),
  index("idx_users_emailDomain").on(t.emailDomain),
  index("idx_users_companyOwnerId").on(t.companyOwnerId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Email Tokens (verificação de conta, reset de senha, código 2FA) ─────────
export const emailTokens = pgTable(
  "email_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    type: text("type", { enum: ["verify", "reset", "2fa"] }).notNull(),
    // SHA-256 do token cru (o token cru só existe no e-mail / no link).
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    // Tentativas de código erradas (2fa/reset) — para lockout.
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_email_tokens_user_type").on(t.userId, t.type),
    index("idx_email_tokens_hash").on(t.tokenHash),
  ]
);

export type EmailToken = typeof emailTokens.$inferSelect;
export type InsertEmailToken = typeof emailTokens.$inferInsert;

// ─── Audit Log (ações sensíveis) ─────────────────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    // Quem executou a ação (null = sistema / não autenticado).
    actorUserId: integer("actorUserId"),
    // Sobre quem/o quê a ação foi feita.
    targetUserId: integer("targetUserId"),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("targetType", { length: 32 }),
    targetId: varchar("targetId", { length: 64 }),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("userAgent", { length: 255 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_log_actor").on(t.actorUserId),
    index("idx_audit_log_action").on(t.action),
  ]
);

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ─── Daily Usage (trial limits) ───────────────────────────────────────────────
export const dailyUsage = pgTable(
  "daily_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    feature: varchar("feature", { length: 32 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [uniqueIndex("uq_daily_usage").on(t.userId, t.feature, t.date)]
);

export type DailyUsage = typeof dailyUsage.$inferSelect;

// ─── Chat Conversations ───────────────────────────────────────────────────────
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull().default("Nova Conversa"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_chat_conversations_userId").on(t.userId)]
);

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversationId").notNull(),
    userId: integer("userId").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_chat_messages_conversationId_userId").on(t.conversationId, t.userId),
  ]
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// ─── Generated Images ─────────────────────────────────────────────────────────
export const generatedImages = pgTable(
  "generated_images",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    prompt: text("prompt").notNull(),
    imageUrl: text("imageUrl").notNull(),
    fileKey: varchar("fileKey", { length: 512 }),
    width: integer("width").default(1024),
    height: integer("height").default(1024),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_generated_images_userId").on(t.userId)]
);

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = typeof generatedImages.$inferInsert;

// ─── Articles ─────────────────────────────────────────────────────────────────
export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    topic: text("topic"),
    sourceUrl: text("sourceUrl"),
    coverImageUrl: text("coverImageUrl"),
    content: text("content").notNull(),
    summary: text("summary"),
    status: text("status", { enum: ["draft", "published", "archived"] }).default("draft").notNull(),
    sourceTopicAngleId: integer("sourceTopicAngleId"),
    hookType: varchar("hookType", { length: 32 }),
    contentFormat: varchar("contentFormat", { length: 32 }).default("article"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_articles_userId").on(t.userId)]
);

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

export type CarouselSlideData = {
  title: string;
  body: string;
  imageUrl?: string;
  profileId?: string;
  // Agent-generated metadata (stored in JSON, no DB migration required)
  slideType?: "hook" | "development" | "cta";
  shortText?: string;
  imagePrompt?: string;
  backgroundPrompt?: string;
  visualDirection?: string;
  layoutNotes?: string;
  highlightWords?: string[];
  wordStyles?: { word: string; color?: string; bold?: boolean; italic?: boolean }[];
  editableFields?: {
    title: boolean;
    text: boolean;
    image: boolean;
    background: boolean;
    cta: boolean;
  };
  // Design/template fields
  designTemplateName?: string;
  designTemplateUrl?: string;
  designStyleBrief?: string;
  templateSvgUrl?: string;
  renderedImageUrl?: string;
  fontFamily?: string;
  accentColor?: string;
  backgroundColor?: string;
  titleColor?: string;
  bodyColor?: string;
  editorSettings?: {
    titleOffsetX?: number;
    titleOffsetY?: number;
    titleScale?: number;
    bodyOffsetX?: number;
    bodyOffsetY?: number;
    bodyScale?: number;
    imageOffsetX?: number;
    imageOffsetY?: number;
    imageScale?: number;
    imageRotation?: number;
    imageBrightness?: number;
    imageContrast?: number;
    imageSaturate?: number;
    titleColor?: string;
    bodyColor?: string;
  };
};

// ─── Carousels ────────────────────────────────────────────────────────────────
export const carousels = pgTable(
  "carousels",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    topic: varchar("topic", { length: 512 }).notNull(),
    style: varchar("style", { length: 100 }).notNull(),
    hook: text("hook").notNull(),
    caption: text("caption").notNull(),
    finalCta: text("finalCta").notNull(),
    coverImageUrl: text("coverImageUrl"),
    slides: text("slides").notNull(),
    designSettings: text("designSettings"),
    sourceTopicAngleId: integer("sourceTopicAngleId"),
    hookType: varchar("hookType", { length: 32 }),
    contentFormat: varchar("contentFormat", { length: 32 }).default("carousel"),
    templateId: integer("templateId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_carousels_userId").on(t.userId)]
);

type CarouselRow = typeof carousels.$inferSelect;
type InsertCarouselRow = typeof carousels.$inferInsert;

export type Carousel = Omit<CarouselRow, "slides"> & {
  slides: CarouselSlideData[];
};

export type InsertCarousel = Omit<InsertCarouselRow, "slides"> & {
  slides: CarouselSlideData[];
};

// ─── Social Posts ─────────────────────────────────────────────────────────────
export const carouselTemplates = pgTable(
  "carousel_templates",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    imageUrl: text("imageUrl").notNull(),
    styleBrief: text("styleBrief"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_carousel_templates_userId").on(t.userId)]
);

export type CarouselTemplate = typeof carouselTemplates.$inferSelect;
export type InsertCarouselTemplate = typeof carouselTemplates.$inferInsert;

export const avatarVideos = pgTable(
  "avatar_videos",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    provider: varchar("provider", { length: 32 }).notNull().default("d-id"),
    title: varchar("title", { length: 512 }).notNull(),
    topic: text("topic"),
    script: text("script").notNull(),
    sourceImageUrl: text("sourceImageUrl").notNull(),
    videoUrl: text("videoUrl"),
    voiceProvider: varchar("voiceProvider", { length: 64 }),
    voiceId: varchar("voiceId", { length: 128 }),
    providerJobId: varchar("providerJobId", { length: 255 }),
    status: text("status", { enum: ["processing", "completed", "failed"] })
      .default("processing")
      .notNull(),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_avatar_videos_userId").on(t.userId)]
);

export type AvatarVideo = typeof avatarVideos.$inferSelect;
export type InsertAvatarVideo = typeof avatarVideos.$inferInsert;

export const socialPosts = pgTable(
  "social_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    channel: text("channel", { enum: ["instagram", "linkedin", "newsletter"] }).notNull(),
    title: varchar("title", { length: 512 }),
    content: text("content").notNull(),
    imageUrl: text("imageUrl"),
    metadata: text("metadata"),
    scheduledAt: timestamp("scheduledAt"),
    publishedAt: timestamp("publishedAt"),
    status: text("status", { enum: ["draft", "pending_approval", "scheduled", "published", "failed", "rejected"] }).default("draft").notNull(),
    errorMessage: text("errorMessage"),
    igMediaId: varchar("igMediaId", { length: 100 }),
    contentType: varchar("contentType", { length: 20 }),
    contentId: integer("contentId"),
    storyData: text("storyData"),
    retryCount: integer("retryCount").default(0).notNull(),
    approvalToken: varchar("approvalToken", { length: 64 }),
    approvalExpiresAt: timestamp("approvalExpiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("idx_social_posts_userId").on(t.userId),
    index("idx_social_posts_scheduled").on(t.channel, t.status, t.scheduledAt),
  ]
);

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

// ─── Instagram Connections ────────────────────────────────────────────────────
export const instagramConnections = pgTable(
  "instagram_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().unique(),
    instagramAccountId: varchar("instagramAccountId", { length: 64 }).notNull(),
    facebookPageId: varchar("facebookPageId", { length: 64 }),
    username: varchar("username", { length: 64 }),
    name: varchar("name", { length: 255 }),
    profilePictureUrl: text("profilePictureUrl"),
    accessToken: text("accessToken").notNull(),
    // Long-lived user token used by the Marketing API. Kept separate from the
    // Page token above, which is required by Instagram publishing.
    userAccessToken: text("userAccessToken"),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    // "facebook" = token via Facebook Login (needs graph.facebook.com)
    // "instagram" = token via Instagram Login (needs graph.instagram.com)
    tokenSource: varchar("tokenSource", { length: 16 }).default("facebook"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_instagram_connections_userId").on(t.userId)]
);

export type InstagramConnection = typeof instagramConnections.$inferSelect;
export type InsertInstagramConnection = typeof instagramConnections.$inferInsert;

// ─── Canva Connections ────────────────────────────────────────────────────────
export const canvaConnections = pgTable(
  "canva_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().unique(),
    canvaUserId: varchar("canvaUserId", { length: 128 }).notNull(),
    displayName: varchar("displayName", { length: 255 }),
    email: varchar("email", { length: 320 }),
    profilePictureUrl: text("profilePictureUrl"),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_canva_connections_userId").on(t.userId)]
);

export type CanvaConnection = typeof canvaConnections.$inferSelect;
export type InsertCanvaConnection = typeof canvaConnections.$inferInsert;

// ─── LinkedIn Connections ───────────────────────────────────────────────────────
export const linkedinConnections = pgTable(
  "linkedin_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().unique(),
    linkedinMemberId: varchar("linkedinMemberId", { length: 128 }).notNull(),
    authorUrn: varchar("authorUrn", { length: 160 }).notNull(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 320 }),
    profilePictureUrl: text("profilePictureUrl"),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_linkedin_connections_userId").on(t.userId)]
);

export type LinkedInConnection = typeof linkedinConnections.$inferSelect;
export type InsertLinkedInConnection = typeof linkedinConnections.$inferInsert;

// ─── HeyGen Digital Twin (video-trained avatar, full-body natural motion) ─────
export const heygenDigitalTwins = pgTable(
  "heygen_digital_twins",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().unique(),
    avatarId: varchar("avatarId", { length: 128 }),
    groupId: varchar("groupId", { length: 128 }).notNull(),
    name: varchar("name", { length: 255 }),
    // pending_consent | training | ready | failed
    status: varchar("status", { length: 32 }).notNull().default("pending_consent"),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_heygen_digital_twins_userId").on(t.userId)]
);

export type HeygenDigitalTwin = typeof heygenDigitalTwins.$inferSelect;
export type InsertHeygenDigitalTwin = typeof heygenDigitalTwins.$inferInsert;

// ─── Google Search Console Connections ─────────────────────────────────────────
export const searchConsoleConnections = pgTable(
  "search_console_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().unique(),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    // Site the user picked to report on (e.g. "https://example.com/" or "sc-domain:example.com")
    selectedSiteUrl: varchar("selectedSiteUrl", { length: 512 }),
    // JSON array of every verified site the connected Google account can access
    availableSites: text("availableSites"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_search_console_connections_userId").on(t.userId)]
);

export type SearchConsoleConnection = typeof searchConsoleConnections.$inferSelect;
export type InsertSearchConsoleConnection = typeof searchConsoleConnections.$inferInsert;

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

// ─── Niche Profiles ───────────────────────────────────────────────────────────
export const nicheProfiles = pgTable("niche_profiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  parentId: varchar("parentId", { length: 64 }),
  label: varchar("label", { length: 128 }).notNull(),
  version: integer("version").notNull().default(1),
  subNiches: json("subNiches"),
  visualGrammar: json("visualGrammar"),
  copyTone: json("copyTone"),
  referenceImageTags: json("referenceImageTags"),
  carouselPatterns: json("carouselPatterns"),
  keywords: json("keywords"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type NicheProfile = typeof nicheProfiles.$inferSelect;

// ─── Brand Kits ───────────────────────────────────────────────────────────────
export const brandKits = pgTable("brand_kits", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }),
  tagline: varchar("tagline", { length: 512 }),
  logoUrl: text("logoUrl"),
  industry: varchar("industry", { length: 128 }),
  targetAudience: text("targetAudience"),
  brandValues: text("brandValues"),
  valueProposition: text("valueProposition"),
  productsServices: text("productsServices"),
  differentiators: text("differentiators"),
  brandPromise: text("brandPromise"),
  defaultCta: varchar("defaultCta", { length: 512 }),
  toneOfVoice: varchar("toneOfVoice", { length: 64 }).default("professional"),
  headingFont: varchar("headingFont", { length: 128 }).default("Montserrat"),
  bodyFont: varchar("bodyFont", { length: 128 }).default("Inter"),
  preferredWords: json("preferredWords").$type<string[]>(),
  forbiddenWords: json("forbiddenWords").$type<string[]>(),
  personas: json("personas").$type<Array<{ name: string; profile: string; pains: string; goals: string; objections: string }>>(),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#6366f1"),
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#8b5cf6"),
  accentColor: varchar("accentColor", { length: 7 }).default("#06b6d4"),
  instagramHandle: varchar("instagramHandle", { length: 128 }),
  linkedinUrl: varchar("linkedinUrl", { length: 255 }),
  nicheId: varchar("nicheId", { length: 64 }),
  subNicheId: varchar("subNicheId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type BrandKit = typeof brandKits.$inferSelect;
export type InsertBrandKit = typeof brandKits.$inferInsert;

// ─── Comment Automations (Comment-to-DM) ─────────────────────────────────────
export const commentAutomations = pgTable(
  "comment_automations",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    igAccountId: varchar("igAccountId", { length: 64 }).notNull(),
    igPostId: varchar("igPostId", { length: 64 }).notNull(),
    postCaption: text("postCaption"),
    postThumbnailUrl: text("postThumbnailUrl"),
    keywords: json("keywords").$type<string[]>().notNull(),
    publicReplyMessage: text("publicReplyMessage").notNull(),
    dmFirstMessage: text("dmFirstMessage").notNull(),
    dmFollowupMessage: text("dmFollowupMessage"),
    dmLink: text("dmLink"),
    status: varchar("status", { length: 16 }).default("active").notNull(),
    commentsMatchedCount: integer("commentsMatchedCount").default(0).notNull(),
    dmsSentCount: integer("dmsSentCount").default(0).notNull(),
    linkClicksCount: integer("linkClicksCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_comment_automations_userId").on(t.userId)]
);

export type CommentAutomation = typeof commentAutomations.$inferSelect;
export type InsertCommentAutomation = typeof commentAutomations.$inferInsert;

// ─── Radar de Temas (Module 1.1) ─────────────────────────────────────────────
export const trendingTopics = pgTable(
  "trending_topics",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("externalId", { length: 128 }).notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    description: text("description"),
    source: varchar("source", { length: 16 }).default("serper").notNull(),
    viralScore: integer("viralScore").default(50).notNull(),
    emotionalAngle: varchar("emotionalAngle", { length: 16 }),
    relevanceWindow: varchar("relevanceWindow", { length: 16 }),
    niches: json("niches").$type<string[]>(),
    sourceUrl: varchar("sourceUrl", { length: 1000 }),
    collectedAt: timestamp("collectedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_trending_topics_externalId").on(t.externalId)]
);

export type TrendingTopic = typeof trendingTopics.$inferSelect;
export type InsertTrendingTopic = typeof trendingTopics.$inferInsert;

export const userTopicAngles = pgTable(
  "user_topic_angles",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    trendingTopicId: integer("trendingTopicId").notNull(),
    suggestedTitle: varchar("suggestedTitle", { length: 512 }).notNull(),
    suggestedHook: text("suggestedHook").notNull(),
    status: varchar("status", { length: 16 }).default("sugerido").notNull(),
    contentRef: varchar("contentRef", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex("uq_user_topic_angles_user_topic").on(t.userId, t.trendingTopicId),
    index("idx_user_topic_angles_userId").on(t.userId),
  ]
);

export type UserTopicAngle = typeof userTopicAngles.$inferSelect;
export type InsertUserTopicAngle = typeof userTopicAngles.$inferInsert;

// ─── Post Metrics (Module 1.3) ────────────────────────────────────────────────
export const postMetrics = pgTable(
  "post_metrics",
  {
    id: serial("id").primaryKey(),
    socialPostId: integer("socialPostId").notNull(),
    collectedAt: timestamp("collectedAt").defaultNow().notNull(),
    reach: integer("reach").default(0).notNull(),
    saves: integer("saves").default(0).notNull(),
    shares: integer("shares").default(0).notNull(),
    comments: integer("comments").default(0).notNull(),
    likes: integer("likes").default(0).notNull(),
    followsDelta: integer("followsDelta").default(0).notNull(),
    rawScore: integer("rawScore").default(0).notNull(),
    normalizedScore: integer("normalizedScore").default(0).notNull(),
    impressions: integer("impressions").default(0).notNull(),
    videoViews: integer("videoViews").default(0).notNull(),
    avgWatchTimeMs: integer("avgWatchTimeMs").default(0).notNull(),
  },
  (t) => [index("idx_post_metrics_socialPostId").on(t.socialPostId)]
);

export type PostMetric = typeof postMetrics.$inferSelect;
export type InsertPostMetric = typeof postMetrics.$inferInsert;

// ─── Instagram Account Insights Daily (Analytics — demographics & profile actions) ────
export type InstagramDemographicsBreakdown = {
  genderAge?: Array<{ dimension: string; value: number }>;
  city?: Array<{ dimension: string; value: number }>;
  country?: Array<{ dimension: string; value: number }>;
};

export const instagramAccountInsightsDaily = pgTable(
  "instagram_account_insights_daily",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    dateKey: varchar("dateKey", { length: 10 }).notNull(),
    collectedAt: timestamp("collectedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
    demographics: json("demographics").$type<InstagramDemographicsBreakdown>(),
    websiteClicks: integer("websiteClicks").default(0).notNull(),
    phoneCallClicks: integer("phoneCallClicks").default(0).notNull(),
    emailContacts: integer("emailContacts").default(0).notNull(),
    textMessageClicks: integer("textMessageClicks").default(0).notNull(),
    getDirectionsClicks: integer("getDirectionsClicks").default(0).notNull(),
    totalInteractions: integer("totalInteractions").default(0).notNull(),
    accountsEngaged: integer("accountsEngaged").default(0).notNull(),
  },
  (t) => [
    uniqueIndex("uq_ig_account_insights_user_date").on(t.userId, t.dateKey),
    index("idx_ig_account_insights_userId").on(t.userId),
  ]
);

export type InstagramAccountInsightsDaily = typeof instagramAccountInsightsDaily.$inferSelect;
export type InsertInstagramAccountInsightsDaily = typeof instagramAccountInsightsDaily.$inferInsert;

// ─── Template Performance (Module 1.3) ───────────────────────────────────────
export const templatePerformance = pgTable(
  "template_performance",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    niche: varchar("niche", { length: 64 }).notNull(),
    templateStyle: varchar("templateStyle", { length: 100 }).notNull(),
    hookType: varchar("hookType", { length: 32 }).notNull(),
    contentFormat: varchar("contentFormat", { length: 32 }).notNull(),
    sourceKind: varchar("sourceKind", { length: 16 }).notNull(),
    avgScore: integer("avgScore").default(0).notNull(),
    postCount: integer("postCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("idx_template_perf_userId_niche").on(t.userId, t.niche),
    uniqueIndex("uq_template_perf_combo").on(
      t.userId, t.niche, t.templateStyle, t.hookType, t.contentFormat, t.sourceKind
    ),
  ]
);

export type TemplatePerformance = typeof templatePerformance.$inferSelect;
export type InsertTemplatePerformance = typeof templatePerformance.$inferInsert;

// ─── Editorial Plan Items (Module 2.1) ───────────────────────────────────────
export const editorialPlanItems = pgTable(
  "editorial_plan_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    scheduledDate: varchar("scheduledDate", { length: 10 }).notNull(),
    format: varchar("format", { length: 32 }).notNull(),
    category: varchar("category", { length: 255 }).notNull(),
    suggestedTitle: varchar("suggestedTitle", { length: 512 }).notNull(),
    pauta: text("pauta").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    socialPostId: integer("socialPostId"),
    contentType: varchar("contentType", { length: 20 }),
    contentId: integer("contentId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("idx_editorial_plan_userId_month").on(t.userId, t.year, t.month),
  ]
);

export type EditorialPlanItem = typeof editorialPlanItems.$inferSelect;
export type InsertEditorialPlanItem = typeof editorialPlanItems.$inferInsert;

// ─── Companies (multi-tenant domain gating for the "Artes" tab) ──────────────
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export const companyDomains = pgTable(
  "company_domains",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    domain: varchar("domain", { length: 255 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_company_domains_companyId").on(t.companyId)]
);

export type CompanyDomain = typeof companyDomains.$inferSelect;
export type InsertCompanyDomain = typeof companyDomains.$inferInsert;

// ─── Art Templates (ready-made artwork, editable by company users) ───────────
export const artTemplates = pgTable(
  "art_templates",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId"), // null = global, visible to every company
    name: varchar("name", { length: 255 }).notNull(),
    imageUrl: text("imageUrl").notNull(),
    thumbnailUrl: text("thumbnailUrl"),
    canvasJson: json("canvasJson").$type<Record<string, unknown>>(),
    width: integer("width").notNull().default(1080),
    height: integer("height").notNull().default(1350),
    createdByUserId: integer("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_art_templates_companyId").on(t.companyId)]
);

export type ArtTemplate = typeof artTemplates.$inferSelect;
export type InsertArtTemplate = typeof artTemplates.$inferInsert;

export const artworks = pgTable(
  "artworks",
  {
    id: serial("id").primaryKey(),
    templateId: integer("templateId").notNull(),
    userId: integer("userId").notNull(),
    canvasJson: json("canvasJson").$type<Record<string, unknown>>().notNull(),
    imageUrl: text("imageUrl").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("idx_artworks_userId").on(t.userId),
    index("idx_artworks_templateId").on(t.templateId),
  ]
);

export type Artwork = typeof artworks.$inferSelect;
export type InsertArtwork = typeof artworks.$inferInsert;

// ─── Content Approvals (link de aprovação pra cliente final) ─────────────────
export const contentApprovals = pgTable(
  "content_approvals",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 64 }).notNull().unique(),
    userId: integer("userId").notNull(),
    contentType: text("contentType", { enum: ["article", "carousel"] }).notNull(),
    contentId: integer("contentId").notNull(),
    clientName: varchar("clientName", { length: 255 }),
    status: text("status", { enum: ["pending", "approved", "changes_requested"] }).default("pending").notNull(),
    clientComment: text("clientComment"),
    respondedAt: timestamp("respondedAt"),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_content_approvals_userId").on(t.userId),
    index("idx_content_approvals_content").on(t.contentType, t.contentId),
  ]
);

export type ContentApproval = typeof contentApprovals.$inferSelect;
export type InsertContentApproval = typeof contentApprovals.$inferInsert;

// ─── Marketing Campaign Hub ──────────────────────────────────────────────────
export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    clientName: varchar("clientName", { length: 255 }),
    objective: varchar("objective", { length: 500 }),
    audience: text("audience"),
    offer: text("offer"),
    description: text("description"),
    channels: json("channels").$type<string[]>().notNull(),
    status: text("status", { enum: ["draft", "planning", "production", "approval", "active", "completed", "archived"] }).default("draft").notNull(),
    budgetCents: integer("budgetCents").default(0).notNull(),
    spentCents: integer("spentCents").default(0).notNull(),
    revenueCents: integer("revenueCents").default(0).notNull(),
    startDate: timestamp("startDate"),
    endDate: timestamp("endDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_marketing_campaigns_user_status").on(t.userId, t.status)]
);

export const campaignAssets = pgTable(
  "campaign_assets",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaignId").notNull(),
    userId: integer("userId").notNull(),
    assetType: text("assetType", { enum: ["article", "carousel", "post", "image", "reel", "story", "ad", "report"] }).notNull(),
    assetId: integer("assetId"),
    externalId: varchar("externalId", { length: 255 }),
    label: varchar("label", { length: 500 }),
    status: text("status", { enum: ["draft", "ready", "pending_approval", "approved", "published", "failed"] }).default("draft").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index("idx_campaign_assets_campaign").on(t.campaignId),
    index("idx_campaign_assets_user").on(t.userId),
  ]
);

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = typeof marketingCampaigns.$inferInsert;
export type CampaignAsset = typeof campaignAssets.$inferSelect;
export type InsertCampaignAsset = typeof campaignAssets.$inferInsert;

// ─── Reels Scripts ────────────────────────────────────────────────────────────
export const reelsScripts = pgTable(
  "reels_scripts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    topic: text("topic").notNull(),
    tone: varchar("tone", { length: 64 }).notNull().default("educational"),
    duration: varchar("duration", { length: 32 }).notNull().default("medium"),
    hook: text("hook").notNull(),
    reward: text("reward").notNull(),
    loopClose: text("loopClose").notNull(),
    caption: text("caption").notNull(),
    hashtags: text("hashtags").notNull(),
    scenes: text("scenes").notNull(),
    sourceTopicAngleId: integer("sourceTopicAngleId"),
    hookType: varchar("hookType", { length: 32 }),
    contentFormat: varchar("contentFormat", { length: 32 }).default("reels"),
    status: text("status", { enum: ["draft", "published"] }).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_reels_scripts_userId").on(t.userId)]
);

// ─── Comment Monitoring (polling de novos comentários + alertas) ─────────────
export const commentPollState = pgTable(
  "comment_poll_state",
  {
    userId: integer("userId").notNull(),
    mediaId: varchar("mediaId", { length: 100 }).notNull(),
    lastKnownCount: integer("lastKnownCount").notNull().default(0),
    lastCheckedAt: timestamp("lastCheckedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mediaId] })]
);

export const commentAlerts = pgTable(
  "comment_alerts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    mediaId: varchar("mediaId", { length: 100 }).notNull(),
    mediaCaption: text("mediaCaption"),
    mediaPermalink: text("mediaPermalink"),
    previousCount: integer("previousCount").notNull().default(0),
    newCount: integer("newCount").notNull().default(0),
    detectedAt: timestamp("detectedAt").defaultNow().notNull(),
    whatsappSentAt: timestamp("whatsappSentAt"),
    acknowledgedAt: timestamp("acknowledgedAt"),
  },
  (t) => [index("idx_comment_alerts_user_ack").on(t.userId, t.acknowledgedAt)]
);

// ─── WhatsApp News Digest ────────────────────────────────────────────────────
export const deliveredNews = pgTable(
  "delivered_news",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").notNull(),
    url_key: varchar("url_key", { length: 500 }).notNull(),
    title: varchar("title", { length: 500 }),
    delivered_at: timestamp("delivered_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_delivered_news_user_url").on(t.user_id, t.url_key),
    index("idx_delivered_news_user_delivered").on(t.user_id, t.delivered_at),
  ]
);

export const userDigestSettings = pgTable("user_digest_settings", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().unique(),
  whatsapp_number: varchar("whatsapp_number", { length: 20 }).notNull(),
  digest_hour: smallint("digest_hour").notNull().default(6),
  digest_minute: smallint("digest_minute").notNull().default(50),
  enabled: boolean("enabled").notNull().default(true),
  last_sent_date: varchar("last_sent_date", { length: 12 }),
  template_name: varchar("template_name", { length: 100 }).notNull().default("envio_de_noticias_diario"),
  template_language: varchar("template_language", { length: 20 }).notNull().default("pt_BR"),
  reply_webhook_url: varchar("reply_webhook_url", { length: 500 }),
  created_at: timestamp("created_at").defaultNow(),
});

export const whatsappDigestSessions = pgTable(
  "whatsapp_digest_sessions",
  {
    id: serial("id").primaryKey(),
    campaign_id: varchar("campaign_id", { length: 36 }).notNull(),
    user_id: integer("user_id").notNull(),
    phone_number: varchar("phone_number", { length: 20 }).notNull(),
    news_items: text("news_items").notNull(),
    message_text: text("message_text"),
    sent_at: timestamp("sent_at").notNull(),
    expires_at: timestamp("expires_at").notNull(),
    user_response: varchar("user_response", { length: 5 }),
    chosen_index: smallint("chosen_index"),
    responded_at: timestamp("responded_at"),
  },
  (t) => [
    index("idx_whatsapp_digest_phone_expires").on(t.phone_number, t.expires_at),
    index("idx_whatsapp_digest_campaign").on(t.campaign_id),
  ]
);

// ─── Style Profiles (análise de estilo de perfis do Instagram) ───────────────
export const styleProfiles = pgTable(
  "style_profiles",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").notNull(),
    profile_handle: varchar("profile_handle", { length: 100 }).notNull(),
    profile_name: varchar("profile_name", { length: 255 }),
    profile_picture_url: text("profile_picture_url"),
    source: varchar("source", { length: 20 }).notNull().default("scrape"),
    analysis_json: text("analysis_json").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_style_profiles_user_created").on(t.user_id, t.created_at)]
);

// ─── Agentes internos (server/agents) ─────────────────────────────────────────
// Cada conversa com um agente é uma thread; as mensagens guardam os blocos de
// conteúdo da API do Claude exatamente como vieram (histórico só cresce).
export const agentThreads = pgTable(
  "agent_threads",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    agentSlug: varchar("agentSlug", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    status: text("status", { enum: ["idle", "running", "failed"] }).default("idle").notNull(),
    lastError: text("lastError"),
    // "task": rodada disparada por uma tela (auditoria, planejamento…), que
    // termina com um resultado estruturado em `result` (ver server/agents/tasks.ts).
    mode: text("mode", { enum: ["chat", "task"] }).default("chat").notNull(),
    taskInput: json("taskInput").$type<Record<string, unknown>>(),
    result: json("result").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("idx_agent_threads_user_agent").on(t.userId, t.agentSlug)]
);

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: serial("id").primaryKey(),
    threadId: integer("threadId").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: json("content").$type<unknown[]>().notNull(),
    // Só nas respostas finais de um turno: o que o usuário decidiu sobre a entrega.
    approval: text("approval", { enum: ["pending", "approved", "rejected"] }),
    usage: json("usage").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_agent_messages_thread").on(t.threadId)]
);

// Memória compartilhada dos agentes (voice.md, swipe.md, log.md, plan.md…),
// equivalente ao ~/.claude/instagram/ das skills originais.
export const agentFiles = pgTable(
  "agent_files",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    path: varchar("path", { length: 128 }).notNull(),
    content: text("content").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex("uq_agent_files_user_path").on(t.userId, t.path)]
);

export type AgentThread = typeof agentThreads.$inferSelect;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type AgentFile = typeof agentFiles.$inferSelect;
