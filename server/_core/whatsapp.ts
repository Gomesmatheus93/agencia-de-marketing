import { ENV } from "./env";

const WA_API_BASE = "https://graph.facebook.com/v20.0";

interface WaSendResult {
  messageId?: string;
  error?: string;
}

interface MetaErrorBody {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_data?: { details?: string; messaging_product?: string };
  fbtrace_id?: string;
}

interface MetaApiResponse {
  messages?: Array<{ id: string }>;
  contacts?: Array<{ input: string; wa_id: string }>;
  error?: MetaErrorBody;
  data?: unknown;
}

export function isWhatsAppConfigured(): boolean {
  return !!(ENV.whatsappPhoneNumberId && ENV.whatsappAccessToken && ENV.whatsappRecipientNumber);
}

async function metaGet(path: string): Promise<MetaApiResponse> {
  const res = await fetch(`${WA_API_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${ENV.whatsappAccessToken}` },
  });
  return res.json() as Promise<MetaApiResponse>;
}

async function callWaApi(endpoint: string, body: object): Promise<WaSendResult> {
  const res = await fetch(`${WA_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.whatsappAccessToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as MetaApiResponse;
  console.log(`[WhatsApp API] ${res.status} → to=${(body as Record<string, unknown>).to}`, JSON.stringify(json));

  if (!res.ok) {
    const e = json.error;
    const detail = e?.error_data?.details ? ` (${e.error_data.details})` : "";
    const errMsg = `[${e?.code ?? res.status}] ${e?.message ?? `HTTP ${res.status}`}${detail}`;
    console.error(`[WhatsApp API] ERRO: ${errMsg} | fbtrace_id=${e?.fbtrace_id}`);
    return { error: errMsg };
  }

  const msgId = json.messages?.[0]?.id;
  const waId = json.contacts?.[0]?.wa_id;
  console.log(`[WhatsApp API] Aceito. messageId=${msgId} wa_id=${waId}`);
  return { messageId: msgId };
}

export async function sendWhatsAppText(to: string, text: string): Promise<WaSendResult> {
  if (!isWhatsAppConfigured()) return { error: "WhatsApp não configurado." };
  return callWaApi(`${ENV.whatsappPhoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  });
}

async function sendImageMessage(to: string, imageUrl: string, caption: string): Promise<WaSendResult> {
  return callWaApi(`${ENV.whatsappPhoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: imageUrl, caption },
  });
}

export interface ApprovalMessageData {
  postId: number;
  channel: string;
  content: string;
  imageUrl?: string | null;
  scheduledAt?: Date | null;
  approveUrl: string;
  rejectUrl: string;
}

export async function sendApprovalMessage(data: ApprovalMessageData): Promise<WaSendResult> {
  if (!isWhatsAppConfigured()) {
    return { error: "WhatsApp não configurado. Defina WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN e WHATSAPP_RECIPIENT_NUMBER no .env" };
  }

  const to = ENV.whatsappRecipientNumber;
  const channelLabel = data.channel === "instagram" ? "Instagram" : data.channel === "linkedin" ? "LinkedIn" : "Newsletter";
  const dateLabel = data.scheduledAt
    ? data.scheduledAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" })
    : "Sem data definida";
  const contentPreview = data.content.length > 300 ? data.content.slice(0, 300) + "…" : data.content;
  const text =
    `*Novo post aguardando aprovação*\n\n` +
    `Canal: ${channelLabel}\n` +
    `Data: ${dateLabel}\n\n` +
    `*Legenda:*\n${contentPreview}\n\n` +
    `✅ Aprovar: ${data.approveUrl}\n` +
    `❌ Rejeitar: ${data.rejectUrl}`;

  if (data.imageUrl?.startsWith("http")) {
    const imgResult = await sendImageMessage(to, data.imageUrl, `Post ${channelLabel} — aguardando aprovação`);
    if (imgResult.error) console.warn("[WhatsApp] Falha ao enviar imagem:", imgResult.error);
  }

  return callWaApi(`${ENV.whatsappPhoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  });
}

// ── Template digest ─────────────────────────────────────────────────────────

export interface NewsDigestItem {
  title: string;
  url: string;
  source: string;
  excerpt?: string | null;
}

function sanitizeParam(text: string, maxLen: number): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\t/g, " ")
    .trim()
    .slice(0, maxLen);
}

function looksGarbled(text: string): boolean {
  const nonReadable = (text.match(/[^a-zA-ZÀ-ÿ0-9 .,;:!?()'"@#%\-_/]/g) ?? []).length;
  return text.length > 20 && nonReadable / text.length > 0.3;
}

function formatNewsItemParam(item: NewsDigestItem, index: number): string {
  const title = looksGarbled(item.title) ? "Noticia indisponivel" : sanitizeParam(item.title, 200);
  const source = sanitizeParam(item.source, 60);
  const url = sanitizeParam(item.url, 250);
  const excerpt = item.excerpt ? sanitizeParam(item.excerpt.replace(/\n/g, " "), 120) : "";

  const lines: string[] = [`${index + 1}. ${title}`, `📰 ${source}`];
  if (excerpt) lines.push(excerpt);
  lines.push(`🔗 ${url}`);

  const result = lines.join("\n");
  return result.length > 1000 ? result.slice(0, 997) + "…" : result;
}

async function tryTemplateSend(
  to: string,
  parameters: Array<{ type: "text"; text: string }>,
  langCode: string
): Promise<WaSendResult> {
  return callWaApi(`${ENV.whatsappPhoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: "envio_de_noticias_diario",
      language: { code: langCode },
      components: [{ type: "body", parameters }],
    },
  });
}

// Language codes to try in order
const LANG_CANDIDATES = ["pt_BR", "pt_PT", "pt"];

export async function sendNewsDigest(items: NewsDigestItem[], recipientNumber?: string): Promise<WaSendResult> {
  if (!isWhatsAppConfigured()) return { error: "WhatsApp não configurado." };

  const to = recipientNumber || ENV.whatsappRecipientNumber;
  if (!to) return { error: "Número destinatário não configurado." };

  const padded = [...items.slice(0, 5)];
  while (padded.length < 5) {
    padded.push({ title: "Sem noticia disponivel", url: "-", source: "-", excerpt: null });
  }

  const parameters = padded.map((item, i) => ({
    type: "text" as const,
    text: formatNewsItemParam(item, i),
  }));

  console.log("[WhatsApp Digest] Parâmetros:");
  parameters.forEach((p, i) =>
    console.log(`  [${i + 1}] ${p.text.length}ch: ${p.text.slice(0, 80).replace(/\n/g, "↵")}`)
  );

  // Try each language code; return first success
  let lastResult: WaSendResult = { error: "Nenhuma tentativa executada" };
  for (const lang of LANG_CANDIDATES) {
    const result = await tryTemplateSend(to, parameters, lang);
    if (!result.error) return result;
    lastResult = result;
    // Only retry on template-related errors
    if (!result.error.includes("132018") && !result.error.includes("132001")) break;
    console.warn(`[WhatsApp Digest] lang=${lang} falhou (${result.error}), tentando próximo...`);
  }
  return lastResult;
}

// ── Diagnostic ───────────────────────────────────────────────────────────────

export type TemplateDiagResult = {
  wabaAccounts: Array<{ id: string; name: string }>;
  templateFound: boolean;
  templateLanguage?: string;
  templateStatus?: string;
  templateComponents?: unknown;
  testSendResults: Array<{ lang: string; ok: boolean; messageId?: string; error?: string }>;
  rawErrors: string[];
};

export async function diagnoseWhatsAppTemplate(testRecipient: string): Promise<TemplateDiagResult> {
  const result: TemplateDiagResult = {
    wabaAccounts: [],
    templateFound: false,
    testSendResults: [],
    rawErrors: [],
  };

  // 1. Discover WABAs associated with this token
  const wabaRes = await metaGet(
    `me/whatsapp_business_accounts?fields=id,name&access_token=${ENV.whatsappAccessToken}`
  );
  const wabaList = (wabaRes.data as Array<{ id: string; name: string }> | undefined) ?? [];
  result.wabaAccounts = wabaList;

  // 2. For each WABA look for the template
  for (const waba of wabaList) {
    try {
      const tRes = await fetch(
        `${WA_API_BASE}/${waba.id}/message_templates?name=envio_de_noticias_diario&fields=name,status,language,components`,
        { headers: { Authorization: `Bearer ${ENV.whatsappAccessToken}` } }
      );
      const tJson = (await tRes.json()) as { data?: Array<{ name: string; status: string; language: string; components: unknown }> };
      const tpl = tJson.data?.[0];
      if (tpl) {
        result.templateFound = true;
        result.templateLanguage = tpl.language;
        result.templateStatus = tpl.status;
        result.templateComponents = tpl.components;
        break;
      }
    } catch (e) {
      result.rawErrors.push(String(e));
    }
  }

  // 3. Test send with simple values across all language codes
  const simpleParams = ["Noticia 1 teste", "Noticia 2 teste", "Noticia 3 teste", "Noticia 4 teste", "Noticia 5 teste"]
    .map((text) => ({ type: "text" as const, text }));

  for (const lang of LANG_CANDIDATES) {
    const r = await tryTemplateSend(testRecipient, simpleParams, lang);
    result.testSendResults.push({ lang, ok: !r.error, messageId: r.messageId, error: r.error });
    if (!r.error) break; // stop on first success
  }

  return result;
}