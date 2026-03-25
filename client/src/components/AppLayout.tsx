import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
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
  X,
  ChevronRight,
  Bell,
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
import { toast } from "sonner";

const navItems = [
  {
    id: "chat",
    label: "Chat com IA",
    icon: MessageSquare,
    path: "/dashboard/chat",
    color: "from-violet-500 to-purple-600",
    description: "Converse com IA",
  },
  {
    id: "images",
    label: "Gerar Imagens",
    icon: Image,
    path: "/dashboard/images",
    color: "from-blue-500 to-cyan-500",
    description: "Crie imagens com IA",
  },
  {
    id: "articles",
    label: "Artigos",
    icon: FileText,
    path: "/dashboard/articles",
    color: "from-emerald-500 to-teal-500",
    description: "Gere artigos automáticos",
  },
  {
    id: "posts",
    label: "Postagens",
    icon: Share2,
    path: "/dashboard/posts",
    color: "from-orange-500 to-rose-500",
    description: "Automatize suas redes",
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
  activeModule?: string;
}

export default function AppLayout({ children, activeModule }: AppLayoutProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-foreground tracking-tight truncate">AI Marketing</div>
            <div className="text-[11px] text-muted-foreground truncate">Agency Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
          Módulos
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
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
                <div className="truncate">{item.label}</div>
                {isActive && (
                  <div className="text-[11px] text-primary/70 truncate">{item.description}</div>
                )}
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
            </button>
          );
        })}

        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 mt-4">
          Configurações
        </div>
        <button
          onClick={() => { navigate("/dashboard/settings"); setSidebarOpen(false); }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
            activeModule === "settings"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            activeModule === "settings" ? "bg-gradient-to-br from-slate-500 to-slate-600 shadow-md" : "bg-muted/60 group-hover:bg-muted"
          )}>
            <Settings className={cn("w-4 h-4", activeModule === "settings" ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
          </div>
          <span>Configurações</span>
        </button>
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-border/30">
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
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 glass-card border-border/50">
            <DropdownMenuItem onClick={() => navigate("/dashboard/settings")} className="gap-2">
              <Settings className="w-4 h-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Sair
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
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">AI Marketing</span>
          </div>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="gradient-primary text-white text-xs font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
