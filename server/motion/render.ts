import { Resvg } from "@resvg/resvg-js";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { musicById } from "../../shared/musicLibrary";
import { embedAssets, FONT_FILES } from "../agents/design/render";
import { composeFrame, MOTION_TRANSITION, type PreparedScene } from "../../shared/motionFrame";
import { MOTION_FORMATS, motionDuration, type MotionSpec } from "./spec";

// Renderiza um roteiro de motion: monta o SVG de cada quadro (fundo + camadas
// com a animação do momento), desenha com o resvg e manda os pixels para o
// ffmpeg, que gera o MP4 (H.264, 30 fps, com trilha opcional).

const TRANSITION = MOTION_TRANSITION;

type Prepared = PreparedScene;

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

const frameSvg = (scenes: Prepared[], t: number, W: number, H: number) => composeFrame(scenes, t, W, H);

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
