import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Users, Crown, CheckCircle2, XCircle, Clock, TrendingUp,
  Image, FileText, GalleryHorizontal, Clapperboard, Share2,
  MessageSquare, Shield, LogOut, RefreshCw, Search, ChevronDown,
  LayoutDashboard, ToggleRight, Lock, Plus, Trash2, Loader2,
  MailPlus, UserX, UserCheck, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Plan = "free" | "pro" | "agency";
type Role = "user" | "admin";
type Tab  = "overview" | "users" | "platform";

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: Role;
  plan: Plan;
  isActive: boolean;
  loginMethod: string | null;
  lastSignedIn: Date;
  createdAt: Date;
  trialExpiresAt: Date | null;
  usage: { images: number; articles: number; carousel: number; videos: number; posts: number; chats: number };
};

const PLAN_LABEL: Record<Plan, string>  = { free: "Free", pro: "Pro", agency: "Agência" };
const PLAN_COLOR: Record<Plan, string>  = {
  free:   "bg-zinc-800 text-zinc-300 border-zinc-700",
  pro:    "bg-blue-950/60 text-blue-300 border-blue-700",
  agency: "bg-violet-950/60 text-violet-300 border-violet-700",
};

function statusOf(u: UserRow): { label: string; cls: string; icon: React.ReactNode } {
  if (u.plan === "pro" || u.plan === "agency")
    return { label: "Pago", cls: "text-emerald-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
  const exp = u.trialExpiresAt ? new Date(u.trialExpiresAt) : null;
  if (!exp)   return { label: "Legacy",    cls: "text-zinc-400",   icon: <Clock className="w-3.5 h-3.5" /> };
  if (exp > new Date()) {
    const d = Math.ceil((exp.getTime() - Date.now()) / 86400000);
    return { label: `Trial (${d}d)`, cls: "text-amber-400", icon: <Clock className="w-3.5 h-3.5" /> };
  }
  return { label: "Expirado", cls: "text-red-400", icon: <XCircle className="w-3.5 h-3.5" /> };
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-zinc-600")}
    >
      <span className={cn("pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200", checked ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, icon: Icon, cls }: { label: string; value: number | string; sub?: string; icon: React.ComponentType<{ className?: string }>; cls: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <Icon className={cn("w-5 h-5 mb-3", cls)} />
      <div className="text-2xl font-bold tabular-nums text-white">{value}</div>
      <div className="text-xs font-medium text-zinc-300 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
function Bar({ value, max, icon: Icon, cls, barCls }: { value: number; max: number; icon: React.ComponentType<{ className?: string }>; cls: string; barCls: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className={cn("w-3 h-3 shrink-0", cls)} />
      <span className="text-[10px] text-zinc-500 w-4 text-right font-mono tabular-nums shrink-0">{value}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden min-w-0">
        <div className={cn("h-full rounded-full", barCls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── User actions ──────────────────────────────────────────────────────────────
function UserActions({ u, selfId, onDone }: { u: UserRow; selfId: number; onDone: () => void }) {
  const isSelf = u.id === selfId;
  const setPlan   = trpc.admin.setUserPlan.useMutation({ onSuccess: () => { toast.success("Plano atualizado"); onDone(); }, onError: e => toast.error(e.message) });
  const setRole   = trpc.admin.setUserRole.useMutation({ onSuccess: () => { toast.success("Função atualizada"); onDone(); }, onError: e => toast.error(e.message) });
  const setActive = trpc.admin.setUserActive.useMutation({ onSuccess: () => { toast.success(u.isActive ? "Conta desativada" : "Conta reativada"); onDone(); }, onError: e => toast.error(e.message) });
  const del       = trpc.admin.deleteUser.useMutation({ onSuccess: () => { toast.success("Usuário excluído"); onDone(); }, onError: e => toast.error(e.message) });
  const busy = setPlan.isPending || setRole.isPending || setActive.isPending || del.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button disabled={busy} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs transition-colors">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-zinc-900 border-zinc-700 text-zinc-200">
        <div className="px-2 py-1.5">
          <p className="text-xs font-semibold truncate text-white">{u.name || u.email}</p>
        </div>
        <DropdownMenuSeparator className="bg-zinc-700" />
        <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Mudar plano</div>
        {(["free","pro","agency"] as Plan[]).map(p => (
          <DropdownMenuItem key={p} className={cn("text-xs gap-2 focus:bg-zinc-800 focus:text-white", u.plan === p && "text-primary")}
            onClick={() => u.plan !== p && setPlan.mutate({ id: u.id, plan: p })}>
            <Crown className="w-3.5 h-3.5" />{PLAN_LABEL[p]}{u.plan === p && <CheckCircle2 className="w-3 h-3 ml-auto text-emerald-400" />}
          </DropdownMenuItem>
        ))}
        {!isSelf && <>
          <DropdownMenuSeparator className="bg-zinc-700" />
          <DropdownMenuItem className="text-xs gap-2 focus:bg-zinc-800" onClick={() => setRole.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}>
            <Shield className="w-3.5 h-3.5" />{u.role === "admin" ? "Rebaixar para Usuário" : "Promover para Admin"}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs gap-2 focus:bg-zinc-800" onClick={() => setActive.mutate({ id: u.id, isActive: !u.isActive })}>
            {u.isActive ? <><UserX className="w-3.5 h-3.5 text-amber-400" />Desativar conta</> : <><UserCheck className="w-3.5 h-3.5 text-emerald-400" />Reativar conta</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-700" />
          <DropdownMenuItem className="text-xs gap-2 text-red-400 focus:text-red-400 focus:bg-zinc-800"
            onClick={() => confirm(`Excluir "${u.name}"?`) && del.mutate({ id: u.id })}>
            <Trash2 className="w-3.5 h-3.5" />Excluir permanentemente
          </DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Invite form ───────────────────────────────────────────────────────────────
function InviteForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [role, setRole] = useState<Role>("user"); const [plan, setPlan] = useState<Plan>("free");
  const invite = trpc.admin.inviteUser.useMutation({ onSuccess: () => { toast.success("Criado!"); setName(""); setEmail(""); setPw(""); setOpen(false); onDone(); }, onError: e => toast.error(e.message) });
  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs transition-colors"><MailPlus className="w-3.5 h-3.5" />Novo usuário</button>;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-white">Criar usuário</p>
      <div className="grid grid-cols-2 gap-3">
        <input className="h-8 rounded-lg bg-zinc-800 border border-zinc-700 px-3 text-sm text-white placeholder:text-zinc-500" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
        <input className="h-8 rounded-lg bg-zinc-800 border border-zinc-700 px-3 text-sm text-white placeholder:text-zinc-500" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="h-8 rounded-lg bg-zinc-800 border border-zinc-700 px-3 text-sm text-white placeholder:text-zinc-500" placeholder="Senha" type="password" value={pw} onChange={e => setPw(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <select value={role} onChange={e => setRole(e.target.value as Role)} className="h-8 rounded-lg bg-zinc-800 border border-zinc-700 px-2 text-xs text-white"><option value="user">Usuário</option><option value="admin">Admin</option></select>
          <select value={plan} onChange={e => setPlan(e.target.value as Plan)} className="h-8 rounded-lg bg-zinc-800 border border-zinc-700 px-2 text-xs text-white"><option value="free">Free</option><option value="pro">Pro</option><option value="agency">Agência</option></select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Cancelar</button>
        <button disabled={!name || !email || !pw || invite.isPending} onClick={() => invite.mutate({ name, email, password: pw, role, plan })} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50">
          {invite.isPending ? "Criando..." : "Criar"}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab]           = useState<Tab>("overview");
  const [search, setSearch]     = useState("");
  const [planFilter, setPlanFilter] = useState<Plan | "all">("all");

  const isAdmin = user?.role === "admin";

  const detailQ = trpc.admin.listUsersDetailed.useQuery(undefined, { enabled: isAdmin });
  const flagsQ  = trpc.admin.getFeatureFlags.useQuery(undefined, { enabled: isAdmin });
  const logout  = trpc.auth.logout.useMutation({ onSuccess: () => { window.location.href = "/app/login"; } });
  const toggleFlag = trpc.admin.toggleFeatureFlag.useMutation({ onSuccess: () => flagsQ.refetch(), onError: e => toast.error(e.message) });
  const deleteFlag = trpc.admin.deleteFeatureFlag.useMutation({ onSuccess: () => { toast.success("Removida"); flagsQ.refetch(); }, onError: e => toast.error(e.message) });

  // ── Loading ──
  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  // ── Not authenticated ──
  if (!user) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        <Shield className="w-10 h-10 text-primary mx-auto" />
        <h1 className="text-lg font-bold text-white">Painel Administrativo</h1>
        <p className="text-sm text-zinc-400">Faça login com a conta de administrador para continuar.</p>
        <button onClick={() => navigate("/login")} className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity">
          Ir para Login
        </button>
      </div>
    </div>
  );

  // ── Not admin ──
  if (!isAdmin) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        <XCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h1 className="text-lg font-bold text-white">Acesso negado</h1>
        <p className="text-sm text-zinc-400">Sua conta <strong className="text-zinc-200">{user.email}</strong> não tem permissão de administrador.</p>
        <button onClick={() => logout.mutate()} className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-200 font-semibold text-sm hover:bg-zinc-700 transition-colors">
          Sair
        </button>
      </div>
    </div>
  );

  // ── Admin dashboard ──
  const allUsers     = (detailQ.data ?? []) as UserRow[];
  const flags        = flagsQ.data ?? [];
  const paidUsers    = allUsers.filter(u => u.plan === "pro" || u.plan === "agency");
  const trialUsers   = allUsers.filter(u => u.plan === "free" && u.trialExpiresAt && new Date(u.trialExpiresAt) > new Date());
  const expiredUsers = allUsers.filter(u => u.plan === "free" && u.trialExpiresAt && new Date(u.trialExpiresAt) <= new Date());
  const newThisWeek  = allUsers.filter(u => Date.now() - new Date(u.createdAt).getTime() < 7 * 86400000);
  const totalContent = allUsers.reduce((s, u) => s + u.usage.images + u.usage.articles + u.usage.carousel + u.usage.videos + u.usage.posts, 0);

  const filtered = allUsers.filter(u => {
    if (planFilter !== "all" && u.plan !== planFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [u.name, u.email].some(s => s?.toLowerCase().includes(q));
    }
    return true;
  });

  const maxOf = (key: keyof UserRow["usage"]) => Math.max(1, ...allUsers.map(u => u.usage[key]));
  const regFlag = flags.find(f => f.key === "open_registration");
  const regOpen = regFlag ? regFlag.enabled : true;

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview",  label: "Visão Geral", icon: LayoutDashboard },
    { id: "users",     label: `Usuários (${allUsers.length})`, icon: Users },
    { id: "platform",  label: "Plataforma",  icon: ToggleRight },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-bold text-sm text-white">KrythosLab <span className="text-primary">Admin</span></span>
        </div>

        <div className="flex gap-1 p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg ml-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                tab === id ? "bg-primary text-white" : "text-zinc-400 hover:text-zinc-200")}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-zinc-500">{user.name || user.email}</span>
          <button onClick={() => logout.mutate()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors">
            <LogOut className="w-3.5 h-3.5" />Sair
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat label="Total de contas"  value={allUsers.length}   sub={`${newThisWeek.length} esta semana`} icon={Users}         cls="text-blue-400" />
              <Stat label="Pagantes"         value={paidUsers.length}  sub="Pro + Agência"                       icon={CheckCircle2}  cls="text-emerald-400" />
              <Stat label="Em trial"         value={trialUsers.length} sub="período ativo"                       icon={Clock}         cls="text-amber-400" />
              <Stat label="Trial expirado"   value={expiredUsers.length} sub="sem assinatura"                    icon={XCircle}       cls="text-red-400" />
              <Stat label="Novos (7 dias)"   value={newThisWeek.length}                                          icon={TrendingUp}    cls="text-violet-400" />
              <Stat label="Conteúdo total"   value={totalContent}      sub="criações geradas"                    icon={Zap}           cls="text-cyan-400" />
            </div>

            {/* Breakdown por conteúdo */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                { label: "Imagens",   key: "images"   as const, icon: Image,            cls: "text-blue-400" },
                { label: "Artigos",   key: "articles" as const, icon: FileText,         cls: "text-emerald-400" },
                { label: "Carrosséis",key: "carousel" as const, icon: GalleryHorizontal,cls: "text-amber-400" },
                { label: "Vídeos",    key: "videos"   as const, icon: Clapperboard,     cls: "text-fuchsia-400" },
                { label: "Posts",     key: "posts"    as const, icon: Share2,           cls: "text-orange-400" },
                { label: "Chats",     key: "chats"    as const, icon: MessageSquare,    cls: "text-violet-400" },
              ] as const).map(({ label, key, icon: Icon, cls }) => {
                const total = allUsers.reduce((s, u) => s + u.usage[key], 0);
                const top   = allUsers.reduce<UserRow | null>((b, u) => (!b || u.usage[key] > b.usage[key] ? u : b), null);
                return (
                  <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", cls)} />
                      <span className="text-sm font-medium text-zinc-200">{label}</span>
                    </div>
                    <div className="text-2xl font-bold tabular-nums text-white">{total}</div>
                    {top && top.usage[key] > 0 && (
                      <p className="text-[11px] text-zinc-500 truncate">Top: <span className="text-zinc-300">{top.name || top.email}</span> ({top.usage[key]})</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Últimos cadastros */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Últimos cadastros</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                {allUsers.slice(0, 10).map(u => {
                  const ts = statusOf(u);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                        {u.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{u.name || "Sem nome"}</div>
                        <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                      </div>
                      <div className={cn("flex items-center gap-1 text-xs font-medium shrink-0", ts.cls)}>{ts.icon}{ts.label}</div>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0", PLAN_COLOR[u.plan])}>{PLAN_LABEL[u.plan]}</span>
                      <span className="text-[11px] text-zinc-600 shrink-0 w-20 text-right">{new Date(u.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  );
                })}
                {allUsers.length === 0 && <div className="py-8 text-center text-sm text-zinc-600">Nenhum usuário ainda.</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                  <input placeholder="Buscar nome ou email..." value={search} onChange={e => setSearch(e.target.value)}
                    className="h-8 pl-8 pr-3 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 w-56 focus:outline-none focus:border-primary" />
                </div>
                <div className="flex rounded-lg overflow-hidden border border-zinc-700 h-8">
                  {(["all","free","pro","agency"] as const).map(p => (
                    <button key={p} onClick={() => setPlanFilter(p)}
                      className={cn("px-3 text-xs font-medium transition-colors", planFilter === p ? "bg-primary text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800")}>
                      {p === "all" ? "Todos" : PLAN_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => detailQ.refetch()} className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors">
                  <RefreshCw className={cn("w-3.5 h-3.5", detailQ.isFetching && "animate-spin")} />
                </button>
                <InviteForm onDone={() => detailQ.refetch()} />
              </div>
            </div>

            <div className="text-xs text-zinc-600">{filtered.length} usuário{filtered.length !== 1 ? "s" : ""}</div>

            <div className="space-y-2">
              {filtered.length === 0
                ? <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-10 text-center text-sm text-zinc-600">Nenhum usuário encontrado.</div>
                : filtered.map(u => {
                  const ts  = statusOf(u);
                  const exp = u.trialExpiresAt ? new Date(u.trialExpiresAt) : null;
                  const tot = u.usage.images + u.usage.articles + u.usage.carousel + u.usage.videos + u.usage.posts;
                  return (
                    <div key={u.id} className={cn("bg-zinc-900 border border-zinc-800 rounded-xl", !u.isActive && "opacity-50")}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                          {u.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white truncate">{u.name || "Sem nome"}</span>
                            {u.id === user.id && <span className="text-[10px] text-zinc-500">(você)</span>}
                            {u.role === "admin" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/60 border border-amber-800 text-amber-400">Admin</span>}
                            {!u.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950/40 border border-red-800 text-red-400">Inativo</span>}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                        </div>

                        {/* Plan */}
                        <div className="hidden sm:flex flex-col items-end shrink-0 gap-1">
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", PLAN_COLOR[u.plan])}>{PLAN_LABEL[u.plan]}</span>
                          <div className={cn("flex items-center gap-1 text-[10px] font-medium", ts.cls)}>{ts.icon}{ts.label}</div>
                        </div>

                        {/* Expiry */}
                        <div className="hidden md:flex flex-col items-end shrink-0 gap-0.5 w-28">
                          {u.plan !== "free" ? (
                            <div className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Ativo</div>
                          ) : exp ? (
                            <>
                              <div className="text-[10px] text-zinc-500">Vencimento</div>
                              <div className={cn("text-[11px] font-medium", exp <= new Date() ? "text-red-400" : "text-zinc-300")}>
                                {exp.toLocaleDateString("pt-BR")}
                              </div>
                            </>
                          ) : <div className="text-[10px] text-zinc-600">Sem trial</div>}
                          <div className="text-[10px] text-zinc-600">Entrou {new Date(u.createdAt).toLocaleDateString("pt-BR")}</div>
                        </div>

                        {/* Total content */}
                        <div className="hidden lg:flex flex-col items-end shrink-0 gap-0.5 w-16">
                          <div className="text-base font-bold tabular-nums text-white">{tot}</div>
                          <div className="text-[10px] text-zinc-600">criações</div>
                        </div>

                        <UserActions u={u} selfId={user.id} onDone={() => detailQ.refetch()} />
                      </div>

                      {/* Usage bars */}
                      <div className="px-4 pb-3 grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-1.5">
                        <Bar value={u.usage.images}   max={maxOf("images")}   icon={Image}             cls="text-blue-400"    barCls="bg-blue-500" />
                        <Bar value={u.usage.articles} max={maxOf("articles")} icon={FileText}          cls="text-emerald-400" barCls="bg-emerald-500" />
                        <Bar value={u.usage.carousel} max={maxOf("carousel")} icon={GalleryHorizontal} cls="text-amber-400"   barCls="bg-amber-500" />
                        <Bar value={u.usage.videos}   max={maxOf("videos")}   icon={Clapperboard}      cls="text-fuchsia-400" barCls="bg-fuchsia-500" />
                        <Bar value={u.usage.posts}    max={maxOf("posts")}    icon={Share2}            cls="text-orange-400"  barCls="bg-orange-500" />
                        <Bar value={u.usage.chats}    max={maxOf("chats")}    icon={MessageSquare}     cls="text-violet-400"  barCls="bg-violet-500" />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── PLATFORM ── */}
        {tab === "platform" && (
          <div className="space-y-6 max-w-2xl">
            {/* Registration */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
              <Lock className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{regOpen ? "Registro público aberto" : "Somente convite"}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{regOpen ? "Qualquer pessoa pode criar uma conta." : "Apenas usuários criados pelo admin podem entrar."}</p>
              </div>
              <Toggle checked={regOpen} onChange={() => toggleFlag.mutate({ key: "open_registration", enabled: !regOpen })} disabled={toggleFlag.isPending} />
            </div>

            {/* Feature flags */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><ToggleRight className="w-4 h-4 text-primary" />Feature Flags</h2>
                <button onClick={() => flagsQ.refetch()} className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors">
                  <RefreshCw className={cn("w-3.5 h-3.5", flagsQ.isFetching && "animate-spin")} />
                </button>
              </div>
              {flags.length === 0
                ? <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-8 text-center text-sm text-zinc-600">Nenhuma flag criada.</div>
                : <div className="space-y-2">
                  {flags.map(flag => (
                    <div key={flag.key} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{flag.label}</span>
                          <code className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{flag.key}</code>
                        </div>
                        {flag.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{flag.description}</p>}
                      </div>
                      <Toggle checked={flag.enabled} disabled={toggleFlag.isPending} onChange={() => toggleFlag.mutate({ key: flag.key, enabled: !flag.enabled })} />
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0", flag.enabled ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800" : "bg-zinc-800 text-zinc-500 border border-zinc-700")}>
                        {flag.enabled ? "Ativo" : "Inativo"}
                      </span>
                      <button onClick={() => confirm(`Remover "${flag.key}"?`) && deleteFlag.mutate({ key: flag.key })} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500/50 hover:text-red-400 hover:bg-zinc-800 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
