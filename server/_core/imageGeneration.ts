import fs from "fs";
import path from "path";
import { ENV } from "./env";

export type ImageStyle = "commercial" | "produto" | "banner" | "social" | "logo" | "lifestyle";
export type ImageSize = "1:1" | "4:5" | "16:9";

export type GenerateImageOptions = {
  prompt: string;
  referenceImageUrl?: string;
  style?: ImageStyle;
  size?: ImageSize;
};

const STYLE_INSTRUCTIONS: Record<ImageStyle, string> = {
  commercial: `Create a complete professional advertisement graphic design (not just a photo).
Layout: bold headline text overlaid on image, product hero shot, marketing tagline, price or offer if mentioned, CTA button area.
Style: dark dramatic background, high contrast, cinematic lighting on product, ultra-sharp details.
Typography: large bold modern font for headline, clean sans-serif for body copy.
Quality: professional ad agency level, social media ready, Brazilian marketing aesthetic.`,

  produto: `Create a complete product advertisement graphic (like a professional e-commerce ad or social media sale post).
Layout: product image as hero centered or angled, large bold product name as headline text, price prominently displayed (big, bold), 3-4 feature bullet points with icons on the side, "Compre Agora" or relevant CTA button at bottom.
Style: dark or gradient background (black/navy/charcoal), electric accent color (blue, orange or brand color), high contrast, dramatic product lighting.
Typography: ultra-bold headline, clean supporting text.
Quality: professional Brazilian digital marketing ad, Instagram/Facebook ad level.`,

  banner: `Create a complete advertising banner graphic design.
Layout: strong bold headline text as focal point, supporting subheadline, product or offer image, prominent CTA button, logo area.
Style: high contrast color scheme, bold typography hierarchy, modern graphic design elements (geometric shapes, gradients, lines).
Typography: massive bold font for main message, clean readable body text.
Quality: professional agency-level banner, print and digital ready.`,

  social: `Create a complete social media advertisement post design (Instagram/Facebook ad style).
Layout: eye-catching headline overlaid on image, product or person featured prominently, price or offer badge if relevant, CTA text, brand colors.
Style: modern trendy aesthetic, high saturation, bold typography over image, clean composition.
Typography: large impactful headline, supporting text, hashtag area.
Quality: thumb-stopping social media ad, professionally designed, Brazilian audience.`,

  logo: `Create a professional logo / brand mark design.
Layout: centered symbol or wordmark, clean negative space, balanced composition.
Style: minimalist, vector-clean, timeless, works on white background.
Typography: strong brand typeface if wordmark, geometric or custom letterforms.
Quality: professional brand identity design, scalable, versatile.`,

  lifestyle: `Create a lifestyle commercial photograph with professional advertising quality.
Scene: authentic real-life context with product or service naturally integrated, diverse relatable people if applicable.
Style: natural warm lighting, shallow depth of field, cinematic color grade, editorial magazine quality.
Mood: aspirational, authentic, energetic or calm depending on product.
Quality: high-end advertising campaign photography, Brazilian lifestyle aesthetic.`,
};

const SIZE_MAP: Record<ImageSize, string> = {
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "16:9": "1536x1024",
};

// All posts are 1080x1350 (4:5) for Instagram by default
const DEFAULT_API_SIZE = "1024x1536";

function buildEnhancedPrompt(prompt: string, style?: ImageStyle): string {
  const instructions = style
    ? STYLE_INSTRUCTIONS[style]
    : STYLE_INSTRUCTIONS.commercial;
  return `${instructions}\n\nUser request: ${prompt}`;
}

function buildReferencePrompt(prompt: string, style?: ImageStyle): string {
  const instructions = style
    ? STYLE_INSTRUCTIONS[style]
    : STYLE_INSTRUCTIONS.commercial;
  return `IMPORTANT — BRAND REFERENCE IMAGE: The attached image is a REFERENCE ONLY for brand identity (logo, colors, visual style, product). Do NOT copy, reproduce or edit this image. Use it only to extract brand elements (logo, colors, typography style) and create a completely NEW original advertisement design from scratch.

${instructions}

User request: ${prompt}`;
}

export type GenerateImageResponse = {
  url?: string;
};

type StorageAsset = {
  data: Buffer;
  contentType: string;
  extension: string;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function getExtensionFromMimeType(mimeType: string) {
  return MIME_EXTENSION_MAP[mimeType] || "png";
}

function parseDataUrl(dataUrl: string): StorageAsset | undefined {
  if (!dataUrl.startsWith("data:")) return undefined;

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return undefined;

  const header = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const headerParts = header.split(";").filter(Boolean);
  const mimeType = headerParts[0] || "image/png";
  const isBase64 = headerParts.includes("base64");
  const buffer = isBase64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));

  return {
    data: buffer,
    contentType: mimeType,
    extension: getExtensionFromMimeType(mimeType),
  };
}

function getUploadsAssetPath(assetUrl: string) {
  if (assetUrl.startsWith("/uploads/")) {
    return assetUrl;
  }

  if (!/^https?:\/\//i.test(assetUrl)) {
    return undefined;
  }

  try {
    const parsed = new URL(assetUrl);
    return parsed.pathname.startsWith("/uploads/") ? parsed.pathname : undefined;
  } catch {
    return undefined;
  }
}

function readUploadsAsset(assetUrl: string): StorageAsset | undefined {
  const uploadsAssetPath = getUploadsAssetPath(assetUrl);
  if (!uploadsAssetPath) return undefined;

  const absolutePath = path.resolve(process.cwd(), uploadsAssetPath.replace(/^\/+/, ""));
  const uploadsRoot = path.resolve(process.cwd(), "uploads");

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`) && absolutePath !== uploadsRoot) {
    throw new Error(`Invalid uploads path: ${uploadsAssetPath}`);
  }

  const data = fs.readFileSync(absolutePath);
  const extension = path.extname(absolutePath).replace(/^\./, "").toLowerCase() || "png";
  const contentType =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : extension === "gif"
          ? "image/gif"
          : "image/png";

  return { data, contentType, extension };
}

const OPENAI_SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function readRemoteAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  if (!/^https?:\/\//i.test(assetUrl)) {
    return undefined;
  }

  const response = await fetch(assetUrl, {
    headers: { Accept: "image/jpeg,image/png,image/webp,image/*" },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch reference image (${response.status} ${response.statusText})`
    );
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!mimeType.startsWith("image/")) {
    throw new Error("Reference image URL did not return an image file");
  }

  if (!OPENAI_SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new Error(
      `Formato de imagem não suportado: ${mimeType}. Use JPEG, PNG ou WEBP como referência.`
    );
  }

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: mimeType,
    extension: getExtensionFromMimeType(mimeType),
  };
}

async function resolveReferenceImageAsset(
  referenceImageUrl?: string
): Promise<StorageAsset | undefined> {
  if (!referenceImageUrl) return undefined;

  const dataUrlAsset = parseDataUrl(referenceImageUrl);
  if (dataUrlAsset) return dataUrlAsset;

  const uploadsAsset = readUploadsAsset(referenceImageUrl);
  if (uploadsAsset) return uploadsAsset;

  return readRemoteAsset(referenceImageUrl);
}

function persistGeneratedImage(b64: string, ext = "webp") {
  const buffer = Buffer.from(b64, "base64");
  const filename = `${Date.now()}.${ext}`;

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return { url: `/uploads/${filename}` };
}

async function generateWithOpenAI(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const referenceAsset = await resolveReferenceImageAsset(options.referenceImageUrl);
  const hasReference = Boolean(referenceAsset);

  // Always use the edits endpoint when a reference is present (so the model can see the image),
  // but the prompt explicitly instructs it to create a new design, not modify the reference.
  const endpoint = hasReference ? "/images/edits" : "/images/generations";
  const url = `${ENV.openaiApiBaseUrl.replace(/\/$/, "")}${endpoint}`;

  // Always 1024x1536 (closest to Instagram's 1080×1350 / 4:5)
  const apiSize = options.size ? SIZE_MAP[options.size] : DEFAULT_API_SIZE;

  const prompt = hasReference
    ? buildReferencePrompt(options.prompt, options.style)
    : buildEnhancedPrompt(options.prompt, options.style);

  const requestInit: RequestInit = hasReference
    ? (() => {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(referenceAsset!.data)], {
          type: referenceAsset!.contentType,
        });

        formData.append("model", ENV.openaiImageModel);
        formData.append("prompt", prompt);
        formData.append("size", apiSize);
        formData.append("quality", "high");
        formData.append("output_format", "webp");
        formData.append("output_compression", "92");
        formData.append("image", blob, `reference.${referenceAsset!.extension}`);

        return {
          method: "POST",
          headers: { Authorization: `Bearer ${ENV.openaiApiKey}` },
          body: formData,
        };
      })()
    : {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ENV.openaiImageModel,
          prompt,
          size: apiSize,
          quality: "high",
          output_format: "webp",
          output_compression: 92,
          response_format: "b64_json",
        }),
      };

  const response = await fetch(url, requestInit);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI image ${hasReference ? "edit" : "generation"} failed (${response.status}): ${detail}`
    );
  }

  const result = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(
      `No image returned from OpenAI image ${hasReference ? "edit" : "generation"}`
    );
  }

  return persistGeneratedImage(b64);
}

async function generateWithHuggingFace(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
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
  if (!b64) {
    throw new Error("No image returned from HuggingFace API");
  }

  return persistGeneratedImage(b64);
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (ENV.openaiApiKey) {
    return generateWithOpenAI(options);
  }

  if (!ENV.hfToken) {
    throw new Error(
      "OPENAI_API_KEY is not configured for images, and HF_TOKEN fallback is also missing"
    );
  }

  return generateWithHuggingFace(options);
}
