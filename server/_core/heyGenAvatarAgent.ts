import sharp from "sharp";
import { ENV } from "./env";
import { storagePut } from "../storage";

const HEYGEN_API = "https://api.heygen.com";

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

// Códigos que costumam ser blips passageiros do lado da HeyGen (rate limit
// ou instabilidade momentânea do servidor) — diferente de erros de negócio
// (400/401/404 etc.) que não se resolvem tentando de novo.
const TRANSIENT_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);

async function heyGenFetch(url: string, init: RequestInit, httpRetries = 2): Promise<Response> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = { "X-Api-Key": apiKey };
  if (init.headers) Object.assign(headers, init.headers);

  for (let attempt = 0; ; attempt++) {
    const res = await fetchWithRetry(url, { ...init, headers });
    if (res.ok) return res;

    if (TRANSIENT_HTTP_STATUS.has(res.status) && attempt < httpRetries) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      const backoffMs = Number.isFinite(retryAfterMs) ? retryAfterMs : 1000 * 2 ** attempt;
      console.warn(`[HeyGen] HTTP ${res.status} em ${url} — tentativa ${attempt + 1}/${httpRetries + 1}, esperando ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }

    const body = await res.text();
    const isHtml = body.includes("<html") || body.includes("<!DOCTYPE");
    const msg = isHtml ? `HTTP ${res.status}` : body.slice(0, 300);
    throw new Error(`HeyGen HTTP ${res.status}: ${msg}`);
  }
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
  // Guarda o último erro real (não só loga e ignora) pra não esconder a
  // causa verdadeira atrás da mensagem genérica de timeout no final — e
  // desiste antes dos 3 minutos se o erro persistir, já que um problema
  // como chave inválida ou erro de rede constante não vai se resolver só
  // de esperar mais.
  let lastCheckError: unknown = null;
  let consecutiveErrors = 0;

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
      consecutiveErrors = 0;
      lastCheckError = null;
    } catch (err) {
      if (String(err).includes("falhou")) throw err;
      lastCheckError = err;
      consecutiveErrors++;
      console.warn(`[HeyGen] Erro ao verificar avatar status (falha ${consecutiveErrors}ª consecutiva): ${err}`);
      if (consecutiveErrors >= 3) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`HeyGen: não foi possível confirmar o status do avatar após ${consecutiveErrors} tentativas seguidas — ${msg}`);
      }
    }

    if (attempt < maxAttempts) await sleep(pollInterval);
  }

  const causeMsg = lastCheckError
    ? ` Último erro registrado: ${lastCheckError instanceof Error ? lastCheckError.message : String(lastCheckError)}`
    : "";
  throw new Error(`HeyGen avatar demorou mais do que 3 minutos para ficar pronto. Tente novamente.${causeMsg}`);
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
          voice_settings: { speed: 1.0 },
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
      voice_settings: { speed: 1.0 },
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

// Limpeza para liberar o limite da conta: só apaga os avatares temporários
// que este app cria a cada vídeo (nome "av-<usuário>-<timestamp>"). Nunca
// mexe nos avatares feitos pela equipe na HeyGen nem no Digital Twin.
async function cleanupTemporaryAvatars(): Promise<void> {
  const looks = await listLooks({ avatar_type: "photo_avatar", ownership: "private" }).catch(() => []);
  const temp = looks.filter((l) => /^av-\d+-\d+$/.test(l.name));
  console.log(`[HeyGen] Limpando ${temp.length} avatares temporários...`);
  await Promise.all(temp.map((l) => deleteHeyGenAvatar(l.id)));
}

export async function deleteHeyGenAvatar(id: string): Promise<void> {
  try { await heyGenFetch(`${HEYGEN_API}/v3/avatars/${id}`, { method: "DELETE" }); } catch { /* best-effort */ }
}

export type HeyGenVoice = {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
  preview_audio?: string;
};

type V3Page<T> = { data?: T[]; has_more?: boolean; next_token?: string | null };

async function listPaged<T>(pathAndQuery: string, maxPages = 5): Promise<T[]> {
  const out: T[] = [];
  let token: string | null | undefined;
  for (let page = 0; page < maxPages; page++) {
    const sep = pathAndQuery.includes("?") ? "&" : "?";
    const res = await heyGenFetch(`${HEYGEN_API}${pathAndQuery}${token ? `${sep}token=${encodeURIComponent(token)}` : ""}`, { method: "GET" });
    const json = (await res.json()) as V3Page<T>;
    out.push(...(json.data ?? []));
    if (!json.has_more || !json.next_token) break;
    token = json.next_token;
  }
  return out;
}

type V3Voice = { voice_id: string; name: string; language: string; gender: string; preview_audio_url?: string | null; type: string };

/** Vozes do idioma pedido (nome em inglês, ex.: "Portuguese"), as multilíngues e as clonadas da conta. */
export async function listHeyGenVoices(language?: string): Promise<HeyGenVoice[]> {
  const [own, publicVoices] = await Promise.all([
    listPaged<V3Voice>("/v3/voices?type=private&limit=100").catch(() => [] as V3Voice[]),
    listPaged<V3Voice>(`/v3/voices?limit=100${language ? `&language=${encodeURIComponent(language)}` : ""}`).catch(() => [] as V3Voice[]),
  ]);
  // O filtro de idioma da HeyGen é frouxo (traz vozes em inglês que "suportam" o
  // idioma): fica só com as do idioma, primeiro, e as multilíngues.
  const picked = language
    ? [
        ...publicVoices.filter((v) => v.language.trim() === language),
        ...publicVoices.filter((v) => v.language.trim() === "Multilingual"),
      ]
    : publicVoices;
  const seen = new Set<string>();
  return [...own, ...picked].filter((v) => !seen.has(v.voice_id) && seen.add(v.voice_id)).map((v) => ({
    voice_id: v.voice_id,
    name: v.type === "private" ? `${v.name} (da conta)` : v.name,
    language: v.language,
    gender: v.gender,
    preview_audio: v.preview_audio_url ?? undefined,
  }));
}

type V3Look = {
  id: string; name: string; avatar_type: string; preview_image_url?: string | null; group_id?: string | null;
  default_voice_id?: string | null; status?: string | null; preferred_orientation?: string | null;
};

async function listLooks(params: Record<string, string>): Promise<V3Look[]> {
  return listPaged<V3Look>(`/v3/avatars/looks?${new URLSearchParams({ ...params, limit: "50" })}`);
}

export type AccountAvatar = { id: string; name: string; type: "photo_avatar" | "digital_twin"; previewImageUrl: string | null; defaultVoiceId: string | null };

/** Avatares prontos da própria conta HeyGen (feitos pela equipe), sem os temporários do app. */
export async function listAccountAvatars(): Promise<AccountAvatar[]> {
  // A listagem "private" do HeyGen demora a incluir looks recém-criados: completa com
  // os looks de cada personagem (grupo) da conta.
  const priv = await listLooks({ ownership: "private" });
  const byGroup = await Promise.all([...new Set(priv.map((l) => l.group_id).filter(Boolean))].map((g) => listLooks({ group_id: g as string }).catch(() => [] as V3Look[])));
  const all = new Map<string, V3Look>();
  for (const l of [...priv, ...byGroup.flat()]) all.set(l.id, l);
  const looks = [...all.values()]
    .filter((l) => (l.status ?? "completed") === "completed" && !/^av-\d+-\d+$/.test(l.name))
    .filter((l): l is V3Look & { avatar_type: AccountAvatar["type"] } => l.avatar_type === "photo_avatar" || l.avatar_type === "digital_twin");
  // A voz padrão do personagem (grupo) vale para todos os looks dele: é onde a equipe
  // troca a voz (ex.: a voz clonada com o sotaque certo). A do look fica como reserva.
  const groupVoice = new Map<string, string | null>();
  await Promise.all([...new Set(looks.map((l) => l.group_id).filter(Boolean))].map(async (g) => {
    try {
      const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars/${g}`, { method: "GET" });
      const body = (await res.json()) as { data?: { default_voice_id?: string | null } };
      groupVoice.set(g as string, body.data?.default_voice_id ?? null);
    } catch { /* sem a voz do grupo, usa a do look */ }
  }));
  // Reels são sempre 1080x1920: um cenário horizontal que já ganhou versão vertical
  // ("<nome> (vertical)") some da lista e fica só a versão vertical.
  const names = new Set(looks.map((l) => l.name));
  return looks.filter((l) => !(l.preferred_orientation === "landscape" && names.has(`${l.name} ${VERTICAL_SUFFIX}`))).map((l) => ({
    id: l.id, name: l.name, type: l.avatar_type, previewImageUrl: l.preview_image_url ?? null,
    defaultVoiceId: (l.group_id && groupVoice.get(l.group_id)) || l.default_voice_id || null,
  }));
}

/** Gera o vídeo com um avatar que já existe na conta (não cria nem apaga nada). */
export async function generateAccountAvatarVideo(input: { avatar: AccountAvatar; script: string; voiceId: string }): Promise<string> {
  if (input.avatar.type === "digital_twin") {
    return generateDigitalTwinVideo({ avatarId: input.avatar.id, script: input.script, voiceId: input.voiceId });
  }
  const avatarId = await ensurePortraitLook(input.avatar.id);
  return generateV3Video({ avatarId, script: input.script, voiceId: input.voiceId });
}

const VERTICAL_SUFFIX = "(vertical)";

/**
 * Os vídeos são sempre 1080x1920 (Reels). Um photo avatar horizontal (ex.: os cenários
 * de podcast do HeyGen) sai com faixas brancas em 9:16, porque o HeyGen não recorta.
 * Aqui criamos uma vez a versão vertical do cenário (recorte 9:16 centrado na pessoa),
 * no mesmo personagem, e reaproveitamos nas próximas vezes.
 */
export async function ensurePortraitLook(lookId: string): Promise<string> {
  const look = await getLook(lookId);
  if (look.preferred_orientation !== "landscape" || !look.preview_image_url) return lookId;
  const verticalName = `${look.name} ${VERTICAL_SUFFIX}`;
  const existing = (await listLooks({ ownership: "private" })).find((l) => l.name === verticalName && (l.status ?? "completed") !== "failed");
  if (existing) return existing.status === "processing" ? waitLook(existing.id) : existing.id;

  const src = await fetchWithRetry(look.preview_image_url, {});
  if (!src.ok) throw new Error(`Não consegui baixar o cenário ${look.name} (${src.status}).`);
  const img = sharp(Buffer.from(await src.arrayBuffer()));
  const { width = 0, height = 0 } = await img.metadata();
  const cropW = Math.min(width, Math.round((height * 9) / 16));
  // "attention" centra o recorte no que mais chama atenção (o rosto da pessoa).
  const portrait = await img.resize({ width: cropW, height, fit: "cover", position: sharp.strategy.attention }).jpeg({ quality: 92 }).toBuffer();
  const { url } = await storagePut(`heygen/looks/${lookId}-vertical-${Date.now()}.jpg`, portrait, "image/jpeg");

  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "photo", name: verticalName, file: { type: "url", url }, ...(look.group_id ? { avatar_group_id: look.group_id } : {}) }),
  });
  const body = (await res.json()) as { data?: { avatar_item?: { id?: string }; id?: string } };
  const newId = body.data?.avatar_item?.id ?? body.data?.id;
  if (!newId) throw new Error(`HeyGen não devolveu o look vertical: ${JSON.stringify(body).slice(0, 200)}`);
  return waitLook(newId);
}

async function getLook(id: string): Promise<V3Look & { status?: string | null; error?: { message?: string } | null }> {
  const res = await heyGenFetch(`${HEYGEN_API}/v3/avatars/looks/${id}`, { method: "GET" });
  return ((await res.json()) as { data: V3Look & { status?: string | null } }).data;
}

async function waitLook(id: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const l = await getLook(id);
    if (l.status === "completed") return id;
    if (l.status === "failed") throw new Error(`HeyGen não criou o cenário vertical: ${l.error?.message ?? "falhou"}`);
    await sleep(5000);
  }
  throw new Error("HeyGen demorou demais para criar o cenário vertical.");
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
  provider: "v3";
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

  // 1. Upload como asset HeyGen
  const assetId = await uploadImageAsset(normalized.buffer);

  // 2. Cria o photo avatar temporário (apagado pelo router depois do vídeo)
  let avatarId: string;
  try {
    avatarId = (await createPhotoAvatar(avatarName, assetId)).avatarId;
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err).toLowerCase();
    if (!msg.includes("401028") && !msg.includes("exceeded") && !msg.includes("limit")) throw err;
    await cleanupTemporaryAvatars();
    avatarId = (await createPhotoAvatar(avatarName, assetId)).avatarId;
  }

  // 3. Aguarda o avatar ficar pronto (training assíncrono)
  await waitForAvatarReady(avatarId, 180_000);

  // 4. Gera o vídeo com Avatar IV
  const videoId = await generateV3Video({ avatarId, script: input.script, voiceId: input.voiceId });
  return { videoId, talkingPhotoId: avatarId, provider: "v3" };
}

// ─── Limite de concorrência ──────────────────────────────────────────────
// A conta HeyGen (compartilhada por todos os usuários do app, uma única
// API key) aceita só um número limitado de vídeos processando ao mesmo
// tempo. Sem isso, vários usuários gerando vídeo na mesma hora estourariam
// esse teto e receberiam erro em vez de simplesmente esperar a vez —
// requisições além do limite ficam numa fila (em memória, por processo) e
// são atendidas em ordem de chegada.
const MAX_CONCURRENT_HEYGEN_VIDEOS = 6;
let activeHeyGenVideos = 0;
const heyGenVideoQueue: Array<() => void> = [];

async function acquireHeyGenVideoSlot(): Promise<void> {
  if (activeHeyGenVideos < MAX_CONCURRENT_HEYGEN_VIDEOS) {
    activeHeyGenVideos++;
    return;
  }
  await new Promise<void>((resolve) => heyGenVideoQueue.push(resolve));
  activeHeyGenVideos++;
}

function releaseHeyGenVideoSlot(): void {
  activeHeyGenVideos--;
  heyGenVideoQueue.shift()?.();
}

// Envolve a criação + espera de um vídeo HeyGen numa "vaga" de concorrência.
// Conservador de propósito: no caminho do Photo Avatar isso também cobre o
// treino do avatar (que tem seu próprio limite de conta, tratado em
// cleanupTemporaryAvatars) — prefere segurar a vaga um pouco mais do que o
// estritamente necessário a arriscar estourar o teto real da conta.
export async function withHeyGenVideoSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireHeyGenVideoSlot();
  try {
    return await fn();
  } finally {
    releaseHeyGenVideoSlot();
  }
}

export async function waitForHeyGenCompletion(
  videoId: string,
  options?: { maxAttempts?: number; delayMs?: number }
): Promise<{ resultUrl: string }> {
  const maxAttempts = options?.maxAttempts ?? 60;
  const delayMs = options?.delayMs ?? 8000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await heyGenFetch(`${HEYGEN_API}/v3/videos/${videoId}`, { method: "GET" });
    const text = await res.text();
    let parsed: { data?: { status?: string; video_url?: string; failure_message?: string | null; failure_code?: string | null } };
    try { parsed = JSON.parse(text); } catch {
      throw new Error(`HeyGen status: resposta inválida — ${text.slice(0, 200)}`);
    }

    const data = parsed.data;
    if (data?.status === "completed" && data.video_url) return { resultUrl: data.video_url };
    if (data?.status === "failed") {
      throw new Error(`HeyGen falhou: ${data.failure_message ?? data.failure_code ?? "erro desconhecido"}`);
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
  // No storage (S3), não no disco do container: o disco é apagado a cada deploy.
  const { url } = await storagePut(
    `videos/${input.userId}/video-${input.videoId}-heygen-${Date.now()}.mp4`,
    Buffer.from(await res.arrayBuffer()),
    "video/mp4"
  );
  return { videoUrl: url };
}
