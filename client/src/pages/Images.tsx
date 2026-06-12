import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Image,
  Sparkles,
  Download,
  Trash2,
  Loader2,
  Wand2,
  X,
  ZoomIn,
  Copy,
  ImagePlus,
  Upload,
  ShoppingBag,
  Megaphone,
  LayoutGrid,
  Brush,
  Camera,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
 
type ImageStyle = "commercial" | "produto" | "banner" | "social" | "logo" | "lifestyle";
const STYLE_OPTIONS: { id: ImageStyle; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "commercial", label: "Geral", icon: Sparkles, desc: "Foto comercial de alta qualidade" },
  { id: "produto",    label: "Produto",   icon: ShoppingBag, desc: "E-commerce e catálogos" },
  { id: "banner",     label: "Banner",    icon: Megaphone,   desc: "Anúncios e publicidade" },
  { id: "social",     label: "Social",    icon: LayoutGrid,  desc: "Feed e stories" },
  { id: "logo",       label: "Logo",      icon: Brush,       desc: "Identidade visual" },
  { id: "lifestyle",  label: "Lifestyle", icon: Camera,      desc: "Fotos ambientadas" },
];


const STYLE_SUGGESTIONS: Record<ImageStyle, string[]> = {
  commercial: [
    "Campanha publicitária para marca de luxo, elegante e sofisticado",
    "Anúncio digital moderno para startup de tecnologia, cores azul e branco",
    "Visual para campanha de marketing sazonal, estilo editorial",
  ],
  produto: [
    "Frasco de perfume em fundo branco, reflexo no vidro, iluminação de produto",
    "Tênis esportivo flutuando em fundo preto, splash de tinta colorida",
    "Caixa de produto de cosmético premium em superfície mármore, minimalista",
  ],
  banner: [
    "Banner de promoção Black Friday, vermelho e preto, tipografia bold",
    "Header para site de agência criativa, gradiente roxo e azul, moderno",
    "Banner LinkedIn para empresa de consultoria, profissional e clean",
  ],
  social: [
    "Post carrossel para lançamento de produto tech, estilo Apple",
    "Stories motivacional para marca fitness, energia e movimento",
    "Post feed para restaurante gourmet, prato fotografado de cima, flat lay",
  ],
  logo: [
    "Logo minimalista para agência de marketing digital, letra K, dourado",
    "Ícone de app para plataforma de educação online, roxo e branco",
    "Símbolo corporativo para empresa de energia sustentável, verde e cinza",
  ],
  lifestyle: [
    "Empreendedor usando laptop em café moderno, luz natural, produtivo",
    "Equipe de trabalho em reunião criativa, escritório moderno, diversidade",
    "Influencer segurando produto de beleza, estúdio clean, tom pastel",
  ],
};
 
// Reference Image Upload Component
function ReferenceImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
 
  const SUPPORTED_EDIT_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }

    const needsConversion = !SUPPORTED_EDIT_TYPES.includes(file.type);

    if (!needsConversion) {
      const reader = new FileReader();
      reader.onload = (e) => onChange(e.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    // Convert unsupported formats (avif, gif, tiff, bmp, etc.) to PNG via canvas
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        toast.error("Erro ao processar imagem");
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(objectUrl);
      onChange(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Não foi possível carregar esta imagem. Tente PNG, JPG ou WEBP.");
    };
    img.src = objectUrl;
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
          <img src={value} alt="Referência" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Imagem de referência adicionada</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">A IA usará esta imagem como base</p>
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
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border/40 hover:border-border hover:bg-accent/20"
      )}
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Upload className="w-4 h-4 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-foreground">Adicionar imagem de referência</p>
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
 
export default function Images() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const [prompt, setPrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ id: number; imageUrl: string; prompt: string } | null>(null);
  const [style, setStyle] = useState<ImageStyle>("commercial");

  const { data: images = [], isLoading } = trpc.images.getAll.useQuery();

  const generateMutation = trpc.images.generate.useMutation({
    onSuccess: () => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      toast.success("Imagem gerada com sucesso!");
      setPrompt("");
      setReferenceImageUrl("");
    },
    onError: (err) => {
      toast.error("Erro ao gerar imagem: " + err.message);
    },
  });
 
  const deleteMutation = trpc.images.delete.useMutation({
    onSuccess: () => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      toast.success("Imagem excluída");
      if (selectedImage) setSelectedImage(null);
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });
 
  const handleGenerate = () => {
    if (!prompt.trim()) { toast.error("Digite um prompt para gerar a imagem"); return; }
    generateMutation.mutate({
      prompt: prompt.trim(),
      referenceImageUrl: referenceImageUrl || undefined,
      style,
    });
  };
 
  const handleDownload = async (url: string, _promptText: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `ai-image-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("Download iniciado!");
    } catch {
      window.open(url, "_blank");
    }
  };
 
  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Prompt copiado!");
  };
 
  return (
    <AppLayout activeModule="images">
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
              <Image className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">{t("imagesTitle")}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {t("imagesTitle")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Powered by <strong>gpt-image-1</strong> — o modelo mais avançado da OpenAI para criação de imagens.
          </p>
        </div>

        {/* Generator */}
        <div className="glass-card p-6 space-y-5 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Nova imagem</h2>
          </div>

          {/* Style selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Estilo</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {STYLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = style === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setStyle(opt.id)}
                    disabled={generateMutation.isPending}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all duration-150",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/40 bg-accent/20 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>


          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva a imagem comercial que você quer criar..."
            className="resize-none min-h-[90px] glass border-border/50 focus:border-primary/50 rounded-xl text-sm"
            disabled={generateMutation.isPending}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
          />

          {/* Suggestions for selected style */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Sugestões para "{STYLE_OPTIONS.find(s => s.id === style)?.label}":</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_SUGGESTIONS[style].map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  disabled={generateMutation.isPending}
                  className="text-xs px-3 py-1.5 rounded-full bg-accent/60 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-150 text-left"
                >
                  {s.length > 52 ? s.slice(0, 52) + "…" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Reference image upload */}
          <ReferenceImageUpload value={referenceImageUrl} onChange={setReferenceImageUrl} />

          <div className="flex items-center justify-end">
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateMutation.isPending}
              className="ml-auto gradient-primary text-white border-0 hover:opacity-90 gap-2 shadow-md"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando imagem comercial...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {referenceImageUrl ? "Gerar com Referência" : "Gerar Imagem"}
                </>
              )}
            </Button>
          </div>

          {generateMutation.isPending && (
            <div className="rounded-xl overflow-hidden border border-border/30">
              <div className="aspect-square max-w-xs mx-auto shimmer flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Loader2 className="w-8 h-8 text-muted-foreground/40 animate-spin mx-auto" />
                  <p className="text-xs text-muted-foreground">Gerando imagem comercial de alta qualidade...</p>
                </div>
              </div>
            </div>
          )}
        </div>
 
        {/* Gallery */}
        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm text-foreground">
                Galeria <span className="text-muted-foreground font-normal">({images.length})</span>
              </h2>
            </div>
          </div>
 
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square shimmer rounded-2xl" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 opacity-40">
                <Image className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Nenhuma imagem ainda</h3>
              <p className="text-sm text-muted-foreground">Gere sua primeira imagem com IA acima</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="group relative aspect-square rounded-2xl overflow-hidden glass-card cursor-pointer animate-fade-in-up hover:scale-[1.02] transition-all duration-300"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => setSelectedImage(img)}
                >
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-white text-[10px] line-clamp-2">{img.prompt}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
 
      {/* Image modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl glass-card border-border/50 p-0 overflow-hidden">
          {selectedImage && (
            <div className="flex flex-col">
              <div className="relative">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full max-h-[60vh] object-contain bg-black/5"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full glass flex items-center justify-center hover:bg-black/20 transition-all"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedImage.prompt}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(selectedImage.imageUrl, selectedImage.prompt)}
                    className="flex-1 gap-2 gradient-primary text-white border-0 hover:opacity-90"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyPrompt(selectedImage.prompt)}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar Prompt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => deleteMutation.mutate({ id: selectedImage.id })}
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={deleteMutation.isPending}
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
