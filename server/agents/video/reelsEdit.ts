import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { storagePut } from "../../storage";

// Edição "viral" para Reels (1080x1920) do vídeo do avatar, no estilo dos vídeos de
// referência da equipe: legenda palavra a palavra com a palavra falada em laranja,
// cortes com zoom no fim das frases, transição de queima de filme com som, gancho no
// início, logo, barra de progresso e chamada final. Roda com o ffmpeg do servidor.

const run = promisify(execFile);
// Mesmo esquema das skills: arquivos em server/agents a partir da raiz do app (/app no Docker).
const ROOT = path.resolve(process.cwd(), "server/agents");
const FONTS = path.join(ROOT, "design", "fonts");
const LOGO = path.join(ROOT, "design", "assets", "logo-branco.png");
const TRANSITIONS = [1, 2, 3].map((n) => path.join(ROOT, "video", "assets", `transicao-${n}.mp4`));

export type Word = { w: string; s: number; e: number };

export type ReelsEditOptions = {
  videoUrl: string;
  /** Texto falado (o roteiro), usado quando não há legenda SRT com os tempos. */
  script: string;
  /** Legenda SRT do HeyGen, quando o vídeo foi gerado com ela. */
  srt?: string | null;
  hook: string;
  cta: string;
  footnote?: string | null;
  transition: boolean;
  storageKey: string;
};

async function ffprobeDuration(file: string) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(stdout.trim());
}

const srtTime = (t: string) => {
  const [h, m, rest] = t.trim().split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(rest.replace(",", "."));
};

/** Espalha as palavras de um trecho no intervalo, proporcional ao tamanho (pontuação pesa como pausa). */
function spread(text: string, start: number, end: number): Word[] {
  const tokens = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const weight = (w: string) => w.length + (/[.?!]$/.test(w) ? 6 : /[,;:]$/.test(w) ? 3 : 0) + 1;
  const total = tokens.reduce((a, w) => a + weight(w), 0) || 1;
  let t = start;
  return tokens.map((w) => {
    const d = ((end - start) * weight(w)) / total;
    const word = { w, s: t, e: t + d * 0.92 };
    t += d;
    return word;
  });
}

function wordsFromSrt(srt: string): Word[] {
  const words: Word[] = [];
  for (const block of srt.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.split("\n").filter(Boolean);
    const timing = lines.find((l) => l.includes("-->"));
    if (!timing) continue;
    const [a, b] = timing.split("-->");
    const text = lines.slice(lines.indexOf(timing) + 1).join(" ");
    words.push(...spread(displayNumbers(text), srtTime(a), srtTime(b)));
  }
  return words;
}

/** Na legenda, número escrito por extenso (como a voz precisa) volta a ser número. */
const NUMBERS: Record<string, string> = {
  dez: "10", quinze: "15", vinte: "20", trinta: "30", quarenta: "40", cinquenta: "50", sessenta: "60",
  noventa: "90", cem: "100", duzentos: "200", trezentos: "300", quinhentos: "500", mil: "1.000",
};
export function displayNumbers(text: string) {
  const n = Object.keys(NUMBERS).join("|");
  return text
    .replace(new RegExp(`\\b(${n}) por cento\\b`, "gi"), (_, a) => `${NUMBERS[a.toLowerCase()]}%`)
    .replace(new RegExp(`\\b(${n}) reais\\b`, "gi"), (_, a) => `R$${NUMBERS[a.toLowerCase()]}`)
    .replace(new RegExp(`\\b(${n}) (dias|meses|anos|minutos|segundos)\\b`, "gi"), (_, a, u) => `${NUMBERS[a.toLowerCase()]} ${u}`);
}

/** Sem SRT: acha onde a fala começa e termina (silencedetect) e espalha o roteiro nesse intervalo. */
async function wordsFromScript(file: string, script: string, duration: number): Promise<Word[]> {
  const { stderr } = await run("ffmpeg", ["-nostdin", "-i", file, "-af", "silencedetect=noise=-35dB:d=0.25", "-f", "null", "-"], { maxBuffer: 20 * 1024 * 1024 });
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const speechStart = ends.length && ends[0] < 1.5 && (starts[0] ?? 1) < 0.1 ? ends[0] : 0.05;
  const lastStart = starts.length ? starts[starts.length - 1] : duration;
  const speechEnd = lastStart > duration - 2 ? lastStart : duration - 0.1;
  return spread(displayNumbers(script), speechStart, speechEnd);
}

const assTime = (t: number) => {
  t = Math.max(t, 0);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = (t % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${s}`;
};
const assText = (s: string) => s.replace(/[{}\\]/g, "").replace(/\n/g, " ");

export function buildAss(words: Word[], duration: number, hook: string, cta: string, footnote?: string | null) {
  // "15" + "%" viram uma palavra só.
  const ws: Word[] = [];
  for (const w of words) {
    if (ws.length && /^%/.test(w.w)) ws[ws.length - 1] = { ...ws[ws.length - 1], w: ws[ws.length - 1].w + w.w, e: w.e };
    else ws.push(w);
  }
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  for (const w of ws) {
    cur.push(w);
    if (cur.length === 3 || /[.?!,]$/.test(w.w)) { chunks.push(cur); cur = []; }
  }
  if (cur.length) chunks.push(cur);
  const clean = (s: string) => assText(s.replace(/[.,!?;:]/g, "").toUpperCase());

  const ev: string[] = [];
  chunks.forEach((ch, ci) => {
    const next = ci + 1 < chunks.length ? chunks[ci + 1][0].s : duration;
    ch.forEach((w, i) => {
      const end = i + 1 < ch.length ? ch[i + 1].s : Math.min(w.e + 0.25, next);
      const text = ch.map((x, j) => (j === i ? `{\\c&H0073FF&\\fscx112\\fscy112}${clean(x.w)}{\\c&HFFFFFF&\\fscx100\\fscy100}` : clean(x.w))).join(" ");
      const pop = i === 0 ? "{\\t(0,90,\\fscx106\\fscy106)\\t(90,160,\\fscx100\\fscy100)}" : "";
      ev.push(`Dialogue: 0,${assTime(w.s)},${assTime(end)},Cap,,0,0,0,,${pop}${text}`);
    });
  });
  if (hook.trim()) ev.push(`Dialogue: 1,${assTime(0)},${assTime(Math.min(2.6, duration))},Hook,,0,0,0,,{\\fad(80,200)}${assText(hook.toUpperCase())}`);
  if (cta.trim()) ev.push(`Dialogue: 1,${assTime(Math.max(0, duration - 2.4))},${assTime(duration)},Cta,,0,0,0,,{\\fad(150,0)}${assText(cta.toUpperCase())}`);
  if (footnote?.trim()) ev.push(`Dialogue: 1,${assTime(Math.max(0, duration - 2.4))},${assTime(duration)},Foot,,0,0,0,,${assText(footnote)}`);

  return `[Script Info]
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Montserrat Black,92,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,7,4,2,70,70,560,1
Style: Hook,Montserrat Black,86,&H00FFFFFF,&H00FFFFFF,&H00AE007C,&H00AE007C,0,0,0,0,100,100,0,0,3,26,0,8,90,90,1000,1
Style: Cta,Montserrat Black,72,&H00FFFFFF,&H00FFFFFF,&H000073FF,&H000073FF,0,0,0,0,100,100,0,0,3,24,0,8,90,90,1000,1
Style: Foot,Montserrat SemiBold,28,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,0,0,0,0,100,100,0,0,3,10,0,2,90,90,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join("\n")}
`;
}

/** Cortes no fim das frases (mínimo 2,2 s por plano), alternando enquadramento aberto e fechado. */
export function cutPoints(words: Word[]) {
  const cuts = [0];
  for (const w of words.slice(0, -1)) {
    if (/[.?!,]$/.test(w.w) && w.e - cuts[cuts.length - 1] >= 2.2) cuts.push(Number((w.e + 0.05).toFixed(2)));
  }
  return cuts;
}

const escapeFilterPath = (p: string) => p.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");

export async function editForReels(opts: ReelsEditOptions): Promise<{ url: string }> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "reels-"));
  try {
    const src = path.join(tmp, "in.mp4");
    const res = await fetch(opts.videoUrl);
    if (!res.ok) throw new Error(`Não consegui baixar o vídeo (${res.status}).`);
    await writeFile(src, Buffer.from(await res.arrayBuffer()));
    const duration = await ffprobeDuration(src);

    const words = opts.srt ? wordsFromSrt(opts.srt) : await wordsFromScript(src, opts.script, duration);
    if (!words.length) throw new Error("Não encontrei a fala para montar a legenda.");
    const assPath = path.join(tmp, "caps.ass");
    await writeFile(assPath, buildAss(words, duration, opts.hook, opts.cta, opts.footnote));

    const cuts = cutPoints(words);
    let zoom = "1.0";
    cuts.slice(1).forEach((c, i) => { zoom = `if(gte(t,${c}),${i % 2 === 0 ? 1.22 : 1.0},${zoom})`; });
    zoom = `(${zoom})*(1+0.012*sin(t*0.9))`;

    const burns = opts.transition ? cuts.slice(1, 3) : [];
    const inputs = ["-i", src, "-loop", "1", "-i", LOGO];
    burns.forEach((_, k) => inputs.push("-i", TRANSITIONS[k % TRANSITIONS.length]));

    const fc: string[] = [
      `[0:v]scale=w='1080*(${zoom})':h='1920*(${zoom})':eval=frame,crop=1080:1920:x='(iw-1080)/2':y='(ih-1920)*0.32',setsar=1,format=yuv420p[base]`,
    ];
    let last = "base";
    burns.forEach((t, k) => {
      const i = 2 + k;
      fc.push(`[${i}:v]scale=1080:1920,format=yuv420p,trim=0.35:0.95,setpts=PTS-STARTPTS+${(t - 0.25).toFixed(2)}/TB[b${k}]`);
      fc.push(`[${last}][b${k}]blend=all_mode=screen:all_opacity=0.45:shortest=0:repeatlast=0:eof_action=pass[v${k}]`);
      last = `v${k}`;
    });
    fc.push(`[1:v]scale=230:-1,format=rgba,colorchannelmixer=aa=0.92[logo]`);
    fc.push(`[${last}][logo]overlay=60:70:shortest=1[vl]`);
    fc.push(`[vl]drawbox=x=0:y=0:w='iw*t/${duration.toFixed(2)}':h=12:color=0xff7300@1:t=fill[vb]`);
    fc.push(`[vb]subtitles='${escapeFilterPath(assPath)}':fontsdir='${escapeFilterPath(FONTS)}'[vout]`);

    const audio = ["[0:a]acompressor=threshold=-18dB:ratio=3[voice]"];
    const labels = ["[voice]"];
    burns.forEach((t, k) => {
      const ms = Math.max(0, Math.round((t - 0.25) * 1000));
      audio.push(`[${2 + k}:a]atrim=0.35:1.2,asetpts=PTS-STARTPTS,volume=0.45,adelay=${ms}|${ms}[s${k}]`);
      labels.push(`[s${k}]`);
    });
    audio.push(labels.length > 1 ? `${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=first[aout]` : "[voice]anull[aout]");

    const encoder = process.env.FFMPEG_VIDEO_ENCODER === "libopenh264"
      ? ["-c:v", "libopenh264", "-b:v", "9M"]
      : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"];
    const out = path.join(tmp, "out.mp4");
    await run("ffmpeg", [
      "-nostdin", "-v", "error", "-y", ...inputs, "-filter_complex", [...fc, ...audio].join(";"),
      "-map", "[vout]", "-map", "[aout]", "-t", duration.toFixed(2), ...encoder,
      "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out,
    ], { maxBuffer: 20 * 1024 * 1024, timeout: 10 * 60 * 1000 });

    return storagePut(opts.storageKey, await readFile(out), "video/mp4");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
