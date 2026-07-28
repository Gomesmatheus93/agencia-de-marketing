import fs from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { invokeLLM } from "./llm";

const LINKEDIN_COMMENTARY_LIMIT = 3000;
const LINKEDIN_ARTICLE_DESCRIPTION_LIMIT = 400;
const LINKEDIN_ALT_TEXT_LIMIT = 120;
const DEFAULT_LINKEDIN_API_BASE_URL = "https://api.linkedin.com/rest";
const DEFAULT_LINKEDIN_API_VERSION = "202601";

export type LinkedInArticlePostingInput = {
  title: string;
  content: string;
  summary?: string | null;
  topic?: string | null;
  sourceUrl?: string | null;
  coverImageUrl?: string | null;
};

export type LinkedInArticlePostingResult = {
  success: true;
  postUrn: string;
  authorUrn: string;
  postType: "article" | "image" | "text";
  commentary: string;
  articleTitle: string;
  articleDescription: string;
  imageAltText: string;
  imageUrn?: string;
  sourceUrl?: string;
};

export type LinkedInAuthDiagnosticCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export type LinkedInAuthDiagnosticResult = {
  success: boolean;
  apiBaseUrl: string;
  apiVersion: string;
  tokenPresent: boolean;
  tokenPreview: string;
  configuredAuthorUrn: string;
  configuredAuthorUrnType: "person" | "organization" | "unknown";
  configuredAuthorUrnLooksValid: boolean;
  configuredAuthorUrnIsPlaceholder: boolean;
  detectedPersonUrn?: string;
  detectedMemberId?: string;
  detectedMemberName?: string;
  administeredOrganizationUrns: string[];
  recommendedAuthorUrns: string[];
  checks: LinkedInAuthDiagnosticCheck[];
  nextSteps: string[];
};

type LinkedInCopyPayload = {
  commentary?: string;
  articleTitle?: string;
  articleDescription?: string;
  imageAltText?: string;
};

type LinkedInUserInfoResponse = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

type LinkedInOrganizationAclResponse = {
  elements?: Array<{
    organization?: string;
  }>;
};

type LinkedInImageInitResponse = {
  value?: {
    uploadUrl?: string;
    image?: string;
  };
};

type LinkedInApiErrorResponse = {
  message?: string;
  status?: number;
  serviceErrorCode?: number;
};

type BinaryAsset = {
  buffer: Buffer;
  mimeType: string;
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: string, maxLength: number) {
  const normalized = compactText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).replace(/\s+\S*$/, "").trim()}...`;
}

function clampMultilineText(value: string, maxLength: number) {
  if (maxLength <= 0) return "";

  const normalized = value
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => compactText(paragraph))
    .filter(Boolean)
    .join("\n\n");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }

  return `${normalized.slice(0, maxLength - 3).replace(/\s+\S*$/, "").trim()}...`;
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildParagraphExcerpt(content: string, maxParagraphs: number) {
  return stripMarkdown(content)
    .split(/\n{2,}/)
    .map((paragraph) => compactText(paragraph))
    .filter(Boolean)
    .slice(0, maxParagraphs)
    .join("\n\n");
}

function normalizeSourceUrl(sourceUrl?: string | null) {
  if (!sourceUrl) return undefined;

  try {
    const parsed = new URL(sourceUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

function buildFallbackCommentary(input: LinkedInArticlePostingInput) {
  const sections = [
    clampText(input.title, 180),
    input.summary ? clampText(input.summary, 420) : "",
    clampText(buildParagraphExcerpt(input.content, 2), 1600),
    "O que mais chamou a sua atencao nesse tema?",
  ].filter(Boolean);

  return clampText(sections.join("\n\n"), LINKEDIN_COMMENTARY_LIMIT);
}

function buildImagePostCommentary(input: LinkedInArticlePostingInput) {
  const sections = [
    compactText(input.title),
    input.summary ? compactText(input.summary) : "",
    buildParagraphExcerpt(input.content, 5),
    "O que mais chamou a sua atencao nesse tema?",
  ].filter(Boolean);

  return clampMultilineText(sections.join("\n\n"), LINKEDIN_COMMENTARY_LIMIT);
}

function buildFallbackDescription(input: LinkedInArticlePostingInput) {
  return clampText(
    input.summary ||
      buildParagraphExcerpt(input.content, 1) ||
      input.topic ||
      input.title,
    LINKEDIN_ARTICLE_DESCRIPTION_LIMIT
  );
}

function buildFallbackAltText(input: LinkedInArticlePostingInput) {
  return clampText(
    `Capa do artigo "${input.title}" sobre ${input.topic || "o tema abordado"}.`,
    LINKEDIN_ALT_TEXT_LIMIT
  );
}

function appendSourceFooter(commentary: string, sourceUrl: string) {
  const footer = `Fonte real da noticia: ${sourceUrl}`;
  const separator = commentary.trim() ? "\n\n" : "";
  const maxCommentaryLength = LINKEDIN_COMMENTARY_LIMIT - separator.length - footer.length;

  if (maxCommentaryLength <= 0) {
    return clampMultilineText(footer, LINKEDIN_COMMENTARY_LIMIT);
  }

  return `${clampMultilineText(commentary, maxCommentaryLength)}${separator}${footer}`;
}

function buildArticleStyleCommentary(input: LinkedInArticlePostingInput, sourceUrl: string) {
  const title = compactText(input.title);
  const paragraphs = stripMarkdown(input.content)
    .split(/\n{2,}/)
    .map((paragraph) => compactText(paragraph))
    .filter(Boolean);

  const bodyParagraphs =
    paragraphs[0]?.toLowerCase() === title.toLowerCase() ? paragraphs.slice(1) : paragraphs;

  const commentary = [title, ...bodyParagraphs].filter(Boolean).join("\n\n");
  return appendSourceFooter(commentary || buildFallbackCommentary(input), sourceUrl);
}

function maskToken(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.length <= 8) return "*".repeat(normalized.length);
  return `${normalized.slice(0, 4)}${"*".repeat(normalized.length - 8)}${normalized.slice(-4)}`;
}

function getAuthorUrnType(value: string): "person" | "organization" | "unknown" {
  const normalized = value.trim();
  if (/^urn:li:person:[A-Za-z0-9_-]+$/i.test(normalized)) return "person";
  if (/^urn:li:organization:[A-Za-z0-9_-]+$/i.test(normalized)) return "organization";
  return "unknown";
}

function looksLikeValidAuthorUrn(value: string) {
  return getAuthorUrnType(value) !== "unknown";
}

function isPlaceholderAuthorUrn(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes("seu_id") ||
    normalized.includes("your_id") ||
    normalized.includes("{id}") ||
    normalized.includes("<id>") ||
    normalized.endsWith(":id")
  );
}

function getLinkedInConfig() {
  const missing: string[] = [];

  if (!ENV.linkedinAccessToken) missing.push("LINKEDIN_ACCESS_TOKEN");
  if (!ENV.linkedinAuthorUrn) missing.push("LINKEDIN_AUTHOR_URN");

  if (missing.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Configuracao do LinkedIn incompleta. Defina no .env: ${missing.join(", ")}.`,
    });
  }

  return {
    accessToken: ENV.linkedinAccessToken,
    authorUrn: ENV.linkedinAuthorUrn,
    apiBaseUrl: (ENV.linkedinApiBaseUrl || DEFAULT_LINKEDIN_API_BASE_URL).replace(/\/+$/, ""),
    apiVersion: (ENV.linkedinApiVersion || DEFAULT_LINKEDIN_API_VERSION).trim(),
  };
}

function buildLinkedInHeaders(config: ReturnType<typeof getLinkedInConfig>, includeJson = true) {
  return {
    Authorization: `Bearer ${config.accessToken}`,
    "Linkedin-Version": config.apiVersion,
    "X-Restli-Protocol-Version": "2.0.0",
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

async function parseLinkedInError(response: Response) {
  const text = await response.text().catch(() => "");

  try {
    const parsed = JSON.parse(text) as LinkedInApiErrorResponse;
    return compactText(
      [
        parsed.message,
        parsed.status ? `status ${parsed.status}` : "",
        parsed.serviceErrorCode ? `code ${parsed.serviceErrorCode}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    );
  } catch {
    return compactText(text);
  }
}

async function callLinkedInRaw(
  endpoint: string,
  init: RequestInit,
  config: ReturnType<typeof getLinkedInConfig>
) {
  return fetch(`${config.apiBaseUrl}${endpoint}`, init);
}

async function callLinkedInJson<T>(
  endpoint: string,
  init: RequestInit,
  config: ReturnType<typeof getLinkedInConfig>
) {
  const response = await fetch(`${config.apiBaseUrl}${endpoint}`, init);

  if (!response.ok) {
    const detail = await parseLinkedInError(response);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Erro na LinkedIn API em ${endpoint}: ${detail || response.statusText}`,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? (JSON.parse(text) as T) : ({} as T));
}

async function createLinkedInCopy(input: LinkedInArticlePostingInput) {
  const cleanedContent = buildParagraphExcerpt(input.content, 6).slice(0, 6000);
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const commentary = sourceUrl
    ? buildArticleStyleCommentary(input, sourceUrl)
    : buildImagePostCommentary(input);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Voce e um agente especialista em transformar artigos em publicacoes nativas para LinkedIn.

Seu trabalho e preparar a copy de um post pronto para publicar via API oficial do LinkedIn.

Regras:
- Escreva em portugues brasileiro.
- Nao invente fatos alem do que o artigo oferece.
- Preserve o contexto, os numeros e as conclusoes do artigo.
- Gere um comentario com cara de post nativo de LinkedIn: claro, profissional, humano e facil de ler.
- O comentario deve usar paragrafos curtos, sem markdown, sem listas com bullets e sem emojis.
- O comentario precisa terminar com uma pergunta ou convite simples para engajar.
- O comentario deve ter no maximo 3000 caracteres.
- Gere tambem um titulo curto para a visualizacao do artigo, uma descricao objetiva com no maximo 400 caracteres e um alt text curto para a imagem.`,
        },
        {
          role: "user",
          content: [
            `Titulo do artigo: ${input.title}`,
            input.topic ? `Tema: ${input.topic}` : "",
            input.summary ? `Resumo: ${input.summary}` : "",
            input.sourceUrl ? `Fonte/origem: ${input.sourceUrl}` : "",
            `Conteudo do artigo:\n${cleanedContent}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "linkedin_article_post_copy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              commentary: { type: "string" },
              articleTitle: { type: "string" },
              articleDescription: { type: "string" },
              imageAltText: { type: "string" },
            },
            required: ["commentary", "articleTitle", "articleDescription", "imageAltText"],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 800,
    });

    const rawContent = response.choices[0]?.message?.content;
    const parsed = JSON.parse(
      (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) || "{}"
    ) as LinkedInCopyPayload;

    const llmCommentary = typeof parsed.commentary === "string" && parsed.commentary.trim()
      ? clampMultilineText(parsed.commentary, LINKEDIN_COMMENTARY_LIMIT)
      : undefined;
    return {
      commentary: sourceUrl ? commentary : (llmCommentary ?? commentary),
      articleTitle: clampText(parsed.articleTitle || input.title, 200),
      articleDescription: clampText(
        parsed.articleDescription || buildFallbackDescription(input),
        LINKEDIN_ARTICLE_DESCRIPTION_LIMIT
      ),
      imageAltText: clampText(
        parsed.imageAltText || buildFallbackAltText(input),
        LINKEDIN_ALT_TEXT_LIMIT
      ),
    };
  } catch (error) {
    console.warn("[LinkedInArticlePostingAgent] Nao consegui gerar a copy com LLM, usando fallback:", error);
    return {
      commentary,
      articleTitle: clampText(input.title, 200),
      articleDescription: buildFallbackDescription(input),
      imageAltText: buildFallbackAltText(input),
    };
  }
}

function resolveUploadsPath(assetUrl: string) {
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

function readUploadsAsset(assetUrl: string): BinaryAsset | undefined {
  const uploadsPath = resolveUploadsPath(assetUrl);
  if (!uploadsPath) return undefined;

  const absolutePath = path.resolve(process.cwd(), uploadsPath.replace(/^\/+/, ""));
  const uploadsRoot = path.resolve(process.cwd(), "uploads");

  if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`) && absolutePath !== uploadsRoot) {
    throw new Error(`Caminho de uploads invalido: ${uploadsPath}`);
  }

  const buffer = fs.readFileSync(absolutePath);
  const extension = path.extname(absolutePath).replace(/^\./, "").toLowerCase();
  const mimeType =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : extension === "gif"
          ? "image/gif"
          : "image/png";

  return { buffer, mimeType };
}

function parseDataUrlAsset(assetUrl: string): BinaryAsset | undefined {
  if (!assetUrl.startsWith("data:")) return undefined;

  const commaIndex = assetUrl.indexOf(",");
  if (commaIndex < 0) return undefined;

  const header = assetUrl.slice(5, commaIndex);
  const body = assetUrl.slice(commaIndex + 1);
  const headerParts = header.split(";").filter(Boolean);
  const mimeType = headerParts[0] || "image/png";
  const isBase64 = headerParts.includes("base64");
  const buffer = isBase64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));

  return { buffer, mimeType };
}

async function fetchRemoteAsset(assetUrl: string) {
  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`Falha ao baixar a imagem da capa (${response.status} ${response.statusText})`);
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!mimeType.startsWith("image/")) {
    throw new Error("A URL da capa nao retornou um arquivo de imagem.");
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
  };
}

async function resolveCoverImageAsset(coverImageUrl?: string | null) {
  if (!coverImageUrl) return undefined;

  const dataUrlAsset = parseDataUrlAsset(coverImageUrl);
  if (dataUrlAsset) return dataUrlAsset;

  const uploadsAsset = readUploadsAsset(coverImageUrl);
  if (uploadsAsset) return uploadsAsset;

  if (/^https?:\/\//i.test(coverImageUrl)) {
    return fetchRemoteAsset(coverImageUrl);
  }

  return undefined;
}

async function uploadImageToLinkedIn(
  asset: BinaryAsset,
  config: ReturnType<typeof getLinkedInConfig>
) {
  const initResponse = await callLinkedInJson<LinkedInImageInitResponse>(
    "/images?action=initializeUpload",
    {
      method: "POST",
      headers: buildLinkedInHeaders(config),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: config.authorUrn,
        },
      }),
    },
    config
  );

  const uploadUrl = initResponse?.value?.uploadUrl;
  const imageUrn = initResponse?.value?.image;

  if (!uploadUrl || !imageUrn) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "A LinkedIn Images API nao retornou uploadUrl ou image URN.",
    });
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": asset.mimeType,
    },
    body: new Uint8Array(asset.buffer),
  });

  if (!uploadResponse.ok) {
    const detail = await parseLinkedInError(uploadResponse);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Falha ao enviar a imagem para o LinkedIn: ${detail || uploadResponse.statusText}`,
    });
  }

  return imageUrn;
}

export async function diagnoseLinkedInAuth(): Promise<LinkedInAuthDiagnosticResult> {
  const tokenValue = ENV.linkedinAccessToken || "";
  const authorUrn = ENV.linkedinAuthorUrn || "";
  const configuredAuthorUrnType = getAuthorUrnType(authorUrn);
  const configuredAuthorUrnLooksValid = looksLikeValidAuthorUrn(authorUrn);
  const configuredAuthorUrnIsPlaceholder = isPlaceholderAuthorUrn(authorUrn);
  const apiBaseUrl = (ENV.linkedinApiBaseUrl || DEFAULT_LINKEDIN_API_BASE_URL).replace(/\/+$/, "");
  const apiVersion = (ENV.linkedinApiVersion || DEFAULT_LINKEDIN_API_VERSION).trim();

  const result: LinkedInAuthDiagnosticResult = {
    success: false,
    apiBaseUrl,
    apiVersion,
    tokenPresent: tokenValue.trim().length > 0,
    tokenPreview: maskToken(tokenValue),
    configuredAuthorUrn: authorUrn.trim(),
    configuredAuthorUrnType,
    configuredAuthorUrnLooksValid,
    configuredAuthorUrnIsPlaceholder,
    administeredOrganizationUrns: [],
    recommendedAuthorUrns: [],
    checks: [],
    nextSteps: [],
  };

  if (!result.tokenPresent) {
    result.checks.push({
      name: "Access token",
      ok: false,
      detail: "LINKEDIN_ACCESS_TOKEN nao esta definido.",
    });
    result.nextSteps.push("Defina LINKEDIN_ACCESS_TOKEN no .env e reinicie o servidor.");
    return result;
  }

  result.checks.push({
    name: "Access token",
    ok: true,
    detail: `Token presente no ambiente (${tokenValue.trim().length} caracteres).`,
  });

  if (!authorUrn.trim()) {
    result.checks.push({
      name: "Author URN",
      ok: false,
      detail: "LINKEDIN_AUTHOR_URN nao esta definido.",
    });
    result.nextSteps.push("Defina LINKEDIN_AUTHOR_URN com urn:li:person:... ou urn:li:organization:....");
  } else if (!configuredAuthorUrnLooksValid) {
    result.checks.push({
      name: "Author URN",
      ok: false,
      detail: "O formato atual de LINKEDIN_AUTHOR_URN nao e valido.",
    });
    result.nextSteps.push("Corrija LINKEDIN_AUTHOR_URN para urn:li:person:... ou urn:li:organization:....");
  } else if (configuredAuthorUrnIsPlaceholder) {
    result.checks.push({
      name: "Author URN",
      ok: false,
      detail: "LINKEDIN_AUTHOR_URN ainda parece estar com placeholder.",
    });
    result.nextSteps.push("Troque SEU_ID pelo id real da pessoa ou organizacao.");
  } else {
    result.checks.push({
      name: "Author URN",
      ok: true,
      detail: `Formato valido detectado para ${configuredAuthorUrnType}.`,
    });
  }

  let config: ReturnType<typeof getLinkedInConfig>;
  try {
    config = getLinkedInConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Configuracao incompleta do LinkedIn.";
    result.checks.push({
      name: "Configuracao",
      ok: false,
      detail: message,
    });
    return result;
  }

  const identityResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!identityResponse.ok) {
    const detail = await parseLinkedInError(identityResponse);
    result.checks.push({
      name: "Validade do token",
      ok: false,
      detail: detail || identityResponse.statusText,
    });
    result.nextSteps.push("Gere um novo LINKEDIN_ACCESS_TOKEN com as permissoes corretas e reinicie o servidor.");
    return result;
  }

  const identityText = await identityResponse.text();
  const identity = (identityText
    ? (JSON.parse(identityText) as LinkedInUserInfoResponse)
    : {}) as LinkedInUserInfoResponse;
  const detectedMemberId = identity.sub ? String(identity.sub) : "";
  const detectedPersonUrn = detectedMemberId ? `urn:li:person:${detectedMemberId}` : undefined;
  const detectedMemberName = compactText(
    identity.name || `${identity.given_name || ""} ${identity.family_name || ""}`
  );

  if (detectedMemberId) {
    result.detectedMemberId = detectedMemberId;
    result.detectedPersonUrn = detectedPersonUrn;
    result.detectedMemberName = detectedMemberName || undefined;
    result.recommendedAuthorUrns.push(detectedPersonUrn!);
    result.checks.push({
      name: "Identidade do token",
      ok: true,
      detail: `Token valido para ${detectedMemberName || "membro autenticado"} (${detectedPersonUrn}).`,
    });
  } else {
    result.checks.push({
      name: "Identidade do token",
      ok: true,
      detail: "Token valido, mas a API nao retornou um id de membro.",
    });
  }

  if (configuredAuthorUrnType === "organization") {
    const orgAclsResponse = await callLinkedInRaw(
      "/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
      {
        method: "GET",
        headers: buildLinkedInHeaders(config, false),
      },
      config
    );

    if (orgAclsResponse.ok) {
      const orgAclText = await orgAclsResponse.text();
      const orgAclPayload = (orgAclText
        ? (JSON.parse(orgAclText) as LinkedInOrganizationAclResponse)
        : {}) as LinkedInOrganizationAclResponse;
      const organizationUrns = Array.from(
        new Set(
          (orgAclPayload.elements || [])
            .map((element) => compactText(element.organization || ""))
            .filter(Boolean)
        )
      );

      result.administeredOrganizationUrns = organizationUrns;
      result.recommendedAuthorUrns = Array.from(
        new Set([...result.recommendedAuthorUrns, ...organizationUrns])
      );
      result.checks.push({
        name: "Organizacoes administradas",
        ok: true,
        detail:
          organizationUrns.length > 0
            ? `${organizationUrns.length} organizacao(oes) administrada(s) detectada(s).`
            : "Nenhuma organizacao administrada foi retornada pelo token.",
      });
    } else {
      const detail = await parseLinkedInError(orgAclsResponse);
      result.checks.push({
        name: "Organizacoes administradas",
        ok: false,
        detail: detail || "Nao foi possivel listar organizacoes do token.",
      });
      result.nextSteps.push(
        "Se voce quer publicar como empresa, confirme as permissoes de admin e os escopos do token para organizacoes."
      );
    }
  } else {
    result.checks.push({
      name: "Organizacoes administradas",
      ok: true,
      detail: "Nao e necessario listar organizacoes para publicar como pessoa.",
    });
  }

  if (configuredAuthorUrnType === "person" && result.detectedPersonUrn) {
    const matches = authorUrn.trim() === result.detectedPersonUrn;
    result.checks.push({
      name: "Compatibilidade do author person URN",
      ok: matches,
      detail: matches
        ? "O LINKEDIN_AUTHOR_URN bate com o perfil autenticado."
        : `O token pertence a ${result.detectedPersonUrn}, mas o .env esta configurado com ${authorUrn.trim()}.`,
    });
    if (!matches) {
      result.nextSteps.push(`Troque LINKEDIN_AUTHOR_URN para ${result.detectedPersonUrn}.`);
    }
  }

  if (configuredAuthorUrnType === "organization") {
    const allowed = result.administeredOrganizationUrns.includes(authorUrn.trim());
    result.checks.push({
      name: "Compatibilidade do author organization URN",
      ok: allowed,
      detail: allowed
        ? "O LINKEDIN_AUTHOR_URN esta entre as organizacoes administradas pelo token."
        : "O LINKEDIN_AUTHOR_URN nao apareceu na lista de organizacoes administradas pelo token.",
    });
    if (!allowed && result.administeredOrganizationUrns.length > 0) {
      result.nextSteps.push(
        `Use uma destas URNs de organizacao: ${result.administeredOrganizationUrns.join(", ")}.`
      );
    }
  }

  result.success = result.checks.every((check) => check.ok);

  if (result.success) {
    result.nextSteps.push("A configuracao parece valida para publicar pelo LinkedIn.");
  }

  return result;
}

export async function publishArticleToLinkedInWithAgent(
  input: LinkedInArticlePostingInput
): Promise<LinkedInArticlePostingResult> {
  const config = getLinkedInConfig();
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);

  if (!input.coverImageUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Para publicar no LinkedIn, gere uma imagem de capa para o artigo antes de publicar.",
    });
  }

  const copy = await createLinkedInCopy(input);
  let coverAsset: BinaryAsset | undefined;

  try {
    coverAsset = await resolveCoverImageAsset(input.coverImageUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Imagem de capa invalida.";
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Nao consegui carregar a imagem de capa para o LinkedIn: ${message}`,
    });
  }

  if (!coverAsset) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nao consegui localizar a imagem de capa para enviar ao LinkedIn.",
    });
  }

  let imageUrn: string;
  try {
    imageUrn = await uploadImageToLinkedIn(coverAsset, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao subir a capa.";
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Nao consegui subir a capa para o LinkedIn: ${message}`,
    });
  }

  const postType: LinkedInArticlePostingResult["postType"] = sourceUrl ? "article" : "image";

  const payload: Record<string, unknown> = {
    author: config.authorUrn,
    commentary: copy.commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (sourceUrl) {
    payload.content = {
      article: {
        source: sourceUrl,
        title: copy.articleTitle,
        description: copy.articleDescription,
        thumbnail: imageUrn,
      },
    };
  } else {
    payload.content = {
      media: {
        id: imageUrn,
        altText: copy.imageAltText,
        title: copy.articleTitle,
      },
    };
  }

  const response = await fetch(`${config.apiBaseUrl}/posts`, {
    method: "POST",
    headers: buildLinkedInHeaders(config),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await parseLinkedInError(response);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Erro ao publicar no LinkedIn: ${detail || response.statusText}`,
    });
  }

  const postUrn = response.headers.get("x-restli-id");
  if (!postUrn) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "A LinkedIn Posts API nao retornou o identificador do post publicado.",
    });
  }

  return {
    success: true,
    postUrn,
    authorUrn: config.authorUrn,
    postType,
    commentary: copy.commentary,
    articleTitle: copy.articleTitle,
    articleDescription: copy.articleDescription,
    imageAltText: copy.imageAltText,
    imageUrn,
    sourceUrl: sourceUrl ?? undefined,
  };
}
