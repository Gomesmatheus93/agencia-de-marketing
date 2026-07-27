import { useState, useEffect } from "react";
import type { RadarPrefill } from "@/pages/Radar";
const RADAR_PREFILL_KEY = "radar_prefill";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlan } from "@/_core/hooks/usePlan";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Layers,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Lock,
  BarChart2,
  Target,
  Timer,
  MessageCircle,
  Clapperboard,
  Repeat2,
  BookMarked,
  Hash,
} from "lucide-react";
// Local type mirrors of StorySlide/StorySet (types only — no server-side code imported)
type StorySlide =
  | { type: "poll"; headline: string; question: string; option_a: string; option_b: string; visual_prompt: string; imageUrl?: string }
  | { type: "quiz"; headline: string; question: string; options: string[]; correct_index: number; explanation?: string; visual_prompt: string; imageUrl?: string }
  | { type: "countdown"; headline: string; body: string; target_label: string; cta: string; visual_prompt: string; imageUrl?: string }
  | { type: "question_box"; headline: string; prompt_text: string; visual_prompt: string; imageUrl?: string }
  | { type: "behind_scenes"; headline: string; caption: string; tone: "personal" | "educational" | "funny"; visual_prompt: string; imageUrl?: string }
  | { type: "post_reinforcement"; headline: string; angle: string; cta: string; visual_prompt: string; imageUrl?: string };

type StorySet = {
  setTitle: string;
  theme: string;
  caption: string;
  hashtags: string[];
  slides: StorySlide[];
};

// ─── Types ────────────────────────────────────────────────────────────────────

const STORY_TYPES = [
  "poll",
  "quiz",
  "countdown",
  "question_box",
  "behind_scenes",
  "post_reinforcement",
] as const;

type StorySlideType = (typeof STORY_TYPES)[number];

const TYPE_META: Record<StorySlideType, {
  pt: string; en: string; emoji: string;
  desc: string;
  icon: React.ReactNode;
  badge: string;
  card: string;
  iconBg: string;
}> = {
  poll: {
    pt: "Enquete", en: "Poll", emoji: "📊",
    desc: "Engaja com votação binária",
    icon: <BarChart2 className="h-4 w-4" />,
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    card: "border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20",
    iconBg: "bg-blue-500",
  },
  quiz: {
    pt: "Quiz", en: "Quiz", emoji: "🎯",
    desc: "Testa o conhecimento do seguidor",
    icon: <Target className="h-4 w-4" />,
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    card: "border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20",
    iconBg: "bg-amber-500",
  },
  countdown: {
    pt: "Contagem regressiva", en: "Countdown", emoji: "⏳",
    desc: "Cria antecipação e urgência",
    icon: <Timer className="h-4 w-4" />,
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    card: "border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20",
    iconBg: "bg-orange-500",
  },
  question_box: {
    pt: "Caixinha", en: "Q&A Box", emoji: "💬",
    desc: "Coleta perguntas e feedbacks",
    icon: <MessageCircle className="h-4 w-4" />,
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    card: "border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/20",
    iconBg: "bg-violet-500",
  },
  behind_scenes: {
    pt: "Bastidores", en: "Behind Scenes", emoji: "🎬",
    desc: "Humaniza a marca com bastidores",
    icon: <Clapperboard className="h-4 w-4" />,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    card: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20",
    iconBg: "bg-emerald-500",
  },
  post_reinforcement: {
    pt: "Reforço de post", en: "Post Boost", emoji: "🔁",
    desc: "Amplifica conteúdo já publicado",
    icon: <Repeat2 className="h-4 w-4" />,
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    card: "border-pink-200 dark:border-pink-800/50 bg-pink-50/50 dark:bg-pink-950/20",
    iconBg: "bg-pink-500",
  },
};

const TYPE_LABELS: Record<StorySlideType, { pt: string; en: string; emoji: string }> = Object.fromEntries(
  Object.entries(TYPE_META).map(([k, v]) => [k, { pt: v.pt, en: v.en, emoji: v.emoji }])
) as Record<StorySlideType, { pt: string; en: string; emoji: string }>;

const TYPE_COLORS: Record<StorySlideType, string> = Object.fromEntries(
  Object.entries(TYPE_META).map(([k, v]) => [k, v.badge])
) as Record<StorySlideType, string>;

// ─── Story slide preview (9:16 CSS, no Canvas) ───────────────────────────────

function SlidePreview({ slide, index, total }: { slide: StorySlide; index: number; total: number }) {
  const type = slide.type as StorySlideType;
  const label = TYPE_LABELS[type];
  const color = TYPE_COLORS[type];
  const [imgFailed, setImgFailed] = useState(false);

  const renderContent = () => {
    switch (slide.type) {
      case "poll":
        return (
          <div className="space-y-3 w-full">
            <p className="text-white font-semibold text-lg text-center leading-tight">{slide.question}</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-white/30 backdrop-blur rounded-full px-4 py-2 text-white text-center text-sm font-medium">
                {slide.option_a}
              </div>
              <div className="flex-1 bg-white/30 backdrop-blur rounded-full px-4 py-2 text-white text-center text-sm font-medium">
                {slide.option_b}
              </div>
            </div>
          </div>
        );
      case "quiz":
        return (
          <div className="space-y-3 w-full">
            <p className="text-white font-semibold text-lg text-center leading-tight">{slide.question}</p>
            <div className="grid grid-cols-2 gap-2">
              {slide.options.map((opt, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-3 py-2 text-sm font-medium text-center ${
                    i === slide.correct_index
                      ? "bg-green-400/80 text-white"
                      : "bg-white/25 text-white"
                  }`}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>
        );
      case "countdown":
        return (
          <div className="space-y-4 text-center w-full">
            <p className="text-white text-base leading-snug">{slide.body}</p>
            <div className="bg-white/20 backdrop-blur rounded-2xl px-6 py-3">
              <p className="text-white/70 text-xs uppercase tracking-widest">Em breve</p>
              <p className="text-white font-bold text-lg">{slide.target_label}</p>
            </div>
            <p className="text-white/90 text-sm font-medium">{slide.cta}</p>
          </div>
        );
      case "question_box":
        return (
          <div className="space-y-4 text-center w-full">
            <p className="text-white text-base leading-snug">{slide.prompt_text}</p>
            <div className="bg-white rounded-2xl px-4 py-3">
              <p className="text-gray-400 text-sm">Escreva sua pergunta...</p>
            </div>
          </div>
        );
      case "behind_scenes":
        return (
          <div className="space-y-3 w-full">
            <p className="text-white text-base leading-relaxed">{slide.caption}</p>
            <Badge variant="outline" className="border-white/40 text-white/70 text-xs">
              {slide.tone === "personal" ? "Pessoal" : slide.tone === "educational" ? "Educativo" : "Divertido"}
            </Badge>
          </div>
        );
      case "post_reinforcement":
        return (
          <div className="space-y-3 text-center w-full">
            <p className="text-white text-base leading-snug">{slide.angle}</p>
            <div className="bg-white/20 backdrop-blur rounded-full px-4 py-2 text-white text-sm font-medium">
              {slide.cta}
            </div>
          </div>
        );
    }
  };

  const hasImage = !!slide.imageUrl && !imgFailed;
  const bgStyle = hasImage
    ? {}
    : { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 9:16 aspect ratio preview */}
      <div
        className="relative w-full rounded-2xl overflow-hidden flex flex-col items-center justify-center p-5 gap-4"
        style={{ aspectRatio: "9/16", ...bgStyle }}
      >
        {/* Background image (hidden if load fails → gradient shows instead) */}
        {slide.imageUrl && (
          <img
            src={slide.imageUrl}
            alt=""
            onError={() => setImgFailed(true)}
            className={cn(
              "absolute inset-0 w-full h-full object-cover rounded-2xl",
              imgFailed ? "hidden" : "block"
            )}
          />
        )}
        {/* Dark overlay for text legibility */}
        {hasImage && (
          <div className="absolute inset-0 bg-black/45" />
        )}

        {/* Top label */}
        <div className="absolute top-3 left-0 right-0 flex justify-between items-center px-4 z-10">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${color}`}>
            {label.emoji} {label.pt}
          </span>
          <span className="text-white/70 text-xs">{index + 1}/{total}</span>
        </div>

        {/* Headline */}
        <p className="relative z-10 text-white font-bold text-2xl text-center leading-tight mt-8 drop-shadow-lg">
          {slide.headline}
        </p>

        {/* Type-specific content */}
        <div className="relative z-10 w-full">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// ─── Story set card (saved list) ─────────────────────────────────────────────

function StorySetCard({
  post,
  onDelete,
}: {
  post: { id: number; title: string | null; content: string; status: string; storyData: string | null; createdAt: string | Date };
  onDelete: (id: number) => void;
}) {
  const storySet: StorySet | null = (() => {
    try { return post.storyData ? JSON.parse(post.storyData) : null; } catch { return null; }
  })();

  const [slideIdx, setSlideIdx] = useState(0);
  const slides = storySet?.slides ?? [];

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">{post.title ?? "Sem título"}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{post.content}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant={post.status === "published" ? "default" : "secondary"} className="text-xs">
            {post.status}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(post.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {slides.length > 0 && (
        <div className="space-y-2">
          <div className="w-36 mx-auto">
            <SlidePreview slide={slides[slideIdx]} index={slideIdx} total={slides.length} />
          </div>
          {slides.length > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={slideIdx === 0} onClick={() => setSlideIdx((i) => i - 1)}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground self-center">{slideIdx + 1} / {slides.length}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={slideIdx === slides.length - 1} onClick={() => setSlideIdx((i) => i + 1)}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Stories() {
  const { language } = useLanguage();
  const { isPaid, isLocked } = usePlan();
  const locked = isLocked("stories");

  const [topic, setTopic] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<StorySlideType[]>(["poll", "quiz", "behind_scenes"]);

  useEffect(() => {
    const raw = sessionStorage.getItem(RADAR_PREFILL_KEY);
    if (!raw) return;
    try {
      const prefill = JSON.parse(raw) as RadarPrefill;
      sessionStorage.removeItem(RADAR_PREFILL_KEY);
      setTopic(prefill.topic);
      toast.info("Pauta do Radar carregada — ajuste os tipos e clique em Gerar.");
    } catch { /* ignore */ }
  }, []);
  const [nSlides, setNSlides] = useState(3);
  const [previewSet, setPreviewSet] = useState<StorySet | null>(null);
  const [previewSlide, setPreviewSlide] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: storyPosts = [], refetch } = trpc.stories.getAll.useQuery(undefined, { enabled: isPaid });

  const generateMutation = trpc.stories.generate.useMutation({
    onSuccess(data) {
      setPreviewSet(data.storySet ?? null);
      setPreviewSlide(0);
      if (data.warning) toast.warning(data.warning);
    },
    onError(err) { toast.error(err.message); },
  });

  const saveMutation = trpc.stories.save.useMutation({
    onSuccess() {
      toast.success("Conjunto de stories salvo!");
      setPreviewSet(null);
      refetch();
    },
    onError(err) { toast.error(err.message); },
  });

  const deleteMutation = trpc.stories.delete.useMutation({
    onSuccess() { refetch(); },
    onError(err) { toast.error(err.message); },
  });

  function toggleType(type: StorySlideType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleGenerate() {
    if (!topic.trim()) { toast.error("Digite um tema para o story."); return; }
    if (selectedTypes.length === 0) { toast.error("Selecione ao menos um tipo de story."); return; }
    generateMutation.mutate({ topic: topic.trim(), storyTypes: selectedTypes, nSlides });
  }

  async function handleSave() {
    if (!previewSet) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync({ storySet: previewSet as Parameters<typeof saveMutation.mutate>[0]["storySet"] });
    } finally {
      setSaving(false);
    }
  }

  // ─── Locked state ───────────────────────────────────────────────────────────

  if (locked) {
    return (
      <AppLayout activeModule="stories">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <div className="rounded-full bg-muted p-5">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">
            {language === "pt" ? "Gerador de Stories" : "Stories Generator"}
          </h2>
          <p className="text-muted-foreground max-w-md">
            {language === "pt"
              ? "Disponível no plano Pro ou superior. Faça upgrade para criar sequências de stories com IA."
              : "Available on Pro plan or above. Upgrade to create AI-powered story sequences."}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeModule="stories">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {language === "pt" ? "Gerador de Stories" : "Stories Generator"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === "pt"
                ? "Crie sequências de stories para Instagram com IA"
                : "Create AI-powered Instagram story sequences"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* ── Left panel ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-6">

              {/* Topic */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {language === "pt" ? "Tema ou assunto" : "Topic or subject"}
                </p>
                <Textarea
                  placeholder={language === "pt"
                    ? "Ex: Como crescer no Instagram em 2025, dicas de produtividade para empreendedores…"
                    : "E.g. How to grow on Instagram in 2025…"}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              {/* Story types */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {language === "pt" ? "Tipos de story" : "Story types"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {selectedTypes.length} {language === "pt" ? "selecionados" : "selected"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STORY_TYPES.map((type) => {
                    const meta = TYPE_META[type];
                    const selected = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={cn(
                          "relative flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all",
                          selected
                            ? meta.card + " border-opacity-80 ring-1 ring-inset ring-current/20"
                            : "border-border bg-background hover:bg-muted/40 hover:border-border"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white transition-opacity",
                          meta.iconBg,
                          !selected && "opacity-40"
                        )}>
                          {meta.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "text-xs font-semibold leading-tight",
                            selected ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {language === "pt" ? meta.pt : meta.en}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                            {meta.desc}
                          </p>
                        </div>
                        {selected && (
                          <div className={cn("absolute top-2 right-2 w-2 h-2 rounded-full", meta.iconBg)} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Number of slides */}
              <div className="space-y-2.5">
                <p className="text-sm font-semibold text-foreground">
                  {language === "pt" ? "Número de slides" : "Number of slides"}
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNSlides(n)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-semibold border transition-all",
                        nSlides === n
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !topic.trim() || selectedTypes.length === 0}
                className="w-full h-11 text-sm font-semibold gap-2"
              >
                {generateMutation.isPending ? (
                  <><span className="animate-spin">⏳</span>{language === "pt" ? "Gerando…" : "Generating…"}</>
                ) : (
                  <><Sparkles className="h-4 w-4" />{language === "pt" ? "Gerar stories" : "Generate stories"}</>
                )}
              </Button>
            </div>

            {/* API note */}
            <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 px-4 py-3">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                {language === "pt"
                  ? "Stickers interativos (enquete, quiz, caixinha) só funcionam pelo app Instagram. A API publica a imagem estática."
                  : "Interactive stickers (poll, quiz, Q&A) only work in the Instagram app. The API publishes the static image."}
              </p>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="space-y-6 min-h-[500px]">

            {/* Generated preview */}
            {previewSet && (
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                {/* Preview header */}
                <div className="px-5 py-4 border-b border-border/50 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-base leading-tight">{previewSet.setTitle}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{previewSet.theme}</p>
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={saving || saveMutation.isPending}
                    size="sm"
                    className="shrink-0 gap-1.5"
                  >
                    <BookMarked className="h-3.5 w-3.5" />
                    {saving ? (language === "pt" ? "Salvando…" : "Saving…") : (language === "pt" ? "Salvar rascunho" : "Save draft")}
                  </Button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Thumbnails strip */}
                  {previewSet.slides.length > 0 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-1 snap-x scrollbar-thin">
                      {previewSet.slides.map((slide, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewSlide(i)}
                          className={cn(
                            "shrink-0 w-[88px] cursor-pointer snap-start rounded-xl overflow-hidden transition-all",
                            previewSlide === i
                              ? "ring-2 ring-primary ring-offset-2 scale-105"
                              : "opacity-60 hover:opacity-85 hover:scale-102"
                          )}
                        >
                          <SlidePreview slide={slide} index={i} total={previewSet.slides.length} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Large preview + nav */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPreviewSlide((i) => Math.max(0, i - 1))}
                      disabled={previewSlide === 0}
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 transition-colors shrink-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 max-w-[240px] mx-auto">
                      <SlidePreview
                        slide={previewSet.slides[previewSlide]}
                        index={previewSlide}
                        total={previewSet.slides.length}
                      />
                    </div>
                    <button
                      onClick={() => setPreviewSlide((i) => Math.min(previewSet.slides.length - 1, i + 1))}
                      disabled={previewSlide === previewSet.slides.length - 1}
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-30 transition-colors shrink-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Caption + hashtags */}
                  <div className="rounded-xl bg-muted/50 border border-border/50 p-4 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {language === "pt" ? "Legenda sugerida" : "Suggested caption"}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{previewSet.caption}</p>
                    {previewSet.hashtags.length > 0 && (
                      <div className="flex items-start gap-1.5 pt-1">
                        <Hash className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-primary leading-relaxed">
                          {previewSet.hashtags.map((h) => `#${h}`).join(" ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!previewSet && storyPosts.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[420px] gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-950/40 dark:to-rose-950/40 flex items-center justify-center">
                    <Layers className="h-9 w-9 text-pink-400 dark:text-pink-500" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {language === "pt" ? "Nenhum story gerado ainda" : "No stories generated yet"}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {language === "pt"
                      ? "Configure o tema, escolha os tipos e clique em Gerar stories"
                      : "Set a topic, choose types, and click Generate stories"}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  {STORY_TYPES.slice(0, 4).map((t) => (
                    <span key={t} className={cn("text-[10px] px-2.5 py-1 rounded-full font-medium", TYPE_META[t].badge)}>
                      {TYPE_META[t].emoji} {TYPE_META[t].pt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Saved stories */}
            {storyPosts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    {language === "pt" ? "Rascunhos salvos" : "Saved drafts"}
                  </h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {storyPosts.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {storyPosts.map((post) => (
                    <StorySetCard
                      key={post.id}
                      post={post as typeof post & { storyData: string | null }}
                      onDelete={(id) => deleteMutation.mutate({ id })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
