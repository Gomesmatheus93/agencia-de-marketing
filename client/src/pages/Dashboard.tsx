import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  MessageSquare,
  Image,
  FileText,
  Share2,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Zap,
  GalleryHorizontal,
  Clapperboard,
} from "lucide-react";

const modules = [
  {
    id: "chat",
    title: "Chat com IA",
    description: "Converse com inteligência artificial para criar conteúdo, tirar dúvidas e automatizar tarefas.",
    icon: MessageSquare,
    path: "/dashboard/chat",
    gradient: "from-violet-500 to-purple-600",
    stat: "Conversas",
    color: "text-violet-600",
  },
  {
    id: "images",
    title: "Geração de Imagens",
    description: "Crie imagens únicas e profissionais com IA para suas campanhas de marketing.",
    icon: Image,
    path: "/dashboard/images",
    gradient: "from-blue-500 to-cyan-500",
    stat: "Imagens",
    color: "text-blue-600",
  },
  {
    id: "videos",
    title: "Videos com Avatar",
    description: "Transforme a foto de uma pessoa em um video falado e mantenha tudo salvo na plataforma.",
    icon: Clapperboard,
    path: "/dashboard/videos",
    gradient: "from-fuchsia-500 to-rose-500",
    stat: "Videos",
    color: "text-fuchsia-600",
  },
  {
    id: "articles",
    title: "Artigos Automáticos",
    description: "Gere artigos completos e otimizados para SEO a partir de temas ou links de notícias.",
    icon: FileText,
    path: "/dashboard/articles",
    gradient: "from-emerald-500 to-teal-500",
    stat: "Artigos",
    color: "text-emerald-600",
  },
  {
    id: "carousel",
    title: "Carrossel de Imagens",
    description: "Crie carrosséis dinâmicos e atraentes para suas campanhas nas redes sociais.",
    icon: GalleryHorizontal,
    path: "/dashboard/carousel",
    gradient: "from-amber-500 to-orange-500",
    stat: "Carrosséis",
    color: "text-amber-600",
  },
  {
    id: "posts",
    title: "Planejamento de Postagens",
    description: "Organize textos, imagens e status de publicacao para Instagram, LinkedIn e Newsletter.",
    icon: Share2,
    path: "/dashboard/posts",
    gradient: "from-orange-500 to-rose-500",
    stat: "Posts",
    color: "text-orange-600",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: chatStats } = trpc.chat.getStats.useQuery();
  const { data: imageStats } = trpc.images.getStats.useQuery();
  const { data: videoStats } = trpc.videos.getStats.useQuery();
  const { data: articleStats } = trpc.articles.getStats.useQuery();
  const { data: carouselStats } = trpc.carousel.getStats.useQuery();
  const { data: postStats } = trpc.posts.getStats.useQuery();

  const statsMap: Record<string, number> = {
    chat: chatStats?.count ?? 0,
    images: imageStats?.count ?? 0,
    videos: videoStats?.count ?? 0,
    articles: articleStats?.count ?? 0,
    carousel: carouselStats?.count ?? 0,
    posts: postStats?.count ?? 0,
  };

  const firstName = user?.name?.split(" ")[0] || "Usuário";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <AppLayout activeModule="dashboard">
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-muted-foreground font-medium">Dashboard</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {greeting}, <span className="gradient-text">{firstName}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Sua plataforma de marketing com IA está pronta para usar.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.id} className="glass-card p-4 space-y-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-md`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{statsMap[mod.id]}</div>
                  <div className="text-xs text-muted-foreground">{mod.stat} criados</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Module cards */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Módulos disponíveis</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className="glass-card p-6 text-left group hover:scale-[1.02] hover:shadow-xl transition-all duration-300 animate-fade-in-up"
                  style={{ animationDelay: `${0.1 * (i + 1)}s` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                      <TrendingUp className="w-3 h-3" />
                      {statsMap[mod.id]} {mod.stat.toLowerCase()}
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground text-base mb-1">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{mod.description}</p>
                  <div className={`flex items-center gap-1.5 text-sm font-medium ${mod.color} group-hover:gap-2.5 transition-all duration-200`}>
                    Acessar módulo
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
