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
  Layers,
  Shuffle,
  BarChart2,
  Clock,
  Users,
  Tag,
  Megaphone,
  Sparkles,
  Hash,
  Image,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ArtCopy = {
  title: string;
  subtitle: string;
  body: string;
  cta: string;
  secondary: string;
  badge: string | null;
};

type StorySlide = {
  slide: number;
  visual: string;
  text: string;
  cta: string;
};

type ReelScene = {
  narration: string;
  visual: string;
  overlay: string;
};

type Reel = {
  musicSuggestion: string;
  hook: ReelScene;
  scene1: ReelScene;
  scene2: ReelScene;
  scene3: ReelScene;
  closing: ReelScene;
  cta: ReelScene;
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
  const [genImageUrl, setGenImageUrl] = useState<Record<string, string>>({});
  const [genImagePending, setGenImagePending] = useState<Record<string, boolean>>({});

  const generateImageMut = trpc.images.generate.useMutation({
    onSuccess: (data, variables) => {
      const key = (variables as { _key?: string })._key ?? "main";
      setGenImageUrl((prev) => ({ ...prev, [key]: (data as unknown as { imageUrl?: string; displayUrl?: string }).displayUrl ?? (data as unknown as { imageUrl?: string }).imageUrl ?? "" }));
      setGenImagePending((prev) => ({ ...prev, [key]: false }));
      toast.success("Imagem gerada!");
    },
    onError: (e) => {
      toast.error("Erro ao gerar imagem: " + e.message);
      setGenImagePending({});
    },
  });

  function generateImage(key: string, prompt: string, style: "commercial" | "social_post" = "commercial") {
    setGenImagePending((prev) => ({ ...prev, [key]: true }));
    generateImageMut.mutate({ prompt, style, _key: key } as Parameters<typeof generateImageMut.mutate>[0]);
  }

  const reelScenes = [
    { key: "hook" as const,    label: "Gancho",       timing: "0–3s",   accent: "red" },
    { key: "scene1" as const,  label: "Cena 1",       timing: "3–10s",  accent: "blue" },
    { key: "scene2" as const,  label: "Cena 2",       timing: "10–18s", accent: "violet" },
    { key: "scene3" as const,  label: "Cena 3",       timing: "18–24s", accent: "amber" },
    { key: "closing" as const, label: "Encerramento", timing: "24–27s", accent: "emerald" },
    { key: "cta" as const,     label: "CTA Final",    timing: "27–30s", accent: "pink" },
  ];

  const accentCls: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    red:     { bg: "bg-red-500/5",     border: "border-red-500/20",     text: "text-red-400",     badge: "bg-red-500/15" },
    blue:    { bg: "bg-blue-500/5",    border: "border-blue-500/20",    text: "text-blue-400",    badge: "bg-blue-500/15" },
    violet:  { bg: "bg-violet-500/5",  border: "border-violet-500/20",  text: "text-violet-400",  badge: "bg-violet-500/15" },
    amber:   { bg: "bg-amber-500/5",   border: "border-amber-500/20",   text: "text-amber-400",   badge: "bg-amber-500/15" },
    emerald: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", badge: "bg-emerald-500/15" },
    pink:    { bg: "bg-pink-500/5",    border: "border-pink-500/20",    text: "text-pink-400",    badge: "bg-pink-500/15" },
  };

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
            { value: "image",     label: "Imagem",       icon: Image },
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
          <p className="text-xs text-muted-foreground">Textos completos para uso nas peças gráficas.</p>
          {/* Título + Subtítulo + CTA */}
          {([
            { key: "title",    label: "Título",           color: "from-violet-500/10 to-purple-500/10 border-violet-500/30", size: "text-xl font-bold" },
            { key: "subtitle", label: "Subtítulo",        color: "from-blue-500/10 to-cyan-500/10 border-blue-500/30",       size: "text-base font-semibold" },
            { key: "cta",      label: "Chamada para Ação",color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/30", size: "text-base font-bold" },
            { key: "secondary",label: "Texto de Suporte", color: "from-orange-500/10 to-amber-500/10 border-orange-500/30",  size: "text-sm" },
          ] as const).map(({ key, label, color, size }) => {
            const value = result.artCopy[key];
            if (!value) return null;
            return (
              <div key={key} className={cn("rounded-xl border bg-gradient-to-br p-4", color)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
                    <p className={cn("leading-snug text-foreground", size)}>{value}</p>
                  </div>
                  <CopyButton text={value} className="shrink-0" />
                </div>
              </div>
            );
          })}
          {/* Corpo persuasivo */}
          {result.artCopy.body && (
            <div className="rounded-xl border border-slate-500/20 bg-gradient-to-br from-slate-500/5 to-gray-500/5 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Copy de Corpo — texto persuasivo completo</p>
                <CopyButton text={result.artCopy.body} className="shrink-0" />
              </div>
              <p className="text-sm leading-relaxed text-foreground">{result.artCopy.body}</p>
            </div>
          )}
          {result.artCopy.badge && (
            <div className="rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-rose-500/10 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Selo Promocional</p>
                  <Badge className="text-sm px-3 py-1.5 bg-pink-500/20 text-pink-300 border-pink-500/40 border">
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
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Roteiro completo para filmar o Reel — narração exata + direção visual.</p>
            {result.reel.musicSuggestion && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5">
                <span className="text-base">🎵</span>
                <span className="font-medium">{result.reel.musicSuggestion}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {reelScenes.map(({ key, label, timing, accent }) => {
              const scene: ReelScene | undefined = result.reel[key] as ReelScene | undefined;
              if (!scene) return null;
              const cls = accentCls[accent];
              const fullScript = `${label} (${timing})\n🎙 ${scene.narration}\n📸 ${scene.visual}\n📝 ${scene.overlay}`;
              return (
                <div key={key} className={cn("rounded-xl border p-4 space-y-3", cls.bg, cls.border)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-md", cls.badge, cls.text)}>{label}</span>
                      <span className="text-[10px] text-muted-foreground">{timing}</span>
                    </div>
                    <CopyButton text={fullScript} />
                  </div>
                  {/* Narration */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">🎙 Narração — o que dizer</p>
                    <p className="text-sm font-medium text-foreground leading-relaxed bg-background/60 rounded-lg px-3 py-2 border border-border/30">"{scene.narration}"</p>
                  </div>
                  {/* Visual direction */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">📸 Direção visual — o que filmar</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{scene.visual}</p>
                  </div>
                  {/* Overlay */}
                  {scene.overlay && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">📝 Texto na tela</p>
                      <p className={cn("text-xs font-bold inline-block px-2 py-0.5 rounded", cls.badge, cls.text)}>{scene.overlay}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Full script copy */}
          <SectionCard>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Roteiro completo (copiar tudo)</p>
              <CopyButton text={
                reelScenes.map(({ key, label, timing }) => {
                  const s = result.reel[key] as ReelScene | undefined;
                  if (!s) return "";
                  return `${label} (${timing})\n🎙 ${s.narration}\n📸 ${s.visual}${s.overlay ? `\n📝 ${s.overlay}` : ""}`;
                }).filter(Boolean).join("\n\n")
              } />
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Imagem ────────────────────────────────────────────────── */}
        <TabsContent value="image" className="mt-0 space-y-4">
          <p className="text-xs text-muted-foreground">Gere a imagem da campanha diretamente com IA usando o prompt criativo.</p>
          <SectionCard>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5" />Prompt para imagem principal
              </p>
              <CopyButton text={result.artPrompt} />
            </div>
            <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{result.artPrompt}</p>
          </SectionCard>
          {genImageUrl["main"] ? (
            <div className="space-y-3">
              <img src={genImageUrl["main"]} alt="Imagem da campanha" className="w-full rounded-2xl border border-border shadow-lg" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { const a = document.createElement("a"); a.href = genImageUrl["main"]; a.download = "campanha.png"; a.click(); }}>
                  <Image className="h-3.5 w-3.5 mr-1.5" />Baixar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setGenImageUrl((p) => ({ ...p, main: "" }))}>
                  Regenerar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 hover:from-orange-600 hover:to-red-600"
              onClick={() => generateImage("main", result.artPrompt, "commercial")}
              disabled={genImagePending["main"]}
            >
              {genImagePending["main"] ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando imagem...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Gerar Imagem da Campanha</>
              )}
            </Button>
          )}
        </TabsContent>

        {/* ── Stories ───────────────────────────────────────────────── */}
        <TabsContent value="stories" className="mt-0 space-y-4">
          <p className="text-xs text-muted-foreground">Gere as imagens de cada Story com IA — cada slide tem um prompt visual específico.</p>
          <div className="space-y-5">
            {(result.stories ?? []).map((story) => {
              const storyKey = `story_${story.slide}`;
              return (
                <div key={story.slide} className="rounded-xl border border-border/60 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{story.slide}</div>
                    <p className="text-sm font-semibold text-foreground">Story {story.slide}</p>
                    {story.cta && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        <Megaphone className="h-2.5 w-2.5 mr-1" />{story.cta}
                      </Badge>
                    )}
                  </div>
                  {/* Overlay text */}
                  {story.text && (
                    <div className="bg-muted/30 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Texto de overlay</p>
                      <p className="text-sm font-bold text-foreground">{story.text}</p>
                    </div>
                  )}
                  {/* Generated image or generate button */}
                  {genImageUrl[storyKey] ? (
                    <div className="space-y-2">
                      <img src={genImageUrl[storyKey]} alt={`Story ${story.slide}`} className="w-full aspect-[9/16] max-h-80 object-cover rounded-xl border border-border" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => { const a = document.createElement("a"); a.href = genImageUrl[storyKey]; a.download = `story-${story.slide}.png`; a.click(); }}>
                          Baixar Story {story.slide}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setGenImageUrl((p) => { const n = { ...p }; delete n[storyKey]; return n; })}>
                          Regenerar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prompt visual</p>
                      <p className="text-xs text-muted-foreground font-mono bg-muted/30 rounded-lg p-2.5 leading-relaxed">{story.visual}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => generateImage(storyKey, story.visual, "social_post")}
                        disabled={genImagePending[storyKey]}
                      >
                        {genImagePending[storyKey] ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Gerando...</>
                        ) : (
                          <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Gerar Story {story.slide}</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
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
                placeholder="Ex: Campanha de fim de ano para instalação de energia solar residencial com condições especiais de financiamento"
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
                placeholder="Ex: Canal Solar Energia"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="text-sm border-border/60"
                maxLength={200}
              />
            </div>

            <div>
              <FieldLabel>Público-alvo / segmento (opcional)</FieldLabel>
              <Input
                placeholder="Ex: Proprietários de imóveis residenciais, classe A/B, 30-55 anos"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="text-sm border-border/60"
                maxLength={200}
              />
            </div>

            <div>
              <FieldLabel>Objetivo da campanha (opcional)</FieldLabel>
              <Input
                placeholder="Ex: Aumentar orçamentos de instalação solar em 20%"
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
                placeholder="Ex: 05/05 a 12/05/2026"
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
