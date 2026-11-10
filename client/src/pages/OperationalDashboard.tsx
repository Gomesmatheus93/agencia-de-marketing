import AppLayout from "@/components/AppLayout";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePlan } from "@/_core/hooks/usePlan";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowRight, CalendarCheck2, CalendarRange, Clock3, Crown, Eye, FileText, Heart, Lock, MessageCircle, Plus, Send, Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link, useLocation } from "wouter";

const REFRESH_MS = 5 * 60_000; // dados do mês atualizados a cada 5 min (e ao voltar para a aba)
const OUTPUT_SCREEN: Record<string, string> = {
  carrossel: "/dashboard/criar/carrossel", legendas: "/dashboard/criar/post", stories: "/dashboard/criar/stories", "video-ia": "/dashboard/criar/video",
};
const FORMAT_LABEL: Record<string, string> = { carrossel: "Carrossel", imagem: "Imagem", reel: "Reel", stories: "Stories" };
const FORMAT_STYLE: Record<string, string> = {
  carrossel: "bg-primary/10 text-primary", imagem: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  reel: "bg-alle-orange/10 text-alle-orange", stories: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type InsightMetric = { metric: string; values: Array<{ value: number; end_time: string }> };

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function ddmm(date: string) {
  return `${date.slice(8)}/${date.slice(5, 7)}`;
}
type View = "semana" | "mes";
/** Período da visão: semana de segunda a domingo, ou o mês inteiro. */
function rangeOf(view: View, now: Date) {
  if (view === "semana") {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    return { start: ymd(monday), end: ymd(sunday), days: 7 };
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: ymd(first), end: ymd(last), days: last.getDate() };
}
/** O valor diário do Instagram vem com end_time no dia seguinte: volta 1 dia para saber a que dia pertence. */
function dayOf(endTime: string) {
  return new Date(new Date(endTime).getTime() - 86_400_000);
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

function Stat({ label, value, hint, icon: Icon, loading }: { label: string; value: string; hint?: React.ReactNode; icon: React.ComponentType<{ className?: string }>; loading?: boolean }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-muted" /> : value}</p>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon className="h-5 w-5" /></span>
      </CardContent>
    </Card>
  );
}

export default function OperationalDashboard() {
  const { user } = useAuth();
  const { isExpired, isTrialActive, isLegacy, isPaid, daysLeft } = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [, navigate] = useLocation();

  const now = new Date();
  const [view, setView] = useState<View>(() => {
    try { return localStorage.getItem("dashboard_view") === "semana" ? "semana" : "mes"; } catch { return "mes"; }
  });
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem("dashboard_view", v); } catch { /* sem localStorage */ }
  };
  const today = ymd(now);
  const range = rangeOf(view, now);
  const inRange = (d: Date) => { const k = ymd(d); return k >= range.start && k <= range.end; };
  const monthName = now.toLocaleDateString("pt-BR", { month: "long" });
  /** "de novembro" ou "da semana (09/11 a 15/11)" */
  const periodName = view === "mes" ? `de ${monthName}` : `da semana (${ddmm(range.start)} a ${ddmm(range.end)})`;
  const periodShort = view === "mes" ? `em ${monthName}` : "nesta semana";
  const daysSoFar = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(`${range.start}T00:00:00`).getTime()) / 86_400_000) + 1;
  const live = { refetchInterval: REFRESH_MS, refetchOnWindowFocus: true, staleTime: 60_000 } as const;

  const overview = trpc.dashboard.period.useQuery({ start: range.start, end: range.end }, live);
  const recent = trpc.agents.recent.useQuery(undefined, { staleTime: 60_000 });
  const connection = trpc.analytics.getInstagramConnectionStatus.useQuery(undefined, { retry: 1, staleTime: 5 * 60_000 });
  const connected = connection.data?.connected === true;
  const profile = trpc.analytics.getProfile.useQuery(undefined, { ...live, enabled: connected, retry: 1 });
  const insights = trpc.analytics.getInsights.useQuery({ days: Math.max(7, daysSoFar) }, { ...live, enabled: connected, retry: 1 });
  const media = trpc.analytics.getMedia.useQuery({ limit: 25 }, { ...live, staleTime: 10 * 60_000, enabled: connected, retry: 1 });
  const inbox = trpc.inbox.conversations.useQuery(undefined, { ...live, enabled: connected, retry: 1 });

  const firstName = user?.name?.split(" ")[0] || "Usuário";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // ── Analytics do mês (só os dias deste mês) ──
  const monthInsights = useMemo(() => {
    const list = (insights.data ?? []) as InsightMetric[];
    const inMonth = (name: string) => (list.find((m) => m.metric === name)?.values ?? []).filter((v) => inRange(dayOf(v.end_time)));
    const sum = (name: string) => inMonth(name).reduce((s, v) => s + v.value, 0);
    return {
      reach: sum("reach"), interactions: sum("total_interactions"), newFollowers: sum("follower_count"),
      chart: inMonth("reach").map((v) => ({ dia: String(dayOf(v.end_time).getDate()).padStart(2, "0"), Alcance: v.value })),
    };
  }, [insights.data, range.start, range.end]);

  const byFormat = useMemo(() => {
    const groups: Record<string, number[]> = { Reel: [], Carrossel: [], Imagem: [] };
    for (const m of (media.data ?? []) as Array<{ timestamp: string; media_type: string; media_product_type?: string; insights?: Record<string, number> }>) {
      if (!inRange(new Date(m.timestamp))) continue;
      const key = m.media_product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : "Imagem";
      groups[key].push(m.insights?.reach ?? 0);
    }
    return Object.entries(groups).map(([formato, v]) => ({ formato, posts: v.length, alcance: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0 }));
  }, [media.data, range.start, range.end]);
  const postsThisMonth = byFormat.reduce((s, f) => s + f.posts, 0);

  const dm = useMemo(() => {
    const convs = (inbox.data?.conversations ?? []) as Array<{ updatedTime?: string; lastFromMe?: boolean }>;
    const monthConvs = convs.filter((c) => c.updatedTime && inRange(new Date(c.updatedTime)));
    return { total: monthConvs.length, waiting: monthConvs.filter((c) => !c.lastFromMe).length };
  }, [inbox.data, range.start, range.end]);

  // ── Planejamento do mês ──
  const items = overview.data?.items ?? [];
  const created = items.filter((i) => i.output).length;
  const posts = overview.data?.posts;
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Rola a faixa até a pauta de hoje (ou a próxima).
    const strip = stripRef.current;
    const target = strip?.querySelector<HTMLElement>("[data-upcoming='true']");
    if (strip && target) strip.scrollLeft = target.offsetLeft - strip.offsetLeft - 8;
  }, [items.length, view]);
  const openOutput = (agentSlug: string, threadId: number) => {
    const screen = OUTPUT_SCREEN[agentSlug];
    if (!screen) return navigate("/dashboard/planejamento");
    sessionStorage.setItem(`task_open_${agentSlug}`, String(threadId));
    navigate(screen);
  };
  const firstUpcoming = items.findIndex((i) => i.date >= today);
  const lastAudit = recent.data?.auditoria;

  return (
    <AppLayout activeModule="dashboard">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{greeting}, <span className="bg-gradient-to-r from-alle-purple to-alle-orange bg-clip-text text-transparent">{firstName}</span></h1>
              <p className="mt-1 text-sm text-muted-foreground">{view === "mes" ? <>O mês de <span className="font-medium capitalize text-foreground">{monthName}</span></> : <>A semana de <span className="font-medium text-foreground">{ddmm(range.start)} a {ddmm(range.end)}</span></>} da Alle Energia: o que está planejado, o que já foi criado e como o perfil está indo.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Período" className="inline-flex rounded-full border bg-card p-1">
                {([["semana", "Visão semanal"], ["mes", "Visão mensal"]] as const).map(([v, label]) => (
                  <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => changeView(v)}
                    className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition", view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
              <Button asChild><Link href="/dashboard/planejamento"><CalendarRange className="mr-2 h-4 w-4" />{view === "mes" ? "Planejar o mês" : "Planejar a semana"}</Link></Button>
            </div>
          </header>

          {!isPaid && !isLegacy && (isExpired || isTrialActive) && (
            <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center", isExpired ? "border-destructive/25 bg-destructive/[.07]" : "border-amber-500/25 bg-amber-500/[.07]")}>
              <div className="flex flex-1 items-center gap-3">{isExpired ? <Lock className="h-5 w-5 text-destructive" /> : <Clock3 className="h-5 w-5 text-amber-500" />}
                <p className="text-sm font-semibold">{isExpired ? "Seu período de teste terminou" : `Teste gratuito · ${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"}`}</p></div>
              <Button size="sm" onClick={() => setUpgradeOpen(true)}><Crown className="mr-1.5 h-3.5 w-3.5" />{isExpired ? "Ver planos" : "Fazer upgrade"}</Button>
            </div>
          )}
          <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} expired={isExpired} />

          {/* ── Planejamento do mês ── */}
          <section>
            <SectionTitle action={items.length > 0 && <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{created}</span> de {items.length} pautas criadas</p>}>
              Planejamento {periodName}
            </SectionTitle>
            <Card className="border-border/60">
              <CardContent className="p-3">
                {overview.isLoading ? (
                  <div className="flex gap-3 overflow-hidden">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 w-48 shrink-0 animate-pulse rounded-2xl bg-muted" />)}</div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <CalendarRange className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Ainda não tem plano {view === "mes" ? `para ${monthName}` : "para esta semana"}.</p>
                    <Button size="sm" asChild><Link href="/dashboard/planejamento"><Plus className="mr-1.5 h-4 w-4" />{view === "mes" ? "Gerar o plano do mês" : "Gerar o plano da semana"}</Link></Button>
                  </div>
                ) : (
                  <div ref={stripRef} className="flex snap-x gap-3 overflow-x-auto pb-2">
                    {items.map((it, i) => {
                      const d = new Date(`${it.date}T12:00:00`);
                      const isToday = it.date === today;
                      const past = it.date < today;
                      return (
                        <div key={`${it.planThreadId}-${it.index}`} data-upcoming={i === firstUpcoming} className={cn("flex w-48 shrink-0 snap-start flex-col rounded-2xl border bg-card p-2.5", isToday && "border-primary ring-2 ring-primary/20", past && !it.output && "opacity-60")}>
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className={cn("font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{isToday ? "Hoje" : `${WEEKDAYS[d.getDay()]} ${ddmm(it.date)}`}{it.time ? ` · ${it.time}` : ""}</span>
                            {it.format && <span className={cn("rounded-full px-1.5 py-0.5 font-medium", FORMAT_STYLE[it.format] ?? "bg-muted")}>{FORMAT_LABEL[it.format] ?? it.format}</span>}
                          </div>
                          <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-tight">{it.title}</p>
                          <p className="text-[11px] text-primary">{it.type}{it.collab ? <span className="text-alle-orange"> · {it.collab}</span> : null}</p>
                          {it.output ? (
                            <button type="button" onClick={() => openOutput(it.output!.agentSlug, it.output!.threadId)} className="group relative mt-2 block aspect-[4/5] overflow-hidden rounded-xl border bg-muted" title="Abrir">
                              {it.output.images[0] ? <img src={it.output.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                                : it.output.videoUrl ? <video src={it.output.videoUrl} muted preload="metadata" className="h-full w-full object-cover" /> : null}
                              {it.output.total > 1 && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{it.output.total} artes</span>}
                            </button>
                          ) : (
                            <Link href="/dashboard/planejamento" className="mt-2 flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary">
                              <Plus className="h-5 w-5" />criar
                            </Link>
                          )}
                          <p className={cn("mt-2 text-[11px]", it.output ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{it.output ? "✓ criado · abrir" : past ? "não foi criado" : "a criar"}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ── Analytics do mês ── */}
          <section>
            <SectionTitle action={<Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ver analytics completo<ArrowRight className="h-3 w-3" /></Link>}>
              Analytics {periodName}
            </SectionTitle>
            {!connection.isLoading && !connected ? (
              <Card className="border-border/60"><CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground">Conecte o Instagram para ver os números do período aqui.</p>
                <Button size="sm" asChild><Link href="/dashboard/analytics">Conectar Instagram</Link></Button>
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-12 xl:grid-cols-4">
                  <Stat label="Seguidores" icon={Users} loading={profile.isLoading}
                    value={fmt(profile.data?.followers_count ?? 0)}
                    hint={monthInsights.newFollowers > 0 ? <span className="text-emerald-600 dark:text-emerald-400">+{monthInsights.newFollowers} {periodShort}</span> : periodShort} />
                  <Stat label={view === "mes" ? "Alcance no mês" : "Alcance na semana"} icon={Eye} loading={insights.isLoading} value={fmt(monthInsights.reach)} hint={`soma de ${ddmm(range.start)} até hoje`} />
                  <Stat label={view === "mes" ? "Interações no mês" : "Interações na semana"} icon={Heart} loading={insights.isLoading} value={fmt(monthInsights.interactions)} hint="curtidas, comentários, salvos e compart." />
                  <Link href="/dashboard/direct" className="block">
                    <Stat label="Mensagens no Direct" icon={MessageCircle} loading={inbox.isLoading} value={String(dm.total)}
                      hint={dm.waiting > 0 ? <span className="font-medium text-alle-orange">{dm.waiting} aguardando resposta</span> : `conversas ${periodShort} · todas respondidas`} />
                  </Link>
                </div>

                <Card className="border-border/60 lg:col-span-7">
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold">Alcance por dia</p>
                    <p className="text-xs text-muted-foreground">contas alcançadas {periodShort}</p>
                    <div className="mt-3 h-56">
                      {monthInsights.chart.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthInsights.chart} margin={{ left: -16, right: 8, top: 8 }}>
                            <defs><linearGradient id="dashReach" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c00ae" stopOpacity={0.35} /><stop offset="100%" stopColor="#7c00ae" stopOpacity={0} /></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" />
                            <XAxis dataKey="dia" tickLine={false} axisLine={false} fontSize={11} />
                            <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => fmt(Number(v))} />
                            <Tooltip formatter={(v) => [fmt(Number(v)), "Alcance"]} labelFormatter={(l) => `Dia ${l}`} />
                            <Area type="monotone" dataKey="Alcance" stroke="#7c00ae" strokeWidth={2} fill="url(#dashReach)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{insights.isLoading ? "Carregando…" : "Sem dados de alcance neste período ainda."}</div>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 lg:col-span-5">
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold">Alcance médio por formato</p>
                    <p className="text-xs text-muted-foreground">{postsThisMonth} {postsThisMonth === 1 ? "post publicado" : "posts publicados"} {periodShort}</p>
                    <div className="mt-3 h-56">
                      {postsThisMonth ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={byFormat} margin={{ left: -16, right: 8, top: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" />
                            <XAxis dataKey="formato" tickLine={false} axisLine={false} fontSize={11} />
                            <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => fmt(Number(v))} />
                            <Tooltip formatter={(v, _n, p) => [`${fmt(Number(v))} (${(p.payload as { posts: number }).posts} posts)`, "Alcance médio"]} />
                            <Bar dataKey="alcance" radius={[8, 8, 0, 0]}>
                              {byFormat.map((f) => <Cell key={f.formato} fill={f.formato === "Reel" ? "#ff7300" : f.formato === "Carrossel" ? "#7c00ae" : "#a23fd6"} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{media.isLoading ? "Carregando…" : "Nenhum post publicado neste período ainda."}</div>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          {/* ── Relatório do mês ── */}
          <section>
            <SectionTitle>Relatório {periodName}</SectionTitle>
            <div className="grid gap-4 lg:grid-cols-12">
              <Card className="border-border/60 lg:col-span-5">
                <CardContent className="space-y-4 p-5">
                  {[
                    { icon: CalendarRange, label: "Pautas planejadas", value: items.length },
                    { icon: FileText, label: "Pautas com arte criada", value: items.length ? `${created} (${Math.round((created / items.length) * 100)}%)` : 0 },
                    { icon: CalendarCheck2, label: "Postagens agendadas", value: posts?.scheduled ?? 0 },
                    { icon: Send, label: "Publicadas pela plataforma", value: posts?.published ?? 0 },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"><row.icon className="h-4 w-4" /></span>
                      <p className="flex-1 text-sm text-muted-foreground">{row.label}</p>
                      <p className="text-sm font-bold">{overview.isLoading ? "…" : row.value}</p>
                    </div>
                  ))}
                  {(posts?.failed ?? 0) > 0 && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{posts!.failed} {posts!.failed === 1 ? "postagem falhou" : "postagens falharam"} {periodShort}. Confira em Postagens.</p>}
                  {posts?.next?.scheduledAt && (
                    <p className="rounded-lg bg-muted px-3 py-2 text-xs">Próxima postagem: <span className="font-semibold">{new Date(posts.next.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>{posts.next.title ? ` · ${posts.next.title}` : ""}</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60 lg:col-span-7">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Último diagnóstico do perfil</p>
                    {lastAudit && <span className="text-xs text-muted-foreground">{new Date(lastAudit.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>}
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{lastAudit?.summary ?? "Nenhuma auditoria ainda. Ela analisa os posts e ensina a voz da Alle aos agentes."}</p>
                  <Button variant="outline" size="sm" asChild className="mt-4 self-start"><Link href="/dashboard/auditoria">{lastAudit ? "Atualizar auditoria" : "Fazer auditoria"}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}
