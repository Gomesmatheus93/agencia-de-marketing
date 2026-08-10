import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
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

// O fetch nativo lança TypeError("fetch failed") quando a conexão de rede em si
// falha (DNS, TLS, conexão recusada/resetada) — antes de qualquer resposta HTTP.
// É diferente dos Error de negócio que lançamos abaixo para respostas HTTP com erro.
// Esses casos costumam ser transitórios (ex: blip de rede em produção), então vale
// re-tentar algumas vezes em vez de propagar direto pro usuário.
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /fetch failed/i.test(err.message);
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, init);
    } catch (err) {
      if (!isNetworkError(err) || attempt >= retries) throw err;
      const cause = err instanceof Error && err.cause ? ` (${String(err.cause)})` : "";
      console.warn(`[HeyGen] fetch failed em ${url} — tentativa ${attempt + 1}/${retries + 1}${cause}`);
      await sleep(500 * (attempt + 1));
    }
  }
}

async function heyGenFetch(url: string, init: RequestInit): Promise<Response> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = { "X-Api-Key": apiKey };
  if (init.headers) Object.assign(headers, init.headers);
  const res = await fetchWithRetry(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    const isHtml = body.includes("<html") || body.includes("<!DOCTYPE");
    const msg = isHtml ? `HTTP ${res.status}` : body.slice(0, 300);
    throw new Error(`HeyGen HTTP ${res.status}: ${msg}`);
  }
  return res;
}

// Normaliza para JPEG baseline sRGB — elimina CMYK, progressive JPEG, HEIC, etc.
async function normalizeToJpeg(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const instance = sharp(buffer).rotate(); // corrige orientação EXIF
  const meta = await instance.metadata();

  const maxSide = 1280;
  const needsResize =
    (meta.width && meta.width > maxSide) || (meta.height && meta.height > maxSide);

  const pipeline = needsResize
    ? instance.resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    : instance;

  const out = await pipeline
    .jpeg({ quality: 95, progressive: false, chromaSubsampling: "4:4:4" })
    .toBuffer({ resolveWithObject: true });

  return { buffer: out.data, width: out.info.width, height: out.info.height };
}

// Faz upload de um asset (imagem ou vídeo) → retorna asset_id (abordagem recomendada pela HeyGen)
async function uploadAsset(buffer: Buffer, contentType: string, fileName: string): Promise<string> {
  const apiKey = getApiKey();
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const res = await fetchWithRetry(`${HEYGEN_API}/v3/assets`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: formData,
  });

  const text = await res.text();

  if (!res.ok) {
    const isHtml = text.includes("<html") || text.includes("<!DOCTYPE");
    throw new Error(`HeyGen asset upload: ${isHtml ? `HTTP ${res.status}` : text.slice(0, 200)}`);
  }

  let parsed: { data?: { asset_id?: string; id?: string }; error?: { message?: string } };
  try { parsed = JSON.parse(text); } catch {
    throw new Error(`HeyGen asset upload: resposta não-JSON — ${text.slice(0, 200)}`);
  }

  if (parsed.error) throw new Error(`HeyGen asset upload: ${parsed.error.message}`);

  const assetId = parsed.data?.asset_id ?? parsed.data?.id;
  if (!assetId) throw new Error(`HeyGen asset upload: asset_id não retornado. ${text.slice(0, 200)}`);
  return assetId;
}

async function uploadImageAsset(buffer: Buffer): Promise<string> {
  return uploadAsset(buffer, "image/jpeg", "photo.jpg");
}

// Passo 2: cria photo avatar com asset_id
async function createPhotoAvatar(name: string, assetId: string): Promise<{ avatarId: string; groupId: string }> {
  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "photo",
      name,
      file: { type: "asset_id", asset_id: assetId },
    }),
  });

  const json = await res.json() as {
    data?: { avatar_item?: { id?: string }; avatar_group?: { id?: string } };
    error?: { message?: string; code?: number };
  };

  if (json.error) throw new Error(`HeyGen create avatar: ${json.error.message ?? JSON.stringify(json.error)}`);

  const avatarId = json.data?.avatar_item?.id;
  if (!avatarId) throw new Error(`HeyGen create avatar: avatar_id não retornado. ${JSON.stringify(json)}`);

  return { avatarId, groupId: json.data?.avatar_group?.id ?? "" };
}

// Passo 3: aguarda o avatar ficar pronto (training assíncrono)
async function waitForAvatarReady(avatarId: string, maxWaitMs = 180_000): Promise<void> {
  const pollInterval = 8_000;
  const maxAttempts = Math.ceil(maxWaitMs / pollInterval);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await heyGenFetch(
        `${HEYGEN_API}/v3/avatars/looks?avatar_type=photo_avatar`,
        { method: "GET" }
      );
      const text = await res.text();
      let parsed: { data?: { looks?: Array<{ id?: string; status?: string; error?: { message?: string } }> } | Array<{ id?: string; status?: string }> };
      try { parsed = JSON.parse(text); } catch { parsed = {}; }

      // A API pode retornar data como array ou como objeto com campo looks
      const looks: Array<{ id?: string; status?: string; error?: { message?: string } }> = Array.isArray(parsed.data)
        ? parsed.data
        : (parsed.data as { looks?: Array<{ id?: string; status?: string; error?: { message?: string } }> })?.looks ?? [];

      const avatar = looks.find((l) => l.id === avatarId);

      if (avatar) {
        if (avatar.status === "completed") {
          console.log(`[HeyGen] Avatar ${avatarId} pronto (tentativa ${attempt})`);
          return;
        }
        if (avatar.status === "failed") {
          throw new Error(`HeyGen avatar training falhou: ${avatar.error?.message ?? "desconhecido"}`);
        }
        console.log(`[HeyGen] Avatar ${avatarId} status: ${avatar.status} (tentativa ${attempt}/${maxAttempts})`);
      } else {
        console.log(`[HeyGen] Avatar ${avatarId} ainda não aparece na lista (tentativa ${attempt}/${maxAttempts})`);
      }
    } catch (err) {
      if (String(err).includes("falhou")) throw err;
      console.warn(`[HeyGen] Erro ao verificar avatar status: ${err}`);
    }

    if (attempt < maxAttempts) await sleep(pollInterval);
  }

  throw new Error("HeyGen avatar demorou mais do que 3 minutos para ficar pronto. Tente novamente.");
}

// ─── Digital Twin (avatar treinado a partir de um vídeo real — corpo inteiro,
// gestos e movimento naturais, diferente do Photo Avatar que só anima a boca) ──

export type DigitalTwinStatus = "pending_consent" | "training" | "ready" | "failed";

async function createDigitalTwinGroup(name: string, videoAssetId: string): Promise<string> {
  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "digital_twin",
      name,
      file: { type: "asset_id", asset_id: videoAssetId },
    }),
  });

  const json = (await res.json()) as {
    data?: { avatar_group?: { id?: string }; group_id?: string; id?: string };
    error?: { message?: string };
  };

  if (json.error) throw new Error(`HeyGen create digital twin: ${json.error.message}`);

  const groupId = json.data?.avatar_group?.id ?? json.data?.group_id ?? json.data?.id;
  if (!groupId) throw new Error(`HeyGen create digital twin: group_id não retornado. ${JSON.stringify(json)}`);
  return groupId;
}

// Upload de vídeo de consentimento pré-gravado via API só está disponível pra contas
// Enterprise da HeyGen (HTTP 403 resource_access_denied em contas normais). Por isso
// usamos o fluxo "webcam": a HeyGen gera um link temporário (24h) onde a própria pessoa
// grava o consentimento ao vivo pela webcam, direto na página hospedada pela HeyGen.
export async function requestDigitalTwinConsentUrl(groupId: string): Promise<string> {
  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars/${groupId}/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const text = await res.text();
  console.log(`[HeyGen] Digital twin consent webcam url (raw) para groupId=${groupId}:`, text.slice(0, 2000));

  let parsed: { data?: { url?: string }; error?: { message?: string } };
  try { parsed = JSON.parse(text); } catch {
    throw new Error(`HeyGen digital twin consent: resposta inválida — ${text.slice(0, 200)}`);
  }
  if (parsed.error) throw new Error(`HeyGen digital twin consent: ${parsed.error.message}`);

  const url = parsed.data?.url;
  if (!url) throw new Error(`HeyGen digital twin consent: link não retornado. ${text.slice(0, 200)}`);
  return url;
}

type DigitalTwinGroupInfo = {
  consentStatus: string | null;
  trainingStatus: string | null;
  avatarId: string | null;
};

// Busca o "look" (avatar individual) pertencente a este grupo na listagem de digital
// twins — mesmo endpoint/padrao ja comprovado para Photo Avatar (waitForAvatarReady),
// so trocando avatar_type. O group_id do avatar NAO serve como avatar_id na geracao
// de video — precisa ser o id do look especifico dentro do grupo.
async function findDigitalTwinLookId(groupId: string): Promise<{ id: string; status?: string } | undefined> {
  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars/looks?avatar_type=digital_twin`, { method: "GET" });
  const text = await res.text();
  console.log(`[HeyGen] Digital twin looks (raw) para groupId=${groupId}:`, text.slice(0, 2000));

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return undefined; }

  const data = (parsed as Record<string, unknown>)?.data;
  let items: Array<Record<string, unknown>> = [];
  if (Array.isArray(data)) items = data as Array<Record<string, unknown>>;
  else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const list = obj.looks ?? obj.avatar_list ?? obj.items ?? obj.list;
    if (Array.isArray(list)) items = list as Array<Record<string, unknown>>;
  }

  const match = items.find((item) => {
    const candidateGroupId =
      (item.group_id as string | undefined) ??
      (item.avatar_group_id as string | undefined) ??
      (item.groupId as string | undefined) ??
      ((item.avatar_group as Record<string, unknown> | undefined)?.id as string | undefined);
    return candidateGroupId === groupId;
  });

  if (!match) return undefined;
  const id = (match.id as string | undefined) ?? (match.avatar_id as string | undefined);
  if (!id) return undefined;
  return { id, status: match.status as string | undefined };
}

async function getDigitalTwinGroupInfo(groupId: string): Promise<DigitalTwinGroupInfo> {
  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars/${groupId}`, { method: "GET" });
  const text = await res.text();
  console.log(`[HeyGen] Digital twin group info (raw) para groupId=${groupId}:`, text.slice(0, 2000));

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text); } catch { parsed = {}; }

  const data = (parsed.data ?? parsed) as Record<string, unknown>;
  const consentStatus = (data.consent_status as string | undefined) ?? (data.consentStatus as string | undefined) ?? null;
  const trainingStatus = (data.status as string | undefined) ?? (data.training_status as string | undefined) ?? null;

  // So confiamos no avatarId quando ele vem de um "look" realmente encontrado na
  // listagem E com status "completed" — usar data.avatar_id como fallback (como o
  // codigo fazia antes) e' arriscado: esse campo as vezes devolve o proprio group_id,
  // que a geracao de video rejeita com "invalid_parameter ... is not supported"
  // (visto em producao). Melhor ficar em "training" mais tempo do que marcar "ready"
  // com um id invalido.
  let avatarId: string | null = null;
  try {
    const look = await findDigitalTwinLookId(groupId);
    if (look && look.status === "completed") avatarId = look.id;
  } catch (err) {
    console.warn("[HeyGen] Falha ao buscar looks do digital twin:", err);
  }

  return { consentStatus, trainingStatus, avatarId };
}

export type CreateDigitalTwinInput = {
  videoBuffer: Buffer;
  videoContentType: string;
  name: string;
};

export async function createDigitalTwinAvatar(
  input: CreateDigitalTwinInput
): Promise<{ groupId: string; consentUrl: string }> {
  const videoAssetId = await uploadAsset(input.videoBuffer, input.videoContentType, "training.mp4");
  const groupId = await createDigitalTwinGroup(input.name, videoAssetId);
  const consentUrl = await requestDigitalTwinConsentUrl(groupId);

  return { groupId, consentUrl };
}

export async function checkDigitalTwinStatus(
  groupId: string
): Promise<{ status: DigitalTwinStatus; avatarId: string | null }> {
  const info = await getDigitalTwinGroupInfo(groupId);

  const consentFailed = info.consentStatus ? /fail|error|reject|denied/i.test(info.consentStatus) : false;
  const trainingFailed = info.trainingStatus ? /fail|error|reject/i.test(info.trainingStatus) : false;
  if (consentFailed || trainingFailed) {
    return { status: "failed", avatarId: null };
  }

  if (info.avatarId) {
    return { status: "ready", avatarId: info.avatarId };
  }

  const consentOk = info.consentStatus ? /complete|approved|success/i.test(info.consentStatus) : false;
  if (!consentOk) {
    return { status: "pending_consent", avatarId: null };
  }

  return { status: "training", avatarId: null };
}

// Gera vídeo com o Digital Twin — tenta o motor Avatar V (corpo inteiro, aprendido
// do vídeo real) e cai para Avatar IV se a conta/plano não tiver acesso ao Avatar V.
export async function generateDigitalTwinVideo(input: {
  avatarId: string;
  script: string;
  voiceId: string;
  emotion?: string;
}): Promise<string> {
  const engines = [{ type: "avatar_v" }, { type: "avatar_iv" }] as const;
  let lastErr: unknown;

  for (const engine of engines) {
    try {
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
          engine,
          voice_settings: { emotion: input.emotion ?? "Friendly", speed: 1.0 },
        }),
      });

      const text = await res.text();
      let parsed: { data?: { video_id?: string }; error?: { message?: string; code?: number } };
      try { parsed = JSON.parse(text); } catch {
        throw new Error(`HeyGen Digital Twin vídeo: resposta inválida — ${text.slice(0, 200)}`);
      }

      if (parsed.error) {
        throw new Error(`HeyGen Digital Twin vídeo: ${parsed.error.message ?? JSON.stringify(parsed.error)}`);
      }

      const videoId = parsed.data?.video_id;
      if (!videoId) throw new Error(`HeyGen Digital Twin vídeo: video_id não retornado. ${JSON.stringify(parsed)}`);
      return videoId;
    } catch (err) {
      lastErr = err;
      console.warn(`[HeyGen] engine ${engine.type} falhou: ${err instanceof Error ? err.message : err}`);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("HeyGen: não foi possível gerar vídeo com o Digital Twin.");
}

// Passo 4: gera vídeo com Avatar IV — gestos, expressividade e movimento natural
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
      // Avatar IV (padrão quando não especifica engine) — suporta expressiveness e motion_prompt
      expressiveness: "high",
      motion_prompt:
        "natural upper body movement, direct eye contact with camera, conversational hand gestures, warm engaging expression",
      voice_settings: { emotion: input.emotion ?? "Friendly", speed: 1.0 },
    }),
  });

  const text = await res.text();
  let parsed: { data?: { video_id?: string }; error?: { message?: string; code?: number } };
  try { parsed = JSON.parse(text); } catch {
    throw new Error(`HeyGen V3 vídeo: resposta inválida — ${text.slice(0, 200)}`);
  }

  if (parsed.error) throw new Error(`HeyGen V3 vídeo: ${parsed.error.message ?? JSON.stringify(parsed.error)}`);

  const videoId = parsed.data?.video_id;
  if (!videoId) throw new Error(`HeyGen V3 vídeo: video_id não retornado. ${JSON.stringify(parsed)}`);
  return videoId;
}

// Fallback V1/V2 com Avatar IV (caso V3 falhe)
async function createTalkingPhotoV1(buffer: Buffer): Promise<string | null> {
  const apiKey = getApiKey();
  const res = await fetchWithRetry("https://upload.heygen.com/v1/talking_photo", {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "image/jpeg" },
    body: new Uint8Array(buffer),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    if (bodyText.includes("401028") || bodyText.toLowerCase().includes("exceeded")) return null;
    throw new Error(`HeyGen V1 upload: ${bodyText.slice(0, 200)}`);
  }

  let json: { code?: number; data?: { talking_photo_id?: string }; error?: { message?: string; code?: number } };
  try { json = JSON.parse(bodyText); } catch {
    throw new Error(`HeyGen V1 upload: resposta não-JSON — ${bodyText.slice(0, 200)}`);
  }

  if (json.code === 401028 || json.error?.code === 401028) return null;
  if ((json.code !== 100 && json.code != null) || json.error) {
    throw new Error(`HeyGen V1 upload: ${json.error?.message ?? `código ${json.code}`}`);
  }

  return json.data?.talking_photo_id ?? null;
}

async function generateV2VideoAvatarIV(input: {
  talkingPhotoId: string;
  script: string;
  voiceId: string;
  emotion?: string;
}): Promise<string> {
  const res = await heyGenFetch(`${HEYGEN_API}/v2/video/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_inputs: [{
        character: {
          type: "talking_photo",
          talking_photo_id: input.talkingPhotoId,
          talking_style: "expressive",
          expression: "happy",
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
      }],
      dimension: { width: 1080, height: 1920 },
      use_avatar_iv_model: true,
    }),
  });

  const text = await res.text();
  let parsed: { code?: number; data?: { video_id?: string }; error?: { message?: string } };
  try { parsed = JSON.parse(text); } catch {
    throw new Error(`HeyGen V2 generate: resposta inválida — ${text.slice(0, 200)}`);
  }

  const ok = (parsed.code === 100 || parsed.code === undefined) && !parsed.error;
  if (!ok) throw new Error(`HeyGen V2 generate: ${parsed.error?.message ?? `código ${parsed.code}`}`);

  const videoId = (parsed.data as { video_id?: string })?.video_id;
  if (!videoId) throw new Error("HeyGen V2 generate: video_id não retornado.");
  return videoId;
}

// Limpeza de avatares para liberar limite da conta
async function listV3AvatarIds(): Promise<string[]> {
  try {
    const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars/looks?avatar_type=photo_avatar`, { method: "GET" });
    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return []; }

    const data = (parsed as Record<string, unknown>).data;
    let items: unknown[] = [];
    if (Array.isArray(data)) items = data;
    else if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const list = obj.looks ?? obj.avatar_list ?? obj.items ?? obj.list;
      if (Array.isArray(list)) items = list;
    }
    return items
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i) => String(i.id ?? i.avatar_id ?? ""))
      .filter(Boolean);
  } catch { return []; }
}

async function listTalkingPhotoIds(): Promise<string[]> {
  try {
    const res = await heyGenFetch(`${HEYGEN_API}/v2/talking_photo`, { method: "GET" });
    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return []; }
    const data = (parsed as Record<string, unknown>).data;
    let items: unknown[] = [];
    if (Array.isArray(data)) items = data;
    else if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const list = obj.talking_photo_list ?? obj.list ?? obj.items ?? obj.talking_photos;
      if (Array.isArray(list)) items = list;
    }
    return items
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i) => String(i.talking_photo_id ?? i.id ?? ""))
      .filter(Boolean);
  } catch { return []; }
}

async function cleanupAllAvatars(): Promise<void> {
  const [v3Ids, v2Ids] = await Promise.all([listV3AvatarIds(), listTalkingPhotoIds()]);
  console.log(`[HeyGen] Limpando ${v3Ids.length} avatares V3 e ${v2Ids.length} talking photos...`);
  await Promise.all([
    ...v3Ids.map((id) => deleteHeyGenAvatar(id)),
    ...v2Ids.map((id) => deleteHeyGenTalkingPhoto(id)),
  ]);
}

export async function deleteHeyGenAvatar(id: string): Promise<void> {
  try { await heyGenFetch(`${HEYGEN_API}/v3/avatars/${id}`, { method: "DELETE" }); } catch { /* best-effort */ }
}

export async function deleteHeyGenTalkingPhoto(id: string): Promise<void> {
  try { await heyGenFetch(`${HEYGEN_API}/v2/talking_photo/${id}`, { method: "DELETE" }); } catch { /* best-effort */ }
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
    try { parsed = JSON.parse(text); } catch { return []; }
    return parsed.data?.voices ?? [];
  } catch { return []; }
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

export type CreatedHeyGenVideo = {
  videoId: string;
  talkingPhotoId: string;
  provider: "v3" | "v2";
};

export async function createHeyGenAvatarVideo(
  input: CreateHeyGenVideoInput
): Promise<CreatedHeyGenVideo> {
  if (!input.voiceId) {
    throw new Error("Selecione uma voz antes de gerar o vídeo com HeyGen.");
  }

  // Normaliza imagem independente do provider escolhido
  const normalized = await normalizeToJpeg(input.imageBuffer);
  const avatarName = `av-${input.userId}-${Date.now()}`;

  // === Tenta V3 (qualidade do site: avatar IV completo, gestos, corpo inteiro) ===
  try {
    // 1. Upload como asset HeyGen
    let assetId: string;
    try {
      assetId = await uploadImageAsset(normalized.buffer);
    } catch (uploadErr) {
      console.warn(`[HeyGen] Asset upload falhou, tentando com base64: ${uploadErr}`);
      // Fallback base64 se o upload de asset falhar
      throw uploadErr; // deixa cair para o fallback V2
    }

    // 2. Cria photo avatar
    let avatarId: string;
    try {
      const created = await createPhotoAvatar(avatarName, assetId);
      avatarId = created.avatarId;
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      if (msg.includes("401028") || msg.toLowerCase().includes("exceeded") || msg.toLowerCase().includes("limit")) {
        await cleanupAllAvatars();
        const retry = await createPhotoAvatar(avatarName, assetId);
        avatarId = retry.avatarId;
      } else {
        throw err;
      }
    }

    // 3. Aguarda avatar ficar pronto (training assíncrono — crítico para animação funcionar)
    await waitForAvatarReady(avatarId, 180_000);

    // 4. Gera vídeo com Avatar IV + expressividade + gestos
    const videoId = await generateV3Video({
      avatarId,
      script: input.script,
      voiceId: input.voiceId,
      emotion: input.emotion,
    });

    return { videoId, talkingPhotoId: avatarId, provider: "v3" };
  } catch (v3Err) {
    console.warn(`[HeyGen] V3 falhou, usando fallback V2+AvatarIV: ${v3Err instanceof Error ? v3Err.message : v3Err}`);
  }

  // === Fallback V2 + Avatar IV ===
  let talkingPhotoId = await createTalkingPhotoV1(normalized.buffer);

  if (talkingPhotoId === null) {
    await cleanupAllAvatars();
    talkingPhotoId = await createTalkingPhotoV1(normalized.buffer);
    if (talkingPhotoId === null) {
      throw new Error("HeyGen: limite de avatars atingido. Acesse app.heygen.com → Avatars e delete manualmente.");
    }
  }

  const videoId = await generateV2VideoAvatarIV({
    talkingPhotoId,
    script: input.script,
    voiceId: input.voiceId,
    emotion: input.emotion,
  });

  return { videoId, talkingPhotoId, provider: "v2" };
}

export async function waitForHeyGenCompletion(
  videoId: string,
  options?: { maxAttempts?: number; delayMs?: number; provider?: "v3" | "v2" }
): Promise<{ resultUrl: string }> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const delayMs = options?.delayMs ?? 8000;
  const provider = options?.provider ?? "v3";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const statusUrl = provider === "v3"
      ? `${HEYGEN_API}/v3/videos/${videoId}`
      : `${HEYGEN_API}/v1/video_status.get?video_id=${videoId}`;

    const res = await heyGenFetch(statusUrl, { method: "GET" });
    const text = await res.text();
    let parsed: { code?: number; data?: { status?: string; video_url?: string; url?: string; error?: unknown }; error?: unknown };
    try { parsed = JSON.parse(text); } catch {
      throw new Error(`HeyGen status: resposta inválida — ${text.slice(0, 200)}`);
    }

    const data = parsed.data as { status?: string; video_url?: string; url?: string; error?: unknown } | undefined;
    const url = data?.video_url ?? data?.url;
    const status = data?.status;

    if ((status === "completed" || status === "success") && url) return { resultUrl: url };

    if (status === "failed") {
      const errMsg = data?.error == null
        ? "erro desconhecido"
        : typeof data.error === "string" ? data.error : JSON.stringify(data.error);
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
  const res = await fetchWithRetry(input.resultUrl, {});
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
