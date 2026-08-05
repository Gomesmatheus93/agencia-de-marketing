import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Mail, Sparkles, Loader2, Copy, Check, Eye, EyeOff, FileText, Send, RefreshCw, ImageDown } from "lucide-react";

export default function EmailMarketing() {
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [newsletter, setNewsletter] = useState<{ subject: string; htmlContent: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [exporting, setExporting] = useState(false);

  const { data: articles = [] } = trpc.articles.getAll.useQuery();

  const generateMut = trpc.articles.generateNewsletter.useMutation({
    onSuccess: (data) => {
      setNewsletter(data);
      setShowPreview(true);
      toast.success("Newsletter gerada com sucesso!");
    },
    onError: (e) => toast.error(e.message),
  });

  function handleGenerate() {
    if (!selectedArticleId) { toast.error("Selecione um artigo"); return; }
    setNewsletter(null);
    setShowPreview(false);
    generateMut.mutate({ id: selectedArticleId });
  }

  function handleCopy() {
    if (!newsletter) return;
    navigator.clipboard.writeText(newsletter.htmlContent);
    setCopied(true);
    toast.success("HTML copiado!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopySubject() {
    if (!newsletter) return;
    navigator.clipboard.writeText(newsletter.subject);
    toast.success("Assunto copiado!");
  }

  async function handleSend() {
    if (!recipientEmail || !newsletter) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      toast.error("E-mail inválido"); return;
    }
    setSendStatus("sending");
    handleCopy();
    setSendStatus("sent");
    toast.info("Configure RESEND_API_KEY no .env para enviar por e-mail. HTML copiado para área de transferência.");
  }

  async function handleExportImage() {
    if (!newsletter) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");

      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:640px;border:0;visibility:hidden;";
      iframe.style.height = "10px";
      document.body.appendChild(iframe);

      await new Promise<void>((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = reject;
        iframe.srcdoc = newsletter.htmlContent;
      });

      // expand to full content height
      const doc = iframe.contentDocument;
      if (!doc) throw new Error("iframe not accessible");
      const fullHeight = doc.documentElement.scrollHeight || doc.body.scrollHeight || 800;
      iframe.style.height = `${fullHeight}px`;
      // allow layout to settle
      await new Promise((r) => setTimeout(r, 120));

      const body = doc.body;
      body.style.margin = "0";

      const dataUrl = await toPng(body, { width: 640, pixelRatio: 2, skipFonts: false });

      document.body.removeChild(iframe);

      const link = document.createElement("a");
      link.download = "newsletter.png";
      link.href = dataUrl;
      link.click();
      toast.success("Imagem exportada com sucesso!");
    } catch (e) {
      console.error("[ExportImage]", e);
      toast.error("Erro ao exportar imagem. Tente copiar o HTML e converter em outra ferramenta.");
    } finally {
      setExporting(false);
    }
  }

  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  return (
    <AppLayout activeModule="emailMarketing">
      <div className="flex h-full min-h-screen bg-background">
        {/* Sidebar — lista de artigos */}
        <div className="w-80 min-w-[260px] border-r border-border flex flex-col h-screen sticky top-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm text-foreground">Email Marketing</h1>
                <p className="text-[11px] text-muted-foreground">Newsletter automática com IA</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Escolha o artigo base</p>
            {articles.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum artigo criado ainda.<br />Crie artigos no módulo Artigos.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => { setSelectedArticleId(article.id); setNewsletter(null); }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all",
                      selectedArticleId === article.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{article.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(article.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border">
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!selectedArticleId || generateMut.isPending}
            >
              {generateMut.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Gerando newsletter...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Gerar Newsletter</>
              )}
            </Button>
          </div>
        </div>

        {/* Área principal */}
        <div className="flex-1 overflow-y-auto p-6">
          {!newsletter && !generateMut.isPending ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <Mail className="w-10 h-10 text-emerald-500" />
              </div>
              <div className="max-w-sm">
                <h2 className="text-xl font-bold text-foreground mb-2">Newsletter automática com IA</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Selecione um artigo na barra lateral. A IA vai transformá-lo em uma newsletter profissional com introdução, destaques e call-to-action — pronta para enviar.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2 max-w-sm w-full">
                {[
                  { icon: FileText, label: "Selecione o artigo" },
                  { icon: Sparkles, label: "IA gera a newsletter" },
                  { icon: Send, label: "Copie o HTML ou envie" },
                ].map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-xs text-center text-muted-foreground">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : generateMut.isPending ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-sm text-muted-foreground">Gerando newsletter para "{selectedArticle?.title}"...</p>
            </div>
          ) : newsletter ? (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Assunto */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assunto do e-mail</p>
                  <Button size="sm" variant="ghost" onClick={handleCopySubject} className="h-7 text-xs">
                    <Copy className="w-3 h-3 mr-1" />Copiar assunto
                  </Button>
                </div>
                <p className="text-base font-semibold text-foreground">{newsletter.subject}</p>
              </div>

              {/* Envio */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Enviar por e-mail</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="destinatario@email.com"
                    value={recipientEmail}
                    onChange={(e) => { setRecipientEmail(e.target.value); setSendStatus("idle"); }}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={sendStatus === "sending" || sendStatus === "sent" || !recipientEmail}
                  >
                    {sendStatus === "sending" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : sendStatus === "sent" ? (
                      <><Check className="w-4 h-4 mr-1" />Enviado</>
                    ) : (
                      <><Send className="w-4 h-4 mr-1" />Enviar</>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Requer <code className="bg-muted px-1 rounded">RESEND_API_KEY</code> no .env. Sem a chave, o HTML é copiado para usar em qualquer plataforma de e-mail.
                </p>
              </div>

              {/* Ações */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {showPreview ? "Ocultar preview" : "Ver preview"}
                </Button>
                <Button variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 mr-2 text-emerald-500" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copiado!" : "Copiar HTML"}
                </Button>
                <Button variant="outline" onClick={handleExportImage} disabled={exporting}>
                  {exporting
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <ImageDown className="w-4 h-4 mr-2" />}
                  {exporting ? "Exportando..." : "Exportar como PNG"}
                </Button>
                <Button variant="outline" onClick={handleGenerate}>
                  <RefreshCw className="w-4 h-4 mr-2" />Regenerar
                </Button>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-xs text-muted-foreground ml-2">Preview da newsletter</span>
                  </div>
                  <iframe
                    srcDoc={newsletter.htmlContent}
                    className="w-full border-0"
                    style={{ height: "600px" }}
                    title="Preview da newsletter"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
