import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import type { RadarPrefill } from "@/pages/Radar";
const RADAR_PREFILL_KEY = "radar_prefill";
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
  RefreshCw,
  Check,
  Crop,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/SafeImage";

function resolveImgUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  if (typeof window !== "undefined") return new URL(url, window.location.origin).toString();
  return url;
}

type ImageStyle = "commercial" | "produto" | "banner" | "social" | "logo" | "lifestyle";

const STYLE_OPTIONS: {
  id: ImageStyle;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  gradient: string;
}[] = [
  { id: "commercial", label: "Geral",      icon: Sparkles,    desc: "Foto comercial de alta qualidade",  gradient: "from-violet-500 to-purple-600" },
  { id: "produto",    label: "Produto",    icon: ShoppingBag, desc: "E-commerce e catálogos",            gradient: "from-blue-500 to-cyan-600" },
  { id: "banner",     label: "Banner",     icon: Megaphone,   desc: "Anúncios e publicidade",            gradient: "from-orange-500 to-red-500" },
  { id: "social",     label: "Social",     icon: LayoutGrid,  desc: "Posts e stories",                   gradient: "from-pink-500 to-rose-600" },
  { id: "logo",       label: "Logo",       icon: Brush,       desc: "Identidade visual",                 gradient: "from-emerald-500 to-teal-600" },
  { id: "lifestyle",  label: "Lifestyle",  icon: Camera,      desc: "Fotos ambientadas",                 gradient: "from-amber-500 to-orange-500" },
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
    "Cosmético premium em superfície mármore, minimalista",
  ],
  banner: [
    "Banner de promoção Black Friday, vermelho e preto, tipografia bold",
    "Header para site de agência criativa, gradiente roxo e azul",
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
    "Equipe em reunião criativa, escritório moderno, diversidade",
    "Influencer segurando produto de beleza, estúdio clean, tom pastel",
  ],
};

type ReformatFormat = "square" | "portrait" | "story";

const FORMAT_OPTIONS: {
  id: ReformatFormat | "original";
  label: string;
  dims: string;
  ratioClass: string;
}[] = [
  { id: "original", label: "Original",      dims: "tamanho atual", ratioClass: "aspect-square" },
  { id: "portrait", label: "Feed retrato",  dims: "1080 x 1350px", ratioClass: "aspect-[4/5]" },
  { id: "square",   label: "Feed quadrado", dims: "1080 x 1080px", ratioClass: "aspect-square" },
  { id: "story",    label: "Story",         dims: "1080 x 1920px", ratioClass: "aspect-[9/16]" },
];

function ReferenceImageUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione apenas arquivos de imagem"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 10 MB"); return; }
    const supported = ["image/jpeg", "image/png", "image/webp"];
    if (supported.includes(file.type)) {
      const r = new FileReader();
      r.onload = (e) => onChange(e.target?.result as string);
      r.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d")?.drawImage(img, 0, 0);
      onChange(c.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast.error("Tente PNG, JPG ou WEBP."); };
    img.src = url;
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/5">
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-border/30">
          <img src={value} alt="ref" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Imagem de referência</p>
          <p className="text-[11px] text-muted-foreground">A IA vai usar como base visual</p>
        </div>
        <button onClick={() => inputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors">
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={() => onChange("")} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
          <X className="w-3.5 h-3.5 text-destructive" />
        </button>
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
        isDragging ? "border-primary bg-primary/5" : "border-border/40 hover:border-border/70 hover:bg-muted/20"
      )}
    >
      <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div>
        <p className="text-xs font-medium text-foreground">Imagem de referência</p>
        <p className="text-[11px] text-muted-foreground">Opcional · clique ou arraste · PNG, JPG, WEBP</p>
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
  const [genMode, setGenMode] = useState<"single" | "variations" | "abtest">("single");
  const [selectedNiche, setSelectedNiche] = useState<string>("none");
  const [variations, setVariations] = useState<{ url: string }[]>([]);
  const [abWinner, setAbWinner] = useState<"A" | "B" | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [reformattingId, setReformattingId] = useState<number | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(RADAR_PREFILL_KEY);
    if (!raw) return;
    try {
      const prefill = JSON.parse(raw) as RadarPrefill;
      sessionStorage.removeItem(RADAR_PREFILL_KEY);
      setPrompt(`${prefill.topic}${prefill.hook ? ` — ${prefill.hook}` : ""}`);
      setStyle("social");
      toast.info("Pauta do Radar carregada — ajuste o prompt e clique em Gerar.");
    } catch { /* ignore */ }
  }, []);

  const { data: images = [], isLoading } = trpc.images.getAll.useQuery();
  const { data: nichesData } = trpc.brandKit.listNiches.useQuery();
  const niches = nichesData ?? [];

  const generateMutation = trpc.images.generate.useMutation({
    onSuccess: () => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      toast.success("Imagem gerada com sucesso!");
      setPrompt("");
      setReferenceImageUrl("");
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
    onError: (err) => toast.error("Erro: " + err.message),
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

  const reformatMutation = trpc.images.reformat.useMutation({
    onSuccess: () => {
      utils.images.getAll.invalidate();
      utils.images.getStats.invalidate();
      toast.success("Nova versão criada no formato escolhido!");
      setShowFormatDialog(false);
      setReformattingId(null);
    },
    onError: (err) => {
      toast.error("Erro ao redimensionar: " + err.message);
      setReformattingId(null);
    },
  });

  const isPending = generateMutation.isPending || generateVariationsMutation.isPending;
  const activeStyle = STYLE_OPTIONS.find((s) => s.id === style)!;

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
    } else if (genMode === "abtest") {
      setVariations([]);
      setAbWinner(null);
      generateVariationsMutation.mutate({
        prompt: prompt.trim(),
        style,
        nicheId: selectedNiche !== "none" ? selectedNiche : undefined,
        count: 2,
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

  return (
    <AppLayout activeModule="images">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 pb-16">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md flex-shrink-0">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">{t("imagesTitle")}</h1>
            <p className="text-xs text-muted-foreground">Crie imagens profissionais com IA em segundos</p>
          </div>
        </div>

        {/* ── Creator card ─────────────────────────────────────── */}
        <div className="glass-card overflow-hidden">

          {/* Card top bar */}
          <div className="px-6 pt-5 pb-4 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Nova imagem</span>
            </div>
            {/* Mode toggle */}
            <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
              <button
                onClick={() => { setGenMode("single"); setVariations([]); }}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  genMode === "single"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Image className="w-3.5 h-3.5" />
                1 imagem
              </button>
              <button
                onClick={() => { setGenMode("variations"); setVariations([]); }}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  genMode === "variations"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                3 variações
              </button>
              <button
                onClick={() => { setGenMode("abtest"); setVariations([]); setAbWinner(null); }}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  genMode === "abtest"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="font-bold text-[11px]">A/B</span>
                Teste
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">

            {/* Style selector */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2.5">Tipo de imagem</p>
              <div className="grid grid-cols-6 gap-2">
                {STYLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = style === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { setStyle(opt.id); setPrompt(""); }}
                      disabled={isPending}
                      title={opt.desc}
                      className={cn(
                        "relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl border text-xs font-medium transition-all duration-150",
                        isActive
                          ? "border-primary/40 bg-primary/8 text-primary"
                          : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                        isActive
                          ? `bg-gradient-to-br ${opt.gradient} shadow-md`
                          : "bg-muted/60"
                      )}>
                        <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-muted-foreground")} />
                      </div>
                      <span>{opt.label}</span>
                      {isActive && (
                        <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-medium text-muted-foreground">Descreva o que você quer criar</p>
                {prompt && (
                  <span className="text-[10px] text-muted-foreground/50">{prompt.length} caracteres</span>
                )}
              </div>
              <div className="relative">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Ex: ${STYLE_SUGGESTIONS[style][0]}`}
                  className="resize-none min-h-[110px] text-sm rounded-xl border-border/50 focus:border-primary/50 pr-10"
                  disabled={isPending}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                />
                {prompt && (
                  <button
                    onClick={() => setPrompt("")}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md hover:bg-muted/60 flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Suggestion chips */}
              {!prompt && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {STYLE_SUGGESTIONS[style].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(s)}
                      disabled={isPending}
                      className="text-[11px] px-3 py-1.5 rounded-full border border-border/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all"
                    >
                      {s.length > 55 ? s.slice(0, 55) + "…" : s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Options row */}
            <div className="flex items-center gap-3">
              {niches.length > 0 && (
                <div className="flex-1">
                  <Select value={selectedNiche} onValueChange={setSelectedNiche} disabled={isPending}>
                    <SelectTrigger className="h-9 text-xs border-border/50">
                      <SelectValue placeholder="Nicho (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem nicho específico</SelectItem>
                      {niches.map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {genMode === "single" && (
                <div className={niches.length > 0 ? "flex-1" : "w-full"}>
                  <ReferenceImageUpload value={referenceImageUrl} onChange={setReferenceImageUrl} />
                </div>
              )}
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isPending}
              size="lg"
              className="w-full gradient-primary text-white border-0 hover:opacity-90 gap-2.5 shadow-lg h-12 text-sm font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {genMode === "abtest" ? "Gerando variações A e B..." : genMode === "variations" ? "Gerando 3 variações..." : "Criando imagem com IA..."}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  {genMode === "abtest" ? "Gerar Teste A/B" : genMode === "variations" ? "Gerar 3 Variações" : referenceImageUrl ? "Gerar com Referência" : "Gerar Imagem"}
                </>
              )}
            </Button>
            {!isPending && (
              <p className="text-[10px] text-muted-foreground/40 text-center -mt-2">
                Ctrl + Enter para gerar · leva ~15 segundos
              </p>
            )}

            {/* Loading skeleton */}
            {isPending && (
              <div className="rounded-xl overflow-hidden border border-border/20 bg-muted/10">
                {genMode === "abtest" ? (
                  <div className="grid grid-cols-2 gap-4 p-4">
                    {["A", "B"].map((label) => (
                      <div key={label} className="aspect-square shimmer rounded-xl flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 text-muted-foreground/30 animate-spin mx-auto mb-1" />
                          <p className="text-[10px] text-muted-foreground/50 font-bold">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : genMode === "variations" ? (
                  <div className="grid grid-cols-3 gap-3 p-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="aspect-square shimmer rounded-xl flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 text-muted-foreground/30 animate-spin mx-auto mb-1" />
                          <p className="text-[10px] text-muted-foreground/50">Variação {i}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video max-h-52 shimmer flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <div className={cn("w-14 h-14 rounded-2xl bg-gradient-to-br mx-auto flex items-center justify-center animate-pulse", activeStyle.gradient)}>
                        {(() => { const Icon = activeStyle.icon; return <Icon className="w-7 h-7 text-white" />; })()}
                      </div>
                      <p className="text-xs text-muted-foreground">Criando {activeStyle.label.toLowerCase()}...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* A/B Test result */}
            {genMode === "abtest" && variations.length >= 2 && !isPending && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {abWinner ? `Você escolheu a versão ${abWinner} ✓` : "Qual versão performa melhor? Escolha:"}
                  </p>
                  {abWinner && (
                    <button onClick={() => setAbWinner(null)} className="text-[11px] text-muted-foreground hover:text-foreground underline">
                      Comparar novamente
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(["A", "B"] as const).map((label, i) => {
                    const v = variations[i];
                    const isWinner = abWinner === label;
                    const isLoser = abWinner && abWinner !== label;
                    return (
                      <div key={label} className={cn(
                        "relative rounded-xl overflow-hidden border-2 transition-all",
                        isWinner ? "border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.02]" :
                        isLoser ? "border-border/30 opacity-50" :
                        "border-border/40 hover:border-primary/50 hover:scale-[1.01] cursor-pointer"
                      )}>
                        <div className="absolute top-2 left-2 z-10">
                          <span className={cn(
                            "text-white text-sm font-black px-3 py-1 rounded-lg shadow-lg",
                            isWinner ? "bg-emerald-500" : "bg-black/70"
                          )}>{label}</span>
                        </div>
                        {isWinner && (
                          <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">ESCOLHIDA</div>
                        )}
                        <SafeImage src={resolveImgUrl(v.url)} alt={`Versão ${label}`} className="w-full aspect-square object-cover" />
                        {!abWinner && (
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                            <button
                              onClick={() => { setAbWinner(label); handleDownload(v.url); }}
                              className="px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-bold shadow-lg"
                            >
                              Escolher {label} e Baixar
                            </button>
                          </div>
                        )}
                        {abWinner && isWinner && (
                          <div className="absolute inset-x-0 bottom-0 p-3">
                            <button
                              onClick={() => handleDownload(v.url)}
                              className="w-full py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" /> Baixar versão {label}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Variations result */}
            {genMode === "variations" && variations.length > 0 && !isPending && (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-foreground">Escolha a melhor variação:</p>
                <div className="grid grid-cols-3 gap-3">
                  {variations.map((v, i) => (
                    <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-border/40 cursor-pointer hover:border-primary/50 hover:scale-[1.02] transition-all">
                      <SafeImage src={resolveImgUrl(v.url)} alt={`V${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end p-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => handleDownload(v.url)}
                          className="w-full py-1.5 rounded-lg bg-white/90 text-[11px] font-medium text-gray-900 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar
                        </button>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md font-semibold">V{i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Gallery ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Galeria
              {images.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{images.length} imagens</span>
              )}
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-square shimmer rounded-2xl" />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="glass-card p-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Image className="w-8 h-8 text-blue-400/60" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Nenhuma imagem ainda</h3>
              <p className="text-sm text-muted-foreground">Gere sua primeira imagem com IA usando o criador acima</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img, i) => {
                const isBroken = brokenImages.has(img.id);
                return (
                  <div
                    key={img.id}
                    className={cn(
                      "group relative aspect-square rounded-2xl overflow-hidden glass-card transition-all duration-200",
                      isBroken ? "cursor-default" : "cursor-pointer hover:scale-[1.02]"
                    )}
                    style={{ animationDelay: `${i * 0.04}s` }}
                    onClick={() => !isBroken && setSelectedImage(img)}
                  >
                    {isBroken ? (
                      /* Placeholder for expired/broken image URLs */
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3 bg-muted/30">
                        <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center">
                          <Image className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 text-center line-clamp-3 leading-relaxed">{img.prompt}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: img.id }); }}
                          className="mt-1 text-[10px] text-destructive/60 hover:text-destructive transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remover
                        </button>
                      </div>
                    ) : (
                      <>
                        <img
                          src={resolveImgUrl(img.imageUrl)}
                          alt={img.prompt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={() => setBrokenImages((prev) => new Set([...prev, img.id]))}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200" />
                        <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(img.imageUrl); }}
                            className="flex-1 py-1.5 rounded-xl bg-white/90 hover:bg-white text-gray-900 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                          >
                            <Download className="w-3 h-3" /> Baixar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}
                            className="w-8 h-7 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
                          >
                            <ZoomIn className="w-3.5 h-3.5 text-gray-900" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Image modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl glass-card border-border/50 p-0 overflow-hidden">
          {selectedImage && (
            <>
              <div className="relative bg-black/5">
                <SafeImage
                  src={resolveImgUrl(selectedImage.imageUrl)}
                  alt={selectedImage.prompt}
                  className="w-full max-h-[55vh] object-contain"
                  fallbackClassName="min-h-[200px]"
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
                  <Button onClick={() => handleDownload(selectedImage.imageUrl)} className="flex-1 gap-2 gradient-primary text-white border-0 hover:opacity-90">
                    <Download className="w-4 h-4" /> Download
                  </Button>
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(selectedImage.prompt); toast.success("Prompt copiado!"); }} title="Copiar prompt">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setShowFormatDialog(true)} title="Redimensionar para outro formato">
                    <Crop className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => deleteMutation.mutate({ id: selectedImage.id })}
                    className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={deleteMutation.isPending}
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Format picker dialog */}
      <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
        <DialogContent className="max-w-md glass-card border-border/50">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-foreground">Redimensionar imagem</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                A IA estende a cena para preencher o novo formato de forma natural.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map((opt) => {
                const isLoadingThis = reformattingId === selectedImage?.id && reformatMutation.isPending && opt.id !== "original";
                return (
                  <button
                    key={opt.id}
                    disabled={reformatMutation.isPending}
                    onClick={() => {
                      if (opt.id === "original") { setShowFormatDialog(false); return; }
                      if (!selectedImage) return;
                      setReformattingId(selectedImage.id);
                      reformatMutation.mutate({ id: selectedImage.id, format: opt.id as ReformatFormat });
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className={cn("w-12 rounded-md border border-border/60 bg-muted/40 flex items-center justify-center", opt.ratioClass)}>
                      {isLoadingThis
                        ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        : <Crop className="w-4 h-4 text-muted-foreground/50" />
                      }
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.dims}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
