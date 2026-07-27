import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";
import { storagePut } from "../storage";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Per-type visual direction appended to the LLM visual_prompt
const TYPE_STYLE: Record<string, string> = {
  poll:               "bold graphic design, vivid contrasting colors, high-contrast composition, eye-catching split layout",
  quiz:               "playful colorful geometry, bright energetic palette, fun atmosphere, dynamic shapes",
  countdown:          "dramatic cinematic lighting, epic atmosphere, strong sense of urgency and anticipation, moody",
  question_box:       "warm inviting tones, soft pastel background, approachable lifestyle, friendly mood",
  behind_scenes:      "candid authentic mood, warm golden hour lighting, lifestyle photography, natural environment",
  post_reinforcement: "modern professional design, clean bold aesthetic, strong visual impact, branded look",
};

interface OpenAIImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
}

async function persistBuffer(buffer: Buffer, ext: string, contentType: string): Promise<string> {
  const filename = `story-${randomUUID()}.${ext}`;
  try {
    const result = await storagePut(`stories/${filename}`, buffer, contentType);
    return result.url;
  } catch {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    return `/uploads/${filename}`;
  }
}

export async function generateStoryImage(
  visualPrompt: string,
  slideType: string,
  topic?: string,
): Promise<string | null> {
  if (!ENV.openaiApiKey) return null;

  const typeHint = TYPE_STYLE[slideType] ?? "vibrant Instagram Story background";

  // Build a rich prompt: topic + slide visual direction + no-text rules
  const prompt = [
    "Instagram Story background image, vertical 9:16 portrait format.",
    topic ? `Main subject context: ${topic}.` : null,
    `Scene: ${visualPrompt}.`,
    `Visual style: ${typeHint}.`,
    "Absolutely NO text, NO words, NO letters, NO numbers, NO watermarks anywhere in the image.",
    "High quality, professional photography or digital art. Cinematic composition, striking colors.",
  ].filter(Boolean).join(" ");

  const model = ENV.openaiImageModel;
  const isDalle3 = model === "dall-e-3";

  const body: Record<string, unknown> = { model, prompt, n: 1 };

  if (isDalle3) {
    // 1024x1792 ≈ 9:16 — best for Stories
    body.size = "1024x1792";
    body.quality = "hd";
    body.response_format = "url";
  } else {
    // gpt-image-1: 1024x1536 (portrait, 2:3)
    body.size = "1024x1536";
    body.quality = "high";
    body.output_format = "png";
  }

  try {
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
      console.warn(`[StoryImage] OpenAI ${resp.status}: ${(await resp.text().catch(() => "")).slice(0, 300)}`);
      return null;
    }

    const data = (await resp.json()) as OpenAIImageResponse;
    const item = data.data?.[0];
    if (!item) return null;

    // DALL-E 3 returns a temporary URL — download and persist it
    if (item.url) {
      try {
        const imgResp = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
        if (imgResp.ok) {
          const buffer = Buffer.from(await imgResp.arrayBuffer());
          return persistBuffer(buffer, "png", "image/png");
        }
      } catch { /* fall through */ }
      // Last resort: return temp URL (will expire)
      return item.url;
    }

    // gpt-image-1 returns b64_json — persist and return stored URL
    if (item.b64_json) {
      const buffer = Buffer.from(item.b64_json, "base64");
      return persistBuffer(buffer, "png", "image/png");
    }

    return null;
  } catch (err) {
    console.error("[StoryImage] Error generating story image:", err);
    return null;
  }
}

// Generate images for all slides in parallel; topic enriches the visual prompt
export async function generateSlideImages(
  slides: Array<{ visual_prompt: string; type: string }>,
  topic?: string,
): Promise<Array<string | null>> {
  return Promise.all(
    slides.map((s) => generateStoryImage(s.visual_prompt, s.type, topic)),
  );
}
