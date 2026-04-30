import { ENV } from "./env";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 55_000;

export type AnthropicTextContent = { type: "text"; text: string };
export type AnthropicImageContent = {
  type: "image";
  source:
    | { type: "base64"; media_type: string; data: string }
    | { type: "url"; url: string };
};
export type AnthropicContent = AnthropicTextContent | AnthropicImageContent;
export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export function buildAnthropicImageContent(
  url: string
): AnthropicImageContent | null {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:(image\/[a-z+]+);base64,([\s\S]+)$/);
    if (!match) return null;
    return {
      type: "image",
      source: { type: "base64", media_type: match[1], data: match[2] },
    };
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { type: "image", source: { type: "url", url } };
  }
  return null;
}

export async function invokeAnthropicLLM(params: {
  system: string;
  userContent: string | AnthropicContent[];
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }

  const messages: AnthropicMessage[] = [
    { role: "user", content: params.userContent },
  ];

  const payload = {
    model: params.model ?? DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: params.system,
    messages,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(
        ANTHROPIC_API_URL,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": ENV.anthropicApiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(payload),
        },
        TIMEOUT_MS
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `Anthropic API: ${res.status} ${res.statusText} – ${errText}`
        );
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const text = (data.content ?? [])
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim();

      if (!text) {
        throw new Error("Anthropic API returned no text content.");
      }

      return text;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export function parseClaudeJsonResponse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch { /* continue */ }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch { /* continue */ }
  }

  const start = raw.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === "{") depth++;
      else if (raw[i] === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(raw.slice(start, i + 1)) as T;
          } catch { break; }
        }
      }
    }
  }

  console.warn("[AnthropicClient] Failed to parse JSON response, using fallback");
  return fallback;
}
