import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { SafeImage } from "@/components/SafeImage";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePlan } from "@/_core/hooks/usePlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Trash2,
  Star,
  Palette,
  Building2,
  Megaphone,
  Save,
  Loader2,
  Upload,
  Image as ImageIcon,
  AtSign,
  Globe,
  Check,
  Type,
  Target,
  Users,
  MessageSquareText,
} from "lucide-react";

// Routes any image URL through the server proxy to avoid S3/CORS issues
function resolveImgUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:")) return url;
  if (/^https?:\/\//i.test(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  if (url.startsWith("/uploads/")) return `/api/image-proxy?url=${encodeURIComponent(window.location.origin + url)}`;
  return url;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tone = "professional" | "casual" | "inspiring" | "educational";

const TONE_OPTIONS: { value: Tone; label: string; desc: string }[] = [
  { value: "professional", label: "Profissional",  desc: "Direto, técnico e confiável" },
  { value: "casual",       label: "Casual",         desc: "Próximo, humano e descontraído" },
  { value: "inspiring",    label: "Inspirador",     desc: "Motivacional e com propósito" },
  { value: "educational",  label: "Educativo",      desc: "Informativo e didático" },
];

const INDUSTRY_OPTIONS = [
  "Agência de Marketing",
  "Alimentação e Bebidas",
  "Arquitetura e Design",
  "Beleza e Estética",
  "Consultoria",
  "E-commerce",
  "Educação",
  "Fitness e Saúde",
  "Imobiliário",
  "Jurídico",
  "Moda e Vestuário",
  "Odontologia",
  "Saúde e Medicina",
  "Tecnologia",
  "Turismo e Hospitalidade",
  "Outro",
];

const FONT_OPTIONS = ["Inter", "Montserrat", "Poppins", "Roboto", "Lato", "Playfair Display", "Merriweather", "Oswald", "Raleway", "Nunito"];
type BrandPersona = { name: string; profile: string; pains: string; goals: string; objections: string };
const emptyPersona = (): BrandPersona => ({ name: "", profile: "", pains: "", goals: "", objections: "" });

function parseWordList(value: string) {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

// ── Color Picker ──────────────────────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border border-border p-0.5 bg-transparent"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="font-mono text-sm h-9 w-28"
          maxLength={7}
          placeholder="#000000"
        />
        <div
          className="w-9 h-9 rounded-lg border border-border flex-shrink-0 shadow-sm"
          style={{ backgroundColor: value }}
        />
      </div>
    </div>
  );
}

// ── Logo Upload ───────────────────────────────────────────────────────────────

function LogoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagem muito grande. Máx 10MB"); return; }
    setUploading(true);
    try {
      // Try presigned upload first
      let url: string | null = null;
      try {
        const res = await fetch("/api/request-presigned-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type }),
          credentials: "include",
        });
        if (res.ok) {
          const { presignedUrl, publicUrl } = await res.json() as { presignedUrl: string | null; publicUrl: string };
          if (presignedUrl) {
            const put = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
            if (put.ok) url = publicUrl;
          }
        }
      } catch { /* fallback */ }

      if (!url) {
        const res = await fetch("/api/upload-media", { method: "POST", headers: { "Content-Type": file.type }, body: file, credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        ({ url } = await res.json() as { url: string });
      }

      onChange(url!);
      toast.success("Logo enviada!");
    } catch (e) {
      toast.error("Erro ao enviar logo: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Logo da empresa</label>
      <div className="flex items-start gap-3">
        {/* Preview */}
        <div
          className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/20 overflow-hidden flex-shrink-0 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          {value ? (
            <SafeImage src={resolveImgUrl(value)} alt="logo" className="w-full h-full object-contain p-1" />
          ) : (
            uploading
              ? <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              : <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://empresa.com/logo.png ou faça upload"
            className="text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 h-8 text-xs"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploading ? "Enviando..." : "Upload de arquivo"}
          </Button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

// ── Color Preview Strip ───────────────────────────────────────────────────────

function ColorPreview({ primary, secondary, accent, companyName, headingFont, bodyFont, cta }: { primary: string; secondary: string; accent: string; companyName: string; headingFont: string; bodyFont: string; cta: string }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header bar */}
      <div className="h-10 flex items-center px-4 gap-3" style={{ backgroundColor: primary }}>
        <div className="w-4 h-4 rounded-full bg-white/30" />
        <div className="h-2 w-24 rounded-full bg-white/50" />
        <div className="ml-auto h-6 px-3 rounded-md text-[10px] font-semibold flex items-center" style={{ backgroundColor: accent, color: "#fff" }}>
          CTA
        </div>
      </div>
      {/* Content area */}
      <div className="p-4 bg-background space-y-2.5">
        <div className="flex items-center gap-2" style={{ fontFamily: bodyFont }}>
          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: primary }} />
          <div>
            <div className="text-xs font-bold" style={{ fontFamily: headingFont }}>{companyName || "Nome da Empresa"}</div>
            <div className="text-[10px] text-muted-foreground">Identidade visual da marca</div>
          </div>
        </div>
        <div className="rounded-lg p-3 text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, fontFamily: bodyFont }}><p className="text-sm font-bold" style={{ fontFamily: headingFont }}>{companyName || "Sua marca"}</p><p className="mt-1 text-[9px] text-white/75">Uma mensagem consistente para o público certo.</p><span className="mt-2 inline-flex rounded px-2 py-1 text-[8px] font-semibold" style={{ backgroundColor: accent }}>{cta || "Saiba mais"}</span></div>
        <div className="flex gap-2">
          {[primary, secondary, accent].map((c, i) => (
            <div key={i} className="flex-1 h-6 rounded-md text-[9px] font-mono text-white flex items-center justify-center shadow-sm" style={{ backgroundColor: c }}>
              {c.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BrandKitPage() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const { plan } = usePlan();
  const { data: kits = [], isLoading } = trpc.brandKit.list.useQuery();
  const { data: active } = trpc.brandKit.getActive.useQuery();

  // A marca selecionada pra edição: um id existente, "new" (rascunho ainda
  // não salvo) ou null (ainda não escolhida — cai no default abaixo).
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const selectedKit = typeof selectedId === "number" ? kits.find((k) => k.id === selectedId) : null;
  const isNewDraft = selectedId === "new";

  const [companyName,    setCompanyName]    = useState("");
  const [tagline,        setTagline]        = useState("");
  const [logoUrl,        setLogoUrl]        = useState("");
  const [industry,       setIndustry]       = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandValues,    setBrandValues]    = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [productsServices, setProductsServices] = useState("");
  const [differentiators, setDifferentiators] = useState("");
  const [brandPromise, setBrandPromise] = useState("");
  const [defaultCta, setDefaultCta] = useState("");
  const [tone,           setTone]           = useState<Tone>("professional");
  const [headingFont, setHeadingFont] = useState("Montserrat");
  const [bodyFont, setBodyFont] = useState("Inter");
  const [preferredWords, setPreferredWords] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  const [personas, setPersonas] = useState<BrandPersona[]>([]);
  const [primaryColor,   setPrimaryColor]   = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#8b5cf6");
  const [accentColor,    setAccentColor]    = useState("#06b6d4");
  const [instagram,      setInstagram]      = useState("");
  const [linkedin,       setLinkedin]       = useState("");
  const [saved_ok, setSavedOk] = useState(false);

  // Escolhe a marca ativa (ou a primeira disponível) assim que a lista carrega.
  useEffect(() => {
    if (isLoading || selectedId !== null) return;
    if (active) { setSelectedId(active.id); return; }
    if (kits.length > 0) { setSelectedId(kits[0].id); return; }
    // Conta sem nenhuma marca ainda (primeiro uso) — abre direto um
    // rascunho editável, igual ao comportamento de antes do multi-brand.
    setSelectedId("new");
  }, [kits, active, selectedId, isLoading]);

  // Repopula o formulário sempre que a marca selecionada muda (reset
  // completo, não só "se tiver valor" — senão campo de uma marca vaza pra
  // outra ao trocar).
  useEffect(() => {
    if (isNewDraft) {
      setCompanyName(""); setTagline(""); setLogoUrl(""); setIndustry("");
      setTargetAudience(""); setBrandValues(""); setTone("professional");
      setValueProposition(""); setProductsServices(""); setDifferentiators(""); setBrandPromise(""); setDefaultCta("");
      setHeadingFont("Montserrat"); setBodyFont("Inter"); setPreferredWords(""); setForbiddenWords(""); setPersonas([]);
      setPrimaryColor("#6366f1"); setSecondaryColor("#8b5cf6"); setAccentColor("#06b6d4");
      setInstagram(""); setLinkedin("");
      return;
    }
    if (!selectedKit) return;
    setCompanyName(selectedKit.companyName ?? "");
    setTagline(selectedKit.tagline ?? "");
    setLogoUrl(selectedKit.logoUrl ?? "");
    setIndustry(selectedKit.industry ?? "");
    setTargetAudience(selectedKit.targetAudience ?? "");
    setBrandValues(selectedKit.brandValues ?? "");
    setValueProposition(selectedKit.valueProposition ?? "");
    setProductsServices(selectedKit.productsServices ?? "");
    setDifferentiators(selectedKit.differentiators ?? "");
    setBrandPromise(selectedKit.brandPromise ?? "");
    setDefaultCta(selectedKit.defaultCta ?? "");
    setTone((selectedKit.toneOfVoice as Tone) ?? "professional");
    setHeadingFont(selectedKit.headingFont ?? "Montserrat");
    setBodyFont(selectedKit.bodyFont ?? "Inter");
    setPreferredWords((selectedKit.preferredWords ?? []).join(", "));
    setForbiddenWords((selectedKit.forbiddenWords ?? []).join(", "));
    setPersonas((selectedKit.personas ?? []) as BrandPersona[]);
    setPrimaryColor(selectedKit.primaryColor ?? "#6366f1");
    setSecondaryColor(selectedKit.secondaryColor ?? "#8b5cf6");
    setAccentColor(selectedKit.accentColor ?? "#06b6d4");
    setInstagram(selectedKit.instagramHandle ?? "");
    setLinkedin(selectedKit.linkedinUrl ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKit?.id, isNewDraft]);

  function invalidateBrandKits() {
    utils.brandKit.list.invalidate();
    utils.brandKit.getActive.invalidate();
    utils.brandKit.get.invalidate();
  }

  const createMutation = trpc.brandKit.create.useMutation({
    onSuccess: (created) => {
      toast.success("Marca criada!");
      invalidateBrandKits();
      setSelectedId(created.id);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.brandKit.update.useMutation({
    onSuccess: () => {
      toast.success("Brand Kit salvo!");
      invalidateBrandKits();
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    },
    onError: (e) => toast.error(e.message),
  });

  const setActiveMutation = trpc.brandKit.setActive.useMutation({
    onSuccess: () => {
      toast.success("Marca ativa atualizada.");
      invalidateBrandKits();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.brandKit.delete.useMutation({
    onSuccess: () => {
      toast.success("Marca removida.");
      invalidateBrandKits();
      setSelectedId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const saveMutation = isNewDraft ? createMutation : updateMutation;

  function handleSave() {
    const payload = {
      companyName:    companyName  || undefined,
      tagline:        tagline      || undefined,
      logoUrl:        logoUrl      || undefined,
      industry:       industry     || undefined,
      targetAudience: targetAudience || undefined,
      brandValues:    brandValues  || undefined,
      valueProposition: valueProposition || undefined,
      productsServices: productsServices || undefined,
      differentiators: differentiators || undefined,
      brandPromise: brandPromise || undefined,
      defaultCta: defaultCta || undefined,
      toneOfVoice:    tone,
      headingFont,
      bodyFont,
      preferredWords: parseWordList(preferredWords),
      forbiddenWords: parseWordList(forbiddenWords),
      personas: personas.filter((persona) => persona.name.trim()),
      primaryColor:   /^#[0-9a-fA-F]{6}$/.test(primaryColor)   ? primaryColor   : "#6366f1",
      secondaryColor: /^#[0-9a-fA-F]{6}$/.test(secondaryColor) ? secondaryColor : "#8b5cf6",
      accentColor:    /^#[0-9a-fA-F]{6}$/.test(accentColor)    ? accentColor    : "#06b6d4",
      instagramHandle: instagram || undefined,
      linkedinUrl:    linkedin   || undefined,
    };
    if (isNewDraft) {
      createMutation.mutate(payload);
    } else if (typeof selectedId === "number") {
      updateMutation.mutate({ id: selectedId, ...payload });
    }
  }

  function handleNewBrand() {
    if (kits.length >= 1 && plan !== "agency") {
      toast.error("Gerenciar várias marcas é um recurso do plano Agency. Fale com o time pra fazer upgrade.");
      return;
    }
    setSelectedId("new");
  }

  const completionFields = [companyName, logoUrl, industry, tagline, primaryColor, targetAudience, brandValues, valueProposition, productsServices, differentiators, defaultCta, headingFont, bodyFont, preferredWords, personas.length ? "personas" : ""];
  const completion = Math.round(completionFields.filter((value) => String(value).trim()).length / completionFields.length * 100);

  if (isLoading) {
    return (
      <AppLayout activeModule="brand">
        <div className="p-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeModule="brand">
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md flex-shrink-0">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t("brandTitle")}</h1>
              <p className="text-xs text-muted-foreground">
                {t("brandSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNewDraft && selectedKit && active?.id !== selectedKit.id && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setActiveMutation.mutate({ id: selectedKit.id })}
                disabled={setActiveMutation.isPending}
              >
                <Star className="w-4 h-4" />
                Definir como ativa
              </Button>
            )}
            <Button className="gap-2 font-medium" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : saved_ok
                ? <Check className="w-4 h-4" />
                : <Save className="w-4 h-4" />}
              {saved_ok ? t("brandSaved") : t("brandSaveBtn")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/[.07] to-violet-500/[.04] p-4">
          <div className="mb-2 flex items-center justify-between gap-4"><div><p className="text-sm font-semibold">Qualidade do perfil da marca</p><p className="mt-0.5 text-xs text-muted-foreground">Quanto mais completo, mais consistentes serão as campanhas e os conteúdos.</p></div><span className="text-xl font-bold text-primary">{completion}%</span></div>
          <Progress value={completion} className="h-2" />
          {completion < 70 && <p className="mt-2 text-[11px] text-muted-foreground">Próximo passo recomendado: {!valueProposition ? "defina a proposta de valor" : !targetAudience ? "detalhe o público-alvo" : !personas.length ? "adicione ao menos uma persona" : "complete as diretrizes de linguagem"}.</p>}
        </div>

        {/* Brand switcher — só aparece depois que já existe pelo menos 1 marca */}
        {(kits.length > 0 || isNewDraft) && (
          <div className="flex items-center gap-2 flex-wrap">
            {kits.map((kit) => (
              <button
                key={kit.id}
                onClick={() => setSelectedId(kit.id)}
                className={cn(
                  "flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  selectedId === kit.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted"
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-black/10"
                  style={{ backgroundColor: kit.primaryColor ?? "#6366f1" }}
                />
                {kit.companyName || "Sem nome"}
                {active?.id === kit.id && <Star className="w-3 h-3 fill-current flex-shrink-0" />}
              </button>
            ))}
            {isNewDraft && (
              <span className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-sm font-medium border border-primary bg-primary/10 text-primary">
                Nova marca (rascunho)
              </span>
            )}
            <button
              onClick={handleNewBrand}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova marca
            </button>
            {!isNewDraft && selectedKit && kits.length > 1 && (
              <button
                onClick={() => {
                  if (confirm(`Excluir a marca "${selectedKit.companyName || "sem nome"}"? Essa ação não pode ser desfeita.`)) {
                    deleteMutation.mutate({ id: selectedKit.id });
                  }
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm text-muted-foreground hover:text-destructive transition-colors"
                title="Excluir marca"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

          {/* Left column — form */}
          <div className="space-y-5">

            {/* 1. Identidade */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Identidade da Marca
              </h2>

              <LogoUpload value={logoUrl} onChange={setLogoUrl} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome da empresa *</label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Krythos Lab" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Setor / Indústria</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Selecione o setor</option>
                    {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tagline / Slogan</label>
                <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Ex: Transformando ideias em resultados" maxLength={150} />
              </div>
            </div>

            {/* 2. Cores */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                Paleta de Cores
              </h2>
              <p className="text-xs text-muted-foreground -mt-2">
                Estas cores são injetadas automaticamente nos prompts de geração de imagem.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ColorField label="Cor primária"   value={primaryColor}   onChange={setPrimaryColor} />
                <ColorField label="Cor secundária" value={secondaryColor} onChange={setSecondaryColor} />
                <ColorField label="Cor de destaque" value={accentColor}   onChange={setAccentColor} />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Type className="w-4 h-4 text-muted-foreground" />Tipografia</h2>
              <p className="text-xs text-muted-foreground -mt-2">Define a aparência dos títulos e textos nas aplicações da marca.</p>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Fonte de títulos</label><select value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">{FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}</select><p className="rounded-lg border p-3 text-lg font-bold" style={{ fontFamily: headingFont }}>{companyName || "Título da marca"}</p></div><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Fonte de textos</label><select value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">{FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}</select><p className="rounded-lg border p-3 text-xs leading-relaxed" style={{ fontFamily: bodyFont }}>Uma comunicação clara, consistente e reconhecível em todos os canais.</p></div></div>
            </div>

            {/* 3. Voz e Comunicação */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-muted-foreground" />
                Voz e Comunicação
              </h2>

              {/* Tone of voice */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Tom de voz da marca</label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      className={cn(
                        "text-left px-3 py-2.5 rounded-xl border transition-all",
                        tone === t.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-accent/50"
                      )}
                    >
                      <div className={cn("text-xs font-semibold", tone === t.value ? "text-primary" : "text-foreground")}>
                        {t.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Público-alvo</label>
                <Textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Ex: Empresários e gestores de PMEs entre 30-50 anos que buscam automatizar o marketing digital..."
                  rows={3}
                  className="resize-none text-sm"
                  maxLength={1000}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Valores e diferenciais da marca</label>
                <Textarea
                  value={brandValues}
                  onChange={(e) => setBrandValues(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  maxLength={1000}
                />
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-muted-foreground" />Posicionamento comercial</h2>
              <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Proposta de valor</label><Textarea value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} rows={3} placeholder="Por que o cliente deve escolher esta marca?" /></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Produtos e serviços principais</label><Textarea value={productsServices} onChange={(e) => setProductsServices(e.target.value)} rows={3} placeholder="Liste as principais ofertas" /></div><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Diferenciais competitivos</label><Textarea value={differentiators} onChange={(e) => setDifferentiators(e.target.value)} rows={3} placeholder="O que a marca faz melhor?" /></div></div>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Promessa da marca</label><Input value={brandPromise} onChange={(e) => setBrandPromise(e.target.value)} placeholder="Resultado que a marca promete" /></div><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">CTA padrão</label><Input value={defaultCta} onChange={(e) => setDefaultCta(e.target.value)} placeholder="Ex: Fale com um especialista" /></div></div>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><MessageSquareText className="w-4 h-4 text-muted-foreground" />Diretrizes de linguagem</h2>
              <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Palavras preferidas</label><Textarea value={preferredWords} onChange={(e) => setPreferredWords(e.target.value)} rows={3} placeholder="inovação, proximidade, resultado..." /><p className="text-[10px] text-muted-foreground">Separe por vírgulas ou linhas.</p></div><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Palavras proibidas</label><Textarea value={forbiddenWords} onChange={(e) => setForbiddenWords(e.target.value)} rows={3} placeholder="barato, imperdível, garantido..." /><p className="text-[10px] text-muted-foreground">A IA deverá evitar estes termos.</p></div></div>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />Personas</h2><p className="mt-1 text-xs text-muted-foreground">Perfis usados para direcionar campanhas e conteúdos.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setPersonas((current) => [...current, emptyPersona()])} disabled={personas.length >= 8}><Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar</Button></div>
              {personas.length === 0 ? <button type="button" onClick={() => setPersonas([emptyPersona()])} className="w-full rounded-xl border border-dashed p-5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">Adicione uma persona para tornar as gerações menos genéricas.</button> : <div className="space-y-3">{personas.map((persona, index) => <div key={index} className="rounded-xl border p-4 space-y-3"><div className="flex items-center gap-2"><Input value={persona.name} onChange={(e) => setPersonas((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} placeholder="Nome da persona, ex: Gestora Ana" className="font-medium" /><Button type="button" variant="ghost" size="icon" onClick={() => setPersonas((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div><div className="grid gap-3 sm:grid-cols-2"><Textarea value={persona.profile} onChange={(e) => setPersonas((current) => current.map((item, i) => i === index ? { ...item, profile: e.target.value } : item))} rows={2} placeholder="Perfil, idade, cargo e contexto" /><Textarea value={persona.pains} onChange={(e) => setPersonas((current) => current.map((item, i) => i === index ? { ...item, pains: e.target.value } : item))} rows={2} placeholder="Principais dores" /><Textarea value={persona.goals} onChange={(e) => setPersonas((current) => current.map((item, i) => i === index ? { ...item, goals: e.target.value } : item))} rows={2} placeholder="Objetivos e desejos" /><Textarea value={persona.objections} onChange={(e) => setPersonas((current) => current.map((item, i) => i === index ? { ...item, objections: e.target.value } : item))} rows={2} placeholder="Objeções de compra" /></div></div>)}</div>}
            </div>

            {/* 4. Redes Sociais */}
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                Redes Sociais
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <AtSign className="w-3.5 h-3.5" />
                    Instagram
                  </label>
                  <Input
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                    placeholder="@empresa"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    LinkedIn
                  </label>
                  <Input
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="linkedin.com/company/empresa"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right column — live preview */}
          <div className="space-y-4 lg:sticky lg:top-4">
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</p>
              <ColorPreview
                primary={primaryColor}
                secondary={secondaryColor}
                accent={accentColor}
                companyName={companyName}
                headingFont={headingFont}
                bodyFont={bodyFont}
                cta={defaultCta}
              />

              {/* Brand summary */}
              <div className="space-y-2 pt-1">
                {logoUrl && (
                  <div className="flex items-center gap-2">
                    <img
                      src={resolveImgUrl(logoUrl)}
                      alt="logo"
                      className="w-8 h-8 object-contain rounded border border-border"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="text-xs font-medium truncate">{companyName || "Empresa"}</span>
                  </div>
                )}
                {tagline && <p className="text-[11px] text-muted-foreground italic">"{tagline}"</p>}
                {industry && <p className="text-[11px] text-muted-foreground">{industry}</p>}
                {tone && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[11px] text-muted-foreground">
                      Tom: {TONE_OPTIONS.find((t) => t.value === tone)?.label}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Como é usado</p>
              {[
                "Legendas de posts adaptadas à sua voz",
                "Imagens geradas com suas cores",
                "Carrosseis no estilo da marca",
                "Artigos no tom de voz definido",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
