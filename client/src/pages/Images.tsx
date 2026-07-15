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
  Layers,
  ChevronRight,
  RefreshCw,
  Check,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ImageStyle = "commercial" | "produto" | "banner" | "social" | "logo" | "lifestyle";

const STYLE_OPTIONS: {
  id: ImageStyle;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  color: string;
}[] = [
  { id: "commercial", label: "Geral",      icon: Sparkles,    desc: "Foto comercial de alta qualidade",   color: "from-violet-500 to-purple-600" },
  { id: "produto",    label: "Produto",    icon: ShoppingBag, desc: "E-commerce e catálogos",             color: "from-blue-500 to-cyan-600" },
  { id: "banner",     label: "Banner",     icon: Megaphone,   desc: "Anúncios e publicidade",             color: "from-orange-500 to-red-600" },
  { id: "social",     label: "Social",     icon: LayoutGrid,  desc: "Feed e stories",                     color: "from-pink-500 to-rose-600" },
  { id: "logo",       label: "Logo",       icon: Brush,       desc: "Identidade visual",                  color: "from-emerald-500 to-green-600" },
  { id: "lifestyle",  label: "Lifestyle",  icon: Camera,      desc: "Fotos ambientadas",                  color: "from-amber-500 to-yellow-600" },
];

const STYLE_SUGGESTIONS: Record<ImageStyle, string[]> = {
  commercial: [
    "Campanha publicitária para marca de luxo, elegante e sofisticado",
    "Anúncio digital moderno para startup de tecnologia, azul e branco",
    "Visual para campanha sazonal, estilo editorial",
  ],
  produto: [
    "Frasco de perfume em fundo branco, reflexo no vidro, iluminação de produto",
    "Tênis esportivo flutuando em fundo preto, splash de tinta colorida",
    "Cosmético premium em superfície mármore, minimalista",
  ],
  banner: [
    "Banner Black Friday, vermelho e preto, tipografia bold",
    "Header para site de agência criativa, gradiente roxo e azul",
    "Banner LinkedIn para consultoria, profissional e clean",
  ],
  social: [
    "Post carrossel para lançamento de produto tech, estilo Apple",
    "Stories motivacional para marca fitness, energia e movimento",
    "Post feed para restaurante gourmet, flat lay, vista de cima",
  ],
  logo: [
    "Logo minimalista para agência de marketing digital, letra K, dourado",
    "Ícone de app para plataforma de educação, roxo e branco",
    "Símbolo corporativo para energia sustentável, verde e cinza",
  ],
  lifestyle: [
    "Empreendedor usando laptop em café moderno, luz natural",
    "Equipe em reunião criativa, escritório moderno, diversidade",
    "Influencer segurando produto de beleza, estúdio clean, tom pastel",
  ],
};

function ReferenceImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const SUPPORTED_EDIT_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione apenas arquivos de imagem"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 10MB"); return; }

    if (SUPPORTED_EDIT_TYPES.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = (e) => onChange(e.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(objectUrl); toast.error("Erro ao processar imagem"); return; }
      ctx.drawImage(img, 0, 0);
      onChange(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); toast.error("Tente PNG, JPG ou WEBP."); };
    img.src = objectUrl;
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-xl border border-primary/30 bg-primary/5">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-border/30">
          <img src={value} alt="Referência" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Imagem de referência</p>
          <p className="text-[11px] text-muted-foreground">A IA vai usar como base visual</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => inputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors" title="Trocar">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onChange("")} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Remover">
            <X className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all",
        isDragging ? "border-primary bg-primary/5" : "border-border/30 hover:border-border/60 hover:bg-muted/20"
      )}
    >
      <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">Adicionar imagem de referência</p>
        <p className="text-[11px] text-muted-foreground">Opcional · PNG, JPG, WEBP · max 10MB</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
  const [genMode, setGenMode] = useState<"single" | "variations">("single");
  const [selectedNiche, setSelectedNiche] = useState<string>("none");
  const [variations, setVariations] = useState<{ url: string }[]>([]);
  const [justGenerated, setJustGenerated] = useState(false);

  const { data: images = [], isLoading } = trpc.images.getAll.useQuery();
  const { data: nichesData } = trpc.brandKit.listNiches.useQuery();
  const niches = nichesData ?? [];

  const isGenerating = false; // will be replaced by mutation states below

  const generateMutation = trpc.images.generate.useMutation({
    onSuccess: () => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      toast.success("Imagem gerada com sucesso!");
      setPrompt("");
      setReferenceImageUrl("");
      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 3000);
    },
    onError: (err) => toast.error("Erro ao gerar imagem: " + err.message),
  });

  const generateVariationsMutation = trpc.images.generateVariations.useMutation({
    onSuccess: (data) => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      setVariations((data.variations as { url: string }[]).filter((v) => v?.url));
      toast.success(`${data.variations.length} variações geradas!`);
    },
    onError: (err) => toast.error("Erro ao gerar variações: " + err.message),
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

  const isPending = generateMutation.isPending || generateVariationsMutation.isPending;

  const handleGenerate = () => {
    if (!prompt.trim()) { toast.error("Descreva a imagem que você quer criar"); return; }
    if (genMode === "variations") {
      setVariations([]);
      generateVariationsMutation.mutate({
        prompt: prompt.trim(),
        style,
        nicheId: selectedNiche !== "none" ? selectedNiche : undefined,
        count: 3,
      });
    } else {
      generateMutation.mutate({
        prompt: prompt.trim(),
        referenceImageUrl: referenceImageUrl || undefined,
        style,
        nicheId: selectedNiche !== "none" ? selectedNiche : undefined,
      });
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `krythos-image-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("Download iniciado!");
    } catch { window.open(url, "_blank"); }
  };

  const currentStyleOption = STYLE_OPTIONS.find((s) => s.id === style)!;

  return (
    <AppLayout activeModule="images">
      <div className="flex h-screen overflow-hidden">

        {/* ── Left panel: Generator ─────────────────────────────── */}
        <div className="w-[420px] flex-shrink-0 flex flex-col border-r border-border/30 overflow-y-auto">

          {/* Header */}
          <div className="p-5 pb-0 flex-shrink-0">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md flex-shrink-0">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground leading-tight">{t("imagesTitle")}</h1>
                <p className="text-xs text-muted-foreground">Geração com IA · gpt-image-1</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 p-5 pt-0 space-y-5">

            {/* Step 1: Style */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                <p className="text-xs font-semibold text-foreground">Tipo de imagem</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {STYLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = style === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { setStyle(opt.id); setPrompt(""); }}
                      disabled={isPending}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all duration-150 group",
                        isActive
                          ? "border-primary/50 bg-primary/8 text-primary shadow-sm"
                          : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                        isActive
                          ? `bg-gradient-to-br ${opt.color} shadow-sm`
                          : "bg-muted/50 group-hover:bg-muted"
                      )}>
                        <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                      </div>
                      <span>{opt.label}</span>
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2 h-2 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground pl-1">{currentStyleOption.desc}</p>
            </div>

            {/* Step 2: Prompt */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                <p className="text-xs font-semibold text-foreground">Descreva a imagem</p>
              </div>
              <div className="relative">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Descreva a ${currentStyleOption.label.toLowerCase()} que você quer criar...`}
                  className="resize-none min-h-[100px] glass border-border/50 focus:border-primary/50 rounded-xl text-sm pr-12"
                  disabled={isPending}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                />
                {prompt && (
                  <button
                    onClick={() => setPrompt("")}
                    className="absolute top-2 right-2 w-6 h-6 rounded-md hover:bg-muted/60 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {/* Suggestions */}
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] text-muted-foreground/70 pl-0.5">Exemplos para começar:</p>
                {STYLE_SUGGESTIONS[style].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPrompt(s)}
                    disabled={isPending}
                    className="flex items-center gap-2 text-left text-[11px] px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all group"
                  >
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                    <span className="line-clamp-1">{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                <p className="text-xs font-semibold text-foreground">Configurações</p>
              </div>

              {/* Mode toggle */}
              <div className="flex gap-1.5 p-1 bg-muted/40 rounded-xl">
                <button
                  onClick={() => { setGenMode("single"); setVariations([]); }}
                  disabled={isPending}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                    genMode === "single" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" /> 1 Imagem
                </button>
                <button
                  onClick={() => { setGenMode("variations"); setVariations([]); }}
                  disabled={isPending}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                    genMode === "variations" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" /> 3 Variações
                </button>
              </div>

              {/* Niche selector */}
              {niches.length > 0 && (
                <Select value={selectedNiche} onValueChange={setSelectedNiche} disabled={isPending}>
                  <SelectTrigger className="h-9 text-sm glass border-border/50">
                    <SelectValue placeholder="Nicho (opcional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem nicho específico</SelectItem>
                    {niches.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Reference image — only for single mode */}
              {genMode === "single" && (
                <ReferenceImageUpload value={referenceImageUrl} onChange={setReferenceImageUrl} />
              )}
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isPending}
              className="w-full gradient-primary text-white border-0 hover:opacity-90 gap-2 shadow-md h-11 text-sm font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {genMode === "variations" ? "Gerando 3 variações..." : "Criando imagem com IA..."}
                </>
              ) : (
                <>
                  {genMode === "variations" ? <Layers className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                  {genMode === "variations" ? "Gerar 3 Variações" : referenceImageUrl ? "Gerar com Referência" : "Gerar Imagem"}
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground/50 text-center -mt-2">Ctrl+Enter para gerar · Leva ~15 segundos</p>

            {/* Loading preview */}
            {isPending && (
              <div className="rounded-xl overflow-hidden border border-border/30 bg-muted/20">
                {genMode === "variations" ? (
                  <div className="grid grid-cols-3 gap-2 p-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="aspect-square shimmer rounded-lg flex items-center justify-center">
                        <div className="text-center space-y-1">
                          <Loader2 className="w-4 h-4 text-muted-foreground/40 animate-spin mx-auto" />
                          <p className="text-[9px] text-muted-foreground/60">V{i}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-square shimmer flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br mx-auto flex items-center justify-center animate-pulse", currentStyleOption.color)}>
                        {(() => { const Icon = currentStyleOption.icon; return <Icon className="w-6 h-6 text-white" />; })()}
                      </div>
                      <p className="text-xs text-muted-foreground">Criando {currentStyleOption.label.toLowerCase()}...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Variations result */}
            {genMode === "variations" && variations.length > 0 && !isPending && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Escolha a melhor variação:</p>
                <div className="grid grid-cols-3 gap-2">
                  {variations.map((v, i) => (
                    <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-border/40 cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02]">
                      <img src={v.url} alt={`Variação ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end p-1.5 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => handleDownload(v.url)}
                          className="w-full py-1 rounded-lg bg-white/90 text-[10px] font-medium text-gray-900 flex items-center justify-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Baixar
                        </button>
                      </div>
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">V{i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: Gallery ──────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Gallery header */}
          <div className="px-5 py-4 border-b border-border/30 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Galeria
                {images.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">({images.length} imagens)</span>
                )}
              </h2>
            </div>
            {justGenerated && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-fade-in-up">
                <Check className="w-3.5 h-3.5" /> Nova imagem adicionada
              </div>
            )}
          </div>

          {/* Gallery grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="aspect-square shimmer rounded-xl" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                  <Image className="w-10 h-10 text-blue-500/40" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Nenhuma imagem ainda</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Preencha o formulário à esquerda e clique em "Gerar Imagem" para criar sua primeira imagem com IA.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Leva cerca de 15 segundos por imagem</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map((img, i) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-muted/30 border border-border/30 cursor-pointer hover:border-primary/30 transition-all duration-200 hover:shadow-md hover:scale-[1.01] animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.03}s` }}
                    onClick={() => setSelectedImage(img)}
                  >
                    <img
                      src={img.imageUrl}
                      alt={img.prompt}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200" />
                    {/* Hover actions */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(img.imageUrl); }}
                        className="flex-1 py-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-900 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors"
                      >
                        <Download className="w-3 h-3" /> Baixar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                        className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
                      >
                        <ZoomIn className="w-3.5 h-3.5 text-gray-900" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl glass-card border-border/50 p-0 overflow-hidden">
          {selectedImage && (
            <div className="flex flex-col">
              <div className="relative bg-black/5">
                <img
                  src={selectedImage.imageUrl}
                  alt={selectedImage.prompt}
                  className="w-full max-h-[55vh] object-contain"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{selectedImage.prompt}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(selectedImage.imageUrl)}
                    className="flex-1 gap-2 gradient-primary text-white border-0 hover:opacity-90"
                  >
                    <Download className="w-4 h-4" /> Download
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { navigator.clipboard.writeText(selectedImage.prompt); toast.success("Prompt copiado!"); }}
                    className="gap-2"
                    title="Copiar prompt"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => deleteMutation.mutate({ id: selectedImage.id })}
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={deleteMutation.isPending}
                    title="Excluir"
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
