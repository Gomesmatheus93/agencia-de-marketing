export const ENV = {
  appId: process.env.VITE_APP_ID ?? "ai-marketing-agency",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Segurança — criptografia de campos em repouso e hash de senha.
  // Gerar 32 bytes: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  blindIndexKey: process.env.BLIND_INDEX_KEY ?? "",
  passwordPepper: process.env.PASSWORD_PEPPER ?? "",
  // Envio de e-mail (verificação, recuperação de senha, códigos 2FA) via webhook do n8n.
  n8nEmailWebhookUrl: process.env.N8N_EMAIL_WEBHOOK_URL ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "KrythosLab <no-reply@krythoslab.com>",
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
  // Google Custom Search JSON API — free tier: 100 image searches/day
  // Setup: console.cloud.google.com → Enable "Custom Search JSON API" → Create key
  //        programmablesearchengine.google.com → Create engine → Enable "Image Search"
  googleCseKey: process.env.GOOGLE_CSE_KEY ?? "",
  googleCseCx: process.env.GOOGLE_CSE_CX ?? "",
  falApiKey: process.env.FAL_KEY ?? "",
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
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID ?? "",
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  // Must exactly match the Redirect URL already whitelisted in the LinkedIn Developer app.
  linkedinRedirectUri: process.env.LINKEDIN_REDIRECT_URI ?? "",
  // WhatsApp Cloud API (Meta) — aprovação de conteúdo
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  whatsappRecipientNumber: process.env.WHATSAPP_RECIPIENT_NUMBER ?? "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "",
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? "",
  // Shared secret for n8n → KrythosLab server-to-server calls
  n8nSecret: process.env.N8N_SECRET ?? "",
  // ScraperAPI — usado para buscar posts de perfis externos do Instagram via proxy residencial
  // Cadastro gratuito: https://www.scraperapi.com (1000 req/mês grátis)
  scraperApiKey: process.env.SCRAPERAPI_KEY ?? "",
  // Google Search Console (OAuth) — API gratuita, dados reais de SEO (cliques, impressões, posição)
  // Setup: console.cloud.google.com → criar OAuth client (Web application) → habilitar
  //        "Google Search Console API" → adicionar redirect URI abaixo aos "Authorized redirect URIs"
  googleGscClientId: process.env.GOOGLE_GSC_CLIENT_ID ?? "",
  googleGscClientSecret: process.env.GOOGLE_GSC_CLIENT_SECRET ?? "",
  googleGscRedirectUri: process.env.GOOGLE_GSC_REDIRECT_URI ?? "",
};

const REQUIRED_VARS: Array<{ key: keyof typeof process.env; label: string }> = [
  { key: "DATABASE_URL", label: "DATABASE_URL" },
  { key: "JWT_SECRET", label: "JWT_SECRET" },
  { key: "OPENAI_API_KEY", label: "OPENAI_API_KEY" },
  { key: "ENCRYPTION_KEY", label: "ENCRYPTION_KEY" },
  { key: "BLIND_INDEX_KEY", label: "BLIND_INDEX_KEY" },
];

export function validateRequiredEnv(): void {
  const missing = REQUIRED_VARS.filter(({ key }) => !process.env[key]).map(({ label }) => label);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}\n` +
        "Copie o arquivo .env.example para .env e preencha os valores.\n" +
        'Gere ENCRYPTION_KEY/BLIND_INDEX_KEY com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  if (!process.env.PASSWORD_PEPPER) {
    console.warn("[env] PASSWORD_PEPPER não configurada — senhas serão hasheadas sem pepper.");
  }
  if (!process.env.RESEND_API_KEY && !process.env.N8N_EMAIL_WEBHOOK_URL) {
    console.warn("[env] RESEND_API_KEY/N8N_EMAIL_WEBHOOK_URL não configurados — e-mails serão apenas logados no console.");
  }
}
