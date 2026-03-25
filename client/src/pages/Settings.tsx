import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Settings,
  Webhook,
  MessageSquare,
  Image,
  FileText,
  Share2,
  Save,
  Loader2,
  CheckCircle2,
  ExternalLink,
  User,
  Shield,
  Sparkles,
  Info,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: webhooks, isLoading } = trpc.settings.getWebhooks.useQuery();

  const [chatUrl, setChatUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [postUrl, setPostUrl] = useState("");

  useEffect(() => {
    if (webhooks) {
      setChatUrl(webhooks.n8nWebhookUrl || "");
      setImageUrl(webhooks.n8nImageWebhookUrl || "");
      setArticleUrl(webhooks.n8nArticleWebhookUrl || "");
      setPostUrl(webhooks.n8nPostWebhookUrl || "");
    }
  }, [webhooks]);

  const updateMutation = trpc.settings.updateWebhooks.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      n8nWebhookUrl: chatUrl || undefined,
      n8nImageWebhookUrl: imageUrl || undefined,
      n8nArticleWebhookUrl: articleUrl || undefined,
      n8nPostWebhookUrl: postUrl || undefined,
    });
  };

  const webhookFields = [
    {
      id: "chat",
      label: "Webhook — Chat com IA",
      description: "Recebe mensagens do chat e retorna respostas da IA via n8n",
      icon: MessageSquare,
      gradient: "from-violet-500 to-purple-600",
      value: chatUrl,
      onChange: setChatUrl,
      placeholder: "https://seu-n8n.com/webhook/chat",
      payload: `{ "message": "...", "conversationId": 1, "userId": 1, "history": [...] }`,
      response: `{ "response": "Resposta da IA..." }`,
    },
    {
      id: "images",
      label: "Webhook — Geração de Imagens",
      description: "Recebe prompt e retorna URL da imagem gerada",
      icon: Image,
      gradient: "from-blue-500 to-cyan-500",
      value: imageUrl,
      onChange: setImageUrl,
      placeholder: "https://seu-n8n.com/webhook/images",
      payload: `{ "prompt": "...", "userId": 1 }`,
      response: `{ "imageUrl": "https://..." }`,
    },
    {
      id: "articles",
      label: "Webhook — Geração de Artigos",
      description: "Recebe tema e retorna artigo completo gerado",
      icon: FileText,
      gradient: "from-emerald-500 to-teal-500",
      value: articleUrl,
      onChange: setArticleUrl,
      placeholder: "https://seu-n8n.com/webhook/articles",
      payload: `{ "topic": "...", "sourceUrl": "...", "userId": 1 }`,
      response: `{ "title": "...", "content": "...", "summary": "..." }`,
    },
    {
      id: "posts",
      label: "Webhook — Publicação de Posts",
      description: "Recebe post e publica nas redes sociais via n8n",
      icon: Share2,
      gradient: "from-orange-500 to-rose-500",
      value: postUrl,
      onChange: setPostUrl,
      placeholder: "https://seu-n8n.com/webhook/posts",
      payload: `{ "channel": "instagram|linkedin|newsletter", "content": "...", "title": "...", "userId": 1 }`,
      response: `{ "success": true }`,
    },
  ];

  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <AppLayout activeModule="settings">
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-md">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Configurações</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Configurações da <span className="gradient-text">Plataforma</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure integrações e personalize sua experiência.
          </p>
        </div>

        {/* User profile card */}
        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">Perfil do Usuário</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white font-bold text-lg shadow-md">
              {userInitials}
            </div>
            <div>
              <p className="font-semibold text-foreground">{user?.name || "Usuário"}</p>
              <p className="text-sm text-muted-foreground">{user?.email || ""}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span className="text-xs text-emerald-600">Conta verificada · Dados isolados</span>
              </div>
            </div>
          </div>
        </div>

        {/* n8n info */}
        <div className="glass-card p-5 border-l-4 border-primary animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
              <Webhook className="w-4 h-4 text-white" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm">Integração com n8n</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Configure os webhooks do n8n para orquestrar automações. Se não configurados, a plataforma usa a IA integrada automaticamente.
              </p>
              <a
                href="https://n8n.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                Saiba mais sobre n8n
              </a>
            </div>
          </div>
        </div>

        {/* Webhook fields */}
        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary" />
            URLs dos Webhooks n8n
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 shimmer rounded-2xl" />)}
            </div>
          ) : (
            webhookFields.map((field) => {
              const Icon = field.icon;
              const hasValue = !!field.value;
              return (
                <div key={field.id} className="glass-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${field.gradient} flex items-center justify-center shadow-md`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{field.label}</p>
                        <p className="text-xs text-muted-foreground">{field.description}</p>
                      </div>
                    </div>
                    {hasValue && (
                      <div className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Configurado</span>
                      </div>
                    )}
                  </div>
                  <Input
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder={field.placeholder}
                    className="glass border-border/50 focus:border-primary/50 text-sm"
                  />
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Payload enviado:
                    </p>
                    <code className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg block font-mono">
                      {field.payload}
                    </code>
                    <p className="text-[11px] text-muted-foreground font-medium">Resposta esperada:</p>
                    <code className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg block font-mono">
                      {field.response}
                    </code>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Save button */}
        <div className="flex justify-end animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="gap-2 gradient-primary text-white border-0 hover:opacity-90 shadow-md px-6"
          >
            {updateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="w-4 h-4" /> Salvar Configurações</>
            )}
          </Button>
        </div>

        {/* Platform info */}
        <div className="glass-card p-5 space-y-3 animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Sobre a Plataforma</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: "Versão", value: "1.0.0" },
              { label: "IA Integrada", value: "Manus AI" },
              { label: "Armazenamento", value: "S3 + MySQL" },
              { label: "Autenticação", value: "OAuth 2.0" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
