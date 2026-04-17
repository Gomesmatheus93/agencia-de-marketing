import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { invokeLLM } from "./llm";

type StorageAsset = {
  data: Buffer;
  contentType: string;
  extension: string;
};

type SaveCarouselTemplateAssetInput = {
  userId: number;
  name: string;
  imageUrl?: string;
  imageDataUrl?: string;
};

type SavedCarouselTemplateAsset = {
  imageUrl: string;
  styleBrief: string;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function getExtensionFromMimeType(mimeType: string) {
  return MIME_EXTENSION_MAP[mimeType] || "png";
}

function parseDataUrl(dataUrl: string): StorageAsset | undefined {
  if (!dataUrl.startsWith("data:")) return undefined;

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return undefined;

  const header = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const headerParts = header.split(";").filter(Boolean);
  const mimeType = headerParts[0] || "image/png";
  const isBase64 = headerParts.includes("base64");
  const buffer = isBase64 ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body));

  return {
    data: buffer,
    contentType: mimeType,
    extension: getExtensionFromMimeType(mimeType),
  };
}

function getUploadsAssetPath(assetUrl: string) {
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

async function writeAssetToUploads(input: {
  relativePath: string;
  data: Buffer;
}) {
  const normalizedRelativePath = input.relativePath.replace(/^\/+/, "");
  const absolutePath = path.resolve(UPLOADS_ROOT, normalizedRelativePath);

  if (
    !absolutePath.startsWith(`${UPLOADS_ROOT}${path.sep}`) &&
    absolutePath !== UPLOADS_ROOT
  ) {
    throw new Error(`Caminho de upload invalido: ${normalizedRelativePath}`);
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, input.data);

  return `/uploads/${normalizedRelativePath.replace(/\\/g, "/")}`;
}

async function readUploadsAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  const uploadsAssetPath = getUploadsAssetPath(assetUrl);
  if (!uploadsAssetPath) return undefined;

  const absolutePath = path.resolve(process.cwd(), uploadsAssetPath.replace(/^\/+/, ""));

  if (!absolutePath.startsWith(`${UPLOADS_ROOT}${path.sep}`) && absolutePath !== UPLOADS_ROOT) {
    throw new Error(`Caminho de upload invalido: ${uploadsAssetPath}`);
  }

  const data = await fs.readFile(absolutePath);
  const extension = path.extname(absolutePath).replace(/^\./, "").toLowerCase() || "png";
  const contentType =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "webp"
        ? "image/webp"
        : extension === "gif"
          ? "image/gif"
          : "image/png";

  return { data, contentType, extension };
}

async function readRemoteAsset(assetUrl: string): Promise<StorageAsset | undefined> {
  if (!/^https?:\/\//i.test(assetUrl)) {
    return undefined;
  }

  const response = await fetch(assetUrl);
  if (!response.ok) {
    throw new Error(
      `Falha ao baixar o template visual (${response.status} ${response.statusText})`
    );
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  if (!mimeType.startsWith("image/")) {
    throw new Error("O template precisa ser um arquivo de imagem.");
  }

  return {
    data: Buffer.from(await response.arrayBuffer()),
    contentType: mimeType,
    extension: getExtensionFromMimeType(mimeType),
  };
}

async function resolveTemplateAsset(input: {
  imageUrl?: string;
  imageDataUrl?: string;
}): Promise<StorageAsset> {
  const fromDataUrl = input.imageDataUrl ? parseDataUrl(input.imageDataUrl) : undefined;
  if (fromDataUrl) {
    return fromDataUrl;
  }

  if (!input.imageUrl) {
    throw new Error("Envie a imagem do template para salvar o estilo.");
  }

  const fromUploads = await readUploadsAsset(input.imageUrl);
  if (fromUploads) {
    return fromUploads;
  }

  const fromRemote = await readRemoteAsset(input.imageUrl);
  if (fromRemote) {
    return fromRemote;
  }

  throw new Error("Nao consegui ler a imagem do template.");
}

function buildFallbackStyleBrief(templateName: string) {
  return [
    `Siga a linguagem visual do template "${templateName}" como referencia principal.`,
    "Mantenha a hierarquia, a atmosfera, o contraste, a paleta e o tipo de fotografia percebidos na imagem.",
    "O resultado deve parecer parte da mesma familia visual, pronto para um carrossel social premium.",
  ].join(" ");
}

async function analyzeTemplateStyle(input: {
  templateName: string;
  asset: StorageAsset;
}) {
  const dataUrl = `data:${input.asset.contentType};base64,${input.asset.data.toString("base64")}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Voce analisa referencias visuais de design para carrosseis de redes sociais.

Seu trabalho e transformar um template visual em um briefing curto, util e acionavel para outro agente gerar novas pecas no mesmo estilo.

Escreva apenas o suficiente para preservar a familia visual. Foque em:
- paleta e contraste
- sensacao de premium, sobriedade ou energia
- tipo de fotografia e enquadramento esperado
- densidade visual, espacamento e composicao
- acabamento geral que deve ser repetido nas proximas imagens

Nao descreva o assunto da imagem como se fosse o tema final do carrossel. Extraia o estilo, nao o tema.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Template salvo com o nome: ${input.templateName}

Analise a referencia visual e devolva um styleBrief curto, em portugues brasileiro, com no maximo 120 palavras. Esse texto sera reutilizado para orientar a geracao de novas imagens e novos carrosseis no mesmo estilo.`,
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "low",
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_template_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              styleBrief: { type: "string" },
            },
            required: ["styleBrief"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices[0]?.message?.content;
    const parsed = JSON.parse(
      (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) || "{}"
    ) as { styleBrief?: string };

    const styleBrief = parsed.styleBrief?.replace(/\s+/g, " ").trim();
    return styleBrief || buildFallbackStyleBrief(input.templateName);
  } catch (error) {
    console.warn("[CarouselTemplate] Nao consegui analisar o template, usando fallback:", error);
    return buildFallbackStyleBrief(input.templateName);
  }
}

export async function saveCarouselTemplateAsset(
  input: SaveCarouselTemplateAssetInput
): Promise<SavedCarouselTemplateAsset> {
  const asset = await resolveTemplateAsset(input);

  if (!asset.contentType.startsWith("image/")) {
    throw new Error("O template precisa ser uma imagem valida.");
  }

  const imageUrl = await writeAssetToUploads({
    relativePath: path.posix.join(
      "carousel-templates",
      String(input.userId),
      `${randomUUID()}.${asset.extension}`
    ),
    data: asset.data,
  });

  const styleBrief = await analyzeTemplateStyle({
    templateName: input.name,
    asset,
  });

  return {
    imageUrl,
    styleBrief,
  };
}
