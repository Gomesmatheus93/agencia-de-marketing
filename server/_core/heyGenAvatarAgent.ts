import path from "node:path";
import fs from "node:fs/promises";
import { ENV } from "./env";

const HEYGEN_API = "https://api.heygen.com";
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function getApiKey(): string {
  if (!ENV.heyGenApiKey) {
    throw new Error("HEYGEN_API_KEY não configurada. Adicione ao .env para usar o motor HeyGen.");
  }
  return ENV.heyGenApiKey;
}

async function heyGenFetch(url: string, init: RequestInit): Promise<Response> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = { "X-Api-Key": apiKey };
  if (init.headers) Object.assign(headers, init.headers);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    const isHtml = body.includes("<html") || body.includes("<!DOCTYPE");
    const msg = isHtml ? `HTTP ${res.status}` : body.slice(0, 300);
    throw new Error(`HeyGen HTTP ${res.status}: ${msg}`);
  }
  return res;
}

// V3: cria photo avatar enviando a imagem como base64 inline (evita problemas de upload multipart)
async function createV3PhotoAvatar(
  name: string,
  buffer: Buffer,
  contentType: string
): Promise<{ avatarId: string; groupId: string }> {
  const mediaType = contentType === "image/png" ? "image/png" : "image/jpeg";
  const base64Data = buffer.toString("base64");

  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "photo",
      name,
      file: { type: "base64", media_type: mediaType, data: base64Data },
    }),
  });

  const json = await res.json() as {
    data?: {
      avatar_item?: { id?: string };
      avatar_group?: { id?: string };
    };
    error?: { message?: string };
  };

  if (json.error) {
    throw new Error(`HeyGen create avatar: ${json.error.message ?? JSON.stringify(json.error)}`);
  }

  const avatarId = json.data?.avatar_item?.id;
  if (!avatarId) throw new Error(`HeyGen create avatar: avatar_id não retornado. ${JSON.stringify(json)}`);
  return { avatarId, groupId: json.data?.avatar_group?.id ?? "" };
}

// V3: deleta photo avatar (limpeza após uso)
export async function deleteHeyGenAvatar(avatarId: string): Promise<void> {
  try {
    await heyGenFetch(`${HEYGEN_API}/v3/avatars/${avatarId}`, { method: "DELETE" });
  } catch {
    // best-effort cleanup
  }
}

// Mantém compatibilidade com routers.ts existente
export const deleteHeyGenTalkingPhoto = deleteHeyGenAvatar;

// V3: gera vídeo com o avatar criado
async function generateV3Video(input: {
  avatarId: string;
  script: string;
  voiceId: string;
  emotion?: string;
}): Promise<string> {
  const res = await heyGenFetch(`${HEYGEN_API}/v3/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "avatar",
      avatar_id: input.avatarId,
      script: input.script,
      voice_id: input.voiceId,
      resolution: "1080p",
      aspect_ratio: "9:16",
      expressiveness: "high",
      remove_background: false,
      motion_prompt:
        "natural conversational movement, direct eye contact with camera, warm and engaging expression, subtle natural hand gestures",
      voice_settings: {
        emotion: input.emotion ?? "Friendly",
        speed: 1.0,
      },
    }),
  });

  const json = await res.json() as { data?: { video_id?: string }; error?: { message?: string } };
  const videoId = json.data?.video_id;
  if (!videoId) throw new Error(`HeyGen video generate: video_id não retornado. ${JSON.stringify(json)}`);
  return videoId;
}

export type HeyGenVoice = {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio?: string;
};

export async function listHeyGenVoices(): Promise<HeyGenVoice[]> {
  try {
    const res = await heyGenFetch(`${HEYGEN_API}/v2/voices`, { method: "GET" });
    const text = await res.text();
    let parsed: { code?: number; data?: { voices?: HeyGenVoice[] } };
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
    return parsed.data?.voices ?? [];
  } catch {
    return [];
  }
}

export type CreateHeyGenVideoInput = {
  userId: number;
  imageBuffer: Buffer;
  contentType: "image/jpeg" | "image/png";
  script: string;
  voiceId: string;
  emotion?: "Excited" | "Friendly" | "Serious" | "Soothing" | "Broadcaster";
  talkingStyle?: "expressive" | "stable";
};

export type CreatedHeyGenVideo = { videoId: string; talkingPhotoId: string };

export async function createHeyGenAvatarVideo(
  input: CreateHeyGenVideoInput
): Promise<CreatedHeyGenVideo> {
  if (!input.voiceId) {
    throw new Error("Selecione uma voz antes de gerar o vídeo com HeyGen.");
  }

  // 1. Cria photo avatar V3 com base64 inline (qualidade do site, sem upload separado)
  const avatarName = `av-${input.userId}-${Date.now()}`;
  const { avatarId } = await createV3PhotoAvatar(avatarName, input.imageBuffer, input.contentType);

  // 3. Inicia geração do vídeo V3
  const videoId = await generateV3Video({
    avatarId,
    script: input.script,
    voiceId: input.voiceId,
    emotion: input.emotion,
  });

  return { videoId, talkingPhotoId: avatarId };
}

export async function waitForHeyGenCompletion(
  videoId: string,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<{ resultUrl: string }> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const delayMs = options?.delayMs ?? 10000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await heyGenFetch(`${HEYGEN_API}/v3/videos/${videoId}`, { method: "GET" });
    const json = await res.json() as {
      data?: { status?: string; video_url?: string; error?: unknown };
    };

    const status = json.data?.status;
    const videoUrl = json.data?.video_url;

    if (status === "completed" && videoUrl) return { resultUrl: videoUrl };
    if (status === "failed") {
      const errMsg =
        json.data?.error == null
          ? "erro desconhecido"
          : typeof json.data.error === "string"
            ? json.data.error
            : JSON.stringify(json.data.error);
      throw new Error(`HeyGen falhou: ${errMsg}`);
    }

    if (attempt < maxAttempts) await sleep(delayMs);
  }

  throw new Error("HeyGen demorou mais do que o esperado para concluir o vídeo.");
}

export async function downloadAndStoreHeyGenVideo(input: {
  userId: number;
  videoId: number;
  resultUrl: string;
}): Promise<{ videoUrl: string }> {
  const res = await fetch(input.resultUrl);
  if (!res.ok) throw new Error(`Falha ao baixar vídeo do HeyGen (${res.status})`);

  const relativePath = path.posix.join(
    "videos",
    String(input.userId),
    "renders",
    `video-${input.videoId}-heygen.mp4`
  );
  const absolutePath = path.resolve(UPLOADS_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(await res.arrayBuffer()));

  return { videoUrl: `/uploads/${relativePath}` };
}
