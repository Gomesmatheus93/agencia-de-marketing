import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlan } from "@/_core/hooks/usePlan";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Lock,
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

const TYPE_LABELS: Record<StorySlideType, { pt: string; en: string; emoji: string }> = {
  poll: { pt: "Enquete", en: "Poll", emoji: "📊" },
  quiz: { pt: "Quiz", en: "Quiz", emoji: "🎯" },
  countdown: { pt: "Contagem regressiva", en: "Countdown", emoji: "⏳" },
  question_box: { pt: "Caixinha", en: "Q&A Box", emoji: "💬" },
  behind_scenes: { pt: "Bastidores", en: "Behind the Scenes", emoji: "🎬" },
  post_reinforcement: { pt: "Reforço de post", en: "Post Boost", emoji: "🔁" },
};

const TYPE_COLORS: Record<StorySlideType, string> = {
  poll: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  quiz: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  countdown: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  question_box: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  behind_scenes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  post_reinforcement: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
};

// ─── Story slide preview (9:16 CSS, no Canvas) ───────────────────────────────

function SlidePreview({ slide, index, total }: { slide: StorySlide; index: number; total: number }) {
  const type = slide.type as StorySlideType;
  const label = TYPE_LABELS[type];
  const color = TYPE_COLORS[type];

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

  const bgStyle = slide.imageUrl
    ? { backgroundImage: `url(${slide.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* 9:16 aspect ratio preview */}
      <div
        className="relative w-full rounded-2xl overflow-hidden flex flex-col items-center justify-center p-5 gap-4"
        style={{ aspectRatio: "9/16", ...bgStyle }}
      >
        {/* Dark overlay for text legibility over generated images */}
        {slide.imageUrl && (
          <div className="absolute inset-0 bg-black/40" />
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
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 p-2.5">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {language === "pt" ? "Gerador de Stories" : "Stories Generator"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {language === "pt"
                ? "Crie sequências de stories para Instagram com IA"
                : "Create AI-powered Instagram story sequences"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — generator */}
          <div className="lg:col-span-1 space-y-5">
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h2 className="font-semibold text-sm">
                {language === "pt" ? "Configurar stories" : "Configure stories"}
              </h2>

              {/* Topic */}
              <div className="space-y-1.5">
                <Label htmlFor="story-topic" className="text-xs text-muted-foreground">
                  {language === "pt" ? "Tema ou assunto" : "Topic or subject"}
                </Label>
                <Input
                  id="story-topic"
                  placeholder={language === "pt" ? "Ex: Como crescer no Instagram em 2025" : "E.g. How to grow on Instagram in 2025"}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                />
              </div>

              {/* Story types */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  {language === "pt" ? "Tipos de story (selecione os que quer usar)" : "Story types (select the ones to use)"}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {STORY_TYPES.map((type) => {
                    const label = TYPE_LABELS[type];
                    const selected = selectedTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <span>{label.emoji}</span>
                        <span>{language === "pt" ? label.pt : label.en}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Number of slides */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {language === "pt" ? "Número de slides" : "Number of slides"}: {nSlides}
                </Label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={nSlides}
                  onChange={(e) => setNSlides(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !topic.trim()}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <><span className="animate-spin mr-2">⏳</span>{language === "pt" ? "Gerando…" : "Generating…"}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />{language === "pt" ? "Gerar stories" : "Generate stories"}</>
                )}
              </Button>
            </div>

            {/* API note */}
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 p-3">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                {language === "pt"
                  ? "Stickers interativos (enquete, quiz, caixinha) só funcionam pelo app Instagram. A API publica a imagem estática."
                  : "Interactive stickers (poll, quiz, Q&A) only work in the Instagram app. The API publishes the static image."}
              </p>
            </div>
          </div>

          {/* Right — preview + saved */}
          <div className="lg:col-span-2 space-y-6">

            {/* Generated preview */}
            {previewSet && (
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{previewSet.setTitle}</h2>
                    <p className="text-xs text-muted-foreground">{previewSet.theme}</p>
                  </div>
                  <Button onClick={handleSave} disabled={saving || saveMutation.isPending} size="sm">
                    {saving ? (language === "pt" ? "Salvando…" : "Saving…") : (language === "pt" ? "Salvar rascunho" : "Save draft")}
                  </Button>
                </div>

                {/* Slide carousel */}
                {previewSet.slides.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                      {previewSet.slides.map((slide, i) => (
                        <div
                          key={i}
                          className={`shrink-0 w-40 cursor-pointer snap-start transition-transform ${previewSlide === i ? "scale-105" : "opacity-70 hover:opacity-90"}`}
                          onClick={() => setPreviewSlide(i)}
                        >
                          <SlidePreview slide={slide} index={i} total={previewSet.slides.length} />
                        </div>
                      ))}
                    </div>

                    {/* Large preview of selected slide */}
                    <div className="max-w-xs mx-auto">
                      <SlidePreview
                        slide={previewSet.slides[previewSlide]}
                        index={previewSlide}
                        total={previewSet.slides.length}
                      />
                    </div>
                  </div>
                )}

                {/* Caption + hashtags */}
                <div className="rounded-xl bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {language === "pt" ? "Legenda sugerida" : "Suggested caption"}
                  </p>
                  <p className="text-sm">{previewSet.caption}</p>
                  {previewSet.hashtags.length > 0 && (
                    <p className="text-xs text-primary">{previewSet.hashtags.map((h) => `#${h}`).join(" ")}</p>
                  )}
                </div>
              </div>
            )}

            {/* Empty state + saved stories */}
            {storyPosts.length === 0 && !previewSet && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Layers className="h-10 w-10 opacity-20" />
                <p className="text-sm">{language === "pt" ? "Nenhum story salvo ainda." : "No stories saved yet."}</p>
                <p className="text-xs">{language === "pt" ? "Gere seu primeiro conjunto acima." : "Generate your first set above."}</p>
              </div>
            )}

            {storyPosts.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {language === "pt" ? "Rascunhos salvos" : "Saved drafts"}
                </h2>
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
