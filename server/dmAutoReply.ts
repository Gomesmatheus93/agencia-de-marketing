import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { dmAutoReplyLog, dmAutoReplySettings, type DmAutoRule } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// Respostas automáticas no Direct do Instagram, por palavra-chave (sem IA, sem custo).
// Chamado pela rota /api/automations/dm-received (n8n) quando a mensagem não faz
// parte de uma automação de comentário.
//
// Textos baseados no script da Ane (WhatsApp), com as decisões da equipe de 11/11/2026:
// - sem porcentagem no Direct; fatura e documentos só no WhatsApp;
// - o titular assina o termo; titularidade fica de fora (a confirmar);
// - sem "milhares de clientes", "vagas limitadas" ou "100% solar e certificada";
// - a Ane se apresenta como "Ane, da Alle Energia" (sem dizer se é pessoa ou virtual).
//
// Fluxo em etapas (opcional, flowEnabled): a Ane pergunta o valor aproximado da conta
// e, pelo valor, encaminha para o WhatsApp. A etapa de cada pessoa fica no próprio
// log (chaves "flow:*"), válida por 24 h.

const RULE_COOLDOWN_MS = 12 * 60 * 60 * 1000; // a mesma regra, para a mesma pessoa, no máximo a cada 12 h
const FALLBACK_COOLDOWN_MS = 24 * 60 * 60 * 1000; // a resposta padrão, no máximo a cada 24 h
const FLOW_TTL_MS = 24 * 60 * 60 * 1000; // a etapa do fluxo vale por 24 h (janela de resposta da Meta)
const MIN_BILL = 200; // conta mínima para o benefício (script da Ane)
const HIGH_BILL = 3000; // acima disso, confirma se não foi erro de digitação
const LINK = "{link}"; // trocado pelo link do WhatsApp configurado

/** Regras que já encerram o assunto: não ganham a pergunta do valor no fim. */
const NO_FLOW_TAIL = new Set(["desinteresse", "usina"]);

export const DEFAULT_RULES: DmAutoRule[] = [
  {
    id: "desinteresse", active: true,
    keywords: ["não quero", "nao quero", "não tenho interesse", "nao tenho interesse", "sem interesse", "depois vejo", "tenho receio"],
    reply: "Entendo o receio. 😊 Só lembrando: é um desconto automático na sua conta de luz, sem custo nenhum e sem burocracia.\n\nSe quiser entender melhor antes de decidir, é só chamar 👍",
  },
  {
    id: "usina", active: true,
    keywords: ["usina", "alocar", "alocação", "alocacao", "vender energia", "investir", "investimento"],
    reply: "Que legal receber seu contato! 😊 Negociações de usina ou alocação são feitas pelo nosso setor comercial: comercial@alleenergia.com 💚",
  },
  {
    id: "pagar-conta", active: true,
    keywords: ["vão pagar", "vao pagar", "pagam minha conta", "pagar minha conta", "paga a minha conta"],
    reply: "Não, a conta continua sendo sua. 😊 A Alle reduz o valor que você paga pela energia, mas você continua pagando a sua conta normalmente.",
  },
  {
    id: "sem-luz", active: true,
    keywords: ["sem luz", "sem energia", "cortar a luz", "cortam", "apagão", "apagao", "queda de energia"],
    reply: "Não! Você continua com energia normal o tempo todo. Nada muda na sua instalação. ⚡💚",
  },
  {
    id: "boletos", active: true,
    keywords: ["dois boletos", "2 boletos", "boleto", "duas contas", "dois pagamentos"],
    reply: "Sim, você recebe dois boletos 😊 Um da distribuidora, referente às taxas públicas (como iluminação pública), e outro da Alle, referente à energia já com o desconto aplicado. 💚⚡",
  },
  {
    id: "prazo", active: true,
    keywords: ["90 dias", "quando começa", "quando comeca", "demora", "prazo", "quanto tempo"],
    reply: "O primeiro desconto aparece em até 90 dias depois da assinatura do termo de adesão. É o tempo que a distribuidora leva pra processar. Depois disso, você economiza todo mês! 💚",
  },
  {
    id: "assinatura", active: true,
    keywords: ["assinar", "assinatura", "termo", "contrato"],
    reply: "O termo de adesão é assinado digitalmente pelo próprio titular da conta de luz. Ele chega no final do atendimento, por WhatsApp e e-mail: você lê com calma e aceita. 😊",
  },
  {
    id: "aluguel", active: true,
    keywords: ["aluguel", "alugado", "alugada", "inquilino"],
    reply: "Pode, sim! 🏠 O desconto vale para imóvel próprio ou alugado. Quem assina a adesão é o titular da conta de luz.",
  },
  {
    id: "fatura-documentos", active: true,
    keywords: ["fatura", "foto da conta", "mandar a conta", "enviar a conta", "pdf", "documento", "rg", "cpf", "cnh"],
    reply: `A análise da fatura e os documentos são feitos com a Ane pelo WhatsApp, com toda a segurança. 😊 É só chamar: ${LINK}`,
  },
  {
    id: "obra", active: true,
    keywords: ["obra", "placa", "instalar", "instalação", "instalacao", "painel", "telhado"],
    reply: "Não precisa de obra nem de placa! ☀️ Nada é instalado na sua casa ou empresa.",
  },
  {
    id: "custo", active: true,
    keywords: ["custo", "custa", "taxa", "fidelidade", "multa", "cancelar", "de graça", "de graca", "gratuito", "cobra"],
    reply: "Fica tranquilo! É gratuito para aderir, sem custo e sem fidelidade. E você pode sair quando quiser! ✅",
  },
  {
    id: "como-funciona", active: true,
    keywords: ["como funciona", "o que é", "o que e", "energia digital", "explica", "não entendi", "nao entendi", "isso é real", "isso e real", "é verdade", "e verdade"],
    reply: "A Alle Energia gera energia através de placas solares e transforma isso em desconto na sua energia. ☀️⚡ Você não instala nada e recebe o desconto todo mês.",
  },
  {
    id: "lucro", active: true,
    keywords: ["lucro", "ganham dinheiro", "ganha dinheiro", "sustentável", "sustentavel", "por que de graça"],
    reply: "Ótima pergunta! A Alle é uma empresa séria, que atua dentro das regras da geração distribuída, regulamentada pela ANEEL. Pra você, o que importa é a economia todo mês 💚",
  },
  {
    id: "desconto", active: true,
    keywords: ["desconto", "preço", "preco", "quanto", "valor", "economia", "economizar", "benefício", "beneficio"],
    reply: "O desconto vem todo mês na sua energia, sem obra e sem fidelidade. 💚 O quanto você economiza depende do valor da sua conta.",
  },
];

export const DEFAULT_FALLBACK = `Oi! Aqui é a Ane, da Alle Energia ⚡ Obrigada pela mensagem!\n\nPra te atender mais rápido, me chama no WhatsApp: ${LINK} 💚`;

// ─── Textos do fluxo em etapas (script da Ane, etapas 1 a 3) ─────────────────
const FLOW = {
  start: "Oi! Tudo bem? 😊 Aqui é a Ane, da Alle Energia. Com a gente você não instala nada, não paga nenhuma taxa de adesão e passa a ter desconto todo mês na sua energia.\n\nMe conta: qual é o valor aproximado que está vindo na sua conta de luz? 💡",
  tail: "Com isso esclarecido, me conta: qual é o valor aproximado da sua conta de luz? 💡",
  reask: "Me conta só o valor aproximado da sua conta de luz, por exemplo: 350 💡",
  eligible: (v: string) => `Ótima notícia! Com uma conta de ${v}, você pode ter desconto todo mês na sua energia. 💚\n\nPra ver o seu cálculo e ativar o benefício, é só me chamar no WhatsApp: ${LINK}`,
  below: (v: string) => `Obrigada por compartilhar! No momento, uma conta de ${v} ainda está abaixo do mínimo para o benefício da Alle Energia. 😞\n\nMas, se a sua conta aumentar ou se houver outra conta de luz na família, é só me chamar no WhatsApp que eu analiso: ${LINK} 💚`,
  confirm: (v: string) => `Opa, esse valor parece bem alto! Só pra confirmar: a sua conta vem mesmo em torno de ${v}? Ou pode ter sido um erro de digitação?\n\nMe confirma o valor correto 💚`,
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Minúsculas e sem acentos, para comparar palavras-chave. */
function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function matchRule(rules: DmAutoRule[], text: string): DmAutoRule | null {
  const msg = ` ${normalize(text).replace(/[^\p{L}\p{N}\s]/gu, " ")} `;
  return rules.find((r) => r.active && r.keywords.some((k) => k.trim() && msg.includes(` ${normalize(k.trim())}`))) ?? null;
}

/** Valor da conta escrito pela pessoa: "350", "R$ 1.200,50", "uns 400 reais", "2 mil". */
export function parseBillValue(text: string): number | null {
  const t = normalize(text);
  const mil = /(\d+(?:[.,]\d+)?)\s*mil\b/.exec(t);
  if (mil) return Number(mil[1].replace(",", ".")) * 1000;
  for (const m of t.matchAll(/\d[\d.,]*/g)) {
    let raw = m[0].replace(/[.,]$/, "");
    if (raw.includes(",") && raw.includes(".")) raw = raw.replace(/\./g, "").replace(",", ".");
    else if (raw.includes(",")) raw = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, "");
    else if (/\.\d{3}($|\.)/.test(raw)) raw = raw.replace(/\./g, "");
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 10) return value;
  }
  return null;
}

const AFFIRMATIVE = ["sim", "isso", "correto", "certo", "exato", "confirmo", "e isso", "isso mesmo", "ta certo"];
function isAffirmative(text: string) {
  const msg = ` ${normalize(text).replace(/[^\p{L}\p{N}\s]/gu, " ")} `;
  return AFFIRMATIVE.some((w) => msg.includes(` ${w} `));
}

async function loadSettings(userId: number) {
  const conn = await db.getDb();
  if (!conn) return null;
  const [row] = await conn.select().from(dmAutoReplySettings).where(eq(dmAutoReplySettings.userId, userId));
  return row ?? null;
}

type LogRow = { ruleKey: string; sentAt: Date };
type DecideSettings = { rules: DmAutoRule[]; flowEnabled: boolean; fallbackEnabled: boolean; fallbackMessage: string | null };
export type DmDecision = { message: string; keys: string[] } | { skip: string; ruleKey?: string };

/**
 * Decide a resposta de uma DM (função pura, sem banco e sem rede).
 * `history` = respostas já enviadas a essa pessoa nas últimas 24 h, da mais nova para a mais antiga.
 */
export function decideDmReply(text: string, settings: DecideSettings, history: LogRow[], now = Date.now()): DmDecision {
  const sentWithin = (key: string, ms: number) => history.some((r) => r.ruleKey === key && now - r.sentAt.getTime() < ms);
  const flowOn = settings.flowEnabled;
  const state = flowOn ? history.find((r) => r.ruleKey.startsWith("flow:") && now - r.sentAt.getTime() < FLOW_TTL_MS)?.ruleKey ?? null : null;
  const waiting = state === "flow:ask" || state === "flow:reask" || Boolean(state?.startsWith("flow:confirm:"));
  const msg = text.trim();

  // 1) Esperando o valor da conta: tenta ler o número.
  if (flowOn && waiting && msg) {
    const confirming = state!.startsWith("flow:confirm:");
    let value = parseBillValue(msg);
    if (value === null && confirming && isAffirmative(msg)) value = Number(state!.split(":")[2]);
    if (value !== null && Number.isFinite(value)) {
      if (value > HIGH_BILL && !confirming) return { message: FLOW.confirm(brl(value)), keys: [`flow:confirm:${Math.round(value)}`] };
      return value >= MIN_BILL ? { message: FLOW.eligible(brl(value)), keys: ["flow:done"] } : { message: FLOW.below(brl(value)), keys: ["flow:done"] };
    }
  }

  // 2) Regra por palavra-chave.
  const rule = msg ? matchRule(settings.rules ?? [], msg) : null;
  if (rule) {
    const ruleKey = `rule:${rule.id}`;
    if (sentWithin(ruleKey, RULE_COOLDOWN_MS)) return { skip: "cooldown", ruleKey };
    // No fluxo, depois de tirar a dúvida, a Ane retoma a pergunta do valor (regra de retomada do script).
    const withTail = flowOn && state !== "flow:done" && !NO_FLOW_TAIL.has(rule.id) && !rule.reply.includes(LINK) && !rule.reply.includes("comercial@");
    return withTail ? { message: `${rule.reply}\n\n${FLOW.tail}`, keys: [ruleKey, "flow:ask"] } : { message: rule.reply, keys: [ruleKey] };
  }

  // 3) Nenhuma regra: começa o fluxo, repete a pergunta uma vez ou manda a resposta padrão.
  if (flowOn && state === null) return { message: FLOW.start, keys: ["flow:ask"] };
  if (flowOn && (state === "flow:ask" || state?.startsWith("flow:confirm:"))) return { message: FLOW.reask, keys: ["flow:reask"] };
  if (!settings.fallbackEnabled) return { skip: "no_rule" };
  if (sentWithin("fallback", FALLBACK_COOLDOWN_MS)) return { skip: "cooldown", ruleKey: "fallback" };
  // Depois de perguntar duas vezes sem resposta útil, encerra a etapa e manda para o WhatsApp.
  return { message: settings.fallbackMessage?.trim() || DEFAULT_FALLBACK, keys: waiting ? ["fallback", "flow:done"] : ["fallback"] };
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
  const conn = await db.getDb();
  if (!conn) return { sent: false, reason: "no_db" };

  // Tudo o que já foi enviado a essa pessoa nas últimas 24 h (cooldowns e etapa do fluxo).
  const history = await conn.select({ ruleKey: dmAutoReplyLog.ruleKey, sentAt: dmAutoReplyLog.sentAt }).from(dmAutoReplyLog)
    .where(and(eq(dmAutoReplyLog.igAccountId, input.igAccountId), eq(dmAutoReplyLog.senderId, input.senderId), gte(dmAutoReplyLog.sentAt, new Date(Date.now() - FLOW_TTL_MS))))
    .orderBy(desc(dmAutoReplyLog.sentAt), desc(dmAutoReplyLog.id)).limit(50);

  const decision = decideDmReply(input.text, settings, history);
  if ("skip" in decision) return { sent: false, reason: decision.skip, ruleKey: decision.ruleKey };

  // Envia pela página (igual à segunda DM) e registra as chaves (regra e/ou etapa do fluxo).
  const link = settings.whatsappLink?.trim() || "pelo link da bio";
  const body = decision.message.split(LINK).join(link).slice(0, 1000);
  const from = igConnection.facebookPageId ?? igConnection.instagramAccountId ?? input.igAccountId;
  const res = await fetch(`https://graph.facebook.com/v25.0/${from}/messages?access_token=${encodeURIComponent(igConnection.accessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: input.senderId }, message: { text: body }, messaging_type: "RESPONSE" }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error("[DmAutoReply] erro ao enviar:", JSON.stringify(data));
    return { sent: false, reason: "send_error", error: data };
  }
  await conn.insert(dmAutoReplyLog).values(decision.keys.map((ruleKey) => ({ igAccountId: input.igAccountId, senderId: input.senderId, ruleKey })));
  console.log(`[DmAutoReply] respondido: ${decision.keys.join(" + ")} → ${input.senderId}`);
  return { sent: true, ruleKey: decision.keys[0] };
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
      flowEnabled: row?.flowEnabled ?? false,
      // Para o botão "Usar as respostas do script da Ane" na tela.
      defaults: { rules: DEFAULT_RULES, fallbackMessage: DEFAULT_FALLBACK },
    };
  }),

  save: protectedProcedure
    .input(z.object({
      enabled: z.boolean(),
      whatsappLink: z.string().trim().max(500).refine((v) => !v || /^https:\/\//i.test(v), "Use um link que comece com https://"),
      fallbackEnabled: z.boolean(),
      fallbackMessage: z.string().trim().min(1).max(1000),
      rules: z.array(ruleSchema).max(30),
      flowEnabled: z.boolean().default(false),
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
