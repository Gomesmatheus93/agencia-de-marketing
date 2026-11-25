import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown, ChevronRight, ExternalLink, Loader2, LogIn, Pencil, RefreshCw, Sparkles } from "lucide-react";
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
                    <td className="max-w-[320px] px-3 py-2 text-zinc-400" title={[r.artTitle, summary(r.details)].filter(Boolean).join(" · ")}>
                      {r.artTitle && <div className="truncate text-zinc-200">{r.artTitle}</div>}
                      <div className="truncate">{summary(r.details) || (!r.artTitle && r.ref ? `#${r.ref}` : "")}{r.hasChange && <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">antes e depois</span>}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-zinc-500">{[r.ip, device(r.userAgent)].filter(Boolean).join(" · ")}</td>
                  </tr>
                  {expanded && (
                    <tr className="bg-zinc-900/40">
                      <td />
                      <td colSpan={5} className="px-3 py-3">
                        <div className="space-y-3 text-[11px] text-zinc-400">
                          <p className="text-xs text-zinc-300">
                            <span className="font-semibold text-white">{r.actor?.name || r.actor?.email || "—"}</span>
                            {r.actor?.email && r.actor?.name ? <span className="text-zinc-500"> ({r.actor.email})</span> : null}
                            <span> · {r.label.toLowerCase()} · {when(r.at)}</span>
                            {r.target && <span className="text-zinc-500"> · na conta {r.target.name || r.target.email}</span>}
                          </p>
                          {r.kind === "change" && r.path && <ActivityDetail id={r.id} />}
                          <details className="rounded-lg border border-zinc-800 px-3 py-2">
                            <summary className="cursor-pointer text-zinc-500">Detalhes técnicos</summary>
                            <div className="mt-2 space-y-1">
                              {r.path && <p>Rota: <span className="font-mono text-zinc-300">{r.path}</span>{r.ref ? <> · item <span className="font-mono text-zinc-300">#{r.ref}</span></> : null}</p>}
                              {r.userAgent && <p className="break-all">Navegador: {r.userAgent}</p>}
                              {r.details != null && <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-zinc-950 p-3 font-mono text-zinc-300">{JSON.stringify(r.details, null, 2)}</pre>}
                            </div>
                          </details>
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

const FIELD_LABEL: Record<string, string> = {
  title: "Título", date: "Dia", time: "Horário", format: "Formato", type: "Tipo", hook: "Gancho", angle: "Ângulo",
  captionIdea: "Ideia de legenda", collab: "Collab", addresses: "Objetivo", notes: "Notas",
};
const show = (v: unknown) => (v == null || v === "" ? "(vazio)" : typeof v === "string" ? v : JSON.stringify(v));
const assetName = (h: string) => (h.startsWith("alle:") ? h.slice(5) : h.split("/").pop() ?? h);

function Thumb({ url, label, highlight }: { url: string; label: string; highlight?: boolean }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn("group block w-28 shrink-0 overflow-hidden rounded-lg border bg-zinc-950", highlight ? "border-amber-400 ring-2 ring-amber-400/40" : "border-zinc-800 hover:border-zinc-600")}>
      <img src={url} alt={label} loading="lazy" className="aspect-[4/5] w-full object-cover" />
      <span className="flex items-center justify-between px-1.5 py-1 text-[10px] text-zinc-400">{label}<ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" /></span>
    </a>
  );
}

/** Linhas de um texto, marcando as que não existem na outra versão. */
function TextVersion({ title, text, other, tone }: { title: string; text: string; other: string; tone: "old" | "new" }) {
  const otherLines = new Set(other.split("\n").map((l) => l.trim()));
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <p className="mb-1.5 font-semibold text-zinc-300">{title}</p>
      <div className="max-h-64 overflow-auto whitespace-pre-wrap text-zinc-300">
        {text.split("\n").map((l, i) => (
          <div key={i} className={cn(l.trim() && !otherLines.has(l.trim()) && (tone === "old" ? "bg-red-500/15 text-red-200 line-through decoration-red-400/60" : "bg-emerald-500/15 text-emerald-200"))}>{l || " "}</div>
        ))}
      </div>
    </div>
  );
}

/** O que mudou (antes e depois) e como está agora, ao abrir um registro de alteração. */
function ActivityDetail({ id }: { id: number }) {
  const q = trpc.admin.activityDetail.useQuery({ id });
  if (q.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />;
  const d = q.data;
  if (!d) return null;
  const ch = (d.change ?? null) as Record<string, any> | null;
  const focus = d.art?.focus;
  const focusImg = d.art?.images.find((i) => focus && i.target.kind === focus.kind && i.target.index === focus.index);

  return (
    <div className="space-y-3">
      {/* O que mudou */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-300"><Sparkles className="h-3.5 w-3.5" />O que mudou</p>

        {ch?.kind === "art" && (
          <div className="space-y-2">
            {ch.undo && <p className="text-zinc-300">Desfez a última edição: a arte voltou para a versão anterior.</p>}
            <div className="flex flex-wrap items-center gap-3">
              {ch.beforeUrl && <Thumb url={ch.beforeUrl} label="Antes" />}
              <ArrowRight className="h-4 w-4 text-zinc-500" />
              {ch.afterUrl && <Thumb url={ch.afterUrl} label="Depois" highlight />}
            </div>
            {(ch.textsRemoved?.length || ch.textsAdded?.length) ? (
              <div className="space-y-1">
                {ch.textsRemoved?.map((t: string, i: number) => <p key={`r${i}`} className="text-red-300"><span className="mr-1.5 font-semibold">− texto tirado:</span><span className="line-through">{t}</span></p>)}
                {ch.textsAdded?.map((t: string, i: number) => <p key={`a${i}`} className="text-emerald-300"><span className="mr-1.5 font-semibold">+ texto novo:</span>{t}</p>)}
              </div>
            ) : ch.textsRemoved ? <p className="text-zinc-500">Nenhum texto mudou.</p> : null}
            {ch.imagesRemoved?.map((t: string, i: number) => <p key={`ir${i}`} className="text-red-300">− imagem tirada: {assetName(t)}</p>)}
            {ch.imagesAdded?.map((t: string, i: number) => <p key={`ia${i}`} className="text-emerald-300">+ imagem colocada: {assetName(t)}</p>)}
            {ch.layoutChanged && <p className="text-sky-300">Também mexeu em posição, tamanho, cor ou formas da arte.</p>}
          </div>
        )}

        {ch?.kind === "caption" && (
          <div className="space-y-2">
            {ch.before === ch.after ? <p className="text-zinc-500">O texto da legenda não mudou{JSON.stringify(ch.hashtagsBefore) !== JSON.stringify(ch.hashtagsAfter) ? "; mudaram as hashtags." : "."}</p> : (
              <div className="flex flex-col gap-2 md:flex-row">
                <TextVersion title="Antes" text={String(ch.before ?? "")} other={String(ch.after ?? "")} tone="old" />
                <TextVersion title="Depois" text={String(ch.after ?? "")} other={String(ch.before ?? "")} tone="new" />
              </div>
            )}
            {JSON.stringify(ch.hashtagsBefore) !== JSON.stringify(ch.hashtagsAfter) && (
              <p className="text-zinc-300">Hashtags: <span className="text-red-300 line-through">{(ch.hashtagsBefore ?? []).join(" ") || "(nenhuma)"}</span> <ArrowRight className="inline h-3 w-3" /> <span className="text-emerald-300">{(ch.hashtagsAfter ?? []).join(" ") || "(nenhuma)"}</span></p>
            )}
          </div>
        )}

        {ch?.kind === "plan" && (
          <div className="space-y-1.5">
            <p className="text-zinc-300">Pauta: <span className="font-semibold text-white">{ch.title}</span>{ch.date ? ` · ${String(ch.date).split("-").reverse().join("/")}` : ""}</p>
            {!ch.fields?.length ? <p className="text-zinc-500">Salvou sem mudar nada.</p> : (
              <table className="w-full text-[11px]">
                <thead className="text-zinc-500"><tr><th className="py-1 pr-3 text-left font-medium">Campo</th><th className="py-1 pr-3 text-left font-medium">Antes</th><th className="py-1 text-left font-medium">Depois</th></tr></thead>
                <tbody className="divide-y divide-zinc-800">
                  {ch.fields.map((f: { field: string; before: unknown; after: unknown }) => (
                    <tr key={f.field} className="align-top"><td className="py-1 pr-3 text-zinc-400">{FIELD_LABEL[f.field] ?? f.field}</td><td className="py-1 pr-3 text-red-300">{show(f.before)}</td><td className="py-1 text-emerald-300">{show(f.after)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!ch && (
          <div className="space-y-2 text-zinc-400">
            <p>Este registro é de antes do detalhamento: só ficou guardado o que foi enviado (em "Detalhes técnicos"). As alterações feitas a partir de agora mostram o antes e o depois aqui.</p>
            {d.path === "agents.saveArt" && focusImg?.previousUrl && (
              <div className="space-y-1">
                <p className="text-zinc-500">Versão anterior que a arte guarda (a de antes da última edição deste slide):</p>
                <div className="flex items-center gap-3"><Thumb url={focusImg.previousUrl} label="Anterior" /><ArrowRight className="h-4 w-4 text-zinc-500" /><Thumb url={focusImg.url} label="Atual" highlight /></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Como está agora */}
      {d.art && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <p className="mb-2 text-xs font-semibold text-white">Arte atual · <span className="font-normal text-zinc-400">{d.art.title}</span></p>
          {d.art.images.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {d.art.images.map((img) => <Thumb key={img.url + img.label} url={img.url} label={img.label} highlight={Boolean(focus && img.target.kind === focus.kind && img.target.index === focus.index)} />)}
            </div>
          ) : <p className="text-zinc-500">Esta tarefa não tem imagem.</p>}
          {d.path === "agents.editCaption" && d.art.caption && (
            <div className="mt-2 rounded-lg bg-zinc-950 p-3">
              <p className="mb-1 font-semibold text-zinc-300">Legenda atual</p>
              <p className="max-h-48 overflow-auto whitespace-pre-wrap text-zinc-300">{d.art.caption}</p>
            </div>
          )}
        </div>
      )}
      {d.planItem && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <p className="mb-1 text-xs font-semibold text-white">Pauta atual</p>
          {d.planItem.item ? <p className="text-zinc-300">{String(d.planItem.item.date ?? "").split("-").reverse().join("/")} · {String(d.planItem.item.title ?? "")}</p> : <p className="text-zinc-500">A pauta não existe mais.</p>}
          {d.planItem.arts.map((a) => (
            <div key={a.threadId} className="mt-2">
              <p className="mb-1 text-zinc-400">{a.title}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">{a.images.map((u, i) => <Thumb key={u} url={u} label={`Arte ${i + 1}`} />)}</div>
            </div>
          ))}
        </div>
      )}
      {d.deleted && <p className="text-zinc-500">A arte ou o plano deste registro foi excluído.</p>}
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
