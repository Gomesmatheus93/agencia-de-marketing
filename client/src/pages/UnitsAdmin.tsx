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
import { Activity, Building2, CalendarDays, Clock3, Download, ExternalLink, FolderOpen, LifeBuoy, Loader2, Megaphone, Plus, Search, Send, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

// Painel do super admin: unidades (academias parceiras), acessos, plano da semana e materiais.

const ACTION_LABEL: Record<string, string> = {
  "sso.login": "Entrou na plataforma", "unit.plan.view": "Viu o planejamento", "unit.plan.download": "Baixou do planejamento", "unit.material.download": "Baixou material", "unit.material.view": "Abriu material", "unit.plan.posted": "Marcou como postado", "unit.support.opened": "Abriu um chamado",
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
  const [editing, setEditing] = useState<{ id?: number; code: string; name: string; city: string; active: boolean; signupUrl: string } | null>(null);
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
        <Stat label="Adesão às postagens" value={t ? (t.adherence4w === null ? "—" : `${t.adherence4w}%`) : "…"} hint="posts marcados como postados, últimas 4 semanas" />
        <Stat label="Postaram nesta semana" value={t ? `${t.postedThisWeek}/${t.activeUnits}` : "…"} hint="unidades com pelo menos 1 “Já postei”" />
        <Stat label="Com link de adesão" value={t ? `${t.withLink}/${t.units}` : "…"} hint="link e QR code no portal" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidade, código ou cidade" className="pl-9" />
        </div>
        <Button onClick={() => setEditing({ code: "", name: "", city: "", active: true, signupUrl: "" })}><Plus className="mr-1.5 h-4 w-4" />Nova unidade</Button>
      </div>

      <Card className="border-border/60"><CardContent className="overflow-x-auto p-0">
        {overview.isLoading ? <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p> : list.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma unidade ainda. Elas aparecem aqui no primeiro login pelo sistema da Alle, ou cadastre em "Nova unidade".</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Unidade</th><th className="p-3">Contas</th><th className="p-3">Último acesso</th><th className="p-3 text-right">Logins 30d</th><th className="p-3 text-right">Viu plano</th><th className="p-3 text-right">Downloads</th><th className="p-3 text-right" title="Posts marcados como postados nas últimas 4 semanas">Postou (4 sem.)</th><th className="p-3">Mídia kit</th><th className="p-3">Link</th><th className="p-3" /></tr>
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
                  <td className="p-3 text-right tabular-nums">{u.due4w ? <span className={cn(u.posted4w === 0 ? "text-amber-600" : u.posted4w >= u.due4w ? "text-emerald-600" : "")}>{u.posted4w}/{u.due4w}</span> : "—"}</td>
                  <td className="p-3">{u.hasMidiaKit ? <span className="text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">{u.signupUrl ? <a href={u.signupUrl} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline" title={u.signupUrl}>✓</a> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing({ id: u.id, code: u.code, name: u.name, city: u.city ?? "", active: u.active, signupUrl: u.signupUrl ?? "" })}>Editar</Button></td>
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
              <label className="block space-y-1 text-sm"><span className="font-medium">Link de adesão</span><Input value={editing.signupUrl} onChange={(e) => setEditing({ ...editing, signupUrl: e.target.value })} placeholder="https://qrcode.allpfit.com.br/r/…" /><span className="text-xs text-muted-foreground">Aparece no portal da academia com o QR code. O QR vem da importação da pasta de QR codes.</span></label>
              <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Unidade ativa (pode acessar)</span><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></label>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button disabled={save.isPending} onClick={() => save.mutate({ ...editing, city: editing.city || undefined, signupUrl: editing.signupUrl.trim() || null })}>{save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar</Button></div>
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

// ── Planejamento das unidades (mensal, enviado semana a semana) ────────────
type Item = { date: string; time?: string | null; format?: string | null; title: string; type?: string | null; caption?: string | null; imageUrls: string[]; storyUrls?: string[] };
type Week = { weekStart: string; weekEnd: string; state: string; releaseAt: string | Date | null; title: string; notes: string; items: Item[] };

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FORMATS = [["carrossel", "Carrossel"], ["imagem", "Imagem"], ["reel", "Reel"], ["stories", "Stories"]] as const;
const FORMAT_CLS: Record<string, string> = { carrossel: "bg-primary/10 text-primary", imagem: "bg-sky-500/10 text-sky-700", reel: "bg-alle-orange/10 text-alle-orange", stories: "bg-emerald-500/10 text-emerald-700" };
const addDaysYmd = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const toLocalInput = (d: string | Date) => { const x = new Date(d); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const STATE: Record<string, { label: string; cls: string }> = {
  vazia: { label: "Sem posts", cls: "bg-muted text-muted-foreground" },
  rascunho: { label: "Rascunho", cls: "bg-muted text-foreground" },
  agendada: { label: "Envio agendado", cls: "bg-amber-500/10 text-amber-700" },
  liberada: { label: "Enviada às unidades", cls: "bg-emerald-500/10 text-emerald-700" },
};

/** Envia um arquivo pelo upload direto (presigned) e devolve a URL pública. */
async function uploadFile(file: File): Promise<string> {
  const pre = await fetch("/api/request-presigned-upload", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ contentType: file.type || "application/octet-stream" }) });
  const { presignedUrl, publicUrl } = (await pre.json()) as { presignedUrl: string | null; publicUrl: string | null };
  if (!pre.ok || !presignedUrl || !publicUrl) throw new Error("Não foi possível preparar o envio.");
  const put = await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!put.ok) throw new Error("O envio do arquivo falhou.");
  return publicUrl;
}

/** Escolher uma arte pronta dos agentes (carrossel, post, stories). */
function CreationPicker({ onPick, onClose }: { onPick: (c: { title: string; images: string[]; caption: string | null; format: string }) => void; onClose: () => void }) {
  const list = trpc.unitAdmin.creations.useQuery({ limit: 30 });
  const LABEL: Record<string, string> = { carrossel: "Carrossel", legendas: "Post", stories: "Stories" };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Usar uma criação dos agentes</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Artes já criadas pelos agentes de Carrossel, Post e Stories. Ao escolher, as artes e a legenda entram no post (dá para editar depois).</p>
        {list.isLoading ? <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p> : !list.data?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma criação com arte ainda. Crie no Estúdio (Carrossel, Post ou Stories) e volte aqui.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.map((c) => (
              <button key={`${c.agent}-${c.id}`} type="button" onClick={() => { onPick(c); onClose(); }} className="overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary">
                <div className="flex gap-0.5 bg-muted">{c.images.slice(0, 3).map((u) => <img key={u} src={u} alt="" loading="lazy" className={cn("min-w-0 flex-1 object-cover", c.format === "stories" ? "aspect-[9/16]" : "aspect-[4/5]")} />)}</div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-semibold">{c.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{LABEL[c.agent] ?? c.agent} · {c.images.length} {c.images.length === 1 ? "arte" : "artes"} · {new Date(c.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Editor de um post das unidades. */
function PostEditor({ week, initial, onSave, onDelete, onClose, saving }: { week: Week; initial: Item; onSave: (it: Item) => void; onDelete?: () => void; onClose: () => void; saving: boolean }) {
  const [it, setIt] = useState<Item>(initial);
  const [busy, setBusy] = useState<"artes" | "stories" | null>(null);
  const [picker, setPicker] = useState(false);
  const set = (patch: Partial<Item>) => setIt((x) => ({ ...x, ...patch }));
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(week.weekStart, i));
  const upload = async (files: File[], target: "artes" | "stories") => {
    if (!files.length) return;
    setBusy(target);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadFile(f));
      if (target === "artes") set({ imageUrls: [...it.imageUrls, ...urls].slice(0, 20) });
      else set({ storyUrls: [...(it.storyUrls ?? []), ...urls].slice(0, 10) });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const move = (i: number, d: number) => { const arr = [...it.imageUrls]; const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; set({ imageUrls: arr }); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>{onDelete ? "Editar post das unidades" : "Novo post das unidades"}</DialogTitle></DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1 text-sm"><span className="font-medium">Dia</span>
                <select value={it.date} onChange={(e) => set({ date: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2">
                  {days.map((d) => <option key={d} value={d}>{WD[new Date(`${d}T12:00:00`).getDay()]} {ddmm(d)}</option>)}
                </select></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Horário</span><Input type="time" value={it.time ?? ""} onChange={(e) => set({ time: e.target.value || null })} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Formato</span>
                <select value={it.format ?? "imagem"} onChange={(e) => set({ format: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2">
                  {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
            </div>
            <label className="block space-y-1 text-sm"><span className="font-medium">Título (o que as unidades veem no card)</span><Input value={it.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Aluno Allp Fit: desconto na conta de luz" /></label>
            <label className="block space-y-1 text-sm"><span className="font-medium">Tipo de pauta (opcional)</span><Input value={it.type ?? ""} onChange={(e) => set({ type: e.target.value || null })} placeholder="Ensino, Oferta, Prova…" /></label>
            <label className="block space-y-1 text-sm"><span className="font-medium">Legenda</span><Textarea rows={10} value={it.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} placeholder="Legenda que a unidade vai copiar, com a ressalva do desconto e @alleenergia @allpfit" /></label>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="flex-1 text-sm font-medium">Artes ({it.imageUrls.length})</p>
                <Button size="sm" variant="outline" onClick={() => setPicker(true)}><Sparkles className="mr-1.5 h-4 w-4" />Usar criação dos agentes</Button>
                <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted", busy === "artes" && "pointer-events-none opacity-60")}>
                  {busy === "artes" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Enviar
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; upload(f, "artes"); }} />
                </label>
              </div>
              {it.imageUrls.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {it.imageUrls.map((u, i) => (
                    <div key={u + i} className="group relative overflow-hidden rounded-lg border bg-muted">
                      <img src={u} alt="" className="aspect-[4/5] w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{i + 1}</span>
                      <div className="absolute inset-x-0 bottom-0 hidden justify-between bg-black/60 p-1 group-hover:flex">
                        <button type="button" title="Mover para trás" onClick={() => move(i, -1)} className="px-1 text-xs text-white">‹</button>
                        <button type="button" title="Tirar" onClick={() => set({ imageUrls: it.imageUrls.filter((_, j) => j !== i) })} className="px-1 text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Mover para frente" onClick={() => move(i, 1)} className="px-1 text-xs text-white">›</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Envie as artes ou use uma criação dos agentes.</p>}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <p className="flex-1 text-sm font-medium">Story do dia (9:16, opcional)</p>
                <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted", busy === "stories" && "pointer-events-none opacity-60")}>
                  {busy === "stories" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Enviar
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; upload(f, "stories"); }} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {(it.storyUrls ?? []).map((u) => (
                  <span key={u} className="relative">
                    <img src={u} alt="" className="h-28 w-16 rounded-md border object-cover" />
                    <button type="button" title="Tirar" onClick={() => set({ storyUrls: (it.storyUrls ?? []).filter((x) => x !== u) })} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive px-1.5 text-[11px] leading-5 text-white">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          {onDelete ? <Button variant="ghost" className="text-destructive" onClick={() => { if (confirm("Tirar este post do planejamento das unidades?")) onDelete(); }}><Trash2 className="mr-1.5 h-4 w-4" />Excluir</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={saving || !it.title.trim() || !it.imageUrls.length} title={!it.imageUrls.length ? "Adicione pelo menos uma arte" : undefined} onClick={() => onSave({ ...it, title: it.title.trim() })}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar post
            </Button>
          </div>
        </div>
        {picker && <CreationPicker onClose={() => setPicker(false)} onPick={(c) => set({ imageUrls: c.images, caption: it.caption?.trim() ? it.caption : c.caption, title: it.title.trim() ? it.title : c.title, format: c.format === "stories" ? "stories" : c.images.length > 1 ? "carrossel" : "imagem" })} />}
      </DialogContent>
    </Dialog>
  );
}

function WeekCard({ week, onEdit, onNew, onSaveMeta, onRelease, busy }: {
  week: Week; onEdit: (i: number) => void; onNew: (date: string) => void; onSaveMeta: (patch: { title?: string; notes?: string }) => void;
  onRelease: (mode: "agendar" | "agora" | "rascunho", releaseAt?: string) => void; busy: boolean;
}) {
  const today = new Date().toLocaleDateString("en-CA");
  const [release, setRelease] = useState(toLocalInput(week.releaseAt ?? `${week.weekStart}T00:00:00-03:00`));
  const [title, setTitle] = useState(week.title);
  const [notes, setNotes] = useState(week.notes);
  const st = STATE[week.state] ?? STATE.vazia;
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(week.weekStart, i));
  return (
    <Card className="border-border/60"><CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Semana de {ddmm(week.weekStart)} a {ddmm(week.weekEnd)}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span>
        <span className="text-xs text-muted-foreground">{week.items.length} {week.items.length === 1 ? "post" : "posts"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {week.state === "liberada" ? (
            <>
              <span className="text-xs text-muted-foreground">Enviada {week.releaseAt ? `em ${fmtDateTime(week.releaseAt)}` : ""}</span>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (confirm("Tirar esta semana do portal das unidades (volta para rascunho)?")) onRelease("rascunho"); }}>Recolher</Button>
            </>
          ) : (
            <>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Enviar em
                <Input type="datetime-local" value={release} onChange={(e) => setRelease(e.target.value)} className="h-8 w-[190px] text-xs" /></label>
              {week.state === "agendada" && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRelease("rascunho")}>Cancelar envio</Button>}
              <Button size="sm" variant="outline" disabled={busy || !week.items.length} onClick={() => onRelease("agendar", new Date(release).toISOString())}><Clock3 className="mr-1.5 h-4 w-4" />{week.state === "agendada" ? "Reagendar" : "Agendar envio"}</Button>
              <Button size="sm" disabled={busy || !week.items.length} onClick={() => { if (confirm(`Enviar agora a semana de ${ddmm(week.weekStart)} para todas as unidades?`)) onRelease("agora"); }}><Send className="mr-1.5 h-4 w-4" />Enviar agora</Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== week.title && onSaveMeta({ title })} placeholder="Título da semana (opcional, ex.: Semana da Black Friday)" className="h-8 text-sm" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== week.notes && onSaveMeta({ notes })} placeholder="Recado para as unidades (opcional)" className="h-8 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => {
          const posts = week.items.map((it, i) => ({ it, i })).filter(({ it }) => it.date === d);
          const dd = new Date(`${d}T12:00:00`);
          return (
            <div key={d} className={cn("flex min-h-[170px] flex-col gap-1.5 rounded-xl border bg-muted/20 p-2", d === today && "border-primary ring-1 ring-primary/30")}>
              <p className={cn("text-[11px] font-semibold uppercase", d === today ? "text-primary" : "text-muted-foreground")}>{WD[dd.getDay()]} {ddmm(d)}</p>
              {posts.map(({ it, i }) => (
                <button key={i} type="button" onClick={() => onEdit(i)} className="overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary">
                  {it.imageUrls[0] && <img src={it.imageUrls[0]} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />}
                  <div className="p-1.5">
                    <p className="flex items-center gap-1 text-[10px]">{it.time && <span className="font-semibold">{it.time}</span>}{it.format && <span className={cn("rounded px-1", FORMAT_CLS[it.format] ?? "bg-muted")}>{FORMATS.find(([v]) => v === it.format)?.[1] ?? it.format}</span>}{it.storyUrls?.length ? <span className="text-muted-foreground">+story</span> : null}</p>
                    <p className="line-clamp-2 text-[11px] font-medium leading-tight">{it.title}</p>
                  </div>
                </button>
              ))}
              <button type="button" onClick={() => onNew(d)} className="mt-auto flex items-center justify-center gap-1 rounded-lg border border-dashed py-1.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"><Plus className="h-3 w-3" />Post</button>
            </div>
          );
        })}
      </div>
    </CardContent></Card>
  );
}

function PlanTab() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const q = trpc.unitAdmin.monthPlans.useQuery({ month });
  const utils = trpc.useUtils();
  const save = trpc.unitAdmin.savePlan.useMutation({ onError: (e) => toast.error(e.message) });
  const [editing, setEditing] = useState<{ week: Week; index: number | null; item: Item } | null>(null);
  const [y, m] = month.split("-").map(Number);
  const shift = (d: number) => { const x = new Date(y, m - 1 + d, 1); setMonth(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); };

  /** Salva a semana mantendo o estado de envio (rascunho, agendada, enviada). */
  const persist = async (week: Week, patch: Partial<Pick<Week, "items" | "title" | "notes">>, release?: { mode: "agendar" | "agora" | "rascunho"; at?: string }) => {
    const items = [...(patch.items ?? week.items)].sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
    const published = release ? release.mode !== "rascunho" : week.state === "agendada" || week.state === "liberada";
    const releaseAt = release?.mode === "agora" ? new Date().toISOString() : release?.mode === "agendar" ? release.at : week.releaseAt ? new Date(week.releaseAt).toISOString() : null;
    await save.mutateAsync({ weekStart: week.weekStart, title: patch.title ?? week.title, notes: patch.notes ?? week.notes, items, publish: published, releaseAt: published ? releaseAt : null });
    await utils.unitAdmin.monthPlans.invalidate();
    utils.unitAdmin.overview.invalidate();
  };

  const weeks = (q.data ?? []) as Week[];
  const total = weeks.reduce((s, w) => s + w.items.filter((it) => it.date.startsWith(month)).length, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => shift(-1)}>‹</Button>
        <span className="min-w-[150px] text-center text-lg font-bold">{MONTHS[m - 1]} {y}</span>
        <Button variant="outline" size="sm" onClick={() => shift(1)}>›</Button>
        <span className="text-sm text-muted-foreground">{total} {total === 1 ? "post" : "posts"} no mês</span>
      </div>
      <p className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
        Este é o calendário <b>das academias</b>, separado do planejamento da Alle. Monte o mês, crie as artes (envie ou use uma criação dos agentes) e cada semana vai para o portal das unidades na data de envio. Padrão: segunda-feira 00h da própria semana.
      </p>
      {q.isLoading ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</p> : weeks.map((w) => (
        <WeekCard key={`${w.weekStart}-${w.state}-${String(w.releaseAt)}`} week={w} busy={save.isPending}
          onNew={(date) => setEditing({ week: w, index: null, item: { date, time: "12:00", format: "imagem", title: "", caption: "", imageUrls: [], storyUrls: [] } })}
          onEdit={(i) => setEditing({ week: w, index: i, item: w.items[i] })}
          onSaveMeta={(patch) => persist(w, patch).then(() => toast.success("Semana atualizada."))}
          onRelease={(mode, at) => persist(w, {}, { mode, at }).then(() => toast.success(mode === "agora" ? "Semana enviada para as unidades!" : mode === "agendar" ? "Envio agendado." : "Semana voltou para rascunho."))} />
      ))}
      {editing && (
        <PostEditor week={editing.week} initial={editing.item} saving={save.isPending} onClose={() => setEditing(null)}
          onSave={async (it) => {
            const items = editing.index === null ? [...editing.week.items, it] : editing.week.items.map((x, j) => (j === editing.index ? it : x));
            await persist(editing.week, { items });
            toast.success(editing.week.state === "liberada" ? "Post salvo (a semana já está no portal: a mudança aparece na hora)." : "Post salvo.");
            setEditing(null);
          }}
          onDelete={editing.index === null ? undefined : async () => { await persist(editing.week, { items: editing.week.items.filter((_, j) => j !== editing.index) }); setEditing(null); }} />
      )}
    </div>
  );
}

// ── Mural de avisos ────────────────────────────────────────────────────────
function AnnouncementsTab() {
  const list = trpc.unitAdmin.announcements.useQuery();
  const utils = trpc.useUtils();
  const empty = { title: "", body: "", pinned: false, expiresAt: "" };
  const [form, setForm] = useState<{ id?: number; title: string; body: string; pinned: boolean; expiresAt: string }>(empty);
  const save = trpc.unitAdmin.saveAnnouncement.useMutation({
    onSuccess: () => { toast.success(form.id ? "Aviso atualizado." : "Aviso publicado para todas as unidades."); setForm(empty); utils.unitAdmin.announcements.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.unitAdmin.deleteAnnouncement.useMutation({ onSuccess: () => utils.unitAdmin.announcements.invalidate() });
  const now = new Date();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="border-border/60"><CardContent className="space-y-3 p-4">
        <p className="font-semibold">{form.id ? "Editar aviso" : "Novo aviso"}</p>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Quarta é dia de collab: fixem o post" />
        <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Detalhes (opcional)" />
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm"><span className="font-medium">Some depois de</span><Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /><span className="text-xs text-muted-foreground">vazio = fica até apagar</span></label>
          <label className="flex items-center justify-between gap-2 self-start rounded-lg border p-3 text-sm"><span>Fixar no topo</span><Switch checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} /></label>
        </div>
        <div className="flex justify-end gap-2">
          {form.id && <Button variant="outline" onClick={() => setForm(empty)}>Cancelar</Button>}
          <Button disabled={save.isPending || form.title.trim().length < 2} onClick={() => save.mutate({ id: form.id, title: form.title, body: form.body || undefined, pinned: form.pinned, expiresAt: form.expiresAt || null })}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{form.id ? "Salvar" : "Publicar aviso"}
          </Button>
        </div>
      </CardContent></Card>
      <Card className="border-border/60"><CardContent className="p-0">
        {!list.data?.length ? <p className="p-6 text-sm text-muted-foreground">Nenhum aviso ainda. Os avisos aparecem no topo do portal de todas as unidades.</p> : list.data.map((a) => {
          const expired = a.expiresAt && new Date(a.expiresAt) < now;
          return (
            <div key={a.id} className={cn("flex items-start gap-3 border-b p-3 text-sm last:border-0", expired && "opacity-50")}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.pinned && <span className="mr-1.5 rounded-full bg-alle-orange/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-alle-orange">fixado</span>}{a.title}</p>
                {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(a.createdAt)}{a.expiresAt ? ` · ${expired ? "venceu" : "some"} em ${new Date(a.expiresAt).toLocaleDateString("pt-BR")}` : ""}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setForm({ id: a.id, title: a.title, body: a.body ?? "", pinned: a.pinned, expiresAt: a.expiresAt ? new Date(a.expiresAt).toLocaleDateString("en-CA") : "" })}>Editar</Button>
              <button type="button" title="Apagar" className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { if (confirm(`Apagar o aviso "${a.title}"?`)) del.mutate({ id: a.id }); }}><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </CardContent></Card>
    </div>
  );
}

// ── Suporte ────────────────────────────────────────────────────────────────
const SUPPORT_STATUS: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aguardando resposta", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  respondido: { label: "Respondido", cls: "bg-primary/10 text-primary" },
  resolvido: { label: "Resolvido", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
};

function SupportTab({ initial }: { initial: number | null }) {
  const [filter, setFilter] = useState<"todos" | "aberto" | "respondido" | "resolvido">("todos");
  const list = trpc.unitSupportAdmin.list.useQuery({ status: filter }, { refetchInterval: 30_000 });
  const [selected, setSelected] = useState<number | null>(initial);
  const current = selected ?? list.data?.[0]?.id ?? null;
  const utils = trpc.useUtils();
  const thread = trpc.unitSupportAdmin.get.useQuery({ id: current ?? 0 }, { enabled: current !== null, refetchInterval: 20_000 });
  const [text, setText] = useState("");
  const reply = trpc.unitSupportAdmin.reply.useMutation({
    onSuccess: (_r, v) => { toast.success(v.resolve ? "Respondido e resolvido. A unidade recebe um e-mail." : "Resposta enviada. A unidade recebe um e-mail."); setText(""); utils.unitSupportAdmin.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const setStatus = trpc.unitSupportAdmin.setStatus.useMutation({ onSuccess: () => utils.unitSupportAdmin.invalidate() });
  useEffect(() => { if (thread.data) utils.unitSupportAdmin.unread.invalidate(); }, [thread.data, utils]);
  const t = thread.data?.ticket;
  return (
    <div className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="border-b lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap gap-1 border-b p-2">
          {(["todos", "aberto", "respondido", "resolvido"] as const).map((f) => (
            <button key={f} type="button" onClick={() => { setFilter(f); setSelected(null); }} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              {f === "todos" ? "Todos" : SUPPORT_STATUS[f].label}
            </button>
          ))}
        </div>
        {list.isLoading ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> : !list.data?.length ? <p className="p-4 text-sm text-muted-foreground">Nenhum chamado{filter !== "todos" ? " neste filtro" : " ainda"}.</p> : (
          <ul className="max-h-[640px] overflow-y-auto">
            {list.data.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setSelected(r.id)} className={cn("flex w-full flex-col gap-1 border-b px-4 py-3 text-left hover:bg-muted/50", current === r.id && "bg-primary/5")}>
                  <span className="flex items-center gap-2">
                    {r.unreadByTeam && <span className="h-2 w-2 shrink-0 rounded-full bg-alle-orange" title="Mensagem nova" />}
                    <span className={cn("min-w-0 flex-1 truncate text-sm", r.unreadByTeam ? "font-bold" : "font-medium")}>{r.subject}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{r.unitName} · {r.openedBy}</span>
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className={cn("rounded-full px-1.5 py-0.5 font-medium", SUPPORT_STATUS[r.status]?.cls)}>{SUPPORT_STATUS[r.status]?.label ?? r.status}</span>{fmtDateTime(r.lastMessageAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <div className="flex min-h-[560px] min-w-0 flex-col">
        {!t ? <p className="p-6 text-sm text-muted-foreground">{current === null ? "Selecione um chamado." : "Carregando…"}</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.subject}</p>
                <p className="text-xs text-muted-foreground">#{t.id} · {t.unitName} · {t.categoryLabel} · {t.openedBy}{t.openedByRole ? ` (${t.openedByRole})` : ""}{t.openedByEmail ? ` · ${t.openedByEmail}` : ""}</p>
              </div>
              <select value={t.status} onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value as "aberto" | "respondido" | "resolvido" })} className="h-8 rounded-md border bg-background px-2 text-xs">
                {Object.entries(SUPPORT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
              {thread.data!.messages.map((m) => (
                <div key={m.id} className={cn("flex", m.fromTeam ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm", m.fromTeam ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-card")}>
                    <p className={cn("mb-0.5 text-[11px] font-semibold", m.fromTeam ? "text-primary-foreground/80" : "text-primary")}>{m.author}</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    <p className={cn("mt-1 text-right text-[10px]", m.fromTeam ? "text-primary-foreground/70" : "text-muted-foreground")}>{fmtDateTime(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t p-3">
              <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Responder à unidade…" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={reply.isPending || text.trim().length < 2} onClick={() => reply.mutate({ id: t.id, body: text, resolve: true })}>Responder e resolver</Button>
                <Button disabled={reply.isPending || text.trim().length < 2} onClick={() => reply.mutate({ id: t.id, body: text })}>{reply.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Responder</Button>
              </div>
            </div>
          </>
        )}
      </div>
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
  const [kind, setKind] = useState<"material" | "midia_kit" | "treinamento">("material");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const unitName = useMemo(() => new Map((overview.data?.units ?? []).map((u) => [u.id, u.name])), [overview.data]);

  const upload = async (file?: File) => {
    if (!file) return;
    const unitId = target === "geral" ? null : Number(target);
    if (kind === "midia_kit" && unitId === null) return toast.error("O mídia kit é de uma unidade: escolha a unidade.");
    if (kind === "treinamento" && unitId !== null) return toast.error("Treinamento vale para todas as unidades.");
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
          <select value={target} onChange={(e) => { setTarget(e.target.value); setKind("material"); }} className="h-9 w-full rounded-md border bg-background px-2">
            <option value="geral">Todas as unidades (biblioteca geral)</option>
            {(overview.data?.units ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Tipo</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "material" | "midia_kit" | "treinamento")} className="h-9 w-full rounded-md border bg-background px-2">
            <option value="material">Material</option>
            {target === "geral" ? <option value="treinamento">Treinamento da equipe</option> : <option value="midia_kit">Mídia kit</option>}
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
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{m.title}</p><p className="truncate text-xs text-muted-foreground">{m.unitId ? `${unitName.get(m.unitId) ?? "Unidade"} · ${m.kind === "midia_kit" ? "Mídia kit" : "Material"}` : `Todas as unidades · ${m.kind === "treinamento" ? "Treinamento" : "Material"}`} · {m.fileName}</p></div>
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
  const supportFromLink = (() => { const n = Number(new URLSearchParams(window.location.search).get("suporte")); return Number.isInteger(n) && n > 0 ? n : null; })();
  const [tab, setTab] = useState<"geral" | "atividade" | "plano" | "avisos" | "suporte" | "materiais">(supportFromLink ? "suporte" : "geral");
  const supportUnread = trpc.unitSupportAdmin.unread.useQuery(undefined, { enabled: user?.role === "admin", refetchInterval: 60_000 }).data ?? 0;
  const [open, setOpen] = useState<number | null>(null);
  if (user && user.role !== "admin") return <AppLayout activeModule="units"><p className="p-8 text-sm text-muted-foreground">Apenas administradores.</p></AppLayout>;
  const tabs = [["geral", "Visão geral", Building2], ["atividade", "Atividade", Activity], ["plano", "Planejamento das unidades", CalendarDays], ["avisos", "Avisos", Megaphone], ["suporte", "Suporte", LifeBuoy], ["materiais", "Materiais e mídia kits", Download]] as const;
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
                {id === "suporte" && supportUnread > 0 && <span className="rounded-full bg-alle-orange px-1.5 text-[11px] font-bold text-white">{supportUnread}</span>}
              </button>
            ))}
          </nav>
          {tab === "geral" && <Overview onOpen={setOpen} />}
          {tab === "atividade" && <ActivityTab />}
          {tab === "plano" && <PlanTab />}
          {tab === "avisos" && <AnnouncementsTab />}
          {tab === "suporte" && <SupportTab initial={supportFromLink} />}
          {tab === "materiais" && <MaterialsTab />}
          {open !== null && <UnitDetail unitId={open} onClose={() => setOpen(null)} />}
        </div>
      </main>
    </AppLayout>
  );
}
