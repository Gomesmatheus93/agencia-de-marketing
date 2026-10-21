import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
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
  TrendingDown,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  ExternalLink,
  RefreshCw,
  BarChart2,
  UserCheck,
  ImageIcon,
  Linkedin,
  Instagram,
  FileText,
  Send,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronUp,
  Zap,
  Info,
  Bell,
  Clock,
  CheckCheck,
  Award,
  Minus,
  Phone,
  MapPin,
  Activity,
  Users2,
  PieChart as PieChartIcon,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SafeImage } from "@/components/SafeImage";

// ─── Utility helpers ──────────────────────────────────────────────────────────

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

// ─── Design tokens ────────────────────────────────────────────────────────────

const CHART_COLORS = {
  Alcance: "#7b00ae",
  Impressões: "#fe6e00",
  "Visitas ao Perfil": "#06b6d4",
  Score: "#10b981",
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  accentClass,
  sub,
  trend,
  isEmpty,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accentClass: string;
  sub?: string;
  trend?: { delta: number; label: string };
  isEmpty?: boolean;
}) {
  const trendPositive = trend && trend.delta > 0;
  const trendNegative = trend && trend.delta < 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/70">
      {/* subtle accent glow */}
      <div className={cn("absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-xl transition-opacity duration-300 group-hover:opacity-20", accentClass)} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
          {isEmpty ? (
            <div className="mt-2 flex items-center gap-2">
              <Minus className="h-5 w-5 text-muted-foreground/30" />
              <p className="text-xl font-semibold text-muted-foreground/40">—</p>
            </div>
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
          )}
          {trend !== undefined ? (
            <div className={cn(
              "mt-1.5 flex items-center gap-1 text-xs font-medium",
              isEmpty ? "text-muted-foreground/40"
                : trendPositive ? "text-emerald-500 dark:text-emerald-400"
                : trendNegative ? "text-red-500 dark:text-red-400"
                : "text-muted-foreground"
            )}>
              {!isEmpty && trendPositive && <TrendingUp className="h-3 w-3" />}
              {!isEmpty && trendNegative && <TrendingDown className="h-3 w-3" />}
              {!isEmpty && !trendPositive && !trendNegative && <Minus className="h-3 w-3" />}
              <span>{isEmpty ? "Sem dados" : trend.label}</span>
            </div>
          ) : (
            sub && <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accentClass)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Score color helper ────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 10) return "text-emerald-400 bg-emerald-950/60 border-emerald-500/40";
  if (score >= 5) return "text-amber-400 bg-amber-950/60 border-amber-500/40";
  return "text-slate-400 bg-slate-900/60 border-slate-600/40";
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
}: {
  post: {
    id: string;
    caption?: string;
    media_type: string;
    media_product_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    timestamp: string;
    like_count: number;
    comments_count: number;
    permalink: string;
    insights: Record<string, number>;
    engagementScore?: number;
  };
}) {
  const thumb = post.thumbnail_url || post.media_url;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).format(
    new Date(post.timestamp)
  );
  const score = post.engagementScore ?? 0;
  const isReel = post.media_product_type === "REELS";

  return (
    <div className="group overflow-hidden rounded-2xl border border-border/40 bg-background/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-border/70">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {thumb ? (
          <SafeImage src={thumb} alt="post" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* External link button */}
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-black/80"
        >
          <ExternalLink className="h-3.5 w-3.5 text-white" />
        </a>

        {/* Date badge */}
        <span className="absolute bottom-2 left-2 rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white/90 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {date}
        </span>

        {/* Score badge — always visible */}
        <span className={cn(
          "absolute top-2 left-2 flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm",
          scoreColor(score)
        )}>
          <Zap className="h-2.5 w-2.5" />
          {score.toFixed(1)}
        </span>

        {/* Reels badge */}
        {isReel && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md border border-fuchsia-500/40 bg-fuchsia-950/60 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-300 backdrop-blur-sm">
            <Video className="h-2.5 w-2.5" />
            Reels
          </span>
        )}
      </div>

      <div className="p-3">
        {post.caption ? (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{post.caption}</p>
        ) : (
          <p className="mb-3 text-xs italic text-muted-foreground/40">(sem legenda)</p>
        )}
        <div className="grid grid-cols-2 gap-1">
          <Metric icon={Heart} label="Curtidas" value={post.like_count} />
          <Metric icon={MessageCircle} label="Comentários" value={post.comments_count} />
          <Metric icon={Eye} label="Alcance" value={post.insights.reach ?? 0} />
          <Metric icon={Bookmark} label="Salvamentos" value={post.insights.saved ?? 0} />
          {isReel ? (
            <>
              <Metric icon={Video} label="Visualizações" value={post.insights.videoViews ?? 0} />
              <Metric icon={Clock} label="Tempo médio (s)" value={Math.round((post.insights.avgWatchTimeMs ?? 0) / 1000)} />
            </>
          ) : (
            <Metric icon={TrendingUp} label="Impressões" value={post.insights.impressions ?? 0} />
          )}
          <Metric icon={Share2} label="Compart." value={post.insights.shares ?? 0} />
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
      <div className="min-w-0">
        <p className="truncate text-[9px] text-muted-foreground/60">{label}</p>
        <p className="text-xs font-semibold text-foreground">{fmt(value)}</p>
      </div>
    </div>
  );
}

// ─── Custom chart tooltip ─────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-sm text-xs min-w-[140px]">
      <p className="mb-2 font-semibold text-foreground/80 border-b border-border/40 pb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-bold text-foreground tabular-nums">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-sm text-xs">
      <p className="mb-1 font-semibold text-foreground/80">{label}</p>
      <p className="text-emerald-500 font-bold text-sm">{v.toFixed(2)} pts</p>
    </div>
  );
}

// ─── Connection UI helpers ────────────────────────────────────────────────────

function InstagramLoginPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border/40 bg-gradient-to-br from-background to-muted/20 py-20 px-6 text-center">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00] shadow-lg shadow-[#7b00ae]/20">
          <Instagram className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-muted-foreground/20" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-foreground">Conecte seu Instagram</h3>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
          Conecte sua conta do Instagram via Facebook para publicar posts e acompanhar métricas.
        </p>
      </div>
      <Button
        className="bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white shadow-md shadow-[#7b00ae]/20 hover:shadow-lg"
        onClick={() => { window.location.href = "/auth/instagram"; }}
      >
        <Instagram className="h-4 w-4 mr-2" />
        Conectar com Facebook
      </Button>
    </div>
  );
}

function InstagramSetupGuide() {
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20">
          <Instagram className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">Conta Instagram não encontrada</h3>
          <p className="text-xs text-amber-700 dark:text-amber-400">O Facebook foi autorizado, mas nenhuma conta Instagram Business/Creator foi localizada.</p>
        </div>
      </div>

      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Para conectar, siga esses passos:</p>
      <ol className="space-y-2 text-sm text-amber-800 dark:text-amber-300 list-decimal pl-5">
        <li>No Instagram: <strong>Configurações → Conta → Mudar para conta profissional</strong> (Business ou Creator)</li>
        <li>No Facebook: crie ou acesse uma <strong>Página do Facebook</strong> que você administra</li>
        <li>Na Página do Facebook: <strong>Configurações → Instagram → Conectar conta</strong></li>
        <li>Depois volte aqui e clique em <strong>Tentar novamente</strong></li>
      </ol>

      <Button
        className="bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white"
        onClick={() => { window.location.href = "/auth/instagram"; }}
      >
        Tentar novamente
      </Button>
    </div>
  );
}

const MEDIA_POLL_MS = 60_000;
const PROFILE_POLL_MS = 120_000;

function useLastUpdated(isFetching: boolean) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevFetching = useRef(false);

  useEffect(() => {
    if (prevFetching.current && !isFetching) {
      setLastUpdated(new Date());
    }
    prevFetching.current = isFetching;
  }, [isFetching]);

  return lastUpdated;
}

// ─── Instagram Tab ────────────────────────────────────────────────────────────

function InstagramTab() {
  const [showDiag, setShowDiag] = useState(false);
  const [diagResult, setDiagResult] = useState<null | {
    ok: boolean;
    tokenSource?: string;
    tokenType?: string;
    expiresInDays?: number | null;
    scopes?: string[];
    missingScopes?: string[];
    igAccountId?: string;
    accountAccessOk?: boolean | null;
    accountError?: string | null;
    error?: string | null;
    details?: unknown;
  }>(null);

  const connectionQuery = trpc.analytics.getInstagramConnectionStatus.useQuery(undefined, {
    retry: 1,
    refetchInterval: PROFILE_POLL_MS,
    refetchIntervalInBackground: false,
  });
  const isConnected = connectionQuery.data?.connected === true;
  const profileQuery = trpc.analytics.getProfile.useQuery(undefined, {
    enabled: isConnected,
    retry: 1,
    refetchInterval: PROFILE_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const insightsQuery = trpc.analytics.getInsights.useQuery({ days: 30 }, {
    enabled: isConnected,
    retry: 1,
    refetchInterval: PROFILE_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const mediaQuery = trpc.analytics.getMedia.useQuery({ limit: 12 }, {
    enabled: isConnected,
    retry: 1,
    refetchInterval: MEDIA_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const demographicsQuery = trpc.analytics.getAudienceDemographics.useQuery(undefined, {
    enabled: isConnected,
    retry: 1,
    refetchInterval: PROFILE_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const disconnectMutation = trpc.analytics.disconnectInstagram.useMutation({
    onSuccess: () => { toast.success("Instagram desconectado."); void connectionQuery.refetch(); },
  });
  const diagnoseMutation = trpc.analytics.diagnoseInstagramToken.useMutation({
    onSuccess: (data) => { setDiagResult(data); setShowDiag(true); },
    onError: (err) => { setDiagResult({ ok: false, error: err.message }); setShowDiag(true); },
  });

  const refetchAll = () => {
    void connectionQuery.refetch();
    void profileQuery.refetch();
    void insightsQuery.refetch();
    void mediaQuery.refetch();
    void demographicsQuery.refetch();
  };

  const isFetching = profileQuery.isFetching || insightsQuery.isFetching || mediaQuery.isFetching;
  const lastUpdated = useLastUpdated(isFetching);

  const insights: InsightMetric[] = insightsQuery.data ?? [];
  const profile = profileQuery.data;
  const chartData = buildChartData(insights);
  const totalReach = sumMetric(insights, "reach");
  const totalImpressions = sumMetric(insights, "impressions");
  const totalProfileViews = sumMetric(insights, "profile_views");
  const followerChange = sumMetric(insights, "follower_count");
  const totalWebsiteClicks = sumMetric(insights, "website_clicks");
  const totalPhoneClicks = sumMetric(insights, "phone_call_clicks");
  const totalDirectionsClicks = sumMetric(insights, "get_directions_clicks");
  const totalInteractions = sumMetric(insights, "total_interactions");
  const totalAccountsEngaged = sumMetric(insights, "accounts_engaged");

  const isLoading = profileQuery.isLoading || insightsQuery.isLoading;
  const hasError = profileQuery.isError || insightsQuery.isError;
  const notConnected = connectionQuery.isSuccess && !isConnected;
  const igConnectParam = new URLSearchParams(window.location.search).get("ig_connect");
  const oauthNoAccount = igConnectParam === "no_account";

  useEffect(() => {
    if (igConnectParam === "success") {
      toast.success("Instagram conectado com sucesso!");
      void connectionQuery.refetch();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (igConnectParam === "denied") {
      toast.error("Autorização negada pelo Facebook.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (igConnectParam === "error") {
      const detail = new URLSearchParams(window.location.search).get("detail") ?? "";
      toast.error(`Erro ao conectar Instagram: ${detail}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [igConnectParam]);

  // Engagement score derived data
  const posts = mediaQuery.data ?? [];
  const scores = posts.map((p) => (p as typeof p & { engagementScore?: number }).engagementScore ?? 0);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const topPost = posts.reduce<(typeof posts[0] & { engagementScore?: number }) | null>((best, p) => {
    const s = (p as typeof p & { engagementScore?: number }).engagementScore ?? 0;
    return !best || s > ((best as typeof p & { engagementScore?: number }).engagementScore ?? 0)
      ? (p as typeof p & { engagementScore?: number })
      : best;
  }, null);

  const tickInterval = chartData.length > 14 ? Math.floor(chartData.length / 6) : "preserveStartEnd";

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]">
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Analytics Instagram</h2>
            <p className="text-xs text-muted-foreground/70">Painel de desempenho em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && !isFetching && (
            <span className="text-[10px] text-muted-foreground/60 hidden sm:block">
              Atualizado {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => diagnoseMutation.mutate()}
            disabled={diagnoseMutation.isPending}
            className="gap-2 rounded-xl"
          >
            <Stethoscope className={cn("h-3.5 w-3.5", diagnoseMutation.isPending && "animate-pulse")} />
            <span className="hidden sm:inline">{diagnoseMutation.isPending ? "Diagnosticando…" : "Diagnosticar"}</span>
          </Button>
          {isConnected && (
            <Button variant="outline" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} className="gap-2 rounded-xl text-destructive hover:text-destructive hidden sm:flex">
              Desconectar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={isFetching} className="gap-1.5 rounded-xl">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            <span className="hidden sm:inline">{isFetching ? "Atualizando…" : "Atualizar"}</span>
          </Button>
        </div>
      </div>

      {/* Diagnostic panel */}
      {showDiag && diagResult && (
        <div className={cn(
          "rounded-2xl border p-5 space-y-3",
          diagResult.ok
            ? "border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-red-400/40 bg-red-50 dark:bg-red-950/20"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {diagResult.ok
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
              <span className={cn("font-semibold text-sm", diagResult.ok ? "text-emerald-900 dark:text-emerald-200" : "text-red-900 dark:text-red-200")}>
                {diagResult.ok ? "Token válido" : "Problema encontrado com o token"}
              </span>
            </div>
            <button onClick={() => setShowDiag(false)} className="text-muted-foreground hover:text-foreground">
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            {diagResult.tokenSource && (
              <div className="rounded-lg bg-background/60 px-3 py-2">
                <p className="text-muted-foreground">Fonte do token</p>
                <p className="font-semibold mt-0.5">{diagResult.tokenSource === "database" ? "Banco de dados (OAuth)" : ".env / servidor"}</p>
              </div>
            )}
            {diagResult.tokenType && (
              <div className="rounded-lg bg-background/60 px-3 py-2">
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-semibold mt-0.5">{diagResult.tokenType}</p>
              </div>
            )}
            {diagResult.expiresInDays !== undefined && (
              <div className={cn("rounded-lg px-3 py-2", diagResult.expiresInDays === null ? "bg-background/60" : diagResult.expiresInDays < 7 ? "bg-amber-100/80 dark:bg-amber-900/30" : "bg-background/60")}>
                <p className="text-muted-foreground">Expira em</p>
                <p className="font-semibold mt-0.5">
                  {diagResult.expiresInDays === null ? "Nunca (token de longa duração)" : `${diagResult.expiresInDays} dias`}
                </p>
              </div>
            )}
            {diagResult.igAccountId && (
              <div className="rounded-lg bg-background/60 px-3 py-2">
                <p className="text-muted-foreground">ID da conta IG</p>
                <p className="font-semibold mt-0.5 break-all">{diagResult.igAccountId}</p>
              </div>
            )}
            {diagResult.accountAccessOk !== undefined && (
              <div className={cn("rounded-lg px-3 py-2", diagResult.accountAccessOk ? "bg-background/60" : "bg-red-100/80 dark:bg-red-900/30")}>
                <p className="text-muted-foreground">Acesso à conta</p>
                <p className="font-semibold mt-0.5">{diagResult.accountAccessOk ? "OK" : "Falhou"}</p>
              </div>
            )}
          </div>

          {(diagResult.missingScopes?.length ?? 0) > 0 && (
            <div className="rounded-lg bg-amber-100/80 dark:bg-amber-900/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="font-semibold text-amber-900 dark:text-amber-200">Permissões faltando</span>
              </div>
              <p className="text-amber-800 dark:text-amber-300 break-all">{diagResult.missingScopes!.join(", ")}</p>
            </div>
          )}

          {diagResult.scopes && diagResult.scopes.length > 0 && (
            <div className="rounded-lg bg-background/60 px-3 py-2 text-xs">
              <p className="text-muted-foreground mb-1">Permissões concedidas</p>
              <p className="break-all text-foreground/80">{diagResult.scopes.join(", ")}</p>
            </div>
          )}

          {diagResult.error && (
            <div className="rounded-lg bg-red-100/80 dark:bg-red-900/30 px-3 py-2 text-xs">
              <p className="font-semibold text-red-900 dark:text-red-200 mb-0.5">Erro</p>
              <p className="text-red-700 dark:text-red-300 break-all">{diagResult.error}</p>
            </div>
          )}

          {diagResult.accountError && (
            <div className="rounded-lg bg-red-100/80 dark:bg-red-900/30 px-3 py-2 text-xs">
              <p className="font-semibold text-red-900 dark:text-red-200 mb-0.5">Erro de acesso à conta</p>
              <p className="text-red-700 dark:text-red-300 break-all">{diagResult.accountError}</p>
            </div>
          )}

          {Boolean(diagResult.details) && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Detalhes técnicos</summary>
              <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-background/60 p-3 text-[10px] leading-relaxed">{JSON.stringify(diagResult.details, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {connectionQuery.isLoading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/50" />
        </div>
      )}

      {notConnected && (oauthNoAccount ? <InstagramSetupGuide /> : <InstagramLoginPrompt />)}

      {hasError && isConnected && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar os dados. Token inválido ou expirado — reconecte a conta.
        </div>
      )}

      {isConnected && (
        <>
          {/* ── Profile header ───────────────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/80">
            <div className="h-24 bg-gradient-to-r from-[#7b00ae]/20 via-[#fe6e00]/12 to-[#7b00ae]/8" />
            <div className="px-5 pb-5">
              {/* Avatar — overlaps cover, sits alone */}
              <div className="-mt-10 mb-3">
                {isLoading ? (
                  <Skeleton className="h-[72px] w-[72px] rounded-full" />
                ) : profile?.profile_picture_url ? (
                  <SafeImage src={profile.profile_picture_url} alt="avatar" className="h-[72px] w-[72px] rounded-full border-[3px] border-background object-cover shadow-lg" fallbackClassName="rounded-full" />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-background bg-gradient-to-br from-[#7b00ae] to-[#fe6e00] text-xl font-bold text-white shadow-lg">
                    {profile?.username?.[0]?.toUpperCase() ?? "K"}
                  </div>
                )}
              </div>

              {/* Name + handle */}
              {isLoading ? (
                <div className="space-y-2 mb-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-64 mt-1" />
                </div>
              ) : (
                <div className="mb-3 space-y-0.5">
                  <p className="text-base font-bold text-foreground leading-tight">{profile?.name ?? profile?.username}</p>
                  <p className="text-xs text-muted-foreground/60">@{profile?.username}</p>
                  {profile?.biography && (
                    <p className="text-xs leading-relaxed text-muted-foreground/80 pt-1.5 max-w-xl">{profile.biography}</p>
                  )}
                </div>
              )}

              {/* Stats — below bio, separated */}
              <div className="flex gap-6 border-t border-border/30 pt-3">
                {[
                  { label: "Seguidores", value: profile?.followers_count },
                  { label: "Seguindo", value: profile?.follows_count },
                  { label: "Posts", value: profile?.media_count },
                ].map((s) => (
                  <div key={s.label}>
                    {isLoading
                      ? <Skeleton className="h-5 w-10 mb-1" />
                      : <p className="text-sm font-bold text-foreground tabular-nums">{fmt(s.value ?? 0)}</p>
                    }
                    <p className="text-[10px] text-muted-foreground/55">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Score de Engajamento ─────────────────────────────── */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-background to-background p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/6 blur-2xl" />

            {/* Header row */}
            <div className="relative mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-sm shadow-emerald-500/30">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Score de Engajamento</p>
                <p className="text-[10px] text-muted-foreground/55">Algoritmo 2026 · {posts.length} posts</p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="ml-auto flex items-center gap-1 rounded-md border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                    <Info className="h-2.5 w-2.5" />
                    Fórmula
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-76 p-4">
                  <p className="text-sm font-bold text-foreground mb-2">Fórmula do Score 2026</p>
                  <div className="rounded-lg bg-muted/60 px-3 py-2 font-mono text-[11px] text-foreground/80 leading-relaxed">
                    (Compart. ×4 + Salv. ×3 + Coment. ×2 + Curtidas ×1)<br />÷ Alcance × 100
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                    Salvamentos e compartilhamentos têm maior peso por sinalizarem intenção forte ao algoritmo 2026.
                  </p>
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[10px] text-muted-foreground/60">
                    <Info className="h-3 w-3 shrink-0 mt-px" />
                    <span>A API Meta inclui reposts e stories em "compartilhamentos" — DMs não são expostos separadamente.</span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Score + best post — side by side */}
            <div className="relative flex items-center gap-5">
              {/* Score number */}
              <div className="shrink-0">
                {mediaQuery.isLoading ? (
                  <Skeleton className="h-12 w-28" />
                ) : posts.length === 0 ? (
                  <div>
                    <p className="text-4xl font-black text-muted-foreground/20 tabular-nums">—</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">sem posts</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl font-black tracking-tight text-emerald-500 dark:text-emerald-400 tabular-nums leading-none">
                      {avgScore.toFixed(1)}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/55">pts / 100 alcance</p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-12 w-px bg-border/40 shrink-0" />

              {/* Best post mini-card */}
              {topPost && !mediaQuery.isLoading ? (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {(topPost.thumbnail_url || topPost.media_url) ? (
                    <SafeImage
                      src={topPost.thumbnail_url ?? topPost.media_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      fallbackClassName="rounded-lg"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40 flex items-center gap-1 mb-0.5">
                      <Award className="h-2.5 w-2.5" />melhor post
                    </p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {topPost.caption?.slice(0, 50) ?? fmtDate(topPost.timestamp)}
                    </p>
                    <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
                      {((topPost as typeof topPost & { engagementScore?: number }).engagementScore ?? 0).toFixed(2)} pts
                    </p>
                  </div>
                  <a href={topPost.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                !mediaQuery.isLoading && <p className="text-xs text-muted-foreground/40">—</p>
              )}

              {/* Bar chart fills remaining space */}
              {!mediaQuery.isLoading && posts.length > 0 && (() => {
                const chartPosts = [...posts]
                  .map((p) => ({
                    label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(p.timestamp)),
                    Score: (p as typeof p & { engagementScore?: number }).engagementScore ?? 0,
                  }))
                  .reverse();
                return (
                  <div className="hidden sm:block flex-1 min-w-0">
                    <ResponsiveContainer width="100%" height={72}>
                      <BarChart data={chartPosts} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <XAxis dataKey="label" hide />
                        <YAxis hide />
                        <Tooltip content={<ScoreChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                        <Bar dataKey="Score" fill={CHART_COLORS.Score} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── KPI Cards ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-background/80 p-5">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="mt-2 h-8 w-16" />
                  <Skeleton className="mt-1.5 h-2.5 w-28" />
                </div>
              ))
            ) : (
              <>
                <KpiCard
                  label="Seguidores"
                  value={fmt(profile?.followers_count ?? 0)}
                  icon={Users}
                  accentClass="bg-gradient-to-br from-alle-purple to-alle-purple-light"
                  isEmpty={!profile?.followers_count}
                  trend={followerChange !== 0
                    ? { delta: followerChange, label: `${followerChange > 0 ? "+" : ""}${followerChange} nos últimos 30d` }
                    : { delta: 0, label: "Sem variação — 30d" }
                  }
                />
                <KpiCard
                  label="Alcance Total"
                  value={fmt(totalReach)}
                  icon={UserCheck}
                  accentClass="bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]"
                  isEmpty={totalReach === 0}
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Impressões"
                  value={fmt(totalImpressions)}
                  icon={TrendingUp}
                  accentClass="bg-gradient-to-br from-orange-500 to-rose-500"
                  isEmpty={totalImpressions === 0}
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Visitas ao Perfil"
                  value={fmt(totalProfileViews)}
                  icon={Eye}
                  accentClass="bg-gradient-to-br from-cyan-500 to-blue-500"
                  isEmpty={totalProfileViews === 0}
                  sub="Últimos 30 dias"
                />
              </>
            )}
          </div>

          {/* ── Profile Action KPI Cards ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-background/80 p-5">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="mt-2 h-8 w-16" />
                  <Skeleton className="mt-1.5 h-2.5 w-28" />
                </div>
              ))
            ) : (
              <>
                <KpiCard
                  label="Cliques no Site"
                  value={fmt(totalWebsiteClicks)}
                  icon={ExternalLink}
                  accentClass="bg-gradient-to-br from-alle-purple to-alle-purple-light"
                  isEmpty={totalWebsiteClicks === 0}
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Ligações"
                  value={fmt(totalPhoneClicks)}
                  icon={Phone}
                  accentClass="bg-gradient-to-br from-emerald-500 to-teal-600"
                  isEmpty={totalPhoneClicks === 0}
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Direções"
                  value={fmt(totalDirectionsClicks)}
                  icon={MapPin}
                  accentClass="bg-gradient-to-br from-amber-500 to-orange-600"
                  isEmpty={totalDirectionsClicks === 0}
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Interações Totais"
                  value={fmt(totalInteractions)}
                  icon={Activity}
                  accentClass="bg-gradient-to-br from-rose-500 to-pink-600"
                  isEmpty={totalInteractions === 0}
                  sub="Últimos 30 dias"
                />
                <KpiCard
                  label="Contas Engajadas"
                  value={fmt(totalAccountsEngaged)}
                  icon={Users2}
                  accentClass="bg-gradient-to-br from-sky-500 to-cyan-600"
                  isEmpty={totalAccountsEngaged === 0}
                  sub="Últimos 30 dias"
                />
              </>
            )}
          </div>

          {/* ── Charts ───────────────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Area chart — Alcance & Impressões */}
            <div className="rounded-2xl border border-border/40 bg-background/80 p-5 lg:col-span-2">
              <p className="mb-1 text-sm font-bold text-foreground">Alcance e Impressões</p>
              <p className="mb-4 text-[11px] text-muted-foreground/60">Últimos 30 dias</p>
              {isLoading ? (
                <Skeleton className="h-56 w-full rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                  <BarChart2 className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground/50">Sem dados de insights para o período.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      {(["Alcance", "Impressões"] as const).map((key) => (
                        <linearGradient key={key} id={`grad-ig-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS[key]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS[key]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" opacity={0.25} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.6 }} tickLine={false} axisLine={false} interval={tickInterval} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.6 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
                    {(["Alcance", "Impressões"] as const).map((key) => (
                      <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[key]} strokeWidth={2} fill={`url(#grad-ig-${key})`} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bar chart — Profile views */}
            <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
              <p className="mb-1 text-sm font-bold text-foreground">Visitas ao Perfil</p>
              <p className="mb-4 text-[11px] text-muted-foreground/60">Últimos 30 dias</p>
              {isLoading ? (
                <Skeleton className="h-56 w-full rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
                  <Eye className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground/50">Sem dados disponíveis.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" opacity={0.25} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.6 }} tickLine={false} axisLine={false} interval={tickInterval} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.6 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                    <Bar dataKey="Visitas ao Perfil" fill={CHART_COLORS["Visitas ao Perfil"]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Audience Demographics ────────────────────────────── */}
          <AudienceDemographicsSection />

          {/* ── Comment Alerts ───────────────────────────────────── */}
          <CommentAlertsPanel />

          {/* ── Post grid ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Posts Recentes</p>
                <p className="text-[11px] text-muted-foreground/60">Score por post · últimas publicações</p>
              </div>
              {(mediaQuery.data?.length ?? 0) > 0 && (
                <span className="rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
                  {mediaQuery.data!.length} posts
                </span>
              )}
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
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <XCircle className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">Não foi possível carregar os posts.</p>
              </div>
            ) : (mediaQuery.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <Instagram className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm font-medium text-muted-foreground/50">Nenhum post encontrado</p>
                <p className="text-xs text-muted-foreground/40">Publique seu primeiro post para ver as métricas aqui.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {mediaQuery.data!.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Comment Alerts Panel ─────────────────────────────────────────────────────

function useCountdown(detectedAt: Date): { label: string; urgent: boolean; expired: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const msRemaining = 60 * 60 * 1000 - (now - detectedAt.getTime());
  if (msRemaining <= 0) return { label: "Janela expirada", urgent: false, expired: true };
  const mins = Math.floor(msRemaining / 60_000);
  const urgent = mins < 15;
  return {
    label: mins >= 60 ? "< 1h restante" : `${mins} min restantes`,
    urgent,
    expired: false,
  };
}

function AlertCard({
  alert,
  onAcknowledge,
}: {
  alert: { id: number; mediaCaption: string | null; mediaPermalink: string | null; previousCount: number; newCount: number; detectedAt: string | Date };
  onAcknowledge: (id: number) => void;
}) {
  const detectedAt = alert.detectedAt instanceof Date ? alert.detectedAt : new Date(alert.detectedAt);
  const { label, urgent, expired } = useCountdown(detectedAt);
  const increase = alert.newCount - alert.previousCount;
  const shortCaption = alert.mediaCaption
    ? alert.mediaCaption.slice(0, 70) + (alert.mediaCaption.length > 70 ? "…" : "")
    : "(sem legenda)";

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-xl border p-3 transition-colors",
      expired
        ? "border-border/40 bg-muted/20 opacity-60"
        : urgent
        ? "border-red-500/40 bg-red-500/5"
        : "border-amber-500/40 bg-amber-500/5"
    )}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5",
        expired ? "bg-muted" : urgent ? "bg-red-500/15" : "bg-amber-500/15"
      )}>
        <MessageCircle className={cn(
          "h-4 w-4",
          expired ? "text-muted-foreground" : urgent ? "text-red-500" : "text-amber-500"
        )} />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">
            +{increase} comentário{increase !== 1 ? "s" : ""}
          </span>
          <span className={cn(
            "flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
            expired
              ? "bg-muted text-muted-foreground"
              : urgent
              ? "bg-red-500/20 text-red-500"
              : "bg-amber-500/20 text-amber-600"
          )}>
            <Clock className="h-2.5 w-2.5" />
            {label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{shortCaption}</p>
        <p className="text-[10px] text-muted-foreground/60">
          Detectado às {detectedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {alert.mediaPermalink && (
          <a
            href={alert.mediaPermalink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
            title="Abrir no Instagram"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          onClick={() => onAcknowledge(alert.id)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
          title="Marcar como visto"
        >
          <CheckCheck className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Audience Demographics ──────────────────────────────────────────────────

const DEMOGRAPHICS_COLORS = ["#7b00ae", "#fe6e00", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#0ea5e9"];

function DemographicsBarList({ items, limit = 6 }: { items: Array<{ dimension: string; value: number }>; limit?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const top = [...items].sort((a, b) => b.value - a.value).slice(0, limit);

  if (top.length === 0) {
    return <p className="text-xs text-muted-foreground/40 py-2">Sem dados suficientes.</p>;
  }

  return (
    <div className="space-y-2">
      {top.map((item, i) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div key={item.dimension} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground/70">{item.dimension}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: DEMOGRAPHICS_COLORS[i % DEMOGRAPHICS_COLORS.length] }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-foreground">{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function AudienceDemographicsSection() {
  const { data, isLoading } = trpc.analytics.getAudienceDemographics.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const current = data?.current;
  const genderAge = current?.genderAge ?? [];
  const city = current?.city ?? [];
  const country = current?.country ?? [];

  return (
    <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]">
          <PieChartIcon className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Demografia da Audiência</p>
          <p className="text-[11px] text-muted-foreground/60">Idade, gênero e localização de quem interage</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : !data?.available ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Users2 className="h-8 w-8 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground/50">
            Sem dados de demografia ainda.
          </p>
          <p className="max-w-sm text-xs text-muted-foreground/40">
            A Meta só libera esses dados para contas com pelo menos 100 seguidores. Se sua conta já
            atende esse mínimo, os dados aparecem aqui após a próxima coleta.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Idade / Gênero</p>
            <DemographicsBarList items={genderAge} />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Principais Cidades</p>
            <DemographicsBarList items={city} />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Principais Países</p>
            <DemographicsBarList items={country} />
          </div>
        </div>
      )}
    </div>
  );
}

function CommentAlertsPanel() {
  const alertsQuery = trpc.commentAlerts.getAlerts.useQuery(undefined, {
    refetchInterval: 2 * 60_000,
    refetchIntervalInBackground: false,
  });
  const acknowledgeMut = trpc.commentAlerts.acknowledge.useMutation({
    onSuccess: () => void alertsQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const acknowledgeAllMut = trpc.commentAlerts.acknowledgeAll.useMutation({
    onSuccess: (d) => {
      toast.success(`${d.acknowledged} alerta${d.acknowledged !== 1 ? "s" : ""} marcado${d.acknowledged !== 1 ? "s" : ""} como visto${d.acknowledged !== 1 ? "s" : ""}`);
      void alertsQuery.refetch();
    },
  });

  const alerts = alertsQuery.data ?? [];
  const openCount = alerts.length;

  if (alertsQuery.isLoading) return null;
  if (openCount === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
            <Bell className="h-4 w-4 text-amber-500" />
          </div>
          <span className="text-sm font-semibold text-foreground">Alertas de Comentários</span>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
            {openCount}
          </span>
        </div>
        {openCount > 1 && (
          <button
            onClick={() => acknowledgeAllMut.mutate()}
            disabled={acknowledgeAllMut.isPending}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckCheck className="h-3 w-3" />
            Marcar todos
          </button>
        )}
      </div>

      <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
        Responda nos primeiros 60 minutos para maximizar o alcance do post.
      </p>

      <div className="space-y-2">
        {alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={(id) => acknowledgeMut.mutate({ id })}
          />
        ))}
      </div>
    </div>
  );
}

// ─── LinkedIn Tab ─────────────────────────────────────────────────────────────

function LinkedInLoginPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-border/40 bg-gradient-to-br from-background to-muted/20 py-20 px-6 text-center">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0A66C2] shadow-lg shadow-[#0A66C2]/20">
          <Linkedin className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-muted-foreground/20" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-foreground">Conecte seu LinkedIn</h3>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
          Conecte sua conta pessoal do LinkedIn para publicar artigos e acompanhar métricas.
        </p>
      </div>
      <Button
        className="bg-[#0A66C2] text-white shadow-md shadow-[#0A66C2]/20 hover:bg-[#0A66C2]/90 hover:shadow-lg"
        onClick={() => { window.location.href = "/api/oauth/linkedin/connect"; }}
      >
        <Linkedin className="h-4 w-4 mr-2" />
        Conectar com LinkedIn
      </Button>
    </div>
  );
}

function LinkedInTab() {
  const connectionQuery = trpc.analytics.getLinkedInConnectionStatus.useQuery(undefined, { retry: 1 });
  const isConnected = connectionQuery.data?.connected === true;
  const profileQuery = trpc.analytics.getLinkedInProfile.useQuery(undefined, { enabled: isConnected, retry: 1 });
  const statsQuery = trpc.analytics.getLinkedInStats.useQuery(undefined, { enabled: isConnected, retry: 1 });
  const disconnectMutation = trpc.analytics.disconnectLinkedIn.useMutation({
    onSuccess: () => { toast.success("LinkedIn desconectado."); void connectionQuery.refetch(); },
  });

  const refetchAll = () => {
    void connectionQuery.refetch();
    void profileQuery.refetch();
    void statsQuery.refetch();
  };

  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const isLoading = profileQuery.isLoading || statsQuery.isLoading;
  const isFetching = profileQuery.isFetching || statsQuery.isFetching;
  const notConnected = connectionQuery.isSuccess && !isConnected;

  const linkedinConnectParam = new URLSearchParams(window.location.search).get("linkedin_connect");
  useEffect(() => {
    if (linkedinConnectParam === "success") {
      toast.success("LinkedIn conectado com sucesso!");
      void connectionQuery.refetch();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (linkedinConnectParam === "denied") {
      toast.error("Autorização negada pelo LinkedIn.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (linkedinConnectParam === "error") {
      const detail = new URLSearchParams(window.location.search).get("detail") ?? "";
      toast.error(`Erro ao conectar LinkedIn: ${detail}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [linkedinConnectParam]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A66C2]">
            <Linkedin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Analytics LinkedIn</h2>
            <p className="text-xs text-muted-foreground/70">Histórico de publicações e métricas da conta</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <Button variant="ghost" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} className="text-xs text-muted-foreground">
              Desconectar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={isFetching} className="gap-2 rounded-xl">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {notConnected && <LinkedInLoginPrompt />}

      {isConnected && <>
      {/* Profile card */}
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/80">
        <div className="h-28 bg-gradient-to-r from-[#0A66C2]/25 via-[#0A66C2]/10 to-transparent" />
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="shrink-0">
              {isLoading ? (
                <Skeleton className="h-20 w-20 rounded-full" />
              ) : profile?.picture ? (
                <SafeImage src={profile.picture} alt="avatar" className="h-20 w-20 rounded-full border-4 border-background object-cover shadow-xl" fallbackClassName="rounded-full" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-[#0A66C2] text-2xl font-bold text-white shadow-xl">
                  {profile?.name?.[0]?.toUpperCase() ?? "L"}
                </div>
              )}
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56 mt-1" />
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-bold text-foreground leading-tight">{profile?.name || "LinkedIn"}</p>
              {profile?.email && <p className="text-sm text-muted-foreground/70">{profile.email}</p>}
              <p className="text-xs text-muted-foreground/50">
                Perfil pessoal · {profile?.authorUrn}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-background/80 p-5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-2 h-8 w-16" />
              <Skeleton className="mt-1.5 h-2.5 w-28" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              label="Posts Publicados"
              value={stats?.totalPublished ?? 0}
              icon={Send}
              accentClass="bg-[#0A66C2]"
              isEmpty={!stats?.totalPublished}
              sub="Total acumulado"
            />
            <KpiCard
              label="Este Mês"
              value={stats?.publishedThisMonth ?? 0}
              icon={TrendingUp}
              accentClass="bg-gradient-to-br from-emerald-500 to-teal-600"
              isEmpty={!stats?.publishedThisMonth}
              sub="Posts publicados"
            />
            <KpiCard
              label="Rascunhos"
              value={stats?.totalDrafts ?? 0}
              icon={FileText}
              accentClass="bg-gradient-to-br from-slate-500 to-slate-600"
              isEmpty={!stats?.totalDrafts}
              sub="Aguardando publicação"
            />
          </>
        )}
      </div>

      {/* Recent posts */}
      <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Publicações Recentes</p>
            <p className="text-[11px] text-muted-foreground/60">Histórico de posts publicados pelo sistema</p>
          </div>
          {(stats?.recentPosts?.length ?? 0) > 0 && (
            <span className="rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
              {stats!.recentPosts!.length} posts
            </span>
          )}
        </div>

        {statsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !stats?.recentPosts?.length ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Linkedin className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground/50">Nenhuma publicação encontrada</p>
            <p className="text-xs text-muted-foreground/40">As publicações feitas pelo sistema aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {stats.recentPosts.map((post) => {
              const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(post.publishedAt));
              return (
                <div key={post.id} className="flex gap-3 rounded-xl border border-border/30 bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                  {post.imageUrl ? (
                    <SafeImage src={post.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" fallbackClassName="rounded-lg" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#0A66C2]/10">
                      <Linkedin className="h-6 w-6 text-[#0A66C2]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {post.title && <p className="mb-1 truncate text-sm font-semibold text-foreground">{post.title}</p>}
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/70">{post.content}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/50">{date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

type Tab = "instagram" | "linkedin";

export default function Analytics() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("instagram");

  return (
    <AppLayout activeModule="analytics">
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Page header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7b00ae] to-[#0A66C2] shadow-md shadow-[#7b00ae]/20">
              <BarChart2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t("analyticsTitle")}</h1>
              <p className="text-xs text-muted-foreground/60">{t("analyticsSubtitle")}</p>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 rounded-xl border border-border/40 bg-muted/30 p-1 w-fit">
            <button
              onClick={() => setActiveTab("instagram")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                activeTab === "instagram"
                  ? "bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </button>
            <button
              onClick={() => setActiveTab("linkedin")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                activeTab === "linkedin"
                  ? "bg-[#0A66C2] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </button>
          </div>

          {activeTab === "instagram" && <InstagramTab />}
          {activeTab === "linkedin" && <LinkedInTab />}

          <PerformanceInsightsSection />

        </div>
      </div>
    </AppLayout>
  );
}

// ─── Performance Insights (Module 1.3) ────────────────────────────────────────

function PerformanceInsightsSection() {
  const { t } = useLanguage();
  const { data: stats, isLoading } = trpc.performance.getStats.useQuery();

  const HOOK_PT: Record<string, string> = {
    curiosity: "Curiosidade",
    controversy: "Polêmica",
    pain: "Dor/Problema",
    benefit: "Benefício",
    story: "Storytelling",
    data: "Dado/Estatística",
    question: "Pergunta",
    unknown: "—",
  };

  const SOURCE_PT: Record<string, string> = {
    radar: "Radar de Temas",
    insumo: "Insumo Universal",
    manual: "Tema manual",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-amber-400" />
        <h2 className="text-base font-semibold text-foreground">{t("performanceTitle")}</h2>
        {stats && (
          <span className="ml-auto text-xs text-muted-foreground">
            {stats.totalPostsAnalyzed} {t("performancePostsAnalyzed")}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : !stats ? (
        <div className="rounded-xl border border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          <Award className="mx-auto h-8 w-8 mb-2 opacity-30" />
          {t("performanceEmpty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PerfCard
            label={t("performanceBestHook")}
            value={HOOK_PT[stats.bestHook] ?? stats.bestHook}
            score={stats.bestScore}
            scoreLabel={t("performanceScore")}
            accentClass="bg-rose-500"
          />
          <PerfCard
            label={t("performanceBestStyle")}
            value={stats.bestStyle}
            score={stats.bestScore}
            scoreLabel={t("performanceScore")}
            accentClass="bg-violet-500"
          />
          <PerfCard
            label={t("performanceBestSource")}
            value={SOURCE_PT[stats.bestSource] ?? stats.bestSource}
            score={stats.bestScore}
            scoreLabel={t("performanceScore")}
            accentClass="bg-emerald-500"
          />
        </div>
      )}
    </div>
  );
}

function PerfCard({ label, value, score, scoreLabel, accentClass }: {
  label: string;
  value: string;
  score: number;
  scoreLabel: string;
  accentClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/20 p-4">
      <div className={cn("absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-10 blur-xl", accentClass)} />
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="mt-1.5 text-base font-semibold text-foreground truncate">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{score}/100 {scoreLabel}</p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted/50">
        <div
          className={cn("h-full rounded-full", accentClass)}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}