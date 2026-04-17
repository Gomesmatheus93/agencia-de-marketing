import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Settings,
  User,
  Shield,
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Share2,
  Database,
} from "lucide-react";

const workspaceItems = [
  {
    title: "Chat com IA",
    description: "As conversas usam a IA integrada da plataforma e ficam salvas no seu histórico.",
    icon: MessageSquare,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    title: "Imagens e Carrosséis",
    description: "As gerações ficam armazenadas na sua conta para consulta e reaproveitamento.",
    icon: ImageIcon,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Artigos",
    description: "Os artigos são criados e mantidos dentro da plataforma, com edição e status próprios.",
    icon: FileText,
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "Posts",
    description: "Os posts podem ser organizados por canal e marcados como publicados no seu fluxo interno.",
    icon: Share2,
    gradient: "from-orange-500 to-rose-500",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const loginLabel =
    user?.loginMethod === "email"
      ? "Email e senha"
      : user?.loginMethod
        ? "Conta conectada"
        : "Sessão ativa";

  return (
    <AppLayout activeModule="settings">
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-md">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Configurações</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Sua conta e o <span className="gradient-text">ambiente de trabalho</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tudo o que você produz por aqui fica centralizado na própria plataforma.
          </p>
        </div>

        <div className="glass-card p-5 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">Perfil</h2>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white font-bold text-lg shadow-md">
              {userInitials}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{user?.name || "Usuário"}</p>
              <p className="text-sm text-muted-foreground">{user?.email || "Sem email informado"}</p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Shield className="w-3 h-3" />
                <span>{loginLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="glass-card p-5 border-l-4 border-primary animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-sm text-foreground">Fluxo integrado</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                As gerações de chat, imagens, artigos e carrosséis rodam diretamente na aplicação, sem depender
                de integrações externas para funcionar.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Organização do workspace</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {workspaceItems.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="glass-card p-5 space-y-3">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-5 space-y-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm text-foreground">Boas práticas</h2>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="rounded-lg bg-muted/30 p-3">
              Use `NODE_ENV=production` no servidor para garantir o comportamento correto da aplicação.
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              Gere um usuário administrador com a seed e mantenha as credenciais fora do código.
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              Aplique as migrations sempre que subir uma imagem nova com mudança de banco.
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              Mantenha tokens e chaves apenas no `.env` do ambiente em que a aplicação roda.
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
