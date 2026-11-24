import { Resvg } from "@resvg/resvg-js";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { musicById } from "../../shared/musicLibrary";
import { embedAssets, FONT_FILES } from "../agents/design/render";
import { MOTION_FORMATS, motionDuration, type MotionLayer, type MotionSpec } from "./spec";

// Renderiza um roteiro de motion: monta o SVG de cada quadro (fundo + camadas
// com a animação do momento), desenha com o resvg e manda os pixels para o
// ffmpeg, que gera o MP4 (H.264, 30 fps, com trilha opcional).

const TRANSITION = 0.35; // segundos de passagem entre cenas

type Ease = "linear" | "out" | "in-out" | "back" | "elastic";
const EASE: Record<Ease, (x: number) => number> = {
  linear: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  "in-out": (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  elastic: (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r2 = (n: number) => Math.round(n * 100) / 100;

type State = { opacity: number; tx: number; ty: number; scale: number; rotate: number; wipe: number | null };
const IDLE: State = { opacity: 1, tx: 0, ty: 0, scale: 1, rotate: 0, wipe: null };

/** Estado de uma camada num preset, com p de 0 (início da entrada) a 1 (parada). */
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

function layerState(layer: MotionLayer, t: number, sceneDur: number, W: number, H: number): State {
  const s: State = { ...IDLE };
  const apply = (part: Partial<State>) => {
    if (part.opacity !== undefined) s.opacity *= part.opacity;
    s.tx += part.tx ?? 0; s.ty += part.ty ?? 0;
    if (part.scale !== undefined) s.scale *= part.scale;
    s.rotate += part.rotate ?? 0;
    if (part.wipe !== undefined && part.wipe !== null) s.wipe = Math.min(s.wipe ?? 1, part.wipe);
  };
  if (layer.in) {
    const a = layer.in;
    if (t < a.at) return { ...IDLE, opacity: 0 };
    const p = EASE[a.ease](clamp01((t - a.at) / a.dur));
    apply(presetState(a.preset, p, a.distance, W, H));
  }
  if (layer.out) {
    const a = layer.out;
    const start = a.at || Math.max(0, sceneDur - a.dur);
    if (t >= start) apply(presetState(a.preset, 1 - EASE[a.ease](clamp01((t - start) / a.dur)), a.distance, W, H));
  }
  if (layer.loop && t >= layer.loop.from) {
    const ph = ((t - layer.loop.from) / layer.loop.period) * 2 * Math.PI, k = layer.loop.amount;
    if (layer.loop.kind === "pulse") s.scale *= 1 + k * (0.5 - 0.5 * Math.cos(ph));
    if (layer.loop.kind === "float") s.ty += Math.sin(ph) * k * 200;
    if (layer.loop.kind === "wiggle") s.rotate += Math.sin(ph) * k * 60;
    if (layer.loop.kind === "glow") s.opacity *= 1 - k * (0.5 - 0.5 * Math.cos(ph)) * 4;
    if (layer.loop.kind === "spin") s.rotate += ((t - layer.loop.from) / layer.loop.period) * 360;
  }
  return s;
}

function fillText(layer: MotionLayer, svg: string, t: number) {
  let out = svg;
  if (layer.counter) {
    const c = layer.counter;
    const p = EASE[c.ease](clamp01((t - c.at) / c.dur));
    const n = c.from + (c.to - c.from) * p;
    out = out.split("{{n}}").join(n.toLocaleString("pt-BR", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals }));
  }
  if (layer.typewriter) {
    const tw = layer.typewriter;
    const shown = Math.max(0, Math.min(tw.text.length, Math.floor((t - tw.at) * tw.cps)));
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    out = out.split("{{t}}").join(esc(tw.text.slice(0, shown)));
  }
  return out;
}

type Prepared = { duration: number; transition: string; bg: string; layers: Array<{ layer: MotionLayer; svg: string }> };

/** Embute logos, fotos e imagens uma vez por cena (o SVG de cada quadro só muda transformações). */
async function prepare(spec: MotionSpec): Promise<Prepared[]> {
  const bgCache = new Map<string, string>();
  const bgOf = async (svg: string | undefined) => {
    const k = svg ?? "";
    if (!bgCache.has(k)) bgCache.set(k, k ? await embedAssets(k) : "");
    return bgCache.get(k)!;
  };
  return Promise.all(spec.scenes.map(async (sc) => ({
    duration: sc.duration, transition: sc.transition,
    bg: await bgOf(sc.background ?? spec.background),
    layers: await Promise.all(sc.layers.map(async (layer) => ({ layer, svg: await embedAssets(layer.svg) }))),
  })));
}

function frameSvg(scenes: Prepared[], t: number, W: number, H: number): string {
  let i = 0, start = 0;
  while (i < scenes.length - 1 && t >= start + scenes[i].duration) { start += scenes[i].duration; i++; }
  const sc = scenes[i], lt = t - start;
  // Passagem entre cenas: a cena some no fim e a próxima aparece no começo.
  const prev = i > 0 ? scenes[i - 1].transition : "cut";
  let sceneOp = 1, sceneT = "";
  if (prev !== "cut" && lt < TRANSITION) {
    const p = EASE.out(lt / TRANSITION);
    if (prev === "fade") sceneOp = p;
    if (prev === "slide-left") sceneT = `translate(${r2((1 - p) * W * 0.25)} 0)`, sceneOp = p;
    if (prev === "zoom") sceneT = `translate(${W / 2} ${H / 2}) scale(${r2(1.12 - 0.12 * p)}) translate(${-W / 2} ${-H / 2})`, sceneOp = p;
  }
  if (sc.transition !== "cut" && i < scenes.length - 1 && lt > sc.duration - TRANSITION) {
    const p = EASE["in-out"]((lt - (sc.duration - TRANSITION)) / TRANSITION);
    sceneOp *= 1 - p;
    if (sc.transition === "slide-left") sceneT = `translate(${r2(-p * W * 0.25)} 0)`;
    if (sc.transition === "zoom") sceneT = `translate(${W / 2} ${H / 2}) scale(${r2(1 + 0.12 * p)}) translate(${-W / 2} ${-H / 2})`;
  }
  const clips: string[] = [];
  const body = sc.layers.map(({ layer, svg }, k) => {
    const s = layerState(layer, lt, sc.duration, W, H);
    if (s.opacity <= 0.001) return "";
    const [ox, oy] = layer.origin ?? [W / 2, H / 2];
    const tf = [
      s.tx || s.ty ? `translate(${r2(s.tx)} ${r2(s.ty)})` : "",
      s.scale !== 1 || s.rotate ? `translate(${ox} ${oy}) rotate(${r2(s.rotate)}) scale(${r2(Math.max(0.001, s.scale))}) translate(${-ox} ${-oy})` : "",
    ].filter(Boolean).join(" ");
    let clip = "";
    if (s.wipe !== null && s.wipe < 1) { clips.push(`<clipPath id="w${k}"><rect x="0" y="0" width="${r2(W * s.wipe)}" height="${H}"/></clipPath>`); clip = ` clip-path="url(#w${k})"`; }
    return `<g${tf ? ` transform="${tf}"` : ""}${s.opacity < 1 ? ` opacity="${r2(s.opacity)}"` : ""}${clip}>${fillText(layer, svg, lt)}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${clips.join("")}</defs><rect width="${W}" height="${H}" fill="#2E0A63"/>${sc.bg}<g${sceneT ? ` transform="${sceneT}"` : ""}${sceneOp < 1 ? ` opacity="${r2(sceneOp)}"` : ""}>${body}</g></svg>`;
}

function draw(svg: string, W: number) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: W }, font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Montserrat" } });
  return r.render();
}

/** Um quadro em PNG (capa ou prévia), no instante t (segundos). */
export async function renderMotionFrame(spec: MotionSpec, t: number): Promise<Buffer> {
  const { width: W, height: H } = MOTION_FORMATS[spec.format];
  return draw(frameSvg(await prepare(spec), t, W, H), W).asPng();
}

export type MotionRenderResult = { mp4: Buffer; poster: Buffer; seconds: number; frames: number; ms: number };

export async function renderMotion(spec: MotionSpec, onProgress?: (p: number) => void): Promise<MotionRenderResult> {
  const t0 = Date.now();
  const { width: W, height: H } = MOTION_FORMATS[spec.format];
  const scenes = await prepare(spec);
  const seconds = motionDuration(spec);
  const frames = Math.round(seconds * spec.fps);
  const dir = await mkdtemp(path.join(tmpdir(), "motion-"));
  try {
    const out = path.join(dir, "out.mp4");
    const args = ["-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(spec.fps), "-i", "pipe:0"];
    const track = spec.music ? musicById(spec.music) : undefined;
    if (track) {
      const res = await fetch(track.url, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        const mp3 = path.join(dir, "music.mp3");
        await writeFile(mp3, Buffer.from(await res.arrayBuffer()));
        args.push("-i", mp3, "-map", "0:v", "-map", "1:a", "-af", `volume=${spec.musicVolume},afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, seconds - 1.2)}:d=1.2`, "-c:a", "aac", "-b:a", "160k");
      }
    }
    args.push("-t", String(seconds), "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out);
    const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d) => { err += String(d); });
    const done = new Promise<void>((resolve, reject) => {
      ff.on("error", reject);
      ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com ${code}: ${err.slice(-400)}`))));
    });
    let lastSvg = "", lastPixels: Buffer | null = null;
    for (let f = 0; f < frames; f++) {
      const svg = frameSvg(scenes, f / spec.fps, W, H);
      // Quadro parado (nenhuma animação acontecendo): reaproveita os pixels.
      if (svg !== lastSvg || !lastPixels) { lastPixels = Buffer.from(draw(svg, W).pixels); lastSvg = svg; }
      if (!ff.stdin.write(lastPixels)) await new Promise((r) => ff.stdin.once("drain", r));
      if (onProgress && f % 15 === 0) onProgress(f / frames);
    }
    ff.stdin.end();
    await done;
    // Capa: o fim da primeira cena (tudo já entrou).
    const posterT = Math.max(0, Math.min(seconds - 0.05, spec.scenes[0].duration - TRANSITION - 0.05));
    const poster = draw(frameSvg(scenes, posterT, W, H), W).asPng();
    return { mp4: await readFile(out), poster, seconds, frames, ms: Date.now() - t0 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
