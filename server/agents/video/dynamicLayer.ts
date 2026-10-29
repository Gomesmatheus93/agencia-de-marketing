import { Resvg } from "@resvg/resvg-js";
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Word } from "./reelsEdit";

// Camada "dinâmica" da edição para Reels:
// - palavras gigantes ATRÁS da pessoa (o gancho e as palavras-chave), usando um recorte
//   da pessoa quadro a quadro (modelo MODNet de recorte de retrato, onnxruntime);
// - ícones animados na frente, escolhidos pelo que está sendo falado (fatura, desconto,
//   obra, placa, distribuidora, QR code, academia, Ane...).
// Tudo é composto aqui em cima dos quadros crus (rgb24) e devolvido ao ffmpeg.

const ROOT = path.resolve(process.cwd(), "server/agents");
const MODEL = path.join(ROOT, "video", "assets", "modnet.onnx");
const FONT_DIR = path.join(ROOT, "design", "fonts");
const FONT_FILES = readdirSync(FONT_DIR).filter((f) => f.endsWith(".otf")).map((f) => path.join(FONT_DIR, f));

const W = 1080, H = 1920, FPS = 30;
const MASK_W = 288, MASK_H = 512;
const ORANGE = "#ff7300";

export type Framing = "aberto" | "fechado";
export type IconName =
  | "fatura" | "desconto" | "obra" | "placa" | "torre" | "qr" | "haltere" | "chat" | "casa"
  | "calendario" | "raio" | "dinheiro" | "contrato" | "sol" | "celular";
export type Overlay =
  | { kind: "behind"; text: string; start: number; end: number }
  | { kind: "icon"; icon: IconName; slash: boolean; start: number; end: number; side: "left" | "right" };

// ─── Planejamento: o que aparece e quando ─────────────────────────────────────

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9% ]/g, "");

const ICON_RULES: Array<{ re: RegExp; icon: IconName }> = [
  { re: /^(fatura|faturas|conta de luz|conta de energia|boleto)$/, icon: "fatura" },
  { re: /^(desconto|descontos|economia|economizar|economiza|barata|barato|15%|mais barata)$/, icon: "desconto" },
  { re: /^(obra|obras|reforma)$/, icon: "obra" },
  { re: /^(placa|placas|painel|paineis|telhado|solar)$/, icon: "placa" },
  { re: /^(distribuidora|rede|enel|cpfl|energisa|neoenergia)$/, icon: "torre" },
  { re: /^(qr code|qr|qrcode)$/, icon: "qr" },
  { re: /^(academia|treino|treinar|allp fit|allpfit|aluno|alunos)$/, icon: "haltere" },
  { re: /^(ane|whatsapp|conversa|mensagem|direct)$/, icon: "chat" },
  { re: /^(casa|apartamento|aluguel|alugada|alugado|imovel|residencia)$/, icon: "casa" },
  { re: /^(mes|todo mes|mensal|meses)$/, icon: "calendario" },
  { re: /^(dinheiro|reais|bolso|grana|r\$\d+)$/, icon: "dinheiro" },
  { re: /^(fidelidade|contrato|termo|assina|assinar|assinatura|clicksign)$/, icon: "contrato" },
  { re: /^(cooperativa|usina|usinas|renovavel|limpa)$/, icon: "sol" },
  { re: /^(celular|app|aplicativo|link)$/, icon: "celular" },
  { re: /^(energia|luz|digital|eletrica)$/, icon: "raio" },
];
const BEHIND_RE = /^(desconto|economizar|economia|barata|sem obra|sem placa|todo mes|gratis|15%|sem fidelidade|digital)$/;

export function planOverlays(words: Word[], duration: number, hook: string): Overlay[] {
  const out: Overlay[] = [];
  const hookEnd = Math.min(2.6, duration);
  if (hook.trim()) out.push({ kind: "behind", text: hook.trim(), start: 0, end: hookEnd });
  let lastBehind = hook.trim() ? hookEnd : -10;
  let lastIcon = -10;
  const lastByIcon = new Map<IconName, number>();
  let side: "left" | "right" = "right";
  const tokens = words.map((w) => norm(w.w));
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const one = tokens[i], two = i + 1 < words.length ? `${tokens[i]} ${tokens[i + 1]}` : "";
    const prev = tokens.slice(Math.max(0, i - 3), i);
    const negated = prev.includes("sem") || prev.includes("nao") || prev.includes("nenhuma") || tokens[i + 1] === "nenhuma";

    // Palavra gigante atrás da pessoa.
    const bKey = BEHIND_RE.test(two) ? two : BEHIND_RE.test(one) ? one : null;
    if (bKey && w.s >= lastBehind + 0.6 && w.s < duration - 1) {
      const text = bKey === two ? `${words[i].w} ${words[i + 1].w}` : words[i].w;
      const start = Math.max(0, w.s - 0.05), end = Math.min(duration, start + 1.4);
      out.push({ kind: "behind", text: text.replace(/[.,!?;:]/g, ""), start, end });
      lastBehind = end + 1.2;
    }

    // Ícone animado.
    const rule = ICON_RULES.find((r) => r.re.test(two)) ?? ICON_RULES.find((r) => r.re.test(one));
    if (rule && w.s >= lastIcon + 1.3 && w.s - (lastByIcon.get(rule.icon) ?? -10) >= 6 && w.s < duration - 0.8) {
      const start = Math.max(0, w.s - 0.1), end = Math.min(duration, start + 1.7);
      const slash = negated && (rule.icon === "obra" || rule.icon === "placa" || rule.icon === "contrato");
      out.push({ kind: "icon", icon: rule.icon, slash, start, end, side });
      side = side === "right" ? "left" : "right";
      lastIcon = start;
      lastByIcon.set(rule.icon, start);
    }
  }
  // Ícone não divide a tela com a palavra gigante nem com a chamada final (últimos 2,4 s):
  // espera a palavra sair (até 1 s) ou não entra.
  const behindSpans = out.filter((o) => o.kind === "behind").map((o) => [o.start, o.end] as const);
  const ctaStart = duration - 2.4;
  const final: Overlay[] = [];
  for (const o of out) {
    if (o.kind !== "icon") { final.push(o); continue; }
    let { start, end } = o;
    const hit = behindSpans.find(([a, b]) => start < b && end > a);
    if (hit) {
      if (hit[1] - start > 1) continue;
      const len = end - start;
      start = hit[1] + 0.05; end = start + len;
    }
    if (behindSpans.some(([a, b]) => start < b && end > a) || end > ctaStart) continue;
    final.push({ ...o, start, end });
  }
  return final;
}

// ─── Desenho (SVG → RGBA) ─────────────────────────────────────────────────────

const ICON_SVG: Record<IconName, string> = {
  fatura: `<rect x="28" y="14" width="44" height="72" rx="6"/><path d="M38 32h24M38 44h16"/><path d="M52 52 42 68h9l-3 12 12-18h-9l3-10z" fill="#fff" stroke-width="2"/>`,
  desconto: `<circle cx="34" cy="34" r="9"/><circle cx="66" cy="66" r="9"/><path d="M72 26 28 74"/>`,
  obra: `<path d="M24 62a26 26 0 0 1 52 0z"/><path d="M16 66h68"/><path d="M50 36v-8M40 40l-3-6M60 40l3-6"/>`,
  placa: `<path d="M22 32h56l-8 34H14z"/><path d="M19 49h55M41 32l-5 34M60 32l-5 34"/><path d="M42 66v14M30 80h24"/>`,
  torre: `<path d="M50 12 30 88M50 12l20 76M36 50h28M40 32h20M32 70h36M36 50l32 20M64 50 32 70"/>`,
  qr: `<rect x="18" y="18" width="24" height="24" rx="3"/><rect x="58" y="18" width="24" height="24" rx="3"/><rect x="18" y="58" width="24" height="24" rx="3"/><path d="M58 58h8v8h-8zM74 58h8M58 74h8M74 70v12h8"/>`,
  haltere: `<path d="M30 50h40"/><rect x="16" y="34" width="12" height="32" rx="3"/><rect x="72" y="34" width="12" height="32" rx="3"/><path d="M10 42v16M90 42v16"/>`,
  chat: `<path d="M18 24h64v40H44L30 78V64H18z"/><circle cx="36" cy="44" r="2" fill="#fff"/><circle cx="50" cy="44" r="2" fill="#fff"/><circle cx="64" cy="44" r="2" fill="#fff"/>`,
  casa: `<path d="M16 50 50 20l34 30"/><path d="M26 42v40h48V42"/><path d="M44 82V62h12v20"/>`,
  calendario: `<rect x="18" y="24" width="64" height="58" rx="6"/><path d="M18 40h64M34 16v14M66 16v14"/><path d="M38 60l8 8 16-16"/>`,
  raio: `<path d="M56 12 26 56h22l-6 32 32-46H52z" fill="#fff" stroke-width="3"/>`,
  dinheiro: `<rect x="14" y="30" width="72" height="40" rx="6"/><circle cx="50" cy="50" r="10"/><path d="M24 40v20M76 40v20"/>`,
  contrato: `<path d="M26 12h34l14 14v62H26z"/><path d="M60 12v14h14M36 40h28M36 52h20"/><path d="M34 74c6-8 10 4 16-2s6 2 12-2"/>`,
  sol: `<circle cx="50" cy="50" r="14"/><path d="M50 18v10M50 72v10M18 50h10M72 50h10M27 27l7 7M66 66l7 7M73 27l-7 7M34 66l-7 7"/>`,
  celular: `<rect x="32" y="12" width="36" height="76" rx="8"/><path d="M44 78h12"/>`,
};

async function svgToRgba(svg: string): Promise<{ data: Buffer; width: number; height: number }> {
  const png = new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Montserrat" } }).render().asPng();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const ICON_SIZE = 220;
function iconSvg(icon: IconName, slash: boolean, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 220 220">
<circle cx="110" cy="114" r="98" fill="#000" opacity="0.18"/>
<circle cx="110" cy="108" r="98" fill="${ORANGE}" stroke="#fff" stroke-width="6"/>
<g transform="translate(50 48) scale(1.2)" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${ICON_SVG[icon]}</g>
${slash ? `<path d="M48 46 172 170" stroke="#fff" stroke-width="16" stroke-linecap="round"/><path d="M48 46 172 170" stroke="#E5484D" stroke-width="9" stroke-linecap="round"/>` : ""}
</svg>`;
}

/** Palavra(s) gigante(s) em até 2 linhas, ocupando a largura da tela. */
function behindSvg(text: string) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 11) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const shown = lines.slice(0, 3);
  const maxChars = Math.max(...shown.map((l) => l.length));
  const size = Math.round(Math.min(300, 1010 / (maxChars * 0.74)));
  const lh = Math.round(size * 0.92);
  const h = lh * shown.length + Math.round(size * 0.3);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}">
${shown.map((l, i) => `<text x="${W / 2}" y="${size * 0.95 + i * lh}" text-anchor="middle" font-family="Montserrat" font-weight="900" font-size="${size}" letter-spacing="-4" fill="${ORANGE}" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(l)}</text>`).join("\n")}
</svg>`,
    height: h,
  };
}

// ─── Recorte da pessoa ────────────────────────────────────────────────────────

type Session = { run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>; inputNames: string[]; outputNames: string[] };
let sessionPromise: Promise<{ ort: any; session: Session }> | null = null;
function getSession() {
  sessionPromise ??= (async () => {
    // @ts-ignore: o pacote não traz tipos no caminho que o TypeScript procura.
    const ort = await import("onnxruntime-node");
    const session = (await ort.InferenceSession.create(MODEL, { intraOpNumThreads: 2 })) as unknown as Session;
    return { ort, session };
  })();
  return sessionPromise;
}

async function personMask(frame: Buffer): Promise<Float32Array> {
  const { ort, session } = await getSession();
  const small = await sharp(frame, { raw: { width: W, height: H, channels: 3 } }).resize(MASK_W, MASK_H).raw().toBuffer();
  const n = MASK_W * MASK_H;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) input[c * n + i] = (small[i * 3 + c] / 255 - 0.5) / 0.5;
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, MASK_H, MASK_W]) });
  return out[session.outputNames[0]].data;
}

const maskAt = (m: Float32Array, x: number, y: number) => {
  const fx = (x / W) * MASK_W - 0.5, fy = (y / H) * MASK_H - 0.5;
  const x0 = Math.max(0, Math.min(MASK_W - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(MASK_H - 1, Math.floor(fy)));
  const x1 = Math.min(MASK_W - 1, x0 + 1), y1 = Math.min(MASK_H - 1, y0 + 1);
  const ax = Math.max(0, Math.min(1, fx - x0)), ay = Math.max(0, Math.min(1, fy - y0));
  const top = m[y0 * MASK_W + x0] * (1 - ax) + m[y0 * MASK_W + x1] * ax;
  const bot = m[y1 * MASK_W + x0] * (1 - ax) + m[y1 * MASK_W + x1] * ax;
  return top * (1 - ay) + bot * ay;
};

// ─── Composição quadro a quadro ───────────────────────────────────────────────

/** Mistura uma imagem RGBA (opcionalmente atrás da pessoa) no quadro rgb24. */
function blend(frame: Buffer, img: { data: Buffer; width: number; height: number }, left: number, top: number, alpha: number, mask?: Float32Array) {
  for (let y = 0; y < img.height; y++) {
    const fy = top + y;
    if (fy < 0 || fy >= H) continue;
    for (let x = 0; x < img.width; x++) {
      const fx = left + x;
      if (fx < 0 || fx >= W) continue;
      const si = (y * img.width + x) * 4;
      let a = (img.data[si + 3] / 255) * alpha;
      if (a <= 0.004) continue;
      if (mask) a *= 1 - Math.min(1, Math.max(0, (maskAt(mask, fx, fy) - 0.08) / 0.84));
      if (a <= 0.004) continue;
      const di = (fy * W + fx) * 3;
      for (let c = 0; c < 3; c++) frame[di + c] = frame[di + c] + a * (img.data[si + c] - frame[di + c]);
    }
  }
}

export async function applyDynamicLayer(input: string, output: string, overlays: Overlay[], framing: Framing, encoder: string[]) {
  // Pré-renderiza tudo uma vez.
  const behind = await Promise.all(overlays.filter((o): o is Extract<Overlay, { kind: "behind" }> => o.kind === "behind").map(async (o) => {
    const { svg, height } = behindSvg(o.text);
    const img = await svgToRgba(svg);
    const cy = framing === "aberto" ? 700 : 560;
    return { o, img, top: Math.round(cy - height / 2) };
  }));
  const SCALES = [0.35, 0.65, 0.92, 1.12, 1.06, 1.0];
  const icons = await Promise.all(overlays.filter((o): o is Extract<Overlay, { kind: "icon" }> => o.kind === "icon").map(async (o) => ({
    o,
    frames: await Promise.all(SCALES.map((s) => svgToRgba(iconSvg(o.icon, o.slash, Math.round(ICON_SIZE * s))))),
    cx: o.side === "left" ? 190 : W - 190,
    cy: framing === "aberto" ? 520 : 420,
  })));

  const dec = spawn("ffmpeg", ["-nostdin", "-v", "error", "-i", input, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const enc = spawn("ffmpeg", ["-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-", ...encoder, "-pix_fmt", "yuv420p", output]);
  let encErr = "";
  enc.stderr.on("data", (d) => { encErr += d; });
  const encDone = new Promise<void>((resolve, reject) => enc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg (camada dinâmica): ${encErr.slice(0, 300)}`)))));

  const frameSize = W * H * 3;
  let pending: Buffer = Buffer.alloc(0);
  let index = 0;
  let mask: Float32Array | null = null;
  let maskIndex = -10;

  const processFrame = async (frame: Buffer) => {
    const t = index / FPS;
    const activeBehind = behind.filter((b) => t >= b.o.start && t < b.o.end);
    if (activeBehind.length) {
      if (index - maskIndex >= 2 || !mask) { mask = await personMask(frame); maskIndex = index; }
      for (const b of activeBehind) {
        const local = t - b.o.start, left = b.o.end - t;
        const alpha = Math.min(1, local / 0.15, left / 0.2);
        const rise = Math.round(Math.max(0, 1 - local / 0.25) * 40);
        blend(frame, b.img, 0, b.top + rise, alpha, mask);
      }
    }
    for (const ic of icons) {
      if (t < ic.o.start || t >= ic.o.end) continue;
      const k = Math.floor((t - ic.o.start) * FPS);
      const img = ic.frames[Math.min(k, ic.frames.length - 1)];
      const left = ic.o.end - t;
      const alpha = Math.min(1, left / 0.2);
      const float = k >= ic.frames.length ? Math.round(Math.sin(t * 3) * 6) : 0;
      blend(frame, img, Math.round(ic.cx - img.width / 2), Math.round(ic.cy - img.height / 2) + float, alpha);
    }
    index++;
    if (!enc.stdin.write(frame)) await new Promise((r) => enc.stdin.once("drain", r));
  };

  for await (const chunk of dec.stdout as AsyncIterable<Buffer>) {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    while (pending.length >= frameSize) {
      const frame = Buffer.from(pending.subarray(0, frameSize));
      pending = pending.subarray(frameSize);
      await processFrame(frame);
    }
  }
  enc.stdin.end();
  await encDone;
}
