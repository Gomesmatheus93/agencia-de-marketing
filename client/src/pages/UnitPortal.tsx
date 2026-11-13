import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, Copy, Download, FileText, FolderOpen, Image as ImageIcon, Loader2, LogOut, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Portal da unidade (academia parceira): planejamento semanal e materiais, só para ver e baixar.

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const FORMAT_LABEL: Record<string, string> = { carrossel: "Carrossel", imagem: "Post", reel: "Reel", stories: "Stories" };
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

function PlanTab() {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const plan = trpc.unitPortal.weekPlan.useQuery(week ? { weekStart: week } : undefined);
  const track = trpc.unitPortal.trackPlanDownload.useMutation();
  const [copied, setCopied] = useState<number | null>(null);
  const data = plan.data;

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
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{p.title || "Planejamento da semana"}</h2>
          <p className="text-sm text-muted-foreground">Semana de {ddmm(p.weekStart)} a {ddmm(p.weekEnd)} · {p.items.length} {p.items.length === 1 ? "post" : "posts"}</p>
        </div>
        {data.weeks.length > 1 && (
          <select value={data.weekStart} onChange={(e) => setWeek(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
            {data.weeks.map((w) => <option key={w.weekStart} value={w.weekStart}>Semana de {ddmm(w.weekStart)}</option>)}
          </select>
        )}
      </div>
      {p.notes && <p className="rounded-xl bg-primary/5 p-4 text-sm">{p.notes}</p>}

      {p.items.map((it, i) => {
        const d = new Date(`${it.date}T12:00:00`);
        return (
          <article key={i} className="overflow-hidden rounded-2xl border bg-card">
            <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
              <span className="font-semibold">{WEEKDAYS[d.getDay()]}, {ddmm(it.date)}{it.time ? ` · ${it.time}` : ""}</span>
              {it.format && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{FORMAT_LABEL[it.format] ?? it.format}</span>}
              <span className="w-full text-sm text-muted-foreground md:w-auto md:flex-1 md:text-right">{it.title}</span>
            </header>
            <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <div className="grid grid-cols-3 gap-2">
                  {it.imageUrls.map((url, j) => (
                    <button key={url} type="button" title="Baixar esta arte" className="group relative overflow-hidden rounded-lg border bg-muted"
                      onClick={() => { track.mutate({ weekStart: p.weekStart, itemIndex: i, what: "arte" }); saveFile(url, `${it.date}-${j + 1}.png`); }}>
                      <img src={url} alt={`Arte ${j + 1}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                      <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex"><Download className="h-5 w-5" /></span>
                    </button>
                  ))}
                </div>
                {it.imageUrls.length > 1 && (
                  <Button variant="outline" size="sm" className="mt-2 w-full"
                    onClick={async () => { track.mutate({ weekStart: p.weekStart, itemIndex: i, what: "arte" }); for (const [j, url] of it.imageUrls.entries()) await saveFile(url, `${it.date}-${j + 1}.png`); }}>
                    <Download className="mr-1.5 h-4 w-4" />Baixar as {it.imageUrls.length} artes
                  </Button>
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legenda</p>
                <p className="max-h-72 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{it.caption || "—"}</p>
                {it.caption && (
                  <Button variant="outline" size="sm" className="mt-2"
                    onClick={() => navigator.clipboard.writeText(it.caption!).then(() => { setCopied(i); track.mutate({ weekStart: p.weekStart, itemIndex: i, what: "legenda" }); setTimeout(() => setCopied(null), 2000); })}>
                    {copied === i ? <><Check className="mr-1.5 h-4 w-4" />Copiada!</> : <><Copy className="mr-1.5 h-4 w-4" />Copiar legenda</>}
                  </Button>
                )}
              </div>
            </div>
          </article>
        );
      })}
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
  const [tab, setTab] = useState<"plano" | "materiais">("plano");
  useEffect(() => { if (!loading && !isAuthenticated) navigate("/login"); }, [loading, isAuthenticated, navigate]);
  if (loading || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src="/app/logo.png" alt="Alle Energia" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold leading-tight">{me.data?.unit?.name ?? "Portal da unidade"}</p>
            <p className="truncate text-xs text-muted-foreground">Alle Energia · {user?.name}</p>
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
