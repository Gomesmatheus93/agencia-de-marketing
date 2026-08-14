import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Image,
  FileText,
  Share2,
  Settings,
  Sparkles,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
  LayoutDashboard,
  GalleryHorizontal,
  Clapperboard,
  Film,
  BarChart2,
  Wand2,
  CalendarDays,
  Palette,
  Globe,
  MessageCircle,
  ScanSearch,
  TrendingUp,
  Search,
  Lock,
  Crown,
  Layers,
  Crop,
  Target,
  FileBarChart2,
  Mail,
  LayoutGrid,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlan } from "@/_core/hooks/usePlan";
import { useCompanyAccess } from "@/_core/hooks/useCompanyAccess";
import UpgradeModal from "@/components/UpgradeModal";

const NAV_ITEMS_CONFIG = [
  { id: "dashboard", icon: LayoutDashboard, path: "/dashboard", color: "from-violet-500 to-purple-600", labelKey: "dashboard" as const, descKey: "dashboardDesc" as const },
  { id: "chat", icon: MessageSquare, path: "/dashboard/chat", color: "from-violet-500 to-purple-600", labelKey: "chat" as const, descKey: "chatDesc" as const },
  { id: "images", icon: Image, path: "/dashboard/images", color: "from-blue-500 to-cyan-500", labelKey: "images" as const, descKey: "imagesDesc" as const },
  { id: "videos", icon: Clapperboard, path: "/dashboard/videos", color: "from-fuchsia-500 to-rose-500", labelKey: "videos" as const, descKey: "videosDesc" as const },
  { id: "articles", icon: FileText, path: "/dashboard/articles", color: "from-emerald-500 to-teal-500", labelKey: "articles" as const, descKey: "articlesDesc" as const },
  { id: "carousel", icon: GalleryHorizontal, path: "/dashboard/carousel", color: "from-amber-500 to-orange-500", labelKey: "carousel" as const, descKey: "carouselDesc" as const },
  { id: "reels", icon: Film, path: "/dashboard/reels", color: "from-red-500 to-pink-500", labelKey: "reels" as const, descKey: "reelsDesc" as const },
  { id: "posts", icon: Share2, path: "/dashboard/posts", color: "from-orange-500 to-rose-500", labelKey: "posts" as const, descKey: "postsDesc" as const },
  { id: "analytics", icon: BarChart2, path: "/dashboard/analytics", color: "from-cyan-500 to-blue-500", labelKey: "analytics" as const, descKey: "analyticsDesc" as const },
  { id: "calendar", icon: CalendarDays, path: "/dashboard/calendar", color: "from-violet-500 to-purple-600", labelKey: "calendar" as const, descKey: "calendarDesc" as const },
  { id: "brand",    icon: Palette,     path: "/dashboard/brand",    color: "from-rose-500 to-pink-600",    labelKey: "brand" as const,    descKey: "brandDesc" as const },
  { id: "commentAutomations", icon: MessageCircle, path: "/dashboard/comment-automations", color: "from-pink-500 to-rose-600", labelKey: "commentAutomations" as const, descKey: "commentAutomationsDesc" as const },
  { id: "styleAnalyzer", icon: ScanSearch, path: "/dashboard/style-analyzer", color: "from-violet-500 to-indigo-600", labelKey: "styleAnalyzer" as const, descKey: "styleAnalyzerDesc" as const },
  { id: "radar", icon: TrendingUp, path: "/dashboard/radar", color: "from-emerald-500 to-cyan-500", labelKey: "radar" as const, descKey: "radarDesc" as const },
  { id: "seo", icon: Search, path: "/dashboard/seo", color: "from-cyan-500 to-blue-600", labelKey: "seo" as const, descKey: "seoDesc" as const },
  { id: "stories", icon: Layers, path: "/dashboard/stories", color: "from-pink-500 to-rose-500", labelKey: "stories" as const, descKey: "storiesDesc" as const },
  { id: "resize", icon: Crop, path: "/dashboard/resize", color: "from-cyan-500 to-blue-500", labelKey: "resize" as const, descKey: "resizeDesc" as const },
  { id: "campaign", icon: Target, path: "/dashboard/campaign", color: "from-orange-500 to-red-500", labelKey: "campaign" as const, descKey: "campaignDesc" as const },
  { id: "report", icon: FileBarChart2, path: "/dashboard/report", color: "from-violet-500 to-purple-600", labelKey: "report" as const, descKey: "reportDesc" as const },
  { id: "emailMarketing", icon: Mail, path: "/dashboard/email-marketing", color: "from-emerald-500 to-teal-500", labelKey: "emailMarketing" as const, descKey: "emailMarketingDesc" as const },
];

const SETTINGS_CONFIG = {
  id: "settings", icon: Settings, path: "/dashboard/settings", color: "from-slate-500 to-slate-600", labelKey: "settings" as const, descKey: "settingsDesc" as const,
};

const ART_STUDIO_CONFIG = {
  id: "artStudio", icon: LayoutGrid, path: "/dashboard/artes", color: "from-indigo-500 to-blue-600", labelKey: "artStudio" as const, descKey: "artStudioDesc" as const,
};

interface AppLayoutProps {
  children: React.ReactNode;
  activeModule?: string;
}

export default function AppLayout({ children, activeModule }: AppLayoutProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; featureName?: string }>({ open: false });
  const { isLocked, isExpired, isTrialActive, isLegacy, isPaid, daysLeft } = usePlan();
  const isDarkTheme = theme === "dark";
  const themeToggleLabel = isDarkTheme ? t("lightTheme") : t("darkTheme");
  const ThemeToggleIcon = isDarkTheme ? Sun : Moon;

  const navItems = NAV_ITEMS_CONFIG.map((item) => ({
    ...item,
    label: t(item.labelKey),
    description: t(item.descKey),
  }));
  const settingsItem = { ...SETTINGS_CONFIG, label: t(SETTINGS_CONFIG.labelKey), description: t(SETTINGS_CONFIG.descKey) };
  const artStudioItem = { ...ART_STUDIO_CONFIG, label: t(ART_STUDIO_CONFIG.labelKey), description: t(ART_STUDIO_CONFIG.descKey) };
  const { hasCompanyAccess } = useCompanyAccess();
  const handleThemeToggle = () => {
    if (!switchable || !toggleTheme) return;
    toggleTheme();
  };
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="glass-card p-8 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="space-y-2 text-center">
            <div className="h-4 w-32 shimmer rounded-full" />
            <div className="h-3 w-24 shimmer rounded-full mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  type NavItem = { id: string; label: string; description: string; icon: React.ComponentType<{ className?: string }>; path: string; color: string };
  const NavButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const isActive = activeModule === item.id;
    const locked = isLocked(item.id);
    return (
      <button
        onClick={() => {
          if (locked) {
            setUpgradeModal({ open: true, featureName: item.label });
            setSidebarOpen(false);
            return;
          }
          navigate(item.path);
          setSidebarOpen(false);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
          isActive
            ? "bg-primary/10 text-primary"
            : locked
            ? "text-muted-foreground/50 hover:bg-accent/30"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
      >
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
            isActive
              ? `bg-gradient-to-br ${item.color} shadow-md`
              : locked
              ? "bg-muted/40"
              : "bg-muted/60 group-hover:bg-muted"
          )}
        >
          <Icon className={cn("w-4 h-4", isActive ? "text-white" : locked ? "text-muted-foreground/40" : "text-muted-foreground group-hover:text-foreground")} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="truncate leading-tight">{item.label}</div>
          <div className={cn(
            "text-[11px] truncate mt-0.5",
            isActive ? "text-primary/70" : "text-muted-foreground/60"
          )}>
            {item.description}
          </div>
        </div>
        {isActive && (
          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
        )}
        {locked && !isActive && (
          <Lock className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
        )}
      </button>
    );
  };

  // ── Plan walls ──────────────────────────────────────────────────────────────
  const ExpiredWall = () => (
    <div className="flex items-center justify-center p-8 min-h-[70vh]">
      <div className="glass-card max-w-md w-full p-8 flex flex-col items-center text-center gap-5 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl bg-destructive/15 border border-destructive/20 flex items-center justify-center shadow-md">
          <Lock className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Trial expirado</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Seu período de teste gratuito de 7 dias encerrou. Assine um plano para continuar criando conteúdo ilimitado.
          </p>
        </div>
        <button
          onClick={() => setUpgradeModal({ open: true })}
          className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
        >
          <Crown className="w-4 h-4" />
          Assinar agora
        </button>
        <p className="text-xs text-muted-foreground">Acesso imediato após confirmação do pagamento.</p>
      </div>
    </div>
  );

  const ProFeatureWall = ({ featureName }: { featureName?: string }) => (
    <div className="flex items-center justify-center p-8 min-h-[70vh]">
      <div className="glass-card max-w-md w-full p-8 flex flex-col items-center text-center gap-5 animate-fade-in-up">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <Crown className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Recurso do Plano Pro</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {featureName ? `${featureName} está` : "Este recurso está"} disponível apenas nos planos pagos. Faça upgrade para desbloquear acesso completo.
          </p>
        </div>
        <button
          onClick={() => setUpgradeModal({ open: true })}
          className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
        >
          <Crown className="w-4 h-4" />
          Ver planos
        </button>
        <p className="text-xs text-muted-foreground">
          No trial você tem acesso a imagens (5/dia), carrosséis (3/dia), artigos (3/dia) e 1 post no Instagram.
        </p>
      </div>
    </div>
  );

  // Gate: determine if current module should be blocked
  const ALWAYS_OPEN = new Set(["dashboard", "settings"]);
  const gateActive = !!activeModule && !ALWAYS_OPEN.has(activeModule) && isLocked(activeModule);
  const activeLabel = navItems.find((n) => n.id === activeModule)?.label;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden">
            <img
              src="/logo.png"
              alt="KrythosLab"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>';
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-foreground tracking-tight truncate">KrythosLab</div>
            <div className="text-[11px] text-muted-foreground truncate">{t("platformName")}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
          {t("modules")}
        </div>
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}

        {user?.role === "admin" && (
          <>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mt-3">
              {t("system")}
            </div>
            <NavButton item={settingsItem} />
          </>
        )}

        {(hasCompanyAccess || user?.role === "admin") && (
          <>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mt-3">
              {t("company")}
            </div>
            <NavButton item={artStudioItem} />
          </>
        )}
      </nav>

      {/* Trial / Upgrade banner */}
      {!isPaid && !isLegacy && (isTrialActive || isExpired) && (
        <div className="px-3 pb-2">
          {isExpired ? (
            <button
              onClick={() => setUpgradeModal({ open: true })}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 hover:bg-destructive/15 transition-colors group"
            >
              <Lock className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <div className="text-[11px] font-semibold text-destructive leading-tight">Trial expirado</div>
                <div className="text-[10px] text-destructive/70">Clique para fazer upgrade</div>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setUpgradeModal({ open: true })}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors group"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 leading-tight">
                  Trial — {daysLeft}d restante{daysLeft !== 1 ? "s" : ""}
                </div>
                <div className="text-[10px] text-amber-600/70 dark:text-amber-500/70">Clique para fazer upgrade</div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* User profile */}
      <div className="p-3 border-t border-border/30">
        {/* Language switcher */}
        <div className="mb-2 flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-muted/70 flex items-center justify-center flex-shrink-0">
            <Globe className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{t("language")}</div>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-border/50">
            <button
              type="button"
              onClick={() => setLanguage("pt")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold transition-colors duration-150",
                language === "pt"
                  ? "bg-primary text-white"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              PT
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold transition-colors duration-150",
                language === "en"
                  ? "bg-primary text-white"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              EN
            </button>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="mb-2 flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-muted/70 flex items-center justify-center flex-shrink-0">
            <ThemeToggleIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{themeToggleLabel}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isDarkTheme}
            onClick={handleThemeToggle}
            disabled={!switchable || !toggleTheme}
            className={cn(
              "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              isDarkTheme ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                isDarkTheme ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200 group">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="gradient-primary text-white text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{user?.name || "Usuário"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 glass-card border-border/50">
            <DropdownMenuItem onClick={() => navigate("/dashboard/settings")} className="gap-2">
              <Settings className="w-4 h-4" />
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen gradient-bg flex relative overflow-hidden">
      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false })}
        featureName={upgradeModal.featureName}
        expired={isExpired}
      />
      {/* Ambient orbs */}
      <div className="fixed top-[-15%] left-[-5%] w-[400px] h-[400px] rounded-full bg-violet-400/10 blur-[100px] pointer-events-none z-0" />
      <div className="fixed bottom-[-15%] right-[-5%] w-[350px] h-[350px] rounded-full bg-blue-400/10 blur-[80px] pointer-events-none z-0" />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col glass-sidebar fixed left-0 top-0 bottom-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 bottom-0 w-72 glass-sidebar z-50 transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="w-8 h-8 rounded-lg"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen relative z-10">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 glass border-b border-border/30 px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center overflow-hidden">
              <img
                src="/logo.png"
                alt="KrythosLab"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span className="font-bold text-sm tracking-tight">KrythosLab</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isDarkTheme}
              aria-label={themeToggleLabel as string}
              onClick={handleThemeToggle}
              disabled={!switchable || !toggleTheme}
              className={cn(
                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                isDarkTheme ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  isDarkTheme ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <Avatar className="w-8 h-8">
              <AvatarFallback className="gradient-primary text-white text-xs font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {gateActive
            ? isExpired
              ? <ExpiredWall />
              : <ProFeatureWall featureName={activeLabel} />
            : children}
        </div>
      </main>
    </div>
  );
}
