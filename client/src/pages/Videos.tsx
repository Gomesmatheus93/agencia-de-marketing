import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/SafeImage";
import { type ComponentType, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  Copy,
  Download,
  Loader2,
  Mic2,
  PlayCircle,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Wand2,
  X,
  XCircle,
  Zap,
  Lock,
  Video,
  ShieldCheck,
  RefreshCw,
  Film,
} from "lucide-react";
import { usePlan } from "@/_core/hooks/usePlan";

async function uploadFileToStorage(file: File): Promise<string> {
  const presignRes = await fetch("/api/request-presigned-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type }),
    credentials: "include",
  });
  if (!presignRes.ok) throw new Error("Falha ao preparar o upload.");
  const { presignedUrl, publicUrl } = (await presignRes.json()) as { presignedUrl: string | null; publicUrl: string };
  if (!presignedUrl) throw new Error("Upload direto não configurado (defina PUBLIC_STORAGE_PROVIDER=aws no servidor).");
  const putRes = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Falha ao enviar o arquivo.");
  return publicUrl;
}

type DigitalTwinStatusData =
  | { exists: false }
  | {
      exists: true;
      name: string | null;
      status: "pending_consent" | "training" | "ready" | "failed";
      errorMessage: string | null;
    };

function DigitalTwinVideoInput({
  label,
  hint,
  file,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-all duration-200",
          disabled ? "opacity-50 cursor-not-allowed" : "border-border/40 hover:border-border hover:bg-accent/30"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-rose-500">
          <Video className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file ? file.name : "Escolher arquivo"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        {file && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="h-7 w-7 shrink-0 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}

// Abre uma aba em branco de forma síncrona (dentro do clique do usuário, pra não ser
// bloqueada como pop-up) e só navega ela pra URL real depois que a chamada assíncrona
// à HeyGen retornar o link de consentimento.
function openConsentTabWhenReady(loadUrl: () => Promise<string>, onError: (err: unknown) => void) {
  const tab = window.open("", "_blank");
  loadUrl()
    .then((url) => {
      if (tab) tab.location.href = url;
    })
    .catch((err) => {
      tab?.close();
      onError(err);
    });
}

function DigitalTwinPanel({ useTwin, onUseTwinChange }: { useTwin: boolean; onUseTwinChange: (value: boolean) => void }) {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const statusQuery = trpc.videos.getDigitalTwinStatus.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data as DigitalTwinStatusData | undefined;
      return data?.exists && (data.status === "training" || data.status === "pending_consent") ? 15000 : false;
    },
  });

  const createMutation = trpc.videos.createDigitalTwin.useMutation();

  const deleteMutation = trpc.videos.deleteDigitalTwin.useMutation({
    onSuccess: () => {
      toast.success("Avatar 3D removido.");
      onUseTwinChange(false);
      void utils.videos.getDigitalTwinStatus.invalidate();
    },
  });

  const consentUrlMutation = trpc.videos.getDigitalTwinConsentUrl.useMutation();

  const handleOpenConsent = () => {
    openConsentTabWhenReady(
      () => consentUrlMutation.mutateAsync().then((r) => r.consentUrl),
      (err) => toast.error(err instanceof Error ? err.message : "Falha ao gerar o link de consentimento.")
    );
  };

  const handleCreate = () => {
    if (!name.trim()) { toast.error("Dê um nome para o seu Avatar 3D."); return; }
    if (!trainingFile) { toast.error("Envie o vídeo de treino (pelo menos 15 segundos)."); return; }

    const nameValue = name.trim();
    const fileValue = trainingFile;

    openConsentTabWhenReady(
      async () => {
        setUploading(true);
        const videoUrl = await uploadFileToStorage(fileValue).finally(() => setUploading(false));
        const result = await createMutation.mutateAsync({ name: nameValue, videoUrl });
        toast.success("Vídeo de treino enviado! Agora grave o consentimento na aba que acabou de abrir.");
        setTrainingFile(null);
        setName("");
        setShowForm(false);
        void utils.videos.getDigitalTwinStatus.invalidate();
        return result.consentUrl;
      },
      (err) => toast.error(err instanceof Error ? err.message : "Falha ao criar o Avatar 3D.")
    );
  };

  const data = statusQuery.data as DigitalTwinStatusData | undefined;
  const busy = uploading || createMutation.isPending;

  return (
    <div className="glass-card space-y-4 p-6 animate-fade-in-up">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-md">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Avatar 3D (Digital Twin)</h2>
            <p className="text-xs text-muted-foreground">Treinado a partir de um vídeo seu — corpo inteiro, gestos e movimento naturais, não só a boca.</p>
          </div>
        </div>
        {data?.exists && data.status !== "ready" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            title="Excluir este avatar e começar outro"
            className="h-8 w-8 shrink-0 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {(!data || !data.exists) && !statusQuery.isLoading && !showForm && (
        <Button type="button" variant="outline" onClick={() => setShowForm(true)} className="gap-2 glass border-border/50">
          <Sparkles className="w-4 h-4" />
          Criar meu Avatar 3D
        </Button>
      )}

      {data?.exists && data.status === "failed" && !showForm && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 w-4 h-4 flex-shrink-0" />
            <span>{data.errorMessage || "O treinamento do avatar falhou."}</span>
          </div>
          <Button type="button" variant="outline" onClick={() => setShowForm(true)} className="gap-2 glass border-border/50">
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {data?.exists && (data.status === "pending_consent" || data.status === "training") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            <span>
              {data.status === "pending_consent" ? "Validando consentimento…" : "Treinando seu Avatar 3D…"}{" "}
              Isso geralmente leva de 10 a 20 minutos. Pode continuar usando o app normalmente.
            </span>
          </div>

          {data.status === "pending_consent" && (
            <div className="space-y-2 rounded-xl border border-border/40 p-3">
              {data.errorMessage && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="mt-0.5 w-3.5 h-3.5 flex-shrink-0" />
                  <span>{data.errorMessage}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A HeyGen exige que você grave o consentimento ao vivo pela webcam, direto no site deles.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleOpenConsent}
                disabled={consentUrlMutation.isPending}
                className="gap-2 bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white border-0 hover:opacity-90"
              >
                {consentUrlMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Gerando link…</> : <><ShieldCheck className="w-3.5 h-3.5" />Gravar consentimento pela webcam</>}
              </Button>
            </div>
          )}
        </div>
      )}

      {data?.exists && data.status === "ready" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/40 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-foreground">{data.name || "Meu Avatar 3D"}</p>
                <p className="text-xs text-muted-foreground">Pronto para uso</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useTwin} onChange={(e) => onUseTwinChange(e.target.checked)} className="h-4 w-4 rounded border-border/50" />
            <span className="text-sm text-foreground">Usar meu Avatar 3D neste vídeo (em vez de subir uma foto)</span>
          </label>
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-xl border border-border/40 p-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Nome do avatar</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Meu avatar principal" className="glass border-border/50" disabled={busy} />
          </div>

          <DigitalTwinVideoInput
            label="Vídeo de treino"
            hint="Mínimo 15 segundos, bem iluminado, fundo simples, sua voz falando naturalmente."
            file={trainingFile}
            onChange={setTrainingFile}
            disabled={busy}
          />

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 w-3.5 h-3.5 flex-shrink-0" />
            <span>Depois de enviar o vídeo de treino, uma aba vai abrir pra você gravar o consentimento ao vivo pela webcam, direto no site da HeyGen.</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)} disabled={busy}>Cancelar</Button>
            <Button type="button" onClick={handleCreate} disabled={busy} className="gap-2 bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white border-0 hover:opacity-90">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" />{uploading ? "Enviando vídeo…" : "Criando…"}</> : <><Sparkles className="w-4 h-4" />Criar Avatar 3D</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type AvatarVideoStatus = "processing" | "completed" | "failed";
type Provider = "heygen";

type AvatarVideo = {
  id: number;
  title: string;
  topic: string | null;
  script: string;
  sourceImageUrl: string;
  videoUrl: string | null;
  voiceProvider: string | null;
  voiceId: string | null;
  status: AvatarVideoStatus;
  errorMessage: string | null;
  createdAt: Date;
};

const AVATAR_CANVAS_WIDTH = 1080;
const AVATAR_CANVAS_HEIGHT = 1920;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = () => reject(new Error("Nao consegui ler a imagem enviada."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Nao consegui preparar a imagem para o avatar."));
    image.src = src;
  });
}

async function createPortraitAvatarDataUrl(file: File) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_CANVAS_WIDTH;
  canvas.height = AVATAR_CANVAS_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Nao consegui preparar o canvas da imagem.");

  const coverScale = Math.max(AVATAR_CANVAS_WIDTH / image.width, AVATAR_CANVAS_HEIGHT / image.height);
  const coverWidth = image.width * coverScale;
  const coverHeight = image.height * coverScale;
  const coverX = (AVATAR_CANVAS_WIDTH - coverWidth) / 2;
  const coverY = (AVATAR_CANVAS_HEIGHT - coverHeight) / 2;

  context.save();
  context.filter = "blur(30px) brightness(0.78)";
  context.drawImage(image, coverX, coverY, coverWidth, coverHeight);
  context.restore();

  const gradient = context.createLinearGradient(0, 0, 0, AVATAR_CANVAS_HEIGHT);
  gradient.addColorStop(0, "rgba(15, 23, 42, 0.22)");
  gradient.addColorStop(1, "rgba(15, 23, 42, 0.08)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, AVATAR_CANVAS_WIDTH, AVATAR_CANVAS_HEIGHT);

  const foregroundScale = Math.min(
    (AVATAR_CANVAS_WIDTH * 0.9) / image.width,
    (AVATAR_CANVAS_HEIGHT * 0.88) / image.height
  );
  const foregroundWidth = image.width * foregroundScale;
  const foregroundHeight = image.height * foregroundScale;
  const foregroundX = (AVATAR_CANVAS_WIDTH - foregroundWidth) / 2;
  const foregroundY = AVATAR_CANVAS_HEIGHT - foregroundHeight - AVATAR_CANVAS_HEIGHT * 0.04;

  context.drawImage(image, foregroundX, foregroundY, foregroundWidth, foregroundHeight);
  return canvas.toDataURL("image/png");
}

const toneOptions = [
  { value: "professional", label: "Profissional" },
  { value: "casual", label: "Casual" },
  { value: "inspiring", label: "Inspirador" },
  { value: "educational", label: "Educativo" },
] as const;

const statusConfig: Record<AvatarVideoStatus, { label: string; className: string; icon: ComponentType<{ className?: string }> }> = {
  processing: { label: "Gerando", className: "text-amber-700 bg-amber-50 dark:bg-amber-950/30", icon: Loader2 },
  completed: { label: "Pronto", className: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle2 },
  failed: { label: "Falhou", className: "text-red-700 bg-red-50 dark:bg-red-950/30", icon: XCircle },
};

function SourceImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Use uma imagem JPG ou PNG para o avatar.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no maximo 10MB");
      return;
    }
    createPortraitAvatarDataUrl(file)
      .then(onChange)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Nao consegui preparar a imagem."));
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/50 p-3 glass">
        <div className="h-16 w-16 overflow-hidden rounded-lg flex-shrink-0">
          <img src={value} alt="Foto da pessoa" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Foto pronta para o avatar</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Enquadramento ajustado para 9:16 em 1080×1920.</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => inputRef.current?.click()} className="h-8 w-8 rounded-lg">
            <Upload className="w-4 h-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange("")} className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
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
        "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-all duration-200",
        isDragging ? "border-primary bg-primary/5" : "border-border/40 hover:border-border hover:bg-accent/30"
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-sm">
        <UserRound className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Adicionar foto da pessoa</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Clique ou arraste. PNG ou JPG, face visível e bem iluminada.</p>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}

export default function Videos() {
  const { t } = useLanguage();
  const { isLocked } = usePlan();
  const locked = isLocked("videos");
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("professional");
  const provider: Provider = "heygen";
  const [voiceId, setVoiceId] = useState("");
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<AvatarVideo | null>(null);
  const [useDigitalTwin, setUseDigitalTwin] = useState(false);
  // De onde vem o rosto: um avatar que já existe na conta HeyGen ou uma foto nova.
  const [source, setSource] = useState<"account" | "photo">("account");
  const [accountAvatarId, setAccountAvatarId] = useState("");
  const { data: accountAvatars = [], isLoading: loadingAvatars } = trpc.videos.getAccountAvatars.useQuery();

  useEffect(() => {
    const raw = sessionStorage.getItem("videos_script_prefill");
    if (!raw) return;
    try {
      const prefill = JSON.parse(raw) as { script: string };
      sessionStorage.removeItem("videos_script_prefill");
      setScript(prefill.script);
      toast.info("Roteiro do Reels carregado — escolha o avatar e clique em Gerar Vídeo.");
    } catch { /* ignore */ }
  }, []);

  // Sem isso, um vídeo "Gerando..." só atualizava depois de recarregar a
  // página manualmente — a geração pode levar minutos e, se o usuário saiu
  // da tela de Vídeos e voltou (ou está em outra aba/dispositivo), o card
  // ficava travado no status antigo. Mesmo padrão já usado em Carrossel/
  // Artigos: só entra em polling enquanto existir algo de fato processando.
  const { data: videos = [], isLoading } = trpc.videos.getAll.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string }[] | undefined;
      return data?.some((v) => v.status === "processing") ? 10000 : false;
    },
  });

  const [voiceLanguageFilter, setVoiceLanguageFilter] = useState("pt");
  const VOICE_LANGUAGES: Record<string, string> = { pt: "Portuguese", en: "English", es: "Spanish" };

  const { data: heyGenVoicesRaw = [], isLoading: loadingVoices } = trpc.videos.getVoices.useQuery(
    { provider: "heygen", language: VOICE_LANGUAGES[voiceLanguageFilter] },
    { enabled: true }
  );

  const generateScriptMutation = trpc.videos.generateScript.useMutation({
    onSuccess: (data) => {
      setTitle((c) => c || data.title);
      setScript(data.script);
      toast.success("Roteiro gerado com sucesso.");
    },
    onError: (error) => toast.error("Erro ao gerar roteiro: " + error.message),
  });

  const generateVideoMutation = trpc.videos.generate.useMutation({
    onSuccess: () => {
      utils.videos.getAll.invalidate();
      utils.videos.getStats.invalidate();
      toast.success("Vídeo gerado e salvo na plataforma.");
      setTitle(""); setTopic(""); setScript(""); setSourceImageDataUrl("");
    },
    onError: (error) => {
      utils.videos.getAll.invalidate();
      toast.error("Erro ao gerar vídeo: " + error.message);
    },
  });

  const deleteMutation = trpc.videos.delete.useMutation({
    onSuccess: () => {
      utils.videos.getAll.invalidate();
      utils.videos.getStats.invalidate();
      toast.success("Vídeo removido.");
      setSelectedVideo(null);
    },
    onError: (error) => toast.error("Erro ao excluir vídeo: " + error.message),
  });

  const handleGenerateScript = () => {
    if (!topic.trim()) { toast.error("Digite um tema para gerar o roteiro."); return; }
    generateScriptMutation.mutate({ topic: topic.trim(), tone });
  };

  const activeUseDigitalTwin = useDigitalTwin && provider === "heygen";
  const activeAccountAvatar = !activeUseDigitalTwin && source === "account" ? accountAvatars.find((a) => a.id === accountAvatarId) : undefined;
  const needsPhoto = !activeUseDigitalTwin && !activeAccountAvatar;
  // O avatar da conta já pode ter uma voz própria; então escolher voz é opcional.
  const needsVoice = provider === "heygen" && !voiceId && !activeAccountAvatar?.defaultVoiceId;

  const handleGenerateVideo = () => {
    if (!script.trim()) { toast.error("Escreva ou gere um roteiro antes de criar o vídeo."); return; }
    if (needsPhoto && !sourceImageDataUrl) { toast.error(source === "account" ? "Escolha um avatar da conta." : "Adicione a foto da pessoa para gerar o avatar."); return; }
    if (needsVoice) { toast.error("Selecione uma voz para continuar."); return; }

    generateVideoMutation.mutate({
      title: title.trim() || undefined,
      topic: topic.trim() || undefined,
      script: script.trim(),
      sourceImageDataUrl: needsPhoto ? sourceImageDataUrl : undefined,
      voiceId: voiceId || undefined,
      provider,
      useDigitalTwin: activeUseDigitalTwin || undefined,
      accountAvatarId: activeAccountAvatar?.id,
    });
  };

  const handleCopyScript = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Roteiro copiado.");
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const HEYGEN_FALLBACK_VOICES = [
    { voice_id: "en-US-01", name: "English US Female", language: "en", gender: "Female" },
    { voice_id: "pt-BR-01", name: "Portuguese BR Female", language: "pt", gender: "Female" },
    { voice_id: "pt-BR-02", name: "Portuguese BR Male", language: "pt", gender: "Male" },
  ];

  const heyGenVoices = heyGenVoicesRaw.length > 0 ? heyGenVoicesRaw : HEYGEN_FALLBACK_VOICES;

  // O servidor já filtra pelo idioma escolhido (mais as vozes multilíngues e as da conta).
  const heyGenVoiceOptions = heyGenVoices.map(
    (v) => ({ value: v.voice_id, label: `${v.name} — ${v.language} ${v.gender}` })
  );

  const voiceOptions = heyGenVoiceOptions;

  if (locked) {
    return (
      <AppLayout activeModule="videos">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
          <div className="rounded-full bg-muted p-5">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Vídeos com Avatar</h2>
          <p className="text-muted-foreground max-w-md">
            Disponível no plano Pro ou superior. Faça upgrade para gerar vídeos com avatar de IA.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout activeModule="videos">
      <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
        <div className="animate-fade-in-up">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-md">
              <Clapperboard className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">{t("videosTitle")}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("videosTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("videosSubtitle")}
          </p>
        </div>

        {/* HeyGen é o único motor de vídeo disponível na plataforma. */}
        <div className="animate-fade-in-up">
          <div className="relative flex flex-col gap-2 rounded-2xl border-2 border-fuchsia-500 bg-fuchsia-500/5 p-4 text-left">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-400 to-rose-400">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-foreground">HeyGen</span>
              <span className="ml-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-2 py-0.5 text-[10px] font-medium text-white">Alta qualidade</span>
              <span className="ml-auto rounded-full bg-fuchsia-500 px-2 py-0.5 text-[10px] font-medium text-white">Motor ativo</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Expressões faciais naturais, movimentos realistas e lip sync de alta fidelidade.
            </p>
          </div>
        </div>

        {provider === "heygen" && (
          <DigitalTwinPanel useTwin={useDigitalTwin} onUseTwinChange={setUseDigitalTwin} />
        )}

        <div className="glass-card space-y-5 p-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t("new")} {t("videos")}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("videosTitleLabel")}</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Convite para consultoria"
                className="glass border-border/50"
                disabled={generateVideoMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tema</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Como reduzir custos com energia"
                className="glass border-border/50"
                disabled={generateScriptMutation.isPending || generateVideoMutation.isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tom do roteiro</label>
              <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
                <SelectTrigger className="glass w-full border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  {toneOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Voz {provider === "heygen" && loadingVoices && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}
              </label>
              {provider === "heygen" && (
                <div className="flex gap-1 mb-1 flex-wrap">
                  {[
                    { code: "pt", label: "PT-BR" },
                    { code: "en", label: "EN" },
                    { code: "es", label: "ES" },
                    { code: "", label: "Todas" },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => { setVoiceLanguageFilter(lang.code); setVoiceId(""); }}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
                        voiceLanguageFilter === lang.code
                          ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
                          : "border-border/40 text-muted-foreground hover:border-border"
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
              <Select value={voiceId} onValueChange={setVoiceId} disabled={provider === "heygen" && loadingVoices}>
                <SelectTrigger className="glass w-full border-border/50">
                  <SelectValue placeholder={activeAccountAvatar?.defaultVoiceId ? "Voz do próprio avatar" : "Selecione uma voz"} />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50 max-h-72">
                  {voiceOptions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      {loadingVoices ? "Carregando vozes…" : "Nenhuma voz encontrada para este idioma."}
                    </div>
                  ) : (
                    voiceOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Roteiro</label>
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateScript}
                disabled={!topic.trim() || generateScriptMutation.isPending || generateVideoMutation.isPending}
                className="gap-2 glass border-border/50"
              >
                {generateScriptMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Gerando roteiro...</>
                ) : (
                  <><Sparkles className="w-4 h-4" />{t("videosGenerateScript")}</>
                )}
              </Button>
            </div>
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Escreva aqui o texto que o avatar vai falar."
              className="min-h-[160px] resize-none glass border-border/50"
              disabled={generateVideoMutation.isPending}
            />
            <p className="text-right text-xs text-muted-foreground">{script.length} caracteres</p>
          </div>

          {activeUseDigitalTwin ? (
            <div className="flex items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-sm text-foreground">
              <Sparkles className="w-4 h-4 text-fuchsia-500 flex-shrink-0" />
              Usando seu Avatar 3D — não precisa enviar foto para este vídeo.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-1.5">
                {([["account", "Avatar da conta HeyGen"], ["photo", "Foto nova"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSource(value)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      source === value ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" : "border-border/40 text-muted-foreground hover:border-border"
                    )}
                  >{label}</button>
                ))}
              </div>
              {source === "account" ? (
                loadingAvatars ? (
                  <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Carregando avatares…</p>
                ) : accountAvatars.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Nenhum avatar pronto na conta HeyGen. Crie em app.heygen.com → Avatars ou use "Foto nova".</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {accountAvatars.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAccountAvatarId(a.id)}
                        className={cn("overflow-hidden rounded-xl border-2 text-left transition-all", accountAvatarId === a.id ? "border-fuchsia-500 ring-2 ring-fuchsia-500/30" : "border-border/40 hover:border-border")}
                      >
                        <div className="aspect-[3/4] bg-muted">
                          {a.previewImageUrl && <SafeImage src={a.previewImageUrl} alt={a.name} className="h-full w-full object-cover" />}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="truncate text-xs font-medium">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground">{a.type === "digital_twin" ? "Avatar 3D" : "Foto"}{a.defaultVoiceId ? " · tem voz" : ""}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Foto da pessoa
                {provider === "heygen" && (
                  <span className="ml-2 text-xs text-muted-foreground">— Use foto com rosto centralizado e boa iluminação para melhor resultado</span>
                )}
              </label>
              <SourceImageUpload value={sourceImageDataUrl} onChange={setSourceImageDataUrl} />
            </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleGenerateVideo}
              disabled={!script.trim() || (needsPhoto && !sourceImageDataUrl) || generateVideoMutation.isPending || needsVoice}
              className={cn(
                "gap-2 border-0 text-white hover:opacity-90",
                provider === "heygen"
                  ? "bg-gradient-to-r from-fuchsia-500 to-rose-500"
                  : "bg-gradient-to-r from-slate-600 to-slate-800"
              )}
            >
              {generateVideoMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Gerando vídeo…</>
              ) : (
                <><Mic2 className="w-4 h-4" />{t("videosGenerateBtn")} — {provider === "heygen" ? "HeyGen" : "D-ID"}</>
              )}
            </Button>
          </div>

          {generateVideoMutation.isPending && (
            <p className="text-center text-xs text-muted-foreground animate-pulse">
              {provider === "heygen"
                ? "O HeyGen está processando — pode levar de 1 a 3 minutos dependendo do roteiro."
                : "O D-ID está processando — geralmente leva cerca de 1 minuto."}
            </p>
          )}
        </div>

        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Biblioteca de vídeos <span className="font-normal text-muted-foreground">({videos.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((item) => <div key={item} className="h-48 rounded-2xl shimmer" />)}
            </div>
          ) : videos.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-rose-500 opacity-40">
                <Clapperboard className="w-8 h-8 text-white" />
              </div>
              <h3 className="mb-1 font-semibold text-foreground">{t("videosNoVideos")}</h3>
              <p className="text-sm text-muted-foreground">Gere o primeiro avatar em vídeo e ele ficará salvo aqui.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {videos.map((video, index) => {
                const config = statusConfig[video.status];
                const StatusIcon = config.icon;
                return (
                  <div key={video.id} className="glass-card p-4 animate-fade-in-up transition-all duration-200 hover:scale-[1.01]" style={{ animationDelay: `${index * 0.05}s` }}>
                    <div className="flex items-start gap-4">
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-black/5">
                        {video.videoUrl ? (
                          <video src={video.videoUrl} className="h-full w-full object-cover" muted playsInline />
                        ) : (
                          <SafeImage src={video.sourceImageUrl} alt={video.title ?? ""} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="truncate text-sm font-semibold text-foreground">{video.title}</h3>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", config.className)}>
                            <StatusIcon className={cn("w-3 h-3", video.status === "processing" && "animate-spin")} />
                            {config.label}
                          </span>
                        </div>
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{video.script}</p>
                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                          <span>{new Date(video.createdAt).toLocaleString("pt-BR")}</span>
                          {video.voiceProvider && <span className="capitalize">{video.voiceProvider}</span>}
                        </div>
                        {video.status === "failed" && video.errorMessage && (
                          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-300">
                            <AlertCircle className="mt-0.5 w-3.5 h-3.5 flex-shrink-0" />
                            <span>{video.errorMessage}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedVideo(video)} className="h-8 w-8 rounded-lg">
                          <PlayCircle className="w-4 h-4" />
                        </Button>
                        {video.videoUrl && (
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(video.videoUrl!, `avatar-video-${video.id}.mp4`)} className="h-8 w-8 rounded-lg">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: video.id })} className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5" disabled={deleteMutation.isPending}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl glass-card border-border/50">
          {selectedVideo && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Clapperboard className="w-4 h-4" />
                  {selectedVideo.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl bg-black/5">
                  {selectedVideo.videoUrl ? (
                    <video src={selectedVideo.videoUrl} controls className="max-h-[60vh] w-full bg-black" />
                  ) : (
                    <SafeImage src={selectedVideo.sourceImageUrl} alt={selectedVideo.title ?? ""} className="max-h-[60vh] w-full object-contain" fallbackClassName="min-h-[200px]" />
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const config = statusConfig[selectedVideo.status];
                      const StatusIcon = config.icon;
                      return (
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", config.className)}>
                          <StatusIcon className={cn("w-3 h-3", selectedVideo.status === "processing" && "animate-spin")} />
                          {config.label}
                        </span>
                      );
                    })()}
                    {selectedVideo.voiceProvider && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground capitalize">
                        <Mic2 className="w-3 h-3" />
                        {selectedVideo.voiceProvider}
                      </span>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/40 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{selectedVideo.script}</p>
                  </div>
                  {selectedVideo.errorMessage && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
                      <AlertCircle className="mt-0.5 w-4 h-4 flex-shrink-0" />
                      <span>{selectedVideo.errorMessage}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleCopyScript(selectedVideo.script)} className="gap-2">
                      <Copy className="w-4 h-4" />
                      Copiar roteiro
                    </Button>
                    {selectedVideo.videoUrl && (
                      <Button onClick={() => handleDownload(selectedVideo.videoUrl!, `avatar-video-${selectedVideo.id}.mp4`)} className="gap-2 bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white border-0 hover:opacity-90">
                        <Download className="w-4 h-4" />
                        Baixar vídeo
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
