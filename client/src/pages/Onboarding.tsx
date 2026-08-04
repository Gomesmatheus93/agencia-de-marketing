import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Palette,
  AtSign,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Rocket,
} from "lucide-react";

type Step = "welcome" | "brandkit" | "instagram" | "whatsapp" | "done";

const STEPS: { id: Step; title: string; icon: React.ElementType; color: string }[] = [
  { id: "welcome",   title: "Bem-vindo",    icon: Sparkles,      color: "from-violet-500 to-purple-600" },
  { id: "brandkit",  title: "Brand Kit",    icon: Palette,       color: "from-pink-500 to-rose-500" },
  { id: "instagram", title: "AtSign",    icon: AtSign,     color: "from-orange-500 to-amber-500" },
  { id: "whatsapp",  title: "WhatsApp",     icon: MessageSquare, color: "from-emerald-500 to-teal-500" },
  { id: "done",      title: "Pronto!",      icon: Rocket,        color: "from-blue-500 to-cyan-500" },
];

const STEP_ORDER: Step[] = ["welcome", "brandkit", "instagram", "whatsapp", "done"];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("welcome");
  const [brandName, setBrandName] = useState("");
  const [brandNiche, setBrandNiche] = useState("");
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savedBrand, setSavedBrand] = useState(false);
  const [savedWhatsapp, setSavedWhatsapp] = useState(false);

  const saveBrandMut = trpc.brandKit.save.useMutation({
    onSuccess: () => { setSavedBrand(true); toast.success("Brand Kit salvo!"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const saveWhatsappMut = trpc.articles.saveDigestSettings.useMutation({
    onSuccess: () => { setSavedWhatsapp(true); toast.success("Número salvo!"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const stepIndex = STEP_ORDER.indexOf(step);
  const isFirst = stepIndex === 0;
  const isLast = step === "done";

  function goNext() {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }

  function goPrev() {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  }

  const currentMeta = STEPS.find((s) => s.id === step)!;
  const Icon = currentMeta.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Step progress */}
      <div className="flex items-center gap-1.5 mb-8">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full transition-all",
              s === step ? "w-6 bg-primary" :
              i < stepIndex ? "bg-primary/60" :
              "bg-muted"
            )} />
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
        {/* Gradient header */}
        <div className={cn("bg-gradient-to-br p-8 text-white flex flex-col items-center text-center gap-3", currentMeta.color)}>
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Icon className="w-8 h-8" />
          </div>
          <div>
            <p className="text-white/70 text-sm font-medium">Passo {stepIndex + 1} de {STEP_ORDER.length}</p>
            <h2 className="text-2xl font-bold mt-0.5">{currentMeta.title}</h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 space-y-5">
          {step === "welcome" && (
            <div className="text-center space-y-4">
              <p className="text-foreground font-semibold text-lg">Seja bem-vindo à KrythosLab!</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Vamos configurar sua agência em menos de 3 minutos. Você vai definir sua identidade de marca, conectar seu AtSign e configurar o envio de notícias pelo WhatsApp.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { icon: Palette, label: "Brand Kit" },
                  { icon: AtSign, label: "AtSign" },
                  { icon: MessageSquare, label: "WhatsApp" },
                ].map(({ icon: StepIcon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                    <StepIcon className="w-5 h-5 text-primary" />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "brandkit" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Preencha as informações da sua marca. Isso ajuda a IA a gerar conteúdo com a voz certa.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Nome da marca *</label>
                  <Input
                    placeholder="Ex: Studio Wellness, Clínica Vital..."
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Nicho / Segmento</label>
                  <Input
                    placeholder="Ex: Saúde e bem-estar, Moda, Gastronomia..."
                    value={brandNiche}
                    onChange={(e) => setBrandNiche(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Cor principal da marca</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-12 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                    />
                    <span className="text-sm font-mono text-muted-foreground">{brandColor}</span>
                  </div>
                </div>
              </div>
              {saveBrandMut && brandName.trim() && !savedBrand && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => saveBrandMut.mutate({ companyName: brandName.trim(), industry: brandNiche.trim(), primaryColor: brandColor })}
                  disabled={saveBrandMut.isPending}
                >
                  {saveBrandMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Brand Kit
                </Button>
              )}
              {savedBrand && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Brand Kit salvo com sucesso!
                </div>
              )}
              {!saveBrandMut && (
                <p className="text-xs text-muted-foreground">Você pode configurar o Brand Kit completo em Configurações → Brand Kit.</p>
              )}
            </div>
          )}

          {step === "instagram" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conecte sua conta do AtSign para ver métricas, agendar posts e monitorar engajamento diretamente na plataforma.
              </p>
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-2">
                <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">Como conectar:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Vá em <strong>Analytics</strong> no menu lateral</li>
                  <li>Clique em "Conectar AtSign"</li>
                  <li>Autorize via Facebook/Meta</li>
                </ol>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { navigate("/dashboard/analytics"); }}
              >
                <AtSign className="w-4 h-4 mr-2" />
                Ir para Analytics → Conectar agora
              </Button>
              <button
                onClick={goNext}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline text-center"
              >
                Pular por enquanto
              </button>
            </div>
          )}

          {step === "whatsapp" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure seu número do WhatsApp para receber o digest diário de notícias do seu nicho, automaticamente.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Número do WhatsApp (com DDI)</label>
                <Input
                  type="tel"
                  placeholder="+55 11 99999-9999"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Use o formato internacional: +55 seguido do DDD e número.</p>
              </div>
              {saveWhatsappMut && whatsappNumber.trim() && !savedWhatsapp && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => saveWhatsappMut.mutate({ whatsappNumber: whatsappNumber.replace(/\D/g, ""), digestHour: 8, digestMinute: 0, enabled: true })}
                  disabled={saveWhatsappMut.isPending}
                >
                  {saveWhatsappMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar número
                </Button>
              )}
              {savedWhatsapp && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Número configurado! Configure o horário de envio em Configurações.
                </div>
              )}
              {!saveWhatsappMut && (
                <p className="text-xs text-muted-foreground">Configure o número em Configurações → WhatsApp Digest.</p>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto">
                <Rocket className="w-10 h-10 text-blue-500" />
              </div>
              <div>
                <p className="text-foreground font-semibold text-lg">Tudo pronto!</p>
                <p className="text-muted-foreground text-sm leading-relaxed mt-1">
                  Sua agência está configurada. Comece gerando imagens, criando artigos ou conectando seu AtSign para ver suas métricas.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { label: "Gerar imagem", path: "/dashboard/images" },
                  { label: "Criar artigo", path: "/dashboard/articles" },
                  { label: "Ver Analytics", path: "/dashboard/analytics" },
                  { label: "Criar campanha", path: "/dashboard/campaign" },
                ].map(({ label, path }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="py-2.5 px-3 rounded-xl bg-muted/50 border border-border hover:bg-muted hover:border-primary/40 text-sm font-medium text-foreground transition-all text-left"
                  >
                    {label} →
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between">
          {!isFirst ? (
            <Button variant="ghost" onClick={goPrev} disabled={step === "done"}>
              <ArrowLeft className="w-4 h-4 mr-1" />Voltar
            </Button>
          ) : (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Pular tudo
            </button>
          )}

          {!isLast ? (
            <Button onClick={goNext}>
              {step === "instagram" || step === "whatsapp" ? "Próximo" : "Continuar"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => navigate("/dashboard")}>
              <Rocket className="w-4 h-4 mr-1" />
              Ir para o Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
