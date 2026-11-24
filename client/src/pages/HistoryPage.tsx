import AppLayout from "@/components/AppLayout";
import { ArtViewer } from "@/components/agents/ArtViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Clapperboard, Download, GalleryHorizontal, History, Image as ImageIcon, Layers, Loader2, Megaphone, Pencil, Play, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

// Histórico: todas as artes criadas na plataforma, num só lugar.

type Kind = "todos" | "carrossel" | "post" | "stories" | "video";
const KINDS: Array<{ id: Kind; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "todos", label: "Tudo", icon: Layers },
  { id: "carrossel", label: "Carrosséis", icon: GalleryHorizontal },
  { id: "post", label: "Posts", icon: ImageIcon },
  { id: "stories", label: "Stories", icon: Layers },
  { id: "video", label: "Vídeos motion", icon: Clapperboard },
];
const KIND_LABEL: Record<string, string> = { carrossel: "Carrossel", post: "Post", stories: "Stories", video: "Vídeo" };
const ASPECT: Record<string, string> = { story_9x16: "aspect-[9/16]", feed_1x1: "aspect-square", landscape_16x9: "aspect-video", feed_4x5: "aspect-[4/5]" };
const PAGE = 48;

/** Últimos 12 meses para o filtro. */
function lastMonths() {
  const out: Array<{ id: string; label: string }> = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ id: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, label: m.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
  }
  return out;
}

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const [kind, setKind] = useState<Kind>("todos");
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pages, setPages] = useState(1);
  const [viewing, setViewing] = useState<number | null>(null);
  const [playing, setPlaying] = useState<{ id: number; title: string; videoUrl: string; posterUrl: string | null } | null>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPages(1), [kind, month, debounced]);

  const counts = trpc.history.counts.useQuery();
  const list = trpc.history.list.useQuery({ kind, month: month || undefined, search: debounced || undefined, limit: PAGE * pages, offset: 0 }, { placeholderData: (prev) => prev });
  const entries = list.data?.entries ?? [];
  const months = useMemo(lastMonths, []);
  const total = counts.data ? counts.data.carrossel + counts.data.post + counts.data.stories + counts.data.video : null;

  // Agrupa por dia de criação.
  const groups = useMemo(() => {
    const m = new Map<string, typeof entries>();
    for (const e of entries) {
      const k = new Date(e.createdAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [entries]);

  return (
    <AppLayout activeModule="historico">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <header>
            <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary"><History className="mr-1.5 h-3 w-3" />Histórico</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Todas as artes criadas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Carrosséis, posts, stories e vídeos motion feitos na plataforma{total !== null ? ` (${total} no total)` : ""}, da mais nova para a mais antiga. Clique para ver, editar ou baixar.
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            {KINDS.map(({ id, label, icon: Icon }) => {
              const n = id === "todos" ? total : counts.data?.[id as Exclude<Kind, "todos">];
              return (
                <button key={id} onClick={() => setKind(id)}
                  className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition", kind === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}>
                  <Icon className="h-4 w-4" />{label}{n != null && <span className={cn("text-xs", kind === id ? "text-primary-foreground/80" : "text-muted-foreground")}>{n}</span>}
                </button>
              );
            })}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm capitalize">
                <option value="">Qualquer mês</option>
                {months.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <label className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pelo título" className="w-56 pl-8" />
              </label>
              {(month || search || kind !== "todos") && <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setKind("todos"); setMonth(""); setSearch(""); }}><X className="h-3.5 w-3.5" />limpar</Button>}
            </div>
          </div>

          {list.isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {!list.isLoading && !entries.length && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground"><History className="mx-auto mb-3 h-8 w-8 text-primary/60" />Nenhuma arte com esses filtros.</div>
          )}

          {groups.map(([day, items]) => (
            <section key={day} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day} <span className="font-normal normal-case">· {items.length}</span></h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {items.map((e) => (
                  <button key={e.key} type="button"
                    onClick={() => (e.motionId && e.videoUrl ? setPlaying({ id: e.motionId, title: e.title, videoUrl: e.videoUrl, posterUrl: e.posterUrl }) : e.threadId && setViewing(e.threadId))}
                    className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary/50 hover:shadow-md">
                    <span className={cn("relative block overflow-hidden bg-muted", e.kind === "video" ? (ASPECT[e.format ?? ""] ?? "aspect-[9/16]") : e.kind === "stories" ? "aspect-[9/16]" : "aspect-[4/5]")}>
                      {e.images[0] ? <img src={e.images[0]} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" /> : null}
                      {e.kind === "video" && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55"><Play className="h-5 w-5 fill-white text-white" /></span></span>}
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">{KIND_LABEL[e.kind]}</span>
                      {e.total > 1 && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">{e.total} artes</span>}
                      {e.fromCta && <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-alle-orange px-2 py-0.5 text-[10px] font-medium text-white"><Megaphone className="h-3 w-3" />CTA</span>}
                    </span>
                    <span className="flex flex-1 flex-col gap-0.5 p-2.5">
                      <span className="line-clamp-2 text-xs font-semibold leading-snug">{e.title}</span>
                      <span className="mt-auto text-[11px] text-muted-foreground">{new Date(e.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{+new Date(e.updatedAt) - +new Date(e.createdAt) > 60_000 ? " · editada" : ""}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          {list.data?.hasMore && (
            <div className="flex justify-center"><Button variant="outline" disabled={list.isFetching} onClick={() => setPages((p) => p + 1)}>{list.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Carregar mais</Button></div>
          )}
        </div>
      </main>

      {viewing !== null && <ArtViewer threadId={viewing} onClose={() => setViewing(null)} onSaved={() => void list.refetch()} />}
      <Dialog open={playing !== null} onOpenChange={(o) => { if (!o) setPlaying(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">{playing?.title}</DialogTitle></DialogHeader>
          {playing && <video src={playing.videoUrl} poster={playing.posterUrl ?? undefined} controls autoPlay playsInline className="max-h-[70vh] w-full rounded-lg bg-black" />}
          {playing && (
            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" asChild><a href={playing.videoUrl} target="_blank" rel="noopener noreferrer" download><Download className="h-4 w-4" />Baixar MP4</a></Button>
              <Button size="sm" className="gap-1.5" onClick={() => navigate(`/dashboard/motion/${playing.id}`)}><Pencil className="h-4 w-4" />Editar vídeo</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
