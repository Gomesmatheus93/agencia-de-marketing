import { Resvg } from "@resvg/resvg-js";
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
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
  { re: /^(desconto|descontos|economia|economizar|economiza|barata|barato|35%|15%|mais barata)$/, icon: "desconto" },
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
const BEHIND_RE = /^(desconto|economizar|economia|barata|sem obra|sem placa|todo mes|gratis|35%|15%|sem fidelidade|digital)$/;

export function planOverlays(words: Word[], duration: number, hook: string, hasCta = true): Overlay[] {
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
  const ctaStart = hasCta ? duration - 2.4 : duration;
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

// Ícones da biblioteca Lucide (lucide-static, licença ISC), mais o painel solar no mesmo
// traço (a Lucide não tem). Cada ícone tem um rótulo curto para ser entendido de relance.
const LUCIDE: Record<IconName, string> = {
  fatura: "receipt-text", desconto: "badge-percent", obra: "hard-hat", placa: "", torre: "utility-pole",
  qr: "qr-code", haltere: "dumbbell", chat: "message-circle-more", casa: "house", calendario: "calendar-check",
  raio: "zap", dinheiro: "piggy-bank", contrato: "file-pen-line", sol: "sun", celular: "smartphone",
};
const SOLAR_PANEL = `<path d="M4 4h16l-2 10H2z"/><path d="M3 9h16M8 4l-1.5 10M14 4l-1.5 10"/><path d="M10 14v5M6 19h8"/>`;
const ICON_LABEL: Record<IconName, [string, string]> = {
  // [rótulo normal, rótulo quando vem depois de "sem"/"não"]
  fatura: ["FATURA", "FATURA"], desconto: ["DESCONTO", "DESCONTO"], obra: ["OBRA", "SEM OBRA"],
  placa: ["PLACA SOLAR", "SEM PLACA"], torre: ["DISTRIBUIDORA", "DISTRIBUIDORA"], qr: ["QR CODE", "QR CODE"],
  haltere: ["ACADEMIA", "ACADEMIA"], chat: ["FALE COM A ANE", "FALE COM A ANE"], casa: ["SUA CASA", "SUA CASA"],
  calendario: ["TODO MÊS", "TODO MÊS"], raio: ["ENERGIA", "ENERGIA"], dinheiro: ["ECONOMIA", "ECONOMIA"],
  contrato: ["CONTRATO", "SEM FIDELIDADE"], sol: ["ENERGIA LIMPA", "ENERGIA LIMPA"], celular: ["PELO CELULAR", "PELO CELULAR"],
};
const LUCIDE_DIR = path.resolve(process.cwd(), "node_modules/lucide-static/icons");
const iconBody = (icon: IconName) => {
  if (icon === "placa") return SOLAR_PANEL;
  const svg = readFileSync(path.join(LUCIDE_DIR, `${LUCIDE[icon]}.svg`), "utf8");
  return svg.slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"));
};

export async function svgToRgba(svg: string): Promise<{ data: Buffer; width: number; height: number }> {
  const png = new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Montserrat" } }).render().asPng();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const ICON_SIZE = 380;
/** Card branco com sombra, ícone laranja grande e rótulo roxo; "sem" risca o ícone em vermelho. */
export function iconSvg(icon: IconName, slash: boolean, size: number) {
  const label = ICON_LABEL[icon][slash ? 1 : 0];
  const fs = label.length > 12 ? 22 : label.length > 10 ? 25 : label.length > 8 ? 30 : 34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 300 300">
<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1E0A01" flood-opacity="0.32"/></filter></defs>
<rect x="22" y="14" width="256" height="262" rx="46" fill="#fff" filter="url(#sh)"/>
<rect x="22" y="14" width="256" height="262" rx="46" fill="none" stroke="${ORANGE}" stroke-width="5"/>
<g transform="translate(84 46) scale(5.5)" fill="none" stroke="${ORANGE}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${iconBody(icon)}</g>
${slash ? `<circle cx="150" cy="112" r="68" fill="none" stroke="#E5484D" stroke-width="11"/><path d="M102 64 198 160" stroke="#E5484D" stroke-width="11" stroke-linecap="round"/>` : ""}
<text x="150" y="${240 + (34 - fs) / 3}" text-anchor="middle" font-family="Montserrat" font-weight="900" font-size="${fs}" fill="#7c00ae">${label}</text>
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

/** Quanto a palavra gigante desce sobre o topo da cabeça (px). */
const HEAD_OVERLAP = 70;

/** Linha (em px da tela) do topo da pessoa, olhando a faixa central do recorte. */
function headTop(mask: Float32Array): number | null {
  const x0 = Math.floor(MASK_W * 0.3), x1 = Math.ceil(MASK_W * 0.7);
  for (let y = 0; y < MASK_H; y++) {
    let hits = 0;
    for (let x = x0; x < x1; x++) if (mask[y * MASK_W + x] > 0.5) hits++;
    if (hits >= 3) return Math.round((y / MASK_H) * H);
  }
  return null;
}

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
    return { o, img, top: Math.round(cy - height / 2), anchor: null as number | null };
  }));
  const SCALES = [0.35, 0.65, 0.92, 1.12, 1.06, 1.0];
  const icons = await Promise.all(overlays.filter((o): o is Extract<Overlay, { kind: "icon" }> => o.kind === "icon").map(async (o) => ({
    o,
    frames: await Promise.all(SCALES.map((s) => svgToRgba(iconSvg(o.icon, o.slash, Math.round(ICON_SIZE * s))))),
    cx: o.side === "left" ? 215 : W - 215,
    cy: framing === "aberto" ? 360 : 480,
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
      // A palavra fica logo acima da cabeça (encostando só no topo do cabelo): o topo da
      // pessoa sai do recorte e é atualizado quando o plano muda (corte com zoom).
      const head = headTop(mask);
      for (const b of activeBehind) {
        if (head !== null && (b.anchor === null || Math.abs(head - b.anchor) > 80)) b.anchor = head;
        const top = b.anchor === null ? b.top : Math.max(140, Math.round(b.anchor + HEAD_OVERLAP - b.img.height));
        const local = t - b.o.start, left = b.o.end - t;
        const alpha = Math.min(1, local / 0.15, left / 0.2);
        const rise = Math.round(Math.max(0, 1 - local / 0.25) * 40);
        blend(frame, b.img, 0, top + rise, alpha, mask);
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
