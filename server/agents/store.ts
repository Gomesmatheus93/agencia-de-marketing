import { and, asc, desc, eq } from "drizzle-orm";
import { agentFiles, agentMessages, agentThreads, type AgentMessage, type AgentThread } from "../../drizzle/schema";
import { getDb } from "../db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

// ─── Threads ──────────────────────────────────────────────────────────────────

export async function createThread(
  userId: number,
  agentSlug: string,
  title: string,
  task?: { input: Record<string, unknown> }
): Promise<AgentThread> {
  const db = await requireDb();
  const [thread] = await db.insert(agentThreads).values({
    userId, agentSlug, title: title.slice(0, 255),
    ...(task ? { mode: "task" as const, taskInput: task.input } : {}),
  }).returning();
  return thread;
}

export async function listThreads(userId: number, agentSlug: string, mode: AgentThread["mode"] = "chat"): Promise<AgentThread[]> {
  const db = await requireDb();
  return db.select().from(agentThreads)
    .where(and(eq(agentThreads.userId, userId), eq(agentThreads.agentSlug, agentSlug), eq(agentThreads.mode, mode)))
    .orderBy(desc(agentThreads.updatedAt));
}

export async function getThread(userId: number, threadId: number): Promise<AgentThread | undefined> {
  const db = await requireDb();
  const [thread] = await db.select().from(agentThreads)
    .where(and(eq(agentThreads.id, threadId), eq(agentThreads.userId, userId)))
    .limit(1);
  return thread;
}

export async function setThreadStatus(threadId: number, status: AgentThread["status"], lastError: string | null = null) {
  const db = await requireDb();
  await db.update(agentThreads).set({ status, lastError }).where(eq(agentThreads.id, threadId));
}

export async function setThreadResult(threadId: number, result: Record<string, unknown>) {
  const db = await requireDb();
  await db.update(agentThreads).set({ result }).where(eq(agentThreads.id, threadId));
}

export async function deleteThread(userId: number, threadId: number) {
  const db = await requireDb();
  const thread = await getThread(userId, threadId);
  if (!thread) return;
  await db.delete(agentMessages).where(eq(agentMessages.threadId, threadId));
  await db.delete(agentThreads).where(eq(agentThreads.id, threadId));
}

/** Turnos interrompidos por um restart do servidor nunca terminam sozinhos. */
export async function failStaleRuns() {
  const db = await requireDb();
  await db.update(agentThreads)
    .set({ status: "failed", lastError: "Execução interrompida (o servidor reiniciou). Envie a mensagem de novo." })
    .where(eq(agentThreads.status, "running"));
}

// ─── Mensagens ────────────────────────────────────────────────────────────────

export async function addMessage(
  threadId: number,
  role: AgentMessage["role"],
  content: unknown[],
  extra: { approval?: AgentMessage["approval"]; usage?: Record<string, unknown> } = {}
): Promise<AgentMessage> {
  const db = await requireDb();
  const [message] = await db.insert(agentMessages)
    .values({ threadId, role, content, approval: extra.approval ?? null, usage: extra.usage ?? null })
    .returning();
  await db.update(agentThreads).set({ updatedAt: new Date() }).where(eq(agentThreads.id, threadId));
  return message;
}

export async function listMessages(threadId: number): Promise<AgentMessage[]> {
  const db = await requireDb();
  return db.select().from(agentMessages).where(eq(agentMessages.threadId, threadId)).orderBy(asc(agentMessages.id));
}

export async function setApproval(userId: number, messageId: number, approval: "approved" | "rejected" | "pending") {
  const db = await requireDb();
  const [message] = await db.select().from(agentMessages).where(eq(agentMessages.id, messageId)).limit(1);
  if (!message || !(await getThread(userId, message.threadId))) throw new Error("Mensagem não encontrada");
  await db.update(agentMessages).set({ approval }).where(eq(agentMessages.id, messageId));
}

// ─── Memória (arquivos) ───────────────────────────────────────────────────────

export async function listFiles(userId: number) {
  const db = await requireDb();
  return db.select({ path: agentFiles.path, updatedAt: agentFiles.updatedAt, size: agentFiles.content })
    .from(agentFiles).where(eq(agentFiles.userId, userId)).orderBy(asc(agentFiles.path))
    .then((rows) => rows.map((r) => ({ path: r.path, updatedAt: r.updatedAt, size: r.size.length })));
}

export async function readFile(userId: number, path: string): Promise<string | null> {
  const db = await requireDb();
  const [row] = await db.select().from(agentFiles)
    .where(and(eq(agentFiles.userId, userId), eq(agentFiles.path, path))).limit(1);
  return row?.content ?? null;
}

export async function writeFile(userId: number, path: string, content: string) {
  const db = await requireDb();
  await db.insert(agentFiles).values({ userId, path, content })
    .onConflictDoUpdate({ target: [agentFiles.userId, agentFiles.path], set: { content, updatedAt: new Date() } });
}

export async function deleteFile(userId: number, path: string) {
  const db = await requireDb();
  await db.delete(agentFiles).where(and(eq(agentFiles.userId, userId), eq(agentFiles.path, path)));
}

// ─── Escritório (visão ao vivo de todos os agentes) ───────────────────────────

export type AgentActivity = {
  agentSlug: string;
  threadId: number | null;
  threadTitle: string | null;
  state: "idle" | "thinking" | "tool" | "waiting_approval" | "failed";
  tool: { name: string; detail: string } | null;
  error: string | null;
  updatedAt: Date | null;
};

type Block = { type: string; name?: string; input?: Record<string, unknown> };

function toolDetail(b: Block): string {
  const i = b.input ?? {};
  return String(i.script ?? i.path ?? i.name ?? (i.limit ? `${i.limit} posts` : ""));
}

/** O que o agente está fazendo agora nesta conversa. */
export async function activityOf(thread: AgentThread): Promise<AgentActivity> {
  const db = await requireDb();
  const base = { agentSlug: thread.agentSlug, threadId: thread.id, threadTitle: thread.title, tool: null, error: null, updatedAt: thread.updatedAt };
  if (thread.status === "failed") return { ...base, state: "failed", error: thread.lastError };
  if (thread.status === "running") {
    const [last] = await db.select().from(agentMessages)
      .where(eq(agentMessages.threadId, thread.id)).orderBy(desc(agentMessages.id)).limit(1);
    // Último bloco do assistente com pedido de ferramenta e ainda sem resultado = executando.
    const tools = last?.role === "assistant" ? (last.content as Block[]).filter((b) => b.type === "tool_use") : [];
    if (tools.length) {
      const t = tools[tools.length - 1];
      return { ...base, state: "tool", tool: { name: t.name ?? "", detail: toolDetail(t) } };
    }
    return { ...base, state: "thinking" };
  }
  const [pending] = await db.select({ id: agentMessages.id }).from(agentMessages)
    .where(and(eq(agentMessages.threadId, thread.id), eq(agentMessages.approval, "pending"))).limit(1);
  return { ...base, state: pending ? "waiting_approval" : "idle" };
}

/** O que cada agente está fazendo agora, a partir da conversa mais recente dele. */
export async function officeSnapshot(userId: number, agentSlugs: string[]): Promise<AgentActivity[]> {
  const db = await requireDb();
  return Promise.all(agentSlugs.map(async (agentSlug): Promise<AgentActivity> => {
    const [thread] = await db.select().from(agentThreads)
      .where(and(eq(agentThreads.userId, userId), eq(agentThreads.agentSlug, agentSlug)))
      .orderBy(desc(agentThreads.updatedAt)).limit(1);
    if (!thread) return { agentSlug, threadId: null, threadTitle: null, state: "idle", tool: null, error: null, updatedAt: null };
    return activityOf(thread);
  }));
}
