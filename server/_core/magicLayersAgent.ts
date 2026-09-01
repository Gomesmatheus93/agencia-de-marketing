import { z } from "zod";
import { invokeLLM } from "./llm";

// ── Contrato ──────────────────────────────────────────────────────────────────
// A IA recebe a imagem achatada de uma arte e devolve os elementos que consegue
// enxergar, cada um com uma caixa normalizada (fração 0..1 da imagem, origem no
// canto superior esquerdo). O client usa isso pra recriar textos editáveis e
// recortar logo/foto/gráficos como camadas independentes por cima do fundo.

export const MAGIC_LAYER_KINDS = ["text", "logo", "photo", "graphic", "icon", "shape"] as const;
export type MagicLayerKind = (typeof MAGIC_LAYER_KINDS)[number];

export interface MagicLayerElement {
  kind: MagicLayerKind;
  label: string;
  bbox: { x: number; y: number; w: number; h: number };
  text?: string;
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
  fontRatio?: number;
  uppercase?: boolean;
}

export interface MagicLayersResult {
  elements: MagicLayerElement[];
}

const clamp01 = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.min(1, Math.max(0, v));
};

const rawElementSchema = z
  .object({
    kind: z.string().optional(),
    label: z.string().optional(),
    bbox: z
      .object({
        x: z.number().optional(),
        y: z.number().optional(),
        w: z.number().optional(),
        h: z.number().optional(),
      })
      .optional(),
    text: z.string().optional(),
    color: z.string().optional(),
    bold: z.boolean().optional(),
    align: z.string().optional(),
    fontRatio: z.number().optional(),
    uppercase: z.boolean().optional(),
  })
  .passthrough();

const responseSchema = z.object({ elements: z.array(rawElementSchema).optional() });

const HEX = /^#?[0-9a-fA-F]{6}$/;

function sanitize(parsed: z.infer<typeof responseSchema>): MagicLayersResult {
  const elements: MagicLayerElement[] = [];
  for (const el of parsed.elements ?? []) {
    const bbox = el.bbox;
    if (!bbox) continue;
    const x = clamp01(bbox.x);
    const y = clamp01(bbox.y);
    let w = clamp01(bbox.w);
    let h = clamp01(bbox.h);
    if (w <= 0.001 || h <= 0.001) continue;
    if (x + w > 1) w = 1 - x;
    if (y + h > 1) h = 1 - y;

    const kind: MagicLayerKind = (MAGIC_LAYER_KINDS as readonly string[]).includes(el.kind ?? "")
      ? (el.kind as MagicLayerKind)
      : "graphic";

    const out: MagicLayerElement = {
      kind,
      label: (el.label ?? "").trim().slice(0, 60) || defaultLabel(kind),
      bbox: { x, y, w, h },
    };

    if (kind === "text") {
      out.text = (el.text ?? "").slice(0, 500);
      if (!out.text.trim()) continue;
      const color = (el.color ?? "").trim();
      if (HEX.test(color)) out.color = color.startsWith("#") ? color : `#${color}`;
      out.bold = el.bold ?? false;
      out.align = el.align === "left" || el.align === "right" ? el.align : "center";
      if (typeof el.fontRatio === "number" && el.fontRatio > 0) out.fontRatio = clamp01(el.fontRatio);
      out.uppercase = el.uppercase ?? false;
    }

    elements.push(out);
  }
  return { elements };
}

function defaultLabel(kind: MagicLayerKind): string {
  switch (kind) {
    case "text": return "Texto";
    case "logo": return "Logo";
    case "photo": return "Foto";
    case "icon": return "Ícone";
    case "shape": return "Forma";
    default: return "Elemento";
  }
}

const SYSTEM_PROMPT = `Você é um analista de artes gráficas. Recebe UMA imagem já
"achatada" (um único raster) de uma peça de marketing e precisa identificar os
elementos visuais que a compõem, para que um editor consiga separá-los em camadas.

Devolva APENAS um JSON válido (sem markdown, sem texto antes ou depois) neste formato:

{
  "elements": [
    {
      "kind": "text" | "logo" | "photo" | "graphic" | "icon" | "shape",
      "label": "rótulo curto em português (ex: 'Título', 'Logo Alle Energia', 'Foto da mulher', 'Selo 15%')",
      "bbox": { "x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0 },
      "text": "somente para kind=text: o texto EXATO como aparece, com \\n entre linhas",
      "color": "somente para kind=text: cor predominante do texto em hex #rrggbb",
      "bold": true,
      "align": "left" | "center" | "right",
      "fontRatio": 0.08,
      "uppercase": false
    }
  ]
}

Regras:
- bbox é a fração da imagem (0 a 1), origem no canto SUPERIOR ESQUERDO. x/y = canto
  superior esquerdo da caixa; w/h = largura/altura. Faça caixas JUSTAS ao elemento.
- Um bloco de texto visualmente unido (mesma cor/tamanho/coluna) é UM único
  elemento, mesmo que tenha várias linhas — use \\n. Blocos claramente distintos
  (título vs. parágrafo vs. selo) são elementos separados.
- "fontRatio" = altura aproximada de UMA linha de texto dividida pela altura total
  da imagem.
- A logomarca inteira é UM elemento kind="logo" (nunca separe letra por letra).
- Fotos/pessoas/produtos = kind="photo". Ícones pequenos = kind="icon". Faixas,
  cartões, blocos de cor, brilhos = kind="graphic" ou "shape".
- NÃO crie um elemento para o fundo/gradiente da arte inteira.
- Ignore ruído: no máximo ~20 elementos, priorize os relevantes.
- Se não conseguir identificar nada, devolva { "elements": [] }.`;

export async function analyzeMagicLayers(imageDataUrl: string): Promise<MagicLayersResult> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
          { type: "text", text: "Analise esta arte e liste os elementos em JSON conforme instruído." },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4000,
  });

  const rawContent = response.choices[0]?.message?.content;
  const raw = typeof rawContent === "string" ? rawContent : "";
  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(raw));
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = responseSchema.parse(JSON.parse(match[0]));
      } catch {
        return { elements: [] };
      }
    } else {
      return { elements: [] };
    }
  }

  return sanitize(parsed);
}
