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
  MessageCircle,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
  Layers,
  Crop,
  FileBarChart2,
  LayoutGrid,
  Users,
  CalendarRange,
  ClipboardCheck,
  ShieldCheck,
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

// Menu na ordem em que o trabalho da agência acontece: agentes → planejar →
// criar → publicar → medir.
const NAV_ITEMS_CONFIG = [
  { id: "dashboard", icon: LayoutDashboard, path: "/dashboard", color: "from-alle-purple to-alle-purple-light", labelKey: "dashboard" as const, descKey: "dashboardDesc" as const, group: null },
  { id: "planning", icon: CalendarRange, path: "/dashboard/planejamento", color: "from-alle-purple to-alle-purple-light", labelKey: "planning" as const, descKey: "planningDesc" as const, group: "plan" as const },
  { id: "calendar", icon: CalendarDays, path: "/dashboard/calendar", color: "from-alle-purple to-alle-purple-light", labelKey: "calendar" as const, descKey: "calendarDesc" as const, group: "plan" as const },
  { id: "agentCarousel", icon: GalleryHorizontal, path: "/dashboard/criar/carrossel", color: "from-alle-purple to-alle-orange", labelKey: "createCarousel" as const, descKey: "createCarouselDesc" as const, group: "create" as const },
  { id: "agentPost", icon: Image, path: "/dashboard/criar/post", color: "from-alle-purple to-alle-orange", labelKey: "createPost" as const, descKey: "createPostDesc" as const, group: "create" as const },
  { id: "agentStories", icon: Layers, path: "/dashboard/criar/stories", color: "from-alle-purple to-alle-orange", labelKey: "createStories" as const, descKey: "createStoriesDesc" as const, group: "create" as const },
  { id: "agentReels", icon: Clapperboard, path: "/dashboard/agents/reels", color: "from-alle-purple to-alle-orange", labelKey: "createReels" as const, descKey: "createReelsDesc" as const, group: "create" as const },
  { id: "agentVideo", icon: Clapperboard, path: "/dashboard/criar/video", color: "from-alle-purple to-alle-orange", labelKey: "createVideoAgent" as const, descKey: "createVideoAgentDesc" as const, group: "create" as const },
  { id: "posts", icon: Share2, path: "/dashboard/posts", color: "from-alle-orange to-alle-orange-light", labelKey: "posts" as const, descKey: "postsDesc" as const, group: "publish" as const },
  { id: "commentAutomations", icon: MessageCircle, path: "/dashboard/comment-automations", color: "from-alle-orange to-alle-orange-light", labelKey: "commentAutomations" as const, descKey: "commentAutomationsDesc" as const, group: "publish" as const },
  { id: "direct", icon: MessageCircle, path: "/dashboard/direct", color: "from-alle-orange to-alle-orange-light", labelKey: "direct" as const, descKey: "directDesc" as const, group: "publish" as const },
  { id: "brandCheck", icon: ShieldCheck, path: "/dashboard/marca", color: "from-alle-purple to-alle-orange", labelKey: "brandCheck" as const, descKey: "brandCheckDesc" as const, group: "measure" as const },
  { id: "audit", icon: ClipboardCheck, path: "/dashboard/auditoria", color: "from-alle-orange to-alle-orange-light", labelKey: "audit" as const, descKey: "auditDesc" as const, group: "measure" as const },
  { id: "analytics", icon: BarChart2, path: "/dashboard/analytics", color: "from-alle-orange to-alle-orange-light", labelKey: "analytics" as const, descKey: "analyticsDesc" as const, group: "measure" as const },
  { id: "report", icon: FileBarChart2, path: "/dashboard/report", color: "from-alle-orange to-alle-orange-light", labelKey: "report" as const, descKey: "reportDesc" as const, group: "measure" as const },
];

// A barra lateral é montada de novo a cada página: guarda a rolagem para não voltar ao topo.
const NAV_SCROLL_KEY = "sidebar_nav_scroll";
function saveNavScroll(e: React.UIEvent<HTMLElement>) {
  try { sessionStorage.setItem(NAV_SCROLL_KEY, String(e.currentTarget.scrollTop)); } catch { /* sem storage */ }
}
function restoreNavScroll(el: HTMLElement | null) {
  if (!el) return;
  try { el.scrollTop = Number(sessionStorage.getItem(NAV_SCROLL_KEY) ?? 0); } catch { /* sem storage */ }
}

const NAV_GROUP_LABEL_KEYS = {
  agency: "navGroupAgency",
  plan: "navGroupPlan",
  create: "navGroupCreate",
  publish: "navGroupPublish",
  measure: "navGroupMeasure",
} as const;

const SETTINGS_CONFIG = {
  id: "settings", icon: Settings, path: "/dashboard/settings", color: "from-slate-500 to-slate-600", labelKey: "settings" as const, descKey: "settingsDesc" as const,
};

const ART_STUDIO_CONFIG = {
  id: "artStudio", icon: LayoutGrid, path: "/dashboard/artes", color: "from-indigo-500 to-blue-600", labelKey: "artStudio" as const, descKey: "artStudioDesc" as const,
};

const TEAM_CONFIG = {
  id: "team", icon: Users, path: "/dashboard/team", color: "from-slate-600 to-slate-800", labelKey: "team" as const, descKey: "teamDesc" as const,
};

// Telas manuais (sem agente) acendem o item "Mais ferramentas".
const CREATIVE_MODULE_IDS = new Set(["chat", "images", "articles", "carousel", "reels", "stories", "resize", "artStudio"]);

interface AppLayoutProps {
  children: React.ReactNode;
  activeModule?: string;
}

export default function AppLayout({ children, activeModule }: AppLayoutProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  // Sem o seletor de idioma, quem tinha escolhido inglês volta para o português.
  useEffect(() => { if (language !== "pt") setLanguage("pt"); }, [language, setLanguage]);
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Barra lateral recolhida (só ícones) no computador; a escolha fica no navegador.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem("sidebar_collapsed", c ? "0" : "1"); } catch { /* sem storage */ }
    return !c;
  });
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
  const teamItem = { ...TEAM_CONFIG, label: t(TEAM_CONFIG.labelKey), description: t(TEAM_CONFIG.descKey) };
  const { hasCompanyAccess } = useCompanyAccess();
  const handleThemeToggle = () => {
    if (!switchable || !toggleTheme) return;
    toggleTheme();
  };
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/app/login";
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
  const NavButton = ({ item, mini = false }: { item: NavItem; mini?: boolean }) => {
    const Icon = item.icon;
    const isActive = activeModule === item.id || (item.id === "studio" && !!activeModule && CREATIVE_MODULE_IDS.has(activeModule));
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
        title={mini ? item.label : undefined}
        className={cn(
          "w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-medium transition-all duration-200 group",
          mini && "justify-center px-0",
          isActive
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
            : locked
            ? "text-muted-foreground/50 hover:bg-muted/60"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
        )}
      >
        <Icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-primary-foreground" : locked ? "text-muted-foreground/40" : "text-muted-foreground group-hover:text-foreground")} />
        {!mini && <span className="flex-1 text-left truncate">{item.label}</span>}
        {locked && !isActive && !mini && (
          <Lock className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
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

  const renderSidebar = (mini: boolean) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("pt-8 pb-6", mini ? "px-4" : "px-7")}>
        <div className={cn("flex items-center gap-3", mini && "flex-col")}>
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden p-1.5">
            <img
              src="/logo.png"
              alt="Alle Energia"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>';
              }}
            />
          </div>
          {!mini && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-lg text-foreground tracking-tight truncate">Alle Energia</div>
              <div className="text-[11px] text-muted-foreground truncate">{t("platformName")}</div>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={mini ? "Expandir menu" : "Recolher menu"}
            className="hidden lg:flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {mini ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav ref={restoreNavScroll} onScroll={saveNavScroll} className={cn("flex-1 pb-4 space-y-1 overflow-y-auto scrollbar-thin", mini ? "px-3" : "px-5")}>
        {!mini && (
          <div className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-4 py-2">
            {t("modules")}
          </div>
        )}
        {navItems.map((item, i) => {
          const prevGroup = i > 0 ? navItems[i - 1].group : null;
          const showGroupHeader = item.group && item.group !== prevGroup;
          return (
            <div key={item.id}>
              {showGroupHeader && mini && <div className="mx-auto my-3 h-px w-8 bg-border" />}
              {showGroupHeader && !mini && (
                <div className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-4 pt-5 pb-2">
                  {t(NAV_GROUP_LABEL_KEYS[item.group as keyof typeof NAV_GROUP_LABEL_KEYS])}
                </div>
              )}
              <NavButton item={item} mini={mini} />
            </div>
          );
        })}

        {user?.role === "admin" && (
          <>
            <div className={cn("text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-4 py-2 mt-3", mini && "hidden")}>
              {t("system")}
            </div>
            <NavButton item={settingsItem} mini={mini} />
          </>
        )}

        {hasCompanyAccess && (
          <>
            <div className={cn("text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-4 py-2 mt-3", mini && "hidden")}>
              {t("company")}
            </div>
            <NavButton item={artStudioItem} mini={mini} />
          </>
        )}

        {user?.canManageTeam && (
          <>
            <div className={cn("text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-4 py-2 mt-3", mini && "hidden")}>
              {t("teamSection")}
            </div>
            <NavButton item={teamItem} mini={mini} />
          </>
        )}
      </nav>

      {/* Trial / Upgrade banner */}
      {!mini && !isPaid && !isLegacy && (isTrialActive || isExpired) && (
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
      <div className={cn("py-4 border-t border-border/40", mini ? "px-3" : "px-5")}>
        {/* Theme toggle */}
        <div className={cn("mb-2 flex items-center gap-3 px-3 py-2.5 rounded-lg", mini && "hidden")}>
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
            <button title={mini ? user?.name || "Usuário" : undefined} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200 group", mini && "justify-center px-0")}>
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="gradient-primary text-white text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className={cn("flex-1 text-left min-w-0", mini && "hidden")}>
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
            <DropdownMenuItem onClick={() => navigate("/dashboard/security")} className="gap-2">
              <Lock className="w-4 h-4" />
              Segurança
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

      {/* Desktop Sidebar */}
      <aside className={cn("hidden lg:flex flex-col glass-sidebar fixed left-0 top-0 bottom-0 z-30 transition-[width] duration-200", collapsed ? "w-20" : "w-72")}>
        {renderSidebar(collapsed)}
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
        {renderSidebar(false)}
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 flex flex-col min-h-screen relative z-10 transition-[margin] duration-200", collapsed ? "lg:ml-20" : "lg:ml-72")}>
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
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center overflow-hidden p-0.5">
              <img
                src="/logo.png"
                alt="Alle Energia"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span className="font-bold text-sm tracking-tight">Alle Energia</span>
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

        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-20 items-center justify-between gap-4 px-8 py-5 bg-background/85 backdrop-blur">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight truncate">{activeLabel ?? "Alle Energia"}</h2>
            <p className="text-xs text-muted-foreground capitalize">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <button type="button" onClick={() => navigate("/dashboard/settings")} className="flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 transition-colors hover:bg-card">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="gradient-primary text-white text-sm font-semibold">{userInitials}</AvatarFallback>
            </Avatar>
            <span className="text-left leading-tight">
              <span className="block text-sm font-semibold text-foreground">{user?.name || "Usuário"}</span>
              <span className="block text-[11px] text-muted-foreground">{user?.role === "admin" ? "Administrador" : "Equipe"}</span>
            </span>
          </button>
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
