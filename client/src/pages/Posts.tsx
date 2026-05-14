import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  POST_SCHEDULER_TIME_ZONE,
  toSchedulerDatetimeLocalValue,
} from "@/lib/scheduling";
import {
  Share2,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Send,
  Calendar,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  Eye,
  X,
  Upload,
  Image as ImageIcon,
  Check,
} from "lucide-react";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

const VIDEO_EXT_RE = /\.(mp4|mov|webm|avi)(\?|$)/i;

function resolveImgUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  // Don't proxy videos — the image proxy rejects non-image content types
  if (/^https?:\/\//i.test(url)) {
    return VIDEO_EXT_RE.test(url) ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  if (typeof window !== "undefined") return new URL(url, window.location.origin).toString();
  return url;
}

type Channel = "instagram" | "linkedin" | "newsletter";
type PostStatus = "draft" | "scheduled" | "published" | "failed";

type Post = {
  id: number;
  channel: Channel;
  title: string | null;
  content: string;
  imageUrl: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  status: PostStatus;
  createdAt: Date;
};

const channelConfig: Record<Channel, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  bg: string;
  maxChars: number;
  supportsImage: boolean;
  captionLabel: string;
  captionPlaceholder: string;
}> = {
  instagram: {
    label: "Instagram",
    icon: InstagramIcon,
    color: "text-pink-600",
    gradient: "from-pink-500 via-rose-500 to-orange-500",
    bg: "bg-gradient-to-br from-pink-50 to-orange-50 dark:from-pink-950/20 dark:to-orange-950/20",
    maxChars: 2200,
    supportsImage: true,
    captionLabel: "Legenda",
    captionPlaceholder: "Legenda para o post no Instagram (emojis, hashtags, CTA)...",
  },
  linkedin: {
    label: "LinkedIn",
    icon: LinkedinIcon,
    color: "text-blue-700",
    gradient: "from-blue-600 to-blue-700",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    maxChars: 3000,
    supportsImage: true,
    captionLabel: "Texto do post",
    captionPlaceholder: "Escreva o conteúdo profissional para o LinkedIn...",
  },
  newsletter: {
    label: "Newsletter",
    icon: Mail,
    color: "text-violet-600",
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50 dark:bg-violet-950/20",
    maxChars: 10000,
    supportsImage: false,
    captionLabel: "Corpo do email",
    captionPlaceholder: "Escreva o conteúdo completo da newsletter...",
  },
};

const statusConfig: Record<PostStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: "Rascunho", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30", icon: FileEdit },
  scheduled: { label: "Agendado", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30", icon: Clock },
  published: { label: "Publicado", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "text-red-600 bg-red-50 dark:bg-red-950/30", icon: XCircle },
};

export default function Posts() {
  const utils = trpc.useUtils();
  const [activeChannel, setActiveChannel] = useState<Channel>("instagram");
  const [showCreate, setShowCreate] = useState(false);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  // Create form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formScheduledAt, setFormScheduledAt] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formMediaType, setFormMediaType] = useState<"image" | "video" | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: posts = [], isLoading } = trpc.posts.getAll.useQuery({ channel: activeChannel });

  const createMutation = trpc.posts.create.useMutation({
    onSuccess: (post) => {
      utils.posts.getAll.invalidate();
      utils.posts.getStats.invalidate();
      toast.success(post.status === "scheduled" ? "Post agendado com sucesso!" : "Post salvo com sucesso!");
      setShowCreate(false);
      resetForm();
    },
    onError: (err) => toast.error("Erro ao criar post: " + err.message),
  });

  const publishMutation = trpc.posts.publish.useMutation({
    onSuccess: (data) => {
      utils.posts.getAll.invalidate();
      if (data.success && data.mediaId) toast.success(`Post publicado no Instagram. Media ID: ${data.mediaId}`);
      else if (data.success) toast.success("Post marcado como publicado!");
      else toast.error("Falha ao publicar post");
    },
    onError: (err) => toast.error("Erro ao publicar: " + err.message),
  });

  const deleteMutation = trpc.posts.delete.useMutation({
    onSuccess: () => {
      utils.posts.getAll.invalidate();
      utils.posts.getStats.invalidate();
      toast.success("Post excluído");
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });

  const analyzeImageMutation = trpc.posts.generateContentFromImage.useMutation({
    onSuccess: (data) => {
      setFormContent(data.content);
      toast.success("Legenda gerada com IA!");
    },
    onError: (err) => toast.error("Erro ao analisar imagem: " + err.message),
  });

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormScheduledAt("");
    setFormImageUrl("");
    setFormMediaType(null);
    setIsUploading(false);
    analyzeImageMutation.reset();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isImage && !isVideo) {
      toast.error("Selecione apenas imagens ou vídeos");
      return;
    }

    const maxSize = isVideo ? 200 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. Máximo: ${isVideo ? "200MB" : "50MB"}`);
      return;
    }

    // For small images use local data URL (no round-trip needed for preview)
    if (isImage && file.size <= 4 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) { setFormImageUrl(dataUrl); setFormMediaType("image"); }
      };
      reader.readAsDataURL(file);
      return;
    }

    // Large images and all videos: upload directly to /api/upload-media (bypasses JSON body limit)
    setIsUploading(true);
    const toastId = isVideo ? "media-upload" : undefined;
    if (toastId) toast.loading("Enviando vídeo...", { id: toastId });
    try {
      const res = await fetch("/api/upload-media", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json() as { url: string };
      setFormImageUrl(url);
      setFormMediaType(isVideo ? "video" : "image");
      if (toastId) toast.success("Vídeo enviado!", { id: toastId });
    } catch (err) {
      toast.error("Erro ao enviar arquivo: " + (err instanceof Error ? err.message : String(err)),
        toastId ? { id: toastId } : undefined);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreate = () => {
    if (!formContent.trim()) { toast.error("O conteúdo é obrigatório"); return; }
    createMutation.mutate({
      channel: activeChannel,
      title: formTitle || undefined,
      content: formContent,
      scheduledAt: formScheduledAt || undefined,
      imageUrl: formImageUrl || undefined,
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: POST_SCHEDULER_TIME_ZONE,
    });
  };

  const cfg = channelConfig[activeChannel];
  const ChannelIcon = cfg.icon;

  return (
    <AppLayout activeModule="posts">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-md">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Planejamento de Postagens</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Gerencie suas <span className="gradient-text-accent">postagens</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Envie imagens prontas do computador e publique direto no Instagram ou LinkedIn.
          </p>
        </div>

        {/* Channel tabs */}
        <div className="flex gap-2 p-1 glass-card rounded-2xl w-fit animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {(Object.entries(channelConfig) as [Channel, typeof channelConfig[Channel]][]).map(([channel, config]) => {
            const Icon = config.icon;
            const isActive = activeChannel === channel;
            return (
              <button
                key={channel}
                onClick={() => setActiveChannel(channel)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive
                    ? `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* New post card — always visible, same style as carousel import */}
        <div
          className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Nova postagem</p>
            <p className="text-xs text-muted-foreground">
              Envie uma imagem pronta do computador e escreva ou gere a legenda com IA.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 shrink-0 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 text-white border-0 hover:opacity-90 shadow-md"
          >
            <Plus className="w-4 h-4" />
            Nova postagem
          </Button>
        </div>

        {/* Posts list */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 shimmer rounded-2xl" />)}
            </div>
          ) : posts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className={cn("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-4 opacity-40", cfg.gradient)}>
                <ChannelIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Nenhum post para {cfg.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">Envie sua primeira postagem pronta</p>
              <Button
                onClick={() => setShowCreate(true)}
                className={cn("gap-2 bg-gradient-to-r text-white border-0 hover:opacity-90", cfg.gradient)}
              >
                <Upload className="w-4 h-4" />
                Enviar imagem
              </Button>
            </div>
          ) : (
            posts.map((post, i) => {
              const StatusIcon = statusConfig[post.status].icon;
              const postCfg = channelConfig[post.channel];
              const PostChannelIcon = postCfg.icon;
              const isVideoPost = post.imageUrl ? /\.(mp4|mov|webm|avi)(\?|$)/i.test(post.imageUrl) : false;
              return (
                <div
                  key={post.id}
                  className="glass-card overflow-hidden hover:scale-[1.002] transition-all duration-200 animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-stretch gap-0">
                    {/* Media preview — 4:5 thumbnail */}
                    <div className="w-[90px] sm:w-[110px] shrink-0 relative">
                      {post.imageUrl ? (
                        <div className="w-full h-full aspect-[4/5] overflow-hidden bg-muted">
                          {isVideoPost ? (
                            <video
                              src={resolveImgUrl(post.imageUrl)}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={resolveImgUrl(post.imageUrl)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ) : (
                        <div className={cn("w-full h-full aspect-[4/5] bg-gradient-to-br flex items-center justify-center", postCfg.gradient)}>
                          <PostChannelIcon className="w-6 h-6 text-white/60" />
                        </div>
                      )}
                      {isVideoPost && (
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          Vídeo
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between p-4 gap-2">
                      <div className="space-y-1.5">
                        {post.title && (
                          <h3 className="font-semibold text-sm text-foreground truncate">{post.title}</h3>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{post.content}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", statusConfig[post.status].color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[post.status].label}
                        </span>
                        {post.scheduledAt && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDate(post.scheduledAt)}
                          </span>
                        )}
                        {post.publishedAt && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            {formatDate(post.publishedAt)}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {post.content.length}/{postCfg.maxChars} chars
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-center justify-center gap-1 px-3 border-l border-border/20 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewPost(post as Post)}
                        className="w-8 h-8 rounded-lg"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {post.status !== "published" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => publishMutation.mutate({ id: post.id })}
                          disabled={publishMutation.isPending}
                          className="w-8 h-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        >
                          {publishMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate({ id: post.id })}
                        disabled={deleteMutation.isPending}
                        className="w-8 h-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Post Dialog — styled like carousel import */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="w-[min(96vw,1200px)] max-w-none sm:max-w-none overflow-hidden border-border/50 bg-background p-0">
          <div className="flex max-h-[90vh] flex-col">
            {/* Header */}
            <div className="border-b border-border/30 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm", cfg.gradient)}>
                  <ChannelIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold leading-tight">
                    Nova postagem para {cfg.label}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Envie uma imagem pronta do computador e escreva ou gere a legenda com IA.
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className={cn("flex gap-7", cfg.supportsImage ? "flex-col md:flex-row" : "flex-col")}>
                {/* Left — media upload */}
                {cfg.supportsImage && (
                  <div className="md:w-[340px] shrink-0 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Imagem ou vídeo{" "}
                      {activeChannel === "instagram"
                        ? <span className="text-destructive">*</span>
                        : <span className="normal-case font-normal text-muted-foreground/60">(opcional)</span>}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {isUploading ? (
                      <div className="flex w-full aspect-[4/5] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-muted/30">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <p className="text-sm font-medium text-foreground">Enviando arquivo...</p>
                        <p className="text-xs text-muted-foreground">Aguarde</p>
                      </div>
                    ) : formImageUrl ? (
                      <div className="group relative">
                        <div className="aspect-[4/5] overflow-hidden rounded-2xl border border-border/40 bg-muted shadow-sm">
                          {formMediaType === "video" ? (
                            <video
                              src={resolveImgUrl(formImageUrl)}
                              className="h-full w-full object-cover"
                              controls={false}
                              muted
                              playsInline
                              autoPlay
                              loop
                            />
                          ) : (
                            <img src={resolveImgUrl(formImageUrl)} alt="Preview" className="h-full w-full object-cover" />
                          )}
                        </div>
                        {formMediaType === "video" && (
                          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            Vídeo
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition"
                          >
                            <Upload className="w-3 h-3" />
                            Trocar
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFormImageUrl(""); setFormMediaType(null); analyzeImageMutation.reset(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/70 text-white text-xs font-medium hover:bg-red-500/90 transition"
                          >
                            <X className="w-3 h-3" />
                            Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full aspect-[4/5] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/50 bg-muted/20 text-center transition hover:border-primary/40 hover:bg-muted/30"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Clique para selecionar</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Imagem ou vídeo · JPG, PNG, MP4, MOV</p>
                          <p className="text-xs text-muted-foreground">Imagem max 10MB · Vídeo max 200MB</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {/* Right — caption + schedule */}
                <div className="flex-1 flex flex-col gap-5">
                  {/* Newsletter subject */}
                  {activeChannel === "newsletter" && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Assunto do email <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ex: Newsletter semanal — Novidades de marketing"
                        className="rounded-2xl border-border/50 bg-background/70"
                      />
                    </div>
                  )}

                  {/* Caption */}
                  <div className="flex-1 flex flex-col">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {cfg.captionLabel} <span className="text-destructive">*</span>
                      </label>
                      {cfg.supportsImage && formImageUrl && formMediaType === "image" && (
                        <button
                          type="button"
                          disabled={analyzeImageMutation.isPending}
                          onClick={() => analyzeImageMutation.mutate({ imageDataUrl: formImageUrl, channel: activeChannel })}
                          className="flex items-center gap-1.5 rounded-xl border border-border/40 px-3 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                        >
                          {analyzeImageMutation.isPending
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Sparkles className="h-3 w-3" />}
                          Gerar com IA
                        </button>
                      )}
                    </div>
                    <Textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder={cfg.captionPlaceholder}
                      className="flex-1 min-h-[200px] resize-none rounded-2xl border-border/50 bg-background/70 text-sm leading-relaxed"
                    />
                    <p className={cn("mt-1.5 text-right text-xs", formContent.length > cfg.maxChars ? "text-destructive" : "text-muted-foreground")}>
                      {formContent.length}/{cfg.maxChars}
                    </p>
                  </div>

                  {/* Schedule */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      Agendar para ({POST_SCHEDULER_TIME_ZONE})
                    </label>
                    <Input
                      type="datetime-local"
                      value={formScheduledAt}
                      onChange={(e) => setFormScheduledAt(e.target.value)}
                      className="rounded-2xl border-border/50 bg-background/70"
                      min={toSchedulerDatetimeLocalValue(new Date())}
                    />
                    {formScheduledAt && (
                      <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Post será agendado e publicado automaticamente nesta data.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 border-t border-border/30 px-8 py-5">
              <Button
                onClick={handleCreate}
                disabled={
                  !formContent.trim() ||
                  (activeChannel === "newsletter" && !formTitle.trim()) ||
                  createMutation.isPending
                }
                className={cn("gap-2 border-0 bg-gradient-to-r text-white hover:opacity-90 shadow-sm", cfg.gradient)}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {formImageUrl ? "Enviando imagem..." : "Salvando..."}
                  </>
                ) : formScheduledAt ? (
                  <>
                    <Calendar className="h-4 w-4" />
                    Agendar post
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Salvar post
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowCreate(false); resetForm(); }}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewPost} onOpenChange={() => setPreviewPost(null)}>
        <DialogContent className="w-[min(92vw,480px)] max-w-none sm:max-w-none border-border/50 bg-background p-0">
          <div className="flex max-h-[90vh] flex-col">
            <div className="border-b border-border/30 p-5">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <Eye className="w-4 h-4" />
                Preview do Post
              </DialogTitle>
            </div>
            {previewPost && (
              <>
                <div className="flex-1 overflow-y-auto">
                  <div className={cn("overflow-hidden", channelConfig[previewPost.channel].bg)}>
                    {previewPost.imageUrl && (
                      <div className="w-full aspect-[4/5] overflow-hidden">
                        <img
                          src={resolveImgUrl(previewPost.imageUrl)}
                          alt="Imagem do post"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        {(() => {
                          const Icon = channelConfig[previewPost.channel].icon;
                          return <Icon className={cn("w-5 h-5", channelConfig[previewPost.channel].color)} />;
                        })()}
                        <span className={cn("font-semibold text-sm", channelConfig[previewPost.channel].color)}>
                          {channelConfig[previewPost.channel].label}
                        </span>
                        <span className={cn("ml-auto flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", statusConfig[previewPost.status].color)}>
                          {statusConfig[previewPost.status].label}
                        </span>
                      </div>
                      {previewPost.title && (
                        <h3 className="font-bold text-foreground mb-2">{previewPost.title}</h3>
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{previewPost.content}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/30 p-5 flex gap-3">
                  {previewPost.status !== "published" && (
                    <Button
                      onClick={() => { publishMutation.mutate({ id: previewPost.id }); setPreviewPost(null); }}
                      className={cn("flex-1 gap-2 bg-gradient-to-r text-white border-0 hover:opacity-90", channelConfig[previewPost.channel].gradient)}
                      disabled={publishMutation.isPending}
                    >
                      <Send className="w-4 h-4" />
                      {previewPost.channel === "instagram" ? "Publicar no Instagram" : "Marcar como publicado"}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setPreviewPost(null)}>
                    Fechar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
