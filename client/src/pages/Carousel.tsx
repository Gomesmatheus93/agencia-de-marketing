import AppLayout from "@/components/AppLayout";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Sparkles,
  Download,
  Trash2,
  Loader2,
  Wand2,
  X,
  ZoomIn,
  Copy,
  Upload,
  LayoutTemplate,
  ChevronLeft,
  ChevronRight,
  Layers,
  Palette,
  Type,
  Image,
  CheckCircle2,
  Instagram,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CarouselSlide {
  title: string;
  body: string;
  imageUrl?: string;
}

interface CarouselItem {
  id: number;
  topic: string;
  slides: CarouselSlide[];
  style: string;
  coverImageUrl?: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const topicSuggestions = [
  "5 dicas de marketing digital para 2025",
  "Como aumentar seu engajamento no Instagram",
  "Tendências de design para redes sociais",
  "Erros comuns ao criar conteúdo para Instagram",
  "Passo a passo para criar uma estratégia de conteúdo",
  "Ferramentas essenciais para criadores de conteúdo",
];

const styleOptions = [
  { id: "minimal", label: "Minimalista", color: "from-gray-500 to-slate-600" },
  { id: "bold", label: "Arrojado", color: "from-orange-500 to-red-500" },
  { id: "gradient", label: "Gradiente", color: "from-purple-500 to-pink-500" },
  { id: "corporate", label: "Corporativo", color: "from-blue-600 to-cyan-500" },
  { id: "vibrant", label: "Vibrante", color: "from-green-400 to-emerald-600" },
  { id: "dark", label: "Dark Mode", color: "from-gray-800 to-gray-950" },
];

const slideCountOptions = [3, 5, 7, 10];

// ─── Cover Image Upload Component ─────────────────────────────────────────────

function CoverImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-xl border border-border/50 glass group">
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
          <img src={value} alt="Capa" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Imagem de capa adicionada</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Será usada como imagem do primeiro slide
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => inputRef.current?.click()}
            className="w-7 h-7 rounded-lg"
            title="Trocar imagem"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            className="w-7 h-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
            title="Remover imagem"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border/40 hover:border-border hover:bg-accent/20"
      )}
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Image className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">Adicionar imagem de capa</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Opcional · Clique ou arraste · PNG, JPG, WEBP · max 10MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}

// ─── Webhook Image Upload Component ──────────────────────────────────────────

function WebhookImageUpload({
  webhookUrl,
  onUploadSuccess,
}: {
  webhookUrl: string;
  onUploadSuccess: (imageUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 20MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("filename", file.name);
      formData.append("type", "carousel_image");

      const response = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const url = data.url || data.imageUrl || data.fileUrl || data.link;

      if (!url) throw new Error("Webhook não retornou uma URL válida");

      setUploadedUrl(url);
      onUploadSuccess(url);
      toast.success("Imagem enviada via webhook com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem via webhook: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (uploadedUrl) {
    return (
      <div className="flex items-center gap-3 p-2 rounded-xl border border-emerald-500/30 bg-emerald-50/10 group">
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-emerald-500/20">
          <img src={uploadedUrl} alt="Upload via webhook" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <p className="text-xs font-medium text-foreground">Imagem enviada via webhook</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{uploadedUrl}</p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => inputRef.current?.click()}
            className="w-7 h-7 rounded-lg"
            title="Enviar outra imagem"
            disabled={isUploading}
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setUploadedUrl("");
              onUploadSuccess("");
            }}
            className="w-7 h-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
            title="Remover"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => !isUploading && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border-2 border-dashed transition-all duration-200",
        isUploading
          ? "border-primary/50 bg-primary/5 cursor-wait"
          : isDragging
          ? "border-primary bg-primary/5 scale-[1.01] cursor-copy"
          : "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-50/10 cursor-pointer"
      )}
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        {isUploading ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        ) : (
          <Upload className="w-4 h-4 text-white" />
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">
          {isUploading ? "Enviando para webhook..." : "Upload via Webhook"}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isUploading
            ? "Aguarde o envio ser concluído"
            : "Clique ou arraste · A imagem será enviada via n8n · max 20MB"}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        disabled={isUploading}
      />
    </div>
  );
}

// ─── Slide Preview Component ──────────────────────────────────────────────────

function SlidePreview({
  slide,
  index,
  total,
  style,
}: {
  slide: CarouselSlide;
  index: number;
  total: number;
  style: string;
}) {
  const styleMap: Record<string, string> = {
    minimal: "bg-white text-gray-900",
    bold: "bg-gradient-to-br from-orange-500 to-red-600 text-white",
    gradient: "bg-gradient-to-br from-purple-600 to-pink-500 text-white",
    corporate: "bg-gradient-to-br from-blue-700 to-cyan-500 text-white",
    vibrant: "bg-gradient-to-br from-green-400 to-emerald-600 text-white",
    dark: "bg-gradient-to-br from-gray-900 to-gray-800 text-white",
  };

  return (
    <div
      className={cn(
        "aspect-square rounded-xl overflow-hidden flex flex-col justify-between p-4 shadow-md",
        styleMap[style] || styleMap.minimal
      )}
    >
      {slide.imageUrl ? (
        <div className="absolute inset-0">
          <img src={slide.imageUrl} alt="" className="w-full h-full object-cover opacity-30" />
        </div>
      ) : null}
      <div className="flex items-center justify-between text-[10px] opacity-60 font-medium">
        <Instagram className="w-3.5 h-3.5" />
        <span>
          {index + 1}/{total}
        </span>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-bold leading-tight line-clamp-2">{slide.title}</h3>
        <p className="text-[11px] leading-relaxed opacity-80 line-clamp-4">{slide.body}</p>
      </div>
    </div>
  );
}

// ─── Carousel Card Component ──────────────────────────────────────────────────

function CarouselCard({
  carousel,
  onClick,
}: {
  carousel: CarouselItem;
  onClick: () => void;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = carousel.slides || [];

  const styleColorMap: Record<string, string> = {
    minimal: "from-gray-200 to-slate-300",
    bold: "from-orange-500 to-red-600",
    gradient: "from-purple-500 to-pink-500",
    corporate: "from-blue-600 to-cyan-500",
    vibrant: "from-green-400 to-emerald-600",
    dark: "from-gray-800 to-gray-950",
  };

  return (
    <div
      className="group relative glass-card rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-300 animate-fade-in-up"
      onClick={onClick}
    >
      {/* Cover */}
      <div
        className={cn(
          "aspect-square bg-gradient-to-br flex items-end p-3 relative overflow-hidden",
          styleColorMap[carousel.style] || "from-gray-400 to-gray-600"
        )}
      >
        {carousel.coverImageUrl && (
          <img
            src={carousel.coverImageUrl}
            alt={carousel.topic}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="relative z-10 w-full">
          <p className="text-white text-[10px] font-medium line-clamp-2 drop-shadow">
            {carousel.topic}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-white/70 text-[9px]">{slides.length} slides</span>
            <div className="flex gap-0.5">
              {slides.slice(0, 5).map((_, i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-white/60" />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
          <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Webhook URL config ───────────────────────────────────────────────────────
// Substitua pela URL real do seu webhook n8n
const N8N_CAROUSEL_WEBHOOK_URL = "";
const N8N_IMAGE_WEBHOOK_URL = "";

export default function Carousels() {
  // Form state
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(5);
  const [selectedStyle, setSelectedStyle] = useState("gradient");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [webhookImageUrl, setWebhookImageUrl] = useState("");

  // Data state
  const [carousels, setCarousels] = useState<CarouselItem[]>([]);
  const [isLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal state
  const [selectedCarousel, setSelectedCarousel] = useState<CarouselItem | null>(null);
  const [modalSlide, setModalSlide] = useState(0);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Digite o tema do carrossel");
      return;
    }

    setIsGenerating(true);
    try {
      const payload = {
        topic: topic.trim(),
        slideCount,
        style: selectedStyle,
        coverImageUrl: coverImageUrl || webhookImageUrl || undefined,
      };

      if (N8N_CAROUSEL_WEBHOOK_URL) {
        const response = await fetch(N8N_CAROUSEL_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const newCarousel: CarouselItem = {
          id: Date.now(),
          topic: topic.trim(),
          slides: data.slides ?? [],
          style: selectedStyle,
          coverImageUrl: coverImageUrl || webhookImageUrl || undefined,
          createdAt: new Date().toISOString(),
        };
        setCarousels((prev) => [newCarousel, ...prev]);
      } else {
        // Mock local para desenvolvimento sem webhook
        const mockSlides: CarouselSlide[] = Array.from({ length: slideCount }, (_, i) => ({
          title: i === 0 ? topic.trim() : `Dica ${i} sobre ${topic.trim()}`,
          body:
            i === 0
              ? "Arraste para ver todas as dicas que preparamos para você!"
              : `Conteúdo do slide ${i + 1}. Configure o webhook n8n para gerar conteúdo real com IA.`,
        }));
        const newCarousel: CarouselItem = {
          id: Date.now(),
          topic: topic.trim(),
          slides: mockSlides,
          style: selectedStyle,
          coverImageUrl: coverImageUrl || webhookImageUrl || undefined,
          createdAt: new Date().toISOString(),
        };
        setCarousels((prev) => [newCarousel, ...prev]);
      }

      toast.success("Carrossel gerado com sucesso!");
      setTopic("");
      setCoverImageUrl("");
      setWebhookImageUrl("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao gerar carrossel: " + message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);
    try {
      setCarousels((prev) => prev.filter((c) => c.id !== id));
      setSelectedCarousel(null);
      toast.success("Carrossel excluído");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = (carousel: CarouselItem) => {
    try {
      const content = carousel.slides
        .map((s, i) => `--- Slide ${i + 1} ---\nTítulo: ${s.title}\n\n${s.body}`)
        .join("\n\n");
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carousel-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao fazer download");
    }
  };

  const handleCopySlide = (slide: CarouselSlide) => {
    navigator.clipboard.writeText(`${slide.title}\n\n${slide.body}`);
    toast.success("Slide copiado!");
  };

  const handleCopyAll = (carousel: CarouselItem) => {
    const text = carousel.slides
      .map((s, i) => `Slide ${i + 1}: ${s.title}\n${s.body}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Todos os slides copiados!");
  };

  const slides = selectedCarousel?.slides ?? [];

  return (
    <AppLayout activeModule="carousels">
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-md">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Carrosseis para Instagram</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Crie carrosseis com{" "}
            <span className="gradient-text">Inteligência Artificial</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Defina o tema, estilo e quantidade de slides — a IA monta o conteúdo completo para você.
          </p>
        </div>

        {/* Generator */}
        <div
          className="glass-card p-6 space-y-5 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Novo carrossel</h2>
          </div>

          {/* Topic textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" />
              Tema / Assunto
            </label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: 5 dicas de produtividade para empreendedores, Como crescer no Instagram em 2025..."
              className="resize-none min-h-[90px] glass border-border/50 focus:border-primary/50 rounded-xl text-sm"
              disabled={isGenerating}
            />
          </div>

          {/* Style selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              Estilo visual
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {styleOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedStyle(opt.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-150 text-xs font-medium",
                    selectedStyle === opt.id
                      ? "border-primary bg-primary/5 text-foreground scale-[1.02]"
                      : "border-border/30 hover:border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg bg-gradient-to-br shadow-sm",
                      opt.color
                    )}
                  />
                  {opt.label}
                  {selectedStyle === opt.id && (
                    <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Slide count */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Quantidade de slides
            </label>
            <div className="flex gap-2">
              {slideCountOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => setSlideCount(n)}
                  className={cn(
                    "px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all duration-150",
                    slideCount === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/30 hover:border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Cover image upload — local */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" />
              Imagem de capa (opcional)
            </label>
            <CoverImageUpload value={coverImageUrl} onChange={setCoverImageUrl} />

            {/* Webhook upload — only shown if webhook URL is configured */}
            {N8N_IMAGE_WEBHOOK_URL && (
              <WebhookImageUpload
                webhookUrl={N8N_IMAGE_WEBHOOK_URL}
                onUploadSuccess={setWebhookImageUrl}
              />
            )}
          </div>

          {/* Prompt suggestions */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Sugestões de temas:</p>
            <div className="flex flex-wrap gap-2">
              {topicSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setTopic(s)}
                  disabled={isGenerating}
                  className="text-xs px-3 py-1.5 rounded-full bg-accent/60 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-150"
                >
                  {s.length > 40 ? s.slice(0, 40) + "..." : s}
                </button>
              ))}
            </div>
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {N8N_CAROUSEL_WEBHOOK_URL && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Usando webhook n8n
                </div>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!topic.trim() || isGenerating}
              className="ml-auto gradient-primary text-white border-0 hover:opacity-90 gap-2 shadow-md"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Carrossel
                </>
              )}
            </Button>
          </div>

          {/* Loading preview */}
          {isGenerating && (
            <div className="rounded-xl overflow-hidden border border-border/30 p-8 text-center shimmer">
              <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Criando seus slides...</p>
            </div>
          )}
        </div>

        {/* Gallery */}
        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">
              Carrosseis{" "}
              <span className="text-muted-foreground font-normal">({carousels.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square shimmer rounded-2xl" />
              ))}
            </div>
          ) : carousels.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center mx-auto mb-4 opacity-40">
                <Instagram className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Nenhum carrossel ainda</h3>
              <p className="text-sm text-muted-foreground">
                Gere seu primeiro carrossel com IA acima
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {carousels.map((carousel) => (
                <CarouselCard
                  key={carousel.id}
                  carousel={carousel}
                  onClick={() => {
                    setSelectedCarousel(carousel);
                    setModalSlide(0);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedCarousel} onOpenChange={() => setSelectedCarousel(null)}>
        <DialogContent className="max-w-4xl glass-card border-border/50 p-0 overflow-hidden">
          {selectedCarousel && (
            <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
              {/* Left – slide preview */}
              <div className="lg:w-72 flex-shrink-0 bg-black/5 border-b lg:border-b-0 lg:border-r border-border/30 p-5 flex flex-col items-center gap-4">
                {/* Preview */}
                <div className="w-full max-w-[200px]">
                  <SlidePreview
                    slide={slides[modalSlide]}
                    index={modalSlide}
                    total={slides.length}
                    style={selectedCarousel.style}
                  />
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 rounded-lg"
                    onClick={() => setModalSlide((p) => Math.max(0, p - 1))}
                    disabled={modalSlide === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-16 text-center">
                    {modalSlide + 1} / {slides.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 rounded-lg"
                    onClick={() => setModalSlide((p) => Math.min(slides.length - 1, p + 1))}
                    disabled={modalSlide === slides.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Slide thumbnails */}
                <div className="flex gap-1.5 flex-wrap justify-center">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setModalSlide(i)}
                      className={cn(
                        "w-6 h-6 rounded-md text-[9px] font-bold transition-all",
                        modalSlide === i
                          ? "bg-primary text-primary-foreground scale-110"
                          : "bg-accent text-muted-foreground hover:bg-accent/80"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right – content */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="p-4 border-b border-border/30 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground leading-tight">
                      {selectedCarousel.topic}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {slides.length} slides
                      </span>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {selectedCarousel.style}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCarousel(null)}
                    className="w-7 h-7 rounded-lg glass flex items-center justify-center hover:bg-black/10 transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Slide content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="glass rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        Slide {modalSlide + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopySlide(slides[modalSlide])}
                        className="h-6 px-2 text-[11px] gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copiar slide
                      </Button>
                    </div>
                    <h4 className="font-bold text-foreground">{slides[modalSlide].title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {slides[modalSlide].body}
                    </p>
                  </div>

                  {/* All slides compact list */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Todos os slides
                    </p>
                    {slides.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setModalSlide(i)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-all duration-150 border",
                          modalSlide === i
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/20 hover:border-border/50 hover:bg-accent/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground w-5 flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-xs font-medium text-foreground truncate">
                            {s.title}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-border/30 flex gap-2">
                  <Button
                    onClick={() => handleDownload(selectedCarousel)}
                    className="flex-1 gap-2 gradient-primary text-white border-0 hover:opacity-90"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyAll(selectedCarousel)}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar tudo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(selectedCarousel.id)}
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
