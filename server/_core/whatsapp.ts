import { ENV } from "./env";

const WA_API_BASE = "https://graph.facebook.com/v20.0";

interface WaSendResult {
  messageId?: string;
  error?: string;
}

export function isWhatsAppConfigured(): boolean {
  return !!(ENV.whatsappPhoneNumberId && ENV.whatsappAccessToken && ENV.whatsappRecipientNumber);
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

  const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
  if (!res.ok) {
    return { error: json.error?.message ?? `HTTP ${res.status}` };
  }
  return { messageId: json.messages?.[0]?.id };
}

async function sendTextMessage(to: string, text: string): Promise<WaSendResult> {
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

  // If there's an image, send it first with the caption, then the text with links
  if (data.imageUrl?.startsWith("http")) {
    const imgResult = await sendImageMessage(to, data.imageUrl, `Post ${channelLabel} — aguardando aprovação`);
    if (imgResult.error) {
      console.warn("[WhatsApp] Falha ao enviar imagem, enviando apenas texto:", imgResult.error);
    }
  }

  return sendTextMessage(to, text);
}
