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
    const isHtml = body.includes("<html") || body.includes("<!DOCTYPE");
    const msg = isHtml ? `HTTP ${res.status}` : body.slice(0, 200);
    throw new Error(`HeyGen HTTP ${res.status}: ${msg}`);
  }
  return res;
}

async function listTalkingPhotoIds(): Promise<string[]> {
  try {
    const res = await heyGenFetch(`${HEYGEN_API}/v2/talking_photo`, { method: "GET" });
    const text = await res.text();
    type ListData = { talking_photo_list?: Array<{ talking_photo_id?: string }> };
    const d = parseEnvelope<ListData>(text, "talking_photo_list");
    return (d?.talking_photo_list ?? []).map((p) => p.talking_photo_id ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

export async function deleteHeyGenTalkingPhoto(id: string): Promise<void> {
  try {
    await heyGenFetch(`${HEYGEN_API}/v2/talking_photo/${id}`, { method: "DELETE" });
  } catch {
    // best-effort cleanup
  }
}

async function createTalkingPhoto(buffer: Buffer, contentType: "image/jpeg" | "image/png"): Promise<string> {
  const apiKey = getApiKey();

  const tryUpload = async (): Promise<string | null> => {
    const res = await fetch("https://upload.heygen.com/v1/talking_photo", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": contentType,
      },
      body: new Uint8Array(buffer),
    });

    const bodyText = await res.text();

    if (!res.ok) {
      // Limit exceeded — signal for cleanup and retry
      if (bodyText.includes("401028") || bodyText.toLowerCase().includes("exceeded your limit")) {
        return null;
      }
      const isHtml = bodyText.includes("<html") || bodyText.includes("<!DOCTYPE");
      const msg = isHtml ? `HTTP ${res.status}` : bodyText.slice(0, 200);
      throw new Error(`HeyGen talking_photo upload: ${msg}`);
    }

    let json: { code?: number; data?: { talking_photo_id?: string }; error?: { message?: string; code?: number } };
    try {
      json = JSON.parse(bodyText);
    } catch {
      throw new Error(`HeyGen talking_photo upload: resposta não-JSON — ${bodyText.slice(0, 200)}`);
    }

    if (json.code === 401028 || json.error?.code === 401028) {
      return null; // limit exceeded
    }

    if ((json.code !== 100 && json.code != null) || json.error) {
      throw new Error(`HeyGen talking_photo upload: ${json.error?.message ?? `código ${json.code}`}`);
    }

    const talkingPhotoId = json.data?.talking_photo_id;
    if (!talkingPhotoId) throw new Error("HeyGen talking_photo upload: talking_photo_id não retornado.");
    return talkingPhotoId;
  };

  const firstAttempt = await tryUpload();
  if (firstAttempt !== null) return firstAttempt;

  // Limit reached — delete all accumulated talking photos and retry once
  const existingIds = await listTalkingPhotoIds();
  await Promise.all(existingIds.map((id) => deleteHeyGenTalkingPhoto(id)));

  const retryAttempt = await tryUpload();
  if (retryAttempt === null) {
    throw new Error("HeyGen: limite de photo avatars atingido. Delete os avatars antigos no painel da HeyGen e tente novamente.");
  }
  return retryAttempt;
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

export type CreatedHeyGenVideo = { videoId: string; talkingPhotoId: string };

export async function createHeyGenAvatarVideo(
  input: CreateHeyGenVideoInput
): Promise<CreatedHeyGenVideo> {
  if (!input.voiceId) {
    throw new Error("Selecione uma voz antes de gerar o vídeo com HeyGen.");
  }

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
            talking_style: input.talkingStyle ?? "expressive",
            scale: 1.0,
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
  return { videoId: d.video_id, talkingPhotoId };
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
    type StatusData = { status?: string; video_url?: string; error?: unknown };
    const d = parseEnvelope<StatusData>(text, "video_status");

    if (d.status === "completed" && d.video_url) return { resultUrl: d.video_url };
    if (d.status === "failed") {
      const errMsg = d.error == null
        ? "erro desconhecido"
        : typeof d.error === "string"
          ? d.error
          : JSON.stringify(d.error);
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
