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
  ChevronDown,
  ChevronUp,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

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

function scoreColor(score: number) {
  if (score >= 10) return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/40";
  if (score >= 5) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-400/40";
  return "text-muted-foreground bg-muted/50 border-border/40";
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
    engagementScore?: number;
  };
}) {
  const thumb = post.thumbnail_url || post.media_url;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).format(
    new Date(post.timestamp)
  );
  const score = post.engagementScore ?? 0;

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
        <span className={cn(
          "absolute top-2 left-2 flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
          scoreColor(score)
        )}>
          <Zap className="h-2.5 w-2.5" />
          {score.toFixed(1)}
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
          <Metric icon={Share2} label="Compart." value={post.insights.shares ?? 0} />
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
  Score: "#10b981",
};

function InstagramLoginPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-border/40 bg-background/80 py-16 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]">
        <Instagram className="h-8 w-8 text-white" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Conecte seu Instagram</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte sua conta do Instagram via Facebook para publicar posts e acompanhar métricas.
        </p>
      </div>
      <Button
        className="bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white"
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

const MEDIA_POLL_MS = 60_000;   // post-level metrics every 60 s
const PROFILE_POLL_MS = 120_000; // follower count / insights every 2 min

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]">
            <Instagram className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Analytics Instagram</h2>
            <p className="text-xs text-muted-foreground">Painel de desempenho em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && !isFetching && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
            {diagnoseMutation.isPending ? "Diagnosticando…" : "Diagnosticar Token"}
          </Button>
          {isConnected && (
            <Button variant="outline" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending} className="gap-2 rounded-xl text-destructive hover:text-destructive">
              Desconectar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={isFetching} className="gap-2 rounded-xl">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            {isFetching ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
      </div>

      {/* Diagnostic result panel */}
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
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {notConnected && (oauthNoAccount ? <InstagramSetupGuide /> : <InstagramLoginPrompt />)}

      {hasError && isConnected && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar os dados. Token inválido ou expirado — reconecte a conta.
        </div>
      )}

      {isConnected && <>
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/80">
        <div className="h-24 bg-gradient-to-r from-[#7b00ae]/30 via-[#fe6e00]/20 to-[#7b00ae]/10" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <div className="-mt-14 flex-shrink-0">
            {isLoading ? (
              <Skeleton className="h-20 w-20 rounded-full" />
            ) : profile?.profile_picture_url ? (
              <img src={profile.profile_picture_url} alt="avatar" className="h-20 w-20 rounded-full border-4 border-background object-cover shadow-lg" />
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
                {profile?.biography && <p className="text-xs leading-relaxed text-muted-foreground">{profile.biography}</p>}
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
                {isLoading ? <Skeleton className="mx-auto h-5 w-12" /> : <p className="text-lg font-bold text-foreground">{fmt(s.value ?? 0)}</p>}
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
            <KpiCard label="Seguidores" value={fmt(profile?.followers_count ?? 0)} icon={Users} color="bg-gradient-to-br from-violet-500 to-purple-600" sub={followerChange !== 0 ? `${followerChange > 0 ? "+" : ""}${followerChange} nos últimos 30d` : "Últimos 30 dias"} />
            <KpiCard label="Alcance Total" value={fmt(totalReach)} icon={UserCheck} color="bg-gradient-to-br from-[#7b00ae] to-[#fe6e00]" sub="Últimos 30 dias" />
            <KpiCard label="Impressões" value={fmt(totalImpressions)} icon={TrendingUp} color="bg-gradient-to-br from-orange-500 to-rose-500" sub="Últimos 30 dias" />
            <KpiCard label="Visitas ao Perfil" value={fmt(totalProfileViews)} icon={Eye} color="bg-gradient-to-br from-cyan-500 to-blue-500" sub="Últimos 30 dias" />
          </>
        )}
      </div>

      {/* Engagement Score highlight card */}
      {(() => {
        const posts = mediaQuery.data ?? [];
        const scores = posts.map((p) => (p as typeof p & { engagementScore?: number }).engagementScore ?? 0);
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const top = posts.reduce<(typeof posts[0] & { engagementScore?: number }) | null>((best, p) => {
          const s = (p as typeof p & { engagementScore?: number }).engagementScore ?? 0;
          return !best || s > ((best as typeof p & { engagementScore?: number }).engagementScore ?? 0) ? (p as typeof p & { engagementScore?: number }) : best;
        }, null);

        return (
          <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-50/60 to-background dark:from-emerald-950/20 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Score de Engajamento</p>
                  <p className="text-xs text-muted-foreground">Média dos últimos {posts.length} posts</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {mediaQuery.isLoading ? (
                  <Skeleton className="h-9 w-20" />
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{avg.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">pontos por 100 de alcance</p>
                  </>
                )}
              </div>
            </div>

            {/* Score bar chart */}
            {!mediaQuery.isLoading && posts.length > 0 && (() => {
              const chartPosts = [...posts]
                .map((p) => ({
                  label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(p.timestamp)),
                  Score: (p as typeof p & { engagementScore?: number }).engagementScore ?? 0,
                }))
                .reverse();
              return (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartPosts} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                      formatter={(v: number) => [`${v.toFixed(2)} pts`, "Score"]}
                    />
                    <Bar dataKey="Score" fill={CHART_COLORS.Score} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}

            {/* Top post + formula info */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              {top && (
                <div className="flex-1 rounded-xl bg-background/60 border border-border/40 px-3 py-2 text-xs">
                  <p className="text-muted-foreground mb-0.5">Melhor post</p>
                  <p className="font-semibold text-foreground line-clamp-1">{top.caption?.slice(0, 60) ?? fmtDate(top.timestamp)}</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold">{((top as typeof top & { engagementScore?: number }).engagementScore ?? 0).toFixed(2)} pts</p>
                </div>
              )}
              <div className="flex-1 rounded-xl bg-background/60 border border-border/40 px-3 py-2 text-xs space-y-1">
                <p className="font-medium text-foreground">Fórmula do score</p>
                <p className="text-muted-foreground">Compartilhamentos ×4 + Salvamentos ×3 + Comentários ×2 + Curtidas ×1 ÷ Alcance × 100</p>
              </div>
            </div>

            {/* API limitation note */}
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-400/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                <strong>Limitação da API Meta:</strong> "Compartilhamentos" inclui todos os tipos (reposts, stories), não apenas envios por DM.
                A API do Instagram não expõe compartilhamentos por DM separadamente. Comentários não são filtrados por tamanho.
              </span>
            </div>
          </div>
        );
      })()}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/40 bg-background/80 p-5 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-foreground">Alcance e Impressões — 30 dias</p>
          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Sem dados de insights para o período.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {(["Alcance", "Impressões"] as const).map((key) => (
                    <linearGradient key={key} id={`grad-ig-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[key]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS[key]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number, name: string) => [fmt(v), name]} />
                {(["Alcance", "Impressões"] as const).map((key) => (
                  <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[key]} strokeWidth={2} fill={`url(#grad-ig-${key})`} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">Visitas ao Perfil</p>
          {isLoading ? (
            <Skeleton className="h-56 w-full rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">Sem dados disponíveis.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [fmt(v), "Visitas"]} />
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
      </>}

    </div>
  );
}

function LinkedInTab() {
  const profileQuery = trpc.analytics.getLinkedInProfile.useQuery(undefined, { retry: 1 });
  const statsQuery = trpc.analytics.getLinkedInStats.useQuery(undefined, { retry: 1 });

  const refetchAll = () => {
    void profileQuery.refetch();
    void statsQuery.refetch();
  };

  const profile = profileQuery.data;
  const stats = statsQuery.data;
  const isLoading = profileQuery.isLoading || statsQuery.isLoading;
  const isFetching = profileQuery.isFetching || statsQuery.isFetching;
  const hasProfileError = profileQuery.isError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A66C2]">
            <Linkedin className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Analytics LinkedIn</h2>
            <p className="text-xs text-muted-foreground">Histórico de publicações e métricas da conta</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll} disabled={isFetching} className="gap-2 rounded-xl">
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {hasProfileError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar o perfil do LinkedIn. Verifique se LINKEDIN_ACCESS_TOKEN está configurado no .env.
        </div>
      )}

      {/* Profile card */}
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/80">
        <div className="h-24 bg-gradient-to-r from-[#0A66C2]/30 via-[#0A66C2]/10 to-transparent" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
          <div className="-mt-14 flex-shrink-0">
            {isLoading ? (
              <Skeleton className="h-20 w-20 rounded-full" />
            ) : profile?.picture ? (
              <img src={profile.picture} alt="avatar" className="h-20 w-20 rounded-full border-4 border-background object-cover shadow-lg" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-[#0A66C2] text-2xl font-bold text-white shadow-lg">
                {profile?.name?.[0]?.toUpperCase() ?? "L"}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            {isLoading ? (
              <>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-56 mt-1" />
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-foreground">{profile?.name || "LinkedIn"}</p>
                {profile?.email && <p className="text-sm text-muted-foreground">{profile.email}</p>}
                <p className="text-xs text-muted-foreground">
                  {profile?.isOrg ? "Página de empresa" : "Perfil pessoal"} · {profile?.authorUrn}
                </p>
              </>
            )}
          </div>
          {profile?.followerCount !== undefined && (
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{fmt(profile.followerCount)}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-background/80 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-8 w-20" />
              <Skeleton className="mt-1 h-3 w-32" />
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Posts Publicados" value={stats?.totalPublished ?? 0} icon={Send} color="bg-[#0A66C2]" sub="Total acumulado" />
            <KpiCard label="Este Mês" value={stats?.publishedThisMonth ?? 0} icon={TrendingUp} color="bg-gradient-to-br from-emerald-500 to-teal-600" sub="Posts publicados" />
            <KpiCard label="Rascunhos" value={stats?.totalDrafts ?? 0} icon={FileText} color="bg-gradient-to-br from-slate-500 to-slate-600" sub="Aguardando publicação" />
          </>
        )}
      </div>

      {/* Recent posts */}
      <div className="rounded-2xl border border-border/40 bg-background/80 p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Publicações Recentes</p>
          <span className="text-xs text-muted-foreground">{stats?.recentPosts?.length ?? 0} posts</span>
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
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Linkedin className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma publicação encontrada.</p>
            <p className="text-xs text-muted-foreground">As publicações feitas pelo sistema aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.recentPosts.map((post) => {
              const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(post.publishedAt));
              return (
                <div key={post.id} className="flex gap-3 rounded-xl border border-border/30 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#0A66C2]/10">
                      <Linkedin className="h-6 w-6 text-[#0A66C2]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {post.title && <p className="mb-1 truncate text-sm font-medium text-foreground">{post.title}</p>}
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{post.content}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/70">{date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type Tab = "instagram" | "linkedin";

export default function Analytics() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("instagram");

  return (
    <AppLayout activeModule="analytics">
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7b00ae] to-[#0A66C2]">
              <BarChart2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t("analyticsTitle")}</h1>
              <p className="text-xs text-muted-foreground">{t("analyticsSubtitle")}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border border-border/40 bg-background/80 p-1 w-fit">
            <button
              onClick={() => setActiveTab("instagram")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "instagram"
                  ? "bg-gradient-to-r from-[#7b00ae] to-[#fe6e00] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Instagram className="h-4 w-4" />
              Instagram
            </button>
            <button
              onClick={() => setActiveTab("linkedin")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "linkedin"
                  ? "bg-[#0A66C2] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </button>
          </div>

          {activeTab === "instagram" && <InstagramTab />}
          {activeTab === "linkedin" && <LinkedInTab />}

        </div>
      </div>
    </AppLayout>
  );
}
