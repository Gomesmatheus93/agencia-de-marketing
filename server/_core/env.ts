export const ENV = {
  appId: process.env.VITE_APP_ID ?? "ai-marketing-agency",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiApiBaseUrl: process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
  openaiRealtimeModel: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
  openaiRealtimeVoice: process.env.OPENAI_REALTIME_VOICE ?? "marin",
  openaiRealtimeTokenTtlSeconds: Number(process.env.OPENAI_REALTIME_TOKEN_TTL_SECONDS ?? 600),
  didApiKey: process.env.DID_API_KEY ?? "",
  didApiBaseUrl: process.env.DID_API_BASE_URL ?? "https://api.d-id.com",
  didDefaultVoiceProvider: process.env.DID_DEFAULT_VOICE_PROVIDER ?? "microsoft",
  didDefaultVoiceId: process.env.DID_DEFAULT_VOICE_ID ?? "pt-BR-FranciscaNeural",
  publicStorageProvider: (process.env.PUBLIC_STORAGE_PROVIDER ?? "forge").toLowerCase(),
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  catboxApiUrl: process.env.CATBOX_API_URL ?? "https://catbox.moe/user/api.php",
  catboxUserHash: process.env.CATBOX_USERHASH ?? process.env.CATBOX_USER_HASH ?? "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  awsRegion: process.env.AWS_REGION ?? "",
  awsBucket: process.env.AWS_BUCKET ?? "",
  awsPublicBaseUrl:
    process.env.AWS_PUBLIC_BASE_URL ??
    process.env.AWS_S3_PUBLIC_BASE_URL ??
    process.env.S3_PUBLIC_BASE_URL ??
    "",
  hfToken: process.env.HF_TOKEN ?? "",
  heyGenApiKey: process.env.HEYGEN_API_KEY ?? "",
  unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY ?? "",
  pexelsApiKey: process.env.PEXELS_API_KEY ?? "",
  pixabayApiKey: process.env.PIXABAY_API_KEY ?? "",
  serperApiKey: process.env.SERPER_API_KEY ?? "",
  metaGraphApiBaseUrl: process.env.META_GRAPH_API_BASE_URL ?? "https://graph.facebook.com",
  metaGraphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v25.0",
  metaAppId: process.env.META_APP_ID ?? "",
  metaAppSecret: process.env.META_APP_SECRET ?? "",
  metaAccessToken: process.env.META_ACCESS_TOKEN ?? "",
  metaInstagramAccountId: process.env.META_INSTAGRAM_ACCOUNT_ID ?? "",
  metaFacebookPageId: process.env.META_FACEBOOK_PAGE_ID ?? "",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  canvaClientId: process.env.CANVA_CLIENT_ID ?? "",
  canvaClientSecret: process.env.CANVA_CLIENT_SECRET ?? "",
  postSchedulerTimeZone: process.env.POST_SCHEDULER_TIME_ZONE ?? "America/Fortaleza",
  instagramOAuthRedirectUri: process.env.REDIRECT_URI ?? "",
  instagramConnectRedirectUri: process.env.INSTAGRAM_CONNECT_REDIRECT_URI ?? "",
  instagramLoginCallbackUri: process.env.INSTAGRAM_LOGIN_CALLBACK_URI ?? "",
  instagramBusinessAppId: process.env.INSTAGRAM_BUSINESS_APP_ID ?? "",
  linkedinApiBaseUrl: process.env.LINKEDIN_API_BASE_URL ?? "https://api.linkedin.com/rest",
  linkedinApiVersion: process.env.LINKEDIN_API_VERSION ?? "202601",
  linkedinAccessToken: process.env.LINKEDIN_ACCESS_TOKEN ?? "",
  linkedinAuthorUrn: process.env.LINKEDIN_AUTHOR_URN ?? "",
  // WhatsApp Cloud API (Meta) — aprovação de conteúdo
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappRecipientNumber: process.env.WHATSAPP_RECIPIENT_NUMBER ?? "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "krythos-webhook-verify",
  // Shared secret for n8n → KrythosLab server-to-server calls
  n8nSecret: process.env.N8N_SECRET ?? "",
};

const REQUIRED_VARS: Array<{ key: keyof typeof process.env; label: string }> = [
  { key: "DATABASE_URL", label: "DATABASE_URL" },
  { key: "JWT_SECRET", label: "JWT_SECRET" },
  { key: "OPENAI_API_KEY", label: "OPENAI_API_KEY" },
];

export function validateRequiredEnv(): void {
  const missing = REQUIRED_VARS.filter(({ key }) => !process.env[key]).map(({ label }) => label);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}\n` +
        "Copie o arquivo .env.example para .env e preencha os valores."
    );
  }
}
