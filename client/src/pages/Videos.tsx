import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { type ComponentType, useRef, useState } from "react";
import { toast } from "sonner";
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
} from "lucide-react";

type AvatarVideoStatus = "processing" | "completed" | "failed";

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
  if (!context) {
    throw new Error("Nao consegui preparar o canvas da imagem.");
  }

  const coverScale = Math.max(
    AVATAR_CANVAS_WIDTH / image.width,
    AVATAR_CANVAS_HEIGHT / image.height
  );
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

  context.drawImage(
    image,
    foregroundX,
    foregroundY,
    foregroundWidth,
    foregroundHeight
  );

  return canvas.toDataURL("image/png");
}

const voiceOptions = [
  { value: "pt-BR-FranciscaNeural", label: "Francisca PT-BR" },
  { value: "pt-BR-AntonioNeural", label: "Antonio PT-BR" },
  { value: "en-US-JennyNeural", label: "Jenny EN-US" },
  { value: "en-US-GuyNeural", label: "Guy EN-US" },
];

const toneOptions = [
  { value: "professional", label: "Profissional" },
  { value: "casual", label: "Casual" },
  { value: "inspiring", label: "Inspirador" },
  { value: "educational", label: "Educativo" },
] as const;

const statusConfig: Record<
  AvatarVideoStatus,
  {
    label: string;
    className: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  processing: {
    label: "Gerando",
    className: "text-amber-700 bg-amber-50 dark:bg-amber-950/30",
    icon: Loader2,
  },
  completed: {
    label: "Pronto",
    className: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30",
    icon: CheckCircle2,
  },
  failed: {
    label: "Falhou",
    className: "text-red-700 bg-red-50 dark:bg-red-950/30",
    icon: XCircle,
  },
};

function SourceImageUpload({
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
      toast.error("Selecione apenas imagens");
      return;
    }

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
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Nao consegui preparar a imagem.");
      });
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
          <p className="mt-0.5 text-xs text-muted-foreground">
            A imagem e ajustada automaticamente para 9:16 em 1080x1920.
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => inputRef.current?.click()}
            className="h-8 w-8 rounded-lg"
          >
            <Upload className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])}
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
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
        <p className="mt-0.5 text-xs text-muted-foreground">
          Clique ou arraste aqui. PNG ou JPG. O enquadramento vira 9:16.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])}
      />
    </div>
  );
}

export default function Videos() {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [tone, setTone] = useState<(typeof toneOptions)[number]["value"]>("professional");
  const [voiceId, setVoiceId] = useState("pt-BR-FranciscaNeural");
  const [sourceImageDataUrl, setSourceImageDataUrl] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<AvatarVideo | null>(null);

  const { data: videos = [], isLoading } = trpc.videos.getAll.useQuery();

  const generateScriptMutation = trpc.videos.generateScript.useMutation({
    onSuccess: (data) => {
      setTitle((current) => current || data.title);
      setScript(data.script);
      toast.success("Roteiro gerado com sucesso.");
    },
    onError: (error) => {
      toast.error("Erro ao gerar roteiro: " + error.message);
    },
  });

  const generateVideoMutation = trpc.videos.generate.useMutation({
    onSuccess: () => {
      utils.videos.getAll.invalidate();
      utils.videos.getStats.invalidate();
      toast.success("Video gerado e salvo na plataforma.");
      setTitle("");
      setTopic("");
      setScript("");
      setSourceImageDataUrl("");
    },
    onError: (error) => {
      utils.videos.getAll.invalidate();
      toast.error("Erro ao gerar video: " + error.message);
    },
  });

  const deleteMutation = trpc.videos.delete.useMutation({
    onSuccess: () => {
      utils.videos.getAll.invalidate();
      utils.videos.getStats.invalidate();
      toast.success("Video removido.");
      setSelectedVideo(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir video: " + error.message);
    },
  });

  const handleGenerateScript = () => {
    if (!topic.trim()) {
      toast.error("Digite um tema para gerar o roteiro.");
      return;
    }

    generateScriptMutation.mutate({
      topic: topic.trim(),
      tone,
    });
  };

  const handleGenerateVideo = () => {
    if (!script.trim()) {
      toast.error("Escreva ou gere um roteiro antes de criar o video.");
      return;
    }

    if (!sourceImageDataUrl) {
      toast.error("Adicione a foto da pessoa para gerar o avatar.");
      return;
    }

    generateVideoMutation.mutate({
      title: title.trim() || undefined,
      topic: topic.trim() || undefined,
      script: script.trim(),
      sourceImageDataUrl,
      voiceId,
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

  return (
    <AppLayout activeModule="videos">
      <div className="mx-auto max-w-6xl space-y-8 p-6 lg:p-8">
        <div className="animate-fade-in-up">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-rose-500 shadow-md">
              <Clapperboard className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Videos com Avatar</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Gere videos falados com <span className="gradient-text-accent">avatar por foto</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monte o roteiro, envie a foto da pessoa e deixe o video voltar salvo aqui na plataforma.
          </p>
        </div>

        <div className="glass-card space-y-5 p-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Novo video</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Titulo do video</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Convite para consultoria energetica"
                className="glass border-border/50"
                disabled={generateVideoMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tema</label>
              <Input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Ex: Como reduzir desperdicios com energia digital"
                className="glass border-border/50"
                disabled={generateScriptMutation.isPending || generateVideoMutation.isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tom do roteiro</label>
              <Select value={tone} onValueChange={(value) => setTone(value as typeof tone)}>
                <SelectTrigger className="glass w-full border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  {toneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Voz</label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger className="glass w-full border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  {voiceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando roteiro...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar roteiro com IA
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={script}
              onChange={(event) => setScript(event.target.value)}
              placeholder="Escreva aqui o texto que o avatar vai falar."
              className="min-h-[160px] resize-none glass border-border/50"
              disabled={generateVideoMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Foto da pessoa</label>
            <SourceImageUpload value={sourceImageDataUrl} onChange={setSourceImageDataUrl} />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleGenerateVideo}
              disabled={!script.trim() || !sourceImageDataUrl || generateVideoMutation.isPending}
              className="gap-2 border-0 bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white hover:opacity-90"
            >
              {generateVideoMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando video...
                </>
              ) : (
                <>
                  <Mic2 className="w-4 h-4" />
                  Gerar video com avatar
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Biblioteca de videos <span className="font-normal text-muted-foreground">({videos.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2].map((item) => (
                <div key={item} className="h-48 rounded-2xl shimmer" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-rose-500 opacity-40">
                <Clapperboard className="w-8 h-8 text-white" />
              </div>
              <h3 className="mb-1 font-semibold text-foreground">Nenhum video ainda</h3>
              <p className="text-sm text-muted-foreground">
                Gere o primeiro avatar em video e ele vai ficar salvo aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {videos.map((video, index) => {
                const config = statusConfig[video.status];
                const StatusIcon = config.icon;

                return (
                  <div
                    key={video.id}
                    className="glass-card p-4 animate-fade-in-up transition-all duration-200 hover:scale-[1.01]"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-black/5">
                        {video.videoUrl ? (
                          <video
                            src={video.videoUrl}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={video.sourceImageUrl}
                            alt={video.title}
                            className="h-full w-full object-cover"
                          />
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

                        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {video.script}
                        </p>

                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                          <span>{new Date(video.createdAt).toLocaleString("pt-BR")}</span>
                          {video.voiceId && <span>{video.voiceId}</span>}
                          {video.topic && <span className="truncate max-w-[220px]">{video.topic}</span>}
                        </div>

                        {video.status === "failed" && video.errorMessage && (
                          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-300">
                            <AlertCircle className="mt-0.5 w-3.5 h-3.5 flex-shrink-0" />
                            <span>{video.errorMessage}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedVideo(video)}
                          className="h-8 w-8 rounded-lg"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </Button>
                        {video.videoUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(video.videoUrl!, `avatar-video-${video.id}.mp4`)}
                            className="h-8 w-8 rounded-lg"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate({ id: video.id })}
                          className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
                          disabled={deleteMutation.isPending}
                        >
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
                    <video
                      src={selectedVideo.videoUrl}
                      controls
                      className="max-h-[60vh] w-full bg-black"
                    />
                  ) : (
                    <img
                      src={selectedVideo.sourceImageUrl}
                      alt={selectedVideo.title}
                      className="max-h-[60vh] w-full object-contain"
                    />
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
                    {selectedVideo.voiceId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                        <Mic2 className="w-3 h-3" />
                        {selectedVideo.voiceId}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/40 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {selectedVideo.script}
                    </p>
                  </div>

                  {selectedVideo.errorMessage && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
                      <AlertCircle className="mt-0.5 w-4 h-4 flex-shrink-0" />
                      <span>{selectedVideo.errorMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCopyScript(selectedVideo.script)}
                      className="gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar roteiro
                    </Button>
                    {selectedVideo.videoUrl && (
                      <Button
                        onClick={() => handleDownload(selectedVideo.videoUrl!, `avatar-video-${selectedVideo.id}.mp4`)}
                        className="gap-2 bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white border-0 hover:opacity-90"
                      >
                        <Download className="w-4 h-4" />
                        Baixar video
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
