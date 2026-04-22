import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ENV } from "./env";

type StorageAsset = {
  data: Buffer;
  contentType: string;
  extension: string;
};

type DidApiResponse = {
  id?: string;
  url?: string;
  kind?: string;
  status?: string;
  result_url?: string;
  message?: string;
  details?: Record<string, { message?: string } | string>;
  error?: {
    description?: string;
    kind?: string;
  };
};

export type CreateDidTalkInput = {
  sourceImageUrl: string;
  script: string;
  voiceProvider?: string;
  voiceId?: string;
};

export type CreatedDidTalk = {
  talkId: string;
  sourceImageUrl: string;
  voiceProvider: string;
  voiceId: string;
};

export type PreparedDidSourceImage = {
  previewSourceImageUrl: string;
  providerSourceImageUrl: string;
  imageBuffer: Buffer;
  contentType: "image/jpeg" | "image/png";
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const D_ID_SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function getDidConfig() {
  if (!ENV.didApiKey) {
    throw new Error(
      "DID_API_KEY nao configurada. O token realtime da OpenAI nao substitui a credencial do D-ID para gerar avatar por foto."
    );
  }

  const normalizedApiKey = ENV.didApiKey.trim();
  const authHeader =
    /^basic\s+/i.test(normalizedApiKey) || /^bearer\s+/i.test(normalizedApiKey)
      ? normalizedApiKey
      : normalizedApiKey.includes(":")
        ? `Basic ${Buffer.from(normalizedApiKey).toString("base64")}`
        : `Basic ${Buffer.from(`${normalizedApiKey}:`).toString("base64")}`;

  return {
    baseUrl: ENV.didApiBaseUrl
      .replace(/\/+$/, "")
      .replace(/\/(?:agents|talks)$/i, ""),
    authHeader,
    defaultVoiceProvider: ENV.didDefaultVoiceProvider || "microsoft",
    defaultVoiceId: ENV.didDefaultVoiceId || "pt-BR-FranciscaNeural",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeAssetToUploads(input: {
  relativePath: string;
  data: Buffer;
}) {
  const normalizedRelativePath = input.relativePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(UPLOADS_ROOT, normalizedRelativePath);

  if (
    !absolutePath.startsWith(`${UPLOADS_ROOT}${path.sep}`) &&
    absolutePath !== UPLOADS_ROOT
  ) {
    throw new Error(`Caminho de upload invalido: ${normalizedRelativePath}`);
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.data);

  return `/uploads/${normalizedRelativePath.replace(/\\/g, "/")}`;
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
    extension: MIME_EXTENSION_MAP[mimeType] || "bin",
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
    throw new Error(`Caminho de upload invalido: ${uploadsAssetPath}`);
  }

  const data = await fs.readFile(filePath);
  const extension = path.extname(filePath).replace(/^\./, "").toLowerCase() || "bin";
  const contentType =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : "image/png";

  return { data, contentType, extension };
}

async function readRemoteAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  if (!/^https?:\/\//i.test(assetUrl)) {
    return undefined;
  }

  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar imagem de referencia (${response.status} ${response.statusText})`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const extension = MIME_EXTENSION_MAP[mimeType] || "bin";

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: mimeType,
    extension,
  };
}

async function resolveSourceImageAsset(input: {
  sourceImageUrl?: string;
  sourceImageDataUrl?: string;
}): Promise<StorageAsset> {
  const fromDataUrl = input.sourceImageDataUrl ? parseDataUrl(input.sourceImageDataUrl) : undefined;
  if (fromDataUrl) return fromDataUrl;

  if (!input.sourceImageUrl) {
    throw new Error("Envie a foto da pessoa para gerar o avatar.");
  }

  const fromUploads = await readUploadsAsset(input.sourceImageUrl);
  if (fromUploads) return fromUploads;

  const fromRemote = await readRemoteAsset(input.sourceImageUrl);
  if (fromRemote) return fromRemote;

  throw new Error("Nao consegui ler a imagem enviada para o avatar.");
}

function assertDidSupportedImage(asset: StorageAsset) {
  if (!D_ID_SUPPORTED_IMAGE_TYPES.has(asset.contentType)) {
    throw new Error(
      "O D-ID aceita apenas imagens JPG ou PNG para avatar por foto. Troque a imagem enviada e tente novamente."
    );
  }
}

async function uploadDidSourceImage(asset: StorageAsset) {
  const config = getDidConfig();
  const formData = new FormData();
  const fileName = `avatar.${asset.extension}`;
  const blob = new Blob([new Uint8Array(asset.data)], { type: asset.contentType });
  formData.append("image", blob, fileName);

  const response = await fetch(`${config.baseUrl}/images`, {
    method: "POST",
    headers: {
      Authorization: config.authHeader,
    },
    body: formData,
  });

  const data = await parseDidJson(response);

  if (!response.ok || !data.url) {
    throw new Error(didErrorMessage(response, data));
  }

  return data.url;
}

export async function prepareDidSourceImage(input: {
  userId: number;
  sourceImageUrl?: string;
  sourceImageDataUrl?: string;
}): Promise<PreparedDidSourceImage> {
  const asset = await resolveSourceImageAsset(input);
  assertDidSupportedImage(asset);

  const previewSourceImageUrl = await writeAssetToUploads({
    relativePath: path.posix.join(
      "videos",
      String(input.userId),
      "sources",
      `${randomUUID()}.${asset.extension}`
    ),
    data: asset.data,
  });

  const providerSourceImageUrl = await uploadDidSourceImage(asset);

  return {
    previewSourceImageUrl,
    providerSourceImageUrl,
    imageBuffer: asset.data,
    contentType: asset.contentType as "image/jpeg" | "image/png",
  };
}

async function parseDidJson(response: Response) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as DidApiResponse) : {};
  } catch {
    throw new Error(`Resposta invalida do D-ID: ${text || response.statusText}`);
  }
}

function didErrorMessage(response: Response, data: DidApiResponse) {
  const detailMessage = data.details
    ? Object.entries(data.details)
        .map(([key, value]) => {
          if (typeof value === "string") return `${key}: ${value}`;
          return `${key}: ${value.message || "valor invalido"}`;
        })
        .join("; ")
    : "";
  const description =
    data.error?.description ||
    data.error?.kind ||
    data.message ||
    data.kind ||
    detailMessage;
  return description
    ? `D-ID retornou erro: ${description}`
    : `D-ID retornou erro (${response.status} ${response.statusText})`;
}

export async function createDidTalk(input: CreateDidTalkInput): Promise<CreatedDidTalk> {
  const config = getDidConfig();
  const voiceProvider = input.voiceProvider || config.defaultVoiceProvider;
  const voiceId = input.voiceId || config.defaultVoiceId;

  const response = await fetch(`${config.baseUrl}/talks`, {
    method: "POST",
    headers: {
      Authorization: config.authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_url: input.sourceImageUrl,
      driver_url: "bank://natural/",
      script: {
        type: "text",
        input: input.script,
        provider: {
          type: voiceProvider,
          voice_id: voiceId,
        },
      },
      face: {
        detector: "MaxFace",
      },
      config: {
        stitch: true,
        fluent: true,
        pad_audio: 0.5,
        align_driver: true,
        align_expand_factor: 0.3,
        motion_factor: 0.9,
        sharpen: true,
        output_resolution: 1080,
        result_format: "mp4",
      },
    }),
  });

  const data = await parseDidJson(response);

  if (!response.ok || !data.id) {
    throw new Error(didErrorMessage(response, data));
  }

  return {
    talkId: data.id,
    sourceImageUrl: input.sourceImageUrl,
    voiceProvider,
    voiceId,
  };
}

export async function waitForDidTalkCompletion(
  talkId: string,
  options?: {
    maxAttempts?: number;
    delayMs?: number;
  }
) {
  const config = getDidConfig();
  const maxAttempts = options?.maxAttempts ?? 24;
  const delayMs = options?.delayMs ?? 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${config.baseUrl}/talks/${talkId}`, {
      method: "GET",
      headers: {
        Authorization: config.authHeader,
      },
    });
    const data = await parseDidJson(response);

    if (!response.ok) {
      throw new Error(didErrorMessage(response, data));
    }

    if (data.status === "done" && data.result_url) {
      return {
        resultUrl: data.result_url,
      };
    }

    if (data.status === "error") {
      throw new Error(data.error?.description || "Falha ao renderizar o video no D-ID.");
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  throw new Error("O D-ID demorou mais do que o esperado para concluir o video.");
}

export async function downloadAndStoreDidVideo(input: {
  userId: number;
  videoId: number;
  resultUrl: string;
}) {
  const response = await fetch(input.resultUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar o video final (${response.status} ${response.statusText})`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  const extension = mimeType === "video/webm" ? "webm" : "mp4";
  const videoUrl = await writeAssetToUploads({
    relativePath: path.posix.join(
      "videos",
      String(input.userId),
      "renders",
      `video-${input.videoId}.${extension}`
    ),
    data: Buffer.from(await response.arrayBuffer()),
  });

  return {
    videoUrl,
  };
}
