import jsQR from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

/** Lê o conteúdo de um QR code em PNG/JPG (null se não conseguir). */
export async function decodeQr(image: Buffer): Promise<string | null> {
  // Margem branca + ampliação sem suavizar: QRs pequenos e sem margem passam a ser lidos.
  const { data, info } = await sharp(image)
    .flatten({ background: "#ffffff" })
    .extend({ top: 24, bottom: 24, left: 24, right: 24, background: "#ffffff" })
    .resize(720, 720, { kernel: "nearest", fit: "contain", background: "#ffffff" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

/**
 * QR code vetorial (um <path>) para colocar dentro de um SVG, ocupando o quadrado (x, y, size).
 * Correção de erro "M": aguenta pequenas sujeiras na impressão sem ficar denso demais.
 */
export function qrSvgGroup(text: string, x: number, y: number, size: number, color = "#1E0A01"): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return `<g transform="translate(${x} ${y}) scale(${cell})"><path d="${d}" fill="${color}" shape-rendering="crispEdges"/></g>`;
}
