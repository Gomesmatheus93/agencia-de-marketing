CREATE TABLE "art_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer,
	"name" varchar(255) NOT NULL,
	"imageUrl" text NOT NULL,
	"thumbnailUrl" text,
	"canvasJson" json,
	"width" integer DEFAULT 1080 NOT NULL,
	"height" integer DEFAULT 1350 NOT NULL,
	"createdByUserId" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(512) NOT NULL,
	"topic" text,
	"sourceUrl" text,
	"coverImageUrl" text,
	"content" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"sourceTopicAngleId" integer,
	"hookType" varchar(32),
	"contentFormat" varchar(32) DEFAULT 'article',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" serial PRIMARY KEY NOT NULL,
	"templateId" integer NOT NULL,
	"userId" integer NOT NULL,
	"canvasJson" json NOT NULL,
	"imageUrl" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorUserId" integer,
	"targetUserId" integer,
	"action" varchar(64) NOT NULL,
	"targetType" varchar(32),
	"targetId" varchar(64),
	"ip" varchar(64),
	"userAgent" varchar(255),
	"metadata" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "avatar_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"provider" varchar(32) DEFAULT 'd-id' NOT NULL,
	"title" varchar(512) NOT NULL,
	"topic" text,
	"script" text NOT NULL,
	"sourceImageUrl" text NOT NULL,
	"videoUrl" text,
	"voiceProvider" varchar(64),
	"voiceId" varchar(128),
	"providerJobId" varchar(255),
	"status" text DEFAULT 'processing' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_kits" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"companyName" varchar(255),
	"tagline" varchar(512),
	"logoUrl" text,
	"industry" varchar(128),
	"targetAudience" text,
	"brandValues" text,
	"valueProposition" text,
	"productsServices" text,
	"differentiators" text,
	"brandPromise" text,
	"defaultCta" varchar(512),
	"toneOfVoice" varchar(64) DEFAULT 'professional',
	"headingFont" varchar(128) DEFAULT 'Montserrat',
	"bodyFont" varchar(128) DEFAULT 'Inter',
	"preferredWords" json,
	"forbiddenWords" json,
	"personas" json,
	"primaryColor" varchar(7) DEFAULT '#6366f1',
	"secondaryColor" varchar(7) DEFAULT '#8b5cf6',
	"accentColor" varchar(7) DEFAULT '#06b6d4',
	"instagramHandle" varchar(128),
	"linkedinUrl" varchar(255),
	"nicheId" varchar(64),
	"subNicheId" varchar(64),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"userId" integer NOT NULL,
	"assetType" text NOT NULL,
	"assetId" integer,
	"externalId" varchar(255),
	"label" varchar(500),
	"status" text DEFAULT 'draft' NOT NULL,
	"metadata" json,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canva_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"canvaUserId" varchar(128) NOT NULL,
	"displayName" varchar(255),
	"email" varchar(320),
	"profilePictureUrl" text,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"tokenExpiresAt" timestamp with time zone,
	"connectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canva_connections_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "carousel_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"imageUrl" text NOT NULL,
	"styleBrief" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carousels" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"topic" varchar(512) NOT NULL,
	"style" varchar(100) NOT NULL,
	"hook" text NOT NULL,
	"caption" text NOT NULL,
	"finalCta" text NOT NULL,
	"coverImageUrl" text,
	"slides" text NOT NULL,
	"designSettings" text,
	"sourceTopicAngleId" integer,
	"hookType" varchar(32),
	"contentFormat" varchar(32) DEFAULT 'carousel',
	"templateId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(255) DEFAULT 'Nova Conversa' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"mediaId" varchar(100) NOT NULL,
	"mediaCaption" text,
	"mediaPermalink" text,
	"previousCount" integer DEFAULT 0 NOT NULL,
	"newCount" integer DEFAULT 0 NOT NULL,
	"detectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"whatsappSentAt" timestamp with time zone,
	"acknowledgedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "comment_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"igAccountId" varchar(64) NOT NULL,
	"igPostId" varchar(64) NOT NULL,
	"postCaption" text,
	"postThumbnailUrl" text,
	"keywords" json NOT NULL,
	"publicReplyMessage" text NOT NULL,
	"dmFirstMessage" text NOT NULL,
	"dmFollowupMessage" text,
	"dmLink" text,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"commentsMatchedCount" integer DEFAULT 0 NOT NULL,
	"dmsSentCount" integer DEFAULT 0 NOT NULL,
	"linkClicksCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_poll_state" (
	"userId" integer NOT NULL,
	"mediaId" varchar(100) NOT NULL,
	"lastKnownCount" integer DEFAULT 0 NOT NULL,
	"lastCheckedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_poll_state_userId_mediaId_pk" PRIMARY KEY("userId","mediaId")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"companyId" integer NOT NULL,
	"domain" varchar(255) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "content_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"userId" integer NOT NULL,
	"contentType" text NOT NULL,
	"contentId" integer NOT NULL,
	"clientName" varchar(255),
	"status" text DEFAULT 'pending' NOT NULL,
	"clientComment" text,
	"respondedAt" timestamp with time zone,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_approvals_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "daily_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"feature" varchar(32) NOT NULL,
	"date" varchar(10) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivered_news" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"url_key" varchar(500) NOT NULL,
	"title" varchar(500),
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_plan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"scheduledDate" varchar(10) NOT NULL,
	"format" varchar(32) NOT NULL,
	"category" varchar(255) NOT NULL,
	"suggestedTitle" varchar(512) NOT NULL,
	"pauta" text NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"socialPostId" integer,
	"contentType" varchar(20),
	"contentId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" text NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(128) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "generated_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"prompt" text NOT NULL,
	"imageUrl" text NOT NULL,
	"fileKey" varchar(512),
	"width" integer DEFAULT 1024,
	"height" integer DEFAULT 1024,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heygen_digital_twins" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"avatarId" varchar(128),
	"groupId" varchar(128) NOT NULL,
	"name" varchar(255),
	"status" varchar(32) DEFAULT 'pending_consent' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "heygen_digital_twins_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "instagram_account_insights_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"dateKey" varchar(10) NOT NULL,
	"collectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"demographics" json,
	"websiteClicks" integer DEFAULT 0 NOT NULL,
	"phoneCallClicks" integer DEFAULT 0 NOT NULL,
	"emailContacts" integer DEFAULT 0 NOT NULL,
	"textMessageClicks" integer DEFAULT 0 NOT NULL,
	"getDirectionsClicks" integer DEFAULT 0 NOT NULL,
	"totalInteractions" integer DEFAULT 0 NOT NULL,
	"accountsEngaged" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"instagramAccountId" varchar(64) NOT NULL,
	"facebookPageId" varchar(64),
	"username" varchar(64),
	"name" varchar(255),
	"profilePictureUrl" text,
	"accessToken" text NOT NULL,
	"userAccessToken" text,
	"tokenExpiresAt" timestamp with time zone,
	"tokenSource" varchar(16) DEFAULT 'facebook',
	"connectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_connections_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "linkedin_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"linkedinMemberId" varchar(128) NOT NULL,
	"authorUrn" varchar(160) NOT NULL,
	"name" varchar(255),
	"email" varchar(320),
	"profilePictureUrl" text,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"tokenExpiresAt" timestamp with time zone,
	"connectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "linkedin_connections_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"clientName" varchar(255),
	"objective" varchar(500),
	"audience" text,
	"offer" text,
	"description" text,
	"channels" json NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"budgetCents" integer DEFAULT 0 NOT NULL,
	"spentCents" integer DEFAULT 0 NOT NULL,
	"revenueCents" integer DEFAULT 0 NOT NULL,
	"startDate" timestamp with time zone,
	"endDate" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niche_profiles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"parentId" varchar(64),
	"label" varchar(128) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"subNiches" json,
	"visualGrammar" json,
	"copyTone" json,
	"referenceImageTags" json,
	"carouselPatterns" json,
	"keywords" json,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"socialPostId" integer NOT NULL,
	"collectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"followsDelta" integer DEFAULT 0 NOT NULL,
	"rawScore" integer DEFAULT 0 NOT NULL,
	"normalizedScore" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"videoViews" integer DEFAULT 0 NOT NULL,
	"avgWatchTimeMs" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reels_scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(512) NOT NULL,
	"topic" text NOT NULL,
	"tone" varchar(64) DEFAULT 'educational' NOT NULL,
	"duration" varchar(32) DEFAULT 'medium' NOT NULL,
	"hook" text NOT NULL,
	"reward" text NOT NULL,
	"loopClose" text NOT NULL,
	"caption" text NOT NULL,
	"hashtags" text NOT NULL,
	"scenes" text NOT NULL,
	"sourceTopicAngleId" integer,
	"hookType" varchar(32),
	"contentFormat" varchar(32) DEFAULT 'reels',
	"status" text DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_console_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"accessToken" text NOT NULL,
	"refreshToken" text,
	"tokenExpiresAt" timestamp with time zone,
	"selectedSiteUrl" varchar(512),
	"availableSites" text,
	"connectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_console_connections_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"channel" text NOT NULL,
	"title" varchar(512),
	"content" text NOT NULL,
	"imageUrl" text,
	"metadata" text,
	"scheduledAt" timestamp with time zone,
	"publishedAt" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"errorMessage" text,
	"igMediaId" varchar(100),
	"contentType" varchar(20),
	"contentId" integer,
	"storyData" text,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"approvalToken" varchar(64),
	"approvalExpiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "style_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"profile_handle" varchar(100) NOT NULL,
	"profile_name" varchar(255),
	"profile_picture_url" text,
	"source" varchar(20) DEFAULT 'scrape' NOT NULL,
	"analysis_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"niche" varchar(64) NOT NULL,
	"templateStyle" varchar(100) NOT NULL,
	"hookType" varchar(32) NOT NULL,
	"contentFormat" varchar(32) NOT NULL,
	"sourceKind" varchar(16) NOT NULL,
	"avgScore" integer DEFAULT 0 NOT NULL,
	"postCount" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trending_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"externalId" varchar(128) NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text,
	"source" varchar(16) DEFAULT 'serper' NOT NULL,
	"viralScore" integer DEFAULT 50 NOT NULL,
	"emotionalAngle" varchar(16),
	"relevanceWindow" varchar(16),
	"niches" json,
	"sourceUrl" varchar(1000),
	"collectedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_digest_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"whatsapp_number" varchar(20) NOT NULL,
	"digest_hour" smallint DEFAULT 6 NOT NULL,
	"digest_minute" smallint DEFAULT 50 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent_date" varchar(12),
	"template_name" varchar(100) DEFAULT 'envio_de_noticias_diario' NOT NULL,
	"template_language" varchar(20) DEFAULT 'pt_BR' NOT NULL,
	"reply_webhook_url" varchar(500),
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_digest_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_topic_angles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"trendingTopicId" integer NOT NULL,
	"suggestedTitle" varchar(512) NOT NULL,
	"suggestedHook" text NOT NULL,
	"status" varchar(16) DEFAULT 'sugerido' NOT NULL,
	"contentRef" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" text,
	"emailHash" varchar(64),
	"emailDomain" varchar(255),
	"loginMethod" varchar(64),
	"passwordHash" text,
	"tokenVersion" integer DEFAULT 0 NOT NULL,
	"emailVerifiedAt" timestamp with time zone,
	"twoFactorEnabled" boolean DEFAULT false NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	"trialExpiresAt" timestamp with time zone,
	"activeBrandKitId" integer,
	"companyOwnerId" integer,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_digest_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" varchar(36) NOT NULL,
	"user_id" integer NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"news_items" text NOT NULL,
	"message_text" text,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_response" varchar(5),
	"chosen_index" smallint,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_art_templates_companyId" ON "art_templates" USING btree ("companyId");--> statement-breakpoint
CREATE INDEX "idx_articles_userId" ON "articles" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_artworks_userId" ON "artworks" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_artworks_templateId" ON "artworks" USING btree ("templateId");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor" ON "audit_log" USING btree ("actorUserId");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_avatar_videos_userId" ON "avatar_videos" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_campaign_assets_campaign" ON "campaign_assets" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "idx_campaign_assets_user" ON "campaign_assets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_canva_connections_userId" ON "canva_connections" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_carousel_templates_userId" ON "carousel_templates" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_carousels_userId" ON "carousels" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_chat_conversations_userId" ON "chat_conversations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_conversationId_userId" ON "chat_messages" USING btree ("conversationId","userId");--> statement-breakpoint
CREATE INDEX "idx_comment_alerts_user_ack" ON "comment_alerts" USING btree ("userId","acknowledgedAt");--> statement-breakpoint
CREATE INDEX "idx_comment_automations_userId" ON "comment_automations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_company_domains_companyId" ON "company_domains" USING btree ("companyId");--> statement-breakpoint
CREATE INDEX "idx_content_approvals_userId" ON "content_approvals" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_content_approvals_content" ON "content_approvals" USING btree ("contentType","contentId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_usage" ON "daily_usage" USING btree ("userId","feature","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_delivered_news_user_url" ON "delivered_news" USING btree ("user_id","url_key");--> statement-breakpoint
CREATE INDEX "idx_delivered_news_user_delivered" ON "delivered_news" USING btree ("user_id","delivered_at");--> statement-breakpoint
CREATE INDEX "idx_editorial_plan_userId_month" ON "editorial_plan_items" USING btree ("userId","year","month");--> statement-breakpoint
CREATE INDEX "idx_email_tokens_user_type" ON "email_tokens" USING btree ("userId","type");--> statement-breakpoint
CREATE INDEX "idx_email_tokens_hash" ON "email_tokens" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "idx_generated_images_userId" ON "generated_images" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_heygen_digital_twins_userId" ON "heygen_digital_twins" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ig_account_insights_user_date" ON "instagram_account_insights_daily" USING btree ("userId","dateKey");--> statement-breakpoint
CREATE INDEX "idx_ig_account_insights_userId" ON "instagram_account_insights_daily" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_instagram_connections_userId" ON "instagram_connections" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_linkedin_connections_userId" ON "linkedin_connections" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_marketing_campaigns_user_status" ON "marketing_campaigns" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "idx_post_metrics_socialPostId" ON "post_metrics" USING btree ("socialPostId");--> statement-breakpoint
CREATE INDEX "idx_reels_scripts_userId" ON "reels_scripts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_search_console_connections_userId" ON "search_console_connections" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_social_posts_userId" ON "social_posts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_social_posts_scheduled" ON "social_posts" USING btree ("channel","status","scheduledAt");--> statement-breakpoint
CREATE INDEX "idx_style_profiles_user_created" ON "style_profiles" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_template_perf_userId_niche" ON "template_performance" USING btree ("userId","niche");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_template_perf_combo" ON "template_performance" USING btree ("userId","niche","templateStyle","hookType","contentFormat","sourceKind");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trending_topics_externalId" ON "trending_topics" USING btree ("externalId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_topic_angles_user_topic" ON "user_topic_angles" USING btree ("userId","trendingTopicId");--> statement-breakpoint
CREATE INDEX "idx_user_topic_angles_userId" ON "user_topic_angles" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_emailHash" ON "users" USING btree ("emailHash");--> statement-breakpoint
CREATE INDEX "idx_users_emailDomain" ON "users" USING btree ("emailDomain");--> statement-breakpoint
CREATE INDEX "idx_users_companyOwnerId" ON "users" USING btree ("companyOwnerId");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_digest_phone_expires" ON "whatsapp_digest_sessions" USING btree ("phone_number","expires_at");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_digest_campaign" ON "whatsapp_digest_sessions" USING btree ("campaign_id");