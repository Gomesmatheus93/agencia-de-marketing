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
  Instagram,
  Linkedin,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  Wand2,
  Eye,
  X,
  ImagePlus,
  Image as ImageIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}> = {
  instagram: {
    label: "Instagram",
    icon: Instagram,
    color: "text-pink-600",
    gradient: "from-pink-500 via-rose-500 to-orange-500",
    bg: "bg-gradient-to-br from-pink-50 to-orange-50 dark:from-pink-950/20 dark:to-orange-950/20",
    maxChars: 2200,
    supportsImage: true,
  },
  linkedin: {
    label: "LinkedIn",
    icon: Linkedin,
    color: "text-blue-700",
    gradient: "from-blue-600 to-blue-700",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    maxChars: 3000,
    supportsImage: true,
  },
  newsletter: {
    label: "Newsletter",
    icon: Mail,
    color: "text-violet-600",
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50 dark:bg-violet-950/20",
    maxChars: 10000,
    supportsImage: false,
  },
};

const statusConfig: Record<PostStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: "Rascunho", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30", icon: FileEdit },
  scheduled: { label: "Agendado", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30", icon: Clock },
  published: { label: "Publicado", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "text-red-600 bg-red-50 dark:bg-red-950/30", icon: XCircle },
};

// Image Upload Component
function ImageUpload({
  value,
  onChange,
  gradient,
}: {
  value: string;
  onChange: (url: string) => void;
  gradient: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border/50 group">
        <img
          src={value}
          alt="Preview"
          className="w-full max-h-56 object-cover"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            className="gap-1.5 text-xs"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Trocar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => onChange("")}
            className="gap-1.5 text-xs"
          >
            <X className="w-3.5 h-3.5" />
            Remover
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
        "border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-200 flex flex-col items-center gap-2 text-center",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border/50 hover:border-border hover:bg-accent/30"
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm", gradient)}>
        <ImagePlus className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Adicionar imagem</p>
        <p className="text-xs text-muted-foreground mt-0.5">Clique ou arraste aqui · PNG, JPG, WEBP · max 10MB</p>
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

export default function Posts() {
  const utils = trpc.useUtils();
  const [activeChannel, setActiveChannel] = useState<Channel>("instagram");
  const [showCreate, setShowCreate] = useState(false);
  const [showAIGen, setShowAIGen] = useState(false);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  // Create form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formScheduledAt, setFormScheduledAt] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");

  // AI gen state
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "casual" | "inspiring" | "educational">("professional");

  const { data: posts = [], isLoading } = trpc.posts.getAll.useQuery({ channel: activeChannel });

  const createMutation = trpc.posts.create.useMutation({
    onSuccess: (post) => {
      utils.posts.getAll.invalidate();
      utils.posts.getStats.invalidate();
      toast.success(post.status === "scheduled" ? "Post agendado com sucesso!" : "Post criado com sucesso!");
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

  const aiGenMutation = trpc.posts.generateContent.useMutation({
    onSuccess: (data) => {
      setFormTitle(data.title);
      setFormContent(data.content);
      setShowAIGen(false);
      setShowCreate(true);
      toast.success("Conteúdo gerado! Revise antes de publicar.");
    },
    onError: (err) => toast.error("Erro ao gerar conteúdo: " + err.message),
  });

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormScheduledAt("");
    setFormImageUrl("");
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

  const handleAIGen = () => {
    if (!aiTopic.trim()) { toast.error("Digite um tema para gerar o conteúdo"); return; }
    aiGenMutation.mutate({ channel: activeChannel, topic: aiTopic, tone: aiTone });
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
            Crie, organize e acompanhe conteúdo para Instagram, LinkedIn e Newsletter.
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

        {/* Actions */}
        <div className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <Button
            onClick={() => setShowAIGen(true)}
            className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 hover:opacity-90 shadow-md"
          >
            <Wand2 className="w-4 h-4" />
            Gerar com IA
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCreate(true)}
            className="gap-2 glass border-border/50"
          >
            <Plus className="w-4 h-4" />
            Criar manualmente
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
              <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro post ou gere com IA</p>
              <Button onClick={() => setShowAIGen(true)} className="gap-2 gradient-primary text-white border-0">
                <Wand2 className="w-4 h-4" />
                Gerar com IA
              </Button>
            </div>
          ) : (
            posts.map((post, i) => {
              const StatusIcon = statusConfig[post.status].icon;
              return (
                <div
                  key={post.id}
                  className="glass-card p-4 hover:scale-[1.005] transition-all duration-200 animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail or channel icon */}
                    {post.imageUrl ? (
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-md">
                        <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-md", cfg.gradient)}>
                        <ChannelIcon className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {post.title && (
                        <h3 className="font-semibold text-sm text-foreground truncate">{post.title}</h3>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{post.content}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={cn("flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", statusConfig[post.status].color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[post.status].label}
                        </span>
                        {post.imageUrl && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <ImageIcon className="w-3 h-3" />
                            Com imagem
                          </span>
                        )}
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
                          {post.content.length}/{cfg.maxChars} chars
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                          className="w-8 h-8 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
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

      {/* Create Post Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="glass-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center", cfg.gradient)}>
                <ChannelIcon className="w-3.5 h-3.5 text-white" />
              </div>
              Novo post para {cfg.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeChannel === "newsletter" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Assunto do email</label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Newsletter semanal - Novidades de marketing"
                  className="glass border-border/50"
                />
              </div>
            )}

            {/* Image upload — only for Instagram and LinkedIn */}
            {cfg.supportsImage && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  Imagem {activeChannel === "instagram" ? "(recomendado)" : "(opcional)"}
                </label>
                <ImageUpload
                  value={formImageUrl}
                  onChange={setFormImageUrl}
                  gradient={cfg.gradient}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Conteúdo *</label>
                <span className={cn("text-xs", formContent.length > cfg.maxChars ? "text-destructive" : "text-muted-foreground")}>
                  {formContent.length}/{cfg.maxChars}
                </span>
              </div>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={`Escreva o conteúdo para ${cfg.label}...`}
                className="glass border-border/50 min-h-[150px] resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Agendar para ({POST_SCHEDULER_TIME_ZONE})
              </label>
              <Input
                type="datetime-local"
                value={formScheduledAt}
                onChange={(e) => setFormScheduledAt(e.target.value)}
                className="glass border-border/50"
                min={toSchedulerDatetimeLocalValue(new Date())}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formContent.trim() || createMutation.isPending}
                className={cn("flex-1 bg-gradient-to-r text-white border-0 hover:opacity-90 gap-2", cfg.gradient)}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                ) : formScheduledAt ? (
                  <><Calendar className="w-4 h-4" /> Agendar Post</>
                ) : (
                  <><Plus className="w-4 h-4" /> Criar Post</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generator Dialog */}
      <Dialog open={showAIGen} onOpenChange={setShowAIGen}>
        <DialogContent className="glass-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Wand2 className="w-3.5 h-3.5 text-white" />
              </div>
              Gerar conteúdo com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl glass border-border/30">
              <ChannelIcon className={cn("w-4 h-4 flex-shrink-0", cfg.color)} />
              <span className="text-sm text-foreground font-medium">Canal: {cfg.label}</span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tema do post *</label>
              <Input
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="Ex: Lançamento do novo produto X"
                className="glass border-border/50"
                disabled={aiGenMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tom de voz</label>
              <Select value={aiTone} onValueChange={(v) => setAiTone(v as typeof aiTone)}>
                <SelectTrigger className="glass border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-card border-border/50">
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="casual">Casual e amigável</SelectItem>
                  <SelectItem value="inspiring">Inspirador</SelectItem>
                  <SelectItem value="educational">Educativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAIGen(false)} className="flex-1" disabled={aiGenMutation.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={handleAIGen}
                disabled={!aiTopic.trim() || aiGenMutation.isPending}
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 hover:opacity-90 gap-2"
              >
                {aiGenMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Gerar Conteúdo</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewPost} onOpenChange={() => setPreviewPost(null)}>
        <DialogContent className="glass-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview do Post
            </DialogTitle>
          </DialogHeader>
          {previewPost && (
            <div className="space-y-4">
              <div className={cn("rounded-xl overflow-hidden", channelConfig[previewPost.channel].bg)}>
                {/* Image preview */}
                {previewPost.imageUrl && (
                  <div className="w-full aspect-video overflow-hidden">
                    <img
                      src={previewPost.imageUrl}
                      alt="Imagem do post"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const Icon = channelConfig[previewPost.channel].icon;
                      return <Icon className={cn("w-5 h-5", channelConfig[previewPost.channel].color)} />;
                    })()}
                    <span className={cn("font-semibold text-sm", channelConfig[previewPost.channel].color)}>
                      {channelConfig[previewPost.channel].label}
                    </span>
                  </div>
                  {previewPost.title && (
                    <h3 className="font-bold text-foreground mb-2">{previewPost.title}</h3>
                  )}
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{previewPost.content}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{previewPost.content.length} caracteres</span>
                <span className={cn("px-2 py-0.5 rounded-full font-medium", statusConfig[previewPost.status].color)}>
                  {statusConfig[previewPost.status].label}
                </span>
              </div>
              {previewPost.status !== "published" && (
                <Button
                  onClick={() => { publishMutation.mutate({ id: previewPost.id }); setPreviewPost(null); }}
                  className={cn("w-full gap-2 bg-gradient-to-r text-white border-0 hover:opacity-90", channelConfig[previewPost.channel].gradient)}
                  disabled={publishMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                  {previewPost.channel === "instagram" ? "Publicar no Instagram" : "Marcar como publicado"}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
