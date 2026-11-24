import { z } from "zod";

// Roteiro de um vídeo motion: cenas em sequência, cada uma com camadas SVG
// (as mesmas regras das artes: Montserrat, href="alle:..." para logos e fotos
// da Ane, https para imagens externas) e animações prontas por camada.
// Quem escreve o roteiro é o Claude (no Claude Code ou, no futuro, um agente);
// o servidor só interpola as animações quadro a quadro e gera o MP4.

export const MOTION_FORMATS = {
  story_9x16: { width: 1080, height: 1920, label: "Reels/Stories 9:16" },
  feed_4x5: { width: 1080, height: 1350, label: "Feed 4:5" },
  feed_1x1: { width: 1080, height: 1080, label: "Feed 1:1" },
  landscape_16x9: { width: 1920, height: 1080, label: "Horizontal 16:9 (1920×1080)" },
} as const;
export type MotionFormat = keyof typeof MOTION_FORMATS;

/** Entradas e saídas prontas (aplicadas no <g> que envolve a camada). */
export const MOTION_PRESETS = [
  "fade", "slide-up", "slide-down", "slide-left", "slide-right", "pop", "zoom-in", "zoom-out", "wipe-right", "rise", "spin-in",
] as const;
export const MOTION_LOOPS = ["pulse", "float", "wiggle", "glow", "spin"] as const;
export const MOTION_EASES = ["linear", "out", "in-out", "back", "elastic"] as const;

const anim = z.object({
  preset: z.enum(MOTION_PRESETS),
  /** Segundos desde o início da cena. */
  at: z.number().min(0).max(60).default(0),
  dur: z.number().min(0.05).max(10).default(0.6),
  ease: z.enum(MOTION_EASES).default("out"),
  /** Distância (px) dos slides; escala inicial dos zooms. */
  distance: z.number().min(0).max(2000).optional(),
});

export const layerSchema = z.object({
  /** Nome livre, só para quem edita o roteiro. */
  name: z.string().max(60).optional(),
  /** Fragmento SVG da camada, nas coordenadas da arte inteira (sem a tag <svg>). */
  svg: z.string().min(1).max(400_000),
  /** Ponto de referência para escala e rotação (padrão: centro da arte). */
  origin: z.tuple([z.number(), z.number()]).optional(),
  /** Ajustes do editor: deslocamento (px), tamanho (1 = original), opacidade e camada escondida. */
  offset: z.tuple([z.number(), z.number()]).optional(),
  scale: z.number().min(0.05).max(10).optional(),
  opacity: z.number().min(0).max(1).optional(),
  hidden: z.boolean().optional(),
  in: anim.optional(),
  out: anim.optional(),
  loop: z.object({ kind: z.enum(MOTION_LOOPS), period: z.number().min(0.2).max(10).default(1.6), amount: z.number().min(0).max(1).default(0.06), from: z.number().min(0).default(0) }).optional(),
  /** Contador: troca {{n}} no svg por um número que vai de "from" a "to". */
  counter: z.object({ from: z.number(), to: z.number(), at: z.number().min(0).default(0), dur: z.number().min(0.1).max(10).default(1.2), decimals: z.number().int().min(0).max(2).default(0), ease: z.enum(MOTION_EASES).default("out") }).optional(),
  /** Máquina de escrever: troca {{t}} no svg pelo texto revelado letra a letra. */
  typewriter: z.object({ text: z.string().max(300), at: z.number().min(0).default(0), cps: z.number().min(2).max(80).default(22) }).optional(),
});

export const sceneSchema = z.object({
  name: z.string().max(60).optional(),
  duration: z.number().min(0.3).max(20),
  /** Fundo da cena (SVG); se faltar, usa o fundo geral do vídeo. */
  background: z.string().max(400_000).optional(),
  layers: z.array(layerSchema).max(40),
  /** Passagem para a próxima cena. */
  transition: z.enum(["fade", "cut", "slide-left", "zoom"]).default("fade"),
});

export const motionSpecSchema = z.object({
  format: z.enum(Object.keys(MOTION_FORMATS) as [MotionFormat, ...MotionFormat[]]).default("story_9x16"),
  fps: z.number().int().min(12).max(60).default(30),
  /** Fundo geral (SVG) para as cenas que não têm o seu. */
  background: z.string().max(400_000).optional(),
  /** Id de uma trilha de shared/musicLibrary (ou nada). */
  music: z.string().max(40).nullable().optional(),
  musicVolume: z.number().min(0).max(1).default(0.5),
  scenes: z.array(sceneSchema).min(1).max(20),
}).refine((s) => s.scenes.reduce((a, c) => a + c.duration, 0) <= 60, { message: "O vídeo pode ter no máximo 60 segundos." });

export type MotionSpec = z.infer<typeof motionSpecSchema>;
export type MotionLayer = z.infer<typeof layerSchema>;
export type MotionScene = z.infer<typeof sceneSchema>;
export const motionDuration = (s: MotionSpec) => s.scenes.reduce((a, c) => a + c.duration, 0);
