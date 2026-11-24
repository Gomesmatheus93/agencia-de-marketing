import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Code2, Copy, Eye, Layers, Loader2, Play, Plus, Trash2, Type, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Editor visual do roteiro de motion: cenas, textos, foto da Ane, animações e
// música, sem mexer em JSON (o JSON continua disponível no modo avançado).

type Anim = { preset: string; at: number; dur: number; ease: string; distance?: number };
type Layer = {
  name?: string; svg: string; origin?: [number, number]; in?: Anim; out?: Anim;
  loop?: { kind: string; period: number; amount: number; from: number };
  counter?: { from: number; to: number; at: number; dur: number; decimals: number; ease: string };
  typewriter?: { text: string; at: number; cps: number };
};
type Scene = { name?: string; duration: number; transition: string; background?: string; layers: Layer[] };
type Spec = { format: string; fps: number; music?: string | null; musicVolume: number; background?: string; scenes: Scene[] };

const PRESET_LABEL: Record<string, string> = {
  fade: "Aparecer", "slide-up": "Subir", "slide-down": "Descer", "slide-left": "Entrar pela direita", "slide-right": "Entrar pela esquerda",
  pop: "Crescer (pop)", "zoom-in": "Zoom de perto", "zoom-out": "Zoom de longe", "wipe-right": "Revelar", rise: "Subir de baixo", "spin-in": "Girar",
};
const LOOP_LABEL: Record<string, string> = { pulse: "Respirar", float: "Flutuar", wiggle: "Balançar", glow: "Piscar leve", spin: "Girar sem parar" };
const EASE_LABEL: Record<string, string> = { linear: "Constante", out: "Suave", "in-out": "Suave nos dois lados", back: "Com impulso", elastic: "Elástico" };
const TRANSITION_LABEL: Record<string, string> = { fade: "Esmaecer", cut: "Corte seco", "slide-left": "Deslizar", zoom: "Zoom" };
const sel = "h-8 w-full rounded-md border bg-background px-2 text-xs";

// ─── Textos e fotos dentro do SVG da camada ────────────────────────────────────
const SVG_NS = "http://www.w3.org/2000/svg";
function parseFragment(svg: string) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink">${svg}</svg>`, "image/svg+xml");
  return doc.querySelector("parsererror") ? null : doc.documentElement;
}
function serialize(root: Element) {
  const s = new XMLSerializer();
  return Array.from(root.childNodes).map((n) => s.serializeToString(n)).join("").replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
}
/** Uma linha por <text> (os <tspan> de destaque ficam juntos na mesma linha). */
function textLines(root: Element) {
  return Array.from(root.querySelectorAll("text"));
}
function readTexts(svg: string) {
  const root = parseFragment(svg);
  return root ? textLines(root).map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()) : [];
}
/**
 * Troca o texto de uma linha. Com destaques (<tspan>), as palavras são
 * redistribuídas na ordem: cada trecho mantém o peso e a cor; o último recebe o resto.
 */
function writeText(svg: string, index: number, value: string) {
  const root = parseFragment(svg);
  if (!root) return svg;
  const el = textLines(root)[index];
  if (!el) return svg;
  const spans = Array.from(el.querySelectorAll("tspan"));
  if (!spans.length) { el.textContent = value; return serialize(root); }
  const words = value.split(/\s+/).filter(Boolean);
  const counts = spans.map((sp) => Math.max(1, (sp.textContent ?? "").trim().split(/\s+/).filter(Boolean).length));
  let w = 0;
  spans.forEach((sp, i) => {
    const take = i === spans.length - 1 ? words.length - w : Math.min(counts[i], Math.max(0, words.length - w - (spans.length - 1 - i)));
    const part = words.slice(w, w + Math.max(0, take)).join(" ");
    w += Math.max(0, take);
    sp.textContent = part ? (i > 0 ? ` ${part}` : part) : "";
  });
  return serialize(root);
}
function anePhotoOf(svg: string) {
  return svg.match(/href="alle:(ane[a-z0-9-]*)"/)?.[1] ?? null;
}
/** Troca a foto da Ane mantendo a altura e o encaixe (borda direita ou centro). */
function swapAne(svg: string, photo: { id: string; w: number; h: number; rightOnly: boolean }, W: number) {
  const root = parseFragment(svg);
  if (!root) return svg;
  const img = Array.from(root.querySelectorAll("image")).find((el) => (el.getAttribute("href") ?? "").startsWith("alle:ane"));
  if (!img) return svg;
  const x = Number(img.getAttribute("x")), w = Number(img.getAttribute("width")), h = Number(img.getAttribute("height"));
  const nw = Math.round(h * photo.w / photo.h);
  const rightAnchored = x + w >= W - 60;
  const nx = rightAnchored || photo.rightOnly ? W - nw + (photo.rightOnly ? 36 : x + w - W) : Math.round(x + w / 2 - nw / 2);
  img.setAttribute("href", `alle:${photo.id}`);
  img.setAttribute("width", String(nw));
  img.setAttribute("x", String(nx));
  return serialize(root);
}

export function MotionEditor({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => void }) {
  const q = trpc.motion.get.useQuery({ id }, { refetchOnWindowFocus: false });
  const options = trpc.motion.options.useQuery();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [mode, setMode] = useState<"visual" | "json">("visual");
  const [json, setJson] = useState("");
  const [sceneIdx, setSceneIdx] = useState(0);
  const [t, setT] = useState(0);
  const [frame, setFrame] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data && !spec) { setSpec(q.data.spec as unknown as Spec); setTitle(q.data.title); setCaption(q.data.caption ?? ""); }
  }, [q.data, spec]);

  const fmt = options.data?.formats.find((f) => f.id === spec?.format);
  const W = fmt?.width ?? 1080, H = fmt?.height ?? 1920;
  const total = spec?.scenes.reduce((a, s) => a + s.duration, 0) ?? 0;
  const sceneStart = useMemo(() => spec?.scenes.slice(0, sceneIdx).reduce((a, s) => a + s.duration, 0) ?? 0, [spec, sceneIdx]);
  const scene = spec?.scenes[sceneIdx];

  const preview = trpc.motion.previewFrame.useMutation({ onSuccess: (r) => setFrame(r.dataUrl), onError: (e) => toast.error(e.message) });
  const save = trpc.motion.update.useMutation({ onSuccess: () => { toast.success("Salvo. Renderizando o vídeo de novo…"); onSaved(); onClose(); }, onError: (e) => toast.error(e.message) });
  const saveMeta = trpc.motion.update.useMutation({ onSuccess: () => { toast.success("Título e legenda salvos"); onSaved(); }, onError: (e) => toast.error(e.message) });

  const update = (fn: (s: Spec) => void) => setSpec((cur) => { if (!cur) return cur; const next = structuredClone(cur); fn(next); setDirty(true); return next; });
  const updateLayer = (k: number, fn: (l: Layer) => void) => update((s) => fn(s.scenes[sceneIdx].layers[k]));
  const showAt = (time: number) => { if (!spec) return; const tt = Math.max(0, Math.min(total - 0.05, time)); setT(tt); preview.mutate({ spec, t: tt }); };
  const currentSpec = () => (mode === "json" ? json : spec);

  const toJson = () => { if (spec) setJson(JSON.stringify(spec, null, 2)); setMode("json"); };
  const toVisual = () => {
    try { setSpec(JSON.parse(json)); setMode("visual"); setSceneIdx(0); } catch { toast.error("O JSON tem um erro. Corrija antes de voltar ao editor visual."); }
  };

  if (!spec) return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent><Loader2 className="mx-auto h-6 w-6 animate-spin" /></DialogContent></Dialog>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o && (!dirty || confirm("Sair sem salvar as mudanças?"))) onClose(); }}>
      <DialogContent className="max-h-[95vh] w-[96vw] max-w-[1400px] overflow-y-auto sm:max-w-[1400px]">
        <DialogHeader><DialogTitle>Editar vídeo</DialogTitle></DialogHeader>

        <div className="grid gap-3 md:grid-cols-[1fr_260px_160px_auto] md:items-end">
          <label className="space-y-1 text-xs font-medium">Título<Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} /></label>
          <label className="space-y-1 text-xs font-medium">Música
            <select value={spec.music ?? ""} onChange={(e) => update((s) => { s.music = e.target.value || null; })} className={sel + " h-9"}>
              <option value="">Sem música</option>{options.data?.music.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">Volume {Math.round(spec.musicVolume * 100)}%
            <input type="range" min={0} max={1} step={0.05} value={spec.musicVolume} onChange={(e) => update((s) => { s.musicVolume = Number(e.target.value); })} className="w-full" />
          </label>
          <div className="flex rounded-lg border p-0.5">
            <button className={cn("rounded-md px-3 py-1.5 text-xs font-medium", mode === "visual" && "bg-primary text-primary-foreground")} onClick={() => mode === "json" && toVisual()}><Layers className="mr-1 inline h-3.5 w-3.5" />Visual</button>
            <button className={cn("rounded-md px-3 py-1.5 text-xs font-medium", mode === "json" && "bg-primary text-primary-foreground")} onClick={() => mode === "visual" && toJson()}><Code2 className="mr-1 inline h-3.5 w-3.5" />JSON</button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[230px_1fr_300px]">
          {/* Cenas */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cenas · {total.toFixed(1)}s</p>
            {mode === "visual" && spec.scenes.map((s, i) => (
              <button key={i} type="button" onClick={() => { setSceneIdx(i); showAt(spec.scenes.slice(0, i).reduce((a, x) => a + x.duration, 0) + s.duration - 0.4); }}
                className={cn("w-full rounded-lg border px-3 py-2 text-left text-sm", i === sceneIdx ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                <span className="font-medium">{i + 1}. {s.name || "cena"}</span>
                <span className="block text-[11px] text-muted-foreground">{s.duration}s · {s.layers.length} elementos · {TRANSITION_LABEL[s.transition] ?? s.transition}</span>
              </button>
            ))}
            {mode === "visual" && scene && (
              <div className="space-y-2 rounded-lg border p-2.5">
                <label className="block space-y-1 text-[11px] font-medium">Nome<Input className="h-8 text-xs" value={scene.name ?? ""} onChange={(e) => update((s) => { s.scenes[sceneIdx].name = e.target.value; })} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-[11px] font-medium">Duração (s)<Input className="h-8 text-xs" type="number" step={0.1} min={0.3} max={20} value={scene.duration} onChange={(e) => update((s) => { s.scenes[sceneIdx].duration = Math.max(0.3, Number(e.target.value) || 0.3); })} /></label>
                  <label className="space-y-1 text-[11px] font-medium">Passagem<select className={sel} value={scene.transition} onChange={(e) => update((s) => { s.scenes[sceneIdx].transition = e.target.value; })}>{Object.entries(TRANSITION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2" title="Subir" disabled={sceneIdx === 0} onClick={() => { update((s) => { const [x] = s.scenes.splice(sceneIdx, 1); s.scenes.splice(sceneIdx - 1, 0, x); }); setSceneIdx(sceneIdx - 1); }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" title="Descer" disabled={sceneIdx === spec.scenes.length - 1} onClick={() => { update((s) => { const [x] = s.scenes.splice(sceneIdx, 1); s.scenes.splice(sceneIdx + 1, 0, x); }); setSceneIdx(sceneIdx + 1); }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" title="Duplicar cena" onClick={() => { update((s) => { s.scenes.splice(sceneIdx + 1, 0, structuredClone(s.scenes[sceneIdx])); }); setSceneIdx(sceneIdx + 1); }}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-muted-foreground hover:text-red-600" title="Excluir cena" disabled={spec.scenes.length === 1} onClick={() => { update((s) => { s.scenes.splice(sceneIdx, 1); }); setSceneIdx(Math.max(0, sceneIdx - 1)); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
          </div>

          {/* Elementos da cena (ou JSON) */}
          <div className="space-y-2">
            {mode === "json" ? (
              <label className="block space-y-1 text-xs font-medium">Roteiro JSON (avançado)
                <Textarea value={json} onChange={(e) => { setJson(e.target.value); setDirty(true); }} rows={28} spellCheck={false} className="font-mono text-[11px] leading-snug" />
              </label>
            ) : scene && (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elementos da cena {sceneIdx + 1} <span className="font-normal normal-case">(o primeiro fica atrás)</span></p>
                {scene.layers.map((l, k) => (
                  <LayerCard key={`${sceneIdx}-${k}`} layer={l} index={k} count={scene.layers.length} sceneDur={scene.duration} W={W}
                    photos={options.data?.photos ?? []} presets={(options.data?.presets ?? []) as string[]} loops={(options.data?.loops ?? []) as string[]} eases={(options.data?.eases ?? []) as string[]}
                    onChange={(fn) => updateLayer(k, fn)}
                    onMove={(d) => update((s) => { const ls = s.scenes[sceneIdx].layers; const [x] = ls.splice(k, 1); ls.splice(k + d, 0, x); })}
                    onRemove={() => update((s) => { s.scenes[sceneIdx].layers.splice(k, 1); })}
                    onDuplicate={() => update((s) => { s.scenes[sceneIdx].layers.splice(k + 1, 0, structuredClone(s.scenes[sceneIdx].layers[k])); })}
                    onPreview={() => showAt(sceneStart + Math.min(scene.duration - 0.05, (l.in?.at ?? 0) + (l.in?.dur ?? 0) + 0.1))} />
                ))}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => update((s) => {
                  s.scenes[sceneIdx].layers.push({ name: "texto novo", svg: `<text x="${W / 2}" y="${Math.round(H / 2)}" font-family="Montserrat" font-size="72" font-weight="800" fill="#FFFFFF" text-anchor="middle">Texto novo</text>`, in: { preset: "fade", at: 0.3, dur: 0.5, ease: "out" } });
                })}><Plus className="h-3.5 w-3.5" />Adicionar texto</Button>
              </>
            )}
          </div>

          {/* Prévia */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia do quadro</p>
            <div className="overflow-hidden rounded-lg border bg-black">
              {frame ? <img src={frame} alt="" className="w-full" /> : <div className="flex items-center justify-center p-8 text-center text-xs text-white/60" style={{ aspectRatio: `${W}/${H}` }}>Clique numa cena ou em "ver" num elemento</div>}
            </div>
            <input type="range" min={0} max={Math.max(0.1, total - 0.05)} step={0.05} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t.toFixed(2)}s de {total.toFixed(1)}s</span>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={preview.isPending} onClick={() => preview.mutate({ spec: currentSpec(), t })}>
                {preview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}Ver quadro
              </Button>
            </div>
            <label className="block space-y-1 pt-2 text-xs font-medium">Legenda do post
              <Textarea value={caption} onChange={(e) => { setCaption(e.target.value); setDirty(true); }} rows={5} />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => saveMeta.mutate({ id, title, caption: caption || null })} disabled={saveMeta.isPending}>Salvar só título e legenda</Button>
          <Button className="gap-2" disabled={save.isPending} onClick={() => save.mutate({ id, title, caption: caption || null, spec: currentSpec() })}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Salvar e renderizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LayerCard({ layer, index, count, sceneDur, W, photos, presets, loops, eases, onChange, onMove, onRemove, onDuplicate, onPreview }: {
  layer: Layer; index: number; count: number; sceneDur: number; W: number;
  photos: Array<{ id: string; w: number; h: number; rightOnly: boolean }>; presets: string[]; loops: string[]; eases: string[];
  onChange: (fn: (l: Layer) => void) => void; onMove: (d: number) => void; onRemove: () => void; onDuplicate: () => void; onPreview: () => void;
}) {
  const texts = readTexts(layer.svg);
  const photo = anePhotoOf(layer.svg);
  const num = (v: string, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        {photo ? <UserRound className="h-4 w-4 text-primary" /> : <Type className="h-4 w-4 text-primary" />}
        <Input className="h-7 flex-1 text-xs font-medium" value={layer.name ?? ""} placeholder={`elemento ${index + 1}`} onChange={(e) => onChange((l) => { l.name = e.target.value; })} />
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Ver na prévia" onClick={onPreview}><Eye className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Mais para trás" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Mais para frente" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Duplicar" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-muted-foreground hover:text-red-600" title="Excluir" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>

      {texts.map((tx, i) => (tx.includes("{{t}}") || tx.includes("{{n}}") || tx.length < 2) ? null : (
        <Input key={i} className="h-8 text-sm" value={tx} onChange={(e) => onChange((l) => { l.svg = writeText(l.svg, i, e.target.value); })} />
      ))}
      {layer.typewriter && (
        <label className="block space-y-1 text-[11px] font-medium">Texto digitado
          <Input className="h-8 text-sm" value={layer.typewriter.text} onChange={(e) => onChange((l) => { l.typewriter!.text = e.target.value; })} />
        </label>
      )}
      {layer.counter && (
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-[11px] font-medium">Contar de<Input className="h-8 text-xs" type="number" value={layer.counter.from} onChange={(e) => onChange((l) => { l.counter!.from = num(e.target.value); })} /></label>
          <label className="space-y-1 text-[11px] font-medium">Até<Input className="h-8 text-xs" type="number" value={layer.counter.to} onChange={(e) => onChange((l) => { l.counter!.to = num(e.target.value); })} /></label>
          <label className="space-y-1 text-[11px] font-medium">Duração (s)<Input className="h-8 text-xs" type="number" step={0.1} value={layer.counter.dur} onChange={(e) => onChange((l) => { l.counter!.dur = Math.max(0.1, num(e.target.value, 1)); })} /></label>
        </div>
      )}
      {photo && (
        <label className="block space-y-1 text-[11px] font-medium">Foto da Ane
          <select className={sel} value={photo} onChange={(e) => { const p = photos.find((x) => x.id === e.target.value); if (p) onChange((l) => { l.svg = swapAne(l.svg, p, W); }); }}>
            {!photos.some((p) => p.id === photo) && <option value={photo}>{photo}</option>}
            {photos.map((p) => <option key={p.id} value={p.id}>{p.id}{p.rightOnly ? " (só na borda direita)" : ""}</option>)}
          </select>
        </label>
      )}

      <div className="grid grid-cols-[1.4fr_1fr_0.8fr_0.8fr] gap-2">
        <label className="space-y-1 text-[11px] font-medium">Entrada
          <select className={sel} value={layer.in?.preset ?? ""} onChange={(e) => onChange((l) => { l.in = e.target.value ? { preset: e.target.value, at: l.in?.at ?? 0, dur: l.in?.dur ?? 0.6, ease: l.in?.ease ?? "out" } : undefined; })}>
            <option value="">Sem animação (já aparece)</option>{presets.map((p) => <option key={p} value={p}>{PRESET_LABEL[p] ?? p}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-medium">Ritmo
          <select className={sel} value={layer.in?.ease ?? "out"} disabled={!layer.in} onChange={(e) => onChange((l) => { if (l.in) l.in.ease = e.target.value; })}>{eases.map((x) => <option key={x} value={x}>{EASE_LABEL[x] ?? x}</option>)}</select>
        </label>
        <label className="space-y-1 text-[11px] font-medium">Começa (s)<Input className="h-8 text-xs" type="number" step={0.05} min={0} max={sceneDur} disabled={!layer.in} value={layer.in?.at ?? 0} onChange={(e) => onChange((l) => { if (l.in) l.in.at = Math.max(0, num(e.target.value)); })} /></label>
        <label className="space-y-1 text-[11px] font-medium">Dura (s)<Input className="h-8 text-xs" type="number" step={0.05} min={0.05} disabled={!layer.in} value={layer.in?.dur ?? 0.6} onChange={(e) => onChange((l) => { if (l.in) l.in.dur = Math.max(0.05, num(e.target.value, 0.6)); })} /></label>
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        <label className="space-y-1 text-[11px] font-medium">Movimento contínuo
          <select className={sel} value={layer.loop?.kind ?? ""} onChange={(e) => onChange((l) => { l.loop = e.target.value ? { kind: e.target.value, period: l.loop?.period ?? 1.4, amount: l.loop?.amount ?? 0.05, from: l.loop?.from ?? ((l.in?.at ?? 0) + (l.in?.dur ?? 0)) } : undefined; })}>
            <option value="">Nenhum</option>{loops.map((p) => <option key={p} value={p}>{LOOP_LABEL[p] ?? p}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-medium">Velocidade (s)<Input className="h-8 text-xs" type="number" step={0.1} min={0.2} disabled={!layer.loop} value={layer.loop?.period ?? 1.4} onChange={(e) => onChange((l) => { if (l.loop) l.loop.period = Math.max(0.2, num(e.target.value, 1.4)); })} /></label>
        <label className="space-y-1 text-[11px] font-medium">Intensidade<Input className="h-8 text-xs" type="number" step={0.01} min={0} max={1} disabled={!layer.loop} value={layer.loop?.amount ?? 0.05} onChange={(e) => onChange((l) => { if (l.loop) l.loop.amount = Math.min(1, Math.max(0, num(e.target.value, 0.05))); })} /></label>
      </div>
    </div>
  );
}
