import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) for (const [k, e] of cache) if (Date.now() - e.at > STALE_MAX_MS) cache.delete(k);
  return value;
}

const conversationId = z.string().regex(/^[\w-]{5,200}$/, "Conversa inválida.");

export const inboxRouter = router({
  conversations: protectedProcedure.query(async ({ ctx }) => {
    const conn = await ownConnection(ctx.user.id);
    if (!conn) return { connected: false as const, conversations: [] };
    const res = await cached(`list:${ctx.user.id}`, 20_000, () => graph<{ data?: GraphConversation[] }>(
      `/${conn.pageId}/conversations?platform=instagram&limit=25&fields=updated_time,participants,messages.limit(1){message,from,created_time}`,
      conn.token,
    ));
    return {
      connected: true as const,
      account: conn.username,
      conversations: (res.data ?? []).map((c) => {
        const customer = c.participants?.data?.find((p) => p.id !== conn.igId);
        const last = c.messages?.data?.[0];
        return {
          id: c.id,
          updatedTime: c.updated_time,
          customer: customer ? { id: customer.id, username: customer.username ?? customer.name ?? customer.id } : null,
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
      const { conv, customer } = await cached(`conv:${ctx.user.id}:${input.conversationId}`, 8_000, () => ownConversation(conn, input.conversationId));
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
      return { customer: customer ? { id: customer.id, username: customer.username ?? customer.name ?? customer.id } : null, messages, canReply };
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
