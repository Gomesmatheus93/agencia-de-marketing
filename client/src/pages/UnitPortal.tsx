import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, Copy, Download, FileText, FolderOpen, Image as ImageIcon, Loader2, LogOut, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Portal da unidade (academia parceira): planejamento semanal e materiais, só para ver e baixar.

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const FORMAT_LABEL: Record<string, string> = { carrossel: "Carrossel", imagem: "Imagem", reel: "Reel", stories: "Stories" };
const FORMAT_STYLE: Record<string, string> = {
  carrossel: "bg-primary/10 text-primary", imagem: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  reel: "bg-alle-orange/10 text-alle-orange", stories: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};
const ddmm = (ymd: string) => `${ymd.slice(8)}/${ymd.slice(5, 7)}`;
const fmtSize = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Baixa o arquivo direto (sem abrir aba); se o navegador bloquear, abre numa aba nova. */
async function saveFile(url: string, fileName: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error();
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

type PlanItem = { date: string; time?: string | null; format?: string | null; title: string; type?: string | null; caption?: string | null; imageUrls: string[] };

/** Detalhe de uma pauta: artes para baixar e legenda para copiar. */
function ItemDialog({ item, index, weekStart, onClose }: { item: PlanItem | null; index: number; weekStart: string; onClose: () => void }) {
  const track = trpc.unitPortal.trackPlanDownload.useMutation();
  const [copied, setCopied] = useState(false);
  if (!item) return null;
  const d = new Date(`${item.date}T12:00:00`);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{item.title}</DialogTitle>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {WEEKDAYS[d.getDay()]}, {ddmm(item.date)}{item.time ? ` · ${item.time}` : ""}
            {item.format && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", FORMAT_STYLE[item.format] ?? "bg-muted")}>{FORMAT_LABEL[item.format] ?? item.format}</span>}
            {item.type && <span className="text-xs text-primary">{item.type}</span>}
          </p>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="grid grid-cols-3 gap-2">
              {item.imageUrls.map((url, j) => (
                <button key={url} type="button" title="Baixar esta arte" className="group relative overflow-hidden rounded-lg border bg-muted"
                  onClick={() => { track.mutate({ weekStart, itemIndex: index, what: "arte" }); saveFile(url, `${item.date}-${j + 1}.png`); }}>
                  <img src={url} alt={`Arte ${j + 1}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex"><Download className="h-5 w-5" /></span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2 w-full"
              onClick={async () => { track.mutate({ weekStart, itemIndex: index, what: "arte" }); for (const [j, url] of item.imageUrls.entries()) await saveFile(url, `${item.date}-${j + 1}.png`); }}>
              <Download className="mr-1.5 h-4 w-4" />{item.imageUrls.length > 1 ? `Baixar as ${item.imageUrls.length} artes` : "Baixar a arte"}
            </Button>
          </div>
          <div className="flex min-w-0 flex-col">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legenda</p>
            <p className="max-h-80 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{item.caption || "—"}</p>
            {item.caption && (
              <Button variant="outline" size="sm" className="mt-2"
                onClick={() => navigator.clipboard.writeText(item.caption!).then(() => { setCopied(true); track.mutate({ weekStart, itemIndex: index, what: "legenda" }); setTimeout(() => setCopied(false), 2000); })}>
                {copied ? <><Check className="mr-1.5 h-4 w-4" />Copiada!</> : <><Copy className="mr-1.5 h-4 w-4" />Copiar legenda</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanTab() {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const plan = trpc.unitPortal.weekPlan.useQuery(week ? { weekStart: week } : undefined);
  const [open, setOpen] = useState<number | null>(null);
  const data = plan.data;
  const today = new Date().toLocaleDateString("en-CA");

  if (plan.isLoading) return <p className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando o planejamento…</p>;
  if (!data?.plan) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center">
        <CalendarDays className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">O planejamento desta semana ainda não foi publicado.</p>
        <p className="text-sm text-muted-foreground">Assim que a equipe da Alle publicar, ele aparece aqui.</p>
      </div>
    );
  }
  const p = data.plan;
  const items = p.items as PlanItem[];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {p.title || "Planejamento da semana"} ({ddmm(p.weekStart)} a {ddmm(p.weekEnd)})
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{items.length}</span> {items.length === 1 ? "post pronto" : "posts prontos"}</p>
          {data.weeks.length > 1 && (
            <select value={data.weekStart} onChange={(e) => setWeek(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs">
              {data.weeks.map((w) => <option key={w.weekStart} value={w.weekStart}>Semana de {ddmm(w.weekStart)}</option>)}
            </select>
          )}
        </div>
      </div>
      {p.notes && <p className="rounded-xl bg-primary/5 p-4 text-sm">{p.notes}</p>}

      <div className="rounded-2xl border bg-card p-3">
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {items.map((it, i) => {
            const d = new Date(`${it.date}T12:00:00`);
            const isToday = it.date === today;
            return (
              <div key={i} className={cn("flex w-48 shrink-0 snap-start flex-col rounded-2xl border bg-card p-2.5", isToday && "border-primary ring-2 ring-primary/20")}>
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className={cn("font-semibold", isToday ? "text-primary" : "text-muted-foreground")}>{isToday ? "Hoje" : `${WEEKDAYS_SHORT[d.getDay()]} ${ddmm(it.date)}`}{it.time ? ` · ${it.time}` : ""}</span>
                  {it.format && <span className={cn("rounded-full px-1.5 py-0.5 font-medium", FORMAT_STYLE[it.format] ?? "bg-muted")}>{FORMAT_LABEL[it.format] ?? it.format}</span>}
                </div>
                <p title={it.title} className="mt-1.5 line-clamp-4 min-h-[3.75rem] text-xs font-semibold leading-tight">{it.title}</p>
                <p className="min-h-[1rem] text-[11px] text-primary">{it.type ?? ""}</p>
                <button type="button" onClick={() => setOpen(i)} className="group relative mt-2 block aspect-[4/5] overflow-hidden rounded-xl border bg-muted" title="Abrir">
                  {it.imageUrls[0] && <img src={it.imageUrls[0]} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />}
                  {it.imageUrls.length > 1 && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">{it.imageUrls.length} artes</span>}
                </button>
                <button type="button" onClick={() => setOpen(i)} className="mt-2 text-left text-[11px] text-emerald-600 hover:underline dark:text-emerald-400">✓ pronto · baixar</button>
              </div>
            );
          })}
        </div>
      </div>
      <ItemDialog key={open ?? -1} item={open === null ? null : items[open]} index={open ?? 0} weekStart={p.weekStart} onClose={() => setOpen(null)} />
    </div>
  );
}

function MaterialsTab() {
  const materials = trpc.unitPortal.materials.useQuery();
  const download = trpc.unitPortal.download.useMutation({ onError: (e) => toast.error(e.message) });
  if (materials.isLoading) return <p className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando os materiais…</p>;
  const { general = [], mine = [] } = materials.data ?? {};
  const Card = ({ m }: { m: (typeof general)[number] }) => (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {m.contentType.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.title}</p>
        <p className="truncate text-xs text-muted-foreground">{m.description || m.fileName} · {fmtSize(m.sizeBytes)}</p>
      </div>
      <Button size="sm" variant="outline" disabled={download.isPending}
        onClick={async () => { const r = await download.mutateAsync({ materialId: m.id }); saveFile(r.url, r.fileName); }}>
        <Download className="mr-1.5 h-4 w-4" />Baixar
      </Button>
    </div>
  );
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Megaphone className="h-5 w-5 text-primary" />Mídia kit da sua unidade</h2>
        {mine.length ? <div className="grid gap-2 md:grid-cols-2">{mine.map((m) => <Card key={m.id} m={m} />)}</div>
          : <p className="text-sm text-muted-foreground">O mídia kit da sua unidade ainda não foi disponibilizado.</p>}
      </section>
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><FolderOpen className="h-5 w-5 text-primary" />Materiais da Alle</h2>
        {general.length ? <div className="grid gap-2 md:grid-cols-2">{general.map((m) => <Card key={m.id} m={m} />)}</div>
          : <p className="text-sm text-muted-foreground">Nenhum material disponível ainda.</p>}
      </section>
    </div>
  );
}

export default function UnitPortal() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const me = trpc.unitPortal.me.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const select = trpc.unitPortal.selectUnit.useMutation({
    onSuccess: () => utils.unitPortal.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const myUnits = me.data?.units ?? [];
  const [tab, setTab] = useState<"plano" | "materiais">("plano");
  useEffect(() => { if (!loading && !isAuthenticated) navigate("/login"); }, [loading, isAuthenticated, navigate]);
  if (loading || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src="/app/logo.png" alt="Alle Energia" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            {myUnits.length > 1 ? (
              <select value={me.data?.unit?.id ?? ""} disabled={select.isPending} aria-label="Academia"
                onChange={(e) => select.mutate({ unitId: Number(e.target.value) })}
                className="max-w-full truncate rounded-md border bg-background px-2 py-1 font-bold">
                {myUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            ) : (
              <p className="truncate font-bold leading-tight">{me.data?.unit?.name ?? "Portal da unidade"}</p>
            )}
            <p className="truncate text-xs text-muted-foreground">
              Alle Energia · {user?.name}{me.data?.groupName ? ` · ${me.data.groupName}` : ""}{myUnits.length > 1 ? ` · ${myUnits.length} academias` : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()}><LogOut className="mr-1.5 h-4 w-4" />Sair</Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {([["plano", "Planejamento da semana", CalendarDays], ["materiais", "Materiais e mídia kit", FolderOpen]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition", tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {tab === "plano" ? <PlanTab /> : <MaterialsTab />}
      </main>
    </div>
  );
}
