import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MotionPublishDialog } from "@/components/motion/MotionPublishDialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, Clapperboard, Copy, Download, FileJson, Loader2, Pencil, RefreshCw, Sparkles, Trash2, Wand2 , Send} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Aba Motion: vídeos animados no padrão da Alle, a partir de modelos prontos ou
// de roteiros escritos pelo Claude, renderizados no servidor.

const select = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const STATUS: Record<string, { label: string; className: string }> = {
  na_fila: { label: "na fila", className: "bg-muted text-muted-foreground" },
  renderizando: { label: "renderizando", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  pronto: { label: "pronto", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  falhou: { label: "falhou", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
};
const ASPECT: Record<string, string> = { story_9x16: "aspect-[9/16]", feed_4x5: "aspect-[4/5]", feed_1x1: "aspect-square", landscape_16x9: "aspect-video" };

export default function MotionStudio() {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const options = trpc.motion.options.useQuery();
  const bank = trpc.ctas.list.useQuery();
  const list = trpc.motion.list.useQuery(undefined, {
    refetchInterval: (q) => (q.state.data?.some((v) => v.status === "na_fila" || v.status === "renderizando") ? 2500 : false),
  });
  const [template, setTemplate] = useState("cta");
  const [format, setFormat] = useState("story_9x16");
  const [ctaId, setCtaId] = useState<number | "">("");
  const [photo, setPhoto] = useState("");
  const [percent, setPercent] = useState(15);
  const [music, setMusic] = useState("mixkit-801");
  const [pasting, setPasting] = useState(false);
  const [publishing, setPublishing] = useState<{ id: number; title: string; caption: string | null; format: string } | null>(null);
  const pubs = trpc.motion.publications.useQuery();
  const cancelPub = trpc.motion.cancelPublication.useMutation({ onSuccess: () => { toast.success("Programação cancelada"); void pubs.refetch(); }, onError: (e) => toast.error(e.message) });

  const refresh = () => void utils.motion.list.invalidate();
  const fromTemplate = trpc.motion.fromTemplate.useMutation({ onSuccess: () => { toast.success("Vídeo na fila de renderização"); refresh(); }, onError: (e) => toast.error(e.message) });
  const remove = trpc.motion.remove.useMutation({ onSuccess: () => { toast.success("Vídeo excluído"); refresh(); }, onError: (e) => toast.error(e.message) });
  const duplicate = trpc.motion.duplicate.useMutation({ onSuccess: () => { toast.success("Cópia na fila"); refresh(); }, onError: (e) => toast.error(e.message) });
  const rerender = trpc.motion.rerender.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const videos = list.data ?? [];
  const ctaText = useMemo(() => new Map((bank.data ?? []).map((c) => [c.id, c.text])), [bank.data]);

  return (
    <AppLayout activeModule="motion">
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <header>
            <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary"><Clapperboard className="mr-1.5 h-3 w-3" />Vídeos motion</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Motion</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Vídeos animados na identidade da Alle (logos, Montserrat, fotos da Ane, fundo da parceria). Comece por um modelo pronto ou use um roteiro escrito pelo Claude. O vídeo é montado no servidor, quadro a quadro, e sai em MP4.
            </p>
          </header>

          <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <div className="space-y-4">
              <Card className="h-fit"><CardContent className="space-y-3 p-5">
                <p className="flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4 text-primary" />Novo a partir de um modelo</p>
                <label className="block space-y-1 text-sm"><span className="font-medium">Modelo</span>
                  <select value={template} onChange={(e) => setTemplate(e.target.value)} className={select}>{options.data?.templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
                </label>
                {template === "cta" && (
                  <label className="block space-y-1 text-sm"><span className="font-medium">Frase do banco de CTAs</span>
                    <select value={ctaId} onChange={(e) => setCtaId(e.target.value ? Number(e.target.value) : "")} className={select}>
                      <option value="">Escolha uma frase…</option>
                      {bank.data?.map((c) => <option key={c.id} value={c.id}>{c.favorite ? "★ " : ""}{c.text}</option>)}
                    </select>
                  </label>
                )}
                {template === "contador" && (
                  <label className="block space-y-1 text-sm"><span className="font-medium">Até quanto</span>
                    <select value={percent} onChange={(e) => setPercent(Number(e.target.value))} className={select}>
                      <option value={15}>15% (pessoa física, alunos)</option><option value={35}>35% (empresas, PJ)</option>
                    </select>
                    <span className="block text-xs text-muted-foreground">A ressalva PJ/PF vai na legenda do post.</span>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm"><span className="font-medium">Formato</span>
                    <select value={format} onChange={(e) => setFormat(e.target.value)} className={select}>{options.data?.formats.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                  </label>
                  <label className="space-y-1 text-sm"><span className="font-medium">Foto da Ane</span>
                    <select value={photo} onChange={(e) => setPhoto(e.target.value)} className={select}><option value="">Do modelo</option>{options.data?.photos.map((p) => <option key={p.id}>{p.id}</option>)}</select>
                  </label>
                </div>
                <label className="block space-y-1 text-sm"><span className="font-medium">Música</span>
                  <select value={music} onChange={(e) => setMusic(e.target.value)} className={select}><option value="">Sem música</option>{options.data?.music.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
                </label>
                <Button className="w-full gap-2" disabled={fromTemplate.isPending || (template === "cta" && !ctaId)}
                  onClick={() => fromTemplate.mutate({ template: template as "cta", format: format as "story_9x16", ctaId: ctaId || undefined, photo: photo || undefined, percent, music: music || null })}>
                  {fromTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Criar vídeo
                </Button>
              </CardContent></Card>

              <Card className="h-fit"><CardContent className="space-y-2 p-5">
                <p className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4 text-primary" />Roteiro do Claude</p>
                <p className="text-xs text-muted-foreground">Os vídeos com roteiro escrito pelo Claude aparecem aqui com a etiqueta "Claude". Também dá para colar um roteiro JSON e renderizar.</p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPasting(true)}><FileJson className="h-4 w-4" />Colar roteiro</Button>
              </CardContent></Card>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Vídeos <span className="font-normal text-muted-foreground">· {videos.length}</span></h2>
                {videos.some((v) => v.status === "renderizando" || v.status === "na_fila") && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />renderizando…</span>}
              </div>
              {!list.isLoading && !videos.length && (
                <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground"><Clapperboard className="mx-auto mb-3 h-8 w-8 text-primary/60" />Nenhum vídeo ainda. Crie o primeiro a partir de um modelo.</div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {videos.map((v) => {
                  return (
                    <Card key={v.id} className="flex flex-col gap-0 overflow-hidden py-0">
                      <div className={cn("relative bg-black", ASPECT[v.format] ?? "aspect-[9/16]")}>
                        {v.status === "pronto" && v.videoUrl ? (
                          <video src={v.videoUrl} poster={v.posterUrl ?? undefined} controls playsInline preload="none" className="h-full w-full object-contain" />
                        ) : v.posterUrl ? (
                          <img src={v.posterUrl} alt="" className="h-full w-full object-contain opacity-40" />
                        ) : null}
                        {v.status !== "pronto" && (
                          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/80">
                            {v.status === "falhou" ? <><span className="font-medium text-white">Não renderizou</span><span className="line-clamp-5 break-all text-xs">{v.error}</span></>
                              : <><Loader2 className="h-6 w-6 animate-spin" />{v.status === "renderizando" ? `renderizando · ${v.progress}%` : "na fila"}</>}
                          </span>
                        )}
                      </div>
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</p>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS[v.status]?.className)}>{STATUS[v.status]?.label ?? v.status}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {v.origin === "claude" ? "Claude" : `modelo ${v.origin}`}{v.seconds ? ` · ${v.seconds}s` : ""}{v.ctaId && ctaText.get(v.ctaId) ? ` · CTA` : ""} · {new Date(v.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {(pubs.data ?? []).filter((p) => p.motionId === v.id).slice(0, 4).map((p) => (
                          <div key={p.postId} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]", p.status === "published" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : p.status === "failed" ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-primary/10 text-primary")} title={p.error ?? undefined}>
                            <span className="font-semibold">{p.target === "feed" ? "Feed" : "Story"}</span>
                            <span>{p.status === "published" ? `publicado ${p.publishedAt ? new Date(p.publishedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}` : p.status === "failed" ? "falhou" : `programado ${p.scheduledAt ? new Date(p.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}`}</span>
                            {p.status === "scheduled" && <button className="ml-auto hover:underline" onClick={() => { if (confirm("Cancelar esta programação?")) cancelPub.mutate({ postId: p.postId }); }}>cancelar</button>}
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => navigate(`/dashboard/motion/${v.id}`)}><Pencil className="h-3.5 w-3.5" />Editar</Button>
                          {v.status === "pronto" && <Button size="sm" variant="outline" className="h-7 gap-1 border-primary/40 text-xs text-primary" onClick={() => setPublishing({ id: v.id, title: v.title, caption: v.caption, format: v.format })}><Send className="h-3.5 w-3.5" />Publicar</Button>}
                          {v.videoUrl && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild><a href={v.videoUrl} target="_blank" rel="noopener noreferrer" download><Download className="h-3.5 w-3.5" />MP4</a></Button>}
                          {v.status === "falhou" && <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => rerender.mutate({ id: v.id })}><RefreshCw className="h-3.5 w-3.5" />Tentar de novo</Button>}
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Duplicar" onClick={() => duplicate.mutate({ id: v.id })}><Copy className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-muted-foreground hover:text-red-600" title="Excluir" onClick={() => { if (confirm("Excluir este vídeo?")) remove.mutate({ id: v.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </main>
            {pasting && <PasteSpec onClose={() => setPasting(false)} onSaved={refresh} />}
      {publishing && <MotionPublishDialog video={publishing} onClose={() => setPublishing(null)} onDone={() => void pubs.refetch()} />}
    </AppLayout>
  );
}

function PasteSpec({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const create = trpc.motion.create.useMutation({ onSuccess: () => { toast.success("Vídeo na fila de renderização"); onSaved(); onClose(); }, onError: (e) => toast.error(e.message) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Colar roteiro</DialogTitle></DialogHeader>
        <label className="block space-y-1 text-xs font-medium">Título<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Reels CTA treino pesado" /></label>
        <label className="block space-y-1 text-xs font-medium">Roteiro JSON<Textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} spellCheck={false} className="font-mono text-[11px]" placeholder='{"format":"story_9x16","scenes":[...]}' /></label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={create.isPending || title.trim().length < 2 || !text.trim()} onClick={() => create.mutate({ title, spec: text })}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Renderizar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
