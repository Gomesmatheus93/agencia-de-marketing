import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Eye,
  TrendingUp,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  ExternalLink,
  RefreshCw,
  BarChart2,
  UserCheck,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso));
}

type InsightMetric = {
  metric: string;
  values: Array<{ value: number; end_time: string }>;
};

function sumMetric(insights: InsightMetric[], name: string) {
  return insights.find((m) => m.metric === name)?.values.reduce((s, v) => s + v.value, 0) ?? 0;
}

function lastValue(insights: InsightMetric[], name: string) {
  const vals = insights.find((m) => m.metric === name)?.values ?? [];
  return vals[vals.length - 1]?.value ?? 0;
}

function buildChartData(insights: InsightMetric[]) {
  const reach = insights.find((m) => m.metric === "reach")?.values ?? [];
  const impressions = insights.find((m) => m.metric === "impressions")?.values ?? [];
  const profileViews = insights.find((m) => m.metric === "profile_views")?.values ?? [];

  return reach.map((r, i) => ({
    date: fmtDate(r.end_time),
    Alcance: r.value,
    Impressões: impressions[i]?.value ?? 0,
    "Visitas ao Perfil": profileViews[i]?.value ?? 0,
  }));
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
}: {
  post: {
    id: string;
    caption?: string;
    media_type: string;
    media_url?: string;
    thumbnail_url?: string;
    timestamp: string;
    like_count: number;
    comments_count: number;
    permalink: string;
    insights: Record<string, number>;
  };
}) {
  const thumb = post.thumbnail_url || post.media_url;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).format(
    new Date(post.timestamp)
  );

  return (
    <div className="group overflow-hidden rounded-2xl border border-border/40 bg-background/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {thumb ? (
          <img src={thumb} alt="post" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5 text-white" />
        </a>
        <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
          {date}
        </span>
      </div>

      <div className="p-3">
        {post.caption && (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{post.caption}</p>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          <Metric icon={Heart} label="Curtidas" value={post.like_count} />
          <Metric icon={MessageCircle} label="Comentários" value={post.comments_count} />
          <Metric icon={Eye} label="Alcance" value={post.insights.reach ?? 0} />
          <Metric icon={Bookmark} label="Salvamentos" value={post.insights.saved ?? 0} />
          <Metric icon={TrendingUp} label="Impressões" value={post.insights.impressions ?? 0} />
          <Metric icon={Share2} label="Compartilhamentos" value={post.insights.shares ?? 0} />
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-[9px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold text-foreground">{fmt(value)}</p>
      </div>
    </div>
  );
}

const CHART_COLORS = {
  Alcance: "#7b00ae",
  Impressões: "#fe6e00",
  "Visitas ao Perfil": "#06b6d4",
};

export default function Analytics() {
  const profileQuery = trpc.analytics.getProfile.useQuery(undefined, { retry: 1 });
  const insightsQuery = trpc.analytics.getInsights.useQuery({ days: 30 }, { retry: 1 });
  const mediaQuery = trpc.analytics.getMedia.useQuery({ limit: 12 }, { retry: 1 });

  const refetchAll = () => {
    void profileQuery.refetch();
    void insightsQuery.refetch();
    void mediaQuery.refetch();
  };

  const insights: InsightMetric[] = insightsQuery.data ?? [];
  const profile = profileQuery.data;
  const chartData = buildChartData(insights);
  const totalReach = sumMetric(insights, "reach");
  const totalImpressions = sumMetric(insights, "impressions");
  const totalProfileViews = sumMetric(insights, "profile_views");
  const followerChange = sumMetric(insights, "follower_count");

  const isLoading = profileQuery.isLoading || insightsQuery.isLoading;
  const hasError = profileQuery.isError || insightsQuery.isError;

  return (
    <AppLayout activeModule="analytics">
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]">
                <BarChart2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Analytics Instagram</h1>
                <p className="text-xs text-muted-foreground">Painel de desempenho em tempo real</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refetchAll}
              disabled={isLoading}
              className="gap-2 rounded-xl"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          {/* Error state */}
          {hasError && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Não foi possível carregar os dados. Verifique se o token de acesso e o Instagram Account ID estão corretos no .env.
            </div>
          )}

          {/* Profile card */}
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/80">
            <div className="h-24 bg-gradient-to-r from-[#7b00ae]/30 via-[#fe6e00]/20 to-[#7b00ae]/10" />
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
              <div className="-mt-14 flex-shrink-0">
                {isLoading ? (
                  <Skeleton className="h-20 w-20 rounded-full" />
                ) : profile?.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url}
                    alt="avatar"
                    className="h-20 w-20 rounded-full border-4 border-background object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-gradient-to-br from-[#7b00ae] to-[#fe6e00] text-2xl font-bold text-white shadow-lg">
                    {profile?.username?.[0]?.toUpperCase() ?? "K"}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                {isLoading ? (
                  <>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-64 mt-2" />
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold text-foreground">{profile?.name ?? profile?.username}</p>
                    <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                    {profile?.biography && (
                      <p className="text-xs leading-relaxed text-muted-foreground">{profile.biography}</p>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-6">
                {[
                  { label: "Seguidores", value: profile?.followers_count },
                  { label: "Seguindo", value: profile?.follows_count },
                  { label: "Posts", value: profile?.media_count },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    {isLoading ? (
                      <Skeleton className="mx-auto h-5 w-12" />
                    ) : (
                      <p className="text-lg font-bold text-foreground">{fmt(s.value ?? 0)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-background/80 p-5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-8 w-20" />
                  <Skeleton className="mt-1 h-3 w-32" />
                </div>
              ))
            ) : (
              <>
                <KpiCard
                  label="Seguidores"
                  value={fmt(profile?.followers_count ?? 0)}
                  icon={Users}
                  color="bg-gradient-to-br from-violet-500 to-purple-600"
                  sub={followerChange !== 0 ? `${followerChange > 0 ? "+" : ""}${followerChange} nos últimos 30d` : "Últimos 30 dias"}
                />
                <KpiCard
                  label="Alcance Total"
                  value={fmt(totalReach)}
                  icon={UserCheck}
                  color="bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]"
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Impressões"
                  value={fmt(totalImpressions)}
                  icon={TrendingUp}
                  color="bg-gradient-to-br from-orange-500 to-rose-500"
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Visitas ao Perfil"
                  value={fmt(totalProfileViews)}
                  icon={Eye}
                  color="bg-gradient-to-br from-cyan-500 to-blue-500"
                  sub="Últimos 30 dias"
                />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Area chart — reach + impressions */}
            <div className="rounded-2xl border border-border/40 bg-background/80 p-5 lg:col-span-2">
              <p className="mb-4 text-sm font-semibold text-foreground">Alcance e Impressões — 30 dias</p>
              {isLoading ? (
                <Skeleton className="h-56 w-full rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Sem dados de insights para o período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      {(["Alcance", "Impressões"] as const).map((key) => (
                        <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS[key]} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CHART_COLORS[key]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number, name: string) => [fmt(v), name]}
                    />
                    {(["Alcance", "Impressões"] as const).map((key) => (
                      <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[key]} strokeWidth={2} fill={`url(#grad-${key})`} dot={false} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar chart — profile views */}
            <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
              <p className="mb-4 text-sm font-semibold text-foreground">Visitas ao Perfil</p>
              {isLoading ? (
                <Skeleton className="h-56 w-full rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Sem dados disponíveis.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      formatter={(v: number) => [fmt(v), "Visitas"]}
                    />
                    <Bar dataKey="Visitas ao Perfil" fill={CHART_COLORS["Visitas ao Perfil"]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Media grid */}
          <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Posts Recentes</p>
              <span className="text-xs text-muted-foreground">{mediaQuery.data?.length ?? 0} posts</span>
            </div>

            {mediaQuery.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl">
                    <Skeleton className="aspect-square w-full" />
                    <div className="space-y-1.5 p-3">
                      <Skeleton className="h-2 w-full" />
                      <Skeleton className="h-2 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : mediaQuery.isError ? (
              <p className="text-sm text-muted-foreground">Não foi possível carregar os posts.</p>
            ) : (mediaQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum post encontrado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {mediaQuery.data!.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
