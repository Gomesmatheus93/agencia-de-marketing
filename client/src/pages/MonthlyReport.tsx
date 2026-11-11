import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

// Relatório mensal dos posts: tudo o que foi feito no mês, em uma página pronta para
// salvar em PDF (imprimir) ou baixar em planilha. Só dados reais (Instagram e plataforma).

type Media = {
  id: string; caption?: string; media_type: string; media_product_type?: string; timestamp: string;
  like_count: number; comments_count: number; permalink: string; media_url?: string; thumbnail_url?: string;
  insights?: Record<string, number>;
};
type Insight = { metric: string; values: Array<{ value: number; end_time: string }>; total?: number | null };

const pad = (n: number) => String(n).padStart(2, "0");
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtDate = (iso: string | Date) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const formatOf = (m: Media) => (m.media_product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : m.media_type === "VIDEO" ? "Vídeo" : "Post");
const engagementOf = (m: Media) => m.like_count + m.comments_count + (m.insights?.saved ?? 0) + (m.insights?.shares ?? 0);
const firstLine = (caption?: string) => (caption ?? "").split("\n").find((l) => l.trim())?.trim() ?? "";
const STATUS_LABEL: Record<string, string> = { published: "Publicada", scheduled: "Agendada", failed: "Falhou", draft: "Rascunho", pending_approval: "Aguardando aprovação", rejected: "Rejeitada" };
const FORMAT_LABEL: Record<string, string> = { carrossel: "Carrossel", imagem: "Post", reel: "Reel", stories: "Stories" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4 print:break-inside-avoid">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 print:break-inside-avoid-page">
      <h2 className="border-b pb-1 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function MonthlyReport() {
  const initial = new URLSearchParams(window.location.search).get("mes");
  const [month, setMonth] = useState(initial && /^\d{4}-\d{2}$/.test(initial) ? initial : monthKeyOf(new Date()));
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = `${month}-${pad(new Date(y, m, 0).getDate())}`;
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const period = trpc.dashboard.period.useQuery({ start, end });
  const profile = trpc.analytics.getProfile.useQuery(undefined, { retry: false });
  const insights = trpc.analytics.getInsights.useQuery({ days: 30, start, end }, { retry: false });
  const media = trpc.analytics.getMedia.useQuery({ limit: 50 }, { retry: false, staleTime: 10 * 60_000 });
  const automations = trpc.commentAutomations.list.useQuery(undefined, { retry: false });

  const posts = useMemo(
    () => ((media.data ?? []) as Media[]).filter((p) => monthKeyOf(new Date(p.timestamp)) === month).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [media.data, month],
  );
  const metric = (name: string) => {
    const it = ((insights.data ?? []) as Insight[]).find((x) => x.metric === name);
    return it ? (it.total ?? it.values.reduce((s, v) => s + v.value, 0)) : null;
  };
  const byFormat = posts.reduce<Record<string, number>>((acc, p) => ({ ...acc, [formatOf(p)]: (acc[formatOf(p)] ?? 0) + 1 }), {});
  const top = [...posts].sort((a, b) => engagementOf(b) - engagementOf(a)).slice(0, 3);
  const items = period.data?.items ?? [];
  const created = items.filter((i) => i.output).length;
  const postList = period.data?.postList ?? [];
  const loading = period.isLoading || media.isLoading || insights.isLoading;
  // A Meta só informa o ganho de seguidores dos últimos 30 dias: em meses antigos, mostra "—".
  const followersAvailable = new Date(`${end}T23:59:59`).getTime() >= Date.now() - 30 * 86_400_000;

  const downloadCsv = () => {
    const header = ["Data", "Formato", "Legenda (início)", "Alcance", "Visualizações", "Curtidas", "Comentários", "Salvamentos", "Compartilhamentos", "Link"];
    const rows = posts.map((p) => [
      fmtDate(p.timestamp), formatOf(p), firstLine(p.caption), p.insights?.reach ?? 0, p.insights?.views ?? p.insights?.videoViews ?? 0,
      p.like_count, p.comments_count, p.insights?.saved ?? 0, p.insights?.shares ?? 0, p.permalink,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); // BOM: acentos certos no Excel
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-posts-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      {/* Barra de ações (não sai na impressão) */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur print:hidden md:px-8">
        <Button variant="ghost" size="sm" asChild><Link href="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Link></Button>
        <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={loading || posts.length === 0}><FileSpreadsheet className="mr-1.5 h-4 w-4" />Baixar planilha (CSV)</Button>
          <Button size="sm" onClick={() => window.print()} disabled={loading}><Download className="mr-1.5 h-4 w-4" />Baixar PDF</Button>
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8 print:max-w-none print:px-0 print:py-0">
        <header className="flex items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Relatório mensal de conteúdo</p>
            <h1 className="text-3xl font-bold capitalize">{monthName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">@{profile.data?.username ?? "…"} · gerado em {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
          <img src="/app/logo.png" alt="" className="hidden h-10 print:block" onError={(e) => (e.currentTarget.style.display = "none")} />
        </header>

        {loading ? (
          <p className="flex items-center gap-2 py-16 text-muted-foreground print:hidden"><Loader2 className="h-4 w-4 animate-spin" />Montando o relatório…</p>
        ) : (
          <>
            <Section title="Resumo do mês">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4">
                <Stat label="Posts publicados" value={fmtInt(posts.length)} hint={Object.entries(byFormat).map(([f, n]) => `${n} ${f.toLowerCase()}${n > 1 ? "s" : ""}`).join(" · ") || "nenhum"} />
                <Stat label="Alcance" value={metric("reach") != null ? fmtInt(metric("reach")!) : "—"} hint="contas alcançadas no mês" />
                <Stat label="Visualizações" value={metric("views") != null ? fmtInt(metric("views")!) : "—"} />
                <Stat label="Interações" value={metric("total_interactions") != null ? fmtInt(metric("total_interactions")!) : "—"} hint="curtidas, comentários, salvos e compart." />
                <Stat label="Seguidores ganhos"
                  value={followersAvailable && metric("follower_count") != null ? `+${fmtInt(metric("follower_count")!)}` : "—"}
                  hint={followersAvailable ? (profile.data ? `${fmtInt(profile.data.followers_count)} no total` : undefined) : "a Meta só informa os últimos 30 dias"} />
                <Stat label="Visitas ao perfil" value={metric("profile_views") != null ? fmtInt(metric("profile_views")!) : "—"} />
                <Stat label="Cliques no site" value={metric("website_clicks") != null ? fmtInt(metric("website_clicks")!) : "—"} />
                <Stat label="Contas engajadas" value={metric("accounts_engaged") != null ? fmtInt(metric("accounts_engaged")!) : "—"} />
              </div>
              <p className="text-xs text-muted-foreground">Números do Instagram (Meta) do período de 1º a {end.slice(8)}/{end.slice(5, 7)}. A Meta limita os totais a 30 dias: em meses de 31 dias, o total começa no dia 2.</p>
            </Section>

            {top.length > 0 && (
              <Section title="Destaques">
                <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
                  {top.map((p, i) => (
                    <a key={p.id} href={p.permalink} target="_blank" rel="noreferrer" className="flex gap-3 rounded-xl border p-3 print:break-inside-avoid">
                      <img src={p.thumbnail_url ?? p.media_url} alt="" referrerPolicy="no-referrer" className="h-20 w-16 shrink-0 rounded-md bg-muted object-cover" />
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold">{i + 1}º · {formatOf(p)} · {fmtDate(p.timestamp)}</p>
                        <p className="line-clamp-2 text-muted-foreground">{firstLine(p.caption)}</p>
                        <p className="mt-1">{fmtInt(engagementOf(p))} interações · {fmtInt(p.insights?.reach ?? 0)} de alcance</p>
                      </div>
                    </a>
                  ))}
                </div>
              </Section>
            )}

            <Section title={`Posts publicados no Instagram (${posts.length})`}>
              {posts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum post publicado neste mês.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-2">Data</th><th className="pr-2">Formato</th><th className="pr-2">Legenda</th>
                        <th className="pr-2 text-right">Alcance</th><th className="pr-2 text-right">Visualiz.</th><th className="pr-2 text-right">Curtidas</th>
                        <th className="pr-2 text-right">Coment.</th><th className="pr-2 text-right">Salvos</th><th className="text-right">Compart.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((p) => (
                        <tr key={p.id} className="border-b align-top print:break-inside-avoid">
                          <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(p.timestamp)}</td>
                          <td className="pr-2">{formatOf(p)}</td>
                          <td className="max-w-[260px] pr-2"><a href={p.permalink} target="_blank" rel="noreferrer" className="line-clamp-2 hover:underline">{firstLine(p.caption) || "(sem legenda)"}</a></td>
                          <td className="pr-2 text-right tabular-nums">{fmtInt(p.insights?.reach ?? 0)}</td>
                          <td className="pr-2 text-right tabular-nums">{fmtInt(p.insights?.views ?? p.insights?.videoViews ?? 0)}</td>
                          <td className="pr-2 text-right tabular-nums">{fmtInt(p.like_count)}</td>
                          <td className="pr-2 text-right tabular-nums">{fmtInt(p.comments_count)}</td>
                          <td className="pr-2 text-right tabular-nums">{fmtInt(p.insights?.saved ?? 0)}</td>
                          <td className="text-right tabular-nums">{fmtInt(p.insights?.shares ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title={`Planejamento (${items.length} pautas · ${created} com arte criada)`}>
              {items.length === 0 ? <p className="text-sm text-muted-foreground">Sem plano para este mês.</p> : (
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground"><tr className="border-b"><th className="py-2 pr-2">Dia</th><th className="pr-2">Formato</th><th className="pr-2">Pauta</th><th>Status</th></tr></thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={`${it.planThreadId}-${it.index}`} className="border-b align-top print:break-inside-avoid">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{it.date.slice(8)}/{it.date.slice(5, 7)}{it.time ? ` · ${it.time}` : ""}</td>
                        <td className="pr-2">{FORMAT_LABEL[it.format ?? ""] ?? it.format ?? "—"}</td>
                        <td className="pr-2">{it.title}{it.collab ? ` (collab ${it.collab})` : ""}</td>
                        <td className={it.output ? "text-emerald-700" : "text-muted-foreground"}>{it.output ? "Arte criada" : "Não criada"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title={`Postagens pela plataforma (${period.data?.posts.published ?? 0} publicadas · ${period.data?.posts.scheduled ?? 0} agendadas · ${period.data?.posts.failed ?? 0} com falha)`}>
              {postList.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma postagem agendada ou publicada pela plataforma neste mês.</p> : (
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground"><tr className="border-b"><th className="py-2 pr-2">Data</th><th className="pr-2">Postagem</th><th className="pr-2">Collab</th><th>Status</th></tr></thead>
                  <tbody>
                    {postList.map((p, i) => (
                      <tr key={i} className="border-b align-top print:break-inside-avoid">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{(p.publishedAt ?? p.scheduledAt) ? new Date((p.publishedAt ?? p.scheduledAt)!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        <td className="pr-2">{p.title || "(sem título)"}</td>
                        <td className="pr-2">{p.collaborators.length ? p.collaborators.map((c) => `@${c}`).join(", ") : "—"}</td>
                        <td className={p.status === "failed" ? "text-destructive" : ""}>{STATUS_LABEL[p.status] ?? p.status}{p.status === "failed" && p.errorMessage ? ` (${p.errorMessage.slice(0, 80)})` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <Section title="Atendimento automático">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4">
                <Stat label="Respostas no Direct" value={fmtInt(period.data?.dmReplies ?? 0)} hint="respostas automáticas no mês" />
                <Stat label="Cliques no link da Ane" value={period.data?.shortLink ? fmtInt(period.data.shortLink.clicks) : "—"} hint={period.data?.shortLink ? `/wa/${period.data.shortLink.slug} · total desde a criação` : "link curto não configurado"} />
                <Stat label="Comentários respondidos" value={fmtInt((automations.data ?? []).reduce((s, a) => s + a.commentsMatchedCount, 0))} hint="automações de comentários · total" />
                <Stat label="DMs enviadas" value={fmtInt((automations.data ?? []).reduce((s, a) => s + a.dmsSentCount, 0))} hint="automações de comentários · total" />
              </div>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
