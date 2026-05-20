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
  BarChart2,
  Wand2,
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

const NAV_ITEMS_CONFIG = [
  { id: "dashboard", icon: LayoutDashboard, path: "/dashboard", color: "from-violet-500 to-purple-600", labelKey: "dashboard" as const, descKey: "dashboardDesc" as const },
  { id: "chat", icon: MessageSquare, path: "/dashboard/chat", color: "from-violet-500 to-purple-600", labelKey: "chat" as const, descKey: "chatDesc" as const },
  { id: "images", icon: Image, path: "/dashboard/images", color: "from-blue-500 to-cyan-500", labelKey: "images" as const, descKey: "imagesDesc" as const },
  { id: "videos", icon: Clapperboard, path: "/dashboard/videos", color: "from-fuchsia-500 to-rose-500", labelKey: "videos" as const, descKey: "videosDesc" as const },
  { id: "articles", icon: FileText, path: "/dashboard/articles", color: "from-emerald-500 to-teal-500", labelKey: "articles" as const, descKey: "articlesDesc" as const },
  { id: "carousel", icon: GalleryHorizontal, path: "/dashboard/carousel", color: "from-amber-500 to-orange-500", labelKey: "carousel" as const, descKey: "carouselDesc" as const },
  { id: "posts", icon: Share2, path: "/dashboard/posts", color: "from-orange-500 to-rose-500", labelKey: "posts" as const, descKey: "postsDesc" as const },
  { id: "analytics", icon: BarChart2, path: "/dashboard/analytics", color: "from-cyan-500 to-blue-500", labelKey: "analytics" as const, descKey: "analyticsDesc" as const },
];

const SETTINGS_CONFIG = {
  id: "settings", icon: Settings, path: "/dashboard/settings", color: "from-slate-500 to-slate-600", labelKey: "settings" as const, descKey: "settingsDesc" as const,
};

interface AppLayoutProps {
  children: React.ReactNode;
  activeModule?: string;
}

export default function AppLayout({ children, activeModule }: AppLayoutProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDarkTheme = theme === "dark";
  const themeToggleLabel = isDarkTheme ? t("lightTheme") : t("darkTheme");
  const ThemeToggleIcon = isDarkTheme ? Sun : Moon;

  const navItems = NAV_ITEMS_CONFIG.map((item) => ({
    ...item,
    label: t(item.labelKey),
    description: t(item.descKey),
  }));
  const settingsItem = { ...SETTINGS_CONFIG, label: t(SETTINGS_CONFIG.labelKey), description: t(SETTINGS_CONFIG.descKey) };
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
    return (
      <button
        onClick={() => {
          navigate(item.path);
          setSidebarOpen(false);
        }}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        )}
      >
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200",
            isActive
              ? `bg-gradient-to-br ${item.color} shadow-md`
              : "bg-muted/60 group-hover:bg-muted"
          )}
        >
          <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
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
      </button>
    );
  };

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

        {user?.name?.toLowerCase().includes("matheus") && (
          <>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mt-3">
              {t("system")}
            </div>
            <NavButton item={settingsItem} />
          </>
        )}
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-border/30">
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
          {children}
        </div>
      </main>
    </div>
  );
}
