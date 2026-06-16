import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Globe,
  ImageIcon,
  ArrowLeft,
  Search,
  Newspaper,
  ExternalLink,
  Zap,
  Clock,
  RefreshCw,
  Send,
  Settings2,
  Mail,
  Bell,
  Phone,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Article = {
  id: number;
  title: string;
  topic: string | null;
  sourceUrl: string | null;
  coverImageUrl: string | null;
  content: string;
  summary: string | null;
  status: "draft" | "published" | "archived";
  createdAt: Date;
};

type EnergyNewsItem = {
  title: string;
  url: string;
  source: string;
  excerpt: string | null;
  publishedAt: string | null;
};

type LinkedInDiagnosticCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

type LinkedInDiagnostic = {
  success: boolean;
  apiBaseUrl: string;
  apiVersion: string;
  tokenPresent: boolean;
  tokenPreview: string;
  configuredAuthorUrn: string;
  configuredAuthorUrnType: "person" | "organization" | "unknown";
  configuredAuthorUrnLooksValid: boolean;
  configuredAuthorUrnIsPlaceholder: boolean;
  detectedPersonUrn?: string;
  detectedMemberId?: string;
  detectedMemberName?: string;
  administeredOrganizationUrns: string[];
  recommendedAuthorUrns: string[];
  checks: LinkedInDiagnosticCheck[];
  nextSteps: string[];
};

// Coloque aqui seus sites favoritos de pesquisa sobre energia.
const FAVORITE_ENERGY_RESEARCH_SITES = [
  "https://canalsolar.com.br/",
  "https://www.portalsolar.com.br",
  "https://www.canalenergia.com.br",
  "https://agenciainfra.com/blog",
  "https://eixos.com.br/",
  "https://petronoticias.com.br/",
  "https://agenciabrasil.ebc.com.br/",
  "https://www.pv-magazine-brasil.com",
];

function parseFavoriteSites(value: string) {
  return value
    .split(/[\n,]+/)
    .map((site) => site.trim())
    .filter(Boolean)
    .map((site) => (/^https?:\/\//i.test(site) ? site : `https://${site}`));
}

function formatNewsDate(value: string | null) {
  if (!value) return "Data nao identificada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data nao identificada";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const statusConfig = {
  draft: { label: "Rascunho", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  published: { label: "Publicado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  archived: { label: "Arquivado", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

export default function Articles() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [researchTopic, setResearchTopic] = useState("energia");
  const [favoriteSites, setFavoriteSites] = useState(FAVORITE_ENERGY_RESEARCH_SITES.join("\n"));
  const [newsResults, setNewsResults] = useState<EnergyNewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<EnergyNewsItem | null>(null);
  const [linkedinDiagnostic, setLinkedinDiagnostic] = useState<LinkedInDiagnostic | null>(null);
  const [showLinkedInDiagnostic, setShowLinkedInDiagnostic] = useState(false);
  const [newsletterHtml, setNewsletterHtml] = useState<string | null>(null);
  const [newsletterSubject, setNewsletterSubject] = useState<string>("");
  const [showNewsletterDialog, setShowNewsletterDialog] = useState(false);

  const { data: articles = [], isLoading } = trpc.articles.getAll.useQuery();

  const researchNewsMutation = trpc.articles.researchEnergyNews.useMutation({
    onSuccess: (result) => {
      setNewsResults(result.items);
      setSelectedNews(result.items[0] ?? null);

      if (result.failedSites.length > 0) {
        toast.warning(`Pesquisa concluida, mas ${result.failedSites.length} site(s) falharam.`);
        return;
      }

      toast.success("Agente pesquisador encontrou as noticias mais recentes.");
    },
    onError: (err) => toast.error("Erro ao pesquisar noticias: " + err.message),
  });

  const generateFromNewsMutation = trpc.articles.generateFromNews.useMutation({
    onSuccess: (article) => {
      utils.articles.getAll.invalidate();
      utils.articles.getStats.invalidate();
      toast.success("Artigo e capa criados pelos agentes!");
      setShowGenerator(false);
      setSelectedArticle(article as Article);
      setIsEditing(false);
    },
    onError: (err) => toast.error("Erro ao criar artigo com capa: " + err.message),
  });

  const regenerateCoverMutation = trpc.articles.regenerateCover.useMutation({
    onSuccess: (result) => {
      utils.articles.getAll.invalidate();
      toast.success("Nova capa criada pelo agente designer!");
      if (selectedArticle) {
        setSelectedArticle({ ...selectedArticle, coverImageUrl: result.coverImageUrl });
      }
    },
    onError: (err) => toast.error("Erro no agente designer: " + err.message),
  });

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

  const publishLinkedInMutation = trpc.articles.publishLinkedIn.useMutation({
    onSuccess: (_result, variables) => {
      utils.articles.getAll.invalidate();
      utils.articles.getStats.invalidate();
      utils.posts.getAll.invalidate();
      utils.posts.getStats.invalidate();
      toast.success("Artigo publicado no LinkedIn!");
      setSelectedArticle((current) =>
        current && current.id === variables.id
          ? { ...current, status: "published" }
          : current
      );
    },
    onError: (err) => toast.error("Erro ao publicar no LinkedIn: " + err.message),
  });

  const diagnoseLinkedInMutation = trpc.articles.diagnoseLinkedIn.useMutation({
    onSuccess: (result) => {
      setLinkedinDiagnostic(result as LinkedInDiagnostic);
      setShowLinkedInDiagnostic(true);
      if (result.success) {
        toast.success("Diagnostico do LinkedIn concluido com sucesso.");
      } else {
        toast.warning("Diagnostico do LinkedIn concluido com alertas.");
      }
    },
    onError: (err) => toast.error("Erro ao diagnosticar LinkedIn: " + err.message),
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

  const generateNewsletterMutation = trpc.articles.generateNewsletter.useMutation({
    onSuccess: (result) => {
      setNewsletterHtml(result.htmlContent);
      setNewsletterSubject(result.subject);
      setShowNewsletterDialog(true);
    },
    onError: (err) => toast.error("Erro ao gerar newsletter: " + err.message),
  });

  // ── Digest settings state ──────────────────────────────────────────────────
  const [showDigestDialog, setShowDigestDialog] = useState(false);
  const [digestNumber, setDigestNumber] = useState("");
  const [digestHour, setDigestHour] = useState(6);
  const [digestMinute, setDigestMinute] = useState(50);
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestTemplateName, setDigestTemplateName] = useState("envio_de_noticias_diario");
  const [digestTemplateLang, setDigestTemplateLang] = useState("pt_BR");

  const { data: digestSettings, refetch: refetchDigest } = trpc.articles.getDigestSettings.useQuery(undefined, {
    enabled: showDigestDialog,
  });

  useEffect(() => {
    if (digestSettings) {
      setDigestNumber(digestSettings.whatsappNumber);
      setDigestHour(digestSettings.digestHour);
      setDigestMinute(digestSettings.digestMinute);
      setDigestEnabled(digestSettings.enabled);
      setDigestTemplateName(digestSettings.templateName);
      setDigestTemplateLang(digestSettings.templateLanguage);
    }
  }, [digestSettings]);

  const saveDigestMutation = trpc.articles.saveDigestSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações do digest salvas!");
      void refetchDigest();
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const { data: webhookInfo } =
    trpc.articles.getWebhookInfo.useQuery(undefined, { enabled: showDigestDialog });

  const { data: waDiag, refetch: refetchWaDiag, isFetching: isDiagging } =
    trpc.articles.diagnoseWhatsApp.useQuery(undefined, { enabled: showDigestDialog });

  const { data: waTemplates, isLoading: isLoadingTemplates, refetch: refetchTemplates } =
    trpc.articles.getWhatsAppTemplates.useQuery(undefined, { enabled: showDigestDialog });

  const [diagResult, setDiagResult] = useState<null | {
    wabaAccounts: Array<{ id: string; name: string }>;
    templateFound: boolean;
    templateLanguage?: string;
    templateStatus?: string;
    templateComponents?: unknown;
    testSendResults: Array<{ lang: string; ok: boolean; messageId?: string; error?: string }>;
  }>(null);

  const diagTemplateMutation = trpc.articles.diagnoseTemplate.useMutation({
    onSuccess: (data) => setDiagResult(data),
    onError: (err) => toast.error("Erro no diagnóstico: " + err.message),
  });

  const [debugResult, setDebugResult] = useState<null | {
    to: string;
    attempts: Array<{ lang: string; format: string; ok: boolean; messageId?: string; error?: string }>;
  }>(null);

  const debugFormatsMutation = trpc.articles.debugSendFormats.useMutation({
    onSuccess: (data) => {
      setDebugResult(data);
      const success = data.attempts.find(a => a.ok);
      if (success) toast.success(`Funcionou! lang=${success.lang} formato=${success.format}`);
      else toast.error("Nenhum formato funcionou — veja os detalhes abaixo");
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const testDigestMutation = trpc.articles.sendTestDigest.useMutation({
    onSuccess: (data) => toast.success(`Digest enviado para +${data.to} (${data.sent} notícias). ID: ${data.messageId ?? "n/a"}`),
    onError: (err) => toast.error("Falha no envio de teste: " + err.message),
  });

  const { data: schedulerStatus, refetch: refetchStatus } = trpc.articles.digestSchedulerStatus.useQuery(undefined, {
    enabled: showDigestDialog,
    refetchInterval: 30_000,
  });

  const resetDigestMutation = trpc.articles.resetDigestToday.useMutation({
    onSuccess: () => { toast.success("Resetado! O envio automático vai tentar na próxima janela."); void refetchDigest(); void refetchStatus(); },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveDigest = () => {
    if (!/^\d{10,15}$/.test(digestNumber)) {
      toast.error("Número inválido. Use apenas dígitos com DDI (ex: 5527981244658)");
      return;
    }
    saveDigestMutation.mutate({
      whatsappNumber: digestNumber,
      digestHour,
      digestMinute,
      enabled: digestEnabled,
    });
  };

  const handleGenerate = () => {
    if (!topic.trim()) { toast.error("Digite um tema para o artigo"); return; }
    generateMutation.mutate({
      topic: topic.trim(),
      sourceUrl: sourceUrl.trim() || undefined,
    });
  };

  const handleResearchNews = () => {
    const sites = parseFavoriteSites(favoriteSites);

    if (sites.length === 0) {
      toast.error("Adicione pelo menos um site para a pesquisa.");
      return;
    }

    setNewsResults([]);
    setSelectedNews(null);
    researchNewsMutation.mutate({
      sites,
      topic: researchTopic.trim() || "energia",
    });
  };

  const handleGenerateFromNews = () => {
    if (!selectedNews) {
      toast.error("Escolha uma noticia antes de enviar para o redator.");
      return;
    }

    generateFromNewsMutation.mutate({ news: selectedNews });
  };

  const handleRegenerateCover = (article: Article) => {
    regenerateCoverMutation.mutate({ id: article.id });
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
    const cover = article.coverImageUrl ? `![Capa do artigo](${article.coverImageUrl})\n\n` : "";
    const content = `${cover}# ${article.title}\n\n${article.content}`;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${article.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Artigo baixado!");
  };

  const handlePublishLinkedIn = (article: Article) => {
    publishLinkedInMutation.mutate({ id: article.id });
  };

  const handleDiagnoseLinkedIn = () => {
    diagnoseLinkedInMutation.mutate();
  };

  const handleCreateNewsletter = (article: Article) => {
    generateNewsletterMutation.mutate({ id: article.id });
  };

  const handleDownloadNewsletter = () => {
    if (!newsletterHtml) return;
    const blob = new Blob([newsletterHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${newsletterSubject.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-newsletter.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Newsletter baixada!");
  };

  const handleCopyNewsletterHtml = () => {
    if (!newsletterHtml) return;
    navigator.clipboard.writeText(newsletterHtml);
    toast.success("HTML copiado!");
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
              <h2 className="font-semibold text-sm text-foreground">{t("articlesTitle")}</h2>
              <span className="text-xs text-muted-foreground">({articles.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowDigestDialog(true)}
                className="h-8 w-8 p-0"
                title="Configurar digest diário WhatsApp"
              >
                <Bell className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={() => setShowGenerator(true)}
                className="h-8 gap-1.5 text-xs bg-emerald-600 text-white border-0 hover:bg-emerald-700"
              >
                <Newspaper className="w-3.5 h-3.5" />
                {t("articlesResearchBtn")}
              </Button>
            </div>
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
                  {article.coverImageUrl && (
                    <img
                      src={article.coverImageUrl}
                      alt="Capa do artigo"
                      className="mb-2 h-24 w-full rounded-lg object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
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
              <div className="flex flex-shrink-0 items-center gap-1.5 overflow-x-auto scrollbar-thin">
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRegenerateCover(selectedArticle)}
                      className="h-8 gap-1.5 text-xs"
                      disabled={regenerateCoverMutation.isPending}
                    >
                      {regenerateCoverMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Capa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(selectedArticle)} className="h-8 gap-1.5 text-xs">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(selectedArticle.content)} className="h-8">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(selectedArticle)} className="h-8">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCreateNewsletter(selectedArticle)}
                      disabled={generateNewsletterMutation.isPending}
                      className="h-8 gap-1.5 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                    >
                      {generateNewsletterMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Mail className="w-3.5 h-3.5" />
                      )}
                      Newsletter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDiagnoseLinkedIn}
                      disabled={diagnoseLinkedInMutation.isPending}
                      className="h-8 gap-1.5 text-xs"
                    >
                      {diagnoseLinkedInMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Settings2 className="w-3.5 h-3.5" />
                      )}
                      LinkedIn
                    </Button>
                    {selectedArticle.status !== "published" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePublishLinkedIn(selectedArticle)}
                        disabled={publishLinkedInMutation.isPending}
                        className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      >
                        {publishLinkedInMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Globe className="w-3.5 h-3.5" />
                        )}{" "}
                        Publicar
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
                  {selectedArticle.coverImageUrl ? (
                    <div className="mb-6 overflow-hidden rounded-lg border border-border/40 bg-background/70 article-cover-wrap">
                      <img
                        src={selectedArticle.coverImageUrl}
                        alt={`Capa do artigo ${selectedArticle.title}`}
                        className="aspect-square w-full object-cover sm:aspect-[16/9]"
                        onError={(e) => {
                          const wrap = (e.currentTarget as HTMLImageElement).closest(".article-cover-wrap");
                          if (wrap) (wrap as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-dashed border-border/60 bg-background/70 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Este artigo ainda nao tem capa</p>
                          <p className="text-xs text-muted-foreground">Gere uma imagem ultrarrealista para postar no LinkedIn.</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleRegenerateCover(selectedArticle)}
                        disabled={regenerateCoverMutation.isPending}
                        className="shrink-0 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        {regenerateCoverMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                        Gerar capa
                      </Button>
                    </div>
                  )}
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
        <DialogContent className="glass-card grid h-[min(94vh,900px)] w-[min(96vw,1180px)] max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-border/50 sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              Agente de Artigos de Energia
            </DialogTitle>
          </DialogHeader>
          <div className="grid min-h-0 gap-5 overflow-y-auto pr-1 scrollbar-thin lg:grid-cols-[420px_minmax(0,1fr)] lg:overflow-hidden lg:pr-0">
            <div className="space-y-5 lg:overflow-y-auto lg:pr-1 lg:scrollbar-thin">
              <section className="space-y-4 rounded-lg border border-border/50 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Agente pesquisador</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Busque 5 noticias recentes nas fontes abaixo.
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Search className="w-3 h-3" />
                    Pesquisa
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                    Sites favoritos
                  </label>
                  <Textarea
                    value={favoriteSites}
                    onChange={(e) => setFavoriteSites(e.target.value)}
                    className="min-h-32 resize-none glass border-border/50 text-sm"
                    placeholder={"https://site-de-energia.com.br\nhttps://outro-site.com/noticias"}
                    disabled={researchNewsMutation.isPending || generateFromNewsMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tambem da para editar direto no codigo em FAVORITE_ENERGY_RESEARCH_SITES.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    Termo de pesquisa
                  </label>
                  <Input
                    value={researchTopic}
                    onChange={(e) => setResearchTopic(e.target.value)}
                    placeholder="energia, solar, eolica..."
                    className="glass border-border/50 focus:border-emerald-500/50"
                    disabled={researchNewsMutation.isPending || generateFromNewsMutation.isPending}
                  />
                </div>

                <Button
                  onClick={handleResearchNews}
                  disabled={researchNewsMutation.isPending || generateFromNewsMutation.isPending}
                  className="w-full gap-2 border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {researchNewsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Pesquisando noticias...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Buscar 5 noticias
                    </>
                  )}
                </Button>
              </section>

              <section className="space-y-4 rounded-lg border border-border/50 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Geracao manual</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Crie um artigo por tema ou URL de referencia.
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Plus className="w-3 h-3" />
                    Livre
                  </Badge>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                    Tema do artigo
                  </label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ex: Como a energia solar reduz custos"
                    className="glass border-border/50 focus:border-emerald-500/50"
                    disabled={generateMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Link className="w-3.5 h-3.5 text-muted-foreground" />
                    URL de referencia
                  </label>
                  <Input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://exemplo.com/noticia"
                    type="url"
                    className="glass border-border/50 focus:border-emerald-500/50"
                    disabled={generateMutation.isPending}
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!topic.trim() || generateMutation.isPending}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando artigo...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Gerar por tema
                    </>
                  )}
                </Button>
              </section>
            </div>

            <section className="flex min-h-[520px] flex-col rounded-lg border border-border/50 bg-background/70 p-4 lg:min-h-0">
              <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Noticias encontradas</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Escolha uma noticia e envie para o redator.
                  </p>
                </div>
                <Badge variant="outline">{newsResults.length}/5</Badge>
              </div>

              <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
                {researchNewsMutation.isPending ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div key={item} className="rounded-lg border border-border/30 p-4">
                        <div className="h-3 w-28 rounded-full bg-muted shimmer" />
                        <div className="mt-4 h-4 rounded-full bg-muted shimmer" />
                        <div className="mt-2 h-4 w-4/5 rounded-full bg-muted shimmer" />
                        <div className="mt-3 h-3 w-2/3 rounded-full bg-muted shimmer" />
                      </div>
                    ))}
                  </div>
                ) : newsResults.length === 0 ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30">
                      <Newspaper className="h-7 w-7" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhuma pesquisa feita ainda</p>
                    <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                      Adicione suas fontes favoritas e busque noticias recentes sobre energia.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pr-1">
                    {newsResults.map((news, index) => {
                      const isSelected = selectedNews?.url === news.url;

                      return (
                        <article
                          key={news.url}
                          className={cn(
                            "rounded-lg border p-4 transition-all",
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20"
                              : "border-border/40 bg-background/70 hover:border-emerald-300"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedNews(news)}
                            className="w-full text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <Badge variant={isSelected ? "default" : "outline"} className={isSelected ? "bg-emerald-600 text-white" : ""}>
                                #{index + 1}
                              </Badge>
                              <span className="inline-flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {news.source}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatNewsDate(news.publishedAt)}
                              </span>
                            </div>
                            <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">
                              {news.title}
                            </h3>
                            {news.excerpt && (
                              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {news.excerpt}
                              </p>
                            )}
                          </button>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className={cn(
                              "text-xs font-medium",
                              isSelected ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
                            )}>
                              {isSelected ? "Selecionada para o redator" : "Clique para selecionar"}
                            </span>
                            <a
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                            >
                              Fonte
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-border/40 pt-4">
                <Button
                  onClick={handleGenerateFromNews}
                  disabled={!selectedNews || generateFromNewsMutation.isPending || researchNewsMutation.isPending}
                  className="w-full gap-2 border-0 bg-slate-900 text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                >
                  {generateFromNewsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redator e designer trabalhando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Criar artigo com capa
                    </>
                  )}
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkedInDiagnostic} onOpenChange={setShowLinkedInDiagnostic}>
        <DialogContent className="glass-card max-h-[90vh] max-w-3xl overflow-y-auto border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              Diagnostico do LinkedIn
            </DialogTitle>
          </DialogHeader>

          {linkedinDiagnostic ? (
            <div className="space-y-5">
              <div
                className={cn(
                  "rounded-lg border p-4",
                  linkedinDiagnostic.success
                    ? "border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20"
                    : "border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20"
                )}
              >
                <p className="text-sm font-semibold text-foreground">
                  {linkedinDiagnostic.success
                    ? "Configuracao pronta para publicar"
                    : "Configuracao com pendencias"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  API: {linkedinDiagnostic.apiBaseUrl} · versao {linkedinDiagnostic.apiVersion}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/50 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Token
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {linkedinDiagnostic.tokenPresent
                      ? linkedinDiagnostic.tokenPreview
                      : "Nao configurado"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Author URN atual
                  </p>
                  <p className="mt-2 break-all text-sm text-foreground">
                    {linkedinDiagnostic.configuredAuthorUrn || "Nao configurado"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Checks
                </p>
                {linkedinDiagnostic.checks.map((check) => (
                  <div key={check.name} className="rounded-lg border border-border/50 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{check.name}</p>
                      <Badge
                        variant={check.ok ? "default" : "outline"}
                        className={check.ok ? "bg-emerald-600 text-white" : "text-amber-700"}
                      >
                        {check.ok ? "OK" : "Ajustar"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/50 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pessoa detectada pelo token
                  </p>
                  <p className="mt-2 break-all text-sm text-foreground">
                    {linkedinDiagnostic.detectedPersonUrn || "Nao detectada"}
                  </p>
                  {linkedinDiagnostic.detectedMemberName ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {linkedinDiagnostic.detectedMemberName}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-border/50 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Organizacoes administradas
                  </p>
                  <div className="mt-2 space-y-1">
                    {linkedinDiagnostic.administeredOrganizationUrns.length > 0 ? (
                      linkedinDiagnostic.administeredOrganizationUrns.map((urn) => (
                        <p key={urn} className="break-all text-sm text-foreground">
                          {urn}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma organizacao retornada.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Proximos passos
                </p>
                <div className="mt-2 space-y-2">
                  {linkedinDiagnostic.nextSteps.map((step, index) => (
                    <p key={`${index}-${step}`} className="text-sm text-foreground">
                      {index + 1}. {step}
                    </p>
                  ))}
                </div>
              </div>

              {linkedinDiagnostic.recommendedAuthorUrns.length > 0 ? (
                <div className="rounded-lg border border-border/50 bg-background/70 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Author URNs recomendadas
                  </p>
                  <div className="mt-2 space-y-1">
                    {linkedinDiagnostic.recommendedAuthorUrns.map((urn) => (
                      <p key={urn} className="break-all text-sm text-foreground">
                        {urn}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Newsletter preview dialog */}
      <Dialog open={showNewsletterDialog} onOpenChange={setShowNewsletterDialog}>
        <DialogContent className="glass-card flex flex-col h-[min(94vh,860px)] w-[min(96vw,780px)] max-w-none border-border/50 sm:max-w-none p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="truncate">Newsletter — {newsletterSubject}</span>
              </DialogTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyNewsletterHtml}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar HTML
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownloadNewsletter}
                  className="h-8 gap-1.5 text-xs bg-violet-600 text-white hover:bg-violet-700 border-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar .html
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden bg-[#f1f5f9]">
            {newsletterHtml && (
              <iframe
                srcDoc={newsletterHtml}
                title="Preview da newsletter"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Digest settings dialog */}
      <Dialog open={showDigestDialog} onOpenChange={setShowDigestDialog}>
        <DialogContent className="glass-card max-w-md border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-white" />
              </div>
              Digest diário de notícias — WhatsApp
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Todos os dias no horário configurado, o sistema envia as 5 principais notícias de energia para o WhatsApp.
              Responda com o número (1-5) para gerar artigo + carrossel automaticamente.
            </p>

            {/* Phone number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Número WhatsApp (com DDI)
              </label>
              <Input
                value={digestNumber}
                onChange={(e) => setDigestNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="5527981244658"
                className="glass border-border/50 focus:border-emerald-500/50 font-mono"
              />
              <p className="text-xs text-muted-foreground">Somente dígitos. Ex: 5527981244658</p>
            </div>

            {/* Hour/minute */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Horário de envio
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={digestHour}
                  onChange={(e) => setDigestHour(parseInt(e.target.value, 10))}
                  className="flex h-9 rounded-md border border-border/50 bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}</option>
                  ))}
                </select>
                <span className="text-muted-foreground font-semibold">:</span>
                <select
                  value={digestMinute}
                  onChange={(e) => setDigestMinute(parseInt(e.target.value, 10))}
                  className="flex h-9 rounded-md border border-border/50 bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {[0, 10, 15, 20, 30, 40, 45, 50].map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">(horário de Fortaleza)</span>
              </div>
            </div>

            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Digest ativo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {digestEnabled ? "Enviando todos os dias" : "Envio pausado"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDigestEnabled(!digestEnabled)}
                className="text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                {digestEnabled
                  ? <ToggleRight className="w-8 h-8" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                }
              </button>
            </div>

            {/* Scheduler status panel */}
            {schedulerStatus && (
              <div className={cn(
                "rounded-lg border p-3 text-xs space-y-1.5",
                schedulerStatus.status === "sent_today"
                  ? "border-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-950/20"
                  : schedulerStatus.status === "in_window"
                  ? "border-blue-400/50 bg-blue-50/60 dark:bg-blue-950/20"
                  : schedulerStatus.status === "window_passed"
                  ? "border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20"
                  : "border-border/50 bg-background/60"
              )}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">
                    {schedulerStatus.status === "sent_today" && "✅ Enviado hoje"}
                    {schedulerStatus.status === "in_window" && "🔄 Enviando..."}
                    {schedulerStatus.status === "window_passed" && "⚠️ Janela passou"}
                    {schedulerStatus.status === "waiting" && "⏳ Aguardando"}
                    {schedulerStatus.status === "no_settings" && "⚙️ Sem configuração"}
                  </p>
                  <span className="text-muted-foreground font-mono">{schedulerStatus.serverTime} ({schedulerStatus.timezone?.split("/")[1] ?? schedulerStatus.timezone})</span>
                </div>
                <p className="text-muted-foreground">{schedulerStatus.message}</p>
                {(schedulerStatus.status === "sent_today" || schedulerStatus.status === "window_passed") && (
                  <button
                    onClick={() => resetDigestMutation.mutate()}
                    disabled={resetDigestMutation.isPending}
                    className="text-primary hover:underline text-xs"
                  >
                    {resetDigestMutation.isPending ? "Resetando..." : "↺ Resetar para enviar hoje novamente"}
                  </button>
                )}
              </div>
            )}

            {/* Webhook info panel */}
            {webhookInfo && (
              <div className={cn(
                "rounded-lg border p-3 text-xs space-y-2",
                webhookInfo.isLocalhost
                  ? "border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20"
                  : "border-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-950/20"
              )}>
                <p className="font-semibold text-foreground">
                  {webhookInfo.isLocalhost ? "⚠️ Webhook (localhost — não recebe respostas externas)" : "✅ Webhook configurado"}
                </p>
                <div className="space-y-1">
                  <p className="text-muted-foreground">URL do webhook:</p>
                  <code className="block bg-background/70 border border-border/50 rounded px-2 py-1 font-mono text-[10px] break-all select-all">{webhookInfo.webhookUrl}</code>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Token de verificação:</p>
                  <code className="block bg-background/70 border border-border/50 rounded px-2 py-1 font-mono text-[10px] select-all">{webhookInfo.verifyToken}</code>
                </div>
                {webhookInfo.isLocalhost && (
                  <p className="text-amber-700 dark:text-amber-400 text-[10px]">
                    Para receber respostas: defina APP_BASE_URL no .env com a URL pública do servidor e registre o webhook no painel Meta → WhatsApp → Configuração → Webhooks.
                  </p>
                )}
              </div>
            )}

            {/* WhatsApp sender diagnostics */}
            {waDiag && (
              <div className={cn(
                "rounded-lg border p-3 text-xs space-y-1",
                waDiag.ok && waDiag.accountMode !== "SANDBOX"
                  ? "border-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-950/20"
                  : waDiag.accountMode === "SANDBOX"
                  ? "border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20"
                  : "border-red-400/50 bg-red-50/60 dark:bg-red-950/20"
              )}>
                <p className="font-semibold text-foreground">
                  {waDiag.ok && waDiag.accountMode !== "SANDBOX" ? "✅ Número remetente ativo" : waDiag.accountMode === "SANDBOX" ? "⚠️ Modo SANDBOX" : "❌ Erro"}
                </p>
                {waDiag.senderNumber && <p className="text-muted-foreground">Remetente: <span className="font-mono">{waDiag.senderNumber}</span> · {waDiag.verifiedName} · {waDiag.qualityRating}</p>}
                {waDiag.accountMode && <p className={waDiag.accountMode === "SANDBOX" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}>Modo: {waDiag.accountMode}</p>}
                {waDiag.error && <p className="text-red-600 dark:text-red-400">{waDiag.error}</p>}
                <button onClick={() => void refetchWaDiag()} className="text-primary hover:underline" disabled={isDiagging}>
                  {isDiagging ? "Consultando..." : "Atualizar"}
                </button>
              </div>
            )}

            {/* Template diagnostics result */}
            {diagResult && (
              <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs space-y-2">
                <p className="font-semibold text-foreground">Diagnóstico do template</p>
                <p className="text-muted-foreground">
                  WABAs encontradas: <span className="text-foreground">{diagResult.wabaAccounts.map(w => w.name || w.id).join(", ") || "nenhuma"}</span>
                </p>
                <p className="text-muted-foreground">
                  Template <span className="font-mono">envio_de_noticias_diario</span>:{" "}
                  {diagResult.templateFound
                    ? <span className="text-emerald-600 dark:text-emerald-400">✅ encontrado · idioma: {diagResult.templateLanguage} · status: {diagResult.templateStatus}</span>
                    : <span className="text-red-600 dark:text-red-400">❌ não encontrado nas WABAs acessíveis</span>
                  }
                </p>
                {diagResult.templateComponents != null && (
                  <p className="text-muted-foreground break-all">
                    Componentes: <span className="font-mono text-foreground">{JSON.stringify(diagResult.templateComponents as object).slice(0, 300)}</span>
                  </p>
                )}
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Testes de envio:</p>
                  {diagResult.testSendResults.map((r) => (
                    <p key={r.lang} className={r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                      {r.ok ? "✅" : "❌"} lang={r.lang}: {r.ok ? `ID ${r.messageId ?? "ok"}` : r.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Debug formats result */}
            {debugResult && (
              <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs space-y-2">
                <p className="font-semibold text-foreground">Debug de formatos — destino: <span className="font-mono">{debugResult.to}</span></p>
                {debugResult.attempts.map((a, i) => (
                  <p key={i} className={a.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {a.ok ? "✅" : "❌"} lang={a.lang} fmt={a.format}: {a.ok ? `ID ${a.messageId ?? "ok"}` : a.error}
                  </p>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testDigestMutation.mutate()}
                disabled={testDigestMutation.isPending || !digestSettings}
                className="gap-1.5 text-xs"
                title="Requer configurações salvas primeiro"
              >
                {testDigestMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FlaskConical className="w-3.5 h-3.5" />
                }
                Testar envio
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => diagTemplateMutation.mutate()}
                disabled={diagTemplateMutation.isPending}
                className="gap-1.5 text-xs"
              >
                {diagTemplateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings2 className="w-3.5 h-3.5" />}
                Diagnosticar
              </Button>
              <Button
                onClick={handleSaveDigest}
                disabled={saveDigestMutation.isPending}
                className="flex-1 gap-1.5 text-xs bg-emerald-600 text-white border-0 hover:bg-emerald-700"
              >
                {saveDigestMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Check className="w-3.5 h-3.5" />
                }
                Salvar configurações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
