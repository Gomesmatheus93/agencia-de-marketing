import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { commentAutomations, dmAutoReplySettings } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Automação de comentários anexada a uma postagem agendada.
//
// Antes de publicar, o post ainda não tem ID no Instagram (igPostId). A automação é
// gravada com igPostId = "pending:<id da postagem>" e status "scheduled"; quando a
// postagem é publicada (qualquer caminho que grava igMediaId em updateSocialPost),
// db.activatePendingCommentAutomations troca pelo ID real e passa a status "active".

export const PENDING_PREFIX = "pending:";
export const pendingPostId = (socialPostId: number) => `${PENDING_PREFIX}${socialPostId}`;

export const scheduledCommentAutomationSchema = z
  .object({
    keywords: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
    publicReplyMessage: z.string().trim().min(1).max(1000),
    dmFirstMessage: z.string().trim().min(1).max(1000),
    dmFollowupMessage: z.string().trim().max(1000).optional(),
    dmLink: z.string().trim().max(500).refine((v) => !v || /^https:\/\//i.test(v), "O link precisa começar com https://").optional(),
  })
  .optional();

export type ScheduledCommentAutomationInput = NonNullable<z.infer<typeof scheduledCommentAutomationSchema>>;

/** Grava a automação "aguardando publicação" da postagem. */
export async function createPendingCommentAutomation(
  userId: number,
  socialPostId: number,
  input: ScheduledCommentAutomationInput,
  post: { caption?: string | null; thumbnailUrl?: string | null },
) {
  const connection = await db.getInstagramConnection(userId);
  if (!connection?.instagramAccountId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conecte o Instagram para usar a automação de comentários." });
  }
  const conn = await db.getDb();
  if (!conn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  await conn.insert(commentAutomations).values({
    userId,
    igAccountId: connection.instagramAccountId,
    igPostId: pendingPostId(socialPostId),
    postCaption: post.caption?.slice(0, 500) ?? null,
    postThumbnailUrl: post.thumbnailUrl ?? null,
    keywords: input.keywords.map((k) => k.trim().toLowerCase()),
    publicReplyMessage: input.publicReplyMessage,
    dmFirstMessage: input.dmFirstMessage,
    dmFollowupMessage: input.dmFollowupMessage || null,
    dmLink: input.dmLink || null,
    status: "scheduled",
  });
}

/** Sugestão para o formulário: textos da última automação da conta (e o link curto, se houver). */
export async function lastAutomationTemplate(userId: number) {
  const conn = await db.getDb();
  const [last] = conn ? await conn.select().from(commentAutomations).where(eq(commentAutomations.userId, userId)).orderBy(desc(commentAutomations.id)).limit(1) : [];
  const [dm] = conn ? await conn.select({ slug: dmAutoReplySettings.shortSlug }).from(dmAutoReplySettings).where(eq(dmAutoReplySettings.userId, userId)) : [];
  const shortLink = dm?.slug ? `${ENV.appBaseUrl.replace(/\/+$/, "")}/wa/${dm.slug}` : null;
  return {
    keywords: last?.keywords?.length ? last.keywords : ["energia"],
    publicReplyMessage: last?.publicReplyMessage ?? "Oi! Te mandei uma mensagem no Direct 😁",
    dmFirstMessage: last?.dmFirstMessage ?? "Olá! Me responde aqui que eu te mando o link pra falar com a Ane no WhatsApp 💜",
    dmFollowupMessage: last?.dmFollowupMessage ?? "Aqui está o link",
    dmLink: shortLink ?? last?.dmLink ?? "",
  };
}
