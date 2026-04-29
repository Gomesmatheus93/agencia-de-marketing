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
import {
  ShieldCheck,
  Users,
  ToggleRight,
  Plus,
  Trash2,
  RefreshCw,
  Crown,
  User,
  FlaskConical,
} from "lucide-react";

function isOwner(name?: string | null): boolean {
  return name?.toLowerCase().includes("matheus") ?? false;
}

// ─── Feature Flag Form ────────────────────────────────────────────────────────
function FlagForm({ onSuccess }: { onSuccess: () => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  const upsert = trpc.admin.upsertFeatureFlag.useMutation({
    onSuccess: () => {
      toast.success("Feature flag criada!");
      setKey("");
      setLabel("");
      setDescription("");
      setOpen(false);
      onSuccess();
    },
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
          <Input
            placeholder="ex: new_dashboard_ui"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
          <p className="text-[10px] text-muted-foreground">Apenas letras minúsculas, números e _</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nome exibido</label>
          <Input
            placeholder="ex: Novo Dashboard UI"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
        <Textarea
          placeholder="Descreva o que esta flag controla..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        <Button
          size="sm"
          disabled={!key || !label || upsert.isPending}
          onClick={() =>
            upsert.mutate({ key, label, description: description || undefined, enabled: false })
          }
        >
          {upsert.isPending ? "Criando..." : "Criar (desativada)"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated && !isOwner(user?.name)) {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated, user, navigate]);

  const statsQuery = trpc.admin.getStats.useQuery(undefined, {
    enabled: isOwner(user?.name),
  });
  const flagsQuery = trpc.admin.getFeatureFlags.useQuery(undefined, {
    enabled: isOwner(user?.name),
  });
  const usersQuery = trpc.admin.listUsers.useQuery(undefined, {
    enabled: isOwner(user?.name),
  });

  const toggleFlag = trpc.admin.toggleFeatureFlag.useMutation({
    onSuccess: () => flagsQuery.refetch(),
    onError: (e) => toast.error(e.message),
  });

  const deleteFlag = trpc.admin.deleteFeatureFlag.useMutation({
    onSuccess: () => {
      toast.success("Flag removida");
      flagsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading || !user || !isOwner(user.name)) return null;

  const stats = statsQuery.data;
  const flags = flagsQuery.data ?? [];
  const allUsers = usersQuery.data ?? [];

  return (
    <AppLayout activeModule="settings">
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-md">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Área de Testes</h1>
            <p className="text-sm text-muted-foreground">
              Ative funcionalidades e gerencie a plataforma antes de liberar para os usuários
            </p>
          </div>
          <div className="ml-auto">
            <Badge variant="secondary" className="text-xs gap-1 border border-border/50">
              <ShieldCheck className="w-3 h-3" />
              Acesso restrito
            </Badge>
          </div>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Usuários totais", value: stats.totalUsers, icon: Users },
              { label: "Admins", value: stats.adminUsers, icon: Crown },
              { label: "Feature flags", value: stats.totalFlags, icon: ToggleRight },
              { label: "Flags ativas", value: stats.enabledFlags, icon: ShieldCheck },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="glass-card rounded-xl p-4">
                <Icon className="w-4 h-4 text-muted-foreground mb-2" />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Feature Flags */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">Feature Flags</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ative uma flag para liberar a funcionalidade a todos. Você sempre vê tudo, independente do estado.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="w-8 h-8"
                onClick={() => flagsQuery.refetch()}
              >
                <RefreshCw className={`w-4 h-4 ${flagsQuery.isFetching ? "animate-spin" : ""}`} />
              </Button>
              <FlagForm onSuccess={() => flagsQuery.refetch()} />
            </div>
          </div>

          {flags.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhuma feature flag criada ainda. Crie a primeira acima.
            </div>
          ) : (
            <div className="space-y-2">
              {flags.map((flag) => (
                <div
                  key={flag.key}
                  className="glass-card rounded-xl px-4 py-3 flex items-center gap-4 border border-border/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{flag.label}</span>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                        {flag.key}
                      </Badge>
                    </div>
                    {flag.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {flag.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={flag.enabled}
                    disabled={toggleFlag.isPending}
                    onClick={() => toggleFlag.mutate({ key: flag.key, enabled: !flag.enabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      flag.enabled ? "bg-emerald-500" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        flag.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>

                  <Badge
                    variant={flag.enabled ? "default" : "secondary"}
                    className={`text-xs shrink-0 ${flag.enabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : ""}`}
                  >
                    {flag.enabled ? "Ativo" : "Inativo"}
                  </Badge>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-destructive/60 hover:text-destructive shrink-0"
                    onClick={() => {
                      if (confirm(`Remover flag "${flag.key}"?`)) {
                        deleteFlag.mutate({ key: flag.key });
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Users */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">Usuários</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Todos os usuários cadastrados na plataforma
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8"
              onClick={() => usersQuery.refetch()}
            >
              <RefreshCw className={`w-4 h-4 ${usersQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {allUsers.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {allUsers.map((u) => (
                <div
                  key={u.id}
                  className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 border border-border/40"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {u.role === "admin" ? (
                      <Crown className="w-4 h-4 text-amber-500" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.name || "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {u.email || u.openId}
                    </div>
                  </div>
                  <Badge
                    variant={u.role === "admin" ? "default" : "secondary"}
                    className={`text-xs shrink-0 ${u.role === "admin" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30" : ""}`}
                  >
                    {u.role === "admin" ? "Admin" : "Usuário"}
                  </Badge>
                  <div className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                    {u.loginMethod ?? "email"}
                  </div>
                  <div className="text-[11px] text-muted-foreground shrink-0 hidden md:block">
                    {new Date(u.lastSignedIn).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
