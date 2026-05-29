// Preconfigured storage helpers for public assets.
// Default provider uses the Biz-provided storage proxy. Catbox or AWS S3 can be
// enabled with PUBLIC_STORAGE_PROVIDER=catbox or PUBLIC_STORAGE_PROVIDER=aws.

import { GetObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };
type AwsStorageConfig = {
  accessKeyId?: string;
  bucket: string;
  publicBaseUrl?: string;
  region: string;
  secretAccessKey?: string;
};
type StorageProvider = "aws" | "catbox" | "forge";
const CATBOX_PUBLIC_HOST = "files.catbox.moe";
let s3Client: S3Client | null = null;

function getStorageProvider(): StorageProvider {
  if (ENV.publicStorageProvider === "catbox") return "catbox";
  if (ENV.publicStorageProvider === "aws" || ENV.publicStorageProvider === "s3") return "aws";
  return "forge";
}

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function encodeKeyForUrl(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function decodeKeyFromUrlPath(pathname: string) {
  return decodeURIComponent(pathname.replace(/^\/+/, ""));
}

function getAwsStorageConfig(): AwsStorageConfig {
  const bucket = ENV.awsBucket.trim();
  const region = ENV.awsRegion.trim();
  const accessKeyId = ENV.awsAccessKeyId.trim();
  const secretAccessKey = ENV.awsSecretAccessKey.trim();
  const publicBaseUrl = ENV.awsPublicBaseUrl.trim().replace(/\/+$/, "");

  if (!bucket || !region) {
    throw new Error("AWS storage credentials missing: set AWS_BUCKET and AWS_REGION");
  }

  return {
    accessKeyId: accessKeyId || undefined,
    bucket,
    publicBaseUrl: publicBaseUrl || undefined,
    region,
    secretAccessKey: secretAccessKey || undefined,
  };
}

function getS3Client(config: AwsStorageConfig) {
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
    });
  }

  return s3Client;
}

export function buildAwsPublicUrl(
  config: Pick<AwsStorageConfig, "bucket" | "publicBaseUrl" | "region">,
  key: string
) {
  const encodedKey = encodeKeyForUrl(normalizeKey(key));
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${encodedKey}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`;
}

function getAwsObjectKeyFromUrl(assetUrl: string, config: AwsStorageConfig) {
  if (!/^https?:\/\//i.test(assetUrl)) return undefined;

  try {
    const parsed = new URL(assetUrl);

    if (config.publicBaseUrl) {
      const publicBaseUrl = new URL(ensureTrailingSlash(config.publicBaseUrl));
      if (
        parsed.origin === publicBaseUrl.origin &&
        parsed.pathname.startsWith(publicBaseUrl.pathname)
      ) {
        return decodeKeyFromUrlPath(parsed.pathname.slice(publicBaseUrl.pathname.length));
      }
    }

    if (parsed.hostname === `${config.bucket}.s3.${config.region}.amazonaws.com`) {
      return decodeKeyFromUrlPath(parsed.pathname);
    }

    if (parsed.hostname === `s3.${config.region}.amazonaws.com`) {
      const parts = parsed.pathname.replace(/^\/+/, "").split("/");
      if (parts.shift() === config.bucket) {
        return decodeURIComponent(parts.join("/"));
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getImageContentTypeFromKey(key: string) {
  const extension = key.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/png";
}

export async function getMetaFetchableStorageUrl(assetUrl: string) {
  if (getStorageProvider() !== "aws") {
    return assetUrl;
  }

  const config = getAwsStorageConfig();
  const key = getAwsObjectKeyFromUrl(assetUrl, config);
  if (!key) {
    return assetUrl;
  }

  return getSignedUrl(
    getS3Client(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ResponseContentDisposition: "inline",
      ResponseContentType: getImageContentTypeFromKey(key),
    }),
    { expiresIn: 60 * 60 }
  );
}

export function isConfiguredPublicStorageUrl(assetUrl: string) {
  if (!/^https?:\/\//i.test(assetUrl)) return false;

  try {
    const parsed = new URL(assetUrl);
    const provider = getStorageProvider();

    if (provider === "catbox") {
      return parsed.hostname === CATBOX_PUBLIC_HOST;
    }

    if (provider === "aws") {
      const config = getAwsStorageConfig();
      if (config.publicBaseUrl) {
        const publicBaseUrl = new URL(ensureTrailingSlash(config.publicBaseUrl));
        return parsed.origin === publicBaseUrl.origin &&
          parsed.pathname.startsWith(publicBaseUrl.pathname);
      }

      return parsed.hostname === `${config.bucket}.s3.${config.region}.amazonaws.com`;
    }
  } catch {
    return false;
  }

  return false;
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function toCatboxFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("reqtype", "fileupload");
  if (ENV.catboxUserHash) {
    form.append("userhash", ENV.catboxUserHash);
  }
  form.append("fileToUpload", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

function normalizeCatboxCandidate(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^\/?[A-Za-z0-9._-]+\.[A-Za-z0-9]+$/i.test(trimmed)) {
    const normalizedPath = trimmed.replace(/^\/+/, "");
    return `https://${CATBOX_PUBLIC_HOST}/${normalizedPath}`;
  }

  if (/^files\.catbox\.moe\/.+/i.test(trimmed)) {
    return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
  }

  return undefined;
}

export function extractCatboxPublicUrl(input: {
  bodyText?: string;
  headers?: Headers;
  responseUrl?: string;
}): string | undefined {
  const bodyText = input.bodyText?.trim();
  const directBodyUrl = normalizeCatboxCandidate(bodyText);
  if (directBodyUrl) return directBodyUrl;

  const bodyMatch = bodyText?.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  const matchedBodyUrl = normalizeCatboxCandidate(bodyMatch);
  if (matchedBodyUrl) return matchedBodyUrl;

  const headerCandidates = [
    input.headers?.get("location"),
    input.headers?.get("content-location"),
    input.headers?.get("x-file-url"),
    input.headers?.get("x-url"),
  ];

  for (const candidate of headerCandidates) {
    const normalized = normalizeCatboxCandidate(candidate);
    if (normalized) return normalized;
  }

  if (input.responseUrl) {
    try {
      const parsed = new URL(input.responseUrl);
      if (parsed.hostname === CATBOX_PUBLIC_HOST) {
        return input.responseUrl;
      }
    } catch {
      // ignore invalid response URL
    }
  }

  return undefined;
}

async function catboxPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const fileName = key.split("/").pop() || "file";
  const formData = toCatboxFormData(data, contentType, fileName);
  const response = await fetch(ENV.catboxApiUrl, {
    method: "POST",
    body: formData,
  });
  const text = (await response.text()).trim();
  const publicUrl = extractCatboxPublicUrl({
    bodyText: text,
    headers: response.headers,
    responseUrl: response.url,
  });

  if (!response.ok || !publicUrl) {
    throw new Error(
      `Catbox upload failed (${response.status} ${response.statusText}): ${text || "no URL returned"}`
    );
  }

  return { key, url: publicUrl };
}

async function awsPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const config = getAwsStorageConfig();
  const key = normalizeKey(relKey);

  await getS3Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: data,
      CacheControl: "public, max-age=31536000, immutable",
      ContentDisposition: "inline",
      ContentType: contentType,
    })
  );

  return { key, url: buildAwsPublicUrl(config, key) };
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string | null> {
  const provider = getStorageProvider();
  if (provider !== "aws") return null;

  const config = getAwsStorageConfig();
  // Only sign ContentType — CacheControl/ContentDisposition as signed headers
  // cause 403 SignatureDoesNotMatch because browsers don't send them on PUT.
  return getSignedUrl(
    getS3Client(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: normalizeKey(key),
      ContentType: contentType,
    }),
    { expiresIn: 3600 }
  );
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const provider = getStorageProvider();
  if (provider === "aws") {
    return awsPut(relKey, data, contentType);
  }

  if (provider === "catbox") {
    return catboxPut(relKey, data, contentType);
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const provider = getStorageProvider();
  if (provider === "aws") {
    const config = getAwsStorageConfig();
    const key = normalizeKey(relKey);
    return { key, url: buildAwsPublicUrl(config, key) };
  }

  if (provider === "catbox") {
    if (/^https?:\/\//i.test(relKey)) {
      return { key: relKey, url: relKey };
    }

    throw new Error("Catbox storageGet requires the public URL returned by storagePut");
  }

  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

// Configures S3 bucket CORS so browsers can PUT (presigned upload) and GET (video playback)
// from any origin. Called once at server startup; safe to call repeatedly (idempotent).
export async function ensureS3CorsConfigured(): Promise<boolean> {
  if (getStorageProvider() !== "aws") return true;
  try {
    const config = getAwsStorageConfig();
    await getS3Client(config).send(
      new PutBucketCorsCommand({
        Bucket: config.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "HEAD", "PUT"],
              AllowedOrigins: ["*"],
              ExposeHeaders: ["Content-Length", "Content-Range", "ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log("[S3] CORS configurado com sucesso");
    return true;
  } catch (err) {
    console.warn("[S3] Não foi possível configurar CORS automaticamente:", err instanceof Error ? err.message : err);
    return false;
  }
}
