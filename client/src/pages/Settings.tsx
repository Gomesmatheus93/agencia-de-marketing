import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Settings,
  Users,
  ToggleRight,
  Plus,
  Trash2,
  RefreshCw,
  Crown,
  User,
  UserX,
  UserCheck,
  ChevronDown,
  Shield,
  Loader2,
  MailPlus,
  Lock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Plan = "free" | "pro" | "agency";
type Role = "user" | "admin";

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
};

const PLAN_CONFIG: Record<Plan, { label: string; badge: string }> = {
  free:   { label: "Free",    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700" },
  pro:    { label: "Pro",     badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
  agency: { label: "Agência", badge: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800" },
};

const ROLE_CONFIG: Record<Role, { label: string; badge: string }> = {
  user:  { label: "Usuário", badge: "bg-secondary text-secondary-foreground border-border" },
  admin: { label: "Admin",   badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
};

// ── Invite User Form ──────────────────────────────────────────────────────────

function InviteUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [plan, setPlan] = useState<Plan>("free");

  const invite = trpc.admin.inviteUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      setName(""); setEmail(""); setPassword("");
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <MailPlus className="w-4 h-4" />
        Convidar usuário
      </Button>
    );
  }

  return (
    <div className="glass-card p-4 rounded-xl space-y-3 border border-border/50">
      <p className="text-sm font-semibold">Novo usuário</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">E-mail</label>
          <Input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Senha</label>
          <Input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Função</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="user">Usuário</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Plano</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as Plan)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="agency">Agência</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button size="sm" disabled={!name || !email || !password || invite.isPending} onClick={() => invite.mutate({ name, email, password, role, plan })}>
          {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar usuário"}
        </Button>
      </div>
    </div>
  );
}

// ── Feature Flag Form ─────────────────────────────────────────────────────────

function FlagForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  const upsert = trpc.admin.upsertFeatureFlag.useMutation({
    onSuccess: () => { toast.success("Flag criada!"); setKey(""); setLabel(""); setDescription(""); setOpen(false); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="w-4 h-4" />
        Nova flag
      </Button>
    );
  }

  return (
    <div className="glass-card p-4 rounded-xl space-y-3 border border-border/50">
      <p className="text-sm font-semibold">Nova Feature Flag</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Chave (key)</label>
          <Input placeholder="ex: new_feature" value={key} onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
          <p className="text-[10px] text-muted-foreground">Letras minúsculas, números e _</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nome exibido</label>
          <Input placeholder="ex: Nova Feature" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
        <Textarea placeholder="Descreva o que esta flag controla..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button size="sm" disabled={!key || !label || upsert.isPending} onClick={() => upsert.mutate({ key, label, description: description || undefined, enabled: false })}>
          {upsert.isPending ? "Criando..." : "Criar (desativada)"}
        </Button>
      </div>
    </div>
  );
}

// ── User Row Actions ──────────────────────────────────────────────────────────

function UserActions({ u, currentUserId, onRefresh }: { u: UserRow; currentUserId: number; onRefresh: () => void }) {
  const isSelf = u.id === currentUserId;
  const setRole   = trpc.admin.setUserRole.useMutation({ onSuccess: () => { toast.success("Função atualizada"); onRefresh(); }, onError: (e) => toast.error(e.message) });
  const setPlan   = trpc.admin.setUserPlan.useMutation({ onSuccess: () => { toast.success("Plano atualizado"); onRefresh(); }, onError: (e) => toast.error(e.message) });
  const setActive = trpc.admin.setUserActive.useMutation({ onSuccess: () => { toast.success(u.isActive ? "Conta desativada" : "Conta reativada"); onRefresh(); }, onError: (e) => toast.error(e.message) });
  const del       = trpc.admin.deleteUser.useMutation({ onSuccess: () => { toast.success("Usuário excluído"); onRefresh(); }, onError: (e) => toast.error(e.message) });
  const isPending = setRole.isPending || setPlan.isPending || setActive.isPending || del.isPending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {!isSelf && (
          <>
            <DropdownMenuItem className="text-xs" onClick={() => setRole.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}>
              <Shield className="w-3.5 h-3.5 mr-2" />
              {u.role === "admin" ? "Rebaixar para Usuário" : "Promover para Admin"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {(["free", "pro", "agency"] as Plan[]).filter((p) => p !== u.plan).map((p) => (
          <DropdownMenuItem key={p} className="text-xs" onClick={() => setPlan.mutate({ id: u.id, plan: p })}>
            Mudar plano → {PLAN_CONFIG[p].label}
          </DropdownMenuItem>
        ))}
        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs" onClick={() => setActive.mutate({ id: u.id, isActive: !u.isActive })}>
              {u.isActive
                ? <><UserX className="w-3.5 h-3.5 mr-2 text-amber-500" />Desativar conta</>
                : <><UserCheck className="w-3.5 h-3.5 mr-2 text-emerald-500" />Reativar conta</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-destructive focus:text-destructive" onClick={() => { if (confirm(`Excluir permanentemente "${u.name}"?`)) del.mutate({ id: u.id }); }}>
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Excluir permanentemente
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50",
        checked ? "bg-emerald-500" : "bg-muted"
      )}
    >
      <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200", checked ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!loading && isAuthenticated && !isAdmin) navigate("/dashboard");
  }, [loading, isAuthenticated, isAdmin, navigate]);

  const statsQuery = trpc.admin.getStats.useQuery(undefined, { enabled: isAdmin });
  const flagsQuery = trpc.admin.getFeatureFlags.useQuery(undefined, { enabled: isAdmin });
  const usersQuery = trpc.admin.listUsers.useQuery(undefined, { enabled: isAdmin });

  const toggleFlag = trpc.admin.toggleFeatureFlag.useMutation({ onSuccess: () => flagsQuery.refetch(), onError: (e) => toast.error(e.message) });
  const deleteFlag = trpc.admin.deleteFeatureFlag.useMutation({ onSuccess: () => { toast.success("Flag removida"); flagsQuery.refetch(); }, onError: (e) => toast.error(e.message) });
  const upsertFlag = trpc.admin.upsertFeatureFlag.useMutation({ onSuccess: () => flagsQuery.refetch(), onError: (e) => toast.error(e.message) });

  if (loading || !user || !isAdmin) return null;

  const stats    = statsQuery.data;
  const flags    = flagsQuery.data ?? [];
  const allUsers = (usersQuery.data ?? []) as UserRow[];
  const regFlag  = flags.find((f) => f.key === "open_registration");
  const registrationOpen = regFlag ? regFlag.enabled : true;

  return (
    <AppLayout activeModule="settings">
      <div className="p-6 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-md">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Administração</h1>
            <p className="text-sm text-muted-foreground">Gerencie usuários, planos e funcionalidades da plataforma</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-xs gap-1 border border-border/50">
            <Shield className="w-3 h-3" />
            Admin
          </Badge>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total de usuários", value: stats.totalUsers,        sub: `${stats.activeUsers} ativos`,                                       icon: Users,       color: "text-blue-500" },
              { label: "Admins",            value: stats.adminUsers,        sub: "com acesso total",                                                  icon: Crown,       color: "text-amber-500" },
              { label: "Plano Agência",     value: stats.planCounts.agency, sub: `${stats.planCounts.pro} Pro · ${stats.planCounts.free} Free`,        icon: Shield,      color: "text-violet-500" },
              { label: "Flags ativas",      value: stats.enabledFlags,      sub: `de ${stats.totalFlags} flags`,                                      icon: ToggleRight, color: "text-emerald-500" },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <div key={label} className="glass-card rounded-xl p-4">
                <Icon className={cn("w-4 h-4 mb-2", color)} />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
                <div className="text-[11px] text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Users */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2"><Users className="w-4 h-4" />Usuários</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Gerencie funções, planos e acesso de cada usuário</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => usersQuery.refetch()}>
                <RefreshCw className={cn("w-4 h-4", usersQuery.isFetching && "animate-spin")} />
              </Button>
              <InviteUserForm onSuccess={() => usersQuery.refetch()} />
            </div>
          </div>

          <div className="space-y-2">
            {allUsers.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">Nenhum usuário encontrado.</div>
            ) : allUsers.map((u) => (
              <div key={u.id} className={cn("glass-card rounded-xl px-4 py-3 flex items-center gap-3 border transition-opacity", u.isActive ? "border-border/40" : "border-border/20 opacity-60")}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", u.role === "admin" ? "bg-amber-100 dark:bg-amber-950/40" : "bg-muted")}>
                  {u.role === "admin" ? <Crown className="w-4 h-4 text-amber-500" /> : u.isActive ? <User className="w-4 h-4 text-muted-foreground" /> : <UserX className="w-4 h-4 text-muted-foreground/50" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{u.name || "Sem nome"}</span>
                    {u.id === user.id && <span className="text-[10px] text-muted-foreground">(você)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email || u.loginMethod || "—"}</div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", ROLE_CONFIG[u.role].badge)}>{ROLE_CONFIG[u.role].label}</span>
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", PLAN_CONFIG[u.plan].badge)}>{PLAN_CONFIG[u.plan].label}</span>
                  {!u.isActive && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800">Inativo</span>}
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0 hidden md:block w-20 text-right">
                  {new Date(u.lastSignedIn).toLocaleDateString("pt-BR")}
                </div>
                <UserActions u={u} currentUserId={user.id} onRefresh={() => usersQuery.refetch()} />
              </div>
            ))}
          </div>
        </section>

        {/* Registration control */}
        <section className="space-y-3">
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2"><Lock className="w-4 h-4" />Registro público</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Controle se qualquer pessoa pode se cadastrar ou apenas convidados</p>
          </div>
          <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-4 border border-border/40">
            <div className="flex-1">
              <p className="text-sm font-medium">{registrationOpen ? "Registro aberto" : "Somente convite"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {registrationOpen ? "Qualquer pessoa com o link pode criar uma conta." : "Somente usuários criados pelo admin podem entrar."}
              </p>
            </div>
            <Toggle
              checked={registrationOpen}
              disabled={toggleFlag.isPending || upsertFlag.isPending}
              onChange={() => {
                if (regFlag) {
                  toggleFlag.mutate({ key: "open_registration", enabled: !registrationOpen });
                } else {
                  upsertFlag.mutate({ key: "open_registration", label: "Registro público", enabled: false });
                }
              }}
            />
          </div>
        </section>

        {/* Feature Flags */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2"><ToggleRight className="w-4 h-4" />Feature Flags</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Ative funcionalidades globalmente. Admins sempre veem tudo.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => flagsQuery.refetch()}>
                <RefreshCw className={cn("w-4 h-4", flagsQuery.isFetching && "animate-spin")} />
              </Button>
              <FlagForm onSuccess={() => flagsQuery.refetch()} />
            </div>
          </div>

          {flags.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">Nenhuma feature flag criada ainda.</div>
          ) : (
            <div className="space-y-2">
              {flags.map((flag) => (
                <div key={flag.key} className="glass-card rounded-xl px-4 py-3 flex items-center gap-4 border border-border/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{flag.label}</span>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">{flag.key}</Badge>
                    </div>
                    {flag.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{flag.description}</p>}
                  </div>
                  <Toggle checked={flag.enabled} disabled={toggleFlag.isPending} onChange={() => toggleFlag.mutate({ key: flag.key, enabled: !flag.enabled })} />
                  <Badge variant={flag.enabled ? "default" : "secondary"} className={cn("text-xs shrink-0", flag.enabled && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30")}>
                    {flag.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive/60 hover:text-destructive shrink-0" onClick={() => { if (confirm(`Remover flag "${flag.key}"?`)) deleteFlag.mutate({ key: flag.key }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
