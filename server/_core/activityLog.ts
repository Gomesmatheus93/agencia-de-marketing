import { and, desc, eq, gte, inArray, like, not, or, type SQL } from "drizzle-orm";
import { auditLog } from "../../drizzle/schema";
import * as db from "../db";

// Registros de acesso e de alterações para o painel do super admin.
// Acessos: login.*, sso.login e logout. Alterações: "change" (gravado por
// auditChanges em trpc.ts) mais as ações de admin e das unidades.

const ACCESS_ACTIONS = ["login.success", "login.2fa_success", "sso.login", "logout", "login.failed", "login.locked", "login.2fa_challenge", "login.2fa_locked"];

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
  "ctas.create": "Cadastrou um CTA",
  "ctas.update": "Editou um CTA",
  "ctas.remove": "Excluiu um CTA",
  "ctas.addSuggestions": "Salvou CTAs sugeridos pelo agente",
  "ctas.createArt": "Pediu uma arte a partir de um CTA",
};

export function actionLabel(action: string, path?: string) {
  if (action === "change" && path) return PATH_LABEL[path] ?? path;
  return ACTION_LABEL[action] ?? action.replace(/^unit\./, "Unidades: ");
}

export async function listActivity(opts: { kind: "all" | "access" | "change"; actorId?: number; days: number; limit: number }) {
  const c = await db.getDb();
  if (!c) return [];
  const since = new Date(Date.now() - opts.days * 86_400_000);
  const where: SQL[] = [gte(auditLog.createdAt, since)];
  if (opts.actorId) where.push(eq(auditLog.actorUserId, opts.actorId));
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

  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as { path?: string; input?: unknown } & Record<string, unknown>;
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
    };
  });
}
