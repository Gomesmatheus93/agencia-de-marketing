import { useState } from "react";
import { toast } from "sonner";
import {
  ScanSearch,
  Plus,
  Trash2,
  X,
  Check,
  Palette,
  Type,
  Eye,
  MessageSquare,
  User,
  Sparkles,
  Image,
  AlertCircle,
  Instagram,
  Upload,
  ImagePlus,
  Layers,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import type { InstagramStyleResult } from "../../../server/_core/instagramStyleAgent";

type Mode = "list" | "new" | "result" | "viewing";

type SavedProfile = {
  id: number;
  profileHandle: string;
  profileName: string | null;
  profilePictureUrl: string | null;
  source: string;
  analysisJson: string;
  createdAt: Date;
};

function ColorSwatch({ color, label }: { color?: string; label: string }) {
  if (!color) return null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-10 h-10 rounded-lg shadow-sm border border-border/30 flex-shrink-0"
        style={{ backgroundColor: color }}
        title={color}
      />
      <div className="text-center">
        <div className="text-[10px] font-mono text-muted-foreground">{color}</div>
        <div className="text-[10px] text-muted-foreground/70">{label}</div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary/70">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground/70 flex-shrink-0 w-36">{label}:</span>
      <span className="text-foreground/80 flex-1">{value}</span>
    </div>
  );
}

function ResultPanel({
  result,
  source,
  onSave,
  onApplyToBrandKit,
  onSaveAsTemplate,
  onClose,
  isSaving,
  isApplying,
  alreadySaved,
  savedAsTemplate,
}: {
  result: InstagramStyleResult;
  source: "api" | "scrape" | "upload";
  onSave: () => void;
  onApplyToBrandKit: () => void;
  onSaveAsTemplate: () => void;
  onClose?: () => void;
  isSaving: boolean;
  isApplying: boolean;
  alreadySaved: boolean;
  savedAsTemplate: boolean;
}) {
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  return (
    <div className="flex flex-col h-full">
      {/* Profile header */}
      <div className="flex items-center gap-4 p-5 border-b border-border/30 flex-shrink-0">
        {result.profileImageUrl ? (
          <img
            src={result.profileImageUrl}
            alt={result.profileHandle}
            className="w-14 h-14 rounded-full object-cover border-2 border-border/30 flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground text-base">{result.profileName || result.profileHandle}</div>
          <div className="text-sm text-muted-foreground">{result.profileHandle}</div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {result.niche && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{result.niche}</Badge>
            )}
            {result.objective && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">{result.objective}</Badge>
            )}
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* Needs-upload state — shown instead of the full result */}
        {result.needsUpload && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="font-semibold text-foreground">Configuração necessária</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.styleSummary}
              </p>
            </div>
            <div className="w-full max-w-sm p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-left space-y-2">
              <p className="text-xs font-semibold text-violet-700 dark:text-violet-400">Como ativar análise automática de perfis externos:</p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Acesse <strong>scraperapi.com</strong> e crie uma conta gratuita</li>
                <li>Copie sua <strong>API Key</strong> do painel</li>
                <li>No Easypanel, adicione a variável de ambiente: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">SCRAPERAPI_KEY=sua_chave</code></li>
                <li>Reinicie o serviço — análise automática estará disponível</li>
              </ol>
              <p className="text-[10px] text-muted-foreground/60 pt-1">Plano gratuito: 1.000 análises/mês · sem cartão de crédito</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={onClose}
                variant="outline"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Analisar com prints
              </Button>
            </div>
          </div>
        )}

        {/* Regular result content — hidden when needsUpload */}
        {!result.needsUpload && <>

        {/* Posts analisados */}
        {result.rawPostImageUrls && result.rawPostImageUrls.length > 0 && (
          <Section icon={<Instagram className="w-4 h-4" />} title={`Posts analisados (${result.rawPostImageUrls.length})`}>
            <div className="grid grid-cols-3 gap-2">
              {result.rawPostImageUrls.map((url, i) => (
                <div key={i} className={cn("aspect-square rounded-lg overflow-hidden bg-muted/40 border border-border/20", failedImages.has(i) && "hidden")}>
                  <img
                    src={url}
                    alt={`Post ${i + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => setFailedImages((prev) => new Set([...prev, i]))}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            {failedImages.size === result.rawPostImageUrls.length && (
              <p className="text-xs text-muted-foreground text-center py-2">
                As imagens dos posts expiraram. A análise foi feita no momento da consulta.
              </p>
            )}
          </Section>
        )}

        {/* Style summary */}
        <p className="text-sm text-muted-foreground leading-relaxed">{result.styleSummary}</p>

        {/* Color palette */}
        <Section icon={<Palette className="w-4 h-4" />} title="Paleta de Cores">
          <div className="flex flex-wrap gap-5">
            <ColorSwatch color={result.primaryColor} label="Primária" />
            <ColorSwatch color={result.secondaryColor} label="Secundária" />
            <ColorSwatch color={result.accentColor} label="Destaque" />
            <ColorSwatch color={result.bgColor} label="Fundo" />
            <ColorSwatch color={result.textColor} label="Texto" />
          </div>
        </Section>

        {/* Typography */}
        <Section icon={<Type className="w-4 h-4" />} title="Tipografia">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Fonte principal" value={result.fontFamily?.split(",")[0]} />
            <InfoRow label="Peso visual" value={result.fontWeight} />
            <InfoRow label="Alinhamento" value={result.titleAlign} />
            <InfoRow label="Fonte secundária" value={result.secondaryFont} />
          </div>
        </Section>

        {/* Visual identity */}
        <Section icon={<Eye className="w-4 h-4" />} title="Identidade Visual">
          <div className="space-y-2">
            <InfoRow label="Padrão de layout" value={result.layoutPattern} />
            <InfoRow label="Estilo de edição" value={result.editingStyle} />
            <InfoRow label="Elementos recorrentes" value={result.recurringElements} />
            <InfoRow label="Estrutura do post" value={result.postStructure} />
            <InfoRow label="Efeitos visuais" value={result.visualEffects} />
          </div>
        </Section>

        {/* Content strategy */}
        <Section icon={<MessageSquare className="w-4 h-4" />} title="Estratégia de Conteúdo">
          <div className="space-y-2">
            <InfoRow label="Tipo de copy" value={result.copyType} />
            <InfoRow label="Estrutura da legenda" value={result.captionStructure} />
            <InfoRow label="Tom e linguagem" value={result.language} />
            <InfoRow label="Público-alvo" value={result.targetAudience} />
            {result.toneDescription && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{result.toneDescription}</p>
            )}
            {result.ctaExamples && result.ctaExamples.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-muted-foreground/70 mb-1">CTAs típicos:</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.ctaExamples.map((cta, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px]">{cta}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Slide design */}
        {(result.coverSlideStyle || result.contentSlideStyle) && (
          <Section icon={<Image className="w-4 h-4" />} title="Design dos Slides">
            {result.coverSlideStyle && (
              <div className="mb-3">
                <div className="text-xs font-medium text-foreground/80 mb-1.5">Capa</div>
                <div className="flex gap-3 items-center">
                  <div className="w-5 h-5 rounded flex-shrink-0 border border-border/30" style={{ backgroundColor: result.coverSlideStyle.bgColor }} />
                  <div className="w-5 h-5 rounded flex-shrink-0 border border-border/30" style={{ backgroundColor: result.coverSlideStyle.accentColor }} />
                  <p className="text-xs text-muted-foreground">{result.coverSlideStyle.description}</p>
                </div>
              </div>
            )}
            {result.contentSlideStyle && (
              <div>
                <div className="text-xs font-medium text-foreground/80 mb-1.5">Slides internos</div>
                <div className="flex gap-3 items-center">
                  <div className="w-5 h-5 rounded flex-shrink-0 border border-border/30" style={{ backgroundColor: result.contentSlideStyle.bgColor }} />
                  <div className="w-5 h-5 rounded flex-shrink-0 border border-border/30" style={{ backgroundColor: result.contentSlideStyle.accentColor }} />
                  <p className="text-xs text-muted-foreground">{result.contentSlideStyle.description}</p>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Brand keywords */}
        {result.brandKeywords && result.brandKeywords.length > 0 && (
          <Section icon={<Sparkles className="w-4 h-4" />} title="Palavras-chave da Marca">
            <div className="flex flex-wrap gap-1.5">
              {result.brandKeywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
          </Section>
        )}

        </> /* end !needsUpload */}
      </div>

      {/* Action bar — hidden when no images were found */}
      {!result.needsUpload && (
        <div className="p-4 border-t border-border/30 flex flex-col gap-2 flex-shrink-0">
          <div className="flex gap-2">
            {!alreadySaved && (
              <Button
                onClick={onSave}
                disabled={isSaving}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Check className="w-4 h-4" />
                {isSaving ? "Salvando..." : "Salvar análise"}
              </Button>
            )}
            <Button
              onClick={onApplyToBrandKit}
              disabled={isApplying}
              className="flex-1 gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Palette className="w-4 h-4" />
              {isApplying ? "Aplicando..." : "Aplicar ao Brand Kit"}
            </Button>
          </div>
          <Button
            onClick={onSaveAsTemplate}
            disabled={savedAsTemplate}
            variant="outline"
            className="w-full gap-2 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-500/10 dark:border-emerald-500/30"
          >
            <Layers className="w-4 h-4" />
            {savedAsTemplate ? "Template salvo no carrossel ✓" : "Salvar como template de carrossel"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  isActive,
  onClick,
  onDelete,
}: {
  profile: SavedProfile;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const analysis = (() => {
    try { return JSON.parse(profile.analysisJson) as Partial<InstagramStyleResult>; } catch { return {}; }
  })();

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
        isActive
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50 border border-transparent"
      )}
    >
      {profile.profilePictureUrl ? (
        <img
          src={profile.profilePictureUrl}
          alt={profile.profileHandle}
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-border/30"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 border border-border/30"
          style={{ backgroundColor: analysis.accentColor ?? "#6366f1" }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{profile.profileHandle}</div>
        <div className="text-[11px] text-muted-foreground truncate">{analysis.niche ?? profile.source}</div>
      </div>
      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function StyleAnalyzer() {
  const [mode, setMode] = useState<Mode>("list");
  const [username, setUsername] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [currentResult, setCurrentResult] = useState<InstagramStyleResult | null>(null);
  const [currentSource, setCurrentSource] = useState<"api" | "scrape" | "upload">("scrape");
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [savedAsTemplate, setSavedAsTemplate] = useState(false);

  const utils = trpc.useUtils();

  const { data: savedProfiles = [] } = trpc.styleAnalyzer.list.useQuery();

  const analyzeMutation = trpc.styleAnalyzer.analyze.useMutation({
    onSuccess: (result) => {
      setCurrentResult(result);
      setCurrentSource("scrape");
      setAlreadySaved(false);
      setSavedAsTemplate(false);
      setActiveProfileId(null);
      setMode("result");
    },
    onError: (err) => {
      toast.error(`Erro na análise: ${err.message}`);
    },
  });

  const saveMutation = trpc.styleAnalyzer.save.useMutation({
    onSuccess: () => {
      toast.success("Análise salva!");
      setAlreadySaved(true);
      void utils.styleAnalyzer.list.invalidate();
    },
    onError: () => toast.error("Erro ao salvar análise."),
  });

  const deleteMutation = trpc.styleAnalyzer.delete.useMutation({
    onSuccess: () => {
      toast.success("Análise removida.");
      void utils.styleAnalyzer.list.invalidate();
      if (mode === "viewing") {
        setMode("list");
        setCurrentResult(null);
        setActiveProfileId(null);
      }
    },
    onError: () => toast.error("Erro ao remover."),
  });

  const brandKitMutation = trpc.brandKit.save.useMutation({
    onSuccess: () => toast.success("Cores aplicadas ao Brand Kit!"),
    onError: () => toast.error("Erro ao aplicar ao Brand Kit."),
  });

  const handleAnalyze = () => {
    if (!username.trim()) {
      toast.error("Informe o @username ou URL do perfil.");
      return;
    }
    analyzeMutation.mutate({
      usernameOrUrl: username.trim(),
      ...(uploadedImages.length > 0 ? { uploadedImages } : {}),
    });
  };

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    const remaining = 8 - uploadedImages.length;
    if (remaining <= 0) {
      toast.error("Máximo de 8 imagens atingido.");
      return;
    }
    const toLoad = Array.from(files).slice(0, remaining);
    toLoad.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) setUploadedImages((prev) => [...prev, dataUrl].slice(0, 8));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSave = () => {
    if (!currentResult) return;
    // Strip rawPostImageUrls from saved JSON since CDN URLs expire
    const { rawPostImageUrls: _, ...resultToSave } = currentResult;
    saveMutation.mutate({
      profileHandle: currentResult.profileHandle,
      profileName: currentResult.profileName,
      profilePictureUrl: currentResult.profileImageUrl,
      source: currentSource,
      analysisJson: JSON.stringify(resultToSave),
    });
  };

  const handleApplyToBrandKit = () => {
    if (!currentResult) return;
    brandKitMutation.mutate({
      primaryColor: currentResult.primaryColor,
      secondaryColor: currentResult.secondaryColor,
      accentColor: currentResult.accentColor,
    });
  };

  const handleViewSaved = (profile: SavedProfile) => {
    try {
      const parsed = JSON.parse(profile.analysisJson) as InstagramStyleResult;
      setCurrentResult({ ...parsed, rawPostImageUrls: undefined });
      setCurrentSource(profile.source as "api" | "scrape" | "upload");
      setAlreadySaved(true);
      setActiveProfileId(profile.id);
      setMode("viewing");
      // Check if a carousel template for this profile already exists
      const existingPresets: { presetName: string }[] = JSON.parse(
        localStorage.getItem("proto_named_presets") ?? "[]"
      );
      setSavedAsTemplate(existingPresets.some((p) => p.presetName.startsWith(profile.profileHandle)));
    } catch {
      toast.error("Erro ao carregar análise salva.");
    }
  };

  const handleSaveAsCarouselTemplate = () => {
    if (!currentResult) return;
    const presetName = currentResult.niche
      ? `${currentResult.profileHandle} — ${currentResult.niche}`
      : currentResult.profileHandle;
    const preset = {
      presetName,
      accentColor: currentResult.accentColor,
      bgColor: currentResult.bgColor,
      fontFamily: currentResult.fontFamily,
      titleAlign: currentResult.titleAlign as "left" | "center",
      titleSize: currentResult.titleSize ?? 1,
      profileName: currentResult.profileName,
      profileHandle: currentResult.profileHandle,
      profileImageUrl: currentResult.profileImageUrl,
      coverBgColor: currentResult.coverSlideStyle?.bgColor,
      coverAccentColor: currentResult.coverSlideStyle?.accentColor,
      coverTitleAlign: currentResult.coverSlideStyle?.titleAlign as "left" | "center" | undefined,
      template: "dark" as const,
    };
    try {
      const existing: typeof preset[] = JSON.parse(localStorage.getItem("proto_named_presets") ?? "[]");
      const merged = [...existing.filter((p) => p.presetName !== presetName), preset];
      localStorage.setItem("proto_named_presets", JSON.stringify(merged));
      setSavedAsTemplate(true);
      toast.success(`Template "${presetName}" salvo! Disponível no editor de carrossel.`);
    } catch {
      toast.error("Não foi possível salvar o template.");
    }
  };

  const handleNewAnalysis = () => {
    setMode("new");
    setCurrentResult(null);
    setActiveProfileId(null);
    setAlreadySaved(false);
    setSavedAsTemplate(false);
    setUsername("");
    setUploadedImages([]);
  };

  return (
    <AppLayout activeModule="styleAnalyzer">
      <div className="p-6 h-screen flex flex-col gap-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
            <ScanSearch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Analisador de Estilo</h1>
            <p className="text-xs text-muted-foreground">DNA visual de perfis do Instagram — busca e analisa os posts automaticamente</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left sidebar */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-2">
            <Button
              onClick={handleNewAnalysis}
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nova análise
            </Button>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {savedProfiles.length === 0 && mode !== "new" && (
                <div className="text-center py-8">
                  <ScanSearch className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum perfil analisado ainda</p>
                </div>
              )}
              {savedProfiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  isActive={activeProfileId === p.id}
                  onClick={() => handleViewSaved(p)}
                  onDelete={() => deleteMutation.mutate({ id: p.id })}
                />
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 glass-card rounded-2xl overflow-hidden min-h-0 flex flex-col">

            {/* Empty state */}
            {mode === "list" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                  <ScanSearch className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-foreground mb-1">Analise perfis do Instagram</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Digite um @username e o agente busca os posts automaticamente para analisar cores, tipografia e estratégia de conteúdo.
                  </p>
                </div>
                <Button onClick={handleNewAnalysis} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                  <Plus className="w-4 h-4" />
                  Iniciar análise
                </Button>
              </div>
            )}

            {/* Analysis form */}
            {mode === "new" && (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                <div>
                  <h2 className="font-semibold text-foreground mb-0.5">Nova análise de estilo</h2>
                  <p className="text-xs text-muted-foreground">
                    O agente vai buscar automaticamente os últimos posts do perfil e analisar o DNA visual completo.
                  </p>
                </div>

                {/* Username input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">@username ou URL do perfil</label>
                  <div className="flex gap-2">
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@perfildaempresa ou https://instagram.com/..."
                      className="flex-1"
                      onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                      disabled={analyzeMutation.isPending}
                    />
                  </div>
                </div>

                {/* Info note */}
                <div className="flex gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Esta ferramenta é para referência de estilo e moodboard criativo — não para replicar a identidade de outra marca. Funciona apenas com perfis públicos.
                  </p>
                </div>

                {/* Optional screenshot upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Capturas de tela do perfil <span className="text-muted-foreground font-normal">(opcional)</span>
                    </label>
                    {uploadedImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUploadedImages([])}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Limpar tudo
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adicione até 8 prints do feed para melhorar a extração de cores — especialmente útil para perfis externos.
                  </p>

                  {/* Thumbnails */}
                  {uploadedImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedImages.map((src, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border shadow-sm">
                          <img src={src} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      {uploadedImages.length < 8 && (
                        <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/20 transition-colors">
                          <ImagePlus className="w-5 h-5 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleImageUpload(e.target.files)}
                            disabled={analyzeMutation.isPending}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Drop zone (shown when no images yet) */}
                  {uploadedImages.length === 0 && (
                    <label className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-violet-400 hover:bg-violet-50/20 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground text-center">
                        Clique para adicionar prints do perfil<br />
                        <span className="text-muted-foreground/60">PNG, JPG — até 8 imagens</span>
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImageUpload(e.target.files)}
                        disabled={analyzeMutation.isPending}
                      />
                    </label>
                  )}
                </div>

                {/* Analyze button */}
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending || !username.trim()}
                  className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      Buscando posts e analisando...
                    </>
                  ) : (
                    <>
                      <ScanSearch className="w-4 h-4" />
                      Analisar estilo
                    </>
                  )}
                </Button>

                {analyzeMutation.isPending && (
                  <div className="space-y-1.5 text-center">
                    <p className="text-xs text-muted-foreground">
                      Buscando os posts do perfil e enviando para análise com Claude Vision...
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Pode levar até 40 segundos dependendo do perfil.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Result / viewing panel */}
            {(mode === "result" || mode === "viewing") && currentResult && (
              <ResultPanel
                result={currentResult}
                source={currentSource}
                onSave={handleSave}
                onApplyToBrandKit={handleApplyToBrandKit}
                onSaveAsTemplate={handleSaveAsCarouselTemplate}
                onClose={mode === "viewing" ? () => { setMode("list"); setActiveProfileId(null); } : handleNewAnalysis}
                isSaving={saveMutation.isPending}
                isApplying={brandKitMutation.isPending}
                alreadySaved={alreadySaved}
                savedAsTemplate={savedAsTemplate}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
