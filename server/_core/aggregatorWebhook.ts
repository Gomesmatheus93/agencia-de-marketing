/**
 * Webhook do agregador de números WhatsApp.
 *
 * Fluxo:
 *  1. Agregador (ex: sistema de gerenciamento de números) recebe resposta do usuário
 *  2. Agregador chama POST /api/aggregator/webhook com a mensagem
 *  3. Identificamos o usuário pela sessão ativa, gravamos a escolha
 *  4. Respondemos ao agregador com JSON estruturado (síncrono)
 *  5. Enviamos via WhatsApp o conteúdo da notícia escolhida → aparece na conversa do agregador
 *  6. Geramos artigo + carrossel em background
 */

import type { Request, Response } from "express";
import * as db from "../db";
import { sendWhatsAppText } from "./whatsapp";
import { autoGenerateFromNews } from "./newsAutoGenerator";

// ── Formatos de payload aceitos ────────────────────────────────────────────
// Diferentes agregadores enviam em formatos distintos. Normalizamos tudo.
interface RawAggregatorPayload {
  // Formato simples (maioria dos agregadores)
  from?: string;
  phone?: string;
  number?: string;
  waId?: string;
  sender?: string;

  // Texto da mensagem
  message?: string;
  text?: string;
  body?: string;
  content?: string;

  // Aninhado em "data" (alguns sistemas)
  data?: {
    from?: string;
    phone?: string;
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
}

// ── Resposta estruturada que devolvemos ao agregador ───────────────────────
export interface AggregatorReply {
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

// ── Normalização de payload ────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  return raw.replace(/[\s+\-().]/g, "");
}

function extractPhone(body: RawAggregatorPayload): string | null {
  // Tenta formato Meta repassado
  if (body.entry) {
    const metaMsg = body.entry
      .flatMap(e => e.changes?.flatMap(c => c.value?.messages ?? []) ?? [])[0];
    if (metaMsg?.from) {
      const cleaned = normalizePhone(metaMsg.from);
      if (/^\d{10,15}$/.test(cleaned)) return cleaned;
    }
  }

  // Formatos diretos
  const candidates = [
    body.from, body.phone, body.number, body.waId, body.sender,
    body.data?.from, body.data?.phone,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const cleaned = normalizePhone(raw);
    if (/^\d{10,15}$/.test(cleaned)) return cleaned;
  }
  return null;
}

function extractMessage(body: RawAggregatorPayload): string {
  // Formato Meta
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

// ── Handler principal ──────────────────────────────────────────────────────

export async function handleAggregatorWebhook(req: Request, res: Response): Promise<void> {
  const payload = req.body as RawAggregatorPayload;

  // Log completo do payload para diagnóstico de formato
  console.log("[AggregatorWebhook] ===== WEBHOOK RECEBIDO =====");
  console.log("[AggregatorWebhook] Headers:", JSON.stringify(req.headers).slice(0, 300));
  console.log("[AggregatorWebhook] Payload:", JSON.stringify(payload).slice(0, 1000));

  const phone = extractPhone(payload);
  if (!phone) {
    console.warn("[AggregatorWebhook] ERRO: Número não identificado no payload.");
    console.warn("[AggregatorWebhook] Campos disponíveis:", Object.keys(payload).join(", "));
    res.status(400).json({ erro: "Número de telefone ausente ou inválido no payload." });
    return;
  }

  const rawMessage = extractMessage(payload);
  console.log(`[AggregatorWebhook] Telefone extraído: "${phone}" | Mensagem: "${rawMessage}"`);

  const choiceMatch = rawMessage.match(/^[1-5]$/);

  // ── Resposta inválida ──
  if (!choiceMatch) {
    void sendWhatsAppText(
      phone,
      "Por favor, escolha uma opção válida digitando apenas um número de 1 a 5."
    ).catch(() => {});
    res.status(200).json({
      telefone: phone,
      resposta_usuario: rawMessage,
      noticia_selecionada: null,
      erro: "Resposta inválida — esperado número de 1 a 5.",
    } satisfies AggregatorReply);
    return;
  }

  const choice = parseInt(choiceMatch[0], 10); // 1–5

  // ── Busca sessão e grava escolha ──
  const session = await db.recordSessionResponse(phone, choice);

  if (!session) {
    void sendWhatsAppText(
      phone,
      "Não encontramos uma campanha ativa para o seu número. Aguarde o próximo envio diário das notícias. 📰"
    ).catch(() => {});
    res.status(200).json({
      telefone: phone,
      resposta_usuario: rawMessage,
      noticia_selecionada: null,
      erro: "Nenhuma campanha ativa (sessão expirada após 24h ou número não reconhecido).",
    } satisfies AggregatorReply);
    return;
  }

  const { chosenItem, userId, campaignId } = session;

  console.log(
    `[AggregatorWebhook] ${phone} escolheu [${choice}] "${chosenItem.title}" (campanha: ${campaignId})`
  );

  // ── Responde ao agregador imediatamente ──
  res.status(200).json({
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

  // ── Processamento em background (não bloqueia a resposta ao agregador) ──
  void (async () => {
    try {
      console.log(`[AggregatorWebhook] Iniciando geração para userId=${userId} phone=${phone}`);

      // 1. Envia o conteúdo da notícia escolhida → aparece na conversa do agregador
      const excerpt = chosenItem.excerpt
        ? `\n\n_${chosenItem.excerpt.slice(0, 280).trim()}..._`
        : "";
      const newsMsg =
        `📰 *Notícia ${choice} selecionada:*\n\n` +
        `*${chosenItem.title}*` +
        excerpt +
        `\n\n🔗 Fonte: ${chosenItem.source}\n🌐 ${chosenItem.url}\n\n` +
        `⚙️ Gerando artigo — aguarde até 2 minutos.`;

      await sendWhatsAppText(phone, newsMsg);
      console.log(`[AggregatorWebhook] Mensagem de confirmação enviada para ${phone}`);

      // 2. Gera artigo + carrossel e notifica quando pronto
      const result = await autoGenerateFromNews(userId, chosenItem, phone);
      console.log(`[AggregatorWebhook] Geração concluída: articleId=${result.articleId} carouselId=${result.carouselId}`);

    } catch (err) {
      console.error("[AggregatorWebhook] ERRO NA GERAÇÃO:", err);
      void sendWhatsAppText(
        phone,
        "❌ Erro ao gerar o conteúdo. Tente novamente ou aguarde o próximo digest."
      ).catch((waErr) => console.error("[AggregatorWebhook] Falha ao enviar erro WA:", waErr));
    }
  })();
}

// ── Mensagem texto do digest diário ───────────────────────────────────────
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
    `Digite apenas o número da notícia que deseja receber completa.`
  );
}