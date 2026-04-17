import { ENV } from "./env";

export type CreateOpenAIRealtimeTokenInput = {
  instructions?: string;
  model?: string;
  voice?: string;
  ttlSeconds?: number;
};

export type OpenAIRealtimeToken = {
  value: string;
  expiresAt: number;
  session: Record<string, unknown>;
};

type OpenAIRealtimeTokenResponse = {
  value?: string;
  expires_at?: number;
  session?: Record<string, unknown>;
  error?: {
    message?: string;
    type?: string;
  };
};

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3600;

function clampTtlSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return 600;
  }

  return Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, Math.round(value)));
}

function getOpenAIRealtimeBaseUrl() {
  return ENV.openaiApiBaseUrl.replace(/\/+$/, "");
}

function getDefaultInstructions() {
  return "Voce ajuda a criar videos curtos em portugues do Brasil com fala natural e objetiva.";
}

async function parseRealtimeJson(response: Response): Promise<OpenAIRealtimeTokenResponse> {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as OpenAIRealtimeTokenResponse) : {};
  } catch {
    throw new Error(`Resposta invalida da OpenAI: ${text || response.statusText}`);
  }
}

function realtimeErrorMessage(response: Response, data: OpenAIRealtimeTokenResponse) {
  const message = data.error?.message || data.error?.type;
  return message
    ? `OpenAI retornou erro ao criar token realtime: ${message}`
    : `OpenAI retornou erro ao criar token realtime (${response.status} ${response.statusText})`;
}

export async function createOpenAIRealtimeToken(
  input: CreateOpenAIRealtimeTokenInput = {}
): Promise<OpenAIRealtimeToken> {
  if (!ENV.openaiApiKey.trim()) {
    throw new Error("OPENAI_API_KEY nao configurada para criar token realtime.");
  }

  const ttlSeconds = clampTtlSeconds(
    input.ttlSeconds ?? ENV.openaiRealtimeTokenTtlSeconds
  );
  const model = (input.model || ENV.openaiRealtimeModel || "gpt-realtime").trim();
  const voice = (input.voice || ENV.openaiRealtimeVoice || "marin").trim();
  const instructions = (input.instructions || getDefaultInstructions()).trim();

  const response = await fetch(`${getOpenAIRealtimeBaseUrl()}/realtime/client_secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: ttlSeconds,
      },
      session: {
        type: "realtime",
        model,
        instructions,
        audio: {
          output: {
            voice,
          },
        },
      },
    }),
  });

  const data = await parseRealtimeJson(response);

  if (!response.ok) {
    throw new Error(realtimeErrorMessage(response, data));
  }

  if (!data.value) {
    throw new Error("A OpenAI nao retornou o token realtime esperado.");
  }

  return {
    value: data.value,
    expiresAt: typeof data.expires_at === "number" ? data.expires_at : 0,
    session: data.session && typeof data.session === "object" ? data.session : {},
  };
}
