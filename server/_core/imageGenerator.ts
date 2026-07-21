import { ENV } from "./env";

const FAL_BASE = "https://fal.run";
const FAL_MODEL = "fal-ai/flux-pro/v1.1-ultra";

// Type-specific visual direction appended to the LLM visual_prompt
const TYPE_STYLE: Record<string, string> = {
  poll:              "bold graphic, high contrast, vivid background, engaging atmosphere",
  quiz:              "playful colorful geometry, bright palette, energetic",
  countdown:         "dramatic cinematic lighting, epic atmosphere, sense of anticipation",
  question_box:      "warm conversational, pastel tones, inviting and approachable",
  behind_scenes:     "candid authentic mood, warm golden tones, lifestyle photography feel",
  post_reinforcement: "modern professional, clean minimal, strong visual hierarchy",
};

interface FalResponse {
  images?: Array<{ url: string; width: number; height: number }>;
}

export async function generateStoryImage(
  visualPrompt: string,
  slideType: string,
): Promise<string | null> {
  if (!ENV.falApiKey) return null;

  const typeHint = TYPE_STYLE[slideType] ?? "vibrant Instagram Story background";
  const prompt = `Instagram Story vertical background image, no text, no words, no letters, photorealistic, high quality. ${visualPrompt}. Style: ${typeHint}.`;

  try {
    const resp = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${ENV.falApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: "9:16",
        output_format: "jpeg",
        safety_tolerance: "2",
        raw: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(`[ImageGen] fal.ai ${resp.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = (await resp.json()) as FalResponse;
    return data.images?.[0]?.url ?? null;
  } catch (err) {
    console.error("[ImageGen] Error generating story image:", err);
    return null;
  }
}

// Generate images for all slides in parallel, returns array aligned to input
export async function generateSlideImages(
  slides: Array<{ visual_prompt: string; type: string }>,
): Promise<Array<string | null>> {
  return Promise.all(
    slides.map((s) => generateStoryImage(s.visual_prompt, s.type)),
  );
}
