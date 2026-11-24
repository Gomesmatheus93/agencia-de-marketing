import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Loader2, LogIn, Pencil, RefreshCw } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";

type Kind = "all" | "access" | "change";

const select = "h-8 rounded-lg bg-zinc-800 border border-zinc-700 px-2 text-xs text-white";

function when(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Navegador e sistema de forma curta, a partir do user-agent. */
function device(ua: string | null) {
  if (!ua) return "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" · ");
}

/** Resumo do que foi enviado: título, dia ou status quando houver. */
function summary(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const d = details as Record<string, any>;
  const item = d.item && typeof d.item === "object" ? d.item : null;
  const parts = [
    item?.title ?? d.title ?? d.name ?? d.suggestedTitle,
    item?.date ?? d.scheduledDate ?? d.date,
    d.status, d.plan, d.role,
    d.target?.kind ? `${d.target.kind === "slide" ? "slide" : d.target.kind === "frame" ? "story" : "post"}${typeof d.target.index === "number" && d.target.kind !== "post" ? ` ${d.target.index + 1}` : ""}` : null,
    typeof d.index === "number" && !item ? `pauta ${d.index + 1}` : null,
  ].filter((x) => x != null && x !== "");
  return parts.join(" · ");
}

export function ActivityLog({ initialActorId, initialActorLabel }: { initialActorId?: number; initialActorLabel?: string } = {}) {
  const [kind, setKind] = useState<Kind>("all");
  const [actorId, setActorId] = useState<number | undefined>(initialActorId);
  useEffect(() => { setActorId(initialActorId); }, [initialActorId]);
  const [days, setDays] = useState(7);
  const [open, setOpen] = useState<number | null>(null);
  const q = trpc.admin.activityLog.useQuery({ kind, actorId, days, limit: 1000 });
  const rows = q.data ?? [];

  // Pessoas que aparecem no período (para o filtro), sem depender da lista inteira de usuários.
  const people = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rows) if (r.actorId && r.actor) m.set(r.actorId, r.actor.name || r.actor.email || `#${r.actorId}`);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className={select}>
          <option value="all">Acessos e alterações</option>
          <option value="access">Só acessos</option>
          <option value="change">Só alterações</option>
        </select>
        <select value={actorId ?? ""} onChange={(e) => setActorId(e.target.value ? Number(e.target.value) : undefined)} className={select}>
          <option value="">Todas as pessoas</option>
          {actorId && !people.some(([id]) => id === actorId) && <option value={actorId}>{initialActorLabel ?? `#${actorId}`}</option>}
          {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={select}>
          <option value={1}>Últimas 24 horas</option>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <button onClick={() => q.refetch()} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs text-zinc-200 hover:bg-zinc-700">
          <RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} />Atualizar
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        {rows.length >= 1000 ? "Mostrando os 1000 registros mais recentes. " : `${rows.length} registro(s). `}
        Alterações são gravadas a partir do deploy de 23/11/2026; acessos já vinham sendo gravados antes.
      </p>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="w-6 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Quando</th>
              <th className="px-3 py-2 font-medium">Quem</th>
              <th className="px-3 py-2 font-medium">O que fez</th>
              <th className="px-3 py-2 font-medium">Detalhe</th>
              <th className="px-3 py-2 font-medium">De onde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {q.isLoading && (
              <tr><td colSpan={6} className="py-10 text-center text-zinc-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!q.isLoading && !rows.length && (
              <tr><td colSpan={6} className="py-10 text-center text-zinc-500">Nenhum registro nesse filtro.</td></tr>
            )}
            {rows.map((r) => {
              const expanded = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className="cursor-pointer hover:bg-zinc-900/60" onClick={() => setOpen(expanded ? null : r.id)}>
                    <td className="px-3 py-2 text-zinc-500">{expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-zinc-300">{when(r.at)}</td>
                    <td className="px-3 py-2">
                      <div className="text-zinc-100">{r.actor?.name || "—"}</div>
                      <div className="text-[11px] text-zinc-500">{r.actor?.email ?? (r.actorId ? `#${r.actorId}` : "")}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1.5", r.kind === "access" ? "text-sky-300" : "text-amber-300")}>
                        {r.kind === "access" ? <LogIn className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}{r.label}
                      </span>
                      {r.target && <div className="text-[11px] text-zinc-500">na conta {r.target.name || r.target.email}</div>}
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-zinc-400" title={summary(r.details)}>{summary(r.details) || (r.ref ? `#${r.ref}` : "")}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-zinc-500">{[r.ip, device(r.userAgent)].filter(Boolean).join(" · ")}</td>
                  </tr>
                  {expanded && (
                    <tr className="bg-zinc-900/40">
                      <td />
                      <td colSpan={5} className="px-3 py-3">
                        <div className="space-y-1 text-[11px] text-zinc-400">
                          {r.path && <p>Rota: <span className="font-mono text-zinc-300">{r.path}</span>{r.ref ? <> · item <span className="font-mono text-zinc-300">#{r.ref}</span></> : null}</p>}
                          {r.userAgent && <p className="break-all">Navegador: {r.userAgent}</p>}
                          {r.details != null && <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-950 p-3 font-mono text-zinc-300">{JSON.stringify(r.details, null, 2)}</pre>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Últimos registros em lista compacta (Visão Geral do painel). */
export function RecentActivity({ onSeeAll }: { onSeeAll: () => void }) {
  const q = trpc.admin.activityLog.useQuery({ kind: "all", days: 7, limit: 12 }, { refetchInterval: 30_000 });
  const rows = q.data ?? [];
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <p className="text-sm font-semibold text-white">Atividade recente <span className="font-normal text-zinc-500">· quem acessou e o que mudou</span></p>
        <button onClick={onSeeAll} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">Ver todos os registros</button>
      </div>
      {q.isLoading ? <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-500" /></div>
        : !rows.length ? <p className="py-8 text-center text-xs text-zinc-500">Nenhum registro nos últimos 7 dias.</p>
        : (
          <ul className="divide-y divide-zinc-800">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", r.kind === "access" ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-300")}>
                  {r.kind === "access" ? <LogIn className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-zinc-100">{r.actor?.name || r.actor?.email || "—"}</span>
                  <span className="text-zinc-400"> · {r.label}</span>
                  {summary(r.details) && <span className="block truncate text-[11px] text-zinc-500">{summary(r.details)}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500">{when(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
