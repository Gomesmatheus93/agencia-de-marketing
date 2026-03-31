import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import {
  FileText,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Link,
  Tag,
  Calendar,
  BookOpen,
  Copy,
  Download,
  Archive,
  Globe,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Article = {
  id: number;
  title: string;
  topic: string | null;
  sourceUrl: string | null;
  content: string;
  summary: string | null;
  status: "draft" | "published" | "archived";
  createdAt: Date;
};

const statusConfig = {
  draft: { label: "Rascunho", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  published: { label: "Publicado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  archived: { label: "Arquivado", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

export default function Articles() {
  const utils = trpc.useUtils();
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);

  const { data: articles = [], isLoading } = trpc.articles.getAll.useQuery();
  const { data: webhookSettings } = trpc.settings.getWebhooks.useQuery();

  const generateMutation = trpc.articles.generate.useMutation({
    onSuccess: (article) => {
      utils.articles.getAll.invalidate();
      utils.articles.getStats.invalidate();
      toast.success("Artigo gerado com sucesso!");
      setTopic("");
      setSourceUrl("");
      setShowGenerator(false);
      setSelectedArticle(article as Article);
    },
    onError: (err) => toast.error("Erro ao gerar artigo: " + err.message),
  });

  const updateMutation = trpc.articles.update.useMutation({
    onSuccess: () => {
      utils.articles.getAll.invalidate();
      toast.success("Artigo atualizado!");
      setIsEditing(false);
      if (selectedArticle) {
        setSelectedArticle({ ...selectedArticle, content: editContent, title: editTitle });
      }
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteMutation = trpc.articles.delete.useMutation({
    onSuccess: () => {
      utils.articles.getAll.invalidate();
      utils.articles.getStats.invalidate();
      toast.success("Artigo excluído");
      setSelectedArticle(null);
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });

  const handleGenerate = () => {
    if (!topic.trim()) { toast.error("Digite um tema para o artigo"); return; }
    generateMutation.mutate({
      topic: topic.trim(),
      sourceUrl: sourceUrl.trim() || undefined,
      useWebhook: webhookSettings?.hasArticle ?? false,
    });
  };

  const startEdit = (article: Article) => {
    setEditContent(article.content);
    setEditTitle(article.title);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!selectedArticle) return;
    updateMutation.mutate({ id: selectedArticle.id, content: editContent, title: editTitle });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Conteúdo copiado!");
  };

  const handleDownload = (article: Article) => {
    const content = `# ${article.title}\n\n${article.content}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${article.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Artigo baixado!");
  };

  const handleStatusChange = (article: Article, status: "draft" | "published" | "archived") => {
    updateMutation.mutate({ id: article.id, status });
    if (selectedArticle?.id === article.id) {
      setSelectedArticle({ ...selectedArticle, status });
    }
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <AppLayout activeModule="articles">
      <div className="flex h-screen overflow-hidden">
        {/* Articles list */}
        <div className={cn(
          "flex flex-col border-r border-border/30 bg-background/40 backdrop-blur-sm transition-all duration-300",
          selectedArticle ? "hidden lg:flex lg:w-80" : "flex-1 lg:w-80"
        )}>
          <div className="p-4 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-semibold text-sm text-foreground">Artigos</h2>
              <span className="text-xs text-muted-foreground">({articles.length})</span>
            </div>
            <Button
              size="sm"
              onClick={() => setShowGenerator(true)}
              className="h-8 gap-1.5 text-xs gradient-primary text-white border-0 hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 shimmer rounded-xl" />)}
              </div>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <FileText className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum artigo ainda</p>
                <p className="text-xs text-muted-foreground/60">Clique em "Novo" para gerar</p>
              </div>
            ) : (
              articles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticle(article as Article)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all duration-150 space-y-1.5",
                    selectedArticle?.id === article.id
                      ? "bg-primary/10"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{article.title}</p>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium", statusConfig[article.status].color)}>
                      {statusConfig[article.status].label}
                    </span>
                  </div>
                  {article.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {formatDate(article.createdAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Article viewer/editor */}
        {selectedArticle ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Article header */}
            <div className="px-4 py-3 border-b border-border/30 glass flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedArticle(null)}
                className="w-8 h-8 rounded-lg lg:hidden flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="font-semibold text-sm h-8 glass border-border/50"
                  />
                ) : (
                  <h2 className="font-semibold text-sm text-foreground truncate">{selectedArticle.title}</h2>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", statusConfig[selectedArticle.status].color)}>
                    {statusConfig[selectedArticle.status].label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(selectedArticle.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} className="h-8 gap-1.5 text-xs gradient-primary text-white border-0">
                      {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-8">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(selectedArticle)} className="h-8 gap-1.5 text-xs">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(selectedArticle.content)} className="h-8">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(selectedArticle)} className="h-8">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    {selectedArticle.status !== "published" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStatusChange(selectedArticle, "published")}
                        className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        <Globe className="w-3.5 h-3.5" /> Publicar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate({ id: selectedArticle.id })}
                      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/5"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Article content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
              {isEditing ? (
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[600px] font-mono text-sm glass border-border/50 rounded-xl resize-none"
                />
              ) : (
                <div className="max-w-3xl mx-auto">
                  {selectedArticle.topic && (
                    <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                      <Tag className="w-3.5 h-3.5" />
                      <span>Tema: {selectedArticle.topic}</span>
                      {selectedArticle.sourceUrl && (
                        <>
                          <span>·</span>
                          <Link className="w-3.5 h-3.5" />
                          <a href={selectedArticle.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-xs">
                            Fonte
                          </a>
                        </>
                      )}
                    </div>
                  )}
                  {selectedArticle.summary && (
                    <div className="glass-card p-4 mb-6 border-l-4 border-primary">
                      <p className="text-sm text-muted-foreground italic">{selectedArticle.summary}</p>
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{selectedArticle.content}</Streamdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto opacity-40">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <p className="text-muted-foreground text-sm">Selecione um artigo para visualizar</p>
            </div>
          </div>
        )}
      </div>

      {/* Generator Dialog */}
      <Dialog open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogContent className="glass-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              Gerar Novo Artigo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                Tema do artigo *
              </label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Marketing digital para pequenas empresas"
                className="glass border-border/50 focus:border-primary/50"
                disabled={generateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5 text-muted-foreground" />
                URL de referência (opcional)
              </label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://exemplo.com/noticia"
                type="url"
                className="glass border-border/50 focus:border-primary/50"
                disabled={generateMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">Cole um link de notícia ou artigo de referência</p>
            </div>

            {webhookSettings?.hasArticle && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 rounded-lg">
                <Sparkles className="w-3.5 h-3.5" />
                Webhook n8n configurado — será usado para geração
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowGenerator(false)} className="flex-1" disabled={generateMutation.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!topic.trim() || generateMutation.isPending}
                className="flex-1 gradient-primary text-white border-0 hover:opacity-90 gap-2"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Gerar Artigo</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
