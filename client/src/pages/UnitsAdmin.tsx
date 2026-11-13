import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Activity, Building2, CalendarDays, Download, ExternalLink, FolderOpen, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

// Painel do super admin: unidades (academias parceiras), acessos, plano da semana e materiais.

const ACTION_LABEL: Record<string, string> = {
  "sso.login": "Entrou na plataforma", "unit.plan.view": "Viu o planejamento", "unit.plan.download": "Baixou do planejamento", "unit.material.download": "Baixou material", "unit.material.view": "Abriu material",
};
const fmtDateTime = (d: string | Date | null) => (d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const ddmm = (ymd: string) => `${ymd.slice(8)}/${ymd.slice(5, 7)}`;
function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
const sundayOf = (ymd: string) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + 6); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const addWeeks = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + 7 * n); return mondayOf(d); };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="border-border/60"><CardContent className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent></Card>
  );
}

// ── Visão geral ────────────────────────────────────────────────────────────
function Overview({ onOpen }: { onOpen: (id: number) => void }) {
  const overview = trpc.unitAdmin.overview.useQuery(undefined, { refetchInterval: 60_000 });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id?: number; code: string; name: string; city: string; active: boolean } | null>(null);
  const utils = trpc.useUtils();
  const save = trpc.unitAdmin.saveUnit.useMutation({
    onSuccess: () => { toast.success("Unidade salva."); setEditing(null); utils.unitAdmin.overview.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const t = overview.data?.totals;
  const list = (overview.data?.units ?? []).filter((u) => `${u.name} ${u.code} ${u.city ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Unidades" value={t?.units ?? "…"} hint={t ? `${t.activeUnits} ativas` : undefined} />
        <Stat label="Contas de unidade" value={t?.accounts ?? "…"} hint={t ? `${t.allUnitsAccounts} veem todas · ${t.neverAccessed} unidades nunca acessaram` : undefined} />
        <Stat label="Acessaram (30 dias)" value={t ? `${t.accessed30d}/${t.units}` : "…"} hint="unidades com pelo menos 1 login" />
        <Stat label="Plano da semana" value={t ? (t.currentWeekPublished ? "Publicado" : "Não publicado") : "…"} hint={t ? `${t.withMidiaKit} unidades com mídia kit · ${t.generalMaterials} materiais gerais` : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidade, código ou cidade" className="pl-9" />
        </div>
        <Button onClick={() => setEditing({ code: "", name: "", city: "", active: true })}><Plus className="mr-1.5 h-4 w-4" />Nova unidade</Button>
      </div>

      <Card className="border-border/60"><CardContent className="overflow-x-auto p-0">
        {overview.isLoading ? <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p> : list.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma unidade ainda. Elas aparecem aqui no primeiro login pelo sistema da Alle, ou cadastre em "Nova unidade".</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Unidade</th><th className="p-3">Contas</th><th className="p-3">Último acesso</th><th className="p-3 text-right">Logins 30d</th><th className="p-3 text-right">Viu plano</th><th className="p-3 text-right">Downloads</th><th className="p-3">Mídia kit</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className={cn("border-b last:border-0 hover:bg-muted/40", !u.active && "opacity-50")}>
                  <td className="p-3"><button type="button" onClick={() => onOpen(u.id)} className="text-left font-medium hover:text-primary">{u.name}</button><p className="text-xs text-muted-foreground">{u.code.startsWith("kit:") ? <span className="text-amber-600 dark:text-amber-400">aguardando 1º acesso</span> : "ligada ao sistema da Alle"}{u.groupName ? ` · ${u.groupName}` : ""}{u.city ? ` · ${u.city}` : ""}{!u.active ? " · desativada" : ""}</p></td>
                  <td className="p-3">{u.accounts}</td>
                  <td className="p-3 whitespace-nowrap">{u.lastAccess ? fmtDateTime(u.lastAccess) : <span className="text-amber-600">nunca</span>}</td>
                  <td className="p-3 text-right tabular-nums">{u.logins30d}</td>
                  <td className="p-3 text-right tabular-nums">{u.views30d}</td>
                  <td className="p-3 text-right tabular-nums">{u.downloads30d}</td>
                  <td className="p-3">{u.hasMidiaKit ? <span className="text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing({ id: u.id, code: u.code, name: u.name, city: u.city ?? "", active: u.active })}>Editar</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar unidade" : "Nova unidade"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm"><span className="font-medium">Nome</span><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Allp Fit Capim Macio" /></label>
              <label className="block space-y-1 text-sm"><span className="font-medium">Código no sistema da Alle</span><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toLowerCase() })} placeholder="capim-macio" /><span className="text-xs text-muted-foreground">Preenchido sozinho no primeiro login. Antes disso fica "kit:…" e a academia é ligada pelo <b>nome</b>: ajuste o nome para ficar igual ao do sistema da Alle, se for diferente.</span></label>
              <label className="block space-y-1 text-sm"><span className="font-medium">Cidade</span><Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="Natal/RN" /></label>
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Unidade ativa (pode acessar)</span><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></label>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button disabled={save.isPending} onClick={() => save.mutate({ ...editing, city: editing.city || undefined })}>{save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Detalhe de uma unidade (contas + atividade) ────────────────────────────
function UnitDetail({ unitId, onClose }: { unitId: number; onClose: () => void }) {
  const overview = trpc.unitAdmin.overview.useQuery();
  const unit = overview.data?.units.find((u) => u.id === unitId);
  const accounts = trpc.unitAdmin.unitAccounts.useQuery({ unitId });
  const activity = trpc.unitAdmin.activity.useQuery({ unitId, limit: 50 });
  const utils = trpc.useUtils();
  const setActive = trpc.unitAdmin.setAccountActive.useMutation({ onSuccess: () => utils.unitAdmin.unitAccounts.invalidate(), onError: (e) => toast.error(e.message) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{unit?.name ?? "Unidade"}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{unit?.code.startsWith("kit:") ? "aguardando 1º acesso" : "ligada ao sistema da Alle"}{unit?.city ? ` · ${unit.city}` : ""} · {unit?.ownMaterials ?? 0} materiais próprios</p>
        <h3 className="mt-2 text-sm font-semibold">Contas</h3>
        {accounts.data?.length ? accounts.data.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.name}{a.role ? <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">{a.role}</span> : null}{a.allUnits ? <span className="ml-1 text-[10px] text-muted-foreground">todas as academias</span> : null}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}{a.groupName ? ` · ${a.groupName}` : ""} · último acesso {fmtDateTime(a.lastSignedIn)}</p>
            </div>
            <label className="flex items-center gap-2 text-xs">{a.isActive ? "Ativa" : "Bloqueada"}<Switch checked={a.isActive} onCheckedChange={(v) => setActive.mutate({ userId: a.id, active: v })} /></label>
          </div>
        )) : <p className="text-sm text-muted-foreground">Nenhuma conta ainda: ela é criada no primeiro login pelo sistema da Alle.</p>}
        <h3 className="mt-3 text-sm font-semibold">Atividade recente</h3>
        {activity.data?.length ? (
          <ul className="space-y-1 text-sm">{activity.data.map((r, i) => <li key={i} className="flex gap-2"><span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDateTime(r.at)}</span><span>{r.userName}: {ACTION_LABEL[r.action] ?? r.action}{r.detail && r.action !== "sso.login" ? ` (${r.detail})` : ""}</span></li>)}</ul>
        ) : <p className="text-sm text-muted-foreground">Sem atividade registrada.</p>}
      </DialogContent>
    </Dialog>
  );
}

// ── Atividade geral ────────────────────────────────────────────────────────
function ActivityTab() {
  const activity = trpc.unitAdmin.activity.useQuery({ limit: 200 }, { refetchInterval: 60_000 });
  return (
    <Card className="border-border/60"><CardContent className="overflow-x-auto p-0">
      {activity.isLoading ? <p className="p-6 text-sm text-muted-foreground">Carregando…</p> : !activity.data?.length ? <p className="p-6 text-sm text-muted-foreground">Nenhum acesso registrado ainda.</p> : (
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-3">Quando</th><th className="p-3">Unidade</th><th className="p-3">Pessoa</th><th className="p-3">O que fez</th></tr></thead>
          <tbody>{activity.data.map((r, i) => (
            <tr key={i} className="border-b last:border-0"><td className="whitespace-nowrap p-3">{fmtDateTime(r.at)}</td><td className="p-3">{r.unitName}</td><td className="p-3">{r.userName}<p className="text-xs text-muted-foreground">{r.email}{r.role ? ` · ${r.role}` : ""}</p></td>
              <td className="p-3">{ACTION_LABEL[r.action] ?? r.action}{r.detail && r.action !== "sso.login" ? <span className="text-muted-foreground"> · {r.detail}</span> : null}</td></tr>
          ))}</tbody>
        </table>
      )}
    </CardContent></Card>
  );
}

// ── Planejamento semanal ───────────────────────────────────────────────────
type Item = { date: string; time?: string | null; format?: string | null; title: string; type?: string | null; caption?: string | null; imageUrls: string[] };
function PlanTab() {
  const [week, setWeek] = useState(mondayOf());
  const saved = trpc.unitAdmin.getPlan.useQuery({ weekStart: week });
  const [draft, setDraft] = useState<{ week: string; title: string; notes: string; items: Item[] } | null>(null);
  const current = draft?.week === week ? draft : saved.data ? { week, title: saved.data.title ?? "", notes: saved.data.notes ?? "", items: saved.data.items } : null;
  const utils = trpc.useUtils();
  const importAlle = trpc.unitAdmin.importFromAlle.useMutation({
    onSuccess: (r) => { setDraft({ week, title: current?.title ?? "", notes: current?.notes ?? "", items: r.items }); toast.success(r.items.length ? `${r.items.length} posts com arte importados do planejamento da Alle.` : "Nenhuma pauta desta semana tem arte criada ainda."); },
    onError: (e) => toast.error(e.message),
  });
  const save = trpc.unitAdmin.savePlan.useMutation({
    onSuccess: (_r, v) => { toast.success(v.publish ? "Publicado para todas as unidades!" : "Rascunho salvo."); setDraft(null); utils.unitAdmin.getPlan.invalidate(); utils.unitAdmin.overview.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const setItem = (i: number, patch: Partial<Item>) => current && setDraft({ ...current, items: current.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setWeek(addWeeks(week, -1))}>‹</Button>
        <span className="font-semibold">Semana de {ddmm(week)} a {ddmm(sundayOf(week))}</span>
        <Button variant="outline" size="sm" onClick={() => setWeek(addWeeks(week, 1))}>›</Button>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", saved.data?.status === "published" ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground")}>{saved.data ? (saved.data.status === "published" ? "Publicado" : "Rascunho") : "Sem plano"}</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={importAlle.isPending} onClick={() => importAlle.mutate({ weekStart: week })}>{importAlle.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Importar do planejamento da Alle</Button>
        </div>
      </div>
      {!current ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum plano para esta semana. Clique em "Importar do planejamento da Alle" para trazer as pautas com arte criada.</p>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            <Input value={current.title} onChange={(e) => setDraft({ ...current, title: e.target.value })} placeholder="Título (ex.: Semana da Black Friday)" />
            <Input value={current.notes} onChange={(e) => setDraft({ ...current, notes: e.target.value })} placeholder="Recado para as unidades (opcional)" />
          </div>
          {current.items.map((it, i) => (
            <Card key={i} className="border-border/60"><CardContent className="grid gap-3 p-3 md:grid-cols-[220px_1fr]">
              <div className="flex gap-1 overflow-x-auto">{it.imageUrls.map((u) => <img key={u} src={u} alt="" className="h-28 w-[90px] shrink-0 rounded-md border object-cover" />)}</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm"><span className="font-semibold">{ddmm(it.date)}{it.time ? ` · ${it.time}` : ""}</span><span className="text-muted-foreground">{it.format}</span>
                  <button type="button" className="ml-auto text-muted-foreground hover:text-destructive" title="Tirar da semana" onClick={() => setDraft({ ...current, items: current.items.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button></div>
                <Input value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
                <Textarea rows={4} value={it.caption ?? ""} onChange={(e) => setItem(i, { caption: e.target.value })} className="text-sm" placeholder="Legenda que a unidade vai copiar" />
              </div>
            </CardContent></Card>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate({ weekStart: week, title: current.title, notes: current.notes, items: current.items, publish: false })}>Salvar rascunho</Button>
            <Button disabled={save.isPending || current.items.length === 0} onClick={() => { if (confirm(`Publicar o plano da semana de ${ddmm(week)} para todas as unidades?`)) save.mutate({ weekStart: week, title: current.title, notes: current.notes, items: current.items, publish: true }); }}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Publicar para as unidades
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Materiais ──────────────────────────────────────────────────────────────
function MaterialsTab() {
  const overview = trpc.unitAdmin.overview.useQuery();
  const materials = trpc.unitAdmin.materials.useQuery();
  const utils = trpc.useUtils();
  const add = trpc.unitAdmin.addMaterial.useMutation({ onError: (e) => toast.error(e.message) });
  const del = trpc.unitAdmin.deleteMaterial.useMutation({ onSuccess: () => utils.unitAdmin.materials.invalidate() });
  const [target, setTarget] = useState<string>("geral");
  const [kind, setKind] = useState<"material" | "midia_kit">("material");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const unitName = useMemo(() => new Map((overview.data?.units ?? []).map((u) => [u.id, u.name])), [overview.data]);

  const upload = async (file?: File) => {
    if (!file) return;
    const unitId = target === "geral" ? null : Number(target);
    if (kind === "midia_kit" && unitId === null) return toast.error("O mídia kit é de uma unidade: escolha a unidade.");
    setBusy(true);
    try {
      const pre = await fetch("/api/request-presigned-upload", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ contentType: file.type || "application/octet-stream" }) });
      const { presignedUrl, publicUrl } = (await pre.json()) as { presignedUrl: string | null; publicUrl: string | null };
      if (!pre.ok || !presignedUrl || !publicUrl) throw new Error("Não foi possível preparar o envio.");
      const put = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("O envio do arquivo falhou.");
      await add.mutateAsync({ unitId, kind, title: title.trim() || file.name, fileUrl: publicUrl, fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size });
      toast.success("Material disponibilizado.");
      setTitle("");
      utils.unitAdmin.materials.invalidate();
      utils.unitAdmin.overview.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60"><CardContent className="grid gap-2 p-4 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
        <label className="space-y-1 text-sm"><span className="font-medium">Para quem</span>
          <select value={target} onChange={(e) => { setTarget(e.target.value); if (e.target.value === "geral") setKind("material"); }} className="h-9 w-full rounded-md border bg-background px-2">
            <option value="geral">Todas as unidades (biblioteca geral)</option>
            {(overview.data?.units ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Tipo</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "material" | "midia_kit")} className="h-9 w-full rounded-md border bg-background px-2" disabled={target === "geral"}>
            <option value="material">Material</option><option value="midia_kit">Mídia kit</option>
          </select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Título (opcional)</span><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mídia kit novembro" /></label>
        <label className={cn("inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground", busy && "pointer-events-none opacity-60")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Enviar arquivo
          <input type="file" className="hidden" accept="application/pdf,application/zip,image/*,video/*" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </CardContent></Card>
      <Card className="border-border/60"><CardContent className="p-0">
        {!materials.data?.length ? <p className="p-6 text-sm text-muted-foreground">Nenhum material enviado ainda.</p> : materials.data.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b p-3 text-sm last:border-0">
            <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{m.title}</p><p className="truncate text-xs text-muted-foreground">{m.unitId ? `${unitName.get(m.unitId) ?? "Unidade"} · ${m.kind === "midia_kit" ? "Mídia kit" : "Material"}` : "Todas as unidades"} · {m.fileName}</p></div>
            <a href={m.fileUrl} target="_blank" rel="noreferrer" className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Abrir"><ExternalLink className="h-4 w-4" /></a>
            <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Apagar" onClick={() => { if (confirm(`Apagar "${m.title}"?`)) del.mutate({ id: m.id }); }}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}

export default function UnitsAdmin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"geral" | "atividade" | "plano" | "materiais">("geral");
  const [open, setOpen] = useState<number | null>(null);
  if (user && user.role !== "admin") return <AppLayout activeModule="units"><p className="p-8 text-sm text-muted-foreground">Apenas administradores.</p></AppLayout>;
  const tabs = [["geral", "Visão geral", Building2], ["atividade", "Atividade", Activity], ["plano", "Planejamento semanal", CalendarDays], ["materiais", "Materiais e mídia kits", Download]] as const;
  return (
    <AppLayout activeModule="units">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Unidades parceiras</h1>
              <p className="text-sm text-muted-foreground">Quem acessou, o que está disponível para cada academia, o planejamento da semana e os materiais.</p>
            </div>
            <Button variant="outline" size="sm" asChild><Link href="/unidade">Ver o portal como unidade</Link></Button>
          </header>
          <nav className="flex flex-wrap gap-1 border-b">
            {tabs.map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium", tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
          {tab === "geral" && <Overview onOpen={setOpen} />}
          {tab === "atividade" && <ActivityTab />}
          {tab === "plano" && <PlanTab />}
          {tab === "materiais" && <MaterialsTab />}
          {open !== null && <UnitDetail unitId={open} onClose={() => setOpen(null)} />}
        </div>
      </main>
    </AppLayout>
  );
}
