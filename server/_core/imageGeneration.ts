import fs from "fs";
import path from "path";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  referenceImageUrl?: string; // ← adicionar isso
};

export type GenerateImageResponse = {
  url?: string;
};

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (ENV.openaiApiKey) {
    const response = await fetch(
      `${ENV.openaiApiBaseUrl.replace(/\/$/, "")}/images/generations`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ENV.openaiImageModel,
          prompt: options.prompt,
          size: "1024x1024",
          quality: "medium",
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenAI image generation failed (${response.status}): ${detail}`);
    }

    const result = (await response.json()) as {
      data?: Array<{ b64_json?: string }>;
    };

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("No image returned from OpenAI image generation");
    }

    const buffer = Buffer.from(b64, "base64");
    const filename = `${Date.now()}.png`;

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

    return { url: `/uploads/${filename}` };
  }

  if (!ENV.hfToken) {
    throw new Error("OPENAI_API_KEY is not configured for images, and HF_TOKEN fallback is also missing");
  }

  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: options.prompt,
        num_inference_steps: 4,
        width: 1080,
        height: 1080,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Image generation request failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json: string }>;
  };

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from HuggingFace API");

  const buffer = Buffer.from(b64, "base64");
  const filename = `${Date.now()}.png`;

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  return { url: `/uploads/${filename}` };
}
