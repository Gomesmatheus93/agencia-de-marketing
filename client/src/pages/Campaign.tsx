import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Target,
  Wand2,
  Loader2,
  Copy,
  Check,
  Lightbulb,
  FileText,
  MessageSquare,
  Film,
  LayoutGrid,
  Layers,
  Shuffle,
  BarChart2,
  Clock,
  Users,
  Tag,
  Megaphone,
  ChevronRight,
  Sparkles,
  Hash,
  Image,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ArtCopy = {
  title: string;
  subtitle: string;
  cta: string;
  secondary: string;
  badge: string | null;
};

type StorySlide = {
  slide: number;
  text: string;
  cta: string;
};

type Reel = {
  hook: string;
  scene1: string;
  scene2: string;
  scene3: string;
  closing: string;
  cta: string;
};

type CarouselSlide = {
  slide: number;
  title: string;
  body: string;
};

type Variation = {
  concept: string;
  headline: string;
  caption: string;
};

type Recommendations = {
  bestTime: string;
  audience: string;
  adObjective: string;
  campaignType: string;
  segmentation: string;
  keywords: string[];
};

type CampaignResult = {
  creativeConcept: string;
  artPrompt: string;
  artCopy: ArtCopy;
  caption: string;
  stories: StorySlide[];
  reel: Reel;
  carousel: CarouselSlide[];
  variations: {
    emotional: Variation;
    sales: Variation;
  };
  recommendations: Recommendations;
};

type HistoryEntry = {
  subject: string;
  result: CampaignResult;
  generatedAt: Date;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-1.5 py-0.5 hover:bg-accent",
        className
      )}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-background/60 p-4 space-y-3", className)}>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1">{children}</label>;
}

// ─── Result Tabs ─────────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: CampaignResult }) {
  const reelScenes = [
    { key: "hook",    label: "Gancho (0–3s)",       color: "bg-red-500/10 border-red-500/30 text-red-400" },
    { key: "scene1",  label: "Cena 1 (3–10s)",      color: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
    { key: "scene2",  label: "Cena 2 (10–18s)",     color: "bg-violet-500/10 border-violet-500/30 text-violet-400" },
    { key: "scene3",  label: "Cena 3 (18–24s)",     color: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
    { key: "closing", label: "Encerramento (24–27s)", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
    { key: "cta",     label: "CTA Final (27–30s)",  color: "bg-pink-500/10 border-pink-500/30 text-pink-400" },
  ] as const;

  return (
    <Tabs defaultValue="concept" className="flex flex-col h-full">
      {/* Scrollable tab list */}
      <div className="border-b border-border/40 px-6 pt-5 pb-0 shrink-0">
        <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0 justify-start w-full">
          {[
            { value: "concept",   label: "Conceito",     icon: Lightbulb },
            { value: "copy",      label: "Copy",         icon: FileText },
            { value: "caption",   label: "Legenda",      icon: MessageSquare },
            { value: "reel",      label: "Reel",         icon: Film },
            { value: "carousel",  label: "Carrossel",    icon: LayoutGrid },
            { value: "stories",   label: "Stories",      icon: Layers },
            { value: "variations",label: "Variações",    icon: Shuffle },
            { value: "recs",      label: "Recomendações",icon: BarChart2 },
          ].map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-xs h-8 px-3 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5 border border-transparent data-[state=active]:border-primary/20"
            >
              <Icon className="h-3 w-3" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* ── Conceito Criativo ─────────────────────────────────────── */}
        <TabsContent value="concept" className="mt-0 space-y-4">
          <SectionCard className="border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-400 mb-1.5 uppercase tracking-wide">Conceito Criativo</p>
                <p className="text-sm leading-relaxed text-foreground">{result.creativeConcept}</p>
              </div>
              <CopyButton text={result.creativeConcept} />
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Image className="h-3.5 w-3.5" />
                Prompt para Gerador de Imagem
              </div>
              <CopyButton text={result.artPrompt} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-mono bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
              {result.artPrompt}
            </p>
          </SectionCard>
        </TabsContent>

        {/* ── Copy para Arte ────────────────────────────────────────── */}
        <TabsContent value="copy" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Textos prontos para uso nas peças gráficas.</p>
          {[
            { key: "title",    label: "Título",           color: "from-violet-500/10 to-purple-500/10 border-violet-500/30" },
            { key: "subtitle", label: "Subtítulo",        color: "from-blue-500/10 to-cyan-500/10 border-blue-500/30" },
            { key: "cta",      label: "Chamada para Ação",color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/30" },
            { key: "secondary",label: "Texto Secundário", color: "from-orange-500/10 to-amber-500/10 border-orange-500/30" },
          ].map(({ key, label, color }) => {
            const value = result.artCopy[key as keyof ArtCopy];
            if (!value) return null;
            return (
              <div key={key} className={cn("rounded-xl border bg-gradient-to-br p-4", color)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
                    <p className="text-base font-semibold leading-snug text-foreground">{value}</p>
                  </div>
                  <CopyButton text={value as string} className="shrink-0" />
                </div>
              </div>
            );
          })}
          {result.artCopy.badge && (
            <div className="rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-rose-500/10 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Selo Promocional</p>
                  <Badge className="text-sm px-3 py-1 bg-pink-500/20 text-pink-300 border-pink-500/40 border">
                    {result.artCopy.badge}
                  </Badge>
                </div>
                <CopyButton text={result.artCopy.badge} className="shrink-0" />
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Caption ───────────────────────────────────────────────── */}
        <TabsContent value="caption" className="mt-0">
          <SectionCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-3.5 w-3.5" />
                Legenda / Caption Completa
              </div>
              <CopyButton text={result.caption} />
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{result.caption}</p>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Reel ──────────────────────────────────────────────────── */}
        <TabsContent value="reel" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Roteiro completo para Reels de 30 segundos.</p>
          <div className="space-y-2">
            {reelScenes.map(({ key, label, color }) => (
              <div key={key} className={cn("rounded-xl border p-4", color.split(" ").slice(0, 2).join(" "), "border", color.split(" ")[2])}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      <p className={cn("text-[10px] font-bold uppercase tracking-widest", color.split(" ")[3])}>{label}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{result.reel[key]}</p>
                  </div>
                  <CopyButton text={result.reel[key]} className="shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Carrossel ─────────────────────────────────────────────── */}
        <TabsContent value="carousel" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Slides prontos para montar o carrossel.</p>
          <div className="grid gap-3">
            {(result.carousel ?? []).map((slide) => (
              <SectionCard key={slide.slide}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {slide.slide}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1">{slide.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{slide.body}</p>
                  </div>
                  <CopyButton text={`${slide.title}\n${slide.body}`} className="shrink-0" />
                </div>
              </SectionCard>
            ))}
          </div>
        </TabsContent>

        {/* ── Stories ───────────────────────────────────────────────── */}
        <TabsContent value="stories" className="mt-0 space-y-3">
          <p className="text-xs text-muted-foreground">Sequência de Stories para engajar a audiência.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(result.stories ?? []).map((story) => (
              <div
                key={story.slide}
                className="rounded-xl border border-border/60 bg-gradient-to-b from-background/80 to-muted/20 p-4 flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2">
                  <CopyButton text={`${story.text}\n${story.cta}`} />
                </div>
                <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {story.slide}
                </div>
                <p className="text-sm leading-relaxed text-foreground flex-1">{story.text}</p>
                {story.cta && (
                  <div className="pt-2 border-t border-border/40">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Megaphone className="h-2.5 w-2.5" />
                      {story.cta}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Variações ─────────────────────────────────────────────── */}
        <TabsContent value="variations" className="mt-0 space-y-4">
          <p className="text-xs text-muted-foreground">Duas abordagens diferentes para testar com seu público.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Emocional */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-rose-400" />
                </div>
                <p className="text-sm font-semibold text-rose-400">Variação Emocional</p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Conceito</p>
                  <p className="text-xs text-foreground">{result.variations.emotional.concept}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Headline</p>
                  <p className="text-sm font-semibold text-foreground">{result.variations.emotional.headline}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Legenda</p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{result.variations.emotional.caption}</p>
                </div>
                <CopyButton text={`${result.variations.emotional.headline}\n\n${result.variations.emotional.caption}`} />
              </div>
            </div>

            {/* Vendas */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Tag className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-emerald-400">Variação de Vendas</p>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Conceito</p>
                  <p className="text-xs text-foreground">{result.variations.sales.concept}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Headline</p>
                  <p className="text-sm font-semibold text-foreground">{result.variations.sales.headline}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Legenda</p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{result.variations.sales.caption}</p>
                </div>
                <CopyButton text={`${result.variations.sales.headline}\n\n${result.variations.sales.caption}`} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Recomendações ─────────────────────────────────────────── */}
        <TabsContent value="recs" className="mt-0 space-y-4">
          <p className="text-xs text-muted-foreground">Sugestões estratégicas para maximizar o desempenho da campanha.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: Clock,      label: "Melhor Horário",        value: result.recommendations.bestTime,      color: "text-blue-400" },
              { icon: Users,      label: "Público Ideal",         value: result.recommendations.audience,      color: "text-violet-400" },
              { icon: Target,     label: "Objetivo do Anúncio",   value: result.recommendations.adObjective,   color: "text-emerald-400" },
              { icon: Megaphone,  label: "Tipo de Campanha",      value: result.recommendations.campaignType,  color: "text-orange-400" },
              { icon: BarChart2,  label: "Segmentação Sugerida",  value: result.recommendations.segmentation,  color: "text-pink-400" },
            ].map(({ icon: Icon, label, value, color }) => (
              <SectionCard key={label}>
                <div className="flex items-start gap-2.5">
                  <div className={cn("mt-0.5 shrink-0", color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                    <p className="text-sm text-foreground leading-snug">{value}</p>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>

          {/* Keywords */}
          {result.recommendations.keywords?.length > 0 && (
            <SectionCard>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                <Hash className="h-3.5 w-3.5" />
                Palavras-chave / Hashtags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.recommendations.keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => navigator.clipboard.writeText(`#${kw}`)}>
                    #{kw}
                  </Badge>
                ))}
              </div>
            </SectionCard>
          )}
        </TabsContent>

      </div>
    </Tabs>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-10 gap-5">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center shadow-lg">
        <Target className="h-9 w-9 text-orange-400" />
      </div>
      <div className="max-w-xs space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Nenhuma campanha gerada</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Preencha o formulário ao lado com o tema e os detalhes da campanha para gerar todo o material criativo com IA.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-left max-w-xs w-full">
        {[
          "Conceito criativo",
          "Copy para artes",
          "Legenda otimizada",
          "Roteiro de Reel",
          "Slides do carrossel",
          "Recomendações estratégicas",
        ].map((item) => (
          <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3 w-3 text-orange-400 shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SOCIAL_NETWORKS = [
  { value: "Instagram",  label: "Instagram" },
  { value: "LinkedIn",   label: "LinkedIn" },
  { value: "YouTube",    label: "YouTube" },
  { value: "WhatsApp",   label: "WhatsApp" },
  { value: "Todos",      label: "Todas as redes" },
];

export default function Campaign() {
  // Form state
  const [subject,       setSubject]       = useState("");
  const [client,        setClient]        = useState("");
  const [segment,       setSegment]       = useState("");
  const [objective,     setObjective]     = useState("");
  const [socialNetwork, setSocialNetwork] = useState("");
  const [date,          setDate]          = useState("");
  const [extraInfo,     setExtraInfo]     = useState("");

  // Result state (in-memory history — last generated only)
  const [result,   setResult]   = useState<CampaignResult | null>(null);
  const [history,  setHistory]  = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  const generateMut = trpc.campaign.generate.useMutation({
    onSuccess: (data) => {
      const campaign = data as unknown as CampaignResult;
      const entry: HistoryEntry = {
        subject: subject.trim(),
        result: campaign,
        generatedAt: new Date(),
      };
      setResult(campaign);
      setHistory((prev) => [entry, ...prev].slice(0, 10));
      setSelected(entry);
      toast.success("Campanha gerada com sucesso!");
    },
    onError: (e) => {
      toast.error("Erro ao gerar campanha: " + e.message);
    },
  });

  function handleGenerate() {
    const s = subject.trim();
    if (s.length < 3) {
      toast.error("O assunto deve ter pelo menos 3 caracteres.");
      return;
    }
    generateMut.mutate({
      subject: s,
      client:        client.trim()        || undefined,
      segment:       segment.trim()       || undefined,
      objective:     objective.trim()     || undefined,
      socialNetwork: socialNetwork        || undefined,
      date:          date.trim()          || undefined,
      extraInfo:     extraInfo.trim()     || undefined,
    });
  }

  const displayed = selected?.result ?? result;

  return (
    <AppLayout activeModule="campaign">
      <div className="flex h-full min-h-screen bg-background">

        {/* ── Left sidebar: form ──────────────────────────────────── */}
        <div className="w-[380px] min-w-[320px] max-w-[420px] border-r border-border/40 flex flex-col h-screen sticky top-0 overflow-hidden">

          {/* Header */}
          <div className="p-5 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
                <Target className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base text-foreground leading-tight">Gerador de Campanhas IA</h1>
                <p className="text-[11px] text-muted-foreground">Material criativo completo em segundos</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            <div>
              <FieldLabel>Assunto da campanha *</FieldLabel>
              <Textarea
                placeholder="Ex: Promoção de Dia das Mães com 30% de desconto em todos os produtos"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                rows={3}
                className="resize-none text-sm border-border/60 focus:border-orange-500/50"
                maxLength={500}
              />
              <p className="text-right text-[10px] text-muted-foreground mt-0.5">{subject.length}/500</p>
            </div>

            <div>
              <FieldLabel>Nome do cliente (opcional)</FieldLabel>
              <Input
                placeholder="Ex: Boutique Elegance"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="text-sm border-border/60"
                maxLength={200}
              />
            </div>

            <div>
              <FieldLabel>Público-alvo / segmento (opcional)</FieldLabel>
              <Input
                placeholder="Ex: Mulheres 25–45 anos, classe B/C"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="text-sm border-border/60"
                maxLength={200}
              />
            </div>

            <div>
              <FieldLabel>Objetivo da campanha (opcional)</FieldLabel>
              <Input
                placeholder="Ex: Aumentar vendas online em 20%"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="text-sm border-border/60"
                maxLength={300}
              />
            </div>

            <div>
              <FieldLabel>Plataforma principal (opcional)</FieldLabel>
              <select
                className="w-full text-sm border border-border/60 rounded-md px-3 py-2 bg-background focus:border-orange-500/50 focus:outline-none transition-colors"
                value={socialNetwork}
                onChange={(e) => setSocialNetwork(e.target.value)}
              >
                <option value="">Selecionar rede social...</option>
                {SOCIAL_NETWORKS.map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Data / período da campanha (opcional)</FieldLabel>
              <Input
                placeholder="Ex: 05/05 a 12/05/2025"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm border-border/60"
              />
            </div>

            <div>
              <FieldLabel>Informações extras (opcional)</FieldLabel>
              <Textarea
                placeholder="Identidade visual, cores, tom de voz, referencias, ofertas específicas..."
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                rows={3}
                className="resize-none text-sm border-border/60 focus:border-orange-500/50"
                maxLength={1000}
              />
              <p className="text-right text-[10px] text-muted-foreground mt-0.5">{extraInfo.length}/1000</p>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 hover:from-orange-600 hover:to-red-600 shadow-md font-semibold"
              onClick={handleGenerate}
              disabled={generateMut.isPending || subject.trim().length < 3}
            >
              {generateMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando campanha...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Gerar Campanha Completa
                </>
              )}
            </Button>
          </div>

          {/* In-memory history */}
          {history.length > 0 && (
            <div className="border-t border-border/40 shrink-0">
              <div className="px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Geradas nesta sessão
                </p>
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {history.map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => setSelected(entry)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-xs transition-all",
                        selected === entry
                          ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
                          : "hover:bg-accent border border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <p className="font-medium truncate">{entry.subject}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">
                        {entry.generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel: results ─────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">

          {/* Generating overlay */}
          {generateMut.isPending ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center shadow-lg animate-pulse">
                <Wand2 className="h-7 w-7 text-orange-400" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-semibold text-foreground">Criando sua campanha...</p>
                <p className="text-sm text-muted-foreground">O agente criativo está trabalhando. Isso pode levar alguns segundos.</p>
              </div>
              <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
            </div>
          ) : displayed ? (
            <ResultPanel result={displayed} />
          ) : (
            <EmptyState />
          )}
        </div>

      </div>
    </AppLayout>
  );
}
