import { ENV } from "./env";

// Type-specific visual direction appended to the LLM visual_prompt
const TYPE_STYLE: Record<string, string> = {
  poll:               "bold graphic design, vivid contrasting colors, dynamic composition",
  quiz:               "playful colorful geometry, bright energetic palette, fun atmosphere",
  countdown:          "dramatic cinematic lighting, epic atmosphere, strong sense of anticipation",
  question_box:       "warm inviting tones, soft pastel background, approachable lifestyle",
  behind_scenes:      "candid authentic mood, warm golden hour lighting, lifestyle photography",
  post_reinforcement: "modern professional, clean bold design, strong visual impact",
};

interface DalleResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
}

export async function generateStoryImage(
  visualPrompt: string,
  slideType: string,
): Promise<string | null> {
  if (!ENV.openaiApiKey) return null;

  const typeHint = TYPE_STYLE[slideType] ?? "vibrant Instagram Story background";
  const prompt = [
    "Instagram Story background image, vertical format, NO text, NO words, NO letters, NO numbers anywhere in the image.",
    visualPrompt,
    `Visual style: ${typeHint}.`,
    "High quality, professional photography or digital art.",
  ].join(" ");

  const model = ENV.openaiImageModel; // defaults to "gpt-image-1"
  const isDalle3 = model === "dall-e-3";

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
  };

  if (isDalle3) {
    body.size = "1024x1792"; // perfect 9:16
    body.quality = "hd";
    body.response_format = "url";
  } else {
    // gpt-image-1
    body.size = "1024x1536";
    body.quality = "high";
    body.response_format = "b64_json";
  }

  try {
    const resp = await fetch(`${ENV.openaiApiBaseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.warn(`[ImageGen] OpenAI ${resp.status}: ${text.slice(0, 300)}`);
      return null;
    }

    const data = (await resp.json()) as DalleResponse;
    const item = data.data?.[0];
    if (!item) return null;

    if (item.url) return item.url;
    if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return null;
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
