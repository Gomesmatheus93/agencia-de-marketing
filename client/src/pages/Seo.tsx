import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  HelpCircle,
  Sparkles,
  GalleryHorizontal,
  Film,
  FileText,
  Layers,
  Mail,
  Copy,
  Check,
  Globe,
  BrainCircuit,
  BarChart3,
  Link2,
  Unlink,
  MousePointerClick,
  Eye,
  Lock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppLayout from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { usePlan } from "@/_core/hooks/usePlan";
import type { RadarPrefill } from "./Radar";

const RADAR_PREFILL_KEY = "radar_prefill";

const INTENT_META: Record<string, { label: string; color: string }> = {
  informational: { label: "Informacional", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  commercial: { label: "Comercial", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  transactional: { label: "Transacional", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  navigational: { label: "Navegacional", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

const CONTENT_TYPE_META: Record<string, { label: string; icon: React.ReactNode; path?: string }> = {
  artigo: { label: "Artigo", icon: <FileText className="w-3.5 h-3.5" />, path: "/dashboard/articles" },
  carrossel: { label: "Carrossel", icon: <GalleryHorizontal className="w-3.5 h-3.5" />, path: "/dashboard/carousel" },
  reels: { label: "Reels", icon: <Film className="w-3.5 h-3.5" />, path: "/dashboard/reels" },
  stories: { label: "Stories", icon: <Layers className="w-3.5 h-3.5" />, path: "/dashboard/stories" },
  newsletter: { label: "Newsletter", icon: <Mail className="w-3.5 h-3.5" /> },
};

const FUNNEL_META: Record<string, { label: string; color: string }> = {
  topo: { label: "Topo de funil", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  meio: { label: "Meio de funil", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  fundo: { label: "Fundo de funil", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

function PriorityBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-7 text-right">{pct}</span>
    </div>
  );
}

function GscPerformanceCard() {
  const status = trpc.searchConsole.getStatus.useQuery();
  const utils = trpc.useUtils();

  const selectSite = trpc.searchConsole.selectSite.useMutation({
    onSuccess: () => {
      toast.success("Propriedade selecionada.");
      void utils.searchConsole.getStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnect = trpc.searchConsole.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Search Console desconectado.");
      void utils.searchConsole.getStatus.invalidate();
    },
  });

  const connected = status.data?.connected === true;
  const selectedSiteUrl = status.data?.connected ? status.data.selectedSiteUrl : undefined;
  const availableSites = status.data?.connected ? status.data.availableSites : [];

  const topQueries = trpc.searchConsole.getTopQueries.useQuery(undefined, {
    enabled: connected && Boolean(selectedSiteUrl),
  });

  const gscParam = new URLSearchParams(window.location.search).get("gsc_connect");
  useEffect(() => {
    if (gscParam === "success") {
      toast.success("Google Search Console conectado com sucesso!");
      void utils.searchConsole.getStatus.invalidate();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gscParam === "denied") {
      toast.error("Autorização negada pelo Google.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gscParam === "requires_login") {
      toast.error("Faça login antes de conectar o Search Console.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gscParam === "error") {
      const detail = new URLSearchParams(window.location.search).get("detail") ?? "";
      toast.error(`Erro ao conectar Search Console: ${detail}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gscParam]);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Desempenho real no Google (Search Console)</h2>
        </div>
        {connected && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            <Unlink className="w-3.5 h-3.5" />
            Desconectar
          </Button>
        )}
      </div>

      {!connected && !status.isLoading && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground max-w-md">
            Conecte a propriedade do Google Search Console do seu site para ver cliques, impressões e posição média reais — dados que complementam a pesquisa de palavras-chave acima.
          </p>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { window.location.href = "/api/oauth/gsc/connect"; }}>
            <Link2 className="w-3.5 h-3.5" />
            Conectar Search Console
          </Button>
        </div>
      )}

      {connected && availableSites.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Propriedade:</span>
          <Select
            value={selectedSiteUrl ?? undefined}
            onValueChange={(value) => selectSite.mutate({ siteUrl: value })}
          >
            <SelectTrigger size="sm" className="h-8 text-xs w-full sm:w-72">
              <SelectValue placeholder="Selecione uma propriedade" />
            </SelectTrigger>
            <SelectContent>
              {availableSites.map((site) => (
                <SelectItem key={site} value={site} className="text-xs">
                  {site}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {connected && !selectedSiteUrl && availableSites.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhuma propriedade verificada foi encontrada nesta conta Google. Verifique seu site em{" "}
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            search.google.com/search-console
          </a>{" "}
          e reconecte.
        </p>
      )}

      {connected && selectedSiteUrl && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Últimos 28 dias — <span className="font-medium">{selectedSiteUrl}</span>
          </p>
          {topQueries.isLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : topQueries.data?.rows.length === 0 ? (
            <p className="text-xs text-muted-foreground/70 py-4 text-center">
              Sem dados suficientes ainda para esta propriedade nos últimos 28 dias.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="text-left font-medium py-1.5 pr-2">Busca</th>
                    <th className="text-right font-medium py-1.5 px-2">
                      <MousePointerClick className="w-3 h-3 inline" /> Cliques
                    </th>
                    <th className="text-right font-medium py-1.5 px-2">
                      <Eye className="w-3 h-3 inline" /> Impressões
                    </th>
                    <th className="text-right font-medium py-1.5 px-2">CTR</th>
                    <th className="text-right font-medium py-1.5 pl-2">Posição</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.data?.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-2 truncate max-w-[220px]" title={row.query}>{row.query}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{row.clicks}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{row.impressions}</td>
                      <td className="text-right py-1.5 px-2 tabular-nums">{(row.ctr * 100).toFixed(1)}%</td>
                      <td className="text-right py-1.5 pl-2 tabular-nums">{row.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Seo() {
  const { isLocked } = usePlan();
  const locked = isLocked("seo");
  const [, navigate] = useLocation();
  const [seedKeyword, setSeedKeyword] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const research = trpc.seo.researchKeywords.useMutation({
    onError: (err) => toast.error(err.message),
  });

  function handleSearch() {
    const trimmed = seedKeyword.trim();
    if (trimmed.length < 2) {
      toast.error("Digite uma palavra-chave com pelo menos 2 caracteres.");
      return;
    }
    research.mutate({ seedKeyword: trimmed });
  }

  function handleGenerate(contentType: string, title: string, hook: string) {
    const meta = CONTENT_TYPE_META[contentType];
    if (!meta?.path) {
      void navigator.clipboard.writeText(`${title}\n\n${hook}`);
      toast.success("Ideia copiada — cole na newsletter em Email Marketing.");
      return;
    }
    const prefill: RadarPrefill = { topic: title, hook, hookType: "curiosidade" };
    sessionStorage.setItem(RADAR_PREFILL_KEY, JSON.stringify(prefill));
    navigate(meta.path);
  }

  function handleCopyIdea(idx: number, title: string, hook: string) {
    void navigator.clipboard.writeText(`${title}\n\n${hook}`);
    setCopiedIdx(idx);
    toast.success("Ideia copiada!");
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  const result = research.data;

  if (locked) {
    return (
      <AppLayout activeModule="seo">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <div className="rounded-full bg-muted p-5">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Pesquisa de Palavras-chave (SEO)</h2>
          <p className="text-muted-foreground max-w-md">
            Disponível no plano Pro ou superior. Faça upgrade para pesquisar palavras-chave e conectar o Google Search Console.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeModule="seo">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="w-6 h-6 text-cyan-500" />
            Pesquisa de Palavras-chave (SEO)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Descubra o que seu publico busca no Google e transforme em pautas de artigo, carrossel, reels, stories e newsletter.
          </p>
        </div>

        {/* Google Search Console performance */}
        <GscPerformanceCard />

        {/* Search box */}
        <div className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Ex.: energia solar residencial, financiamento de placas solares..."
            value={seedKeyword}
            onChange={(e) => setSeedKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={research.isPending} className="gap-2 shrink-0">
            {research.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {research.isPending ? "Pesquisando..." : "Pesquisar"}
          </Button>
        </div>

        {!result && !research.isPending && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Search className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/70 max-w-md">
              Digite um tema ou palavra-chave semente relacionado ao seu nicho para receber clusters de palavras-chave
              e ideias de conteudo prontas para gerar.
            </p>
          </div>
        )}

        {research.isPending && (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 animate-pulse space-y-3 h-40">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-5/6" />
                <div className="h-1.5 bg-muted rounded-full w-full mt-2" />
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Data source indicator */}
            <div className="flex items-center gap-2 text-xs">
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1.5 font-normal",
                  result.usedRealSearchData
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                )}
              >
                {result.usedRealSearchData ? <Globe className="w-3 h-3" /> : <BrainCircuit className="w-3 h-3" />}
                {result.usedRealSearchData ? "Baseado em dados reais do Google" : "Estimativa gerada por IA (sem dados de busca configurados)"}
              </Badge>
            </div>

            {/* People Also Ask */}
            {result.peopleAlsoAsk.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  Perguntas que as pessoas fazem
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.peopleAlsoAsk.map((q, i) => (
                    <span key={i} className="text-xs rounded-full px-2.5 py-1 bg-muted text-muted-foreground">
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keyword clusters */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Clusters de palavras-chave
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {result.clusters.map((cluster, ci) => {
                  const meta = INTENT_META[cluster.intent] ?? INTENT_META.informational;
                  return (
                    <div key={ci} className="rounded-xl border bg-card p-4 space-y-3">
                      <Badge variant="secondary" className={cn("font-normal", meta.color)}>
                        {meta.label}
                      </Badge>
                      <div className="space-y-3">
                        {cluster.keywords.map((kw, ki) => (
                          <div key={ki} className="space-y-1 pb-2 border-b last:border-b-0 last:pb-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium leading-snug">{kw.term}</p>
                            </div>
                            <PriorityBar score={kw.priority} />
                            <div className="flex gap-1.5">
                              <span className="text-[11px] rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                                volume {kw.volumeHint}
                              </span>
                              <span className="text-[11px] rounded px-1.5 py-0.5 bg-muted text-muted-foreground">
                                dificuldade {kw.difficultyHint}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{kw.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content ideas */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ideias de conteudo
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {result.contentIdeas.map((idea, i) => {
                  const typeMeta = CONTENT_TYPE_META[idea.contentType];
                  const funnelMeta = FUNNEL_META[idea.funnelStage];
                  return (
                    <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug flex-1">{idea.title}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => handleCopyIdea(i, idea.title, idea.hook)}
                          title="Copiar"
                        >
                          {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{idea.hook}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[11px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                          {idea.targetKeyword}
                        </span>
                        {funnelMeta && (
                          <Badge variant="secondary" className={cn("text-[11px] font-normal", funnelMeta.color)}>
                            {funnelMeta.label}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 w-full"
                        onClick={() => handleGenerate(idea.contentType, idea.title, idea.hook)}
                      >
                        {typeMeta?.icon}
                        Gerar {typeMeta?.label ?? idea.contentType}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
