import { z } from "zod";

// ─── Individual slide schemas (discriminated union on "type") ─────────────────

export const StoryPollSchema = z.object({
  type: z.literal("poll"),
  headline: z.string(),      // texto acima da enquete (≤60 chars)
  question: z.string(),      // pergunta (≤80 chars)
  option_a: z.string(),      // opção A (≤24 chars)
  option_b: z.string(),      // opção B (≤24 chars)
  visual_prompt: z.string(), // prompt para imagem de fundo (inglês)
});

export const StoryQuizSchema = z.object({
  type: z.literal("quiz"),
  headline: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().optional(), // exibida após resposta
  visual_prompt: z.string(),
});

export const StoryCountdownSchema = z.object({
  type: z.literal("countdown"),
  headline: z.string(),
  body: z.string(),
  target_label: z.string(), // ex: "Lançamento do produto"
  cta: z.string(),          // ex: "Clica no link da bio"
  visual_prompt: z.string(),
});

export const StoryQuestionBoxSchema = z.object({
  type: z.literal("question_box"),
  headline: z.string(),
  prompt_text: z.string(), // texto de abertura para a caixinha
  visual_prompt: z.string(),
});

export const StoryBehindScenesSchema = z.object({
  type: z.literal("behind_scenes"),
  headline: z.string(),
  caption: z.string(), // ≤200 chars
  tone: z.enum(["personal", "educational", "funny"]),
  visual_prompt: z.string(),
});

export const StoryPostReinforcementSchema = z.object({
  type: z.literal("post_reinforcement"),
  headline: z.string(),
  angle: z.string(), // ângulo diferente do post original
  cta: z.string(),   // ex: "Vê o carrossel no feed"
  visual_prompt: z.string(),
});

export const StorySlideSchema = z.discriminatedUnion("type", [
  StoryPollSchema,
  StoryQuizSchema,
  StoryCountdownSchema,
  StoryQuestionBoxSchema,
  StoryBehindScenesSchema,
  StoryPostReinforcementSchema,
]);

export type StorySlide = z.infer<typeof StorySlideSchema>;

export const STORY_TYPES = [
  "poll",
  "quiz",
  "countdown",
  "question_box",
  "behind_scenes",
  "post_reinforcement",
] as const;

export type StorySlideType = (typeof STORY_TYPES)[number];

// ─── Story set — sequência de 1–5 stories com contexto narrativo compartilhado

export const StorySetSchema = z.object({
  setTitle: z.string(),                          // título interno do conjunto
  theme: z.string(),                             // contexto narrativo compartilhado
  caption: z.string(),                           // legenda para o post agendado
  hashtags: z.array(z.string()).max(5),
  slides: z.array(StorySlideSchema).min(1).max(5),
});

export type StorySet = z.infer<typeof StorySetSchema>;

// ─── Loose payload (LLM output before Zod parse) ─────────────────────────────

export type StorySetPayload = {
  setTitle?: string;
  theme?: string;
  caption?: string;
  hashtags?: string[];
  slides?: Array<{
    type?: string;
    headline?: string;
    question?: string;
    option_a?: string;
    option_b?: string;
    options?: string[];
    correct_index?: number;
    explanation?: string;
    body?: string;
    target_label?: string;
    cta?: string;
    prompt_text?: string;
    caption?: string;
    tone?: string;
    angle?: string;
    visual_prompt?: string;
  }>;
};
