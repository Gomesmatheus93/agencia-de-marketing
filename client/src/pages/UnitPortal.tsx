import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { CalendarDays, Check, Copy, Download, FileText, FolderOpen, Image as ImageIcon, Loader2, LogOut, Maximize2, Megaphone, Menu, Moon, Sun, X, ZoomIn, ZoomOut, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [viewing, setViewing] = useState<number | null>(null);
  if (!item) return null;
  const d = new Date(`${item.date}T12:00:00`);
  // Arte ampliada: o visualizador ocupa o lugar da janela (fechar volta para ela).
  if (viewing !== null) return (
    <ImageViewer
      items={item.imageUrls.map((url, j) => ({ id: j, url, title: `Arte ${j + 1} de ${item.imageUrls.length}`, label: item.title }))}
      index={viewing} onIndex={setViewing} onClose={() => setViewing(null)}
      onDownload={(j) => { track.mutate({ weekStart, itemIndex: index, what: "arte" }); saveFile(item.imageUrls[j], `${item.date}-${j + 1}.png`); }} />);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[96vw] overflow-y-auto p-6 sm:max-w-6xl lg:p-8">
        <DialogHeader>
          <DialogTitle className="pr-6 text-xl leading-snug">{item.title}</DialogTitle>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {WEEKDAYS[d.getDay()]}, {ddmm(item.date)}{item.time ? ` · ${item.time}` : ""}
            {item.format && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", FORMAT_STYLE[item.format] ?? "bg-muted")}>{FORMAT_LABEL[item.format] ?? item.format}</span>}
            {item.type && <span className="text-xs text-primary">{item.type}</span>}
          </p>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {item.imageUrls.map((url, j) => (
                <button key={url} type="button" title="Abrir e ampliar" className="group relative cursor-zoom-in overflow-hidden rounded-lg border bg-muted"
                  onClick={() => setViewing(j)}>
                  <img src={url} alt={`Arte ${j + 1}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                  <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex"><Maximize2 className="h-5 w-5" /></span>
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
            <p className="max-h-[62vh] min-h-48 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-[15px] leading-relaxed">{item.caption || "—"}</p>
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
        <div className="flex snap-x justify-center-safe gap-3 overflow-x-auto pb-2">
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

/** Visualizador de imagens: zoom (botões, rolagem, duplo clique, pinça), arrastar e setas. */
function ImageViewer({ items, index, onIndex, onClose, onDownload }: {
  items: Array<{ id: number; url: string; title: string; label?: string | null }>;
  index: number; onIndex: (i: number) => void; onClose: () => void; onDownload: (id: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const item = items[index];
  const clamp = (z: number) => Math.min(6, Math.max(1, z));
  const setZ = (z: number) => { const n = clamp(z); setZoom(n); if (n === 1) setPos({ x: 0, y: 0 }); };
  const go = (d: number) => { const n = index + d; if (n >= 0 && n < items.length) { onIndex(n); setZoom(1); setPos({ x: 0, y: 0 }); } };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setZ(zoom + 0.5);
      else if (e.key === "-") setZ(zoom - 0.5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 text-white" role="dialog" aria-modal="true">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          {item.label && <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-white/60">{item.label}</p>}
          <p className="truncate text-sm font-medium">{item.title}</p>
        </div>
        <span className="hidden text-xs text-white/60 sm:block">{index + 1} / {items.length}</span>
        <button type="button" title="Diminuir" onClick={() => setZ(zoom - 0.5)} disabled={zoom <= 1} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"><ZoomOut className="h-5 w-5" /></button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" title="Ampliar" onClick={() => setZ(zoom + 0.5)} disabled={zoom >= 6} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-30"><ZoomIn className="h-5 w-5" /></button>
        <button type="button" title="Abrir em nova aba" onClick={() => window.open(item.url, "_blank", "noopener")} className="rounded-lg p-2 hover:bg-white/10"><ExternalLink className="h-5 w-5" /></button>
        <Button size="sm" variant="secondary" onClick={() => onDownload(item.id)}><Download className="mr-1.5 h-4 w-4" />Baixar</Button>
        <button type="button" title="Fechar (Esc)" onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <div
        className={cn("relative flex-1 touch-none select-none overflow-hidden", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
        onClick={(e) => { if (e.target === e.currentTarget && zoom === 1) onClose(); }}
        onDoubleClick={() => setZ(zoom > 1 ? 1 : 2.5)}
        onWheel={(e) => setZ(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
        onPointerDown={(e) => { if (zoom > 1) { drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } }}
        onPointerMove={(e) => { if (drag.current) setPos({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }}
        onTouchStart={(e) => { if (e.touches.length === 2) { drag.current = null; pinch.current = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: zoom }; } }}
        onTouchMove={(e) => { if (pinch.current && e.touches.length === 2) setZ(pinch.current.z * Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) / pinch.current.d); }}
        onTouchEnd={() => { pinch.current = null; }}
      >
        <img src={item.url} alt={item.title} draggable={false}
          className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain p-4 transition-transform duration-75"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }} />
        {index > 0 && (
          <button type="button" title="Anterior" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/70"><ChevronLeft className="h-6 w-6" /></button>
        )}
        {index < items.length - 1 && (
          <button type="button" title="Próxima" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/70"><ChevronRight className="h-6 w-6" /></button>
        )}
      </div>
      <p className="pb-3 text-center text-[11px] text-white/50">Rolagem, duplo clique ou pinça para ampliar · arraste para mover · Esc para fechar</p>
    </div>
  );
}

function MaterialsTab() {
  const materials = trpc.unitPortal.materials.useQuery();
  const download = trpc.unitPortal.download.useMutation({ onError: (e) => toast.error(e.message) });
  // O zip é montado no servidor e baixa direto (o navegador mostra o progresso).
  const downloadAll = () => { window.location.href = "/api/unidade/midia-kit.zip"; };
  const get = async (materialId: number) => { const r = await download.mutateAsync({ materialId }); saveFile(r.url, r.fileName); };
  const openDoc = async (materialId: number) => {
    // Abre a aba já no clique (o navegador bloqueia janelas abertas depois de um await).
    const w = window.open("", "_blank");
    try {
      const r = await download.mutateAsync({ materialId, mode: "abrir" });
      if (w) w.location.href = r.url; else window.open(r.url, "_blank", "noopener");
    } catch { w?.close(); }
  };
  const [viewing, setViewing] = useState<number | null>(null);
  const logView = trpc.unitPortal.download.useMutation();
  if (materials.isLoading) return <p className="flex items-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando os materiais…</p>;
  const { general = [], mine = [] } = materials.data ?? {};
  const images = mine.filter((m) => m.thumbUrl);
  const docs = mine.filter((m) => !m.thumbUrl);
  const Card = ({ m }: { m: (typeof general)[number] }) => (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {m.contentType.startsWith("image/") ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{m.title}</p>
        <p className="truncate text-xs text-muted-foreground">{m.description || m.fileName} · {fmtSize(m.sizeBytes)}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={() => openDoc(m.id)}><ExternalLink className="mr-1.5 h-4 w-4" />Abrir</Button>
      <Button size="sm" variant="outline" disabled={download.isPending} onClick={() => get(m.id)}>
        <Download className="mr-1.5 h-4 w-4" />Baixar
      </Button>
    </div>
  );
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Megaphone className="h-5 w-5 text-primary" />Mídia kit da sua unidade</h2>
          {mine.length > 1 && (
            <Button size="sm" onClick={downloadAll}>
              <Download className="mr-1.5 h-4 w-4" />Baixar o kit completo (.zip)
            </Button>
          )}
        </div>
        {mine.length ? (
          <>
            {images.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" />Imagens ({images.length})</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {images.map((m) => (
                    <div key={m.id} className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-primary">
                      <button type="button" title="Abrir e ampliar" onClick={() => { setViewing(images.indexOf(m)); logView.mutate({ materialId: m.id, mode: "abrir" }); }}
                        className="relative flex aspect-[4/5] cursor-zoom-in items-center justify-center bg-muted">
                        {m.thumbUrl && <img src={m.thumbUrl} alt="" loading="lazy" className="h-full w-full object-contain p-1" />}
                        <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex"><Maximize2 className="h-6 w-6" /></span>
                      </button>
                      <div className="flex min-w-0 items-center gap-1 p-2">
                        <div className="min-w-0 flex-1">
                          {m.description && <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-primary">{m.description.split(" › ").pop()}</p>}
                          <p className="truncate text-xs font-medium">{m.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{m.fileName.split(".").pop()?.toUpperCase()} · {fmtSize(m.sizeBytes)}</p>
                        </div>
                        <button type="button" title="Baixar" disabled={download.isPending} onClick={() => get(m.id)} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Download className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {docs.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FileText className="h-3.5 w-3.5" />Arquivos ({docs.length})</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {docs.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary">
                      <button type="button" title="Abrir" onClick={() => openDoc(m.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium hover:text-primary">{m.title}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{m.fileName.split(".").pop()?.toUpperCase()} · {fmtSize(m.sizeBytes)}</span>
                        </span>
                      </button>
                      <button type="button" title="Abrir" onClick={() => openDoc(m.id)} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><ExternalLink className="h-4 w-4" /></button>
                      <button type="button" title="Baixar" disabled={download.isPending} onClick={() => get(m.id)} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"><Download className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : <p className="text-sm text-muted-foreground">O mídia kit da sua unidade ainda não foi disponibilizado.</p>}
      </section>
      {viewing !== null && (
        <ImageViewer
          items={images.map((m) => ({ id: m.id, url: m.thumbUrl!, title: m.title, label: m.description?.split(" › ").pop() }))}
          index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} onDownload={get} />
      )}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><FolderOpen className="h-5 w-5 text-primary" />Materiais da Alle</h2>
        {general.length ? <div className="grid gap-2 md:grid-cols-2">{general.map((m) => <Card key={m.id} m={m} />)}</div>
          : <p className="text-sm text-muted-foreground">Nenhum material disponível ainda.</p>}
      </section>
    </div>
  );
}

const NAV = [
  { id: "plano", path: "/unidade", label: "Planejamento da semana", icon: CalendarDays },
  { id: "materiais", path: "/unidade/materiais", label: "Materiais e mídia kit", icon: FolderOpen },
] as const;

export default function UnitPortal() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const [location, navigate] = useLocation();
  const me = trpc.unitPortal.me.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const select = trpc.unitPortal.selectUnit.useMutation({
    onSuccess: () => utils.unitPortal.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const myUnits = me.data?.units ?? [];
  const tab = location.startsWith("/unidade/materiais") ? "materiais" : "plano";
  const active = NAV.find((n) => n.id === tab)!;
  useEffect(() => { if (!loading && !isAuthenticated) navigate("/login"); }, [loading, isAuthenticated, navigate]);
  if (loading || !isAuthenticated) return null;

  const isDark = theme === "dark";
  const avatarUrl = (user as { avatarUrl?: string | null } | null)?.avatarUrl ?? undefined;
  const initials = (user?.name ?? "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const unitName = me.data?.unit?.name ?? "Portal da unidade";
  const subtitle = [me.data?.groupName, myUnits.length > 1 ? `${myUnits.length} academias` : null].filter(Boolean).join(" · ");

  const ThemeSwitch = () => (
    <button type="button" role="switch" aria-checked={isDark} aria-label={isDark ? "Tema claro" : "Tema escuro"}
      onClick={() => switchable && toggleTheme?.()} disabled={!switchable || !toggleTheme}
      className={cn("relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50", isDark ? "bg-primary" : "bg-muted")}>
      <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition", isDark ? "translate-x-5" : "translate-x-0")} />
    </button>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-7 pb-6 pt-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-md">
            <img src="/logo.png" alt="Alle Energia" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold tracking-tight text-foreground">Alle Energia</div>
            <div className="truncate text-[11px] text-muted-foreground">Portal das academias</div>
          </div>
        </div>
      </div>

      {/* Academia aberta (quem tem mais de uma troca aqui) */}
      <div className="px-5 pb-4">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Academia</p>
          {myUnits.length > 1 ? (
            <select value={me.data?.unit?.id ?? ""} disabled={select.isPending} aria-label="Academia"
              onChange={(e) => select.mutate({ unitId: Number(e.target.value) })}
              className="mt-1 w-full truncate rounded-lg border bg-background px-2 py-1.5 text-sm font-semibold">
              {myUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          ) : (
            <p className="mt-0.5 truncate text-sm font-semibold">{unitName}</p>
          )}
          {subtitle && <p className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-5 pb-4">
        <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Módulos</div>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === tab;
          return (
            <button key={item.id} type="button" onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className={cn("group flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-[15px] font-medium transition-all duration-200",
                isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground")}>
              <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="flex-1 truncate text-left">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border/40 px-5 py-4">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted/70">
            {isDark ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{isDark ? "Tema claro" : "Tema escuro"}</div>
          <ThemeSwitch />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-accent/50">
              <Avatar className="h-8 w-8 flex-shrink-0">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
                <AvatarFallback className="gradient-primary text-xs font-semibold text-white">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium">{user?.name || "Usuário"}</div>
                <div className="truncate text-[11px] text-muted-foreground">{user?.email || ""}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-card w-52 border-border/50">
            <DropdownMenuItem onClick={() => logout()} className="gap-2 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="gradient-bg relative flex min-h-screen overflow-hidden">
      <aside className="glass-sidebar fixed bottom-0 left-0 top-0 z-30 hidden w-72 flex-col lg:flex">{sidebar}</aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={cn("glass-sidebar fixed bottom-0 left-0 top-0 z-50 w-72 transition-transform duration-300 ease-out lg:hidden", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="absolute right-4 top-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="h-8 w-8 rounded-lg"><X className="h-4 w-4" /></Button>
        </div>
        {sidebar}
      </aside>

      <main className="relative z-10 flex min-h-screen min-w-0 flex-1 flex-col lg:ml-72">
        {/* Celular */}
        <header className="glass sticky top-0 z-20 flex items-center justify-between border-b border-border/30 px-4 py-3 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-9 w-9 rounded-xl"><Menu className="h-5 w-5" /></Button>
          <span className="truncate px-2 text-sm font-bold tracking-tight">{unitName}</span>
          <ThemeSwitch />
        </header>
        {/* Computador */}
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 bg-background/85 px-8 py-5 backdrop-blur lg:flex">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight">{active.label}</h2>
            <p className="text-xs capitalize text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div className="flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4">
            <Avatar className="h-10 w-10">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
              <AvatarFallback className="gradient-primary text-sm font-semibold text-white">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-left leading-tight">
              <span className="block text-sm font-semibold">{user?.name || "Usuário"}</span>
              <span className="block text-[11px] text-muted-foreground">{unitName}</span>
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto px-4 py-6 lg:px-8">
          {tab === "plano" ? <PlanTab /> : <MaterialsTab />}
        </div>
      </main>
    </div>
  );
}
