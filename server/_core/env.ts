export const ENV = {
  appId: process.env.VITE_APP_ID ?? "ai-marketing-agency",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  hfToken: process.env.HF_TOKEN ?? "",
  n8nChatWebhookUrl: process.env.N8N_CHAT_WEBHOOK_URL ?? "",
  n8nImageWebhookUrl: process.env.N8N_IMAGE_WEBHOOK_URL ?? "",
  n8nArticleWebhookUrl: process.env.N8N_ARTICLE_WEBHOOK_URL ?? "",
  n8nPostWebhookUrl: process.env.N8N_POST_WEBHOOK_URL ?? "",
};
