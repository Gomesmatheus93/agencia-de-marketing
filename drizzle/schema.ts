import {
  boolean,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["free", "pro", "agency"]).default("free").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  trialExpiresAt: timestamp("trialExpiresAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Daily Usage (trial limits) ───────────────────────────────────────────────
export const dailyUsage = mysqlTable(
  "daily_usage",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    feature: varchar("feature", { length: 32 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    count: int("count").notNull().default(0),
  },
  (t) => [index("idx_daily_usage_uid_feat_date").on(t.userId, t.feature, t.date)]
);

export type DailyUsage = typeof dailyUsage.$inferSelect;

// ─── Chat Conversations ───────────────────────────────────────────────────────
export const chatConversations = mysqlTable(
  "chat_conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull().default("Nova Conversa"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_chat_conversations_userId").on(t.userId)]
);

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = mysqlTable(
  "chat_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: int("conversationId").notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
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
export const generatedImages = mysqlTable(
  "generated_images",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    prompt: text("prompt").notNull(),
    imageUrl: text("imageUrl").notNull(),
    fileKey: varchar("fileKey", { length: 512 }),
    width: int("width").default(1024),
    height: int("height").default(1024),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_generated_images_userId").on(t.userId)]
);

export type GeneratedImage = typeof generatedImages.$inferSelect;
export type InsertGeneratedImage = typeof generatedImages.$inferInsert;

// ─── Articles ─────────────────────────────────────────────────────────────────
export const articles = mysqlTable(
  "articles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    topic: mediumtext("topic"),
    sourceUrl: text("sourceUrl"),
    coverImageUrl: text("coverImageUrl"),
    content: mediumtext("content").notNull(),
    summary: mediumtext("summary"),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    sourceTopicAngleId: int("sourceTopicAngleId"),
    hookType: varchar("hookType", { length: 32 }),
    contentFormat: varchar("contentFormat", { length: 32 }).default("article"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export const carousels = mysqlTable(
  "carousels",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    topic: varchar("topic", { length: 512 }).notNull(),
    style: varchar("style", { length: 100 }).notNull(),
    hook: text("hook").notNull(),
    caption: text("caption").notNull(),
    finalCta: text("finalCta").notNull(),
    coverImageUrl: text("coverImageUrl"),
    slides: text("slides").notNull(),
    designSettings: text("designSettings"),
    sourceTopicAngleId: int("sourceTopicAngleId"),
    hookType: varchar("hookType", { length: 32 }),
    contentFormat: varchar("contentFormat", { length: 32 }).default("carousel"),
    templateId: int("templateId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export const carouselTemplates = mysqlTable(
  "carousel_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    imageUrl: text("imageUrl").notNull(),
    styleBrief: text("styleBrief"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_carousel_templates_userId").on(t.userId)]
);

export type CarouselTemplate = typeof carouselTemplates.$inferSelect;
export type InsertCarouselTemplate = typeof carouselTemplates.$inferInsert;

export const avatarVideos = mysqlTable(
  "avatar_videos",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    provider: varchar("provider", { length: 32 }).notNull().default("d-id"),
    title: varchar("title", { length: 512 }).notNull(),
    topic: text("topic"),
    script: text("script").notNull(),
    sourceImageUrl: text("sourceImageUrl").notNull(),
    videoUrl: text("videoUrl"),
    voiceProvider: varchar("voiceProvider", { length: 64 }),
    voiceId: varchar("voiceId", { length: 128 }),
    providerJobId: varchar("providerJobId", { length: 255 }),
    status: mysqlEnum("status", ["processing", "completed", "failed"])
      .default("processing")
      .notNull(),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_avatar_videos_userId").on(t.userId)]
);

export type AvatarVideo = typeof avatarVideos.$inferSelect;
export type InsertAvatarVideo = typeof avatarVideos.$inferInsert;

export const socialPosts = mysqlTable(
  "social_posts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    channel: mysqlEnum("channel", ["instagram", "linkedin", "newsletter"]).notNull(),
    title: varchar("title", { length: 512 }),
    content: text("content").notNull(),
    imageUrl: text("imageUrl"),
    metadata: text("metadata"),
    scheduledAt: timestamp("scheduledAt"),
    publishedAt: timestamp("publishedAt"),
    status: mysqlEnum("status", ["draft", "pending_approval", "scheduled", "published", "failed", "rejected"]).default("draft").notNull(),
    errorMessage: text("errorMessage"),
    igMediaId: varchar("igMediaId", { length: 100 }),
    contentType: varchar("contentType", { length: 20 }),
    contentId: int("contentId"),
    storyData: text("storyData"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_social_posts_userId").on(t.userId),
    index("idx_social_posts_scheduled").on(t.channel, t.status, t.scheduledAt),
  ]
);

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

// ─── Instagram Connections ────────────────────────────────────────────────────
export const instagramConnections = mysqlTable(
  "instagram_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    instagramAccountId: varchar("instagramAccountId", { length: 64 }).notNull(),
    facebookPageId: varchar("facebookPageId", { length: 64 }),
    username: varchar("username", { length: 64 }),
    name: varchar("name", { length: 255 }),
    profilePictureUrl: text("profilePictureUrl"),
    accessToken: text("accessToken").notNull(),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    // "facebook" = token via Facebook Login (needs graph.facebook.com)
    // "instagram" = token via Instagram Login (needs graph.instagram.com)
    tokenSource: varchar("tokenSource", { length: 16 }).default("facebook"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_instagram_connections_userId").on(t.userId)]
);

export type InstagramConnection = typeof instagramConnections.$inferSelect;
export type InsertInstagramConnection = typeof instagramConnections.$inferInsert;

// ─── Canva Connections ────────────────────────────────────────────────────────
export const canvaConnections = mysqlTable(
  "canva_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    canvaUserId: varchar("canvaUserId", { length: 128 }).notNull(),
    displayName: varchar("displayName", { length: 255 }),
    email: varchar("email", { length: 320 }),
    profilePictureUrl: text("profilePictureUrl"),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_canva_connections_userId").on(t.userId)]
);

export type CanvaConnection = typeof canvaConnections.$inferSelect;
export type InsertCanvaConnection = typeof canvaConnections.$inferInsert;

// ─── LinkedIn Connections ───────────────────────────────────────────────────────
export const linkedinConnections = mysqlTable(
  "linkedin_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    linkedinMemberId: varchar("linkedinMemberId", { length: 128 }).notNull(),
    authorUrn: varchar("authorUrn", { length: 160 }).notNull(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 320 }),
    profilePictureUrl: text("profilePictureUrl"),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_linkedin_connections_userId").on(t.userId)]
);

export type LinkedInConnection = typeof linkedinConnections.$inferSelect;
export type InsertLinkedInConnection = typeof linkedinConnections.$inferInsert;

// ─── Google Search Console Connections ─────────────────────────────────────────
export const searchConsoleConnections = mysqlTable(
  "search_console_connections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique(),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken"),
    tokenExpiresAt: timestamp("tokenExpiresAt"),
    // Site the user picked to report on (e.g. "https://example.com/" or "sc-domain:example.com")
    selectedSiteUrl: varchar("selectedSiteUrl", { length: 512 }),
    // JSON array of every verified site the connected Google account can access
    availableSites: mediumtext("availableSites"),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_search_console_connections_userId").on(t.userId)]
);

export type SearchConsoleConnection = typeof searchConsoleConnections.$inferSelect;
export type InsertSearchConsoleConnection = typeof searchConsoleConnections.$inferInsert;

// ─── Feature Flags ────────────────────────────────────────────────────────────
export const featureFlags = mysqlTable("feature_flags", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  label: varchar("label", { length: 255 }).notNull(),
  description: text("description"),
  enabled: boolean("enabled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

// ─── Niche Profiles ───────────────────────────────────────────────────────────
export const nicheProfiles = mysqlTable("niche_profiles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  parentId: varchar("parentId", { length: 64 }),
  label: varchar("label", { length: 128 }).notNull(),
  version: int("version").notNull().default(1),
  subNiches: json("subNiches"),
  visualGrammar: json("visualGrammar"),
  copyTone: json("copyTone"),
  referenceImageTags: json("referenceImageTags"),
  carouselPatterns: json("carouselPatterns"),
  keywords: json("keywords"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NicheProfile = typeof nicheProfiles.$inferSelect;

// ─── Brand Kits ───────────────────────────────────────────────────────────────
export const brandKits = mysqlTable("brand_kits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  companyName: varchar("companyName", { length: 255 }),
  tagline: varchar("tagline", { length: 512 }),
  logoUrl: text("logoUrl"),
  industry: varchar("industry", { length: 128 }),
  targetAudience: text("targetAudience"),
  brandValues: text("brandValues"),
  toneOfVoice: varchar("toneOfVoice", { length: 64 }).default("professional"),
  primaryColor: varchar("primaryColor", { length: 7 }).default("#6366f1"),
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#8b5cf6"),
  accentColor: varchar("accentColor", { length: 7 }).default("#06b6d4"),
  instagramHandle: varchar("instagramHandle", { length: 128 }),
  linkedinUrl: varchar("linkedinUrl", { length: 255 }),
  nicheId: varchar("nicheId", { length: 64 }),
  subNicheId: varchar("subNicheId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BrandKit = typeof brandKits.$inferSelect;
export type InsertBrandKit = typeof brandKits.$inferInsert;

// ─── Comment Automations (Comment-to-DM) ─────────────────────────────────────
export const commentAutomations = mysqlTable(
  "comment_automations",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
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
    commentsMatchedCount: int("commentsMatchedCount").default(0).notNull(),
    dmsSentCount: int("dmsSentCount").default(0).notNull(),
    linkClicksCount: int("linkClicksCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_comment_automations_userId").on(t.userId)]
);

export type CommentAutomation = typeof commentAutomations.$inferSelect;
export type InsertCommentAutomation = typeof commentAutomations.$inferInsert;

// ─── Radar de Temas (Module 1.1) ─────────────────────────────────────────────
export const trendingTopics = mysqlTable(
  "trending_topics",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 128 }).notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    description: text("description"),
    source: varchar("source", { length: 16 }).default("serper").notNull(),
    viralScore: int("viralScore").default(50).notNull(),
    emotionalAngle: varchar("emotionalAngle", { length: 16 }),
    relevanceWindow: varchar("relevanceWindow", { length: 16 }),
    niches: json("niches").$type<string[]>(),
    collectedAt: timestamp("collectedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_trending_topics_externalId").on(t.externalId)]
);

export type TrendingTopic = typeof trendingTopics.$inferSelect;
export type InsertTrendingTopic = typeof trendingTopics.$inferInsert;

export const userTopicAngles = mysqlTable(
  "user_topic_angles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    trendingTopicId: int("trendingTopicId").notNull(),
    suggestedTitle: varchar("suggestedTitle", { length: 512 }).notNull(),
    suggestedHook: text("suggestedHook").notNull(),
    status: varchar("status", { length: 16 }).default("sugerido").notNull(),
    contentRef: varchar("contentRef", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_user_topic_angles_user_topic").on(t.userId, t.trendingTopicId),
    index("idx_user_topic_angles_userId").on(t.userId),
  ]
);

export type UserTopicAngle = typeof userTopicAngles.$inferSelect;
export type InsertUserTopicAngle = typeof userTopicAngles.$inferInsert;

// ─── Post Metrics (Module 1.3) ────────────────────────────────────────────────
export const postMetrics = mysqlTable(
  "post_metrics",
  {
    id: int("id").autoincrement().primaryKey(),
    socialPostId: int("socialPostId").notNull(),
    collectedAt: timestamp("collectedAt").defaultNow().notNull(),
    reach: int("reach").default(0).notNull(),
    saves: int("saves").default(0).notNull(),
    shares: int("shares").default(0).notNull(),
    comments: int("comments").default(0).notNull(),
    likes: int("likes").default(0).notNull(),
    followsDelta: int("followsDelta").default(0).notNull(),
    rawScore: int("rawScore").default(0).notNull(),
    normalizedScore: int("normalizedScore").default(0).notNull(),
    impressions: int("impressions").default(0).notNull(),
    videoViews: int("videoViews").default(0).notNull(),
    avgWatchTimeMs: int("avgWatchTimeMs").default(0).notNull(),
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

export const instagramAccountInsightsDaily = mysqlTable(
  "instagram_account_insights_daily",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    dateKey: varchar("dateKey", { length: 10 }).notNull(),
    collectedAt: timestamp("collectedAt").defaultNow().onUpdateNow().notNull(),
    demographics: json("demographics").$type<InstagramDemographicsBreakdown>(),
    websiteClicks: int("websiteClicks").default(0).notNull(),
    phoneCallClicks: int("phoneCallClicks").default(0).notNull(),
    emailContacts: int("emailContacts").default(0).notNull(),
    textMessageClicks: int("textMessageClicks").default(0).notNull(),
    getDirectionsClicks: int("getDirectionsClicks").default(0).notNull(),
    totalInteractions: int("totalInteractions").default(0).notNull(),
    accountsEngaged: int("accountsEngaged").default(0).notNull(),
  },
  (t) => [
    uniqueIndex("uq_ig_account_insights_user_date").on(t.userId, t.dateKey),
    index("idx_ig_account_insights_userId").on(t.userId),
  ]
);

export type InstagramAccountInsightsDaily = typeof instagramAccountInsightsDaily.$inferSelect;
export type InsertInstagramAccountInsightsDaily = typeof instagramAccountInsightsDaily.$inferInsert;

// ─── Template Performance (Module 1.3) ───────────────────────────────────────
export const templatePerformance = mysqlTable(
  "template_performance",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    niche: varchar("niche", { length: 64 }).notNull(),
    templateStyle: varchar("templateStyle", { length: 100 }).notNull(),
    hookType: varchar("hookType", { length: 32 }).notNull(),
    contentFormat: varchar("contentFormat", { length: 32 }).notNull(),
    sourceKind: varchar("sourceKind", { length: 16 }).notNull(),
    avgScore: int("avgScore").default(0).notNull(),
    postCount: int("postCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export const editorialPlanItems = mysqlTable(
  "editorial_plan_items",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    year: int("year").notNull(),
    month: int("month").notNull(),
    scheduledDate: varchar("scheduledDate", { length: 10 }).notNull(),
    format: varchar("format", { length: 32 }).notNull(),
    category: varchar("category", { length: 255 }).notNull(),
    suggestedTitle: varchar("suggestedTitle", { length: 512 }).notNull(),
    pauta: text("pauta").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    socialPostId: int("socialPostId"),
    contentType: varchar("contentType", { length: 20 }),
    contentId: int("contentId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_editorial_plan_userId_month").on(t.userId, t.year, t.month),
  ]
);

export type EditorialPlanItem = typeof editorialPlanItems.$inferSelect;
export type InsertEditorialPlanItem = typeof editorialPlanItems.$inferInsert;
