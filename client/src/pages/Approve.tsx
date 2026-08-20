import { useState } from "react";
import { useParams } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CheckCircle2, MessageSquareWarning, Loader2, AlertTriangle } from "lucide-react";

function ApproveShell({ children, brandName }: { children: React.ReactNode; brandName?: string | null }) {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center text-xs text-muted-foreground uppercase tracking-wide">
          Revisão de conteúdo{brandName ? ` — ${brandName}` : ""}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Approve() {
  const { token } = useParams<{ token: string }>();
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.contentApproval.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");

  const respondMutation = trpc.contentApproval.respond.useMutation({
    onSuccess: () => {
      toast.success("Resposta enviada!");
      utils.contentApproval.getByToken.invalidate({ token: token ?? "" });
      setShowCommentBox(false);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <ApproveShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </ApproveShell>
    );
  }

  if (error || !data) {
    return (
      <ApproveShell>
        <div className="bg-card border rounded-2xl p-10 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-semibold">Link inválido ou expirado</h1>
          <p className="text-sm text-muted-foreground">
            Peça pra quem te enviou gerar um novo link de revisão.
          </p>
        </div>
      </ApproveShell>
    );
  }

  const isPending = data.status === "pending";

  return (
    <ApproveShell brandName={data.brand?.companyName}>
      {/* Conteúdo */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        {data.contentType === "article" && data.article && (
          <div>
            {data.article.coverImageUrl && (
              <img
                src={data.article.coverImageUrl}
                alt=""
                className="w-full h-56 object-cover"
              />
            )}
            <div className="p-6 space-y-4">
              <h1 className="text-2xl font-bold leading-tight">{data.article.title}</h1>
              {data.article.summary && (
                <p className="text-sm text-muted-foreground">{data.article.summary}</p>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none pt-2 border-t">
                <Streamdown>{data.article.content}</Streamdown>
              </div>
            </div>
          </div>
        )}

        {data.contentType === "carousel" && data.carousel && (
          <div className="p-6 space-y-5">
            <p className="text-lg font-semibold leading-snug">{data.carousel.hook}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.carousel.slides.map((slide, i) => (
                <div key={i} className="rounded-xl overflow-hidden border bg-muted/40">
                  {(slide.renderedImageUrl || slide.imageUrl) ? (
                    <img
                      src={slide.renderedImageUrl || slide.imageUrl}
                      alt={slide.title || `Slide ${i + 1}`}
                      className="w-full aspect-[4/5] object-cover"
                    />
                  ) : (
                    <div className="aspect-[4/5] flex flex-col items-center justify-center p-3 text-center">
                      <p className="text-xs font-semibold">{slide.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-4">{slide.body}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="pt-3 border-t space-y-2">
              <p className="text-sm text-muted-foreground whitespace-pre-line">{data.carousel.caption}</p>
              <p className="text-sm font-medium">{data.carousel.finalCta}</p>
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="bg-card border rounded-2xl p-5">
        {!isPending ? (
          <div className={cn(
            "flex items-start gap-3 rounded-xl p-4",
            data.status === "approved"
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
          )}>
            {data.status === "approved"
              ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              : <MessageSquareWarning className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                {data.status === "approved" ? "Você aprovou este conteúdo" : "Você pediu alterações"}
              </p>
              {data.clientComment && (
                <p className="text-sm opacity-90">"{data.clientComment}"</p>
              )}
              <button
                onClick={() => setShowCommentBox(true)}
                className="text-xs underline opacity-70 hover:opacity-100 mt-1"
              >
                Mudar de ideia
              </button>
            </div>
          </div>
        ) : null}

        {(isPending || showCommentBox) && (
          <div className="space-y-3">
            {showCommentBox && !isPending && (
              <p className="text-xs text-muted-foreground">Você pode registrar uma nova resposta abaixo.</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={respondMutation.isPending}
                onClick={() => respondMutation.mutate({ token: token ?? "", decision: "approved" })}
              >
                <CheckCircle2 className="w-4 h-4" />
                Aprovar
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={respondMutation.isPending}
                onClick={() => setShowCommentBox(true)}
              >
                <MessageSquareWarning className="w-4 h-4" />
                Solicitar alterações
              </Button>
            </div>
            {showCommentBox && (
              <div className="space-y-2 pt-1">
                <Textarea
                  placeholder="O que precisa mudar?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <Button
                  size="sm"
                  disabled={respondMutation.isPending || !comment.trim()}
                  onClick={() => respondMutation.mutate({ token: token ?? "", decision: "changes_requested", comment: comment.trim() })}
                >
                  {respondMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar comentário"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </ApproveShell>
  );
}
