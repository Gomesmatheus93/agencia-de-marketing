import AppLayout from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { DesignEditor } from "@/components/DesignEditor";
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
  LayoutDashboard,
  Image,
  FileText,
  GalleryHorizontal,
  Clapperboard,
  Share2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Search,
  Download,
  Building2,
  Upload,
  ImageOff,
  Pencil,
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
  trialExpiresAt: Date | null;
  usage: {
    images: number;
    articles: number;
    carousel: number;
    videos: number;
    posts: number;
    chats: number;
  };
};

const PLAN_CONFIG: Record<Plan, { label: string; badge: string; color: string }> = {
  free:   { label: "Free",    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700", color: "text-zinc-500" },
  pro:    { label: "Pro",     badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800", color: "text-blue-600" },
  agency: { label: "Agência", badge: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800", color: "text-violet-600" },
};

const ROLE_CONFIG: Record<Role, { label: string; badge: string }> = {
  user:  { label: "Usuário", badge: "bg-secondary text-secondary-foreground border-border" },
  admin: { label: "Admin",   badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
};

function trialStatus(u: UserRow): { label: string; color: string; icon: React.ReactNode } {
  if (u.plan === "pro" || u.plan === "agency") {
    return { label: "Pago", color: "text-emerald-600 dark:text-emerald-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
  }
  const exp = u.trialExpiresAt ? new Date(u.trialExpiresAt) : null;
  if (!exp) {
    return { label: "Legacy", color: "text-muted-foreground", icon: <Clock className="w-3.5 h-3.5" /> };
  }
  if (exp > new Date()) {
    const days = Math.ceil((exp.getTime() - Date.now()) / 86400000);
    return { label: `Trial (${days}d)`, color: "text-amber-600 dark:text-amber-400", icon: <Clock className="w-3.5 h-3.5" /> };
  }
  return { label: "Expirado", color: "text-destructive", icon: <XCircle className="w-3.5 h-3.5" /> };
}

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
        Criar usuário
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

// ── User Actions ──────────────────────────────────────────────────────────────

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
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-xs font-semibold truncate">{u.name || u.email}</p>
          <p className="text-[10px] text-muted-foreground">{u.email}</p>
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mudar plano</div>
        {(["free", "pro", "agency"] as Plan[]).map((p) => (
          <DropdownMenuItem key={p} className={cn("text-xs gap-2", u.plan === p && "text-primary font-semibold")} onClick={() => u.plan !== p && setPlan.mutate({ id: u.id, plan: p })}>
            <Crown className={cn("w-3.5 h-3.5", PLAN_CONFIG[p].color)} />
            {PLAN_CONFIG[p].label}
            {u.plan === p && <CheckCircle2 className="w-3 h-3 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Permissões</div>
            <DropdownMenuItem className="text-xs" onClick={() => setRole.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}>
              <Shield className="w-3.5 h-3.5 mr-2" />
              {u.role === "admin" ? "Rebaixar para Usuário" : "Promover para Admin"}
            </DropdownMenuItem>
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

// ── Toggle ────────────────────────────────────────────────────────────────────

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

// ── Usage Bar ─────────────────────────────────────────────────────────────────

const BAR_COLOR: Record<string, string> = {
  "text-blue-500":    "bg-blue-500",
  "text-emerald-500": "bg-emerald-500",
  "text-amber-500":   "bg-amber-500",
  "text-fuchsia-500": "bg-fuchsia-500",
  "text-orange-500":  "bg-orange-500",
  "text-violet-500":  "bg-violet-500",
};

function UsageBar({ value, max, icon: Icon, color }: { label: string; value: number; max: number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const barClass = BAR_COLOR[color] ?? "bg-primary";
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className={cn("w-3 h-3 shrink-0", color)} />
      <span className="text-[10px] text-muted-foreground w-4 text-right font-mono tabular-nums shrink-0">{value}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-0">
        <div className={cn("h-full rounded-full transition-all", barClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

const STAT_ICON_BG: Record<string, string> = {
  "text-blue-500":       "bg-blue-100 dark:bg-blue-950/30",
  "text-emerald-500":    "bg-emerald-100 dark:bg-emerald-950/30",
  "text-amber-500":      "bg-amber-100 dark:bg-amber-950/30",
  "text-destructive":    "bg-red-100 dark:bg-red-950/30",
  "text-violet-500":     "bg-violet-100 dark:bg-violet-950/30",
  "text-cyan-500":       "bg-cyan-100 dark:bg-cyan-950/30",
  "text-fuchsia-500":    "bg-fuchsia-100 dark:bg-fuchsia-950/30",
  "text-orange-500":     "bg-orange-100 dark:bg-orange-950/30",
};

function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: number | string; sub?: string; color: string; icon: React.ComponentType<{ className?: string }> }) {
  const bgClass = STAT_ICON_BG[color] ?? "bg-muted";
  return (
    <div className="glass-card rounded-xl p-5">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", bgClass)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Companies & Arts ─────────────────────────────────────────────────────────

type CompanyRow = {
  id: number;
  name: string;
  domains: { id: number; domain: string }[];
};

type ArtTemplateRow = {
  id: number;
  companyId: number | null;
  name: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  canvasJson: Record<string, unknown> | null;
};

function CompanyCard({ company, onChanged }: { company: CompanyRow; onChanged: () => void }) {
  const [domain, setDomain] = useState("");
  const addDomain = trpc.admin.addCompanyDomain.useMutation({
    onSuccess: () => { setDomain(""); onChanged(); },
    onError: (e) => toast.error(e.message),
  });
  const removeDomain = trpc.admin.removeCompanyDomain.useMutation({
    onSuccess: onChanged,
    onError: (e) => toast.error(e.message),
  });
  const deleteCompany = trpc.admin.deleteCompany.useMutation({
    onSuccess: () => { toast.success("Empresa removida"); onChanged(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="glass-card rounded-xl px-4 py-3 border border-border/40 space-y-2.5">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium flex-1">{company.name}</p>
        <Button
          size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive"
          onClick={() => { if (confirm(`Excluir "${company.name}" e todas as artes vinculadas a ela?`)) deleteCompany.mutate({ id: company.id }); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {company.domains.map((d) => (
          <Badge key={d.id} variant="outline" className="text-[11px] gap-1.5 pr-1.5">
            {d.domain}
            <button
              className="text-muted-foreground/60 hover:text-destructive"
              onClick={() => removeDomain.mutate({ id: d.id })}
              title="Remover domínio"
            >
              <XCircle className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="dominio-da-empresa.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="h-8 text-xs flex-1"
        />
        <Button
          size="sm" variant="outline" className="h-8 text-xs gap-1.5"
          disabled={!domain || addDomain.isPending}
          onClick={() => addDomain.mutate({ companyId: company.id, domain })}
        >
          <Plus className="w-3.5 h-3.5" /> Domínio
        </Button>
      </div>
    </div>
  );
}

function NewArtTemplateForm({
  companies,
  onCreated,
}: {
  companies: CompanyRow[];
  onCreated: (template: ArtTemplateRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState<string>("global");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTemplate = trpc.admin.createArtTemplate.useMutation({
    onSuccess: (tpl) => {
      toast.success("Arte criada — agora monte o layout no editor.");
      setOpen(false);
      setName("");
      setCompanyId("global");
      setSelectedFileName(null);
      onCreated(tpl as ArtTemplateRow);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="w-4 h-4" /> Nova arte
      </Button>
    );
  }

  return (
    <div className="glass-card p-4 rounded-xl space-y-3 border border-border/50">
      <p className="text-sm font-semibold">Nova arte</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input placeholder="ex: Post institucional" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Empresa</label>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="global">Global (todas as empresas)</option>
            {companies.map((c) => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Imagem base</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith("image/")) {
              toast.error("Selecione apenas arquivos de imagem");
              return;
            }
            setSelectedFileName(file.name);
            if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
            const reader = new FileReader();
            reader.onload = (ev) => {
              const imageDataUrl = (ev.target?.result as string) || "";
              if (!imageDataUrl) return;
              createTemplate.mutate({
                name: name || file.name.replace(/\.[^.]+$/, ""),
                companyId: companyId === "global" ? null : Number(companyId),
                imageDataUrl,
              });
            };
            reader.readAsDataURL(file);
          }}
        />
        <button
          type="button"
          disabled={createTemplate.isPending}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors",
            "border-border/60 hover:border-primary/50 hover:bg-accent/30 disabled:opacity-60"
          )}
        >
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {createTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">
              {createTemplate.isPending ? "Enviando..." : selectedFileName ?? "Clique para selecionar uma imagem"}
            </p>
            <p className="text-[10px] text-muted-foreground">{selectedFileName ? "Clique para trocar" : "PNG ou JPG"}</p>
          </div>
        </button>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

function CompaniesArtsSection() {
  const companiesQuery = trpc.admin.listCompanies.useQuery();
  const templatesQuery = trpc.admin.listArtTemplates.useQuery();
  const [newCompanyName, setNewCompanyName] = useState("");
  const [editorTarget, setEditorTarget] = useState<{ id: number; imageUrl: string; canvasJson: Record<string, unknown> | null } | null>(null);

  const createCompany = trpc.admin.createCompany.useMutation({
    onSuccess: () => { setNewCompanyName(""); companiesQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteTemplate = trpc.admin.deleteArtTemplate.useMutation({
    onSuccess: () => { toast.success("Arte removida"); templatesQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const updateTemplate = trpc.admin.updateArtTemplate.useMutation({
    onSuccess: () => { toast.success("Layout salvo!"); templatesQuery.refetch(); setEditorTarget(null); },
    onError: (e) => toast.error(e.message),
  });

  const companies = (companiesQuery.data ?? []) as CompanyRow[];
  const templates = (templatesQuery.data ?? []) as ArtTemplateRow[];
  const companyName = (id: number | null) => (id === null ? "Global" : companies.find((c) => c.id === id)?.name ?? "—");

  return (
    <div className="space-y-8">
      {/* Empresas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2"><Building2 className="w-4 h-4" />Empresas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Domínios de e-mail que liberam a aba "Artes" pros usuários dessa empresa.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Nome da empresa" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="w-48 h-9" />
            <Button size="sm" disabled={!newCompanyName || createCompany.isPending} onClick={() => createCompany.mutate({ name: newCompanyName })}>
              <Plus className="w-4 h-4" /> Nova empresa
            </Button>
          </div>
        </div>
        {companies.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-muted-foreground text-sm">Nenhuma empresa cadastrada ainda.</div>
        ) : (
          <div className="space-y-2">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} onChanged={() => companiesQuery.refetch()} />
            ))}
          </div>
        )}
      </section>

      {/* Artes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-base flex items-center gap-2"><Upload className="w-4 h-4" />Artes prontas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Suba a imagem-base e monte o layout com os textos que os usuários vão poder editar.</p>
          </div>
          <NewArtTemplateForm companies={companies} onCreated={(tpl) => setEditorTarget({ id: tpl.id, imageUrl: tpl.imageUrl, canvasJson: null })} />
        </div>
        {templates.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">Nenhuma arte cadastrada ainda.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="glass-card rounded-xl overflow-hidden border border-border/40">
                <div className="aspect-[4/5] bg-muted/40">
                  {tpl.thumbnailUrl || tpl.imageUrl ? (
                    <img src={tpl.thumbnailUrl ?? tpl.imageUrl} alt={tpl.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><ImageOff className="w-8 h-8" /></div>
                  )}
                </div>
                <div className="p-2.5 space-y-1.5">
                  <p className="text-xs font-medium truncate">{tpl.name}</p>
                  <Badge variant="outline" className="text-[10px]">{companyName(tpl.companyId)}</Badge>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      size="sm" variant="outline" className="flex-1 gap-1.5 h-7 text-xs"
                      onClick={() => setEditorTarget({ id: tpl.id, imageUrl: tpl.imageUrl, canvasJson: tpl.canvasJson })}
                    >
                      <Pencil className="w-3 h-3" /> {tpl.canvasJson ? "Editar layout" : "Montar layout"}
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive"
                      onClick={() => { if (confirm(`Excluir arte "${tpl.name}"?`)) deleteTemplate.mutate({ id: tpl.id }); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <DesignEditor
        open={!!editorTarget}
        onClose={() => setEditorTarget(null)}
        initialImageUrl={editorTarget?.canvasJson ? undefined : editorTarget?.imageUrl}
        initialCanvasJson={editorTarget?.canvasJson ?? null}
        onSave={(dataUrl, canvasJson) => {
          if (!editorTarget) return;
          updateTemplate.mutate({ id: editorTarget.id, canvasJson, thumbnailDataUrl: dataUrl });
        }}
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "platform" | "companies";

export default function SettingsPage() {
  const { t } = useLanguage();
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<Plan | "all">("all");

  useEffect(() => {
    if (!loading && isAuthenticated && !isAdmin) navigate("/dashboard");
  }, [loading, isAuthenticated, isAdmin, navigate]);

  const statsQuery  = trpc.admin.getStats.useQuery(undefined, { enabled: isAdmin });
  const flagsQuery  = trpc.admin.getFeatureFlags.useQuery(undefined, { enabled: isAdmin });
  const detailQuery = trpc.admin.listUsersDetailed.useQuery(undefined, { enabled: isAdmin });

  const toggleFlag = trpc.admin.toggleFeatureFlag.useMutation({ onSuccess: () => flagsQuery.refetch(), onError: (e) => toast.error(e.message) });
  const deleteFlag = trpc.admin.deleteFeatureFlag.useMutation({ onSuccess: () => { toast.success("Flag removida"); flagsQuery.refetch(); }, onError: (e) => toast.error(e.message) });
  const upsertFlag = trpc.admin.upsertFeatureFlag.useMutation({ onSuccess: () => flagsQuery.refetch(), onError: (e) => toast.error(e.message) });

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="glass-card p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="glass-card p-8 flex flex-col items-center gap-4 text-center max-w-sm">
          <Shield className="w-10 h-10 text-muted-foreground" />
          <p className="font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Esta página é exclusiva para administradores.</p>
          <Button size="sm" onClick={() => navigate("/dashboard")}>Voltar ao painel</Button>
        </div>
      </div>
    );
  }

  const stats    = statsQuery.data;
  const flags    = flagsQuery.data ?? [];
  const allUsers = (detailQuery.data ?? []) as UserRow[];

  const regFlag = flags.find((f) => f.key === "open_registration");
  const registrationOpen = regFlag ? regFlag.enabled : true;

  // Computed KPIs from user list
  const paidUsers    = allUsers.filter((u) => u.plan === "pro" || u.plan === "agency");
  const trialUsers   = allUsers.filter((u) => u.plan === "free" && u.trialExpiresAt && new Date(u.trialExpiresAt) > new Date());
  const expiredUsers = allUsers.filter((u) => u.plan === "free" && u.trialExpiresAt && new Date(u.trialExpiresAt) <= new Date());
  const newThisWeek  = allUsers.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 7 * 86400000);

  // Total content generated across all users
  const totalContent = allUsers.reduce((acc, u) => {
    return acc + u.usage.images + u.usage.articles + u.usage.carousel + u.usage.videos + u.usage.posts + u.usage.chats;
  }, 0);

  // Filtered users
  const filteredUsers = allUsers.filter((u) => {
    const matchPlan = planFilter === "all" || u.plan === planFilter;
    const matchSearch = !search || [u.name, u.email].some((s) => s?.toLowerCase().includes(search.toLowerCase()));
    return matchPlan && matchSearch;
  });

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview",   label: "Visão Geral",      icon: LayoutDashboard },
    { id: "users",      label: "Usuários",         icon: Users },
    { id: "platform",   label: "Plataforma",       icon: Settings },
    { id: "companies",  label: "Empresas & Artes", icon: Building2 },
  ];

  return (
    <AppLayout activeModule="settings">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-md">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Painel Admin</h1>
            <p className="text-sm text-muted-foreground">Controle total da plataforma KrythosLab</p>
          </div>
          <Badge variant="secondary" className="ml-auto text-xs gap-1 border border-border/50">
            <Shield className="w-3 h-3" />
            {user.name}
          </Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass-card rounded-xl w-fit">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                tab === id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="Total de contas" value={allUsers.length} sub={`${newThisWeek.length} esta semana`} color="text-blue-500" icon={Users} />
              <StatCard label="Pagantes" value={paidUsers.length} sub={`${stats?.planCounts.pro ?? 0} Pro · ${stats?.planCounts.agency ?? 0} Agência`} color="text-emerald-500" icon={CheckCircle2} />
              <StatCard label="Em trial" value={trialUsers.length} sub="período ativo" color="text-amber-500" icon={Clock} />
              <StatCard label="Trial expirado" value={expiredUsers.length} sub="sem assinatura" color="text-destructive" icon={XCircle} />
              <StatCard label="Novos (7d)" value={newThisWeek.length} sub="cadastros recentes" color="text-violet-500" icon={TrendingUp} />
              <StatCard label="Conteúdo gerado" value={totalContent} sub="todos os usuários" color="text-cyan-500" icon={Sparkles} />
            </div>

            {/* Recent signups */}
            <div className="space-y-3">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Cadastros recentes
              </h2>
              <div className="glass-card rounded-xl divide-y divide-border/30 overflow-hidden">
                {allUsers.slice(0, 8).map((u) => {
                  const ts = trialStatus(u);
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", u.role === "admin" ? "bg-amber-100 dark:bg-amber-950/40" : "bg-muted")}>
                        {u.role === "admin" ? <Crown className="w-4 h-4 text-amber-500" /> : <User className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      <div className={cn("flex items-center gap-1 text-xs font-medium shrink-0", ts.color)}>
                        {ts.icon}
                        {ts.label}
                      </div>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0", PLAN_CONFIG[u.plan].badge)}>{PLAN_CONFIG[u.plan].label}</span>
                      <div className="text-[11px] text-muted-foreground shrink-0 w-20 text-right">
                        {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  );
                })}
                {allUsers.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
                )}
              </div>
            </div>

            {/* Content breakdown */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "Imagens geradas",   key: "images"   as const, icon: Image,           color: "text-blue-500" },
                { label: "Artigos criados",    key: "articles" as const, icon: FileText,        color: "text-emerald-500" },
                { label: "Carrosséis",         key: "carousel" as const, icon: GalleryHorizontal, color: "text-amber-500" },
                { label: "Vídeos com avatar",  key: "videos"   as const, icon: Clapperboard,   color: "text-fuchsia-500" },
                { label: "Posts publicados",   key: "posts"    as const, icon: Share2,          color: "text-orange-500" },
                { label: "Conversas de Chat",  key: "chats"    as const, icon: MessageSquare,   color: "text-violet-500" },
              ].map(({ label, key, icon: Icon, color }) => {
                const total = allUsers.reduce((acc, u) => acc + u.usage[key], 0);
                const topUser = allUsers.reduce<UserRow | null>((best, u) => (!best || u.usage[key] > best.usage[key] ? u : best), null);
                return (
                  <div key={key} className="glass-card rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", color)} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="text-2xl font-bold tabular-nums">{total}</div>
                    {topUser && topUser.usage[key] > 0 && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        Top: <span className="text-foreground font-medium">{topUser.name || topUser.email}</span> ({topUser.usage[key]})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-8 w-56 text-sm"
                  />
                </div>
                <div className="flex rounded-lg overflow-hidden border border-border/50 h-8">
                  {(["all", "free", "pro", "agency"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlanFilter(p)}
                      className={cn(
                        "px-3 text-xs font-medium transition-colors",
                        planFilter === p ? "bg-primary text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {p === "all" ? "Todos" : PLAN_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => detailQuery.refetch()}>
                  <RefreshCw className={cn("w-4 h-4", detailQuery.isFetching && "animate-spin")} />
                </Button>
                <InviteUserForm onSuccess={() => detailQuery.refetch()} />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">{filteredUsers.length} usuário{filteredUsers.length !== 1 ? "s" : ""}</div>

            <div className="space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="glass-card rounded-xl p-8 text-center text-muted-foreground text-sm">Nenhum usuário encontrado.</div>
              ) : filteredUsers.map((u) => {
                const ts = trialStatus(u);
                const exp = u.trialExpiresAt ? new Date(u.trialExpiresAt) : null;
                const totalGen = u.usage.images + u.usage.articles + u.usage.carousel + u.usage.videos + u.usage.posts;
                return (
                  <div
                    key={u.id}
                    className={cn(
                      "glass-card rounded-xl border transition-opacity",
                      u.isActive ? "border-border/40" : "border-border/20 opacity-60"
                    )}
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                        u.role === "admin" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600" : "bg-muted text-muted-foreground"
                      )}>
                        {u.name ? u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{u.name || "Sem nome"}</span>
                          {u.id === user.id && <span className="text-[10px] text-muted-foreground">(você)</span>}
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", ROLE_CONFIG[u.role].badge)}>{ROLE_CONFIG[u.role].label}</span>
                          {!u.isActive && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border-red-200">Inativo</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>

                      {/* Plan */}
                      <div className="hidden sm:flex flex-col items-end shrink-0 gap-0.5">
                        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", PLAN_CONFIG[u.plan].badge)}>{PLAN_CONFIG[u.plan].label}</span>
                        <div className={cn("flex items-center gap-1 text-[10px] font-medium", ts.color)}>
                          {ts.icon}
                          {ts.label}
                        </div>
                      </div>

                      {/* Trial expiry */}
                      <div className="hidden md:flex flex-col items-end shrink-0 gap-0.5 w-28">
                        {exp ? (
                          <>
                            <div className="text-[10px] text-muted-foreground">Vencimento</div>
                            <div className={cn("text-[11px] font-medium", exp <= new Date() && u.plan === "free" ? "text-destructive" : "text-foreground")}>
                              {exp.toLocaleDateString("pt-BR")}
                            </div>
                          </>
                        ) : u.plan !== "free" ? (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Ativo
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground">Sem trial</div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          Entrou {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      {/* Total content */}
                      <div className="hidden lg:flex flex-col items-end shrink-0 gap-0.5 w-20">
                        <div className="text-base font-bold tabular-nums text-foreground">{totalGen}</div>
                        <div className="text-[10px] text-muted-foreground">conteúdos</div>
                        <div className="text-[10px] text-muted-foreground">{u.usage.chats} chats</div>
                      </div>

                      <UserActions u={u} currentUserId={user.id} onRefresh={() => detailQuery.refetch()} />
                    </div>

                    {/* Usage bars */}
                    <div className="px-4 pb-3 grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-1.5">
                      <UsageBar label="Imagens"   value={u.usage.images}   max={Math.max(1, ...allUsers.map((x) => x.usage.images))}   icon={Image}              color="text-blue-500" />
                      <UsageBar label="Artigos"   value={u.usage.articles} max={Math.max(1, ...allUsers.map((x) => x.usage.articles))} icon={FileText}           color="text-emerald-500" />
                      <UsageBar label="Carrossel" value={u.usage.carousel} max={Math.max(1, ...allUsers.map((x) => x.usage.carousel))} icon={GalleryHorizontal}  color="text-amber-500" />
                      <UsageBar label="Vídeos"    value={u.usage.videos}   max={Math.max(1, ...allUsers.map((x) => x.usage.videos))}   icon={Clapperboard}       color="text-fuchsia-500" />
                      <UsageBar label="Posts"     value={u.usage.posts}    max={Math.max(1, ...allUsers.map((x) => x.usage.posts))}    icon={Share2}             color="text-orange-500" />
                      <UsageBar label="Chats"     value={u.usage.chats}    max={Math.max(1, ...allUsers.map((x) => x.usage.chats))}    icon={MessageSquare}      color="text-violet-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PLATFORM TAB ── */}
        {tab === "platform" && (
          <div className="space-y-6 animate-fade-in-up">

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
        )}

        {/* ── COMPANIES & ARTS TAB ── */}
        {tab === "companies" && (
          <div className="animate-fade-in-up">
            <CompaniesArtsSection />
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// Missing import for Sparkles
function Sparkles({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
