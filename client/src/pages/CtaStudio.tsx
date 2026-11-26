import AppLayout from "@/components/AppLayout";
import { TaskError, TaskHistory, TaskProgress, useAgentTask } from "@/components/agents/AgentTask";
import { ArtViewer } from "@/components/agents/ArtViewer";
import { ModelPicker } from "@/components/agents/ModelPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useViewerAccess } from "@/_core/hooks/useLimitedAccess";
import { cn } from "@/lib/utils";
import {
  Bot, Check, CircleDot, Copy, Download, ImageIcon, LayoutGrid, Layers, Library, List, Loader2, Megaphone, Paintbrush, Pencil, Plus, Search, Sparkles, Star, Trash2, Wand2, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Aba CTAs: banco de frases + Agente de CTAs + criação de artes a partir de uma frase.

type Section = "banco" | "gerar" | "arte";
type Suggestion = { text: string; category: string; angle: string; why: string };
type CtaRunResult = { suggestions: Suggestion[]; assumptions: string[] };

const SOURCE_LABEL: Record<string, string> = { manual: "cadastrada", ia: "agente", equipe: "equipe" };
const FORMATS = [
  { id: "feed_4x5", label: "Feed 4:5" },
  { id: "feed_1x1", label: "Feed 1:1" },
  { id: "story_9x16", label: "Story 9:16" },
] as const;
type Format = (typeof FORMATS)[number]["id"];
const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success("Copiado");
}

export default function CtaStudio() {
  const [section, setSection] = useState<Section>("banco");
  // Visualizador (ex.: Flávio): só o banco, sem cadastrar, editar, gerar ou criar arte.
  const isViewer = useViewerAccess();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const refreshBank = () => { void utils.ctas.list.invalidate(); void utils.ctas.facets.invalidate(); };

  const goCreateArt = (id: number) => { setSelectedId(id); setSection("arte"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const SECTIONS: Array<{ id: Section; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "banco", label: "Banco de CTAs", desc: "Cadastre, organize e encontre frases", icon: Library },
    { id: "gerar", label: "Gerar com IA", desc: "O Agente de CTAs sugere frases novas", icon: Wand2 },
    { id: "arte", label: "Criar arte", desc: "Transforme uma frase em post", icon: Paintbrush },
  ];

  return (
    <AppLayout activeModule="ctas">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <header>
            <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary"><Megaphone className="mr-1.5 h-3 w-3" />Central de CTAs</Badge>
            <h1 className="text-3xl font-bold tracking-tight">CTAs</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Guarde as chamadas para ação da Alle e da parceria com a Allp Fit, peça frases novas ao Agente de CTAs e transforme qualquer frase em arte, sem sair daqui.
            </p>
          </header>

          {!isViewer && <nav className="grid gap-2 sm:grid-cols-3" role="tablist">
            {SECTIONS.map(({ id, label, desc, icon: Icon }, i) => (
              <button
                key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)}
                className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                  section === id ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:border-primary/40")}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", section === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{i + 1}. {label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{desc}</span>
                </span>
              </button>
            ))}
          </nav>}

          {section === "banco" && <BankSection onCreateArt={goCreateArt} onChanged={refreshBank} onGoGenerate={() => setSection("gerar")} />}
          {section === "gerar" && !isViewer && <GenerateSection onSaved={refreshBank} onCreateArt={goCreateArt} />}
          {section === "arte" && !isViewer && <ArtSection selectedId={selectedId} onSelect={setSelectedId} onGoGenerate={() => setSection("gerar")} />}
        </div>
      </main>
    </AppLayout>
  );
}

// ─── 1. Banco de CTAs ─────────────────────────────────────────────────────────

type ArtPreview = { threadId: number; imageUrl: string | null; status: string; format: string };
type CtaRow = { id: number; text: string; category: string; angle: string | null; notes: string | null; source: string; favorite: boolean; arts: number; artPreviews: ArtPreview[]; uses: number; lastUsedAt: string | null; usedIn: string[]; createdAt: string | Date };
type Usage = "" | "nao-usadas" | "usadas";
const ddmm = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
/** Nunca usadas primeiro; depois as usadas há mais tempo. */
const byPriority = (a: CtaRow, b: CtaRow) =>
  Number(a.uses > 0) - Number(b.uses > 0) || Number(b.favorite) - Number(a.favorite) || (a.lastUsedAt ?? "").localeCompare(b.lastUsedAt ?? "") || +new Date(b.createdAt) - +new Date(a.createdAt);

/** Status de uso de uma frase no conteúdo (pautas, artes das pautas e posts). */
function UsageBadge({ c }: { c: Pick<CtaRow, "uses" | "lastUsedAt" | "usedIn"> }) {
  return c.uses > 0
    ? <span title={c.usedIn.join("\n")} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Check className="h-3 w-3" />usada {c.uses}×{c.lastUsedAt ? ` · ${ddmm(c.lastUsedAt)}` : ""}</span>
    : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"><CircleDot className="h-3 w-3" />nunca usada</span>;
}

function BankSection({ onCreateArt, onChanged, onGoGenerate }: { onCreateArt: (id: number) => void; onChanged: () => void; onGoGenerate: () => void }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [angle, setAngle] = useState("");
  const [source, setSource] = useState<"" | "manual" | "ia" | "equipe">("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [usage, setUsage] = useState<Usage>("");
  const readOnly = useViewerAccess();
  const [view, setView] = useState<"lista" | "cartoes">("lista");
  const [editing, setEditing] = useState<CtaRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<CtaRow | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 250); return () => clearTimeout(t); }, [search]);

  const facets = trpc.ctas.facets.useQuery();
  const list = trpc.ctas.list.useQuery({
    search: debounced || undefined, category: category || undefined, angle: angle || undefined, source: source || undefined, favorite: onlyFav || undefined, usage: usage || undefined,
  });
  const all = trpc.ctas.list.useQuery();
  const unusedTotal = (all.data ?? []).filter((c) => !c.uses).length;
  const update = trpc.ctas.update.useMutation({ onSuccess: onChanged, onError: (e) => toast.error(e.message) });
  const remove = trpc.ctas.remove.useMutation({
    onSuccess: () => { toast.success("CTA excluído"); setDeleting(null); onChanged(); },
    onError: (e) => toast.error(e.message),
  });
  const rows = useMemo(() => [...((list.data ?? []) as CtaRow[])].sort(byPriority), [list.data]);
  const filtering = Boolean(debounced || category || angle || source || onlyFav || usage);

  // Agrupa por categoria para a leitura ficar organizada.
  const groups = useMemo(() => {
    const m = new Map<string, CtaRow[]>();
    for (const r of rows) m.set(r.category, [...(m.get(r.category) ?? []), r]);
    return [...m.entries()];
  }, [rows]);

  return (
    <section className="space-y-4">
      {!readOnly && <QuickAdd categories={facets.data?.categories ?? []} onSaved={onChanged} onMore={() => setEditing("new")} />}
      <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[1fr_180px_180px_150px_auto_auto] 2xl:items-center">
        <label className="relative sm:col-span-2 lg:col-span-3 2xl:col-span-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar frase, categoria, ângulo ou observação" className="pl-8" />
        </label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={select} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {facets.data?.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={angle} onChange={(e) => setAngle(e.target.value)} className={select} aria-label="Ângulo">
          <option value="">Todos os ângulos</option>
          {facets.data?.angles.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={select} aria-label="Origem">
          <option value="">Qualquer origem</option><option value="equipe">Da equipe</option><option value="ia">Do agente</option><option value="manual">Cadastradas</option>
        </select>
        <Button variant={onlyFav ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setOnlyFav((v) => !v)}>
          <Star className={cn("h-4 w-4", onlyFav && "fill-current")} />Favoritas
        </Button>
        {!readOnly && <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />Novo CTA</Button>}
      </CardContent></Card>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {([["", "Todas"], ["nao-usadas", `Nunca usadas${all.data ? ` (${unusedTotal})` : ""}`], ["usadas", "Já usadas"]] as Array<[Usage, string]>).map(([id, label]) => (
          <button key={id || "todas"} onClick={() => setUsage(id)} className={cn("rounded-full border px-3 py-1 transition", usage === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}>{label}</button>
        ))}
        <span className="text-muted-foreground">{list.isLoading ? "Carregando…" : `${rows.length} CTA${rows.length === 1 ? "" : "s"}${filtering ? " no filtro" : " no banco"}`}</span>
        {filtering && <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => { setSearch(""); setCategory(""); setAngle(""); setSource(""); setOnlyFav(false); setUsage(""); }}><X className="h-3.5 w-3.5" />limpar filtros</button>}
        <div className="ml-auto flex rounded-lg border p-0.5">
          <button onClick={() => setView("lista")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs", view === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><List className="h-3.5 w-3.5" />Lista</button>
          <button onClick={() => setView("cartoes")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs", view === "cartoes" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><LayoutGrid className="h-3.5 w-3.5" />Cartões com artes</button>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">"Usada" conta quando a frase aparece numa pauta do planejamento, numa arte de pauta ou num post programado/publicado. Os agentes de criação usam primeiro as nunca usadas.</p>

      {view === "lista" && rows.length > 0 && (
        <Card className="overflow-hidden py-0"><ul className="divide-y">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{c.text}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <UsageBadge c={c} />
                  <span>{c.category}{c.angle ? ` · ${c.angle}` : ""}</span>
                  {c.arts > 0 && <button className="text-primary hover:underline" onClick={() => c.artPreviews[0] && setViewing(c.artPreviews[0].threadId)}>{c.arts} arte{c.arts > 1 ? "s" : ""}</button>}
                  {c.uses > 0 && c.usedIn[0] && <span className="hidden md:inline">· {c.usedIn[0]}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {readOnly ? (c.favorite && <Star className="mx-1.5 h-4 w-4 fill-amber-500 text-amber-500" aria-label="Favorita" />) : (
                <button type="button" title={c.favorite ? "Tirar dos favoritos" : "Marcar como favorito"} onClick={() => update.mutate({ id: c.id, favorite: !c.favorite })}
                  className={cn("rounded p-1.5 transition", c.favorite ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500")}><Star className={cn("h-4 w-4", c.favorite && "fill-current")} /></button>)}
                {readOnly && c.artPreviews[0] && <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setViewing(c.artPreviews[0].threadId)}><ImageIcon className="h-3.5 w-3.5" />Ver arte</Button>}
                {!readOnly && <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onCreateArt(c.id)}><Paintbrush className="h-3.5 w-3.5" />Criar arte</Button>}
                <Button size="sm" variant="ghost" className="h-8 px-2" title="Copiar" onClick={() => copy(c.text)}><Copy className="h-3.5 w-3.5" /></Button>
                {!readOnly && <Button size="sm" variant="ghost" className="h-8 px-2" title="Editar" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>}
                {!readOnly && <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-red-600" title="Excluir" onClick={() => setDeleting(c)}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            </li>
          ))}
        </ul></Card>
      )}

      {!list.isLoading && !rows.length && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-3 h-8 w-8 text-primary/60" />
          {filtering ? "Nenhum CTA nesse filtro." : "O banco ainda está vazio."}
          {!readOnly && <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing("new")}><Plus className="mr-1.5 h-4 w-4" />Cadastrar</Button>
            <Button size="sm" onClick={onGoGenerate}><Wand2 className="mr-1.5 h-4 w-4" />Gerar com IA</Button>
          </div>}
        </div>
      )}

      {view === "cartoes" && groups.map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat} <span className="font-normal">· {items.length}</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <Card key={c.id} className="group flex flex-col gap-0 overflow-hidden py-0">
                {c.artPreviews.length > 0 && <CtaArtStrip arts={c.artPreviews} total={c.arts} onOpen={setViewing} />}
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[15px] font-semibold leading-snug">{c.text}</p>
                    <button
                      type="button" title={c.favorite ? "Tirar dos favoritos" : "Marcar como favorito"} disabled={readOnly}
                      onClick={() => !readOnly && update.mutate({ id: c.id, favorite: !c.favorite })}
                      className={cn("rounded p-1 transition", c.favorite ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500")}
                    >
                      <Star className={cn("h-4 w-4", c.favorite && "fill-current")} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <UsageBadge c={c} />
                    {c.angle && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{c.angle}</span>}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{SOURCE_LABEL[c.source] ?? c.source}</span>
                    {c.arts > 0 && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">{c.arts} arte{c.arts > 1 ? "s" : ""}</span>}
                    <span className="text-muted-foreground">{c.text.length} caracteres</span>
                  </div>
                  {c.notes && <p className="text-xs leading-relaxed text-muted-foreground">{c.notes}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    {!readOnly && <Button size="sm" className="h-8 gap-1.5" onClick={() => onCreateArt(c.id)}><Paintbrush className="h-3.5 w-3.5" />Criar arte</Button>}
                    <Button size="sm" variant="ghost" className="h-8 px-2" title="Copiar" onClick={() => copy(c.text)}><Copy className="h-3.5 w-3.5" /></Button>
                    {!readOnly && <Button size="sm" variant="ghost" className="h-8 px-2" title="Editar" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {!readOnly && <Button size="sm" variant="ghost" className="ml-auto h-8 px-2 text-muted-foreground hover:text-red-600" title="Excluir" onClick={() => setDeleting(c)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {viewing !== null && <ArtViewer threadId={viewing} onClose={() => setViewing(null)} onSaved={onChanged} />}
      {editing && !readOnly && <CtaEditor cta={editing === "new" ? null : editing} categories={facets.data?.categories ?? []} angles={facets.data?.angles ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}

      <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Excluir CTA?</DialogTitle></DialogHeader>
          <p className="text-sm">“{deleting?.text}”</p>
          {!!deleting?.arts && <p className="text-xs text-muted-foreground">As {deleting.arts} arte(s) feitas com ela continuam na galeria.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate({ id: deleting.id })}>
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Cadastro rápido no topo do banco: a frase, a categoria e pronto. */
function QuickAdd({ categories, onSaved, onMore }: { categories: string[]; onSaved: () => void; onMore: () => void }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const cats = [...new Set([...categories, "Parceria Allp Fit", "Alle Energia"])];
  const create = trpc.ctas.create.useMutation({
    onSuccess: () => { toast.success("CTA cadastrado"); setText(""); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const cat = category || cats[0] || "Parceria Allp Fit";
  const ok = text.trim().length >= 3;
  return (
    <Card><CardContent className="space-y-2 p-4">
      <p className="text-sm font-semibold">Colocar uma CTA nova</p>
      <form className="grid gap-2 sm:grid-cols-[1fr_200px_auto_auto]" onSubmit={(e) => { e.preventDefault(); if (ok) create.mutate({ text: text.trim(), category: cat }); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Escreva a frase. Ex.: Treino pesado, conta leve." />
        <select value={cat} onChange={(e) => setCategory(e.target.value)} className={select} aria-label="Categoria">
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Button type="submit" disabled={!ok || create.isPending} className="gap-1.5">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Adicionar</Button>
        <Button type="button" variant="ghost" onClick={onMore}>Mais detalhes</Button>
      </form>
      {text.length > 90 && <p className="text-xs text-amber-600">{text.length} caracteres: longa para a arte.</p>}
    </CardContent></Card>
  );
}

/** Artes do CTA no topo do cartão: a mais recente grande e as outras em miniatura. */
function CtaArtStrip({ arts, total, onOpen }: { arts: ArtPreview[]; total: number; onOpen: (threadId: number) => void }) {
  const [main, ...rest] = arts;
  const thumb = (a: ArtPreview, cls: string) => (
    <button key={a.threadId} type="button" onClick={() => onOpen(a.threadId)} title="Ver e editar a arte" className={cn("relative overflow-hidden bg-muted", cls)}>
      {a.imageUrl ? <img src={a.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        : <span className="flex h-full items-center justify-center p-2 text-center text-[11px] text-muted-foreground">{a.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : a.status === "failed" ? "falhou" : "sem arte"}</span>}
    </button>
  );
  return (
    <div className="flex gap-1 border-b bg-muted/40">
      {thumb(main, cn("flex-1", main.format === "story_9x16" ? "aspect-[9/16]" : main.format === "feed_1x1" ? "aspect-square" : "aspect-[4/5]"))}
      {rest.length > 0 && (
        <div className="flex w-1/4 flex-col gap-1">
          {rest.map((a) => thumb(a, "aspect-[4/5] w-full rounded"))}
          {total > arts.length && <span className="text-center text-[11px] text-muted-foreground">+{total - arts.length}</span>}
        </div>
      )}
    </div>
  );
}

function CtaEditor({ cta, categories, angles, onClose, onSaved }: {
  cta: CtaRow | null; categories: string[]; angles: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [text, setText] = useState(cta?.text ?? "");
  const [category, setCategory] = useState(cta?.category ?? categories[0] ?? "Parceria Allp Fit");
  const [angle, setAngle] = useState(cta?.angle ?? "");
  const [notes, setNotes] = useState(cta?.notes ?? "");
  const [favorite, setFavorite] = useState(cta?.favorite ?? false);
  const opts = { onSuccess: () => { toast.success(cta ? "CTA atualizado" : "CTA cadastrado"); onSaved(); }, onError: (e: { message: string }) => toast.error(e.message) };
  const create = trpc.ctas.create.useMutation(opts);
  const update = trpc.ctas.update.useMutation(opts);
  const saving = create.isPending || update.isPending;
  const save = () => {
    const data = { text, category, angle: angle || null, notes: notes || null, favorite };
    if (cta) update.mutate({ id: cta.id, ...data }); else create.mutate(data);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{cta ? "Editar CTA" : "Novo CTA"}</DialogTitle></DialogHeader>
        <label className="block space-y-1 text-xs font-medium">Frase
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Ex.: Treino pesado, conta leve." />
          <span className={cn("block text-right font-normal", text.length > 90 ? "text-amber-600" : "text-muted-foreground")}>{text.length} caracteres{text.length > 90 ? " · longa para a arte" : ""}</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium">Categoria
            <Input list="cta-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Parceria Allp Fit" />
            <datalist id="cta-categories">{[...new Set([...categories, "Parceria Allp Fit", "Alle Energia"])].map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="space-y-1 text-xs font-medium">Ângulo (opcional)
            <Input list="cta-angles" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="economia, pertencimento…" />
            <datalist id="cta-angles">{angles.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
        </div>
        <label className="block space-y-1 text-xs font-medium">Observações (opcional)
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Onde usar, com qual arte, cuidados…" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />Favorito da equipe</label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || text.trim().length < 3 || category.trim().length < 2}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 2. Gerar com IA ──────────────────────────────────────────────────────────

function GenerateSection({ onSaved, onCreateArt }: { onSaved: () => void; onCreateArt: (id: number) => void }) {
  const t = useAgentTask<CtaRunResult>("ctas");
  const facets = trpc.ctas.facets.useQuery();
  const bank = trpc.ctas.list.useQuery();
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState<"parceria" | "alle" | "ambos">("parceria");
  const [count, setCount] = useState(10);
  const [angle, setAngle] = useState("");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  useEffect(() => { setPicked(new Set()); setDrafts({}); }, [t.threadId]);

  const inBank = useMemo(() => new Map((bank.data ?? []).map((c) => [c.text.trim().toLowerCase(), c.id])), [bank.data]);
  const suggestions = t.result?.suggestions ?? [];
  const textOf = (i: number) => (drafts[i] ?? suggestions[i]?.text ?? "").trim();

  const add = trpc.ctas.addSuggestions.useMutation({ onError: (e) => toast.error(e.message) });
  const save = (indexes: number[], then?: (ids: number[]) => void) => {
    if (!t.threadId) return;
    const items = indexes.map((i) => ({ text: textOf(i), category: suggestions[i].category, angle: suggestions[i].angle, notes: suggestions[i].why || null }));
    add.mutate({ threadId: t.threadId, items }, {
      onSuccess: (r) => {
        toast.success(r.skipped ? `${r.added} salva(s) · ${r.skipped} já estava(m) no banco` : `${r.added} CTA(s) salvo(s) no banco`);
        setPicked(new Set());
        onSaved();
        void bank.refetch().then((b) => then?.(indexes.map((i) => b.data?.find((c) => c.text.trim().toLowerCase() === textOf(i).toLowerCase())?.id).filter((x): x is number => !!x)));
      },
    });
  };
  const toggle = (i: number) => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <section className="space-y-4">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4 text-primary" />Agente de CTAs</p>
            <p className="text-xs text-muted-foreground">Lê a estratégia da equipe (estrategia.md), a voz da marca e o banco atual, e sugere frases que não repetem as que já existem.</p>
          </div>
          <TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} />
        </div>
        <Textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Objetivo ou comando. Ex.: CTAs para o story da recepção levando o aluno a escanear o QR; tom leve, com jogo de palavras de treino" />
        <div className="grid gap-3 md:grid-cols-[200px_110px_1fr_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Público</span>
            <select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className={select}>
              <option value="parceria">Alunos Allp Fit (parceria)</option><option value="alle">Público geral da Alle</option><option value="ambos">Os dois</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Quantas</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={select}>{[5, 8, 10, 12, 15, 20].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Ângulo (opcional)</span>
            <Input list="gen-angles" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="o agente varia" />
            <datalist id="gen-angles">{facets.data?.angles.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Categoria (opcional)</span>
            <Input list="gen-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="o agente escolhe" />
            <datalist id="gen-categories">{facets.data?.categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <Button className="gap-2" disabled={t.running || t.starting || goal.trim().length < 3}
            onClick={() => t.start({ goal, audience, count, angle: angle || undefined, category: category || undefined })}>
            {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Gerar CTAs
          </Button>
        </div>
      </CardContent></Card>

      {t.running && <TaskProgress agentName="Agente de CTAs" activity={t.activity} startedAt={t.thread?.createdAt} />}
      {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
      {!t.thread && !t.running && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <Wand2 className="mx-auto mb-3 h-8 w-8 text-primary/60" />Escreva o objetivo e clique em Gerar CTAs. As sugestões aparecem aqui para você escolher.
        </div>
      )}

      {!t.running && suggestions.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{suggestions.length} sugestões{t.thread?.title ? ` · ${t.thread.title.replace(/^CTAs: /, "")}` : ""} · edite o texto antes de salvar, se quiser</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPicked(new Set(suggestions.map((_, i) => i).filter((i) => !inBank.has(textOf(i).toLowerCase()))))}>Selecionar todas</Button>
              <Button size="sm" className="gap-1.5" disabled={!picked.size || add.isPending} onClick={() => save([...picked])}>
                {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Library className="h-4 w-4" />}Salvar selecionadas ({picked.size})
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map((s, i) => {
              const savedId = inBank.get(textOf(i).toLowerCase());
              return (
                <Card key={i} className={cn(picked.has(i) && "ring-2 ring-primary")}>
                  <CardContent className="space-y-2.5 p-4">
                    <div className="flex items-start gap-2.5">
                      <input type="checkbox" className="mt-2" checked={picked.has(i)} disabled={!!savedId} onChange={() => toggle(i)} aria-label="Selecionar sugestão" />
                      <Textarea rows={2} value={drafts[i] ?? s.text} onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))} disabled={!!savedId}
                        className="min-h-0 resize-none border-transparent bg-transparent p-1 text-[15px] font-semibold leading-snug shadow-none focus-visible:border-input" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-6 text-[11px]">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{s.angle}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{s.category}</span>
                      <span className={cn(textOf(i).length > 90 ? "text-amber-600" : "text-muted-foreground")}>{textOf(i).length} caracteres</span>
                    </div>
                    {s.why && <p className="pl-6 text-xs text-muted-foreground">{s.why}</p>}
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {savedId ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" />no banco</span>
                          <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={() => onCreateArt(savedId)}><Paintbrush className="h-3.5 w-3.5" />Criar arte</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={add.isPending || textOf(i).length < 3} onClick={() => save([i])}>Salvar no banco</Button>
                          <Button size="sm" className="h-7 gap-1 text-xs" disabled={add.isPending || textOf(i).length < 3} onClick={() => save([i], (ids) => ids[0] && onCreateArt(ids[0]))}>
                            <Paintbrush className="h-3.5 w-3.5" />Salvar e criar arte
                          </Button>
                          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" title="Copiar" onClick={() => copy(textOf(i))}><Copy className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {!!t.result?.assumptions?.length && (
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Observações do agente</summary>
              <ul className="mt-1 list-disc pl-5">{t.result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

// ─── 3. Criar arte ────────────────────────────────────────────────────────────

function ArtSection({ selectedId, onSelect, onGoGenerate }: { selectedId: number | null; onSelect: (id: number | null) => void; onGoGenerate: () => void }) {
  const utils = trpc.useUtils();
  const bank = trpc.ctas.list.useQuery();
  const [pickerSearch, setPickerSearch] = useState("");
  const [format, setFormat] = useState<Format>("feed_4x5");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const selected = bank.data?.find((c) => c.id === selectedId) ?? null;

  const arts = trpc.ctas.arts.useQuery(
    { ctaId: selectedId ?? undefined },
    { refetchInterval: (q) => (q.state.data?.some((a) => a.status === "running") ? 3000 : false) },
  );
  const create = trpc.ctas.createArt.useMutation({
    onSuccess: () => { toast.success("O agente começou a arte. Leva alguns minutos."); void utils.ctas.arts.invalidate(); void utils.ctas.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const filtered = (bank.data ?? [])
    .filter((c) => !pickerSearch.trim() || `${c.text} ${c.category} ${c.angle ?? ""}`.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
    // A frase escolhida fica no topo (ex.: vindo de "Salvar e criar arte"); depois as nunca usadas.
    .sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || byPriority(a as CtaRow, b as CtaRow));
  const textById = useMemo(() => new Map((bank.data ?? []).map((c) => [c.id, c.text])), [bank.data]);
  const list = arts.data ?? [];

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
      {/* Escolha do CTA */}
      <Card className="h-fit"><CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Escolha o CTA</p>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-primary" onClick={onGoGenerate}><Wand2 className="h-3.5 w-3.5" />gerar novo</Button>
        </div>
        <label className="relative block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Buscar no banco" className="pl-8" />
        </label>
        <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
          {selectedId !== null && (
            <button type="button" onClick={() => onSelect(null)} className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted">Ver artes de todos os CTAs</button>
          )}
          {filtered.map((c) => (
            <button
              key={c.id} type="button" onClick={() => onSelect(c.id)}
              className={cn("w-full rounded-lg border px-2.5 py-2 text-left text-sm transition", c.id === selectedId ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted")}
            >
              <span className="flex items-start gap-1.5">
                {c.favorite && <Star className="mt-0.5 h-3 w-3 shrink-0 fill-amber-500 text-amber-500" />}
                <span className="font-medium leading-snug">{c.text}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><UsageBadge c={c} />{c.category}{c.angle ? ` · ${c.angle}` : ""}{c.arts ? ` · ${c.arts} arte${c.arts > 1 ? "s" : ""}` : ""}</span>
            </button>
          ))}
          {!filtered.length && <p className="py-6 text-center text-xs text-muted-foreground">Nenhum CTA encontrado.</p>}
        </div>
      </CardContent></Card>

      <div className="space-y-4">
        {/* Configuração da arte */}
        <Card><CardContent className="space-y-4 p-5">
          {selected ? (
            <>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-primary">{selected.category}{selected.angle ? ` · ${selected.angle}` : ""}</p>
                <p className="mt-1 text-2xl font-bold leading-tight">“{selected.text}”</p>
              </div>
              <div className="grid gap-3 md:grid-cols-[150px_minmax(0,300px)_1fr] md:items-end">
                <label className="space-y-1.5 text-sm"><span className="font-medium">Formato</span>
                  <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={select}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                </label>
                <div className="space-y-1.5 text-sm"><span className="font-medium">Modelo</span><ModelPicker value={model} onChange={setModel} /></div>
                <label className="space-y-1.5 text-sm"><span className="font-medium">Observações (opcional)</span>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Ane à esquerda; fundo laranja; incluir QR" />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-xs text-muted-foreground">O Agente de Legendas usa a frase como título da arte, segue a identidade visual da Alle (alle-design, logos, cores, Montserrat, modelos de referência e regras da parceria) e escreve a legenda. Cada arte leva de 2 a 5 minutos.</p>
                <Button className="gap-2" disabled={create.isPending} onClick={() => create.mutate({ ctaId: selected.id, format, model: model || undefined, notes: notes || undefined })}>
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Gerar arte com IA
                </Button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Paintbrush className="mx-auto mb-2 h-7 w-7 text-primary/60" />Escolha um CTA ao lado para criar a arte.
            </div>
          )}
        </CardContent></Card>

        {/* Artes */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{selected ? "Artes deste CTA" : "Artes recentes dos CTAs"} <span className="font-normal text-muted-foreground">· {list.length}</span></h2>
          {list.some((a) => a.status === "running") && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />criando…</span>}
        </div>
        {!arts.isLoading && !list.length && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground"><ImageIcon className="mx-auto mb-2 h-7 w-7 text-primary/50" />Nenhuma arte ainda.</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <Card key={a.threadId} className="overflow-hidden">
              <div className={cn("relative bg-muted", a.format === "story_9x16" ? "aspect-[9/16]" : a.format === "feed_1x1" ? "aspect-square" : "aspect-[4/5]")}>
                {a.status === "running" ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" />o agente está criando…</span>
                ) : a.imageUrl ? (
                  <button type="button" className="absolute inset-0" onClick={() => setViewing(a.threadId)} title="Ver e editar"><img src={a.imageUrl} alt={a.title} loading="lazy" className="h-full w-full object-cover" /></button>
                ) : (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-hidden p-4 text-center text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{a.status === "failed" ? "A arte não foi criada" : "sem arte"}</span>
                    {a.error && <span className="line-clamp-4 break-all">{a.error.slice(0, 200)}</span>}
                  </span>
                )}
                {a.variationOf && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white"><Layers className="mr-1 inline h-3 w-3" />variação</span>}
              </div>
              <CardContent className="space-y-2 p-3">
                {!selected && a.ctaId && <p className="line-clamp-2 text-xs font-medium">{textById.get(a.ctaId) ?? a.title}</p>}
                <p className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {FORMATS.find((f) => f.id === a.format)?.label}</p>
                {a.status === "failed" && !a.imageUrl && a.ctaId && (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={create.isPending}
                    onClick={() => create.mutate({ ctaId: a.ctaId!, format: a.format as Format })}>
                    <Sparkles className="h-3.5 w-3.5" />Tentar de novo
                  </Button>
                )}
                {a.imageUrl && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setViewing(a.threadId)}><Pencil className="h-3.5 w-3.5" />Ver e editar</Button>
                    {a.ctaId && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={create.isPending}
                        onClick={() => create.mutate({ ctaId: a.ctaId!, format: a.format as Format, variationOf: a.threadId })}>
                        <Layers className="h-3.5 w-3.5" />Variação
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2" asChild title="Baixar"><a href={a.imageUrl} target="_blank" rel="noopener noreferrer" download><Download className="h-3.5 w-3.5" /></a></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {viewing !== null && <ArtViewer threadId={viewing} onClose={() => setViewing(null)} onSaved={() => void arts.refetch()} />}
    </section>
  );
}
