import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
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
            <img src={resolveImgUrl(value)} alt="logo" className="w-full h-full object-contain p-1" />
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

function ColorPreview({ primary, secondary, accent, companyName }: { primary: string; secondary: string; accent: string; companyName: string }) {
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: primary }} />
          <div>
            <div className="text-xs font-bold">{companyName || "Nome da Empresa"}</div>
            <div className="text-[10px] text-muted-foreground">Identidade visual da marca</div>
          </div>
        </div>
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
  const { data: saved, isLoading } = trpc.brandKit.get.useQuery();

  const [companyName,    setCompanyName]    = useState("");
  const [tagline,        setTagline]        = useState("");
  const [logoUrl,        setLogoUrl]        = useState("");
  const [industry,       setIndustry]       = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandValues,    setBrandValues]    = useState("");
  const [tone,           setTone]           = useState<Tone>("professional");
  const [primaryColor,   setPrimaryColor]   = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#8b5cf6");
  const [accentColor,    setAccentColor]    = useState("#06b6d4");
  const [instagram,      setInstagram]      = useState("");
  const [linkedin,       setLinkedin]       = useState("");
  const [saved_ok, setSavedOk] = useState(false);

  // Populate from DB on load
  useEffect(() => {
    if (!saved) return;
    if (saved.companyName)    setCompanyName(saved.companyName);
    if (saved.tagline)        setTagline(saved.tagline);
    if (saved.logoUrl)        setLogoUrl(saved.logoUrl);
    if (saved.industry)       setIndustry(saved.industry);
    if (saved.targetAudience) setTargetAudience(saved.targetAudience);
    if (saved.brandValues)    setBrandValues(saved.brandValues);
    if (saved.toneOfVoice)    setTone(saved.toneOfVoice as Tone);
    if (saved.primaryColor)   setPrimaryColor(saved.primaryColor);
    if (saved.secondaryColor) setSecondaryColor(saved.secondaryColor);
    if (saved.accentColor)    setAccentColor(saved.accentColor);
    if (saved.instagramHandle) setInstagram(saved.instagramHandle);
    if (saved.linkedinUrl)    setLinkedin(saved.linkedinUrl);
  }, [saved]);

  const saveMutation = trpc.brandKit.save.useMutation({
    onSuccess: () => {
      toast.success("Brand Kit salvo!");
      utils.brandKit.get.invalidate();
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSave() {
    saveMutation.mutate({
      companyName:    companyName  || undefined,
      tagline:        tagline      || undefined,
      logoUrl:        logoUrl      || undefined,
      industry:       industry     || undefined,
      targetAudience: targetAudience || undefined,
      brandValues:    brandValues  || undefined,
      toneOfVoice:    tone,
      primaryColor:   /^#[0-9a-fA-F]{6}$/.test(primaryColor)   ? primaryColor   : "#6366f1",
      secondaryColor: /^#[0-9a-fA-F]{6}$/.test(secondaryColor) ? secondaryColor : "#8b5cf6",
      accentColor:    /^#[0-9a-fA-F]{6}$/.test(accentColor)    ? accentColor    : "#06b6d4",
      instagramHandle: instagram || undefined,
      linkedinUrl:    linkedin   || undefined,
    });
  }

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
          <Button className="gap-2 font-medium" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved_ok
              ? <Check className="w-4 h-4" />
              : <Save className="w-4 h-4" />}
            {saved_ok ? t("brandSaved") : t("brandSaveBtn")}
          </Button>
        </div>

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
