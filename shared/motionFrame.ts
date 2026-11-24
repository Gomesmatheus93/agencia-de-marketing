// Montagem de um quadro de motion (SVG) a partir do roteiro, no instante t.
// Compartilhado: o servidor usa para gerar o MP4 (resvg) e o editor usa para a
// prévia ao vivo no navegador, então o que se vê no editor é o que sai no vídeo.

export type MotionAnimLike = { preset: string; at: number; dur: number; ease: string; distance?: number };
export type MotionLayerLike = {
  name?: string; svg: string; origin?: [number, number];
  /** Deslocamento fixo (px) e tamanho (1 = original) definidos no editor. */
  offset?: [number, number]; scale?: number; opacity?: number; hidden?: boolean;
  in?: MotionAnimLike; out?: MotionAnimLike;
  loop?: { kind: string; period: number; amount: number; from: number };
  counter?: { from: number; to: number; at: number; dur: number; decimals: number; ease: string };
  typewriter?: { text: string; at: number; cps: number };
};
export type PreparedScene = { duration: number; transition: string; bg: string; layers: Array<{ layer: MotionLayerLike; svg: string }> };

export const MOTION_TRANSITION = 0.35; // segundos de passagem entre cenas

export const EASE: Record<string, (x: number) => number> = {
  linear: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  "in-out": (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  elastic: (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
const ease = (name: string) => EASE[name] ?? EASE.out;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r2 = (n: number) => Math.round(n * 100) / 100;

type State = { opacity: number; tx: number; ty: number; scale: number; rotate: number; wipe: number | null };

function presetState(preset: string, p: number, distance: number | undefined, W: number, H: number): Partial<State> {
  const d = distance ?? 140;
  switch (preset) {
    case "fade": return { opacity: p };
    case "slide-up": return { opacity: clamp01(p * 1.6), ty: (1 - p) * d };
    case "slide-down": return { opacity: clamp01(p * 1.6), ty: -(1 - p) * d };
    case "slide-left": return { opacity: clamp01(p * 1.6), tx: (1 - p) * (distance ?? W * 0.6) };
    case "slide-right": return { opacity: clamp01(p * 1.6), tx: -(1 - p) * (distance ?? W * 0.6) };
    case "rise": return { ty: (1 - p) * (distance ?? H * 0.5) };
    case "pop": return { opacity: clamp01(p * 3), scale: p };
    case "zoom-in": return { opacity: p, scale: (distance ?? 0.6) + (1 - (distance ?? 0.6)) * p };
    case "zoom-out": return { opacity: p, scale: 1 + ((distance ?? 1.4) - 1) * (1 - p) };
    case "spin-in": return { opacity: p, scale: 0.4 + 0.6 * p, rotate: -(1 - p) * 90 };
    case "wipe-right": return { wipe: p };
    default: return {};
  }
}

/** Fim efetivo da saída de uma camada (segundos dentro da cena). */
export function layerOutStart(layer: MotionLayerLike, sceneDur: number) {
  return layer.out ? (layer.out.at || Math.max(0, sceneDur - layer.out.dur)) : sceneDur;
}

export function layerState(layer: MotionLayerLike, t: number, sceneDur: number, W: number, H: number): State {
  const s: State = { opacity: 1, tx: 0, ty: 0, scale: 1, rotate: 0, wipe: null };
  const apply = (part: Partial<State>) => {
    if (part.opacity !== undefined) s.opacity *= part.opacity;
    s.tx += part.tx ?? 0; s.ty += part.ty ?? 0;
    if (part.scale !== undefined) s.scale *= part.scale;
    s.rotate += part.rotate ?? 0;
    if (part.wipe !== undefined && part.wipe !== null) s.wipe = Math.min(s.wipe ?? 1, part.wipe);
  };
  if (layer.in) {
    const a = layer.in;
    if (t < a.at) return { ...s, opacity: 0 };
    apply(presetState(a.preset, ease(a.ease)(clamp01((t - a.at) / a.dur)), a.distance, W, H));
  }
  if (layer.out) {
    const a = layer.out, start = layerOutStart(layer, sceneDur);
    if (t >= start + a.dur) return { ...s, opacity: 0 };
    if (t >= start) apply(presetState(a.preset, 1 - ease(a.ease)(clamp01((t - start) / a.dur)), a.distance, W, H));
  }
  if (layer.loop && t >= layer.loop.from) {
    const ph = ((t - layer.loop.from) / layer.loop.period) * 2 * Math.PI, k = layer.loop.amount;
    if (layer.loop.kind === "pulse") s.scale *= 1 + k * (0.5 - 0.5 * Math.cos(ph));
    if (layer.loop.kind === "float") s.ty += Math.sin(ph) * k * 200;
    if (layer.loop.kind === "wiggle") s.rotate += Math.sin(ph) * k * 60;
    if (layer.loop.kind === "glow") s.opacity *= 1 - k * (0.5 - 0.5 * Math.cos(ph)) * 4;
    if (layer.loop.kind === "spin") s.rotate += ((t - layer.loop.from) / layer.loop.period) * 360;
  }
  s.opacity *= layer.opacity ?? 1;
  return s;
}

export function fillText(layer: MotionLayerLike, svg: string, t: number) {
  let out = svg;
  if (layer.counter) {
    const c = layer.counter;
    const n = c.from + (c.to - c.from) * ease(c.ease)(clamp01((t - c.at) / c.dur));
    out = out.split("{{n}}").join(n.toLocaleString("pt-BR", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }));
  }
  if (layer.typewriter) {
    const tw = layer.typewriter;
    const shown = Math.max(0, Math.min(tw.text.length, Math.floor((t - tw.at) * tw.cps)));
    out = out.split("{{t}}").join(tw.text.slice(0, shown).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  }
  return out;
}

/** Em qual cena está o instante t (e o tempo dentro dela). */
export function sceneAt(scenes: Array<{ duration: number }>, t: number) {
  let i = 0, start = 0;
  while (i < scenes.length - 1 && t >= start + scenes[i].duration) { start += scenes[i].duration; i++; }
  return { index: i, start, local: t - start };
}

/**
 * SVG completo do quadro. Com "tag", cada camada ganha data-layer="índice"
 * (o editor usa para clicar e arrastar elementos na prévia).
 */
export function composeFrame(scenes: PreparedScene[], t: number, W: number, H: number, opts: { tag?: boolean } = {}): string {
  const { index: i, local: lt } = sceneAt(scenes, t);
  const sc = scenes[i];
  const T = MOTION_TRANSITION;
  const prev = i > 0 ? scenes[i - 1].transition : "cut";
  let sceneOp = 1, sceneT = "";
  if (prev !== "cut" && lt < T) {
    const p = EASE.out(lt / T);
    sceneOp = p;
    if (prev === "slide-left") sceneT = `translate(${r2((1 - p) * W * 0.25)} 0)`;
    if (prev === "zoom") sceneT = `translate(${W / 2} ${H / 2}) scale(${r2(1.12 - 0.12 * p)}) translate(${-W / 2} ${-H / 2})`;
  }
  if (sc.transition !== "cut" && i < scenes.length - 1 && lt > sc.duration - T) {
    const p = EASE["in-out"]((lt - (sc.duration - T)) / T);
    sceneOp *= 1 - p;
    if (sc.transition === "slide-left") sceneT = `translate(${r2(-p * W * 0.25)} 0)`;
    if (sc.transition === "zoom") sceneT = `translate(${W / 2} ${H / 2}) scale(${r2(1 + 0.12 * p)}) translate(${-W / 2} ${-H / 2})`;
  }
  const clips: string[] = [];
  const body = sc.layers.map(({ layer, svg }, k) => {
    if (layer.hidden) return "";
    const s = layerState(layer, lt, sc.duration, W, H);
    if (s.opacity <= 0.001) return "";
    const [ox, oy] = layer.origin ?? [W / 2, H / 2];
    const [dx, dy] = layer.offset ?? [0, 0];
    const size = (layer.scale ?? 1) * s.scale;
    const tf = [
      dx || dy || s.tx || s.ty ? `translate(${r2(dx + s.tx)} ${r2(dy + s.ty)})` : "",
      size !== 1 || s.rotate ? `translate(${ox} ${oy}) rotate(${r2(s.rotate)}) scale(${r2(Math.max(0.001, size))}) translate(${-ox} ${-oy})` : "",
    ].filter(Boolean).join(" ");
    let clip = "";
    if (s.wipe !== null && s.wipe < 1) { clips.push(`<clipPath id="w${k}"><rect x="0" y="0" width="${r2(W * s.wipe)}" height="${H}"/></clipPath>`); clip = ` clip-path="url(#w${k})"`; }
    return `<g${opts.tag ? ` data-layer="${k}"` : ""}${tf ? ` transform="${tf}"` : ""}${s.opacity < 1 ? ` opacity="${r2(s.opacity)}"` : ""}${clip}>${fillText(layer, svg, lt)}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${clips.join("")}</defs><rect width="${W}" height="${H}" fill="#2E0A63"/>${sc.bg}<g${sceneT ? ` transform="${sceneT}"` : ""}${sceneOp < 1 ? ` opacity="${r2(sceneOp)}"` : ""}>${body}</g></svg>`;
}
