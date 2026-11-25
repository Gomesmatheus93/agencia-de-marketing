import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  anePhotoOf, ASSET_URL, colorsOf, FONT_FACES, libraryItem, readTexts, replaceColor, swapAne, toPreview, writeText, type AnePhoto,
} from "@/lib/motionSvg";
import { composeFrame, layerOutStart, sceneAt, type MotionLayerLike, type PreparedScene } from "@shared/motionFrame";
import {
  ArrowLeft, ChevronDown, ChevronUp, Circle, Code2, Copy, Eye, EyeOff, Hash, Image as ImageIcon, Keyboard, Loader2, Minus, MousePointerClick, Pause, Play,
  Plus, QrCode, Redo2, RectangleHorizontal, RotateCcw, Save, SkipBack, Square, Trash2, Type, Undo2, UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

// Editor de motion no estilo CapCut/Premiere: prévia ao vivo no centro (clicar e
// arrastar elementos), biblioteca à esquerda, propriedades à direita e linha do
// tempo embaixo (cenas e uma trilha por elemento, com arrastar para ajustar tempo).

type Layer = MotionLayerLike;
type Scene = { name?: string; duration: number; transition: string; background?: string; layers: Layer[] };
type Spec = { format: string; fps: number; music?: string | null; musicVolume: number; background?: string; scenes: Scene[] };

const PRESETS: Array<[string, string]> = [
  ["fade", "Aparecer"], ["slide-up", "Subir"], ["slide-down", "Descer"], ["slide-left", "Da direita"], ["slide-right", "Da esquerda"],
  ["pop", "Pop"], ["zoom-in", "Zoom +"], ["zoom-out", "Zoom −"], ["wipe-right", "Revelar"], ["rise", "Subir de baixo"], ["spin-in", "Girar"],
];
const LOOPS: Array<[string, string]> = [["pulse", "Respirar"], ["float", "Flutuar"], ["wiggle", "Balançar"], ["glow", "Piscar"], ["spin", "Girar"]];
const EASES: Array<[string, string]> = [["out", "Suave"], ["back", "Com impulso"], ["elastic", "Elástico"], ["in-out", "Suave nos dois lados"], ["linear", "Constante"]];
const TRANSITIONS: Array<[string, string]> = [["fade", "Esmaecer"], ["cut", "Corte"], ["slide-left", "Deslizar"], ["zoom", "Zoom"]];
const COLORS = ["#ff7300", "#ffffff", "#7c00ae", "#5a16a8", "#3d0b80", "#f47b20", "#22c55e", "#fff8f2"];
const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const clone = <T,>(x: T): T => structuredClone(x);

/** Início e fim visíveis de uma camada dentro da cena. */
const span = (l: Layer, dur: number) => ({ start: l.in?.at ?? 0, end: l.out ? Math.min(dur, layerOutStart(l, dur) + l.out.dur) : dur });

export default function MotionEditorPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const q = trpc.motion.get.useQuery({ id }, { enabled: Number.isFinite(id), refetchOnWindowFocus: false });
  const options = trpc.motion.options.useQuery();
  const utils = trpc.useUtils();

  const [spec, setSpec] = useState<Spec | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [past, setPast] = useState<Spec[]>([]);
  const [future, setFuture] = useState<Spec[]>([]);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [layerIdx, setLayerIdx] = useState<number | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pps, setPps] = useState(110);
  const [dirty, setDirty] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [leftTab, setLeftTab] = useState<"elementos" | "ane">("elementos");

  useEffect(() => {
    if (q.data && !spec) { setSpec(q.data.spec as unknown as Spec); setTitle(q.data.title); setCaption(q.data.caption ?? ""); }
  }, [q.data, spec]);

  const fmt = options.data?.formats.find((f) => f.id === spec?.format);
  const W = fmt?.width ?? 1080, H = fmt?.height ?? 1920;
  const total = spec?.scenes.reduce((a, s) => a + s.duration, 0) ?? 0;
  const starts = useMemo(() => { let a = 0; return (spec?.scenes ?? []).map((s) => { const x = a; a += s.duration; return x; }); }, [spec]);
  const scene = spec?.scenes[sceneIdx];
  const layer = scene && layerIdx !== null ? scene.layers[layerIdx] : null;
  const photos = (options.data?.photos ?? []) as AnePhoto[];

  // ─── Alterações com desfazer ────────────────────────────────────────────────
  const commit = useCallback((fn: (s: Spec) => void) => {
    setSpec((cur) => {
      if (!cur) return cur;
      setPast((p) => [...p.slice(-60), cur]); setFuture([]);
      const next = clone(cur); fn(next); return next;
    });
    setDirty(true);
  }, []);
  /** Alteração contínua (arrastar): grava o "antes" uma vez, no início do gesto. */
  const snapshot = useCallback(() => { setSpec((cur) => { if (cur) { setPast((p) => [...p.slice(-60), cur]); setFuture([]); } return cur; }); setDirty(true); }, []);
  const live = useCallback((fn: (s: Spec) => void) => setSpec((cur) => { if (!cur) return cur; const next = clone(cur); fn(next); return next; }), []);
  const undo = () => { if (!past.length || !spec) return; setFuture((f) => [spec, ...f]); setSpec(past[past.length - 1]); setPast((p) => p.slice(0, -1)); };
  const redo = () => { if (!future.length || !spec) return; setPast((p) => [...p, spec]); setSpec(future[0]); setFuture((f) => f.slice(1)); };
  const editLayer = (fn: (l: Layer) => void) => { if (layerIdx === null) return; commit((s) => fn(s.scenes[sceneIdx].layers[layerIdx])); };

  // ─── Prévia ao vivo ─────────────────────────────────────────────────────────
  const prepared: PreparedScene[] = useMemo(() => (spec?.scenes ?? []).map((sc) => ({
    duration: sc.duration, transition: sc.transition,
    bg: toPreview(sc.background ?? spec?.background ?? ""),
    layers: sc.layers.map((l) => ({ layer: l, svg: toPreview(l.svg) })),
  })), [spec]);
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !prepared.length) return;
    el.innerHTML = composeFrame(prepared, Math.min(t, Math.max(0, total - 0.001)), W, H, { tag: true });
    const svg = el.querySelector("svg");
    if (svg) { svg.removeAttribute("width"); svg.removeAttribute("height"); svg.style.width = "100%"; svg.style.height = "100%"; svg.style.display = "block"; }
    // Contorno do elemento selecionado (só quando a cena dele está na tela).
    const cur = sceneAt(prepared, t).index;
    const g = layerIdx !== null && cur === sceneIdx ? el.querySelector(`[data-layer="${layerIdx}"]`) : null;
    if (g) { const r = g.getBoundingClientRect(), base = el.getBoundingClientRect(); setBox({ left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height }); } else setBox(null);
  }, [prepared, t, W, H, total, layerIdx, sceneIdx]);

  // Tocar: avança o tempo e toca a música junto.
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicUrl = options.data?.music.find((m) => m.id === spec?.music)?.url;
  useEffect(() => {
    if (!playing) { audioRef.current?.pause(); return; }
    const a = audioRef.current;
    if (a && musicUrl) { a.currentTime = t; a.volume = spec?.musicVolume ?? 0.5; void a.play().catch(() => {}); }
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setT((cur) => { const n = cur + dt; if (n >= total) { setPlaying(false); return total; } return n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const togglePlay = () => { if (!playing && t >= total - 0.05) setT(0); setPlaying((p) => !p); };
  // A cena sob o cursor vira a cena selecionada enquanto toca ou ao arrastar o tempo.
  useEffect(() => { if (!spec) return; const i = sceneAt(spec.scenes, t).index; if (i !== sceneIdx && (playing || layerIdx === null)) { setSceneIdx(i); } }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Clicar e arrastar na prévia ────────────────────────────────────────────
  const drag = useRef<{ x: number; y: number; off: [number, number]; k: number } | null>(null);
  const onStageDown = (e: React.PointerEvent) => {
    const g = (e.target as Element).closest("[data-layer]");
    const cur = sceneAt(prepared, t).index;
    if (!g) { setLayerIdx(null); return; }
    const k = Number(g.getAttribute("data-layer"));
    setSceneIdx(cur); setLayerIdx(k); setPlaying(false);
    const l = spec!.scenes[cur].layers[k];
    snapshot();
    drag.current = { x: e.clientX, y: e.clientY, off: l.offset ?? [0, 0], k };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onStageMove = (e: React.PointerEvent) => {
    const d = drag.current, el = stageRef.current;
    if (!d || !el) return;
    const f = W / el.getBoundingClientRect().width;
    const dx = Math.round((e.clientX - d.x) * f), dy = Math.round((e.clientY - d.y) * f);
    if (Math.abs(dx) + Math.abs(dy) < 2) return;
    const cur = sceneAt(prepared, t).index;
    live((s) => { s.scenes[cur].layers[d.k].offset = [d.off[0] + dx, d.off[1] + dy]; });
  };
  const onStageUp = () => { drag.current = null; };

  // ─── Atalhos ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && layerIdx !== null) { e.preventDefault(); commit((s) => { s.scenes[sceneIdx].layers.splice(layerIdx, 1); }); setLayerIdx(null); }
      else if (layerIdx !== null && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const [dx, dy] = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : [0, step];
        editLayer((l) => { const o = l.offset ?? [0, 0]; l.offset = [o[0] + dx, o[1] + dy]; });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ─── Salvar ─────────────────────────────────────────────────────────────────
  const save = trpc.motion.update.useMutation({
    onSuccess: () => { toast.success("Salvo. O vídeo está sendo gerado de novo."); setDirty(false); void utils.motion.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ─── Adicionar elementos ────────────────────────────────────────────────────
  const add = (kind: string, photo?: AnePhoto) => {
    const item = libraryItem(kind, W, H, photo);
    if (!item || !spec) return;
    const at = Math.max(0, Math.min(spec.scenes[sceneIdx].duration - 0.4, Number((t - starts[sceneIdx]).toFixed(2))));
    const fresh: Layer = { name: item.name, svg: item.svg, origin: item.origin, in: { preset: kind === "ane" ? "rise" : "pop", at, dur: 0.6, ease: kind === "ane" ? "out" : "back" } };
    if ("counter" in item && item.counter) fresh.counter = { ...item.counter, at };
    if ("typewriter" in item && item.typewriter) fresh.typewriter = { ...item.typewriter, at };
    commit((s) => { s.scenes[sceneIdx].layers.push(fresh); });
    setLayerIdx(spec.scenes[sceneIdx].layers.length);
  };

  if (!user) return null;
  if (q.isLoading || !spec) return <div className="flex h-screen items-center justify-center bg-[#111014] text-white/70"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (q.error) return <div className="flex h-screen items-center justify-center bg-[#111014] text-white/70">{q.error.message}</div>;

  const panel = "rounded-xl border border-white/10 bg-[#1b1a20]";
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#111014] text-white">
      <style>{FONT_FACES}</style>
      {musicUrl && <audio ref={audioRef} src={musicUrl} preload="auto" />}

      {/* Barra superior */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <Button size="sm" variant="ghost" className="gap-1.5 text-white/80 hover:bg-white/10 hover:text-white" onClick={() => { if (!dirty || confirm("Sair sem salvar?")) navigate("/dashboard/motion"); }}><ArrowLeft className="h-4 w-4" />Motion</Button>
        <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className="h-8 min-w-0 max-w-md border-white/10 bg-white/5 text-sm text-white" />
        <span className="hidden text-xs text-white/40 lg:inline">{fmt?.label}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" className="h-8 px-2 text-white/80 hover:bg-white/10" title="Desfazer (Ctrl+Z)" disabled={!past.length} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-white/80 hover:bg-white/10" title="Refazer (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-white/80 hover:bg-white/10" title="Roteiro em código" onClick={() => setShowCode(true)}><Code2 className="h-4 w-4" /></Button>
          <Button size="sm" className="ml-2 h-8 gap-1.5" disabled={save.isPending} onClick={() => save.mutate({ id, title, caption: caption || null, spec })}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="hidden lg:inline">Salvar e gerar vídeo</span><span className="lg:hidden">Salvar</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* Biblioteca */}
        <aside className={cn(panel, "flex w-44 shrink-0 flex-col overflow-hidden lg:w-60")}>
          <div className="flex border-b border-white/10 text-xs">
            {(["elementos", "ane"] as const).map((tab) => (
              <button key={tab} onClick={() => setLeftTab(tab)} className={cn("flex-1 py-2.5 font-medium", leftTab === tab ? "border-b-2 border-[#ff7300] text-white" : "text-white/50")}>{tab === "elementos" ? "Elementos" : "Fotos da Ane"}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {leftTab === "elementos" ? (
              <div className="grid grid-cols-2 gap-2">
                {([["titulo", "Título", Type], ["texto", "Texto", Minus], ["botao", "Botão", RectangleHorizontal], ["qr", "QR Code", QrCode], ["contador", "Contador", Hash], ["digitacao", "Digitação", Keyboard], ["circulo", "Círculo", Circle], ["card", "Card", Square], ["logos", "Logos", ImageIcon]] as const).map(([k, label, Icon]) => (
                  <button key={k} onClick={() => add(k)} className="flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-3 text-xs text-white/80 hover:border-[#ff7300] hover:text-white">
                    <Icon className="h-5 w-5" />{label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((p) => (
                  <button key={p.id} onClick={() => layer && anePhotoOf(layer.svg) ? editLayer((l) => { l.svg = swapAne(l.svg, p, W); }) : add("ane", p)} title={layer && anePhotoOf(layer.svg) ? "Trocar a foto da Ane selecionada" : "Adicionar a Ane"}
                    className="overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-[#5a16a8] to-[#2e0a63] hover:border-[#ff7300]">
                    <img src={`${ASSET_URL}/${p.id}.png`} alt={p.id} className="aspect-[4/5] w-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-white/40">
              {leftTab === "ane" ? "Com uma Ane selecionada, clicar troca a foto; sem seleção, adiciona." : "Entra na cena selecionada, no ponto do cursor de tempo."}
            </p>
          </div>
        </aside>

        {/* Prévia */}
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3">
          <div className="relative flex min-h-0 w-full flex-1 items-center justify-center [container-type:size]">
            <div className="relative" style={{ aspectRatio: `${W}/${H}`, width: `min(100cqw, calc(100cqh * ${W} / ${H}))` }}>
              <div ref={stageRef} onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp}
                className="h-full w-full cursor-pointer touch-none overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 [&_[data-layer]]:cursor-move" />
              {box && <div className="pointer-events-none absolute border-2 border-[#ff7300]" style={{ left: box.left - 2, top: box.top - 2, width: box.width + 4, height: box.height + 4 }} />}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Button size="sm" variant="ghost" className="h-8 px-2 text-white/80 hover:bg-white/10" onClick={() => { setPlaying(false); setT(0); }}><SkipBack className="h-4 w-4" /></Button>
            <Button size="sm" className="h-9 w-9 rounded-full p-0" onClick={togglePlay} title="Tocar/pausar (espaço)">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
            <span className="w-36 text-center font-mono text-xs text-white/70">{fmtTime(t)} / {fmtTime(total)}</span>
            <span className="flex items-center gap-1 text-[11px] text-white/40"><MousePointerClick className="h-3.5 w-3.5" />clique para selecionar, arraste para mover</span>
          </div>
        </main>

        {/* Propriedades */}
        <aside className={cn(panel, "w-64 shrink-0 overflow-y-auto p-4 lg:w-80")}>
          {layer ? (
            <LayerProps layer={layer} sceneDur={scene!.duration} photos={photos} W={W}
              onChange={editLayer}
              onDuplicate={() => { commit((s) => { const ls = s.scenes[sceneIdx].layers; const c = clone(ls[layerIdx!]); c.offset = [(c.offset?.[0] ?? 0) + 30, (c.offset?.[1] ?? 0) + 30]; ls.splice(layerIdx! + 1, 0, c); }); setLayerIdx(layerIdx! + 1); }}
              onDelete={() => { commit((s) => { s.scenes[sceneIdx].layers.splice(layerIdx!, 1); }); setLayerIdx(null); }}
              onOrder={(d) => { const n = layerIdx! + d; if (n < 0 || n >= scene!.layers.length) return; commit((s) => { const ls = s.scenes[sceneIdx].layers; const [x] = ls.splice(layerIdx!, 1); ls.splice(n, 0, x); }); setLayerIdx(n); }} />
          ) : (
            <div className="space-y-5">
              <Section title={`Cena ${sceneIdx + 1}`}>
                <Field label="Nome"><Input value={scene?.name ?? ""} onChange={(e) => commit((s) => { s.scenes[sceneIdx].name = e.target.value; })} className="h-8 border-white/10 bg-white/5 text-sm" /></Field>
                <Field label={`Duração: ${scene?.duration.toFixed(1)}s`}><input type="range" min={0.5} max={15} step={0.1} value={scene?.duration ?? 1} onChange={(e) => commit((s) => { s.scenes[sceneIdx].duration = Number(e.target.value); })} className="w-full accent-[#ff7300]" /></Field>
                <Field label="Passagem para a próxima"><Chips options={TRANSITIONS} value={scene?.transition ?? "fade"} onChange={(v) => commit((s) => { s.scenes[sceneIdx].transition = v; })} /></Field>
              </Section>
              <Section title="Vídeo">
                <Field label="Música">
                  <select value={spec.music ?? ""} onChange={(e) => commit((s) => { s.music = e.target.value || null; })} className="h-8 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs">
                    <option value="">Sem música</option>{options.data?.music.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Field>
                <Field label={`Volume: ${Math.round(spec.musicVolume * 100)}%`}><input type="range" min={0} max={1} step={0.05} value={spec.musicVolume} onChange={(e) => commit((s) => { s.musicVolume = Number(e.target.value); })} className="w-full accent-[#ff7300]" /></Field>
                <Field label="Legenda do post"><Textarea value={caption} onChange={(e) => { setCaption(e.target.value); setDirty(true); }} rows={5} className="border-white/10 bg-white/5 text-sm" /></Field>
              </Section>
              <p className="text-[11px] leading-relaxed text-white/40">Clique num elemento na prévia ou na linha do tempo para editar. Atalhos: espaço toca, Delete apaga, setas movem (Shift = mais), Ctrl+Z desfaz.</p>
            </div>
          )}
        </aside>
      </div>

      <Timeline spec={spec} starts={starts} total={total} t={t} pps={pps} sceneIdx={sceneIdx} layerIdx={layerIdx}
        onSeek={(x) => { setPlaying(false); setT(Math.max(0, Math.min(total, x))); }}
        onSelectScene={(i) => { setSceneIdx(i); setLayerIdx(null); }}
        onSelectLayer={(i, k) => { setSceneIdx(i); setLayerIdx(k); }}
        onZoom={setPps} snapshot={snapshot} live={live} commit={commit} playing={playing} />

      {showCode && <CodeDialog spec={spec} onClose={() => setShowCode(false)} onApply={(next) => { commit((s) => { Object.assign(s, next); }); setShowCode(false); }} />}
    </div>
  );
}

// ─── Linha do tempo ───────────────────────────────────────────────────────────

function Timeline({ spec, starts, total, t, pps, sceneIdx, layerIdx, onSeek, onSelectScene, onSelectLayer, onZoom, snapshot, live, commit }: {
  spec: Spec; starts: number[]; total: number; t: number; pps: number; sceneIdx: number; layerIdx: number | null; playing: boolean;
  onSeek: (t: number) => void; onSelectScene: (i: number) => void; onSelectLayer: (i: number, k: number) => void; onZoom: (p: number) => void;
  snapshot: () => void; live: (fn: (s: Spec) => void) => void; commit: (fn: (s: Spec) => void) => void;
}) {
  const LABEL = 170;
  const laneRef = useRef<HTMLDivElement>(null);
  const width = Math.max(600, total * pps + 80);
  const scene = spec.scenes[sceneIdx];
  const s0 = starts[sceneIdx];
  const timeAt = (clientX: number) => { const r = laneRef.current!.getBoundingClientRect(); return (clientX - r.left + laneRef.current!.scrollLeft - LABEL) / pps; };

  /** Arrastar com o ponteiro: grava o "antes" e aplica a cada movimento. */
  const startDrag = (e: React.PointerEvent, apply: (dt: number) => void) => {
    e.stopPropagation(); e.preventDefault();
    const x0 = e.clientX;
    snapshot();
    const move = (ev: PointerEvent) => apply((ev.clientX - x0) / pps);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const round = (x: number) => Math.round(x * 20) / 20;

  const seekDrag = (e: React.PointerEvent) => {
    onSeek(timeAt(e.clientX));
    const move = (ev: PointerEvent) => onSeek(timeAt(ev.clientX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const ticks: number[] = [];
  const step = pps > 150 ? 0.5 : pps > 60 ? 1 : 2;
  for (let x = 0; x <= total + 0.001; x += step) ticks.push(Number(x.toFixed(2)));

  // Trilhas: a de cima é a da frente (último elemento desenhado).
  const rows = scene.layers.map((l, k) => ({ l, k })).reverse();

  return (
    <section className="flex h-[300px] shrink-0 flex-col border-t border-white/10 bg-[#17161b]">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-1.5 text-xs text-white/70">
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-white/80 hover:bg-white/10" onClick={() => commit((s) => {
          s.scenes.splice(sceneIdx + 1, 0, { name: "nova cena", duration: 3, transition: "fade", layers: s.scenes[sceneIdx].layers.filter((l) => (l.name ?? "").startsWith("logo")).map((l) => ({ ...clone(l), in: undefined })) });
        })}><Plus className="h-3.5 w-3.5" />Cena</Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-white/80 hover:bg-white/10" onClick={() => commit((s) => { s.scenes.splice(sceneIdx + 1, 0, clone(s.scenes[sceneIdx])); })}><Copy className="h-3.5 w-3.5" />Duplicar cena</Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-white/80 hover:bg-white/10" disabled={sceneIdx === 0} onClick={() => { commit((s) => { const [x] = s.scenes.splice(sceneIdx, 1); s.scenes.splice(sceneIdx - 1, 0, x); }); onSelectScene(sceneIdx - 1); }}><ChevronUp className="h-3.5 w-3.5 -rotate-90" />Mover</Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-white/80 hover:bg-white/10" disabled={sceneIdx === spec.scenes.length - 1} onClick={() => { commit((s) => { const [x] = s.scenes.splice(sceneIdx, 1); s.scenes.splice(sceneIdx + 1, 0, x); }); onSelectScene(sceneIdx + 1); }}>Mover<ChevronDown className="h-3.5 w-3.5 -rotate-90" /></Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-white/60 hover:bg-white/10 hover:text-red-400" disabled={spec.scenes.length === 1} onClick={() => { commit((s) => { s.scenes.splice(sceneIdx, 1); }); onSelectScene(Math.max(0, sceneIdx - 1)); }}><Trash2 className="h-3.5 w-3.5" />Cena</Button>
        <span className="ml-auto flex items-center gap-2">Zoom<input type="range" min={40} max={300} value={pps} onChange={(e) => onZoom(Number(e.target.value))} className="w-28 accent-[#ff7300]" /></span>
      </div>

      <div ref={laneRef} className="relative min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: width + LABEL }}>
          {/* Régua */}
          <div className="sticky top-0 z-20 flex h-7 border-b border-white/10 bg-[#17161b]">
            <div className="sticky left-0 z-10 shrink-0 bg-[#17161b]" style={{ width: LABEL }} />
            <div className="relative flex-1 cursor-col-resize touch-none" onPointerDown={seekDrag}>
              {ticks.map((x) => <span key={x} className="absolute top-0 h-full border-l border-white/15 pl-1 text-[10px] text-white/40" style={{ left: x * pps }}>{Number.isInteger(x) ? `${x}s` : ""}</span>)}
            </div>
          </div>

          {/* Cenas */}
          <div className="flex h-12 border-b border-white/10">
            <div className="sticky left-0 z-10 flex shrink-0 items-center bg-[#17161b] px-3 text-[11px] font-semibold uppercase tracking-wide text-white/50" style={{ width: LABEL }}>Cenas</div>
            <div className="relative flex-1">
              {spec.scenes.map((sc, i) => (
                <div key={i} onPointerDown={(e) => { e.stopPropagation(); onSelectScene(i); onSeek(starts[i] + 0.01); }}
                  className={cn("absolute top-1.5 flex h-9 items-center overflow-hidden rounded-md border px-2 text-xs", i === sceneIdx ? "border-[#ff7300] bg-[#5a16a8]" : "border-white/10 bg-[#3d0b80]/70 hover:bg-[#3d0b80]")}
                  style={{ left: starts[i] * pps + 1, width: sc.duration * pps - 2 }}>
                  <span className="truncate">{i + 1}. {sc.name || "cena"} · {sc.duration.toFixed(1)}s</span>
                  <span title="Arraste para mudar a duração" className="absolute right-0 top-0 h-full w-2 cursor-ew-resize touch-none bg-white/20 hover:bg-[#ff7300] [@media(pointer:coarse)]:w-4"
                    onPointerDown={(e) => { const d0 = sc.duration; startDrag(e, (dt) => live((s) => { s.scenes[i].duration = Math.max(0.5, round(d0 + dt)); })); }} />
                </div>
              ))}
            </div>
          </div>

          {/* Elementos da cena selecionada */}
          {rows.map(({ l, k }) => {
            const { start, end } = span(l, scene.duration);
            const inDur = l.in ? Math.min(l.in.dur, end - start) : 0;
            const outDur = l.out ? Math.min(l.out.dur, end - start) : 0;
            const icon = anePhotoOf(l.svg) ? <UserRound className="h-3.5 w-3.5" /> : l.svg.includes("<text") ? <Type className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />;
            const selected = layerIdx === k;
            const label = l.name || readTexts(l.svg)[0] || `elemento ${k + 1}`;
            const setStart = (v: number) => live((s) => {
              const L = s.scenes[sceneIdx].layers[k], d = s.scenes[sceneIdx].duration;
              const e2 = span(L, d).end;
              const ns = Math.max(0, Math.min(e2 - 0.2, round(v)));
              const shift = ns - (L.in?.at ?? 0);
              if (L.in) L.in.at = ns; else if (ns > 0) L.in = { preset: "fade", at: ns, dur: 0.4, ease: "out" };
              if (L.counter) L.counter.at = Math.max(0, L.counter.at + shift);
              if (L.typewriter) L.typewriter.at = Math.max(0, L.typewriter.at + shift);
              if (L.loop) L.loop.from = Math.max(0, L.loop.from + shift);
            });
            const setEnd = (v: number) => live((s) => {
              const L = s.scenes[sceneIdx].layers[k], d = s.scenes[sceneIdx].duration;
              const ne = Math.min(d, Math.max(span(L, d).start + 0.2, round(v)));
              if (ne >= d - 0.04) { if (L.out) L.out.at = 0; return; }
              const od = L.out?.dur ?? 0.3;
              L.out = { preset: L.out?.preset ?? "fade", ease: L.out?.ease ?? "out", dur: od, at: Math.max(0.01, ne - od) };
            });
            return (
              <div key={k} className={cn("flex h-10 border-b border-white/5", selected && "bg-white/[0.04]")}>
                <div onClick={() => onSelectLayer(sceneIdx, k)} className={cn("sticky left-0 z-10 flex shrink-0 cursor-pointer items-center gap-2 bg-[#17161b] px-3 text-xs", selected ? "text-white" : "text-white/60")} style={{ width: LABEL }}>
                  {icon}<span className="flex-1 truncate">{label}</span>
                  <button title={l.hidden ? "Mostrar" : "Esconder"} onClick={(e) => { e.stopPropagation(); commit((s) => { const L = s.scenes[sceneIdx].layers[k]; L.hidden = !L.hidden; }); }} className="text-white/40 hover:text-white">{l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                </div>
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 bg-black/30" style={{ left: 0, width: s0 * pps }} />
                  <div className="absolute inset-y-0 bg-black/30" style={{ left: (s0 + scene.duration) * pps, right: 0 }} />
                  <div onPointerDown={(e) => { onSelectLayer(sceneIdx, k); const st = start, en = end; startDrag(e, (dt) => { const len = en - st; const ns = Math.max(0, Math.min(scene.duration - len, st + dt)); setStart(ns); if (en < scene.duration - 0.04) setEnd(ns + len); }); }}
                    className={cn("absolute top-1.5 h-7 cursor-grab touch-none overflow-hidden rounded-md border text-[11px] active:cursor-grabbing", l.hidden && "opacity-40",
                      selected ? "border-[#ff7300] bg-[#ff7300]/30" : "border-white/15 bg-[#7c00ae]/45 hover:bg-[#7c00ae]/60")}
                    style={{ left: (s0 + start) * pps, width: Math.max(8, (end - start) * pps) }}>
                    {inDur > 0 && <span className="absolute inset-y-0 left-0 bg-white/15" style={{ width: inDur * pps }} />}
                    {outDur > 0 && <span className="absolute inset-y-0 right-0 bg-black/30" style={{ width: outDur * pps }} />}
                    <span className="relative truncate px-2 leading-7">{l.in ? PRESETS.find((p) => p[0] === l.in!.preset)?.[1] : ""}{l.loop ? ` · ${LOOPS.find((p) => p[0] === l.loop!.kind)?.[1]}` : ""}</span>
                    <span title="Quando entra" className="absolute left-0 top-0 h-full w-2 cursor-ew-resize touch-none bg-white/25 hover:bg-[#ff7300] [@media(pointer:coarse)]:w-4" onPointerDown={(e) => { onSelectLayer(sceneIdx, k); startDrag(e, (dt) => setStart(start + dt)); }} />
                    <span title="Quando sai" className="absolute right-0 top-0 h-full w-2 cursor-ew-resize touch-none bg-white/25 hover:bg-[#ff7300] [@media(pointer:coarse)]:w-4" onPointerDown={(e) => { onSelectLayer(sceneIdx, k); startDrag(e, (dt) => setEnd(end + dt)); }} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Cursor de tempo */}
          <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-[#ff7300]" style={{ left: LABEL + t * pps }}>
            <span className="absolute -left-1.5 top-0 h-3 w-3 rotate-45 bg-[#ff7300]" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Propriedades do elemento ─────────────────────────────────────────────────

function LayerProps({ layer, sceneDur, photos, W, onChange, onDuplicate, onDelete, onOrder }: {
  layer: Layer; sceneDur: number; photos: AnePhoto[]; W: number;
  onChange: (fn: (l: Layer) => void) => void; onDuplicate: () => void; onDelete: () => void; onOrder: (d: number) => void;
}) {
  const texts = readTexts(layer.svg);
  const colors = colorsOf(layer.svg);
  const photo = anePhotoOf(layer.svg);
  const { start, end } = span(layer, sceneDur);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Input value={layer.name ?? ""} placeholder="nome do elemento" onChange={(e) => onChange((l) => { l.name = e.target.value; })} className="h-8 flex-1 border-white/10 bg-white/5 text-sm font-medium" />
        <IconBtn title="Para frente" onClick={() => onOrder(1)}><ChevronUp className="h-4 w-4" /></IconBtn>
        <IconBtn title="Para trás" onClick={() => onOrder(-1)}><ChevronDown className="h-4 w-4" /></IconBtn>
        <IconBtn title="Duplicar" onClick={onDuplicate}><Copy className="h-4 w-4" /></IconBtn>
        <IconBtn title="Excluir (Delete)" onClick={onDelete} danger><Trash2 className="h-4 w-4" /></IconBtn>
      </div>

      {(texts.some((x) => x.length > 1 && !x.includes("{{")) || layer.typewriter || layer.counter) && (
        <Section title="Texto">
          {texts.map((tx, i) => (tx.includes("{{") || tx.length < 2) ? null : (
            <Input key={i} value={tx} onChange={(e) => onChange((l) => { l.svg = writeText(l.svg, i, e.target.value); })} className="h-9 border-white/10 bg-white/5 text-sm" />
          ))}
          {layer.typewriter && <Field label="Texto que vai sendo digitado"><Input value={layer.typewriter.text} onChange={(e) => onChange((l) => { l.typewriter!.text = e.target.value; })} className="h-9 border-white/10 bg-white/5 text-sm" /></Field>}
          {layer.counter && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="De"><Num value={layer.counter.from} onChange={(v) => onChange((l) => { l.counter!.from = v; })} /></Field>
              <Field label="Até"><Num value={layer.counter.to} onChange={(v) => onChange((l) => { l.counter!.to = v; })} /></Field>
              <Field label="Em (s)"><Num value={layer.counter.dur} step={0.1} onChange={(v) => onChange((l) => { l.counter!.dur = Math.max(0.1, v); })} /></Field>
            </div>
          )}
        </Section>
      )}

      {photo && (
        <Section title="Foto da Ane">
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((p) => (
              <button key={p.id} onClick={() => onChange((l) => { l.svg = swapAne(l.svg, p, W); })} title={p.id + (p.rightOnly ? " (só na borda direita)" : "")}
                className={cn("overflow-hidden rounded-md border bg-gradient-to-b from-[#5a16a8] to-[#2e0a63]", p.id === photo ? "border-[#ff7300]" : "border-white/10 hover:border-white/40")}>
                <img src={`${ASSET_URL}/${p.id}.png`} alt="" className="aspect-square w-full object-cover object-top" />
              </button>
            ))}
          </div>
        </Section>
      )}

      {colors.length > 0 && (
        <Section title="Cores">
          {colors.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <input type="color" value={c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c} onChange={(e) => onChange((l) => { l.svg = replaceColor(l.svg, c, e.target.value); })} className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent" />
              <div className="flex flex-wrap gap-1">
                {COLORS.map((p) => <button key={p} title={p} onClick={() => onChange((l) => { l.svg = replaceColor(l.svg, c, p); })} className="h-5 w-5 rounded-full border border-white/20" style={{ background: p }} />)}
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section title="Posição e tamanho">
        <Field label={`Tamanho: ${Math.round((layer.scale ?? 1) * 100)}%`}><input type="range" min={0.2} max={3} step={0.01} value={layer.scale ?? 1} onChange={(e) => onChange((l) => { l.scale = Number(e.target.value); })} className="w-full accent-[#ff7300]" /></Field>
        <Field label={`Opacidade: ${Math.round((layer.opacity ?? 1) * 100)}%`}><input type="range" min={0} max={1} step={0.01} value={layer.opacity ?? 1} onChange={(e) => onChange((l) => { l.opacity = Number(e.target.value); })} className="w-full accent-[#ff7300]" /></Field>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label="X"><Num value={layer.offset?.[0] ?? 0} onChange={(v) => onChange((l) => { l.offset = [v, l.offset?.[1] ?? 0]; })} /></Field>
          <Field label="Y"><Num value={layer.offset?.[1] ?? 0} onChange={(v) => onChange((l) => { l.offset = [l.offset?.[0] ?? 0, v]; })} /></Field>
          <IconBtn title="Voltar à posição e tamanho originais" onClick={() => onChange((l) => { l.offset = undefined; l.scale = undefined; l.opacity = undefined; })}><RotateCcw className="h-4 w-4" /></IconBtn>
        </div>
      </Section>

      <Section title="Entrada">
        <Chips options={[["", "Nenhuma"], ...PRESETS]} value={layer.in?.preset ?? ""} onChange={(v) => onChange((l) => { l.in = v ? { preset: v, at: l.in?.at ?? 0, dur: l.in?.dur ?? 0.6, ease: l.in?.ease ?? (v === "pop" ? "back" : "out") } : undefined; })} />
        {layer.in && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Começa em (s)"><Num value={start} step={0.05} onChange={(v) => onChange((l) => { if (l.in) l.in.at = Math.max(0, Math.min(sceneDur - 0.1, v)); })} /></Field>
              <Field label="Duração (s)"><Num value={layer.in.dur} step={0.05} onChange={(v) => onChange((l) => { if (l.in) l.in.dur = Math.max(0.05, v); })} /></Field>
            </div>
            <Field label="Ritmo"><Chips options={EASES} value={layer.in.ease} onChange={(v) => onChange((l) => { if (l.in) l.in.ease = v; })} /></Field>
          </>
        )}
      </Section>

      <Section title="Saída">
        <Chips options={[["", "Fica até o fim"], ...PRESETS.filter(([k]) => !["rise", "wipe-right"].includes(k))]} value={layer.out?.preset ?? ""} onChange={(v) => onChange((l) => { l.out = v ? { preset: v, at: l.out?.at ?? 0, dur: l.out?.dur ?? 0.35, ease: l.out?.ease ?? "out" } : undefined; })} />
        {layer.out && <p className="text-[11px] text-white/40">Sai em {end.toFixed(2)}s da cena. Arraste a ponta direita da barra na linha do tempo para mudar.</p>}
      </Section>

      <Section title="Movimento contínuo">
        <Chips options={[["", "Nenhum"], ...LOOPS]} value={layer.loop?.kind ?? ""} onChange={(v) => onChange((l) => { l.loop = v ? { kind: v, period: l.loop?.period ?? 1.4, amount: l.loop?.amount ?? 0.05, from: l.loop?.from ?? ((l.in?.at ?? 0) + (l.in?.dur ?? 0)) } : undefined; })} />
        {layer.loop && (
          <>
            <Field label={`Velocidade: ${layer.loop.period.toFixed(1)}s por ciclo`}><input type="range" min={0.3} max={5} step={0.1} value={layer.loop.period} onChange={(e) => onChange((l) => { if (l.loop) l.loop.period = Number(e.target.value); })} className="w-full accent-[#ff7300]" /></Field>
            <Field label={`Intensidade: ${Math.round(layer.loop.amount * 100)}%`}><input type="range" min={0.01} max={0.3} step={0.01} value={layer.loop.amount} onChange={(e) => onChange((l) => { if (l.loop) l.loop.amount = Number(e.target.value); })} className="w-full accent-[#ff7300]" /></Field>
          </>
        )}
      </Section>
    </div>
  );
}

// ─── Peças de interface ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{title}</p>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-[11px] text-white/60">{label}{children}</label>;
}
function Num({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return <Input type="number" step={step} value={Number(value.toFixed(2))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} className="h-8 border-white/10 bg-white/5 text-xs" />;
}
function Chips({ options, value, onChange }: { options: ReadonlyArray<readonly [string, string]>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={cn("rounded-full border px-2.5 py-1 text-[11px]", value === k ? "border-[#ff7300] bg-[#ff7300] text-white" : "border-white/10 bg-white/5 text-white/70 hover:border-white/30")}>{label}</button>
      ))}
    </div>
  );
}
function IconBtn({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return <button title={title} onClick={onClick} className={cn("flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/70 hover:text-white", danger && "hover:text-red-400")}>{children}</button>;
}

function CodeDialog({ spec, onClose, onApply }: { spec: Spec; onClose: () => void; onApply: (s: Spec) => void }) {
  const [text, setText] = useState(() => JSON.stringify(spec, null, 2));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 rounded-xl border border-white/10 bg-[#1b1a20] p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold">Roteiro em código (avançado)</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="min-h-[60vh] flex-1 rounded-md border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-white/90" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="text-white/80 hover:bg-white/10" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { try { onApply(JSON.parse(text)); } catch { toast.error("O código tem um erro de JSON."); } }}>Aplicar</Button>
        </div>
      </div>
    </div>
  );
}
