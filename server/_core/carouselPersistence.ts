import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CarouselAgentSlide } from "./carouselAgent";
import type { CarouselSlideData } from "../../drizzle/schema";
import { storagePut } from "../storage";

type PersistCarouselAssetsInput = {
  userId: number;
  coverImageUrl?: string;
  slides: CarouselAgentSlide[];
};

type PersistedCarouselAssets = {
  coverImageUrl?: string;
  slides: CarouselAgentSlide[];
};

type PersistCarouselDesignAssetsInput = {
  userId: number;
  carouselId: number;
  slides: Array<{
    title: string;
    body?: string;
    imageUrl?: string;
    designTemplateName?: string;
    designTemplateUrl?: string;
    designStyleBrief?: string;
    templateSvg?: string;
    renderedImageDataUrl?: string;
    templateSvgUrl?: string;
    renderedImageUrl?: string;
    fontFamily?: string;
    accentColor?: string;
    backgroundColor?: string;
    editorSettings?: CarouselSlideData["editorSettings"];
  }>;
};

type PersistedCarouselDesignAssets = {
  slides: CarouselSlideData[];
};

type StorageAsset = {
  data: Buffer;
  contentType: string;
  extension: string;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function getExtensionFromMimeType(mimeType: string) {
  return MIME_EXTENSION_MAP[mimeType] || "bin";
}

function getMimeTypeFromExtension(extension: string) {
  const normalized = extension.replace(/^\./, "").toLowerCase();

  switch (normalized) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
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

async function readUploadsAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  const uploadsAssetPath = getUploadsAssetPath(assetUrl);
  if (!uploadsAssetPath) return undefined;

  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const filePath = path.resolve(process.cwd(), uploadsAssetPath.replace(/^\/+/, ""));

  if (!filePath.startsWith(`${uploadsRoot}${path.sep}`) && filePath !== uploadsRoot) {
    throw new Error(`Invalid uploads path: ${uploadsAssetPath}`);
  }

  const data = await fs.readFile(filePath);
  const extension = path.extname(filePath).replace(/^\./, "").toLowerCase() || "bin";

  return {
    data,
    contentType: getMimeTypeFromExtension(extension),
    extension,
  };
}

async function readRemoteAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  if (!/^https?:\/\//i.test(assetUrl)) {
    return undefined;
  }

  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote asset (${response.status} ${response.statusText})`);
  }

  const parsedUrl = new URL(assetUrl);
  const responseMimeType = response.headers.get("content-type")?.split(";")[0]?.trim();
  const extension =
    responseMimeType
      ? getExtensionFromMimeType(responseMimeType)
      : path.extname(parsedUrl.pathname).replace(/^\./, "").toLowerCase() || "bin";

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: responseMimeType || getMimeTypeFromExtension(extension),
    extension,
  };
}

async function resolveStorageAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  return parseDataUrl(assetUrl) || await readUploadsAsset(assetUrl);
}

async function resolveAnyAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  return (await resolveStorageAsset(assetUrl)) || await readRemoteAsset(assetUrl);
}

async function writeUploadsAsset(input: {
  asset: StorageAsset;
  batchId: string;
  filePrefix: string;
  userId: number;
}) {
  const safePrefix = input.filePrefix.replace(/[^a-zA-Z0-9._-]/g, "-") || "asset";
  const directory = path.resolve(
    UPLOADS_ROOT,
    "carousels",
    String(input.userId),
    input.batchId,
    "sources"
  );

  if (!directory.startsWith(`${UPLOADS_ROOT}${path.sep}`) && directory !== UPLOADS_ROOT) {
    throw new Error(`Invalid uploads path: ${directory}`);
  }

  await fs.mkdir(directory, { recursive: true });

  const filePath = path.resolve(directory, `${safePrefix}.${input.asset.extension}`);
  if (!filePath.startsWith(`${UPLOADS_ROOT}${path.sep}`)) {
    throw new Error(`Invalid uploads path: ${filePath}`);
  }

  await fs.writeFile(filePath, input.asset.data);
  return `/uploads/${path.relative(UPLOADS_ROOT, filePath).replace(/\\/g, "/")}`;
}

export async function persistCarouselAssets(
  input: PersistCarouselAssetsInput
): Promise<PersistedCarouselAssets> {
  const batchId = randomUUID();
  const cache = new Map<string, string>();

  const persistAssetUrl = async (assetUrl: string | undefined, filePrefix: string) => {
    if (!assetUrl) return undefined;
    if (cache.has(assetUrl)) return cache.get(assetUrl);

    let persistedUrl = assetUrl;

    try {
      const dataUrlAsset = parseDataUrl(assetUrl);
      if (dataUrlAsset) {
        persistedUrl = await writeUploadsAsset({
          asset: dataUrlAsset,
          batchId,
          filePrefix,
          userId: input.userId,
        });
      }
    } catch (error) {
      console.warn("[Carousel] Failed to save local source asset, keeping original URL:", error);
    }

    cache.set(assetUrl, persistedUrl);
    return persistedUrl;
  };

  const slides: CarouselAgentSlide[] = [];

  for (let index = 0; index < input.slides.length; index += 1) {
    const slide = input.slides[index];
    slides.push({
      ...slide,
      imageUrl: await persistAssetUrl(slide.imageUrl, `slide-${String(index + 1).padStart(2, "0")}`),
    });
  }

  const coverImageUrl =
    (await persistAssetUrl(input.coverImageUrl, "cover")) || slides[0]?.imageUrl;

  return {
    coverImageUrl,
    slides,
  };
}

export async function persistCarouselDesignAssets(
  input: PersistCarouselDesignAssetsInput
): Promise<PersistedCarouselDesignAssets> {
  const slides: CarouselSlideData[] = [];

  for (let index = 0; index < input.slides.length; index += 1) {
    const slide = input.slides[index];
    let renderedImageUrl = slide.renderedImageUrl;

    if (slide.renderedImageDataUrl) {
      const renderedAsset = parseDataUrl(slide.renderedImageDataUrl);
      if (!renderedAsset) {
        throw new Error(`Invalid rendered image data URL for slide ${index + 1}`);
      }

      const uploadedRendered = await storagePut(
        `carousels/${input.userId}/${input.carouselId}/rendered/slide-${String(index + 1).padStart(2, "0")}.${renderedAsset.extension}`,
        renderedAsset.data,
        renderedAsset.contentType
      );
      renderedImageUrl = uploadedRendered.url;
    }

    slides.push({
      title: slide.title,
      body: slide.body || "",
      imageUrl: slide.imageUrl,
      designTemplateName: slide.designTemplateName,
      designTemplateUrl: slide.designTemplateUrl,
      designStyleBrief: slide.designStyleBrief,
      templateSvgUrl: slide.templateSvgUrl,
      renderedImageUrl,
      fontFamily: slide.fontFamily,
      accentColor: slide.accentColor,
      backgroundColor: slide.backgroundColor,
      editorSettings: slide.editorSettings,
    });
  }

  return { slides };
}

export async function getCarouselAssetDataUrl(assetUrl: string) {
  const asset = await resolveAnyAsset(assetUrl);
  if (!asset) return undefined;
  return `data:${asset.contentType};base64,${asset.data.toString("base64")}`;
}

export async function persistSingleCarouselImage(input: {
  userId: number;
  imageDataUrl: string;
}): Promise<string> {
  const asset = parseDataUrl(input.imageDataUrl);
  if (!asset) throw new Error("Invalid image data URL");
  return writeUploadsAsset({
    asset,
    batchId: randomUUID(),
    filePrefix: "editor-image",
    userId: input.userId,
  });
}
