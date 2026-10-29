import AppLayout from "@/components/AppLayout";
import { TaskError, TaskHistory, TaskProgress, useAgentTask } from "@/components/agents/AgentTask";
import { ArtEditButton, CaptionEditor } from "@/components/agents/ArtEditor";
import { ModelPicker } from "@/components/agents/ModelPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, Camera, Clapperboard, Copy, Download, GalleryHorizontal, ImageIcon, Loader2, Pencil, Smartphone, Sparkles, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type CarouselResult = {
  title: string;
  slides: Array<{ role: string; heading: string; body: string; imageUrl: string }>;
  caption: string; altText: string; hashtags: string[]; assumptions: string[];
};
type PostResult = {
  title: string; imageUrl: string; caption: string; firstComment: string | null; altText: string;
  hashtags: string[]; linterVerdict: "READY" | "REVIEW" | "FIX"; assumptions: string[];
};

/** Pauta deixada por outra tela (ex.: planejamento) para abrir já preenchida. */
function usePrefill(agentSlug: string) {
  const [value] = useState(() => {
    const key = `task_prefill_${agentSlug}`;
    const v = sessionStorage.getItem(key);
    if (v) sessionStorage.removeItem(key);
    return v ?? "";
  });
  return value;
}

async function download(url: string, name: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch {
    window.open(url, "_blank");
  }
}

/** Baixa o arquivo original; se o navegador bloquear o acesso direto, passa pelo proxy da plataforma. */
async function fetchOriginal(url: string): Promise<Blob> {
  try {
    const res = await fetch(url);
    if (res.ok) return await res.blob();
  } catch { /* tenta pelo proxy */ }
  const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Falha ao baixar ${url}`);
  return res.blob();
}

/**
 * Junta todas as artes num .zip. Os PNGs entram sem recompressão (STORE):
 * o arquivo dentro do zip é idêntico ao original, mesma qualidade e resolução.
 */
async function downloadZip(files: Array<{ url: string; name: string }>, zipName: string) {
  const id = toast.loading(`Preparando o zip com ${files.length} artes…`);
  try {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const blobs = await Promise.all(files.map((f) => fetchOriginal(f.url)));
    blobs.forEach((b, i) => zip.file(files[i].name, b, { compression: "STORE", binary: true }));
    const out = await zip.generateAsync({ type: "blob", compression: "STORE" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = zipName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast.success("Zip baixado", { id });
  } catch (e) {
    toast.error(`Não consegui montar o zip: ${(e as Error).message}`, { id });
  }
}

/** Nome de arquivo seguro a partir do título. */
function slug(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "artes";
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copiado");
}

function CaptionBlock({ caption, hashtags, altText, firstComment, verdict, threadId, onSaved }: { caption: string; hashtags: string[]; altText: string; firstComment?: string | null; verdict?: string; threadId?: number | null; onSaved?: () => void }) {
  const full = hashtags.length ? `${caption}\n\n${hashtags.join(" ")}` : caption;
  const [editing, setEditing] = useState(false);
  return (
    <>
    {editing && threadId && <CaptionEditor threadId={threadId} caption={caption} hashtags={hashtags} onClose={() => setEditing(false)} onSaved={() => onSaved?.()} />}
    <Card><CardContent className="space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Legenda</p>
        <div className="flex items-center gap-2">
          {verdict && <Badge variant="outline" className={cn(verdict === "READY" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400")}>revisão: {verdict === "READY" ? "pronta" : verdict === "REVIEW" ? "com ressalvas" : "corrigir"}</Badge>}
          {threadId && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Editar</Button>}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(full)}><Copy className="h-3.5 w-3.5" />Copiar</Button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{full}</p>
      {firstComment && <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="mb-1 text-xs font-medium text-muted-foreground">Primeiro comentário</p><p className="whitespace-pre-wrap">{firstComment}</p></div>}
      <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="mb-1 text-xs font-medium text-muted-foreground">Texto alternativo</p><p>{altText}</p></div>
    </CardContent></Card>
    </>
  );
}

function Assumptions({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
      <p className="mb-1 font-medium text-foreground">O agente assumiu:</p>
      <ul className="list-disc space-y-0.5 pl-4">{items.map((a) => <li key={a}>{a}</li>)}</ul>
    </div>
  );
}

function Shell({ agentLabel, title, description, active, children }: { agentLabel: string; title: string; description: string; active: string; children: React.ReactNode }) {
  return (
    <AppLayout activeModule={active}>
      <main className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-[1300px] space-y-6">
          <header>
            <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/5 text-primary"><Bot className="mr-1.5 h-3 w-3" />{agentLabel}</Badge>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </header>
          {children}
        </div>
      </main>
    </AppLayout>
  );
}

// ─── Carrossel ────────────────────────────────────────────────────────────────

export function CreateCarousel() {
  const t = useAgentTask<CarouselResult>("carrossel");
  const prefill = usePrefill("carrossel");
  const [topic, setTopic] = useState(prefill);
  const [slides, setSlides] = useState(7);
  const [style, setStyle] = useState("auto");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [current, setCurrent] = useState(0);
  const result = t.result;
  useEffect(() => setCurrent(0), [t.threadId]);

  return (
    <Shell active="agentCarousel" agentLabel="Agente de Carrossel" title="Criar carrossel" description="O agente escreve o carrossel pela skill, desenha cada slide no visual da Alle, revisa as artes e entrega slides prontos para postar, com a legenda. As artes também ficam na galeria.">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3"><p className="font-semibold">Pauta</p><TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} /></div>
        <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: as 4 linhas da conta de luz que não são energia — ensinar a ler a fatura e mostrar onde a Alle ajuda a pagar menos" />
        <div className="grid gap-3 md:grid-cols-[120px_180px_260px_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Slides</span>
            <select value={slides} onChange={(e) => setSlides(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-2">{[5, 6, 7, 8, 9, 10].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Estilo</span>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2">
              <option value="auto">Automático (alterna)</option><option value="roxo">Roxo</option><option value="laranja">Laranja</option><option value="claro">Claro</option>
            </select>
          </label>
          <div className="space-y-1.5 text-sm"><span className="font-medium">Modelo</span><ModelPicker value={model} onChange={setModel} /></div>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Observações (opcional)</span><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-9" placeholder="Ex.: usar foto de telhado com painel; CTA para o WhatsApp" /></label>
          <Button className="gap-2" disabled={t.running || t.starting || topic.trim().length < 3} onClick={() => t.start({ topic, slides, style, model: model || undefined, notes: notes || undefined })}>
            {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Criar carrossel
          </Button>
        </div>
      </CardContent></Card>

      {t.running && <TaskProgress agentName="Agente de Carrossel" activity={t.activity} startedAt={t.thread?.createdAt} />}
      {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
      {!t.thread && !t.running && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground"><GalleryHorizontal className="mx-auto mb-3 h-8 w-8 text-primary/60" />Descreva a pauta e clique em Criar carrossel.</div>}

      {result && !t.running && (
        <>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="space-y-3">
              <img src={result.slides[current]?.imageUrl} alt={result.slides[current]?.heading} className="w-full rounded-2xl border shadow-md" />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {result.slides.map((s, i) => (
                  <button key={i} onClick={() => setCurrent(i)} className={cn("w-16 shrink-0 overflow-hidden rounded-lg border-2", i === current ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}>
                    <img src={s.imageUrl} alt="" className="w-full" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => download(result.slides[current].imageUrl, `slide-${current + 1}.png`)}><Download className="h-3.5 w-3.5" />Baixar este</Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={() => downloadZip(result.slides.map((s, i) => ({ url: s.imageUrl, name: `slide-${String(i + 1).padStart(2, "0")}.png` })), `${slug(result.title)}.zip`)}><Download className="h-3.5 w-3.5" />Baixar todos em .zip ({result.slides.length})</Button>
              </div>
              {t.threadId && <ArtEditButton key={current} threadId={t.threadId} target={{ kind: "slide", index: current }} onSaved={() => t.refetch()} className="w-full gap-1.5" />}
            </div>
            <div className="space-y-4">
              <Card><CardContent className="p-5">
                <p className="mb-3 font-semibold">{result.title}</p>
                <ol className="space-y-2 text-sm">
                  {result.slides.map((s, i) => (
                    <li key={i} className={cn("cursor-pointer rounded-lg p-2", i === current && "bg-accent")} onClick={() => setCurrent(i)}>
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{i + 1}/{result.slides.length} · {s.role}</span><b>{s.heading}</b>
                      {s.body && <p className="text-muted-foreground">{s.body}</p>}
                    </li>
                  ))}
                </ol>
              </CardContent></Card>
              <CaptionBlock caption={result.caption} hashtags={result.hashtags} altText={result.altText} threadId={t.threadId} onSaved={() => t.refetch()} />
            </div>
          </section>
          <Assumptions items={result.assumptions} />
        </>
      )}
    </Shell>
  );
}

// ─── Post ─────────────────────────────────────────────────────────────────────

export function CreatePost() {
  const t = useAgentTask<PostResult>("legendas");
  const prefill = usePrefill("legendas");
  const [topic, setTopic] = useState(prefill);
  const [format, setFormat] = useState("feed_4x5");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const result = t.result;

  return (
    <Shell active="agentPost" agentLabel="Agente de Legendas" title="Criar post" description="O agente escreve e revisa a legenda pela skill, desenha a arte no visual da Alle e confere o resultado antes de entregar.">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3"><p className="font-semibold">Pauta</p><TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} /></div>
        <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: bandeira tarifária de novembro — quanto ela soma na conta e como se proteger" />
        <div className="grid gap-3 md:grid-cols-[180px_260px_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Formato</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2">
              <option value="feed_4x5">Feed 4:5</option><option value="feed_1x1">Feed quadrado</option><option value="story_9x16">Stories 9:16</option>
            </select>
          </label>
          <div className="space-y-1.5 text-sm"><span className="font-medium">Modelo</span><ModelPicker value={model} onChange={setModel} /></div>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Observações (opcional)</span><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-9" /></label>
          <Button className="gap-2" disabled={t.running || t.starting || topic.trim().length < 3} onClick={() => t.start({ topic, format, model: model || undefined, notes: notes || undefined })}>
            {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Criar post
          </Button>
        </div>
      </CardContent></Card>

      {t.running && <TaskProgress agentName="Agente de Legendas" activity={t.activity} startedAt={t.thread?.createdAt} />}
      {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
      {!t.thread && !t.running && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground"><ImageIcon className="mx-auto mb-3 h-8 w-8 text-primary/60" />Descreva a pauta e clique em Criar post.</div>}

      {result && !t.running && (
        <>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="space-y-3">
              <img src={result.imageUrl} alt={result.altText} className="w-full rounded-2xl border shadow-md" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => download(result.imageUrl, "post.png")}><Download className="h-3.5 w-3.5" />Baixar arte</Button>
                {t.threadId && <ArtEditButton threadId={t.threadId} target={{ kind: "post" }} onSaved={() => t.refetch()} className="flex-1 gap-1.5" />}
              </div>
            </div>
            <CaptionBlock caption={result.caption} hashtags={result.hashtags} altText={result.altText} firstComment={result.firstComment} verdict={result.linterVerdict} threadId={t.threadId} onSaved={() => t.refetch()} />
          </section>
          <Assumptions items={result.assumptions} />
        </>
      )}
    </Shell>
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

type StickerType = "nenhum" | "enquete" | "caixa_de_perguntas" | "quiz" | "slider" | "link" | "contagem";
type StoriesResult = {
  title: string; goal: string; followUp: string; assumptions: string[];
  frames: Array<{
    role: "abertura" | "meio" | "pergunta" | "fechamento"; imageUrl: string; onScreen: string; voiceover: string | null;
    sticker: { type: StickerType; prompt: string | null; options: string[] };
    replaceWithRealMedia: boolean; notes: string | null;
  }>;
};

const STICKER_LABEL: Record<StickerType, string> = {
  nenhum: "Sem figurinha", enquete: "Enquete", caixa_de_perguntas: "Caixa de perguntas", quiz: "Quiz",
  slider: "Slider", link: "Link", contagem: "Contagem regressiva",
};

/** Prévia da figurinha (no app ela é colocada pela equipe, na faixa que a arte deixou livre). */
function StickerMock({ sticker }: { sticker: StoriesResult["frames"][number]["sticker"] }) {
  const prompt = sticker.prompt ?? "";
  const box = "mx-auto w-[78%] rounded-xl bg-white text-center text-[9px] font-semibold text-neutral-900 shadow-lg";
  switch (sticker.type) {
    case "enquete":
      return (
        <div className={box}>
          <p className="px-2 py-1.5 leading-tight">{prompt}</p>
          <div className="flex border-t">{(sticker.options.length ? sticker.options : ["Sim", "Não"]).slice(0, 2).map((o, i) => <span key={i} className={cn("flex-1 py-1.5 text-[#7c00ae]", i === 0 && "border-r")}>{o}</span>)}</div>
        </div>
      );
    case "quiz":
      return (
        <div className={cn(box, "p-1.5")}>
          <p className="mb-1 leading-tight">{prompt}</p>
          {sticker.options.slice(0, 4).map((o, i) => <p key={i} className="mb-0.5 rounded-full bg-neutral-100 px-2 py-0.5 text-left font-medium">{String.fromCharCode(65 + i)}  {o}</p>)}
        </div>
      );
    case "caixa_de_perguntas":
      return (
        <div className={cn(box, "overflow-hidden")}>
          <p className="bg-gradient-to-r from-[#7c00ae] to-[#ff7300] px-2 py-2 leading-tight text-white">{prompt}</p>
          <p className="py-1.5 font-normal text-neutral-400">Digite algo…</p>
        </div>
      );
    case "slider":
      return (
        <div className={cn(box, "p-2")}>
          <p className="mb-1.5 leading-tight">{prompt}</p>
          <div className="relative h-1 rounded-full bg-gradient-to-r from-[#a23fd6] to-[#ff7300]"><span className="absolute -top-2 left-1/3 text-sm">⚡</span></div>
        </div>
      );
    case "link":
      return <div className="mx-auto w-fit rounded-full bg-white px-3 py-1 text-[9px] font-semibold text-[#7c00ae] shadow-lg">🔗 {prompt || "Saiba mais"}</div>;
    case "contagem":
      return (
        <div className={cn(box, "p-2")}>
          <p className="leading-tight">{prompt}</p>
          <p className="mt-1 font-mono text-[11px] text-[#7c00ae]">00 : 00 : 00</p>
        </div>
      );
    default:
      return null;
  }
}

function PhoneFrame({ frame, index, total }: { frame: StoriesResult["frames"][number]; index: number; total: number }) {
  return (
    <div className="relative w-[230px] shrink-0 overflow-hidden rounded-[28px] border-[6px] border-neutral-900 bg-black shadow-xl" style={{ aspectRatio: "9 / 16" }}>
      <img src={frame.imageUrl} alt={frame.onScreen} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-2 top-2 flex gap-1">
        {Array.from({ length: total }).map((_, i) => <span key={i} className={cn("h-0.5 flex-1 rounded-full", i <= index ? "bg-white" : "bg-white/40")} />)}
      </div>
      <div className="absolute left-2 top-4 flex items-center gap-1.5">
        <img src="/alle-avatar.png" alt="" className="h-5 w-5 rounded-full border border-white/60" />
        <span className="text-[9px] font-semibold text-white drop-shadow">alleenergia</span>
      </div>
      {frame.sticker.type !== "nenhum" && (
        // Faixa y=1150–1480 de 1920 (STORY_STICKER_ZONE no servidor).
        <div className="absolute inset-x-0 flex items-center justify-center" style={{ top: `${(1150 / 1920) * 100}%`, height: `${(330 / 1920) * 100}%` }}>
          <div className="w-full"><StickerMock sticker={frame.sticker} /></div>
        </div>
      )}
    </div>
  );
}

const ROLE_LABEL = { abertura: "Abertura", meio: "Conteúdo", pergunta: "Pergunta", fechamento: "Fechamento" } as const;

export function CreateStories() {
  const t = useAgentTask<StoriesResult>("stories");
  const prefill = usePrefill("stories");
  const [topic, setTopic] = useState(prefill);
  const [frames, setFrames] = useState(5);
  const [notes, setNotes] = useState("");
  const result = t.result;

  return (
    <Shell active="agentStories" agentLabel="Agente de Stories" title="Criar stories" description="O agente monta a sequência do dia pela skill de stories, desenha cada quadro em 1080×1920 no visual da Alle e diz qual figurinha usar e onde. A prévia mostra como fica no celular.">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3"><p className="font-semibold">Tema do dia</p><TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} /></div>
        <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: a conta de outubro chegou mais cara — descobrir quem levou susto e puxar conversa no Direct" />
        <div className="grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Quadros</span>
            <select value={frames} onChange={(e) => setFrames(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-2">{[3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Observações (opcional)</span><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-9" placeholder="Ex.: usar caixa de perguntas; mencionar a collab com a @allpfit" /></label>
          <Button className="gap-2" disabled={t.running || t.starting || topic.trim().length < 3} onClick={() => t.start({ topic, frames, notes: notes || undefined })}>
            {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Criar stories
          </Button>
        </div>
      </CardContent></Card>

      {t.running && <TaskProgress agentName="Agente de Stories" activity={t.activity} startedAt={t.thread?.createdAt} />}
      {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
      {!t.thread && !t.running && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground"><Smartphone className="mx-auto mb-3 h-8 w-8 text-primary/60" />Descreva o tema do dia e clique em Criar stories.</div>}

      {result && !t.running && (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-primary">Objetivo</p><p className="mt-1 text-sm">{result.goal}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wide text-primary">Depois de postar</p><p className="mt-1 text-sm">{result.followUp}</p></CardContent></Card>
          </section>

          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={() => downloadZip(result.frames.map((f, i) => ({ url: f.imageUrl, name: `story-${String(i + 1).padStart(2, "0")}.png` })), `${slug(result.title)}.zip`)}>
              <Download className="h-3.5 w-3.5" />Baixar todos em .zip ({result.frames.length})
            </Button>
          </div>

          <section className="flex gap-5 overflow-x-auto pb-3">
            {result.frames.map((f, i) => (
              <div key={i} className="w-[230px] shrink-0 space-y-2">
                <PhoneFrame frame={f} index={i} total={result.frames.length} />
                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{i + 1}. {ROLE_LABEL[f.role]}</Badge>
                    {f.sticker.type !== "nenhum" && <Badge variant="outline" className="border-primary/30 text-primary">{STICKER_LABEL[f.sticker.type]}</Badge>}
                  </div>
                  {f.replaceWithRealMedia && <p className="flex gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300"><Camera className="h-3.5 w-3.5 shrink-0" />Ideal: gravar foto ou vídeo real da equipe</p>}
                  {f.voiceover && <p><b>Falar:</b> {f.voiceover}</p>}
                  {f.sticker.type !== "nenhum" && f.sticker.prompt && <p><b>Figurinha:</b> {f.sticker.prompt}{f.sticker.options.length ? ` (${f.sticker.options.join(" / ")})` : ""}</p>}
                  {f.notes && <p className="text-muted-foreground">{f.notes}</p>}
                  <div className="flex items-center gap-3">
                    <button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => download(f.imageUrl, `story-${i + 1}.png`)}><Download className="h-3 w-3" />baixar</button>
                    {t.threadId && <ArtEditButton threadId={t.threadId} target={{ kind: "frame", index: i }} onSaved={() => t.refetch()} className="h-7 gap-1 px-2 text-xs" />}
                  </div>
                </div>
              </div>
            ))}
          </section>
          <Assumptions items={result.assumptions} />
        </>
      )}
    </Shell>
  );
}

// ─── Vídeo com avatar (HeyGen) ────────────────────────────────────────────────

type VideoResult = {
  title: string;
  hooks: Array<{ text: string; score: number; why: string }>;
  script: string;
  wordCount: number;
  scenes: Array<{ time: string; speech: string; onScreen: string; broll: string | null }>;
  caption: string; hashtags: string[]; assumptions: string[];
  videos?: Array<{ id: number; url: string | null; avatarName: string; voiceId: string; createdAt: string; editedUrl?: string; editedAt?: string; edit?: { hook: string; cta: string; transition: boolean; dynamic?: boolean } }>;
};

/** A voz do HeyGen fala cerca de 2,3 palavras por segundo (mesma conta da skill alle-video). */
const speechSeconds = (text: string) => Math.round(text.trim().split(/\s+/).filter(Boolean).length / 2.3);

export function CreateVideoAgent() {
  const t = useAgentTask<VideoResult>("video-ia");
  const prefill = usePrefill("video-ia");
  const [topic, setTopic] = useState(prefill);
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [script, setScript] = useState("");
  const result = t.result;

  const { data: avatars = [], isLoading: loadingAvatars } = trpc.videos.getAccountAvatars.useQuery();
  const { data: voices = [] } = trpc.videos.getVoices.useQuery({ provider: "heygen", language: "Portuguese" });
  const avatar = avatars.find((a) => a.id === avatarId);
  useEffect(() => { if (!avatarId && avatars.length) setAvatarId(avatars[0].id); }, [avatars, avatarId]);
  // Ao trocar de avatar, usa a voz padrão dele (a equipe pode trocar depois).
  useEffect(() => { if (avatar?.defaultVoiceId) setVoiceId(avatar.defaultVoiceId); }, [avatar?.id]);
  useEffect(() => { setScript(result?.script ?? ""); }, [t.threadId, result?.script]);

  const attach = trpc.agents.attachVideo.useMutation({ onSuccess: () => t.refetch() });
  const generate = trpc.videos.generate.useMutation({
    onSuccess: (video) => {
      toast.success("Vídeo gerado e salvo.");
      if (t.threadId) attach.mutate({ threadId: t.threadId, script, video: { id: video.id, url: video.videoUrl ?? null, avatarName: avatar?.name ?? "", voiceId } });
    },
    onError: (e) => toast.error(e.message),
  });
  const canGenerate = Boolean(avatarId && voiceId && script.trim().length >= 10) && !generate.isPending;

  return (
    <Shell active="agentVideo" agentLabel="Agente de Vídeo IA" title="Criar vídeo com IA" description="O agente escreve o roteiro falado no estilo dos vídeos de referência da equipe. Você revisa, escolhe o avatar e a voz do HeyGen e gera o vídeo vertical, que fica salvo junto do roteiro.">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3"><p className="font-semibold">Pauta</p><TaskHistory tasks={t.tasks} threadId={t.threadId} onSelect={t.setThreadId} /></div>
        <Textarea rows={3} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex.: a Ane explica em 30 segundos o que é energia digital e por que não precisa de obra" />
        <div className="space-y-1.5 text-sm">
          <span className="font-medium">Modelo e cenário</span>
          {!avatars.length && <p className="text-xs text-muted-foreground">{loadingAvatars ? "Carregando os avatares da conta HeyGen…" : "Nenhum avatar na conta HeyGen."}</p>}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {avatars.map((a) => (
              <button key={a.id} type="button" onClick={() => setAvatarId(a.id)} className={cn("w-[132px] shrink-0 overflow-hidden rounded-xl border-2 text-left transition", avatarId === a.id ? "border-primary" : "border-transparent bg-muted/40 opacity-80 hover:opacity-100")}>
                {a.previewImageUrl ? <img src={a.previewImageUrl} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" /> : <div className="aspect-[3/4] w-full bg-muted" />}
                <p className="px-2 py-1.5 text-xs font-medium leading-tight">{a.name}{a.type === "digital_twin" ? <span className="block font-normal text-muted-foreground">gêmeo digital</span> : null}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Novos cenários (podcast, academia, escritório…) são criados como looks do avatar no HeyGen e aparecem aqui sozinhos.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[120px_260px_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm"><span className="font-medium">Duração</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-9 w-full rounded-md border bg-background px-2">{[15, 30, 45, 60].map((n) => <option key={n} value={n}>{n} s</option>)}</select>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Voz</span>
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2">
              <option value="">Escolha a voz</option>
              {voices.map((v) => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Observações (opcional)</span><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-9" placeholder="Ex.: tom descontraído; terminar pedindo para comentar ENERGIA" /></label>
          <Button className="gap-2" disabled={t.running || t.starting || topic.trim().length < 3} onClick={() => t.start({ topic, durationSec: duration, avatarName: avatar?.name, notes: notes || undefined })}>
            {t.starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Criar roteiro
          </Button>
        </div>
      </CardContent></Card>

      {t.running && <TaskProgress agentName="Agente de Vídeo IA" activity={t.activity} startedAt={t.thread?.createdAt} />}
      {t.thread?.status === "failed" && <TaskError message={t.thread.lastError} />}
      {!t.thread && !t.running && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground"><Clapperboard className="mx-auto mb-3 h-8 w-8 text-primary/60" />Descreva a pauta e clique em Criar roteiro.</div>}

      {result && !t.running && (
        <>
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card><CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">Fala do avatar</p>
                  <Badge variant="outline">{script.trim().split(/\s+/).filter(Boolean).length} palavras · ~{speechSeconds(script)} s</Badge>
                </div>
                <Textarea rows={10} value={script} onChange={(e) => setScript(e.target.value)} className="text-sm leading-relaxed" />
                <p className="text-xs text-muted-foreground">É exatamente isto que a voz vai falar. Pode editar antes de gerar: números por extenso e sem símbolos.</p>
                <Button className="w-full gap-2" disabled={!canGenerate} onClick={() => generate.mutate({ title: result.title, topic, script, accountAvatarId: avatarId, voiceId })}>
                  {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                  {generate.isPending ? "Gerando no HeyGen… pode levar alguns minutos" : `Gerar vídeo no HeyGen${avatar ? ` com ${avatar.name}` : ""}`}
                </Button>
              </CardContent></Card>

              {!!result.videos?.length && (
                <Card><CardContent className="space-y-3 p-5">
                  <p className="font-semibold">Vídeos gerados</p>
                  <div className="flex gap-4 overflow-x-auto pb-1">
                    {result.videos.map((v, i) => (
                      <div key={`${v.id}-${v.createdAt}`} className="flex shrink-0 gap-3">
                        <div className="w-[200px] space-y-1.5">
                          {v.url ? <video src={v.url} controls playsInline className="aspect-[9/16] w-full rounded-xl border bg-black object-contain" /> : <div className="flex aspect-[9/16] items-center justify-center rounded-xl border text-xs text-muted-foreground">Sem arquivo</div>}
                          <p className="text-xs text-muted-foreground">Original · {v.avatarName}</p>
                          {v.url && <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => download(v.url!, `${slug(result.title)}.mp4`)}><Download className="h-3 w-3" />baixar</button>}
                        </div>
                        {v.editedUrl && (
                          <div className="w-[200px] space-y-1.5">
                            <video key={v.editedUrl} src={v.editedUrl} controls playsInline className="aspect-[9/16] w-full rounded-xl border-2 border-primary bg-black object-contain" />
                            <p className="text-xs font-medium text-primary">Editado para Reels</p>
                            <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => download(v.editedUrl!, `${slug(result.title)}-reels.mp4`)}><Download className="h-3 w-3" />baixar</button>
                          </div>
                        )}
                        {v.url && t.threadId && <ReelsEditPanel threadId={t.threadId} index={i} video={v} defaultHook={result.scenes[0]?.onScreen ?? ""} onDone={() => t.refetch()} />}
                      </div>
                    ))}
                  </div>
                </CardContent></Card>
              )}

              <Card><CardContent className="space-y-2 p-5">
                <p className="font-semibold">Ganchos</p>
                {result.hooks.map((h, i) => (
                  <div key={i} className="rounded-lg bg-muted/40 p-3 text-sm">
                    <p><Badge variant="outline" className="mr-2">{h.score}/10</Badge><b>{h.text}</b></p>
                    <p className="mt-1 text-xs text-muted-foreground">{h.why}</p>
                  </div>
                ))}
              </CardContent></Card>
            </div>

            <div className="space-y-4">
              <Card><CardContent className="p-5">
                <p className="mb-3 font-semibold">{result.title} · cenas</p>
                <ol className="space-y-2 text-sm">
                  {result.scenes.map((s, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <p className="mb-1 font-mono text-xs text-muted-foreground">{s.time}</p>
                      <p>{s.speech}</p>
                      <p className="mt-1.5 text-xs"><b>Na tela:</b> {s.onScreen}</p>
                      {s.broll && <p className="text-xs text-muted-foreground"><b>B-roll:</b> {s.broll}</p>}
                    </li>
                  ))}
                </ol>
              </CardContent></Card>
              <CaptionBlock caption={result.caption} hashtags={result.hashtags} altText={`Vídeo vertical: ${result.title}`} threadId={t.threadId} onSaved={() => t.refetch()} />
            </div>
          </section>
          <Assumptions items={result.assumptions} />
        </>
      )}
    </Shell>
  );
}

/** Formulário da edição para Reels: gancho, chamada final e transição. */
function ReelsEditPanel({ threadId, index, video, defaultHook, onDone }: { threadId: number; index: number; video: NonNullable<VideoResult["videos"]>[number]; defaultHook: string; onDone: () => void }) {
  const [hook, setHook] = useState(video.edit?.hook ?? defaultHook);
  const [cta, setCta] = useState(video.edit?.cta ?? "Chama a Ane na bio");
  const [transition, setTransition] = useState(video.edit?.transition ?? true);
  const [dynamic, setDynamic] = useState(video.edit?.dynamic ?? true);
  const edit = trpc.agents.editVideoForReels.useMutation({
    onSuccess: () => { toast.success("Vídeo editado para Reels."); onDone(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="w-[240px] space-y-2 rounded-xl border p-3 text-sm">
      <p className="font-semibold">Editar para Reels</p>
      <p className="text-xs text-muted-foreground">Legenda palavra a palavra com destaque laranja, cortes com zoom, logo, barra de progresso e chamada final. Sempre 1080×1920.</p>
      <label className="block space-y-1"><span className="text-xs font-medium">Gancho (primeiros 2 s)</span>
        <input value={hook} maxLength={80} onChange={(e) => setHook(e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-sm" />
      </label>
      <label className="block space-y-1"><span className="text-xs font-medium">Chamada final</span>
        <input value={cta} maxLength={60} onChange={(e) => setCta(e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-sm" />
      </label>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={dynamic} onChange={(e) => setDynamic(e.target.checked)} /><span><b>Legendas dinâmicas:</b> gancho e palavras-chave gigantes atrás do avatar e ícones animados pelo assunto (fatura, desconto, obra, QR code…)</span></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={transition} onChange={(e) => setTransition(e.target.checked)} />Transição de queima de filme com som</label>
      <p className="text-xs text-muted-foreground">Trilha: escolha um áudio em alta no Instagram na hora de postar.</p>
      <Button size="sm" className="w-full gap-1.5" disabled={edit.isPending} onClick={() => edit.mutate({ threadId, videoIndex: index, hook, cta, transition, dynamic })}>
        {edit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {edit.isPending ? (dynamic ? "Editando… (2 a 4 min)" : "Editando… (1 a 3 min)") : video.editedUrl ? "Editar de novo" : "Editar para Reels"}
      </Button>
    </div>
  );
}
