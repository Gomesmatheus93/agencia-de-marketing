import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { storagePut } from "../storage";

export type InstagramPostingSlide = {
  title: string;
  body?: string;
  imageUrl?: string;
  imageDataUrl?: string;
  svg?: string;
};

export type InstagramPostingInput = {
  userId: number;
  topic: string;
  hook?: string;
  caption?: string;
  finalCta?: string;
  slides: InstagramPostingSlide[];
};

export type InstagramPostingResult = {
  success: true;
  mediaId: string;
  containerId: string;
  childContainerIds: string[];
  slideUrls: string[];
  publicAssetType: "png" | "svg";
  caption: string;
};

type GraphResponse = {
  id?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type ParsedDataUrl = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

const DEFAULT_META_GRAPH_API_VERSION = "v25.0";

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTag(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const parts = cleaned.split(" ").filter(Boolean);
  const joined = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

  return joined.length >= 3 ? `#${joined}` : "";
}

function buildHashtags(input: InstagramPostingInput) {
  const stopWords = new Set([
    "a", "as", "o", "os", "e", "de", "do", "da", "dos", "das", "na", "no", "nas", "nos",
    "em", "para", "por", "com", "sem", "um", "uma", "uns", "umas", "que", "como", "mais",
  ]);

  const tokens = [input.topic, input.hook || "", ...input.slides.map((slide) => slide.title)]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));

  const unique = Array.from(new Set(tokens));
  const tags = unique
    .slice(0, 5)
    .map((token) => normalizeTag(token))
    .filter(Boolean);

  return tags.join(" ");
}

function getGraphApiBaseUrl() {
  return (ENV.metaGraphApiBaseUrl || "https://graph.facebook.com").replace(/\/+$/, "");
}

function getGraphApiVersion() {
  return (ENV.metaGraphApiVersion || DEFAULT_META_GRAPH_API_VERSION).replace(/^\/+/, "");
}

function getRequiredMetaConfig() {
  const missing: string[] = [];

  if (!ENV.metaInstagramAccountId) missing.push("META_INSTAGRAM_ACCOUNT_ID");
  if (!ENV.metaAccessToken) missing.push("META_ACCESS_TOKEN");

  if (missing.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Configuracao da Meta incompleta. Defina no .env: ${missing.join(", ")}.`,
    });
  }

  return {
    igUserId: ENV.metaInstagramAccountId,
    accessToken: ENV.metaAccessToken,
    graphBaseUrl: `${getGraphApiBaseUrl()}/${getGraphApiVersion()}`,
  };
}

function getDataUrlExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "bin";
}

function parseDataUrl(dataUrl: string): ParsedDataUrl {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("Formato de imagem invalido: esperava um data URL.");
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Formato de imagem invalido: data URL sem conteudo.");
  }

  const header = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const headerParts = header.split(";").filter(Boolean);
  const mimeType = headerParts[0] || "image/png";
  const isBase64 = headerParts.includes("base64");
  const buffer = isBase64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));

  return {
    buffer,
    mimeType,
    extension: getDataUrlExtension(mimeType),
  };
}

function buildStorageKey(input: {
  userId: number;
  batchId: string;
  index: number;
  extension: string;
}) {
  return [
    "instagram",
    "carousels",
    String(input.userId),
    input.batchId,
    `slide-${String(input.index + 1).padStart(2, "0")}.${input.extension}`,
  ].join("/");
}

async function putPublicAsset(key: string, data: Buffer | string, contentType: string) {
  try {
    return await storagePut(key, data, contentType);
  } catch (err) {
    const storageHint =
      ENV.publicStorageProvider === "catbox"
        ? "Confira PUBLIC_STORAGE_PROVIDER=catbox, CATBOX_API_URL e, se usar conta, CATBOX_USERHASH."
        : "Confira BUILT_IN_FORGE_API_URL e BUILT_IN_FORGE_API_KEY.";
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Nao consegui transformar o slide em URL publica. ${storageHint} Detalhe: ${
        err instanceof Error ? err.message : "falha no storage"
      }`,
    });
  }
}

async function uploadSlideToPublicUrl(input: {
  slide: InstagramPostingSlide;
  userId: number;
  batchId: string;
  index: number;
}) {
  if (input.slide.imageDataUrl) {
    const parsed = parseDataUrl(input.slide.imageDataUrl);
    const key = buildStorageKey({
      userId: input.userId,
      batchId: input.batchId,
      index: input.index,
      extension: parsed.extension,
    });
    const uploaded = await putPublicAsset(key, parsed.buffer, parsed.mimeType);
    return { url: uploaded.url, assetType: parsed.extension === "svg" ? "svg" : "png" };
  }

  if (input.slide.svg) {
    const key = buildStorageKey({
      userId: input.userId,
      batchId: input.batchId,
      index: input.index,
      extension: "svg",
    });
    const uploaded = await putPublicAsset(key, input.slide.svg, "image/svg+xml");
    return { url: uploaded.url, assetType: "svg" };
  }

  if (input.slide.imageUrl && /^https?:\/\//i.test(input.slide.imageUrl)) {
    return { url: input.slide.imageUrl, assetType: "png" };
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Nao foi possivel preparar um slide para postagem. Gere a imagem PNG do slide antes de publicar.",
  });
}

async function postToGraph(
  endpoint: string,
  params: Record<string, string>,
  config: ReturnType<typeof getRequiredMetaConfig>
) {
  const body = new URLSearchParams({
    ...params,
    access_token: config.accessToken,
  });
  const response = await fetch(`${config.graphBaseUrl}/${config.igUserId}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  let data: GraphResponse = {};

  try {
    data = text ? (JSON.parse(text) as GraphResponse) : {};
  } catch {
    data = {};
  }

  if (!response.ok || data.error) {
    const error = data.error;
    const isObjectAccessError = error?.code === 100 && error?.error_subcode === 33;
    const flowHint = config.graphBaseUrl.includes("graph.instagram.com")
      ? "Para graph.instagram.com, use um token gerado pelo Instagram Login e um Instagram User ID que esse mesmo token consegue acessar."
      : "Para graph.facebook.com, use Page Access Token de uma Pagina conectada a uma conta Instagram profissional e defina META_INSTAGRAM_ACCOUNT_ID com o id retornado por instagram_business_account dessa Pagina.";
    const metaDetail = [
      error?.message,
      error?.code ? `code ${error.code}` : "",
      error?.error_subcode ? `subcode ${error.error_subcode}` : "",
      error?.fbtrace_id ? `trace ${error.fbtrace_id}` : "",
      isObjectAccessError ? flowHint : "",
    ]
      .filter(Boolean)
      .join(" | ");

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Erro na Meta API em /${endpoint}: ${metaDetail || text || response.statusText}`,
    });
  }

  if (!data.id) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `A Meta API nao retornou um id em /${endpoint}.`,
    });
  }

  return data.id;
}

function buildCaption(input: InstagramPostingInput) {
  const intro = compactText(input.caption?.trim() || input.hook?.trim() || input.topic);
  const cta = compactText(input.finalCta?.trim() || "Salve este carrossel e compartilhe com quem precisa ver isso.");
  const hashtags = buildHashtags(input);
  const slideBlocks = input.slides
    .map((slide, index) => {
      const title = compactText(slide.title);
      const body = compactText(slide.body || "");
      return [`${index + 1}. ${title}`, body].filter(Boolean).join("\n");
    })
    .filter(Boolean);

  const baseSections = [intro, "Neste carrossel:", ...slideBlocks];
  const sections: string[] = [];
  const reserveLength = cta.length + (hashtags ? hashtags.length + 2 : 0);

  for (const section of baseSections) {
    const candidate = [...sections, section].join("\n\n");
    if (candidate.length + reserveLength <= 2200) {
      sections.push(section);
      continue;
    }

    if (section === "Neste carrossel:" || !section.includes("\n")) {
      continue;
    }

    const [title, body] = section.split("\n", 2);
    const available = 2200 - reserveLength - [...sections, title].join("\n\n").length - 2;
    const shortenedBody =
      available > 24 && body.length > available
        ? `${body.slice(0, available).replace(/\s+\S*$/, "").trim()}...`
        : body;

    if (shortenedBody) {
      sections.push([title, shortenedBody].join("\n"));
    }
    break;
  }

  const tail = [cta, hashtags].filter(Boolean);
  return [...sections, ...tail].join("\n\n").slice(0, 2200).trim();
}

export async function publishInstagramCarouselWithAgent(
  input: InstagramPostingInput
): Promise<InstagramPostingResult> {
  const config = getRequiredMetaConfig();
  const slides = input.slides.filter((slide) => compactText(slide.title).length > 0);

  if (slides.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nenhum slide valido foi enviado para postagem.",
    });
  }

  const batchId = randomUUID();
  const uploadedSlides = [];

  for (let index = 0; index < slides.length; index += 1) {
    uploadedSlides.push(
      await uploadSlideToPublicUrl({
        slide: slides[index],
        userId: input.userId,
        batchId,
        index,
      })
    );
  }

  const slideUrls = uploadedSlides.map((slide) => slide.url);
  const publicAssetType = uploadedSlides.some((slide) => slide.assetType === "svg") ? "svg" : "png";
  const caption = buildCaption(input);

  if (slides.length === 1) {
    const containerId = await postToGraph(
      "media",
      {
        image_url: slideUrls[0],
        caption,
      },
      config
    );
    const mediaId = await postToGraph("media_publish", { creation_id: containerId }, config);

    return {
      success: true,
      mediaId,
      containerId,
      childContainerIds: [],
      slideUrls,
      publicAssetType,
      caption,
    };
  }

  const childContainerIds = [];

  for (let index = 0; index < slideUrls.length; index += 1) {
    childContainerIds.push(
      await postToGraph(
        "media",
        {
          image_url: slideUrls[index],
          is_carousel_item: "true",
        },
        config
      )
    );
  }

  const containerId = await postToGraph(
    "media",
    {
      media_type: "CAROUSEL",
      children: childContainerIds.join(","),
      caption,
    },
    config
  );
  const mediaId = await postToGraph("media_publish", { creation_id: containerId }, config);

  return {
    success: true,
    mediaId,
    containerId,
    childContainerIds,
    slideUrls,
    publicAssetType,
    caption,
  };
}
