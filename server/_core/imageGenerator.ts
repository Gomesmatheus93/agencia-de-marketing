import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";
import { storagePut } from "../storage";
import type { StorySlide } from "./storyContentSchema";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Per-type style direction
const TYPE_STYLE: Record<string, string> = {
  poll:               "bold graphic design, vivid contrasting colors, split-screen layout, high-contrast, energetic",
  quiz:               "playful colorful geometry, bright energetic palette, fun quiz-show atmosphere, dynamic shapes",
  countdown:          "dramatic cinematic lighting, epic moody atmosphere, strong urgency, dark dramatic tones",
  question_box:       "warm inviting lifestyle, soft pastel tones, approachable, cozy, friendly natural environment",
  behind_scenes:      "candid authentic mood, golden hour warm lighting, real moments, documentary style photography",
  post_reinforcement: "modern professional brand aesthetic, clean bold design, strong visual impact, sleek",
};

// Build a rich visual description from slide content
function buildSlideContext(slide: StorySlide): string {
  const parts: string[] = [`Headline context: "${slide.headline}"`];
  switch (slide.type) {
    case "poll":
      parts.push(`Poll: "${slide.question}" with options "${slide.option_a}" vs "${slide.option_b}"`);
      break;
    case "quiz":
      parts.push(`Quiz question: "${slide.question}"`);
      if (slide.options?.length) parts.push(`Options: ${slide.options.join(", ")}`);
      break;
    case "countdown":
      parts.push(`Countdown message: "${slide.body}". Event: "${slide.target_label}"`);
      break;
    case "behind_scenes":
      parts.push(`Behind the scenes: "${slide.caption}". Tone: ${slide.tone}`);
      break;
    case "post_reinforcement":
      parts.push(`Post angle: "${slide.angle}"`);
      break;
  }
  return parts.join(". ");
}

// Persist buffer: try S3 → local → base64 data URI (always returns something)
async function persistBuffer(buffer: Buffer, ext: string, contentType: string): Promise<string> {
  const filename = `story-${randomUUID()}.${ext}`;

  try {
    const result = await storagePut(`stories/${filename}`, buffer, contentType);
    console.log("[StoryImage] Stored to cloud:", result.url.slice(0, 80));
    return result.url;
  } catch {
    console.warn("[StoryImage] Cloud storage unavailable, trying local uploads/");
  }

  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    console.log("[StoryImage] Stored locally:", `/uploads/${filename}`);
    return `/uploads/${filename}`;
  } catch {
    console.warn("[StoryImage] Local storage failed, returning base64 data URI");
  }

  // Guaranteed fallback: data URI works in any environment, no server needed
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

// Call OpenAI images/generations with a specific model, return stored URL or null
async function callOpenAI(prompt: string, model: string): Promise<string | null> {
  const isDalle3 = model === "dall-e-3";

  const body: Record<string, unknown> = { model, prompt, n: 1 };

  if (isDalle3) {
    body.size = "1024x1792"; // true 9:16 — best for Stories
    body.quality = "hd";
    body.response_format = "url";
  } else {
    // gpt-image-1 or similar
    body.size = "1024x1536"; // portrait 2:3
    body.quality = "high";
    body.output_format = "webp";
    body.output_compression = 85;
  }

  console.log(`[StoryImage] Calling ${model}...`);

  const resp = await fetch(`${ENV.openaiApiBaseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => "");
    console.warn(`[StoryImage] ${model} failed (${resp.status}): ${errorText.slice(0, 300)}`);
    return null;
  }

  const data = (await resp.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  const item = data.data?.[0];
  if (!item) {
    console.warn("[StoryImage] No item in OpenAI response");
    return null;
  }

  // DALL-E 3 → temporary URL → download and persist
  if (item.url) {
    try {
      const imgResp = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
      if (imgResp.ok) {
        const buffer = Buffer.from(await imgResp.arrayBuffer());
        return persistBuffer(buffer, "png", "image/png");
      }
    } catch { /* fall through */ }
    // Use the temp URL directly as last resort (expires in ~1h, ok for immediate preview)
    console.warn("[StoryImage] Could not download dall-e-3 URL, using it directly");
    return item.url;
  }

  // gpt-image-1 → b64_json → persist
  if (item.b64_json) {
    const buffer = Buffer.from(item.b64_json, "base64");
    return persistBuffer(buffer, "webp", "image/webp");
  }

  return null;
}

// Generate one story slide background image
export async function generateStoryImage(
  slide: StorySlide,
  topic?: string,
): Promise<string | null> {
  if (!ENV.openaiApiKey) {
    console.warn("[StoryImage] OPENAI_API_KEY not configured — skipping image generation");
    return null;
  }

  const typeHint = TYPE_STYLE[slide.type] ?? "vibrant Instagram Story background";
  const slideContext = buildSlideContext(slide);

  // Rich prompt: includes topic + slide content + visual direction + no-text rule
  const prompt = [
    "Professional Instagram Story background image, vertical 9:16 portrait format.",
    topic ? `Main topic: ${topic}.` : null,
    `Visual scene: ${slide.visual_prompt}.`,
    `Story context: ${slideContext}.`,
    `Design style: ${typeHint}.`,
    "IMPORTANT: NO text, NO words, NO letters, NO numbers anywhere in the image.",
    "Photorealistic or high-quality digital art. Cinematic composition, professional social media quality.",
  ].filter(Boolean).join(" ");

  const primaryModel = ENV.openaiImageModel; // default "gpt-image-1"

  // 1. Try primary model (e.g. gpt-image-1)
  try {
    const url = await callOpenAI(prompt, primaryModel);
    if (url) {
      console.log(`[StoryImage] Success with ${primaryModel} for type=${slide.type}`);
      return url;
    }
  } catch (err) {
    console.warn(`[StoryImage] Primary model ${primaryModel} threw:`, err);
  }

  // 2. Fallback to dall-e-3 if primary isn't already dall-e-3
  if (primaryModel !== "dall-e-3") {
    try {
      console.log("[StoryImage] Falling back to dall-e-3...");
      const url = await callOpenAI(prompt, "dall-e-3");
      if (url) {
        console.log("[StoryImage] Success with dall-e-3");
        return url;
      }
    } catch (err) {
      console.warn("[StoryImage] dall-e-3 fallback threw:", err);
    }
  }

  console.error(`[StoryImage] All models failed for type=${slide.type}`);
  return null;
}

// Generate images for all slides in parallel; returns array aligned to input
export async function generateSlideImages(
  slides: StorySlide[],
  topic?: string,
): Promise<Array<string | null>> {
  return Promise.all(slides.map((s) => generateStoryImage(s, topic)));
}
