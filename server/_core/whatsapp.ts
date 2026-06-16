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
  let res: Response;
  try {
    res = await fetch(`${WA_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.whatsappAccessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = `Erro de rede: ${String(err)}`;
    console.error(`[WhatsApp API] ${msg}`);
    return { error: msg };
  }

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
    .replace(/[\n\r\t]/g, " ")           // Meta rejects newlines/tabs in template params
    .replace(/ {5,}/g, "    ")           // Meta rejects >4 consecutive spaces
    .trim()
    .slice(0, maxLen);
}

function looksGarbled(text: string): boolean {
  if (text.length < 10) return false;
  // No spaces in a long string → base64/encoded garbage
  if (text.length > 15 && !text.includes(" ")) return true;
  // High ratio of non-readable characters
  const nonReadable = (text.match(/[^a-zA-ZÀ-ÿ0-9 .,;:!?()'"@#%\-_/]/g) ?? []).length;
  return nonReadable / text.length > 0.3;
}

function sanitizePhone(number: string): string {
  return number.replace(/[\s+\-().]/g, "");
}

// Budget: 1024 total - ~150 static template chars = 874 for params / 15 params = ~58/param
// We use: title 80, source 20, url 50 → 5×(80+20+50)=750 + static ≈ 900 < 1024
function buildNewsItemParams(
  item: NewsDigestItem
): [{ type: "text"; text: string }, { type: "text"; text: string }, { type: "text"; text: string }] {
  const rawTitle = looksGarbled(item.title) ? "Noticia indisponivel" : item.title;
  const title = sanitizeParam(rawTitle, 80);
  const source = sanitizeParam(item.source || "—", 20);
  const url = sanitizeParam(item.url || "—", 50);
  return [
    { type: "text", text: title || "Noticia indisponivel" },
    { type: "text", text: source },
    { type: "text", text: url },
  ];
}

const LANG_CANDIDATES = ["pt_BR", "pt_PT", "pt"];

async function tryTemplateSend(
  to: string,
  parameters: Array<{ type: "text"; text: string }>,
  langCode: string,
  templateName = "envio_de_noticias_diario"
): Promise<WaSendResult> {
  return callWaApi(`${ENV.whatsappPhoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: langCode },
      components: [{ type: "body", parameters }],
    },
  });
}

export async function sendNewsDigest(
  items: NewsDigestItem[],
  recipientNumber?: string,
  templateName?: string,
  templateLanguage?: string
): Promise<WaSendResult> {
  if (!isWhatsAppConfigured()) return { error: "WhatsApp não configurado." };

  const rawTo = recipientNumber || ENV.whatsappRecipientNumber;
  if (!rawTo) return { error: "Número destinatário não configurado." };
  const to = sanitizePhone(rawTo);
  if (!/^\d{10,15}$/.test(to)) {
    return { error: `Número inválido: "${rawTo}" → "${to}". Use formato DDI+DDD+número (ex: 5527981244658)` };
  }
  console.log(`[WhatsApp Digest] Enviando para ${to} (original: "${rawTo}"`);

  const padded = [...items.slice(0, 5)];
  while (padded.length < 5) {
    padded.push({ title: "Sem noticia disponivel", url: "—", source: "—", excerpt: null });
  }

  // 15 parameters total: 3 per news item (title, source, url) — no newlines allowed by Meta
  const parameters = padded.flatMap(buildNewsItemParams);

  console.log("[WhatsApp Digest] Parâmetros (15):");
  parameters.forEach((p, i) =>
    console.log(`  [${i + 1}] ${p.text.length}ch: ${p.text.slice(0, 80)}`)
  );

  const tplName = templateName ?? "envio_de_noticias_diario";
  const tplLang = templateLanguage ?? "pt_BR";
  console.log(`[WhatsApp Digest] template=${tplName} lang=${tplLang}`);
  return tryTemplateSend(to, parameters, tplLang, tplName);
}

// ── Template listing ─────────────────────────────────────────────────────────

export type WaTemplate = {
  name: string;
  status: string;
  language: string;
  category: string;
};

export async function getWhatsAppTemplates(): Promise<{ templates: WaTemplate[]; error?: string }> {
  if (!ENV.whatsappPhoneNumberId || !ENV.whatsappAccessToken) {
    return { templates: [], error: "WhatsApp não configurado" };
  }

  // Try to discover WABA IDs using multiple tokens
  const wabaIds: string[] = [];
  const tokens = [ENV.whatsappAccessToken, ENV.metaAccessToken].filter(Boolean);

  for (const token of tokens) {
    try {
      const res = await fetch(`${WA_API_BASE}/me/whatsapp_business_accounts?fields=id,name&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { data?: Array<{ id: string }> };
      for (const w of json.data ?? []) {
        if (!wabaIds.includes(w.id)) wabaIds.push(w.id);
      }
    } catch { /* continue */ }
  }

  // Also try via Meta App ID
  if (ENV.metaAppId && ENV.metaAccessToken) {
    try {
      const res = await fetch(
        `${WA_API_BASE}/${ENV.metaAppId}/whatsapp_business_accounts?fields=id,name&limit=50`,
        { headers: { Authorization: `Bearer ${ENV.metaAccessToken}` } }
      );
      const json = await res.json() as { data?: Array<{ id: string }> };
      for (const w of json.data ?? []) {
        if (!wabaIds.includes(w.id)) wabaIds.push(w.id);
      }
    } catch { /* continue */ }
  }

  if (wabaIds.length === 0) {
    return {
      templates: [],
      error: "Não foi possível encontrar a conta WhatsApp Business. O token precisa da permissão whatsapp_business_management no Meta Business Manager.",
    };
  }

  for (const wabaId of wabaIds) {
    try {
      const res = await fetch(
        `${WA_API_BASE}/${wabaId}/message_templates?fields=name,status,language,category&limit=200`,
        { headers: { Authorization: `Bearer ${ENV.whatsappAccessToken}` } }
      );
      const json = await res.json() as { data?: WaTemplate[]; error?: { message: string } };
      if (json.data && json.data.length > 0) {
        return { templates: json.data };
      }
    } catch { /* continue */ }
  }

  return { templates: [], error: "Nenhum template encontrado nas contas acessíveis." };
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

  // 3. Test send with 15 simple values (3 per item × 5 items: title, source, url)
  const simpleParams = Array.from({ length: 5 }, (_, i) => [
    { type: "text" as const, text: `Noticia ${i + 1} teste` },
    { type: "text" as const, text: `site${i + 1}.com.br` },
    { type: "text" as const, text: `https://site${i + 1}.com.br/link` },
  ]).flat();

  for (const lang of LANG_CANDIDATES) {
    const r = await tryTemplateSend(testRecipient, simpleParams, lang);
    result.testSendResults.push({ lang, ok: !r.error, messageId: r.messageId, error: r.error });
    if (!r.error) break; // stop on first success
  }

  return result;
}