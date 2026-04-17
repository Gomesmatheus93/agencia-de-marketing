import fs from "fs";
import path from "path";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  referenceImageUrl?: string;
};

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

async function readRemoteAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  if (!/^https?:\/\//i.test(assetUrl)) {
    return undefined;
  }

  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch reference image (${response.status} ${response.statusText})`
    );
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!mimeType.startsWith("image/")) {
    throw new Error("Reference image URL did not return an image file");
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

function persistGeneratedImage(b64: string) {
  const buffer = Buffer.from(b64, "base64");
  const filename = `${Date.now()}.png`;

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return { url: `/uploads/${filename}` };
}

async function generateWithOpenAI(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const referenceAsset = await resolveReferenceImageAsset(options.referenceImageUrl);
  const isEditRequest = Boolean(referenceAsset);
  const endpoint = isEditRequest ? "/images/edits" : "/images/generations";
  const url = `${ENV.openaiApiBaseUrl.replace(/\/$/, "")}${endpoint}`;

  const requestInit: RequestInit = isEditRequest
    ? (() => {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(referenceAsset!.data)], {
          type: referenceAsset!.contentType,
        });

        formData.append("model", ENV.openaiImageModel);
        formData.append("prompt", options.prompt);
        formData.append("size", "1024x1024");
        formData.append("quality", "medium");
        formData.append("image", blob, `reference.${referenceAsset!.extension}`);

        return {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ENV.openaiApiKey}`,
          },
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
          prompt: options.prompt,
          size: "1024x1024",
          quality: "medium",
        }),
      };

  const response = await fetch(url, requestInit);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI image ${isEditRequest ? "edit" : "generation"} failed (${response.status}): ${detail}`
    );
  }

  const result = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(
      `No image returned from OpenAI image ${isEditRequest ? "edit" : "generation"}`
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
