import { ENV } from "./env";

// Cliente único pra API da Serper (google.serper.dev). Antes disso, cada
// módulo (Radar, SEO, Carrossel, Geração de Imagens) fazia seu próprio
// fetch com headers/timeout/tratamento de erro duplicados. Aqui fica só
// o transporte — cada endpoint devolve o JSON cru tipado, e a lógica de
// negócio (o que fazer com o resultado) continua em cada módulo.

export type SerperOrganicResult = {
  title?: string;
  snippet?: string;
  link?: string;
  date?: string;
};

export type SerperSearchResponse = {
  organic?: SerperOrganicResult[];
  answerBox?: { answer?: string; snippet?: string; title?: string };
  knowledgeGraph?: { description?: string; title?: string };
  peopleAlsoAsk?: Array<{ question?: string }>;
  relatedSearches?: Array<{ query?: string }>;
};

export type SerperNewsResult = {
  title: string;
  snippet?: string;
  link?: string;
  date?: string;
};

export type SerperNewsResponse = {
  news?: SerperNewsResult[];
};

export type SerperImageResult = {
  title?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  thumbnailUrl?: string;
  source?: string;
};

export type SerperImagesResponse = {
  images?: SerperImageResult[];
};

export function isSerperConfigured(): boolean {
  return !!ENV.serperApiKey;
}

async function serperFetch<T>(
  endpoint: "search" | "news" | "images",
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<T | null> {
  if (!ENV.serperApiKey) return null;

  try {
    const res = await fetch(`https://google.serper.dev/${endpoint}`, {
      method: "POST",
      headers: {
        "X-API-KEY": ENV.serperApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.warn(`[Serper] /${endpoint} retornou ${res.status} para query "${String(body.q ?? "")}"`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(
      `[Serper] Erro em /${endpoint} para query "${String(body.q ?? "")}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function serperSearch(params: {
  q: string;
  gl?: string;
  hl?: string;
  num?: number;
  timeoutMs?: number;
}): Promise<SerperSearchResponse | null> {
  const { timeoutMs = 8000, ...body } = params;
  return serperFetch<SerperSearchResponse>("search", { gl: "br", hl: "pt", num: 10, ...body }, timeoutMs);
}

export async function serperNews(params: {
  q: string;
  gl?: string;
  hl?: string;
  num?: number;
  timeoutMs?: number;
}): Promise<SerperNewsResponse | null> {
  const { timeoutMs = 8000, ...body } = params;
  return serperFetch<SerperNewsResponse>("news", { gl: "br", hl: "pt-br", num: 10, ...body }, timeoutMs);
}

export async function serperImages(params: {
  q: string;
  num?: number;
  timeoutMs?: number;
}): Promise<SerperImagesResponse | null> {
  const { timeoutMs = 7000, ...body } = params;
  return serperFetch<SerperImagesResponse>("images", { num: 20, ...body }, timeoutMs);
}
