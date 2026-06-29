/**
 * Webhook do agregador de números WhatsApp.
 *
 * Fluxo com n8n:
 *  1. Usuário responde (1-5) no WhatsApp
 *  2. Agregador → n8n webhook ("Webhook do Agente IA")
 *  3. n8n chama POST /api/aggregator/webhook com a mensagem
 *  4. Respondemos SINCRONAMENTE com JSON + campo "resposta_texto"
 *  5. n8n usa "resposta_texto" para enviar de volta ao usuário via "Respond to Webhook"
 *  6. Em background: geramos artigo + carrossel e notificamos via WhatsApp direto
 */

import type { Request, Response } from "express";
import * as db from "../db";
import { sendWhatsAppText } from "./whatsapp";
import { autoGenerateFromNews } from "./newsAutoGenerator";

// ── Formatos de payload aceitos (flexível para diferentes agregadores/n8n) ──
interface RawAggregatorPayload {
  from?: string;
  phone?: string;
  number?: string;
  waId?: string;
  sender?: string;

  message?: string;
  text?: string;
  body?: string;
  content?: string;

  // n8n frequentemente aninha em "body" ou "query"
  data?: {
    from?: string;
    phone?: string;
    number?: string;
    message?: string;
    text?: string;
    body?: string;
  };

  // Formato Meta Cloud API repassado pelo agregador
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;

  timestamp?: string | number;
  [key: string]: unknown;
}

// ── Resposta: JSON estruturado + texto pronto para o n8n repassar ──────────
export interface AggregatorReply {
  resposta_texto: string;          // texto que o n8n deve enviar de volta ao usuário
  telefone: string;
  resposta_usuario: string;
  noticia_selecionada: {
    indice: number;
    titulo: string;
    url: string;
    fonte: string;
    resumo: string | null;
  } | null;
  erro?: string;
}

// ── Normalização ────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  return raw.replace(/[\s+\-().]/g, "");
}

function extractPhone(body: RawAggregatorPayload): string | null {
  if (body.entry) {
    const metaMsg = body.entry
      .flatMap(e => e.changes?.flatMap(c => c.value?.messages ?? []) ?? [])[0];
    if (metaMsg?.from) {
      const cleaned = normalizePhone(metaMsg.from);
      if (/^\d{10,15}$/.test(cleaned)) return cleaned;
    }
  }

  const candidates = [
    body.from, body.phone, body.number, body.waId, body.sender,
    body.data?.from, body.data?.phone, body.data?.number,
  ];
  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const cleaned = normalizePhone(raw);
    if (/^\d{10,15}$/.test(cleaned)) return cleaned;
  }

  // Último recurso: qualquer campo string com formato de número
  for (const [key, val] of Object.entries(body)) {
    if (key === "timestamp" || typeof val !== "string") continue;
    const cleaned = normalizePhone(val);
    if (/^\d{10,15}$/.test(cleaned)) return cleaned;
  }

  return null;
}

function extractMessage(body: RawAggregatorPayload): string {
  if (body.entry) {
    const metaMsg = body.entry
      .flatMap(e => e.changes?.flatMap(c => c.value?.messages ?? []) ?? [])[0];
    if (metaMsg?.type === "text" && metaMsg.text?.body) {
      return metaMsg.text.body.trim();
    }
  }

  return (
    body.message ?? body.text ?? body.body ?? body.content ??
    body.data?.message ?? body.data?.text ?? body.data?.body ?? ""
  ).trim();
}

// ── Handler principal ───────────────────────────────────────────────────────

export async function handleAggregatorWebhook(req: Request, res: Response): Promise<void> {
  const payload = req.body as RawAggregatorPayload;

  console.log("[AggregatorWebhook] ===== RECEBIDO =====");
  console.log("[AggregatorWebhook] Payload:", JSON.stringify(payload).slice(0, 1000));

  const phone = extractPhone(payload);
  if (!phone) {
    console.warn("[AggregatorWebhook] Número não identificado. Campos:", Object.keys(payload).join(", "));
    res.status(400).json({
      resposta_texto: "Erro: número de telefone não identificado no payload.",
      telefone: "",
      resposta_usuario: "",
      noticia_selecionada: null,
      erro: "Número de telefone ausente ou inválido.",
    } satisfies AggregatorReply);
    return;
  }

  const rawMessage = extractMessage(payload);
  console.log(`[AggregatorWebhook] Telefone: "${phone}" | Mensagem: "${rawMessage}"`);

  // ── Resposta inválida (não é 1-5) ──
  const choiceMatch = rawMessage.match(/^[1-5]$/);
  if (!choiceMatch) {
    const replyText = "Por favor, responda apenas com um número de *1 a 5* correspondente à notícia desejada.";
    res.status(200).json({
      resposta_texto: replyText,
      telefone: phone,
      resposta_usuario: rawMessage,
      noticia_selecionada: null,
      erro: "Resposta inválida — esperado número de 1 a 5.",
    } satisfies AggregatorReply);
    return;
  }

  const choice = parseInt(choiceMatch[0], 10);

  // ── Busca sessão ──
  const session = await db.recordSessionResponse(phone, choice);
  if (!session) {
    const replyText = "Não encontramos um envio recente para este número. Aguarde o próximo resumo diário. 📰";
    console.warn(`[AggregatorWebhook] Sessão não encontrada para phone=${phone}`);
    res.status(200).json({
      resposta_texto: replyText,
      telefone: phone,
      resposta_usuario: rawMessage,
      noticia_selecionada: null,
      erro: "Nenhuma sessão ativa (expirada após 24h ou número não reconhecido).",
    } satisfies AggregatorReply);
    return;
  }

  const { chosenItem, userId, campaignId } = session;
  console.log(`[AggregatorWebhook] Sessão encontrada: userId=${userId} campaign=${campaignId} notícia="${chosenItem.title}"`);

  // ── Monta texto de resposta imediata (n8n repassa ao usuário) ──
  const excerpt = chosenItem.excerpt
    ? `\n\n${chosenItem.excerpt.slice(0, 300).trim()}...`
    : "";
  const replyText =
    `📰 *Notícia ${choice} selecionada:*\n\n` +
    `*${chosenItem.title}*` +
    excerpt +
    `\n\n🔗 Fonte: ${chosenItem.source}\n🌐 ${chosenItem.url}\n\n` +
    `⚙️ Estamos gerando seu artigo completo — aguarde até 2 minutos.`;

  // ── Responde ao n8n IMEDIATAMENTE com o texto pronto ──
  res.status(200).json({
    resposta_texto: replyText,
    telefone: phone,
    resposta_usuario: rawMessage,
    noticia_selecionada: {
      indice: choice,
      titulo: chosenItem.title,
      url: chosenItem.url,
      fonte: chosenItem.source,
      resumo: chosenItem.excerpt ?? null,
    },
  } satisfies AggregatorReply);

  // ── Geração em background ───────────────────────────────────────────────
  // newsAutoGenerator.ts envia a notificação WhatsApp ao concluir — sem duplicar aqui
  void (async () => {
    try {
      console.log(`[AggregatorWebhook] Iniciando geração: userId=${userId}`);
      const result = await autoGenerateFromNews(userId, chosenItem, phone);
      console.log(`[AggregatorWebhook] Concluído: articleId=${result.articleId} carouselId=${result.carouselId}`);
    } catch (err) {
      console.error("[AggregatorWebhook] ERRO NA GERAÇÃO:", err);
      await sendWhatsAppText(
        phone,
        "❌ Erro ao gerar o artigo. Tente novamente mais tarde."
      ).catch(() => {});
    }
  })();
}

// ── Mensagem texto do digest diário ────────────────────────────────────────
const EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

export function buildDigestTextMessage(
  items: Array<{ title: string; url?: string; source?: string }>
): string {
  const lines = items
    .slice(0, 5)
    .map((item, i) => `${EMOJIS[i]} ${item.title}`)
    .join("\n\n");

  return (
    `📰 *Notícias do Dia*\n\n` +
    `${lines}\n\n` +
    `Responda com o número da notícia que deseja receber completa.`
  );
}