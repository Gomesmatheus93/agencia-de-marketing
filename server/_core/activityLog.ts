import { and, desc, eq, gte, inArray, like, not, or, sql, type SQL } from "drizzle-orm";
import { agentThreads, auditLog } from "../../drizzle/schema";
import * as db from "../db";
import * as store from "../agents/store";
import { deviceLabel } from "./deviceContext";

// Registros de acesso e de alterações para o painel do super admin.
// Acessos: login.*, sso.login e logout. Alterações: "change" (gravado por
// auditChanges em trpc.ts) mais as ações de admin e das unidades.

const ACCESS_ACTIONS = ["login.success", "login.2fa_success", "sso.login", "logout", "login.failed", "login.locked", "login.2fa_challenge", "login.2fa_locked",
  // Abrir e baixar materiais das unidades também é acesso (não muda nada).
  "unit.plan.view", "unit.plan.download", "unit.material.view", "unit.material.download"];

const ACTION_LABEL: Record<string, string> = {
  "login.success": "Entrou na plataforma",
  "login.2fa_success": "Entrou na plataforma (com código)",
  "login.2fa_challenge": "Pediu código de acesso",
  "sso.login": "Entrou pelo sistema da Alle",
  "logout": "Saiu da plataforma",
  "login.failed": "Errou a senha",
  "login.locked": "Login bloqueado por tentativas",
  "login.2fa_locked": "Código bloqueado por tentativas",
  "admin.set_role": "Mudou a função de um usuário",
  "admin.set_plan": "Mudou o plano de um usuário",
  "admin.reactivate": "Reativou uma conta",
  "admin.deactivate": "Desativou uma conta",
  "admin.delete_user": "Excluiu um usuário",
  "admin.set_password": "Trocou a senha de um usuário",
  "password.reset_requested": "Pediu para redefinir a senha",
  "password.reset": "Redefiniu a senha pelo e-mail",
  "unit.plan.view": "Abriu o plano da semana da unidade",
  "unit.plan.download": "Baixou uma arte do plano da unidade",
  "unit.plan.posted": "Marcou um post da unidade como publicado",
  "unit.plan.saved": "Salvou o plano da semana de uma unidade",
  "unit.plan.published": "Liberou o plano da semana para a unidade",
  "unit.plan.ai": "Pediu o plano da unidade à IA",
  "unit.material.view": "Abriu um material da unidade",
  "unit.material.download": "Baixou um material da unidade",
  "unit.kit.generated": "Gerou o mídia kit de uma unidade",
  "unit.kit.approved": "Aprovou o mídia kit de uma unidade",
  "unit.kit.deleted": "Excluiu um mídia kit",
  "unit.support.opened": "Abriu um chamado de suporte",
  "unit.created": "Cadastrou uma unidade",
  "unit.updated": "Editou uma unidade",
};

// Rotas mais comuns em português; as outras aparecem pelo nome técnico.
const PATH_LABEL: Record<string, string> = {
  "agents.updatePlanItem": "Editou uma pauta do planejamento",
  "agents.regeneratePlanItem": "Refez uma pauta com o agente",
  "agents.planToCalendar": "Enviou pautas ao calendário",
  "agents.startTask": "Pediu um conteúdo a um agente",
  "agents.sendMessage": "Mandou mensagem a um agente",
  "agents.saveArt": "Editou uma arte",
  "agents.undoArtEdit": "Desfez a edição de uma arte",
  "agents.editCaption": "Editou uma legenda",
  "agents.writeFile": "Alterou a memória dos agentes",
  "editorialPlan.updateItem": "Editou uma pauta do calendário",
  "editorialPlan.deleteItem": "Excluiu uma pauta do calendário",
  "editorialPlan.deleteByDate": "Excluiu as pautas de um dia",
  "editorialPlan.savePlan": "Salvou um plano no calendário",
  "editorialPlan.generatePlan": "Gerou um plano do mês",
  "posts.create": "Criou um post",
  "posts.update": "Editou um post",
  "posts.delete": "Excluiu um post",
  "posts.sendForApproval": "Mandou um post para aprovação",
  "team.create": "Criou um acesso da equipe",
  "team.setActive": "Ativou ou desativou um acesso da equipe",
  "team.remove": "Removeu um acesso da equipe",
  "profile.update": "Atualizou o próprio perfil",
  "unitArt.applyModel": "Trocou o modelo de uma arte das unidades",
  "unitPortal.selectUnit": "Trocou de unidade no portal",
  "unitPortal.markPosted": "Marcou um post da unidade como publicado",
  "ctas.create": "Cadastrou um CTA",
  "ctas.update": "Editou um CTA",
  "ctas.remove": "Excluiu um CTA",
  "ctas.addSuggestions": "Salvou CTAs sugeridos pelo agente",
  "ctas.createArt": "Pediu uma arte a partir de um CTA",
  "motion.fromTemplate": "Criou um vídeo motion a partir de um modelo",
  "motion.create": "Criou um vídeo motion com roteiro",
  "motion.update": "Editou um vídeo motion",
  "motion.rerender": "Renderizou de novo um vídeo motion",
  "motion.duplicate": "Duplicou um vídeo motion",
  "motion.remove": "Excluiu um vídeo motion",
  "motion.publish": "Publicou ou programou um vídeo motion no Instagram",
  "motion.cancelPublication": "Cancelou a programação de um vídeo motion",
  "agents.publishOutput": "Publicou ou programou uma arte no Instagram",
};

export function actionLabel(action: string, path?: string) {
  if (action === "change" && path) return PATH_LABEL[path] ?? path;
  return ACTION_LABEL[action] ?? action.replace(/^unit\./, "Unidades: ");
}

export async function listActivity(opts: { kind: "all" | "access" | "change"; actorId?: number; deviceId?: string; days: number; limit: number }) {
  const c = await db.getDb();
  if (!c) return [];
  const since = new Date(Date.now() - opts.days * 86_400_000);
  const where: SQL[] = [gte(auditLog.createdAt, since)];
  if (opts.actorId) where.push(eq(auditLog.actorUserId, opts.actorId));
  if (opts.deviceId) where.push(sql`${auditLog.metadata}->>'deviceId' = ${opts.deviceId}`);
  if (opts.kind === "access") where.push(inArray(auditLog.action, ACCESS_ACTIONS));
  if (opts.kind === "change") {
    where.push(not(inArray(auditLog.action, ACCESS_ACTIONS)));
    // Abrir e baixar material das unidades é acesso, não alteração.
    where.push(or(not(like(auditLog.action, "unit.%")), not(or(like(auditLog.action, "%.view"), like(auditLog.action, "%.download"))!))!);
  }
  const rows = await c.select().from(auditLog).where(and(...where)).orderBy(desc(auditLog.createdAt)).limit(opts.limit);

  // Nome e e-mail de quem fez e da conta afetada (ficam cifrados no banco).
  const ids = [...new Set(rows.flatMap((r) => [r.actorUserId, r.targetUserId]).filter((x): x is number => typeof x === "number"))];
  const people = new Map<number, { name: string | null; email: string | null }>();
  await Promise.all(ids.map(async (id) => {
    const u = await db.getUserById(id);
    if (u) people.set(id, { name: u.name ?? null, email: u.email ?? null });
  }));

  // Título da arte ou do plano em que mexeram (no lugar de só "#238").
  const threadIds = [...new Set(rows.map((r) => Number(((r.metadata ?? {}) as { input?: { threadId?: unknown } }).input?.threadId)).filter((n) => Number.isInteger(n) && n > 0))];
  const titles = new Map<number, string>();
  if (threadIds.length) {
    const ts = await c.select({ id: agentThreads.id, title: agentThreads.title, result: agentThreads.result }).from(agentThreads).where(inArray(agentThreads.id, threadIds));
    for (const t of ts) titles.set(t.id, String((t.result as { title?: unknown } | null)?.title ?? t.title));
  }

  // Primeiro registro de cada pessoa em cada aparelho (para o selo "aparelho novo").
  const devices = [...new Set(rows.map((r) => (r.metadata as { deviceId?: string } | null)?.deviceId).filter((d): d is string => Boolean(d)))];
  const firstSeen = new Map<string, number>();
  if (devices.length) {
    const fs = await c.select({ actor: auditLog.actorUserId, device: sql<string>`${auditLog.metadata}->>'deviceId'`, first: sql<number>`min(${auditLog.id})` })
      .from(auditLog).where(inArray(sql`${auditLog.metadata}->>'deviceId'`, devices))
      .groupBy(auditLog.actorUserId, sql`${auditLog.metadata}->>'deviceId'`);
    for (const f of fs) firstSeen.set(`${f.actor}:${f.device}`, Number(f.first));
  }

  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as { path?: string; input?: unknown; change?: unknown; deviceId?: string } & Record<string, unknown>;
    const deviceId = typeof meta.deviceId === "string" ? meta.deviceId : null;
    const threadId = Number((meta.input as { threadId?: unknown } | undefined)?.threadId);
    return {
      id: r.id,
      at: r.createdAt,
      kind: ACCESS_ACTIONS.includes(r.action) ? ("access" as const) : ("change" as const),
      action: r.action,
      label: actionLabel(r.action, meta.path),
      path: meta.path ?? null,
      actorId: r.actorUserId,
      actor: r.actorUserId ? people.get(r.actorUserId) ?? null : null,
      target: r.targetUserId && r.targetUserId !== r.actorUserId ? people.get(r.targetUserId) ?? null : null,
      ref: r.targetId,
      ip: r.ip,
      userAgent: r.userAgent,
      details: meta.path ? meta.input ?? null : r.metadata ?? null,
      artTitle: titles.get(threadId) ?? null,
      deviceId,
      device: deviceId ? deviceLabel(deviceId) : null,
      newDevice: Boolean(deviceId && r.actorUserId && firstSeen.get(`${r.actorUserId}:${deviceId}`) === r.id),
      hasChange: Boolean(meta.change),
    };
  });
}

type ArtImage = { url: string; label: string; target: { kind: "slide" | "frame" | "post"; index: number }; previousUrl: string | null };

/** Todas as artes de uma tarefa (slides, quadros ou o post), com a versão anterior guardada de cada uma. */
function artImages(agentSlug: string, result: Record<string, any> | null): ArtImage[] {
  if (!result) return [];
  if (Array.isArray(result.slides)) return result.slides.filter((s: any) => s?.imageUrl).map((s: any, i: number) => ({ url: s.imageUrl, label: `Slide ${i + 1}`, target: { kind: "slide" as const, index: i }, previousUrl: s.previous?.imageUrl ?? null }));
  if (Array.isArray(result.frames)) return result.frames.filter((f: any) => f?.imageUrl).map((f: any, i: number) => ({ url: f.imageUrl, label: `Story ${i + 1}`, target: { kind: "frame" as const, index: i }, previousUrl: f.previous?.imageUrl ?? null }));
  if (typeof result.imageUrl === "string") return [{ url: result.imageUrl, label: agentSlug === "legendas" ? "Post" : "Arte", target: { kind: "post", index: 0 }, previousUrl: result.previous?.imageUrl ?? null }];
  return [];
}

/**
 * Detalhe de um registro: o que mudou (antes e depois, quando a rota anotou) e
 * como a arte, a legenda ou a pauta estão agora.
 */
export async function activityDetail(id: number) {
  const c = await db.getDb();
  if (!c) return null;
  const [row] = await c.select().from(auditLog).where(eq(auditLog.id, id)).limit(1);
  if (!row) return null;
  const meta = (row.metadata ?? {}) as { path?: string; input?: Record<string, any>; change?: Record<string, unknown> };
  const input = meta.input ?? {};
  const threadId = Number(input.threadId);
  const ownerId = row.targetUserId ?? row.actorUserId;

  let art: null | { threadId: number; title: string; agentSlug: string; images: ArtImage[]; caption: string | null; hashtags: string[]; focus: { kind: string; index: number } | null } = null;
  let planItem: null | { index: number; item: Record<string, unknown> | null; arts: Array<{ threadId: number; title: string; images: string[] }> } = null;

  if (Number.isInteger(threadId) && ownerId) {
    const thread = await store.getThread(ownerId, threadId);
    if (thread) {
      const result = (thread.result ?? null) as Record<string, any> | null;
      if (thread.agentSlug === "planejamento") {
        const index = Number(input.index);
        if (Number.isInteger(index)) {
          const outputs = await store.listPlanOutputs(ownerId, threadId);
          planItem = {
            index,
            item: result?.items?.[index] ?? null,
            arts: outputs.filter((t) => (t.taskInput as { planLink?: { index?: number } } | null)?.planLink?.index === index)
              .map((t) => ({ threadId: t.id, title: String((t.result as any)?.title ?? t.title), images: artImages(t.agentSlug, t.result as any).map((i) => i.url).slice(0, 10) })),
          };
        }
      } else {
        const target = input.target && typeof input.target === "object" ? { kind: String(input.target.kind), index: Number(input.target.index ?? 0) } : null;
        art = {
          threadId, title: String(result?.title ?? thread.title), agentSlug: thread.agentSlug,
          images: artImages(thread.agentSlug, result), caption: typeof result?.caption === "string" ? result.caption : null,
          hashtags: Array.isArray(result?.hashtags) ? result.hashtags : [], focus: target,
        };
      }
    }
  }
  return { id: row.id, path: meta.path ?? null, change: meta.change ?? null, art, planItem, deleted: Number.isInteger(threadId) && !art && !planItem };
}
