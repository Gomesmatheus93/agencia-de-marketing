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

type HeyGenEnvelope = {
  error?: { message?: string; code?: number } | null;
  data?: unknown;
  code?: number;
  message?: string;
};

function parseEnvelope<T>(text: string, label: string): T {
  let envelope: HeyGenEnvelope;
  try {
    envelope = JSON.parse(text) as HeyGenEnvelope;
  } catch {
    throw new Error(`HeyGen ${label}: resposta não-JSON — ${text.slice(0, 300)}`);
  }
  // code 100 = sucesso; undefined = outros formatos da API que só usam HTTP status
  const ok = (envelope.code === 100 || envelope.code === undefined) && !envelope.error;
  if (!ok) {
    const msg = envelope.error?.message ?? envelope.message ?? `código ${envelope.code}`;
    throw new Error(`HeyGen ${label}: ${msg}`);
  }
  return envelope.data as T;
}

async function heyGenFetch(url: string, init: RequestInit): Promise<Response> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = { "X-Api-Key": apiKey };
  if (init.headers) Object.assign(headers, init.headers);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    // Pode ser HTML de 404 — extraímos texto legível
    const msg = body.includes("<html") ? `HTTP ${res.status}` : body.slice(0, 200);
    throw new Error(`HeyGen HTTP ${res.status}: ${msg}`);
  }
  return res;
}

// Cria o Talking Photo enviando a imagem diretamente via multipart — sem etapa de asset separada
async function createTalkingPhoto(buffer: Buffer, contentType: string): Promise<string> {
  const apiKey = getApiKey();
  const ext = contentType === "image/jpeg" ? "jpg" : "png";

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: contentType }),
    `avatar.${ext}`
  );

  const res = await fetch(`${HEYGEN_API}/v1/talking_photo`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    const msg = body.includes("<html") ? `HTTP ${res.status}` : body.slice(0, 200);
    throw new Error(`HeyGen talking_photo: ${msg}`);
  }

  const text = await res.text();
  type PhotoData = { talking_photo_id?: string; id?: string };
  const d = parseEnvelope<PhotoData>(text, "talking_photo");
  const id = d?.talking_photo_id ?? d?.id;
  if (!id) throw new Error("HeyGen talking_photo: ID não retornado na resposta.");
  return id;
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
    const d = parseEnvelope<{ voices?: HeyGenVoice[] }>(text, "voices");
    return d?.voices ?? [];
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

export type CreatedHeyGenVideo = { videoId: string };

export async function createHeyGenAvatarVideo(
  input: CreateHeyGenVideoInput
): Promise<CreatedHeyGenVideo> {
  const talkingPhotoId = await createTalkingPhoto(input.imageBuffer, input.contentType);

  const res = await heyGenFetch(`${HEYGEN_API}/v2/video/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: "talking_photo",
            talking_photo_id: talkingPhotoId,
            talking_photo_style: "square",
            talking_style: input.talkingStyle ?? "expressive",
            expression: "default",
            scale: 1.0,
            matting: false,
          },
          voice: {
            type: "text",
            input_text: input.script,
            voice_id: input.voiceId,
            speed: 1.0,
            emotion: input.emotion ?? "Friendly",
          },
        },
      ],
      dimension: { width: 1080, height: 1920 },
    }),
  });

  const text = await res.text();
  const d = parseEnvelope<{ video_id?: string }>(text, "video/generate");
  if (!d?.video_id) throw new Error("HeyGen video/generate: video_id não retornado.");
  return { videoId: d.video_id };
}

export async function waitForHeyGenCompletion(
  videoId: string,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<{ resultUrl: string }> {
  const maxAttempts = options?.maxAttempts ?? 36;
  const delayMs = options?.delayMs ?? 8000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await heyGenFetch(
      `${HEYGEN_API}/v1/video_status.get?video_id=${videoId}`,
      { method: "GET" }
    );
    const text = await res.text();
    type StatusData = { status?: string; video_url?: string; error?: string };
    const d = parseEnvelope<StatusData>(text, "video_status");

    if (d.status === "completed" && d.video_url) return { resultUrl: d.video_url };
    if (d.status === "failed") throw new Error(`HeyGen falhou: ${d.error ?? "erro desconhecido"}`);

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
