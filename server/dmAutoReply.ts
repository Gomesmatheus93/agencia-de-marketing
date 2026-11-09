import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { dmAutoReplyLog, dmAutoReplySettings, type DmAutoRule } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// Respostas automáticas no Direct do Instagram, por palavra-chave (sem IA, sem custo).
// Chamado pela rota /api/automations/dm-received (n8n) quando a mensagem não faz
// parte de uma automação de comentário.

const RULE_COOLDOWN_MS = 12 * 60 * 60 * 1000; // a mesma regra, para a mesma pessoa, no máximo a cada 12 h
const FALLBACK_COOLDOWN_MS = 24 * 60 * 60 * 1000; // a resposta padrão, no máximo a cada 24 h
const LINK = "{link}"; // trocado pelo link do WhatsApp configurado

const DISCLAIMER = "*Sujeito à análise da fatura e às condições do benefício.";

export const DEFAULT_RULES: DmAutoRule[] = [
  {
    id: "desconto", active: true,
    keywords: ["preço", "preco", "desconto", "quanto", "valor", "economia", "economizar", "porcentagem"],
    reply: `Oi! 😊 O desconto na conta de luz é de até 35% para empresas (PJ) e de até 15% para pessoa física (PF)*, sem obra, sem fidelidade e você continua com a sua distribuidora.\n\nMe manda uma foto da sua conta de luz que a gente calcula o seu desconto! Ou fala com a Ane no WhatsApp: ${LINK}\n\n${DISCLAIMER}`,
  },
  {
    id: "como-funciona", active: true,
    keywords: ["como funciona", "o que é", "o que e", "energia digital", "como é", "como e", "entender"],
    reply: `A energia digital da Alle funciona assim ⚡ a energia vem de uma cooperativa parceira e você continua recebendo pela sua distribuidora de sempre. Sem obra, sem placa e sem fidelidade, e a sua conta vem com desconto todo mês.\n\nQuer ver quanto você economiza? Fala com a Ane no WhatsApp: ${LINK}`,
  },
  {
    id: "fatura", active: true,
    keywords: ["fatura", "conta de luz", "boleto", "enviar a conta", "mandar a conta"],
    reply: `Pode mandar a foto ou o PDF da sua fatura de luz pelo WhatsApp da Ane, que a gente analisa e te mostra o desconto: ${LINK}`,
  },
  {
    id: "aluguel", active: true,
    keywords: ["aluguel", "alugado", "alugada", "inquilino", "moro de aluguel"],
    reply: `Pode, sim! 🏠 O desconto vale para imóvel próprio ou alugado. Quem assina a adesão é o titular da fatura de luz.\n\nFala com a Ane no WhatsApp para começar: ${LINK}`,
  },
  {
    id: "fidelidade", active: true,
    keywords: ["fidelidade", "multa", "contrato", "cancelar"],
    reply: `Não tem fidelidade nem custo para aderir. 😉\n\nQualquer dúvida sobre o contrato, a Ane te explica no WhatsApp: ${LINK}`,
  },
  {
    id: "obra", active: true,
    keywords: ["obra", "placa", "instalar", "instalação", "instalacao", "painel", "telhado"],
    reply: `Não precisa de obra nem de placa no telhado! Nada é instalado na sua casa ou empresa, e você continua com a sua distribuidora.\n\nQuer o seu cálculo? Fala com a Ane no WhatsApp: ${LINK}`,
  },
];

export const DEFAULT_FALLBACK = `Oi! Aqui é da Alle Energia ⚡ Obrigado pela mensagem!\n\nPara te atender mais rápido, fala com a Ane no WhatsApp: ${LINK}`;

/** Minúsculas e sem acentos, para comparar palavras-chave. */
function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function matchRule(rules: DmAutoRule[], text: string): DmAutoRule | null {
  const msg = ` ${normalize(text).replace(/[^\p{L}\p{N}\s]/gu, " ")} `;
  return rules.find((r) => r.active && r.keywords.some((k) => k.trim() && msg.includes(` ${normalize(k.trim())}`))) ?? null;
}

async function loadSettings(userId: number) {
  const conn = await db.getDb();
  if (!conn) return null;
  const [row] = await conn.select().from(dmAutoReplySettings).where(eq(dmAutoReplySettings.userId, userId));
  return row ?? null;
}

async function recentlySent(igAccountId: string, senderId: string, ruleKey: string, withinMs: number) {
  const conn = await db.getDb();
  if (!conn) return true;
  const [row] = await conn.select({ id: dmAutoReplyLog.id }).from(dmAutoReplyLog)
    .where(and(eq(dmAutoReplyLog.igAccountId, igAccountId), eq(dmAutoReplyLog.senderId, senderId), eq(dmAutoReplyLog.ruleKey, ruleKey), gte(dmAutoReplyLog.sentAt, new Date(Date.now() - withinMs))))
    .orderBy(desc(dmAutoReplyLog.sentAt)).limit(1);
  return Boolean(row);
}

/**
 * Decide e envia a resposta automática de uma DM. Devolve o motivo quando não
 * responde (desligado, sem regra, já respondido há pouco…).
 */
export async function handleIncomingDm(input: { igAccountId: string; senderId: string; text: string }) {
  const igConnection = await db.getInstagramConnectionByIgId(input.igAccountId);
  if (!igConnection?.accessToken) return { sent: false, reason: "no_connection" };
  const settings = await loadSettings(igConnection.userId);
  if (!settings?.enabled) return { sent: false, reason: "disabled" };

  const rule = input.text.trim() ? matchRule(settings.rules ?? [], input.text) : null;
  const ruleKey = rule ? `rule:${rule.id}` : "fallback";
  if (!rule && !settings.fallbackEnabled) return { sent: false, reason: "no_rule" };
  if (await recentlySent(input.igAccountId, input.senderId, ruleKey, rule ? RULE_COOLDOWN_MS : FALLBACK_COOLDOWN_MS)) {
    return { sent: false, reason: "cooldown", ruleKey };
  }

  const link = settings.whatsappLink?.trim() || "pelo link da bio";
  const template = rule ? rule.reply : settings.fallbackMessage?.trim() || DEFAULT_FALLBACK;
  const text = template.split(LINK).join(link).slice(0, 1000);

  // Com token do Facebook (página), a mensagem sai pela página (igual à segunda DM).
  const from = igConnection.facebookPageId ?? igConnection.instagramAccountId ?? input.igAccountId;
  const res = await fetch(`https://graph.facebook.com/v25.0/${from}/messages?access_token=${encodeURIComponent(igConnection.accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: input.senderId }, message: { text }, messaging_type: "RESPONSE" }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error("[DmAutoReply] erro ao enviar:", JSON.stringify(data));
    return { sent: false, reason: "send_error", error: data };
  }
  const conn = await db.getDb();
  await conn?.insert(dmAutoReplyLog).values({ igAccountId: input.igAccountId, senderId: input.senderId, ruleKey });
  console.log(`[DmAutoReply] respondido: ${ruleKey} → ${input.senderId}`);
  return { sent: true, ruleKey };
}

const ruleSchema = z.object({
  id: z.string().trim().min(1).max(64),
  keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  reply: z.string().trim().min(1).max(1000),
  active: z.boolean(),
});

export const dmAutoReplyRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await loadSettings(ctx.user.id);
    return {
      enabled: row?.enabled ?? false,
      whatsappLink: row?.whatsappLink ?? "",
      fallbackEnabled: row?.fallbackEnabled ?? true,
      fallbackMessage: row?.fallbackMessage ?? DEFAULT_FALLBACK,
      rules: row?.rules?.length ? row.rules : DEFAULT_RULES,
    };
  }),

  save: protectedProcedure
    .input(z.object({
      enabled: z.boolean(),
      whatsappLink: z.string().trim().max(500).refine((v) => !v || /^https:\/\//i.test(v), "Use um link que comece com https://"),
      fallbackEnabled: z.boolean(),
      fallbackMessage: z.string().trim().min(1).max(1000),
      rules: z.array(ruleSchema).max(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const conn = await db.getDb();
      if (!conn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const values = { ...input, whatsappLink: input.whatsappLink || null };
      await conn.insert(dmAutoReplySettings).values({ userId: ctx.user.id, ...values })
        .onConflictDoUpdate({ target: dmAutoReplySettings.userId, set: values });
      return { ok: true };
    }),
});
