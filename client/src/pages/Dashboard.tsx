import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
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
  Clock,
  Lock,
  Crown,
} from "lucide-react";
import { usePlan } from "@/_core/hooks/usePlan";
import UpgradeModal from "@/components/UpgradeModal";
import { useState } from "react";

type ModuleConfig = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  gradient: string;
  color: string;
};

const MODULE_CONFIGS: ModuleConfig[] = [
  { id: "chat",     icon: MessageSquare,    path: "/dashboard/chat",      gradient: "from-alle-purple to-alle-purple-light", color: "text-violet-600" },
  { id: "images",   icon: Image,            path: "/dashboard/images",    gradient: "from-alle-orange to-alle-orange-light",     color: "text-blue-600" },
  { id: "videos",   icon: Clapperboard,     path: "/dashboard/videos",    gradient: "from-fuchsia-500 to-rose-500",  color: "text-fuchsia-600" },
  { id: "articles", icon: FileText,         path: "/dashboard/articles",  gradient: "from-emerald-500 to-teal-500",  color: "text-emerald-600" },
  { id: "carousel", icon: GalleryHorizontal,path: "/dashboard/carousel",  gradient: "from-amber-500 to-orange-500",  color: "text-amber-600" },
  { id: "posts",    icon: Share2,           path: "/dashboard/posts",     gradient: "from-orange-500 to-rose-500",   color: "text-orange-600" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { isLocked, isExpired, isTrialActive, isLegacy, isPaid, daysLeft, usage, limits } = usePlan();

  const { data: trialStatus } = trpc.auth.trialStatus.useQuery();

  const { data: chatStats }     = trpc.chat.getStats.useQuery();
  const { data: imageStats }    = trpc.images.getStats.useQuery();
  const { data: videoStats }    = trpc.videos.getStats.useQuery();
  const { data: articleStats }  = trpc.articles.getStats.useQuery();
  const { data: carouselStats } = trpc.carousel.getStats.useQuery();
  const { data: postStats }     = trpc.posts.getStats.useQuery();

  const statsMap: Record<string, number> = {
    chat:     chatStats?.count ?? 0,
    images:   imageStats?.count ?? 0,
    videos:   videoStats?.count ?? 0,
    articles: articleStats?.count ?? 0,
    carousel: carouselStats?.count ?? 0,
    posts:    postStats?.count ?? 0,
  };

  const statLabels: Record<string, string> = {
    chat:     t("dashboardConversations"),
    images:   t("dashboardImages"),
    videos:   t("dashboardVideos"),
    articles: t("dashboardArticles"),
    carousel: t("dashboardCarousels"),
    posts:    t("dashboardPosts"),
  };

  const moduleTitles: Record<string, string> = {
    chat:     t("chat"),
    images:   t("images"),
    videos:   t("videos"),
    articles: t("articles"),
    carousel: t("carousel"),
    posts:    t("posts"),
  };

  const moduleDescs: Record<string, string> = {
    chat:     t("chatModuleDesc"),
    images:   t("imagesModuleDesc"),
    videos:   t("videosModuleDesc"),
    articles: t("articlesModuleDesc"),
    carousel: t("carouselModuleDesc"),
    posts:    t("postsModuleDesc"),
  };

  const firstName = user?.name?.split(" ")[0] || "Usuário";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboardGreetingMorning")
    : hour < 18 ? t("dashboardGreetingAfternoon")
    : t("dashboardGreetingEvening");

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
          <p className="text-muted-foreground mt-1">{t("dashboardSubtitle")}</p>
        </div>

        {/* Trial / Expired banner */}
        {!isPaid && !isLegacy && isExpired && (
          <div className="animate-fade-in-up flex items-start gap-4 p-4 rounded-2xl border border-destructive/30 bg-destructive/10">
            <Lock className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">
                Seu trial gratuito expirou
              </p>
              <p className="text-xs text-destructive/70 mt-0.5">
                Assine um plano para continuar usando a plataforma com acesso completo.
              </p>
            </div>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold shadow hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Crown className="w-3.5 h-3.5" />
              Assinar
            </button>
          </div>
        )}

        {!isPaid && !isLegacy && isTrialActive && (
          <div className="animate-fade-in-up flex items-start gap-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Teste gratuito — {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                Uso hoje: {usage?.images ?? 0}/{limits?.images ?? 5} imagens &bull; {usage?.carousel ?? 0}/{limits?.carousel ?? 3} carrosséis &bull; {usage?.articles ?? 0}/{limits?.articles ?? 3} artigos &bull; {usage?.posts ?? 0}/{limits?.posts ?? 1} post Instagram
              </p>
            </div>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold shadow hover:opacity-90 transition-opacity flex-shrink-0"
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade
            </button>
          </div>
        )}

        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} expired={isExpired} />

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          {MODULE_CONFIGS.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.id} className="glass-card p-4 space-y-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-md`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{statsMap[mod.id]}</div>
                  <div className="text-xs text-muted-foreground">{statLabels[mod.id]} {t("dashboardCreated")}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Module cards */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{t("dashboardModulesTitle")}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {MODULE_CONFIGS.map((mod, i) => {
              const Icon = mod.icon;
              const locked = isLocked(mod.id);
              return (
                <button
                  key={mod.id}
                  onClick={() => locked ? setUpgradeOpen(true) : navigate(mod.path)}
                  className={`glass-card p-6 text-left group transition-all duration-300 animate-fade-in-up ${locked ? "opacity-60 hover:opacity-75" : "hover:scale-[1.02] hover:shadow-xl"}`}
                  style={{ animationDelay: `${0.1 * (i + 1)}s` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${locked ? "from-muted to-muted/60" : mod.gradient} flex items-center justify-center shadow-lg ${!locked && "group-hover:scale-110"} transition-transform duration-300`}>
                      {locked ? <Lock className="w-6 h-6 text-muted-foreground" /> : <Icon className="w-6 h-6 text-white" />}
                    </div>
                    {locked ? (
                      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <Crown className="w-3 h-3" />
                        Pro
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        {statsMap[mod.id]} {statLabels[mod.id].toLowerCase()}
                      </div>
                    )}
                  </div>
                  <h3 className={`font-semibold text-base mb-1 ${locked ? "text-muted-foreground" : "text-foreground"}`}>{moduleTitles[mod.id]}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{moduleDescs[mod.id]}</p>
                  {locked ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                      <Crown className="w-4 h-4" />
                      Disponível no plano Pro
                    </div>
                  ) : (
                    <div className={`flex items-center gap-1.5 text-sm font-medium ${mod.color} group-hover:gap-2.5 transition-all duration-200`}>
                      {t("dashboardAccessModule")}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
