import {
  invokeAnthropicLLM,
  parseClaudeJsonResponse,
  type AnthropicContent,
  type AnthropicImageContent,
} from "./anthropicClient";
import { ENV } from "./env";

export interface InstagramStyleResult {
  accentColor: string;
  bgColor: string;
  fontFamily: string;
  titleAlign: "left" | "center";
  titleSize: number;
  profileName: string;
  profileHandle: string;
  profileImageUrl?: string;
  styleSummary: string;
  toneDescription: string;
}

interface RawProfile {
  username: string;
  name?: string;
  profilePictureUrl?: string;
  postImageUrls: string[];
}

// Download image server-side → base64.
// Instagram CDN URLs expire quickly and are not fetchable by Anthropic's servers.
async function fetchImageAsBase64(url: string): Promise<AnthropicImageContent | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
        Referer: "https://www.instagram.com/",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    if (!mimeType.startsWith("image/")) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 4 * 1024 * 1024) return null; // cap at 4 MB

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: buffer.toString("base64"),
      },
    };
  } catch {
    return null;
  }
}

// Fetch the authenticated user's OWN profile via Graph API.
// Only call this when the requested username matches the connected account.
async function fetchOwnProfileViaGraphApi(
  instagramAccountId: string,
  accessToken: string
): Promise<RawProfile> {
  const base = `${ENV.metaGraphApiBaseUrl}/${ENV.metaGraphApiVersion}`;

  const [profileRes, mediaRes] = await Promise.allSettled([
    fetch(
      `${base}/${instagramAccountId}?fields=name,username,profile_picture_url&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(10_000) }
    ),
    fetch(
      `${base}/${instagramAccountId}/media?fields=media_url,thumbnail_url,media_type&limit=9&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(10_000) }
    ),
  ]);

  type ProfileJson = { name?: string; username?: string; profile_picture_url?: string };
  type MediaJson = { data?: Array<{ media_url?: string; thumbnail_url?: string; media_type?: string }> };

  const profile: ProfileJson =
    profileRes.status === "fulfilled" && profileRes.value.ok
      ? await profileRes.value.json()
      : {};

  const mediaItems: NonNullable<MediaJson["data"]> =
    mediaRes.status === "fulfilled" && mediaRes.value.ok
      ? ((await mediaRes.value.json()) as MediaJson).data ?? []
      : [];

  const postImageUrls = mediaItems
    .map((m) => m.thumbnail_url ?? m.media_url)
    .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
    .slice(0, 9);

  return {
    username: profile.username ?? "",
    name: profile.name,
    profilePictureUrl: profile.profile_picture_url,
    postImageUrls,
  };
}

// Try to scrape basic info from a public Instagram profile page.
// Instagram heavily restricts scraping, so we may only get the og:image (profile pic).
async function fetchPublicProfilePage(username: string): Promise<Partial<RawProfile>> {
  try {
    const res = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(14_000),
    });
    if (!res.ok) return {};
    const html = await res.text();

    // Profile picture from OG tag
    const ogImage = html
      .match(/<meta property="og:image" content="([^"]+)"/)?.[1]
      ?.replace(/&amp;/g, "&");

    // Display name from OG title: "Name (@handle) • Instagram..."
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] ?? "";
    const name = ogTitle.match(/^([^(@•\|]+)/)?.[1]?.trim() || undefined;

    // Try to find post image URLs embedded in the page JSON
    const postImageUrls: string[] = [];
    // Instagram embeds image URLs in various JSON structures in the page
    const cdnPattern = /https:\/\/[^"']+\.cdninstagram\.com\/[^"']+\.(?:jpg|jpeg|png|webp)/gi;
    const allCdnUrls = Array.from(html.matchAll(cdnPattern)).map((m) => m[0]);
    // Deduplicate and skip profile picture (usually the first/smallest)
    const seen = new Set<string>();
    for (const url of allCdnUrls) {
      // Skip tiny thumbnails (usually size indicators like s150x150 or p150x150)
      if (/[_/]s\d{2,3}x\d{2,3}[_/]/.test(url)) continue;
      if (seen.has(url) || url === ogImage) continue;
      seen.add(url);
      postImageUrls.push(url);
      if (postImageUrls.length >= 6) break;
    }

    return {
      username,
      name,
      profilePictureUrl: ogImage,
      postImageUrls,
    };
  } catch {
    return { username };
  }
}

export async function analyzeInstagramProfileStyle(params: {
  username: string;
  connectedAccount?: {
    instagramAccountId: string;
    accessToken: string;
    username?: string;
    name?: string | null;
    profilePictureUrl?: string | null;
  } | null;
}): Promise<InstagramStyleResult> {
  const { username, connectedAccount } = params;
  const cleanUsername = username
    .replace(/^@/, "")
    .replace(/.*instagram\.com\//, "")
    .replace(/\/.*$/, "")
    .split("?")[0]
    .trim()
    .toLowerCase();

  let profile: RawProfile = { username: cleanUsername, postImageUrls: [] };

  // Only use the Graph API when the requested profile IS the connected account.
  // Using it for other profiles would return the wrong account's media.
  const isOwnConnectedProfile =
    connectedAccount &&
    connectedAccount.username &&
    connectedAccount.username.toLowerCase() === cleanUsername;

  if (isOwnConnectedProfile) {
    try {
      const apiData = await fetchOwnProfileViaGraphApi(
        connectedAccount!.instagramAccountId,
        connectedAccount!.accessToken
      );
      profile = {
        ...apiData,
        name: apiData.name ?? connectedAccount!.name ?? undefined,
        profilePictureUrl: apiData.profilePictureUrl ?? connectedAccount!.profilePictureUrl ?? undefined,
      };
      console.log(`[InstagramStyleAgent] Got ${profile.postImageUrls.length} posts via Graph API for @${cleanUsername}`);
    } catch (err) {
      console.warn("[InstagramStyleAgent] Graph API failed:", err);
    }
  }

  // For any profile (own or external): also try the public page to fill gaps
  if (profile.postImageUrls.length === 0) {
    const pub = await fetchPublicProfilePage(cleanUsername);
    profile = {
      username: cleanUsername,
      name: profile.name ?? pub.name,
      profilePictureUrl: profile.profilePictureUrl ?? pub.profilePictureUrl,
      postImageUrls: pub.postImageUrls ?? [],
    };
    console.log(`[InstagramStyleAgent] Public page scraped: pic=${!!profile.profilePictureUrl}, posts=${profile.postImageUrls.length} for @${cleanUsername}`);
  }

  // Download all images server-side → base64 (Anthropic can't fetch Instagram CDN URLs)
  const allImageUrls = [
    profile.profilePictureUrl,
    ...profile.postImageUrls,
  ].filter((u): u is string => !!u && u.startsWith("http"));

  const imageBlocks: AnthropicImageContent[] = [];
  await Promise.all(
    allImageUrls.slice(0, 6).map(async (url) => {
      const block = await fetchImageAsBase64(url);
      if (block) imageBlocks.push(block);
    })
  );

  console.log(`[InstagramStyleAgent] Sending ${imageBlocks.length} base64 images to Claude for @${cleanUsername}`);

  const profileDesc = profile.name
    ? `@${cleanUsername} (${profile.name})`
    : `@${cleanUsername}`;

  const systemPrompt = `Você é um especialista em extração de paleta de cores e identidade visual a partir de imagens reais. Você DEVE analisar os pixels das imagens fornecidas — nunca adivinhe cores com base no nome da marca ou do setor. Retorne APENAS JSON válido.`;

  const jsonSchema = `{
  "accentColor": "#RRGGBB — cor de destaque mais usada nas imagens (logo, botões, títulos coloridos, ícones)",
  "bgColor": "#RRGGBB — cor de fundo dominante dos posts",
  "fontFamily": "um de: 'system-ui, -apple-system, sans-serif' | 'Georgia, \\'Times New Roman\\', serif' | 'Impact, \\'Arial Black\\', sans-serif' | '\\'Courier New\\', Courier, monospace' | '\\'Helvetica Neue\\', Helvetica, Arial, sans-serif'",
  "titleAlign": "left ou center",
  "titleSize": número 0.8–1.2,
  "profileName": "nome do perfil",
  "profileHandle": "@handle",
  "styleSummary": "2-3 frases descrevendo o estilo visual EXATO observado nas imagens (mencione as cores reais)",
  "toneDescription": "1 frase sobre o tom de comunicação"
}`;

  const userContent: AnthropicContent[] = imageBlocks.length > 0
    ? [
        {
          type: "text",
          text: `Analise as ${imageBlocks.length} imagens do perfil ${profileDesc}. Identifique as cores EXATAS (em hex) que aparecem nas imagens — fundo, destaque, texto colorido, logo. NÃO use cores baseadas no setor ou nome da marca.`,
        },
        ...imageBlocks,
        {
          type: "text",
          text: `Baseado SOMENTE nas cores que você viu acima, retorne:\n${jsonSchema}`,
        },
      ]
    : [
        {
          type: "text",
          text: `Não foi possível carregar imagens do perfil ${profileDesc}. Informe no styleSummary que as imagens não estavam disponíveis e sugira uma identidade visual genérica:\n${jsonSchema}`,
        },
      ];

  const fallback: InstagramStyleResult = {
    accentColor: "#29d9ff",
    bgColor: "#0d1117",
    fontFamily: "system-ui, -apple-system, sans-serif",
    titleAlign: "left",
    titleSize: 1,
    profileName: profile.name ?? cleanUsername,
    profileHandle: `@${cleanUsername}`,
    profileImageUrl: profile.profilePictureUrl,
    styleSummary: "Não foi possível carregar as imagens do perfil para análise.",
    toneDescription: "Comunicação profissional.",
  };

  const raw = await invokeAnthropicLLM({
    system: systemPrompt,
    userContent,
    maxTokens: 700,
  });

  const parsed = parseClaudeJsonResponse<Partial<InstagramStyleResult>>(raw, {});

  return {
    ...fallback,
    ...parsed,
    profileHandle: `@${String(parsed.profileHandle ?? cleanUsername).replace(/^@/, "")}`,
    profileImageUrl: profile.profilePictureUrl ?? parsed.profileImageUrl,
  };
}
