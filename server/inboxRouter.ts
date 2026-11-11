import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { dmAutoReplyLog } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// Direct do Instagram dentro da plataforma: lê as conversas direto da API da Meta
// (nada fica guardado no banco) e responde pela página do Facebook, o mesmo
// caminho da segunda DM das automações.

const GRAPH = "https://graph.facebook.com/v25.0";
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000; // a Meta só deixa responder até 24 h depois da última mensagem do cliente

type GraphUser = { id: string; username?: string; name?: string };
type GraphMessage = { id: string; message?: string; from?: GraphUser; created_time: string; attachments?: { data?: Array<{ image_data?: { url?: string }; video_data?: { url?: string }; file_url?: string }> } };
type GraphConversation = { id: string; updated_time: string; participants?: { data?: GraphUser[] }; messages?: { data?: GraphMessage[] } };

async function graph<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || body.error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Instagram: ${body.error?.message ?? `erro ${res.status}`}` });
  }
  return body;
}

/** Conexão do Instagram do usuário logado (sempre pelo ctx, nunca pelo input). */
async function ownConnection(userId: number) {
  const conn = await db.getInstagramConnection(userId);
  if (!conn?.accessToken || !conn.facebookPageId || !conn.instagramAccountId) return null;
  return { token: conn.accessToken, pageId: conn.facebookPageId, igId: conn.instagramAccountId, username: conn.username ?? null };
}

async function requireConnection(userId: number) {
  const conn = await ownConnection(userId);
  if (!conn) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conecte o Instagram (com a página do Facebook) para ver o Direct." });
  return conn;
}

/** Garante que a conversa é da conta do usuário e devolve quem é o cliente nela. */
async function ownConversation(conn: { token: string; igId: string }, conversationId: string, messageLimit = 50) {
  const conv = await graph<GraphConversation>(
    `/${conversationId}?fields=participants,updated_time,messages.limit(${messageLimit}){id,message,from,created_time,attachments}`,
    conn.token,
  );
  const people = conv.participants?.data ?? [];
  if (!people.some((p) => p.id === conn.igId)) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
  const customer = people.find((p) => p.id !== conn.igId) ?? null;
  return { conv, customer };
}

// ─── Cache em memória ────────────────────────────────────────────────────────
// A API da Meta leva de 3 a 11 s para listar conversas. Guardamos a última
// resposta por usuário: dentro do prazo ela volta na hora; depois do prazo ela
// ainda volta na hora (por até STALE_MAX_MS) e uma busca nova roda por trás.
const STALE_MAX_MS = 10 * 60 * 1000;
type Entry = { at: number; value: unknown; pending?: Promise<unknown> };
const cache = new Map<string, Entry>();
// Buscas sem nada guardado ainda, em andamento: pedidos ao mesmo tempo esperam a mesma busca.
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < ttlMs) return hit.value as T;
  if (hit && age < STALE_MAX_MS) {
    hit.pending ??= load()
      .then((value) => { cache.set(key, { at: Date.now(), value }); return value; })
      .catch(() => { hit.pending = undefined; return hit.value; });
    return hit.value as T;
  }
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const promise = load()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 500) for (const [k, e] of cache) if (Date.now() - e.at > STALE_MAX_MS) cache.delete(k);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// ─── Foto de perfil de quem manda DM ─────────────────────────────────────────
// A API de conversas não traz a foto; ela vem de GET /{igsid}?fields=profile_pic
// (só para quem já mandou mensagem pra conta). Guardada por 12 h e buscada por
// trás, para não atrasar a lista. O link da Meta expira em alguns dias.
const PIC_TTL_MS = 12 * 60 * 60 * 1000;
const pics = new Map<string, { at: number; url: string | null }>();
const picLoading = new Map<string, Promise<void>>();

function loadPic(id: string, token: string) {
  const hit = pics.get(id);
  if (hit && Date.now() - hit.at < PIC_TTL_MS) return Promise.resolve();
  let p = picLoading.get(id);
  if (!p) {
    p = graph<{ profile_pic?: string }>(`/${id}?fields=profile_pic`, token)
      .then((r) => { pics.set(id, { at: Date.now(), url: r.profile_pic ?? null }); })
      .catch(() => { pics.set(id, { at: Date.now(), url: hit?.url ?? null }); })
      .finally(() => picLoading.delete(id));
    picLoading.set(id, p);
    if (pics.size > 2000) for (const [k, e] of pics) if (Date.now() - e.at > PIC_TTL_MS) pics.delete(k);
  }
  return p;
}

/** Fotos dos clientes: espera no máximo `waitMs` pelas que faltam; o resto aparece na próxima atualização. */
async function picsFor(ids: string[], token: string, waitMs: number) {
  const missing = ids.filter((id) => !pics.has(id));
  const all = Promise.all(ids.map((id) => loadPic(id, token)));
  if (missing.length) await Promise.race([all, new Promise((r) => setTimeout(r, waitMs))]);
  return (id: string) => pics.get(id)?.url ?? null;
}

// ─── Sinal de "chegou mensagem" ──────────────────────────────────────────────
// O webhook da Meta (via n8n → /api/automations/dm-received) avisa cada DM. Aqui
// a gente descarta o cache daquela conta, já busca a lista nova por trás e marca
// a hora da atividade; a tela consulta essa hora a cada poucos segundos (consulta
// leve, sem chamar a Meta) e atualiza na hora em que muda.
const activity = new Map<number, number>();

function loadList(userId: number, conn: { token: string; pageId: string }) {
  return cached(`list:${userId}`, 20_000, () => graph<{ data?: GraphConversation[] }>(
    `/${conn.pageId}/conversations?platform=instagram&limit=25&fields=updated_time,participants,messages.limit(1){message,from,created_time}`,
    conn.token,
  ));
}
function loadConversation(userId: number, conn: { token: string; igId: string }, id: string) {
  return cached(`conv:${userId}:${id}`, 8_000, () => ownConversation(conn, id));
}

/** Busca de novo, ignorando o cache, e guarda o resultado (sem apagar o antigo antes). */
async function refresh<T>(key: string, load: () => Promise<T>) {
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Avisos que chegam juntos (várias mensagens seguidas) viram uma busca só.
const refreshing = new Map<number, Promise<void>>();

export async function notifyInboxActivity(igAccountId: string) {
  const ig = await db.getInstagramConnectionByIgId(igAccountId);
  if (!ig) return;
  const userId = ig.userId;
  const conn = await ownConnection(userId);
  if (!conn) return;
  const prev = refreshing.get(userId);
  if (prev) { await prev; } // espera a busca em andamento e faz mais uma, para pegar a mensagem nova
  const run = (async () => {
    // Recarrega a lista e as conversas abertas há pouco (as que alguém está olhando) e só
    // depois marca a atividade: a tela, ao ver a mudança, já recebe os dados novos na hora.
    const open = [...cache.entries()]
      .filter(([k, e]) => k.startsWith(`conv:${userId}:`) && Date.now() - e.at < 2 * 60_000)
      .map(([k]) => k.slice(`conv:${userId}:`.length));
    await Promise.allSettled([
      refresh(`list:${userId}`, () => graph<{ data?: GraphConversation[] }>(
        `/${conn.pageId}/conversations?platform=instagram&limit=25&fields=updated_time,participants,messages.limit(1){message,from,created_time}`,
        conn.token,
      )),
      ...open.map((id) => refresh(`conv:${userId}:${id}`, () => ownConversation(conn, id))),
    ]);
    activity.set(userId, Date.now());
  })().finally(() => refreshing.delete(userId));
  refreshing.set(userId, run);
  await run;
}

const conversationId = z.string().regex(/^[\w-]{5,200}$/, "Conversa inválida.");

export const inboxRouter = router({
  /** Hora da última DM avisada pelo webhook (consulta leve, sem chamar a Meta). */
  activity: protectedProcedure.query(({ ctx }) => ({ at: activity.get(ctx.user.id) ?? 0 })),

  conversations: protectedProcedure.query(async ({ ctx }) => {
    const conn = await ownConnection(ctx.user.id);
    if (!conn) return { connected: false as const, conversations: [] };
    const res = await loadList(ctx.user.id, conn);
    const customerIds = (res.data ?? []).map((c) => c.participants?.data?.find((p) => p.id !== conn.igId)?.id).filter((id): id is string => Boolean(id));
    const picOf = await picsFor(customerIds, conn.token, 2_500);
    return {
      connected: true as const,
      account: conn.username,
      conversations: (res.data ?? []).map((c) => {
        const customer = c.participants?.data?.find((p) => p.id !== conn.igId);
        const last = c.messages?.data?.[0];
        return {
          id: c.id,
          updatedTime: c.updated_time,
          customer: customer ? { id: customer.id, username: customer.username ?? customer.name ?? customer.id, profilePic: picOf(customer.id) } : null,
          lastMessage: last?.message || (last ? "📎 anexo" : ""),
          lastFromMe: last?.from?.id === conn.igId,
        };
      }),
    };
  }),

  messages: protectedProcedure
    .input(z.object({ conversationId }))
    .query(async ({ ctx, input }) => {
      const conn = await requireConnection(ctx.user.id);
      const { conv, customer } = await loadConversation(ctx.user.id, conn, input.conversationId);
      const picOf = await picsFor(customer ? [customer.id] : [], conn.token, 2_000);
      const messages = (conv.messages?.data ?? [])
        .map((m) => {
          const att = m.attachments?.data?.[0];
          return {
            id: m.id,
            text: m.message ?? "",
            fromMe: m.from?.id === conn.igId,
            createdTime: m.created_time,
            attachmentUrl: att?.image_data?.url ?? att?.video_data?.url ?? att?.file_url ?? null,
          };
        })
        .reverse(); // a Meta devolve da mais nova para a mais antiga
      const lastFromCustomer = [...messages].reverse().find((m) => !m.fromMe);
      const canReply = Boolean(lastFromCustomer && Date.now() - new Date(lastFromCustomer.createdTime).getTime() < REPLY_WINDOW_MS);
      return { customer: customer ? { id: customer.id, username: customer.username ?? customer.name ?? customer.id, profilePic: picOf(customer.id) } : null, messages, canReply };
    }),

  /**
   * Zera o atendimento automático desta conversa (cooldowns de 12/24 h e etapa do fluxo):
   * a próxima mensagem da pessoa é tratada como a primeira. Útil para testar.
   */
  resetAutoReply: protectedProcedure
    .input(z.object({ conversationId }))
    .mutation(async ({ ctx, input }) => {
      const conn = await requireConnection(ctx.user.id);
      const { customer } = await ownConversation(conn, input.conversationId, 1);
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Não achei o cliente desta conversa." });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const removed = await database.delete(dmAutoReplyLog)
        .where(and(eq(dmAutoReplyLog.igAccountId, conn.igId), eq(dmAutoReplyLog.senderId, customer.id)))
        .returning({ id: dmAutoReplyLog.id });
      return { removed: removed.length };
    }),

  reply: protectedProcedure
    .input(z.object({ conversationId, text: z.string().trim().min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const conn = await requireConnection(ctx.user.id);
      const { customer } = await ownConversation(conn, input.conversationId, 1);
      if (!customer) throw new TRPCError({ code: "BAD_REQUEST", message: "Não achei o cliente desta conversa." });
      const sent = await graph<{ message_id?: string }>(`/${conn.pageId}/messages`, conn.token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: customer.id }, message: { text: input.text }, messaging_type: "RESPONSE" }),
      });
      // A mensagem nova precisa aparecer já: descarta o que estava guardado.
      cache.delete(`conv:${ctx.user.id}:${input.conversationId}`);
      cache.delete(`list:${ctx.user.id}`);
      return { messageId: sent.message_id ?? null };
    }),
});
