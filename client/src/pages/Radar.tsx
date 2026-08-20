import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  Zap,
  Heart,
  AlertTriangle,
  Eye,
  GalleryHorizontal,
  Film,
  FileText,
  ExternalLink,
  Layers,
  ImageIcon,
  Search,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import AppLayout from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import { usePlan } from "@/_core/hooks/usePlan";
import { useLocation } from "wouter";

const RADAR_PREFILL_KEY = "radar_prefill";

export type RadarPrefill = {
  topicAngleId?: number;
  topic: string;
  hook: string;
  hookType: string;
};

type TopicStatus = "sugerido" | "usado" | "descartado";

const ANGLE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  curiosidade: { label: "Curiosidade", icon: <Eye className="w-3 h-3" />, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  medo:        { label: "Urgência",    icon: <AlertTriangle className="w-3 h-3" />, color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  aspiracao:   { label: "Aspiração",   icon: <Heart className="w-3 h-3" />, color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  polemica:    { label: "Polêmica",    icon: <Flame className="w-3 h-3" />, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
};

const WINDOW_META: Record<string, { label: string; color: string }> = {
  ephemeral: { label: "Hoje", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  weekly:    { label: "Essa semana", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  evergreen: { label: "Atemporal", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

function ViralBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color =
    pct >= 75 ? "bg-emerald-500" :
    pct >= 50 ? "bg-amber-500" :
    "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-7 text-right">{pct}</span>
    </div>
  );
}

function TopicCard({
  topic,
  onStatusChange,
  onGenerate,
}: {
  topic: {
    id: number;
    title: string;
    description?: string | null;
    sourceUrl?: string | null;
    viralScore: number;
    emotionalAngle?: string | null;
    relevanceWindow?: string | null;
    angle?: {
      id: number;
      status: string;
      suggestedTitle: string;
      suggestedHook: string;
    } | null;
  };
  onStatusChange: (topicId: number, status: TopicStatus) => void;
  onGenerate: (type: "carousel" | "reels" | "article" | "stories" | "image", prefill: RadarPrefill) => void;
}) {
  const angle = topic.angle;
  const status = (angle?.status ?? "sugerido") as TopicStatus;
  const angleMeta = topic.emotionalAngle ? ANGLE_META[topic.emotionalAngle] : null;
  const windowMeta = topic.relevanceWindow ? WINDOW_META[topic.relevanceWindow] : null;

  const isUsed = status === "usado";
  const isDiscarded = status === "descartado";

  // Always build a prefill — use personalized angle if available, otherwise the topic itself
  const prefill: RadarPrefill = {
    topicAngleId: angle?.id || undefined,
    topic: angle?.suggestedTitle || topic.title,
    hook: angle?.suggestedHook || topic.description || "",
    hookType: topic.emotionalAngle ?? "curiosidade",
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 flex flex-col gap-3 transition-opacity",
        isDiscarded && "opacity-40"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug line-clamp-2">{topic.title}</p>
          {topic.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topic.description}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {windowMeta && (
            <Badge variant="secondary" className={cn("text-xs gap-1 font-normal", windowMeta.color)}>
              <Clock className="w-3 h-3" />
              {windowMeta.label}
            </Badge>
          )}
        </div>
      </div>

      {/* Viral score */}
      <ViralBar score={topic.viralScore} />

      {/* Angle chips */}
      <div className="flex flex-wrap gap-1.5">
        {angleMeta && (
          <span className={cn("inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium", angleMeta.color)}>
            {angleMeta.icon}
            {angleMeta.label}
          </span>
        )}
      </div>

      {/* Personalized suggestion */}
      {angle && (
        <div className="rounded-lg bg-muted/60 px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Zap className="w-3 h-3 text-amber-500" />
            Seu ângulo
          </div>
          <p className="text-sm font-medium leading-snug">{angle.suggestedTitle}</p>
          <p className="text-xs text-muted-foreground">{angle.suggestedHook}</p>
        </div>
      )}

      {/* Source link */}
      {topic.sourceUrl && (
        <a
          href={topic.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Abrir fonte original
        </a>
      )}

      {/* Generation CTAs — always visible */}
      {!isDiscarded && (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-8 px-2"
            onClick={() => onGenerate("carousel", prefill)}
            title="Gerar carrossel com este tema"
          >
            <GalleryHorizontal className="w-3.5 h-3.5 shrink-0" />
            Carrossel
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-8 px-2"
            onClick={() => onGenerate("reels", prefill)}
            title="Gerar roteiro de Reels com este tema"
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            Reels
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-8 px-2"
            onClick={() => onGenerate("article", prefill)}
            title="Gerar artigo com este tema"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            Artigo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-8 px-2"
            onClick={() => onGenerate("stories", prefill)}
            title="Gerar stories com este tema"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            Stories
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-xs h-8 px-2"
            onClick={() => onGenerate("image", prefill)}
            title="Gerar imagem estática com este tema"
          >
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            Imagem
          </Button>
        </div>
      )}

      {/* Status actions */}
      {!isDiscarded && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isUsed ? "default" : "ghost"}
            className={cn("flex-1 gap-1.5 text-xs h-8", isUsed && "bg-emerald-600 hover:bg-emerald-700 text-white")}
            onClick={() => onStatusChange(topic.id, isUsed ? "sugerido" : "usado")}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isUsed ? "Usado" : "Marcar como usado"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onStatusChange(topic.id, "descartado")}
            title="Descartar"
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      )}
      {isDiscarded && (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs h-7 text-muted-foreground"
          onClick={() => onStatusChange(topic.id, "sugerido")}
        >
          Restaurar
        </Button>
      )}
    </div>
  );
}

type FilterType = "todos" | "sugerido" | "usado" | "descartado";

export default function Radar() {
  const { isPaid } = usePlan();
  const [filter, setFilter] = useState<FilterType>("todos");
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();

  function handleGenerate(type: "carousel" | "reels" | "article" | "stories" | "image", prefill: RadarPrefill) {
    sessionStorage.setItem(RADAR_PREFILL_KEY, JSON.stringify(prefill));
    const paths = {
      carousel: "/dashboard/carousel",
      reels: "/dashboard/reels",
      article: "/dashboard/articles",
      stories: "/dashboard/stories",
      image: "/dashboard/images",
    };
    navigate(paths[type]);
  }

  const { data: topics = [], isLoading, refetch } = trpc.radar.getTopics.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateStatus = trpc.radar.updateStatus.useMutation({
    onSuccess: () => void refetch(),
    onError: () => toast.error("Erro ao atualizar status."),
  });

  const adminRefresh = trpc.radar.adminRefresh.useMutation({
    onSuccess: (data) => {
      void refetch();
      toast.success(
        data.inserted > 0
          ? `${data.inserted} temas gerados com sucesso!`
          : "Pipeline executado — nenhum tema novo gerado."
      );
    },
    onError: (err) => toast.error(`Erro ao gerar temas: ${err.message}`),
  });

  const searchTopics = trpc.radar.searchTopics.useMutation({
    onSuccess: (data, variables) => {
      void refetch();
      if (data.inserted > 0) {
        toast.success(`${data.inserted} temas sobre "${variables.query}" encontrados!`);
      } else {
        toast.info(`Nenhum tema encontrado para "${variables.query}".`);
      }
    },
    onError: (err) => toast.error(`Erro ao buscar temas: ${err.message}`),
  });

  function handleStatusChange(topicId: number, status: TopicStatus) {
    updateStatus.mutate({ trendingTopicId: topicId, status });
  }

  const query = search.trim().toLowerCase();
  const searchScoped = query
    ? topics.filter((t) =>
        t.title.toLowerCase().includes(query) ||
        (t.description?.toLowerCase().includes(query) ?? false) ||
        (t.angle?.suggestedTitle?.toLowerCase().includes(query) ?? false)
      )
    : topics;

  // Nothing matched locally — search (or generate) topics for this term on demand.
  const searchedQueriesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isPaid || isLoading) return;
    if (!query || query.length < 2) return;
    if (searchScoped.length > 0) return;
    if (searchedQueriesRef.current.has(query)) return;

    const timer = setTimeout(() => {
      searchedQueriesRef.current.add(query);
      searchTopics.mutate({ query: search.trim() });
    }, 700);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchScoped.length, isPaid, isLoading]);

  const filtered = filter === "todos"
    ? searchScoped
    : searchScoped.filter((t) => (t.angle?.status ?? "sugerido") === filter);

  const counts = {
    todos: searchScoped.length,
    sugerido: searchScoped.filter((t) => (t.angle?.status ?? "sugerido") === "sugerido").length,
    usado: searchScoped.filter((t) => t.angle?.status === "usado").length,
    descartado: searchScoped.filter((t) => t.angle?.status === "descartado").length,
  };

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: "todos", label: `Todos (${counts.todos})` },
    { key: "sugerido", label: `Sugeridos (${counts.sugerido})` },
    { key: "usado", label: `Usados (${counts.usado})` },
    { key: "descartado", label: `Descartados (${counts.descartado})` },
  ];

  return (
    <AppLayout activeModule="radar">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              Radar de Temas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Temas em alta coletados automaticamente, com ângulos personalizados para o seu nicho.
              Atualizado às 08:00 e 14:00.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              Atualizar
            </Button>
            {isPaid && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-amber-600 border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
                onClick={() => adminRefresh.mutate()}
                disabled={adminRefresh.isPending}
              >
                <Flame className={cn("w-4 h-4", adminRefresh.isPending && "animate-pulse")} />
                {adminRefresh.isPending ? "Gerando…" : "Atualizar temas"}
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div>
          <div className="relative max-w-sm">
            {searchTopics.isPending ? (
              <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            )}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar temas..."
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {searchTopics.isPending && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Buscando temas sobre "{search.trim()}"...
            </p>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                filter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Topic grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 animate-pulse space-y-3 h-52">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-5/6" />
                <div className="h-1.5 bg-muted rounded-full w-full mt-2" />
                <div className="h-16 bg-muted/60 rounded-lg mt-2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <TrendingUp className="w-12 h-12 text-muted-foreground/30" />
            <div>
              <p className="font-semibold text-muted-foreground">Nenhum tema encontrado</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {query
                  ? searchTopics.isPending
                    ? `Buscando temas sobre "${search.trim()}"...`
                    : isPaid
                      ? `Nenhum tema encontrado para "${search.trim()}", mesmo buscando novos.`
                      : `Nenhum tema local corresponde a "${search.trim()}". Assine um plano pago para buscar temas novos sob demanda.`
                  : topics.length === 0
                    ? "Os temas em alta serão coletados às 08:00 e 14:00. Volte mais tarde ou peça ao admin para forçar o pipeline."
                    : "Não há temas com este filtro. Tente mudar o filtro acima."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={{
                  id: topic.id,
                  title: topic.title,
                  description: topic.description,
                  sourceUrl: topic.sourceUrl,
                  viralScore: topic.viralScore,
                  emotionalAngle: topic.emotionalAngle,
                  relevanceWindow: topic.relevanceWindow,
                  angle: topic.angle
                    ? {
                        id: topic.angle.id,
                        status: topic.angle.status,
                        suggestedTitle: topic.angle.suggestedTitle,
                        suggestedHook: topic.angle.suggestedHook,
                      }
                    : null,
                }}
                onStatusChange={handleStatusChange}
                onGenerate={handleGenerate}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
