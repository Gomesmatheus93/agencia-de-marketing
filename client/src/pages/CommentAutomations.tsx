import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageCircle,
  Plus,
  Trash2,
  Power,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Hash,
  Instagram,
  Send,
  Link2,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommentAutomation = {
  id: number;
  userId: number;
  igAccountId: string;
  igPostId: string;
  postCaption: string | null;
  postThumbnailUrl: string | null;
  keywords: string[];
  publicReplyMessage: string;
  dmFirstMessage: string;
  dmFollowupMessage: string | null;
  dmLink: string | null;
  status: string;
  commentsMatchedCount: number;
  dmsSentCount: number;
  linkClicksCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type MediaItem = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
};

// ─── Step types ───────────────────────────────────────────────────────────────

type FormData = {
  igAccountId: string;
  igPostId: string;
  postCaption: string;
  postThumbnailUrl: string;
  keywords: string[];
  publicReplyMessage: string;
  dmFirstMessage: string;
  dmFollowupMessage: string;
  dmLink: string;
};

const STEPS = [
  "Conta",
  "Post",
  "Palavras-chave",
  "Resposta pública",
  "Mensagem DM",
  "Revisão",
] as const;

// ─── Keyword chip input ────────────────────────────────────────────────────────

function KeywordInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (kws: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addKeyword() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed || keywords.includes(trimmed)) { setInput(""); return; }
    onChange([...keywords, trimmed]);
    setInput("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword();
    }
    if (e.key === "Backspace" && !input && keywords.length > 0) {
      onChange(keywords.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border border-border bg-background">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full"
          >
            <Hash className="w-3 h-3" />
            {kw}
            <button
              onClick={() => onChange(keywords.filter((k) => k !== kw))}
              className="ml-0.5 hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={addKeyword}
          placeholder={keywords.length === 0 ? "Digite e pressione Enter…" : "Adicionar…"}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pressione Enter ou vírgula para adicionar. Comparação por "contém" (case-insensitive).
      </p>
    </div>
  );
}

// ─── Post selector ────────────────────────────────────────────────────────────

function PostSelector({
  selectedPostId,
  onSelect,
}: {
  selectedPostId: string;
  onSelect: (post: { id: string; caption?: string; thumbnailUrl?: string }) => void;
}) {
  const mediaQuery = trpc.analytics.getMedia.useQuery({ limit: 20 }, {
    retry: 1,
    staleTime: 2 * 60_000,
  });

  if (mediaQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando posts recentes…</span>
      </div>
    );
  }

  if (mediaQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os posts.<br />
          Verifique se sua conta Instagram está conectada em{" "}
          <a href="/dashboard/settings" className="underline text-primary">Configurações</a>.
        </p>
      </div>
    );
  }

  const posts = (mediaQuery.data ?? []) as MediaItem[];

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-center text-muted-foreground">
        <Instagram className="w-8 h-8 opacity-40" />
        <p className="text-sm">Nenhum post encontrado na conta.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
      {posts.map((post) => {
        const thumb = post.thumbnail_url ?? post.media_url ?? "";
        const isSelected = selectedPostId === post.id;
        return (
          <button
            key={post.id}
            onClick={() =>
              onSelect({ id: post.id, caption: post.caption, thumbnailUrl: thumb })
            }
            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
              isSelected
                ? "border-primary shadow-lg shadow-primary/20 scale-[1.03]"
                : "border-transparent hover:border-primary/40"
            }`}
          >
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Instagram className="w-6 h-6 text-muted-foreground opacity-40" />
              </div>
            )}
            {isSelected && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-primary drop-shadow" />
              </div>
            )}
            {post.media_type === "VIDEO" && !thumb && (
              <div className="absolute bottom-1 right-1 bg-black/60 rounded text-[9px] text-white px-1">
                VIDEO
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Campaign creation wizard ─────────────────────────────────────────────────

function NewCampaignDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    igAccountId: "",
    igPostId: "",
    postCaption: "",
    postThumbnailUrl: "",
    keywords: [],
    publicReplyMessage: "",
    dmFirstMessage: "",
    dmFollowupMessage: "",
    dmLink: "",
  });

  const igQuery = trpc.analytics.getInstagramConnectionStatus.useQuery(undefined, {
    staleTime: 60_000,
    enabled: open,
  });

  // Pre-fill igAccountId from connected account
  React.useEffect(() => {
    const acc = (igQuery.data as { instagramAccountId?: string } | undefined);
    if (acc?.instagramAccountId && !form.igAccountId) {
      setForm((f) => ({ ...f, igAccountId: acc.instagramAccountId! }));
    }
  }, [igQuery.data]);

  const createMutation = trpc.commentAutomations.create.useMutation({
    onSuccess: () => {
      toast.success("Campanha criada com sucesso!");
      onCreated();
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleClose() {
    setStep(0);
    setForm({
      igAccountId: "", igPostId: "", postCaption: "", postThumbnailUrl: "",
      keywords: [], publicReplyMessage: "", dmFirstMessage: "",
      dmFollowupMessage: "", dmLink: "",
    });
    onClose();
  }

  function canAdvance() {
    if (step === 0) return !!form.igAccountId;
    if (step === 1) return !!form.igPostId;
    if (step === 2) return form.keywords.length > 0;
    if (step === 3) return form.publicReplyMessage.trim().length > 0;
    if (step === 4) return form.dmFirstMessage.trim().length > 0;
    return true;
  }

  function handleSubmit() {
    createMutation.mutate({
      igAccountId: form.igAccountId,
      igPostId: form.igPostId,
      postCaption: form.postCaption || undefined,
      postThumbnailUrl: form.postThumbnailUrl || undefined,
      keywords: form.keywords,
      publicReplyMessage: form.publicReplyMessage,
      dmFirstMessage: form.dmFirstMessage,
      dmFollowupMessage: form.dmFollowupMessage || undefined,
      dmLink: form.dmLink || undefined,
    });
  }

  const connStatus = igQuery.data as {
    connected?: boolean;
    instagramAccountId?: string;
    username?: string;
    profilePictureUrl?: string;
  } | undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <MessageCircle className="w-5 h-5 text-primary" />
            Nova Campanha Comment-to-DM
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Configure a automação para disparar DMs quando alguém comentar a palavra-chave.
          </DialogDescription>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-4">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      i < step
                        ? "bg-primary text-primary-foreground"
                        : i === step
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="text-[9px] text-muted-foreground hidden sm:block">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all ${i < step ? "bg-primary" : "bg-muted"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 0: Conta */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Conta Instagram conectada</h3>
                <p className="text-xs text-muted-foreground">A campanha será vinculada à conta abaixo.</p>
              </div>
              {igQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground p-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Verificando conexão…</span>
                </div>
              ) : connStatus?.connected ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
                  {connStatus.profilePictureUrl ? (
                    <img src={connStatus.profilePictureUrl} className="w-12 h-12 rounded-full border-2 border-primary/30" alt="" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                      <Instagram className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm">{connStatus.username ? `@${connStatus.username}` : "Conta conectada"}</p>
                    <p className="text-xs text-muted-foreground">ID: {connStatus.instagramAccountId}</p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-amber-500/30 bg-amber-500/5 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                  <div>
                    <p className="font-semibold text-sm">Nenhuma conta conectada</p>
                    <p className="text-xs text-muted-foreground mt-1">Conecte sua conta Instagram em Configurações para criar campanhas.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { window.location.href = "/dashboard/settings"; }}>
                    Ir para Configurações
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Post */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm mb-1">Selecione o post</h3>
                <p className="text-xs text-muted-foreground">A automação só será ativada para comentários neste post específico.</p>
              </div>
              <PostSelector
                selectedPostId={form.igPostId}
                onSelect={(post) =>
                  setForm((f) => ({
                    ...f,
                    igPostId: post.id,
                    postCaption: post.caption ?? "",
                    postThumbnailUrl: post.thumbnailUrl ?? "",
                  }))
                }
              />
              {form.igPostId && (
                <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium line-clamp-1">
                    Post selecionado{form.postCaption ? `: "${form.postCaption.slice(0, 60)}…"` : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Keywords */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Palavras-chave gatilho</h3>
                <p className="text-xs text-muted-foreground">
                  Quando um comentário <strong>contiver</strong> qualquer uma dessas palavras (sem diferença de maiúsculas/minúsculas), a automação dispara.
                </p>
              </div>
              <KeywordInput keywords={form.keywords} onChange={(kws) => setForm((f) => ({ ...f, keywords: kws }))} />

              {form.keywords.length > 0 && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Exemplo de comentário que dispara:</p>
                  <p className="text-sm italic">
                    "Ei, quero saber mais sobre <strong className="text-primary not-italic">{form.keywords[0]}</strong>!"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Public reply */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-1">Resposta pública no comentário</h3>
                <p className="text-xs text-muted-foreground">
                  Esta mensagem é postada publicamente como resposta ao comentário da pessoa no Instagram.
                </p>
              </div>
              <Textarea
                placeholder="Ex: Oi! Que ótimo que você se interessou 😊 Acabei de te enviar um Direct com mais informações!"
                rows={4}
                value={form.publicReplyMessage}
                onChange={(e) => setForm((f) => ({ ...f, publicReplyMessage: e.target.value }))}
                className="resize-none text-sm"
              />
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Mantenha a mensagem amigável e sem links — links em comentários públicos são removidos pelo Instagram.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: DM messages */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="font-semibold text-sm mb-1">Mensagens no Direct (DM)</h3>
                <p className="text-xs text-muted-foreground">
                  A Meta <strong>não permite link na primeira mensagem privada</strong> após um comentário. Use as duas mensagens abaixo.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3 h-3" /> 1ª mensagem (sem link)
                </label>
                <Textarea
                  placeholder="Ex: Olá! Vi que você comentou no post. Que bom ter você por aqui! Posso te enviar mais detalhes?"
                  rows={3}
                  value={form.dmFirstMessage}
                  onChange={(e) => setForm((f) => ({ ...f, dmFirstMessage: e.target.value }))}
                  className="resize-none text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Enviada automaticamente após o comentário.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3 h-3" /> 2ª mensagem de follow-up (com link)
                </label>
                <Textarea
                  placeholder="Ex: Aqui está o conteúdo exclusivo que separei para você 👇"
                  rows={3}
                  value={form.dmFollowupMessage}
                  onChange={(e) => setForm((f) => ({ ...f, dmFollowupMessage: e.target.value }))}
                  className="resize-none text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 className="w-3 h-3" /> Link enviado no follow-up
                </label>
                <Input
                  type="url"
                  placeholder="https://…"
                  value={form.dmLink}
                  onChange={(e) => setForm((f) => ({ ...f, dmLink: e.target.value }))}
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Opcional. Enviado pelo n8n junto com a 2ª mensagem quando a pessoa responder.</p>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Revisar e ativar</h3>

              <div className="space-y-3">
                {[
                  { label: "Post vinculado", value: form.postCaption ? `"${form.postCaption.slice(0, 80)}…"` : form.igPostId },
                  { label: "Palavras-chave", value: form.keywords.map((k) => `#${k}`).join(", ") },
                  { label: "Resposta pública", value: form.publicReplyMessage },
                  { label: "1ª DM", value: form.dmFirstMessage },
                  ...(form.dmFollowupMessage ? [{ label: "2ª DM (follow-up)", value: form.dmFollowupMessage }] : []),
                  ...(form.dmLink ? [{ label: "Link", value: form.dmLink }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-sm text-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/40">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  A campanha será ativada imediatamente. Você pode pausar a qualquer momento.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={step === 0 ? handleClose : () => setStep((s) => s - 1)}
            className="gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="gap-1.5"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="gap-1.5 bg-gradient-to-r from-primary to-violet-600"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Ativar campanha
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onToggle,
  onDelete,
}: {
  campaign: CommentAutomation;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = campaign.status === "active";

  return (
    <div className={`glass-card rounded-2xl overflow-hidden transition-all ${isActive ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3 p-4">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-muted border border-border/40">
          {campaign.postThumbnailUrl ? (
            <img src={campaign.postThumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Instagram className="w-6 h-6 text-muted-foreground opacity-40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold px-2 py-0.5 ${
                isActive
                  ? "border-green-500/40 text-green-600 bg-green-500/5"
                  : "border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {isActive ? "Ativa" : "Pausada"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              Post: {campaign.igPostId.slice(0, 12)}…
            </span>
          </div>

          {campaign.postCaption && (
            <p className="text-xs text-foreground mt-1 line-clamp-1">
              {campaign.postCaption}
            </p>
          )}

          <div className="flex flex-wrap gap-1 mt-2">
            {campaign.keywords.map((kw) => (
              <span key={kw} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                #{kw}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Ver detalhes"
          >
            {expanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${
              isActive ? "text-green-600 hover:text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            title={isActive ? "Pausar" : "Ativar"}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex divide-x divide-border/40 border-t border-border/40 text-center">
        {[
          { label: "Comentários", value: campaign.commentsMatchedCount },
          { label: "DMs enviadas", value: campaign.dmsSentCount },
          { label: "Cliques no link", value: campaign.linkClicksCount },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 py-2">
            <p className="text-sm font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-muted/20">
          {[
            { icon: <MessageCircle className="w-3 h-3" />, label: "Resposta pública", value: campaign.publicReplyMessage },
            { icon: <Send className="w-3 h-3" />, label: "1ª DM", value: campaign.dmFirstMessage },
            ...(campaign.dmFollowupMessage ? [{ icon: <Send className="w-3 h-3" />, label: "Follow-up DM", value: campaign.dmFollowupMessage }] : []),
            ...(campaign.dmLink ? [{ icon: <Link2 className="w-3 h-3" />, label: "Link", value: campaign.dmLink }] : []),
          ].map(({ icon, label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-0.5">
                {icon} {label}
              </p>
              <p className="text-xs text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommentAutomations() {
  const [showNew, setShowNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const listQuery = trpc.commentAutomations.list.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();

  const toggleMutation = trpc.commentAutomations.toggleStatus.useMutation({
    onSuccess: () => utils.commentAutomations.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.commentAutomations.delete.useMutation({
    onSuccess: () => {
      utils.commentAutomations.list.invalidate();
      setDeleteTarget(null);
      toast.success("Campanha excluída.");
    },
    onError: (err) => toast.error(err.message),
  });

  const subscribeMutation = trpc.commentAutomations.subscribeWebhooks.useMutation({
    onSuccess: () => toast.success("Webhooks de comentários ativados com sucesso!"),
    onError: (err) => toast.error(err.message),
  });

  const campaigns = (listQuery.data ?? []) as CommentAutomation[];
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <AppLayout activeModule="commentAutomations">
      <div className="p-4 lg:p-6 max-w-[900px] mx-auto space-y-5">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-md shrink-0">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Automação de Comentários</h1>
              <p className="text-xs text-muted-foreground">
                {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""} · {activeCount} ativa{activeCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-xs"
              onClick={() => subscribeMutation.mutate()}
              disabled={subscribeMutation.isPending}
              title="Ativa o recebimento de webhooks de comentários para sua conta Instagram"
            >
              {subscribeMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CheckCircle2 className="w-3.5 h-3.5" />}
              Ativar webhooks
            </Button>
            <Button
              size="sm"
              className="gap-2 font-medium"
              onClick={() => setShowNew(true)}
            >
              <Plus className="w-4 h-4" />
              Nova campanha
            </Button>
          </div>
        </div>

        {/* How it works banner */}
        <div className="glass-card rounded-2xl px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Como funciona</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando alguém comentar a palavra-chave no post vinculado, o n8n recebe o webhook do Instagram,
              consulta <code className="bg-muted rounded px-1">/api/automations/match-comment</code> e dispara
              automaticamente a resposta pública e a DM configuradas aqui.
            </p>
          </div>
        </div>

        {/* List */}
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando campanhas…</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card rounded-2xl flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-600/10 border border-pink-500/20 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-pink-500 opacity-60" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Nenhuma campanha ainda</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Crie sua primeira campanha para começar a converter comentários em conversas no Direct.
              </p>
            </div>
            <Button onClick={() => setShowNew(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Criar primeira campanha
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onToggle={() => toggleMutation.mutate({ id: c.id })}
                onDelete={() => setDeleteTarget(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New campaign wizard */}
      <NewCampaignDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => utils.commentAutomations.list.invalidate()}
      />

      {/* Delete confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Excluir campanha?</DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. A campanha e todas as suas configurações serão permanentemente removidas.
          </DialogDescription>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteTarget !== null && deleteMutation.mutate({ id: deleteTarget })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}